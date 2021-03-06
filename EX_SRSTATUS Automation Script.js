//
// Script For populating data in EX_TICKETMETRICS table on Status Change
//

importPackage(Packages.psdi.util);
importClass(java.util.Calendar);
importClass(java.text.SimpleDateFormat);
importClass(java.text.ParseException);
importPackage(Packages.psdi.util.logging);
importPackage(Packages.psdi.app);
importPackage(Packages.psdi.app.common);
importPackage(Packages.psdi.mbo);

var myLogger = MXLoggerFactory.getLogger("maximo.script.autoscript");

var oldStatus = mbo.getMboInitialValue("STATUS");
var newStatus = mbo.getString("STATUS");
var cal = Calendar.getInstance();
var currentDateTime = cal.getTime();

myLogger.debug(">>>>>  EX_SRSTATUS | MAIN | currentDateTime: " + currentDateTime);
myLogger.debug(">>>>>  EX_SRSTATUS | MAIN | Old Status: " + oldStatus);
myLogger.debug(">>>>>  EX_SRSTATUS | MAIN | New Status: " + newStatus);

var slaRecordSet = mbo.getMboSet("SLARECORDS");

if (slaRecordSet.isEmpty() || slaRecordSet.count() < 1) {
	myLogger.warn(">>>>>  EX_SRSTATUS | MAIN | No SLA is applied, not calculating EX_TICKETMETRICS resolution details!");
} else {
	myLogger.debug(">>>>>  EX_SRSTATUS | MAIN | SLA Set Count: " + slaRecordSet.count());
	if (!(oldStatus.isNull() || oldStatus == undefined)) {
		myLogger.debug(">>>>>  EX_SRSTATUS | MAIN | Old Status is not empty/undefined, record has been saved at least once.");
		//Check for existing metric row
		var EX_TICKETMETRICS = mbo.getMboSet("EX_TICKETMETRICS");
		swhere = "EX_TICKETMETRICSid in (select max (EX_TICKETMETRICSid) from EX_TICKETMETRICS where ticketid = '" + mbo.getMboValue("TICKETID") + "')";
		EX_TICKETMETRICS.setWhere(swhere);
		EX_TICKETMETRICS.reset();

		//If no existing row, create one for new status
		if (EX_TICKETMETRICS.isEmpty() || EX_TICKETMETRICS.count() < 1) {

			myLogger.debug(">>>>>  EX_SRSTATUS | MAIN | no existing row, create one for new status.");

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
			newMetric.setValue("STATUS", oldStatus);
			newMetric.setValue("EX_PENDINGREASON", mbo.getMboValue("EX_PENDINGREASON"));

			var ownerHistory = mbo.getMboSet("REP_OWNERHIST");
			ownerHistory.setWhere("TKOWNERHISTORYID in (select max(TKOWNERHISTORYID) from TKOWNERHISTORY where ticketid = '" + mbo.getMboValue("TICKETID") + "')");
			ownerHistory.reset();

			var ownDate = ownerHistory.getMbo(0).getDate("OWNDATE");

			newMetric.setValue("OWNDATE", ownDate);

			var actualResolutionTime = calcBusTime(mbo.getDate("REPORTDATE"), currentDateTime);
			myLogger.debug(">>>>>  EX_SRSTATUS | MAIN | New TM Rec: actualResolutionTime: " + actualResolutionTime);
			newMetric.setValue("ACTUALRESOLUTIONCALCMINS", actualResolutionTime);

			// Don't overwrite ACTUALRESPONSECALCMINS
			var ACTUALRESPONSECALCMINS = newMetric.getMboValue("ACTUALRESPONSECALCMINS");
			if (ACTUALRESPONSECALCMINS.isNull() || ACTUALRESPONSECALCMINS == undefined) {
				newMetric.setValue("ACTUALRESPONSECALCMINS", actualResolutionTime);
			}

		//If existing row, update it with "closure" details
		}else {

			myLogger.debug(">>>>>  EX_SRSTATUS | MAIN | existing row, update it with 'closure' details.");

			var ticketmetric = EX_TICKETMETRICS.getMbo(0);

			var actualResolutionTime = calcBusTime(ticketmetric.getDate("OWNDATE"), cal.getTime());
			myLogger.debug(">>>>>  EX_SRSTATUS | MAIN | Existing TM Rec: actualResolutionTime: " + actualResolutionTime);

			ticketmetric.setValue("ACTUALRESOLUTIONCALCMINS", actualResolutionTime);

			// Don't overwrite ACTUALRESPONSECALCMINS
			var ACTUALRESPONSECALCMINS = ticketmetric.getMboValue("ACTUALRESPONSECALCMINS");
			if (ACTUALRESPONSECALCMINS.isNull() || ACTUALRESPONSECALCMINS == undefined) {
				ticketmetric.setValue("ACTUALRESPONSECALCMINS", actualResolutionTime);
			}
		}
		
		// In all cases, create new row for new status
		// myLogger.debug(">>>>>  EX_SRSTATUS | MAIN | create new row for new status.");
		// var newMetrics = mbo.getMboSet("EX_TICKETMETRICS");
		// newMetrics.setWhere("1=0");
		// newMetrics.reset();

		//    add a EX_TICKETMETRICS entry to the collection
		myLogger.debug(">>>>>  EX_SRSTATUS | MAIN | Adding row for new status.");
		var newMetric = EX_TICKETMETRICS.add();
		newMetric.setValue("TICKETID", mbo.getMboValue("TICKETID"));
		newMetric.setValue("CLASS", mbo.getMboValue("CLASS"));
		newMetric.setValue("ORGID", mbo.getMboValue("ORGID"));
		newMetric.setValue("SITEID", mbo.getMboValue("SITEID"));
		newMetric.setValue("OWNERGROUP", mbo.getMboValue("OWNERGROUP"));
		newMetric.setValue("OWNER", mbo.getMboValue("OWNER"));
		newMetric.setValue("REPORTDATE", mbo.getDate("REPORTDATE"));
		newMetric.setValue("STATUS", mbo.getMboValue("STATUS"));
		newMetric.setValue("EX_PENDINGREASON", mbo.getMboValue("EX_PENDINGREASON"));
		// myLogger.debug(">>>>>  EX_SRSTATUS | MAIN-CreateNew | Setting EX_PENDINGREASON: " + mbo.getMboValue("EX_PENDINGREASON"));

		newMetric.setValue("OWNDATE", currentDateTime);

		if (mbo.getMboValue("STATUS") == "RESOLVED") {
			newMetric.setValue("ACTUALRESOLUTIONDATE", currentDateTime);
		}

		if (mbo.getMboValue("STATUS") == "REOPEN") {
			
			myLogger.debug(">>>>>  EX_SRSTATUS | MAIN | REOPEN | Reopening ticket, clearing EX_RESPONDED flag.");
			
			//Clear the SR REsponded to flag so another email will be sent to customer when put back into INPROG
			mbo.setValue("EX_RESPONDED", 0);
		}

		if ((oldStatus == "SLAHOLD") && (newStatus != "SLAHOLD")) {
			mbo.setValue("EX_PENDINGREASON", "");
		}

		// Save ticketmetrics so that everything is committed properly.
		// myLogger.debug(">>>>>  EX_SRSTATUS | MAIN | END | Saving.");
		// EX_TICKETMETRICS.save();
		myLogger.debug(">>>>>  EX_SRSTATUS | MAIN | END");

	}
}

