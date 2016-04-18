//
// Action Script to populate the ActualResponseDate field on the TICKETMETRICS table
// To be used from Workflow when user indicates a response to be sent to Client
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

myLogger.debug(">>>>>  EX_INCRESPDATE | MAIN | EX_INCRESPDATE running on ticket: " + mbo.getMboValue("TICKETID"));


var slaRecordSet = mbo.getMboSet("SLARECORDS");

if (slaRecordSet.isEmpty() || slaRecordSet.count() < 1) {
	myLogger.warn(">>>>>  EX_INCRESPDATE | MAIN | No SLA is applied, not calculating EX_TICKETMETRICS resolution details!");
} else {
	if (mbo.getMboValue("EX_RESPONDED") == "N") {

		var ticketmetrics = mbo.getMboSet("EX_TICKETMETRICS");
		ticketmetrics.setWhere("ex_ticketmetricsid in (select max (ex_ticketmetricsid) from ex_ticketmetrics where ticketid = '" + mbo.getMboValue("TICKETID") + "')");
		ticketmetrics.reset();

		if (ticketmetrics.isEmpty() || ticketmetrics.count() < 1) {
			myLogger.debug(">>>>>  EX_INCRESPDATE | Adding ticketmetrics record");
			//    get an empty ticketmetrics collection
			var newMetrics = mbo.getMboSet("EX_TICKETMETRICS");
			newMetrics.setWhere("1=0");
			newMetrics.reset();

			//    add a ticketmetrics entry to the collection
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
			var currentDateTime = cal.getTime();
			
			//Set the actual response date
			newMetric.setValue("ACTUALRESPONSEDATE", currentDateTime);
			
			// Set response business minutes
			var actualResponseTime = calcBusTime(ownDate, currentDateTime);
			newMetric.setValue("ACTUALRESPONSECALCMINS", actualResponseTime);
			
		} else {
			myLogger.debug(">>>>>  EX_INCRESPDATE | Ticket has already been responded to?: " + mbo.getMboValue("EX_RESPONDED"));
				
			myLogger.debug(">>>>>  EX_INCRESPDATE | Adding response details to existing ticketmetric");
			
			var cal = Calendar.getInstance();
			var ticketmetric = ticketmetrics.getMbo(0);
			var currentDateTime = cal.getTime();
			
			//Set the actual response date, business minutes, and Responded to flag
			ticketmetric.setValue("ACTUALRESPONSEDATE", currentDateTime);
			
			var actualResponseTime = calcBusTime(ticketmetric.getDate("OWNDATE"), currentDateTime);
			ticketmetric.setValue("ACTUALRESPONSECALCMINS", actualResponseTime);
			
			mbo.setValue("EX_RESPONDED", 1);
			
			/*//Send Response Communication
			// Determine appropriate comm template depending on ticket's current owner group
			switch(mbo.getString("OWNERGROUP").substring(0, 3)) {
				case "TCS":
					var whereclause = "TEMPLATEID ='EX_TCSINRESPONSE'";
					break;
				case "HR-":
					var whereclause = "TEMPLATEID ='EX_HRINRESPONSE'";
					break;
				default:
					var whereclause = "TEMPLATEID ='EX_ITINRESPONSE'";
			}
			
			myLogger.debug(">>>>>  EX_INCSTATUS | MAIN | Ownergroup Substr: " + mbo.getString("OWNERGROUP").substring(0, 3));
			myLogger.debug(">>>>>  EX_INCSTATUS | MAIN | Comm Template: " + whereclause);
			
			myLogger.debug(">>>>>  EX_INCSTATUS | MAIN | Preparing to send Communication");
			
			
			// Get appropriate comm template
			var ctMboSet = mbo.getMboSet("$commtemp","COMMTEMPLATE",whereclause);
			ctMboSet.setQbeExactMatch("true");
			ctMboSet.reset();

			// Send Communication
			if(!ctMboSet.isEmpty()){
				var ctMbo = ctMboSet.getMbo(0);
				myLogger.debug(">>>>>  EX_INCSTATUS | MAIN | Sending Communication");
				ctMbo.sendMessage(mbo,mbo);
				myLogger.debug(">>>>>  EX_INCSTATUS | MAIN | Communication Sent");
			}*/

		}
	}
}

//  Set Responded to flag
mbo.setValue("EX_RESPONDED", 1);


// Calculate a target Date and Time based on SLA
function calcTargetDateTime(){



}

