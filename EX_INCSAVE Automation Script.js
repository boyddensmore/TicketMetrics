//
//    Script to create a worklog entry on save of an Incident
//    - worklog entry to be created only if the EXWORKLOGGER field is populated
//    - blank the exworklog field on successful creation of the worklog entry
//

importPackage(Packages.psdi.util);
importClass(java.util.Calendar);
importPackage(Packages.psdi.app.common);
importPackage(Packages.psdi.util.logging);

var myLogger = MXLoggerFactory.getLogger("maximo.script.autoscript");

var exworklog = mbo.getMboValue("EXWORKLOGGER");

if(exworklog != undefined && exworklog.isModified() && !exworklog.isNull() && exworklog.getString().length() > 0)
{
    try
    {
        //    get an empty worklog collection
        var worklogs = mbo.getMboSet("WORKLOG");
        worklogs.setWhere("1=0");
        worklogs.reset();

        //    get a title
        var title = HTML.toPlainText(exworklog.getString(), true);
        title = getTitle(title);


        //    add a worklog entry to the collection
        var worklog = worklogs.add();

        //  Set default log type
        if (mbo.getMboValue("EXWORKLOGTYPE").isNull())
        {
          worklog.setValue("LOGTYPE","WORK");
        }
        else
        {
          worklog.setValue("LOGTYPE",mbo.getMboValue("EXWORKLOGTYPE"))
        }

        worklog.setValue("DESCRIPTION",title);
        worklog.setValue("DESCRIPTION_LONGDESCRIPTION",exworklog.getString());
        //worklog.setValue("DESCRIPTION_LONGDESCRIPTION",exworklog);


        //    Clear the EXWORKLOGGER field
        exworklog.setValue("");
        mbo.setValue("EXWORKLOGTYPE","");

        //
        //    Update the Updated checkbox if edited by someone other than Owner
        //    Required here and farther down the script for 2 different cases
        //
        if (mbo.getMboValue("OWNER") != user)
        {
          mbo.setValue("EXUPDATED",1);
        }

        //    save the collection
        worklogs.save();
    }
    catch(ex)
    {
        //    display an error message to the user
        errorgroup = "error";
        errorkey = ex;
    }
    finally
    {
        //    close the collection
        if(worklogs != undefined)
        {
            worklogs.close();
        }
    }
}

//
//    Update the Updated checkbox if edited by someone other than Owner
//    Required here and farther up the script for 2 different cases
//
if (mbo.getMboValue("OWNER") != user)
{
  mbo.setValue("EXUPDATED",1);
}

//
//    Re-apply SLA if Priority or CI has changed AND an SLA is already applied.
//
var newPriority = mbo.getString("INTERNALPRIORITY");
var oldPriority = mbo.getMboInitialValue("INTERNALPRIORITY").asString();
var newCI = mbo.getString("CINUM");
var oldCI = mbo.getMboInitialValue("CINUM").asString();

if  ((!newPriority.equals(oldPriority)) || (!newCI.equals(oldCI)))
{
    println ("TRYING TO APPLY SLA");
    var slaRecordSet = mbo.getMboSet("REP_SLA");
    slaRecordSet.applySLA();
}

//    returns either
//    - the first line if it is shorter than 100 characters
//    - the first 100 characters if the first line is over 100 characters
//    - the text if the text is less than 100 character but has no line end
function getTitle(text)
{
    var line_end = text.indexOf('\n');

    if(line_end > 0 && line_end < 101)
    {
//        return text.substring(0,line_end - 1);
        return text.substring(0,line_end);
    }

    if(text.length() > 100)
    {
        return text.substring(0,100);
    }

    return text;
}

////////////////////////////////////////////////////////////////////////////////////
//
//  Populates the EX_TICKETMETRICS table upon save
//
////////////////////////////////////////////////////////////////////////////////////

var oldOwnerGroup = mbo.getMboInitialValue("OWNERGROUP").asString();
var oldOwner = mbo.getMboInitialValue("OWNER").asString();
var newOwnerGroup = mbo.getString("OWNERGROUP");
var newOwner = mbo.getString("OWNER");