function calcBusTime(startDate, endDate) {
	//
	//   Script for calculating actual resolution time
	//

	//myLogger.debug(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");
	myLogger.debug(">>>>>  EX_SRSTATUS | calcBusTime() | Begin");

	importPackage(Packages.psdi.app);
	importPackage(Packages.psdi.mbo);
	importPackage(Packages.psdi.server);

	var slaRecordSet = mbo.getMboSet("SLARECORDS");

	if (slaRecordSet.isEmpty() || slaRecordSet.count() < 1) {
		myLogger.warn(">>>>>  EX_SRSTATUS | calcBusTime() | No SLA is applied, not calculating EX_TICKETMETRICS resolution details!");
		myLogger.warn(">>>>>  EX_SRSTATUS | calcBusTime() | No SLA warning has been displayed.");
	} else {
		myLogger.debug(">>>>>  EX_SRSTATUS | calcBusTime() | About to display SLA Set Count ");
		myLogger.debug(">>>>>  EX_SRSTATUS | calcBusTime() | SLA Set Count: " + slaRecordSet.count());

		var slaRecordMbo = slaRecordSet.getMbo(0);

		/* Fetch all the required variables to pass to the function to calculate the Total working hours.*/

		var varorg = slaRecordMbo.getMboValue("CALCORGID"); // ENMAX
		var varcal = slaRecordMbo.getMboValue("CALCCALENDAR"); // DAY
		var varshift = slaRecordMbo.getMboValue("CALCSHIFT"); // DAY

		myLogger.debug(">>>>>  EX_SRSTATUS | calcBusTime() | varorg: " + varorg);
		myLogger.debug(">>>>>  EX_SRSTATUS | calcBusTime() | varcal: " + varcal);
		myLogger.debug(">>>>>  EX_SRSTATUS | calcBusTime() | varshift: " + varshift);

		/* Get the total minutes from workperiod */
		var totMins = getHours(startDate, endDate, varcal, varshift, varorg);
		myLogger.debug(">>>>>  EX_SRSTATUS | calcBusTime() | totMins: " + totMins);

		/* Get the remaining hours on the start date */
		var wrkHrsStart = getStartHours(startDate, varcal, varshift, varorg);
		if (wrkHrsStart > 0) {
			var startDateMins = calcRem(wrkHrsStart);
		} else {
			var startDateMins = 0;
		}
		myLogger.debug(">>>>>  EX_SRSTATUS | calcBusTime() | startDateMins: " + startDateMins);

		/* Get the remaining hours on the end date */
		var wrkHrsEnd = getEndHours(endDate, varcal, varshift, varorg);
		if (wrkHrsEnd > 0) {
			var endDateMins = calcRem(wrkHrsEnd);
		} else {
			var endDateMins = 0;
		}
		myLogger.debug(">>>>>  EX_SRSTATUS | calcBusTime() | endDateMins: " + endDateMins);

		/* Call The getNonWrkMins method to calculate the non-work hrs */
		var nonWrkMins = getNonWrkMins(startDate, endDate);
		myLogger.debug(">>>>>  EX_SRSTATUS | calcBusTime() | nonWrkMins: " + nonWrkMins);

		/* Subtract the nonwrk hrs from total */
		var finalvalue = (Math.abs(totMins - (startDateMins + endDateMins))) - (nonWrkMins);
		myLogger.debug(">>>>>  EX_SRSTATUS | calcBusTime() | finalvalue: " + finalvalue);

		if (finalvalue < 0) {
			finalvalue = 0;
		}

		return finalvalue;
	}

	myLogger.debug(">>>>>  EX_SRSTATUS | calcBusTime() | End");
	myLogger.debug(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");
}

/* This function gets the total working hours from the workperiod table */

function getHours(startDt, endDt, calName, shift, org) {
	myLogger.debug(">>>>>  EX_SRSTATUS | getHours() | Begin");

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
	myLogger.debug(">>>>>  EX_SRSTATUS | getNonWrkMins() | Begin");

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

	myLogger.debug(">>>>>  EX_SRSTATUS | getStartHours() | Begin");

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

	if (calSet.getMbo(0) != null) {
		var stTime = calSet.getMbo(0).getDate("STARTTIME").getTime();
		var edTime = calSet.getMbo(0).getDate("ENDTIME").getTime();

		if (tempDate.getTime() < stTime) {
			return 0;
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

	myLogger.debug(">>>>>  EX_SRSTATUS | getEndHours() | Begin");

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

	if (calSet.getMbo(0) != null) {
		var stTime = calSet.getMbo(0).getDate("STARTTIME").getTime();
		var edTime = calSet.getMbo(0).getDate("ENDTIME").getTime();

		if (tempDate.getTime() < stTime) {
			return edTime - stTime;
		} else if (tempDate.getTime() > edTime) {
			return 0;
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
	myLogger.debug(">>>>>  EX_SRSTATUS | calcMin() | Begin");

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
	myLogger.debug(">>>>>  EX_SRSTATUS | calcRem() | Begin");
	secondinmillis = 1000;
	minuteinmillis = secondinmillis * 60;
	elapsedminutes = tdiff / minuteinmillis;
	return elapsedminutes;
}


function ISODateString(d) {
	myLogger.debug(">>>>>  EX_SRSTATUS | ISODateString() | Begin");
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


/////// Not current in use, may be removed
function statusTrackingMinutes(statusTracking){
	myLogger.debug(">>>>>  EX_SRSTATUS | statusTrackingMinutes() | Begin");
	myLogger.debug(">>>>>  EX_SRSTATUS | statusTrackingMinutes() | statusTracking:" + statusTracking);

	var arrSplitString = statusTracking.split(":");

	myLogger.debug(">>>>>  EX_SRSTATUS | statusTrackingMinutes() | arrSplitString[0]:" + arrSplitString[0]);
	myLogger.debug(">>>>>  EX_SRSTATUS | statusTrackingMinutes() | arrSplitString[1]:" + arrSplitString[1]);
	myLogger.debug(">>>>>  EX_SRSTATUS | statusTrackingMinutes() | arrSplitString[2]:" + arrSplitString[2]);

	var totalMinutes;

	totalMinutes = parseInt(arrSplitString[0]) * 60;
	totalMinutes = totalMinutes + parseInt(arrSplitString[1]);
	totalMinutes = totalMinutes + (parseInt(arrSplitString[2]) / 60);

	myLogger.debug(">>>>>  EX_SRSTATUS | statusTrackingMinutes() | totalMinutes:" + totalMinutes);

	return Math.round(totalMinutes);
}