function calcBusTime(startDate, endDate) {
	//
	//   Script for calculating actual resolution time
	//

	//myLogger.debug(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");
	myLogger.debug(">>>>>  EX_INCRESPDATE | calcBusTime() | Begin");

	importPackage(Packages.psdi.app);
	importPackage(Packages.psdi.mbo);
	importPackage(Packages.psdi.server);

	var slaRecordSet = mbo.getMboSet("SLARECORDS");
	
	if (slaRecordSet.isEmpty() || slaRecordSet.count() < 1) {
		myLogger.warn(">>>>>  EX_INCRESPDATE | calcBusTime() | No SLA is applied, not calculating TicketMetrics resolution details!");
	} else {
		myLogger.debug(">>>>>  EX_INCRESPDATE | calcBusTime() | SLA Set Count: " + slaRecordSet.count());

		var slaRecordMbo = slaRecordSet.getMbo(0);

		myLogger.debug(">>>>>  EX_INCRESPDATE | calcBusTime() | slaRecordMbo.getMboValue(SLANUM): " + slaRecordMbo.getMboValue("SLANUM"));
		myLogger.debug(">>>>>  EX_INCRESPDATE | calcBusTime() | slaRecordMbo.getMboValue(CALCORGID): " + slaRecordMbo.getMboValue("CALCORGID"));
		myLogger.debug(">>>>>  EX_INCRESPDATE | calcBusTime() | slaRecordMbo.getMboValue(CALCCALENDAR): " + slaRecordMbo.getMboValue("CALCCALENDAR"));
		myLogger.debug(">>>>>  EX_INCRESPDATE | calcBusTime() | slaRecordMbo.getMboValue(CALCSHIFT): " + slaRecordMbo.getMboValue("CALCSHIFT"));

		/* Fetch all the required variables to pass to the function to calculate the Total working hours. */

		var varorg = slaRecordMbo.getMboValue("CALCORGID"); // ENMAX
		var varcal = slaRecordMbo.getMboValue("CALCCALENDAR"); // DAY
		var varshift = slaRecordMbo.getMboValue("CALCSHIFT"); // DAY

		/* Get the total minutes from workperiod */
		var totMins = getHours(startDate, endDate, varcal, varshift, varorg);
		myLogger.debug(">>>>>  EX_INCRESPDATE | calcBusTime() | totMins: " + totMins);

		/* Get the remaining hours on the start and end dates */
		var wrkHrsStart = getStartHours(startDate, varcal, varshift, varorg);
		myLogger.debug(">>>>>  EX_INCRESPDATE | calcBusTime() | wrkHrsStart: " + wrkHrsStart);
		if (wrkHrsStart > 0) {
			var startDateMins = calcRem(wrkHrsStart);
		} else {
			var startDateMins = 0;
		}

		var wrkHrsEnd = getEndHours(endDate, varcal, varshift, varorg);
		myLogger.debug(">>>>>  EX_INCRESPDATE | calcBusTime() | wrkHrsEnd: " + wrkHrsEnd);

		if (wrkHrsEnd > 0) {
			var endDateMins = calcRem(wrkHrsEnd);
		} else {
			var endDateMins = 0;
		}

		/* Call The getNonWrkMins method to calculate the non-work hrs */
		var nonWrkMins = getNonWrkMins(startDate, endDate);
		myLogger.debug(">>>>>  EX_INCRESPDATE | calcBusTime() | nonWrkMins: " + nonWrkMins);

		/* Subtract the nonwrk hrs from total */
		var finalvalue = (Math.abs(totMins - (startDateMins + endDateMins))) - (nonWrkMins);
		myLogger.debug(">>>>>  EX_INCRESPDATE | calcBusTime() | finalvalue: " + finalvalue);

		if (finalvalue < 0) {
			finalvalue = 0;
		}

		return finalvalue;
	}

	myLogger.debug(">>>>>  EX_INCRESPDATE | calcBusTime() | End");
	myLogger.debug(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");
}

/* This function gets the total working hours from the workperiod table */

function getHours(startDt, endDt, calName, shift, org) {
	//myLogger.debug(">>>>>  EX_INCRESPDATE | getHours() | Begin");

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
	//myLogger.debug(">>>>>  EX_INCRESPDATE | getNonWrkMins() | Begin");

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

	//myLogger.debug(">>>>>  EX_INCRESPDATE | getStartHours() | Begin");

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

	//myLogger.debug(">>>>>  EX_INCRESPDATE | getEndHours() | Begin");

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
	//myLogger.debug(">>>>>  EX_INCRESPDATE | calcRem() | Begin");
	secondinmillis = 1000;
	minuteinmillis = secondinmillis * 60;
	elapsedminutes = tdiff / minuteinmillis;
	return elapsedminutes;
}

function ISODateString(d) {
	//myLogger.debug(">>>>>  EX_INCRESPDATE | ISODateString() | Begin");
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