myLogger.debug(">>>>>  EX_INCSAVE | MAIN | Begin");

myLogger.debug(">>>>>  EX_INCSAVE | MAIN | EX_SRSAVE running on ticket: " + mbo.getMboValue("TICKETID"));

// If no SLA is applied, try applying an SLA
var appliedSlaRecordSet = mbo.getMboSet("SLARECORDS");
if  (appliedSlaRecordSet.isEmpty() || appliedSlaRecordSet.count() < 1)
{
	println (">>>>>  EX_INCSAVE | MAIN | No SLA on ticket.  Trying to apply SLA.");
	var slaRecordSet = mbo.getMboSet("REP_SLA");
	slaRecordSet.applySLA();
}

var slaRecordSet = mbo.getMboSet("SLARECORDS");

if (slaRecordSet.isEmpty() || slaRecordSet.count() < 1) {
	myLogger.warn(">>>>>  EX_SRSAVE | MAIN | No SLA is applied, not calculating EX_TICKETMETRICS resolution details!");
} else {
	myLogger.debug(">>>>>  EX_SRSAVE | MAIN | SLA Set Count: " + slaRecordSet.count());
	
	if ((mbo.getMboValue("OWNERGROUP").isModified() && (!newOwnerGroup.equals(oldOwnerGroup))) ||
		(mbo.getMboValue("OWNER").isModified() && (!newOwner.equals(oldOwner)))) {

		myLogger.debug(">>>>>  EX_INCSAVE | MAIN | Owner or Ownergroup has changed");

		//Create a instance for Calendar
		var cal = Calendar.getInstance();

		// Get count of EX_TICKETMETRICS rows
		var EX_TICKETMETRICS = mbo.getMboSet("EX_TICKETMETRICS");
		swhere = "EX_TICKETMETRICSid in (select EX_TICKETMETRICSid from EX_TICKETMETRICS where ticketid = '" + mbo.getMboValue("TICKETID") + "')";
		EX_TICKETMETRICS.setWhere(swhere);
		EX_TICKETMETRICS.reset();

		var metricCount = EX_TICKETMETRICS.count();

		// Get most recent EX_TICKETMETRICS row
		swhere = "EX_TICKETMETRICSid in (select max (EX_TICKETMETRICSid) from EX_TICKETMETRICS where ticketid = '" + mbo.getMboValue("TICKETID") + "')";
		EX_TICKETMETRICS.setWhere(swhere);
		EX_TICKETMETRICS.reset();

		if (EX_TICKETMETRICS.count() > 0) {
			//Update existing latest EX_TICKETMETRICS record
			myLogger.debug(">>>>>  EX_INCSAVE | MAIN | EX_TICKETMETRICS record exists.  Updating it with response and resolution time.");
			var ticketmetric = EX_TICKETMETRICS.getMbo(0);

			// Calculate the business minutes current team has held the ticket
			// If we're updating the first metrics row calculate from ReportDate, else from Owndate
			if (metricCount == 1) {
				var actualResolutionTime = calcBusTime(ticketmetric.getDate("REPORTDATE"), cal.getTime());
				myLogger.debug(">>>>>  EX_INCSAVE | MAIN | metricCount: " + metricCount);
				myLogger.debug(">>>>>  EX_INCSAVE | MAIN | actualResolutionTime: " + actualResolutionTime);
				myLogger.debug(">>>>>  EX_INCSAVE | MAIN | ticketmetric.getMboValue(EX_TICKETMETRICSID): " + ticketmetric.getMboValue("EX_TICKETMETRICSID"));
				ticketmetric.setValue("ACTUALRESOLUTIONCALCMINS", actualResolutionTime);
			}
			else {
				var actualResolutionTime = calcBusTime(ticketmetric.getDate("OWNDATE"), cal.getTime());
				myLogger.debug(">>>>>  EX_INCSAVE | MAIN | metricCount: " + metricCount);
				myLogger.debug(">>>>>  EX_INCSAVE | MAIN | actualResolutionTime: " + actualResolutionTime);
				myLogger.debug(">>>>>  EX_INCSAVE | MAIN | ticketmetric.getMboValue(EX_TICKETMETRICSID): " + ticketmetric.getMboValue("EX_TICKETMETRICSID"));
				ticketmetric.setValue("ACTUALRESOLUTIONCALCMINS", actualResolutionTime);
			}

			// Don't overwrite ACTUALRESPONSECALCMINS
			var ACTUALRESPONSECALCMINS = ticketmetric.getMboValue("ACTUALRESPONSECALCMINS");
			if (ACTUALRESPONSECALCMINS.isNull() || ACTUALRESPONSECALCMINS == undefined) {
				ticketmetric.setValue("ACTUALRESPONSECALCMINS", actualResolutionTime);
			}

		}

		// Create a new record for the new ownergroup.
		myLogger.debug(">>>>>  EX_INCSAVE | MAIN | Creating new EX_TICKETMETRICS record for new team or person.");

		//    add a EX_TICKETMETRICS entry to the collection
		var ticketmetric = EX_TICKETMETRICS.add();

		ticketmetric.setValue("TICKETID", mbo.getMboValue("TICKETID"));
		ticketmetric.setValue("CLASS", mbo.getMboValue("CLASS"));
		ticketmetric.setValue("ORGID", mbo.getMboValue("ORGID"));
		ticketmetric.setValue("SITEID", mbo.getMboValue("SITEID"));
		ticketmetric.setValue("OWNERGROUP", mbo.getMboValue("OWNERGROUP"));
		ticketmetric.setValue("OWNER", mbo.getMboValue("OWNER"));
		ticketmetric.setValue("REPORTDATE", mbo.getMboValue("REPORTDATE"));
		ticketmetric.setValue("STATUS", mbo.getMboValue("STATUS"));
		ticketmetric.setValue("EX_PENDINGREASON", mbo.getMboValue("EX_PENDINGREASON"));

		//Get Current date and time by using cal.getTime()
		var currentDateTime = cal.getTime();
		ticketmetric.setValue("OWNDATE", currentDateTime);

		//Clear the SR REsponded to flag
		mbo.setValue("EX_RESPONDED", 0);

	}
}

myLogger.debug(">>>>>  EX_INCSAVE | MAIN | End");

// Function to calculate the target response date
function calcTargRespDate(reportDate) {
	myLogger.debug(">>>>>  EX_INCSAVE | calcTargRespDate() | Begin");
	var totMinsToAdd = 240;
	dt = DateUtility.addMinutes(reportDate, totMinsToAdd);
	return dt;
}

// Function to calculate the target resolution date
function calcTargResolutionDate(reportDate) {
	myLogger.debug(">>>>>  EX_INCSAVE | calcTargResolutionDate() | Begin");
	var totMinsToAdd = 480;
	dt = DateUtility.addMinutes(reportDate, totMinsToAdd);
	return dt;
}

function calcBusTime(startDate, endDate) {
	//
	//   Script for calculating actual resolution time
	//

	myLogger.debug(">>>>>  EX_INCSAVE | calcBusTime() | Begin");

	importPackage(Packages.psdi.app);
	importPackage(Packages.psdi.mbo);
	importPackage(Packages.psdi.server);

	var slaRecordSet = mbo.getMboSet("SLARECORDS");

	if (slaRecordSet.isEmpty() || slaRecordSet.count() < 1) {
		myLogger.warn(">>>>>  EX_INCSAVE | calcBusTime() | No SLA is applied, not calculating EX_TICKETMETRICS resolution details!");
	} else {
		myLogger.debug(">>>>>  EX_INCSAVE | calcBusTime() | SLA Set Count: " + slaRecordSet.count());
		myLogger.debug(">>>>>  EX_INCSAVE | calcBusTime() | Calculating time between " + startDate + " and " + endDate);

		var slaRecordMbo = slaRecordSet.getMbo(0);

		/* Fetch all the required variables to pass to the function to calculate the Total working hours. */

		var varorg = slaRecordMbo.getMboValue("CALCORGID"); // ENMAX
		var varcal = slaRecordMbo.getMboValue("CALCCALENDAR"); // DAY
		var varshift = slaRecordMbo.getMboValue("CALCSHIFT"); // DAY

		/* Get the total minutes from workperiod */
		var totMins = getHours(startDate, endDate, varcal, varshift, varorg);
		myLogger.debug(">>>>>  EX_INCSAVE | calcBusTime() | totMins: " + totMins);

		/* Get the remaining hours on the start and end dates */
		var wrkHrsStart = getStartHours(startDate, varcal, varshift, varorg);
		myLogger.debug(">>>>>  EX_INCSAVE | calcBusTime() | wrkHrsStart: " + wrkHrsStart);
		if (wrkHrsStart > 0) {
			var startDateMins = calcRem(wrkHrsStart);
		} else {
			var startDateMins = 0;
		}

		/* Get the remaining hours on the end date */
		var wrkHrsEnd = getEndHours(endDate, varcal, varshift, varorg);
		myLogger.debug(">>>>>  EX_INCSAVE | calcBusTime() | wrkHrsEnd: " + wrkHrsEnd);

		if (wrkHrsEnd > 0) {
			var endDateMins = calcRem(wrkHrsEnd);
		} else {
			var endDateMins = 0;
		}

		/* Call The getNonWrkMins method to calculate the non-work hrs */
		var nonWrkMins = getNonWrkMins(startDate, endDate);
		myLogger.debug(">>>>>  EX_INCSAVE | calcBusTime() | nonWrkMins: " + nonWrkMins);

		/* Subtract the nonwrk hrs from total */
		var finalvalue = (Math.abs(totMins - (startDateMins + endDateMins))) - (nonWrkMins);
		myLogger.debug(">>>>>  EX_INCSAVE | calcBusTime() | finalvalue: " + finalvalue);

		if (finalvalue < 0) {
			finalvalue = 0;
		}

		return finalvalue;
	}

	myLogger.debug(">>>>>  EX_INCSAVE | calcBusTime() | End");
	myLogger.debug(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");
}

/* This function gets the total working hours from the workperiod table */

function getHours(startDt, endDt, calName, shift, org) {
	//myLogger.debug(">>>>>  EX_INCSAVE | getHours() | Begin");

	startDt = DateUtility.getDate(startDt);
	endDt = DateUtility.getDate(endDt);

	// Truncate start and end days to beginning of the days
	var startDt2 = new Date(startDt);
	startDt2 = ISODateString(startDt2);
	var endDt2 = new Date(endDt);
	endDt2 = ISODateString(endDt2);

	// Find working days the two days span and get the sum of the working hours in those days.
	var sqf = new SqlFormat(mbo, "calnum = :1 and orgid = :2 and shiftnum = :3 and workdate between :4 and :5");
	sqf.setObject(1, "WORKPERIOD", "CALNUM", calName);
	sqf.setObject(2, "WORKPERIOD", "ORGID", org);
	sqf.setObject(3, "WORKPERIOD", "SHIFTNUM", shift);
	sqf.setObject(4, "WORKPERIOD", "WORKDATE", startDt2);
	sqf.setObject(5, "WORKPERIOD", "WORKDATE", endDt2);

	var calSet = mbo.getMboSet("$workperiod", "WORKPERIOD", sqf.format());

	var totWrkhrs = calSet.sum("workhours");

	return calcMin(totWrkhrs, "HOURS");
}

/* Get the nonWork Hours from the NONWORKTIME table..*/

function getNonWrkMins(startDt, endDt) {
	//myLogger.debug(">>>>>  EX_INCSAVE | getNonWrkMins() | Begin");

	startDt = DateUtility.getDate(startDt);
	endDt = DateUtility.getDate(endDt);

	var startDt2 = new Date(startDt);
	startDt2 = ISODateString(startDt2);

	var endDt2 = new Date(endDt);
	endDt2 = ISODateString(endDt2);

	var sqf = new SqlFormat(mbo, "startdate between :1 and :2");
	sqf.setObject(1, "NONWORKTIME", "STARTDATE", startDt2);
	sqf.setObject(2, "NONWORKTIME", "STARTDATE", endDt2);
	var nonWrkSet = mbo.getMboSet("$nonworktime", "NONWORKTIME", sqf.format());
	var totNonWrkDays = nonWrkSet.count();
	var nonwrkHrs = 0;
	if (totNonWrkDays > 0) {
		nonwrkHrs = 8 * totNonWrkDays;
	}
	return calcMin(nonwrkHrs, "HOURS");
}

/* This function calculates the remaining hours on the start and end dates */

function getStartHours(workDate, calName, shift, org) {

	//myLogger.debug(">>>>>  EX_INCSAVE | getStartHours() | Begin");

	workDateCopy = DateUtility.getDate(workDate);
	var workDate2 = new Date(workDateCopy);
	workDate2 = ISODateString(workDate2);

	var sqf = new SqlFormat(mbo, "calnum = :1 and orgid = :2 and shiftnum = :3 and workdate = :4");
	sqf.setObject(1, "WORKPERIOD", "CALNUM", calName);
	sqf.setObject(2, "WORKPERIOD", "ORGID", org);
	sqf.setObject(3, "WORKPERIOD", "SHIFTNUM", shift);
	sqf.setObject(4, "WORKPERIOD", "WORKDATE", workDate2);
	var calSet = mbo.getMboSet("$workperiod", "WORKPERIOD", sqf.format());

	var tempDate = workDate.clone();
	tempDate.setMonth(0);
	tempDate.setDate(1);
	tempDate.setYear(70);

	// If a calendar was returned and the number of working hours for the day is greater than 0
	if (calSet.getMbo(0) != null && calSet.sum("workhours") != 0) {
		var stTime = calSet.getMbo(0).getDate("STARTTIME").getTime();
		var edTime = calSet.getMbo(0).getDate("ENDTIME").getTime();

		if (tempDate.getTime() < stTime) {
			// Time of action is before SLA starts.  Return number of working milliseconds for 
			// the day to nullify the day in calculations
			return calSet.sum("workhours") * 60 * 60 * 1000;
		} else if (tempDate.getTime() > edTime) {
			return edTime - stTime;
		} else {
			var timeDiff = tempDate.getTime() - stTime;
			return timeDiff;
		}
	} else {
		return 0;
	}
}

/* This function calculates the remaining hours on the end dates */

function getEndHours(workDate, calName, shift, org) {

	//myLogger.debug(">>>>>  EX_INCSAVE | getEndHours() | Begin");

	workDateCopy = DateUtility.getDate(workDate);
	var workDate2 = new Date(workDateCopy);
	workDate2 = ISODateString(workDate2);

	var sqf = new SqlFormat(mbo, "calnum = :1 and orgid = :2 and shiftnum = :3 and workdate = :4");
	sqf.setObject(1, "WORKPERIOD", "CALNUM", calName);
	sqf.setObject(2, "WORKPERIOD", "ORGID", org);
	sqf.setObject(3, "WORKPERIOD", "SHIFTNUM", shift);
	sqf.setObject(4, "WORKPERIOD", "WORKDATE", workDate2);
	var calSet = mbo.getMboSet("$workperiod", "WORKPERIOD", sqf.format());

	var tempDate = workDate.clone();
	tempDate.setMonth(0);
	tempDate.setDate(1);
	tempDate.setYear(70);

	if (calSet.getMbo(0) != null && calSet.sum("workhours") != 0) {
		var stTime = calSet.getMbo(0).getDate("STARTTIME").getTime();
		var edTime = calSet.getMbo(0).getDate("ENDTIME").getTime();

		if (tempDate.getTime() < stTime) {
			return 0;
		} else if (tempDate.getTime() > edTime) {
			return edTime - stTime;
		} else {
			var timeDiff = edTime - tempDate.getTime();
			return timeDiff;
		}
	} else {
		return 0;
	}
}

/* Function to return the remaining time in Minutes */

function calcMin(value, unit) {
	//myLogger.debug(">>>>>  EX_INCRESPDATE | calcMin() | Begin");

	switch(unit) {
		case "MINUTES":
			elapsedminutes = value;
			break;
		case "HOURS":
			elapsedminutes = value * 60;
			break;
		case "DAYS":
			elapsedminutes = value * 1440;
			break;
		default:
			elapsedminutes = -1;
	}
	return elapsedminutes;
}

/* function to calculate the remaining minutes */
function calcRem(tdiff) {
	//myLogger.debug(">>>>>  EX_INCSAVE | calcRem() | Begin");
	secondinmillis = 1000;
	minuteinmillis = secondinmillis * 60;
	elapsedminutes = tdiff / minuteinmillis;
	return elapsedminutes;
}


function addTicketMetricRec() {
	myLogger.debug(">>>>>  EX_INCSAVE | addTicketMetricRec() | Begin");

	try {
		//    get an empty EX_TICKETMETRICS collection
		var newMetrics = mbo.getMboSet("EX_TICKETMETRICS");
		newMetrics.setWhere("1=0");
		newMetrics.reset();

		//    add a EX_TICKETMETRICS entry to the collection
		var newMetric = newMetrics.add();
		newMetric.setValue("TICKETID", mbo.getMboValue("TICKETID"));
		newMetric.setValue("CLASS", mbo.getMboValue("CLASS"));
		newMetric.setValue("ORGID", mbo.getMboValue("ORGID"));
		newMetric.setValue("SITEID", mbo.getMboValue("SITEID"));
		newMetric.setValue("OWNERGROUP", mbo.getMboValue("OWNERGROUP"));
		newMetric.setValue("OWNER", mbo.getMboValue("OWNER"));
		newMetric.setValue("REPORTDATE", mbo.getDate("REPORTDATE"));
		newMetric.setValue("STATUS", mbo.getMboValue("STATUS"));
		newMetric.setValue("EX_PENDINGREASON", mbo.getMboValue("EX_PENDINGREASON"));

		var ownerHistory = mbo.getMboSet("REP_OWNERHIST");
		ownerHistory.setWhere("TKOWNERHISTORYID in (select max(TKOWNERHISTORYID) from TKOWNERHISTORY where ticketid = '" + mbo.getMboValue("TICKETID") + "')");
		ownerHistory.reset();

		var ownDate = ownerHistory.getMbo(0).getDate("OWNDATE");

		newMetric.setValue("OWNDATE", ownDate);

		//Create a instance for Calendar
		var cal = Calendar.getInstance();
		//Get Current date and time by using cal.getTime()
		var currentDateTime = cal.getTime();

		newMetric.setValue("ACTUALRESOLUTIONDATE", mbo.getDate("STATUSDATE"));

		var actualResolutionTime = calcBusTime(mbo.getDate("REPORTDATE"), mbo.getDate("STATUSDATE"));
		newMetric.setValue("ACTUALRESOLUTIONCALCMINS", actualResolutionTime);

	} catch (ex) {
		//    display an error message to the user
		errorgroup = "error";
		errorkey = ex;
	}
}

function ISODateString(d) {
	//myLogger.debug(">>>>>  EX_INCSAVE | ISODateString() | Begin");
	function pad(n) {
		return n < 10 ? '0' + n : n
	}
	return d.getUTCFullYear() + '-'
	 + pad(d.getUTCMonth() + 1) + '-'
	 + pad(d.getUTCDate()) + 'T'
	 + pad(d.getUTCHours()) + ':'
	 + pad(d.getUTCMinutes()) + ':'
	 + pad(d.getUTCSeconds())
}
