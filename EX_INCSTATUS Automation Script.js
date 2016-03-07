//
// Script For populating data in EX_TICKETMETRICS table on Status Change
//

importPackage(Packages.psdi.util);
importClass(java.util.Calendar);
importClass(java.text.SimpleDateFormat);
importClass(java.text.ParseException);
//importClass(java.util.Date);
importPackage(Packages.psdi.util.logging);
importPackage(Packages.psdi.app);
importPackage(Packages.psdi.app.common);
//importPackage(Packages.psdi.util.MXFormat);
importPackage(Packages.psdi.mbo);

var myLogger = MXLoggerFactory.getLogger("maximo.script.autoscript");

var oldStatus = mbo.getMboInitialValue("STATUS");
var newStatus = mbo.getString("STATUS");
var cal = Calendar.getInstance();
var currentDateTime = cal.getTime();


myLogger.debug(">>>>>  EX_INCSTATUS | MAIN | Old Status: " + oldStatus);
myLogger.debug(">>>>>  EX_INCSTATUS | MAIN | New Status: " + newStatus);

if (!(oldStatus.isNull() || oldStatus == undefined)) {
	myLogger.debug(">>>>>  EX_INCSTATUS | MAIN | Old Status is not empty/undefined, record has been saved at least once.");
	//Check for existing metric row
	var EX_TICKETMETRICS = mbo.getMboSet("EX_TICKETMETRICS");
	swhere = "EX_TICKETMETRICSid in (select max (EX_TICKETMETRICSid) from EX_TICKETMETRICS where ticketid = '" + mbo.getMboValue("TICKETID") + "')";
	EX_TICKETMETRICS.setWhere(swhere);
	EX_TICKETMETRICS.reset();

	//If no existing row, create one for new status
	if (EX_TICKETMETRICS.isEmpty() || EX_TICKETMETRICS.count() < 1) {

		myLogger.debug(">>>>>  EX_INCSTATUS | MAIN | no existing row, create one for new status.");

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

		var ownerHistory = mbo.getMboSet("REP_OWNERHIST");
		ownerHistory.setWhere("TKOWNERHISTORYID in (select max(TKOWNERHISTORYID) from TKOWNERHISTORY where ticketid = '" + mbo.getMboValue("TICKETID") + "')");
		ownerHistory.reset();

		var ownDate = ownerHistory.getMbo(0).getDate("OWNDATE");

		newMetric.setValue("OWNDATE", ownDate);

		// if (mbo.getMboValue("STATUS") == "RESOLVED") {

		// 	newMetric.setValue("ACTUALRESOLUTIONDATE", currentDateTime);

		// }

		var actualResolutionTime = calcBusTime(mbo.getDate("REPORTDATE"), currentDateTime);
		newMetric.setValue("ACTUALRESOLUTIONCALCMINS", actualResolutionTime);

		// Don't overwrite ACTUALRESPONSECALCMINS
		var ACTUALRESPONSECALCMINS = newMetric.getMboValue("ACTUALRESPONSECALCMINS");
		if (ACTUALRESPONSECALCMINS.isNull() || ACTUALRESPONSECALCMINS == undefined) {
			newMetric.setValue("ACTUALRESPONSECALCMINS", actualResolutionTime);
		}

	//If existing row, update it with "closure" details
	}else {

		myLogger.debug(">>>>>  EX_INCSTATUS | MAIN | existing row, update it with 'closure' details.");

		var ticketmetric = EX_TICKETMETRICS.getMbo(0);

		var actualResolutionTime = calcBusTime(ticketmetric.getDate("OWNDATE"), cal.getTime());

		// if (mbo.getMboValue("STATUS") == "RESOLVED") {

		// 	ticketmetric.setValue("ACTUALRESOLUTIONDATE", currentDateTime);
		// }

		ticketmetric.setValue("ACTUALRESOLUTIONCALCMINS", actualResolutionTime);

		// Don't overwrite ACTUALRESPONSECALCMINS
		var ACTUALRESPONSECALCMINS = ticketmetric.getMboValue("ACTUALRESPONSECALCMINS");
		if (ACTUALRESPONSECALCMINS.isNull() || ACTUALRESPONSECALCMINS == undefined) {
			ticketmetric.setValue("ACTUALRESPONSECALCMINS", actualResolutionTime);
		}
	}
	
	// In all cases, create new row for new status
	// myLogger.debug(">>>>>  EX_INCSTATUS | MAIN | create new row for new status.");
	// var newMetrics = mbo.getMboSet("EX_TICKETMETRICS");
	// newMetrics.setWhere("1=0");
	// newMetrics.reset();

	//    add a EX_TICKETMETRICS entry to the collection
	myLogger.debug(">>>>>  EX_INCSTATUS | MAIN | Adding row for new status.");
	var newMetric = EX_TICKETMETRICS.add();
	newMetric.setValue("TICKETID", mbo.getMboValue("TICKETID"));
	newMetric.setValue("CLASS", mbo.getMboValue("CLASS"));
	newMetric.setValue("ORGID", mbo.getMboValue("ORGID"));
	newMetric.setValue("SITEID", mbo.getMboValue("SITEID"));
	newMetric.setValue("OWNERGROUP", mbo.getMboValue("OWNERGROUP"));
	newMetric.setValue("OWNER", mbo.getMboValue("OWNER"));
	newMetric.setValue("REPORTDATE", mbo.getDate("REPORTDATE"));
	newMetric.setValue("STATUS", mbo.getMboValue("STATUS"));

	newMetric.setValue("OWNDATE", currentDateTime);

	if (mbo.getMboValue("STATUS") == "RESOLVED") {
		newMetric.setValue("ACTUALRESOLUTIONDATE", currentDateTime);
	}

	if (mbo.getMboValue("STATUS") == "REOPEN") {
		
		myLogger.debug(">>>>>  EX_INCSTATUS | MAIN | REOPEN | Reopening ticket, clearing EX_RESPONDED flag.");
		
		//Clear the SR REsponded to flag so another email will be sent to customer when put back into INPROG
		mbo.setValue("EX_RESPONDED", 0);
	}

	if ((oldStatus == "SLAHOLD") && (newStatus != "SLAHOLD")) {
		mbo.setValue("EX_PENDINGREASON", "");
	}

	// Save ticketmetrics so that everything is committed properly.
	myLogger.debug(">>>>>  EX_INCSTATUS | MAIN | END | Saving.");
	EX_TICKETMETRICS.save();
	myLogger.debug(">>>>>  EX_INCSTATUS | MAIN | END");

}

function calcBusTime(startDate, endDate) {
	//
	//   Script for calculating actual resolution time
	//

	//myLogger.debug(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");
	myLogger.debug(">>>>>  EX_INCSTATUS | calcBusTime() | Begin");

	importPackage(Packages.psdi.app);
	importPackage(Packages.psdi.mbo);
	importPackage(Packages.psdi.server);

	var slaRecordSet = mbo.getMboSet("SLARECORDS");

	if (slaRecordSet.isEmpty() || slaRecordSet.count() < 1) {
		myLogger.warn(">>>>>  EX_INCSTATUS | calcBusTime() | No SLA is applied, not calculating EX_TICKETMETRICS resolution details!");
	} else {
		myLogger.debug(">>>>>  EX_INCSTATUS | calcBusTime() | SLA Set Count: " + slaRecordSet.count());

		var slaRecordMbo = slaRecordSet.getMbo(0);

		// myLogger.debug(">>>>>  EX_INCSTATUS | calcBusTime() | slaRecordMbo.getMboValue(SLANUM): " + slaRecordMbo.getMboValue("SLANUM"));
		// myLogger.debug(">>>>>  EX_INCSTATUS | calcBusTime() | slaRecordMbo.getMboValue(CALCORGID): " + slaRecordMbo.getMboValue("CALCORGID"));
		// myLogger.debug(">>>>>  EX_INCSTATUS | calcBusTime() | slaRecordMbo.getMboValue(CALCCALENDAR): " + slaRecordMbo.getMboValue("CALCCALENDAR"));
		// myLogger.debug(">>>>>  EX_INCSTATUS | calcBusTime() | slaRecordMbo.getMboValue(CALCSHIFT): " + slaRecordMbo.getMboValue("CALCSHIFT"));

		/* Fetch all the required variables to pass to the function to calculate the Total working hours.*/

		var varorg = slaRecordMbo.getMboValue("CALCORGID"); // ENMAX
		var varcal = slaRecordMbo.getMboValue("CALCCALENDAR"); // DAY
		var varshift = slaRecordMbo.getMboValue("CALCSHIFT"); // DAY

		/* Get the total minutes from workperiod */
		var totMins = getHours(startDate, endDate, varcal, varshift, varorg);
		// myLogger.debug(">>>>>  EX_INCSTATUS | calcBusTime() | totMins: " + totMins);

		/* Get the remaining hours on the start date */
		var wrkHrsStart = getStartHours(startDate, varcal, varshift, varorg);
		// myLogger.debug(">>>>>  EX_INCSTATUS | calcBusTime() | wrkHrsStart: " + wrkHrsStart);
		if (wrkHrsStart > 0) {
			var startDateMins = calcRem(wrkHrsStart);
		} else {
			var startDateMins = 0;
		}

		/* Get the remaining hours on the end date */
		var wrkHrsEnd = getEndHours(endDate, varcal, varshift, varorg);
		// myLogger.debug(">>>>>  EX_INCSTATUS | calcBusTime() | wrkHrsEnd: " + wrkHrsEnd);

		if (wrkHrsEnd > 0) {
			var endDateMins = calcRem(wrkHrsEnd);
		} else {
			var endDateMins = 0;
		}

		/* Call The getNonWrkMins method to calculate the non-work hrs */
		var nonWrkMins = getNonWrkMins(startDate, endDate);
		// myLogger.debug(">>>>>  EX_INCSTATUS | calcBusTime() | nonWrkMins: " + nonWrkMins);

		/* Subtract the nonwrk hrs from total */
		var finalvalue = (Math.abs(totMins - (startDateMins + endDateMins))) - (nonWrkMins);
		myLogger.debug(">>>>>  EX_INCSTATUS | calcBusTime() | finalvalue: " + finalvalue);

		if (finalvalue < 0) {
			finalvalue = 0;
		}

		return finalvalue;
	}

	myLogger.debug(">>>>>  EX_INCSTATUS | calcBusTime() | End");
	myLogger.debug(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");
}

/* This function gets the total working hours from the workperiod table */

function getHours(startDt, endDt, calName, shift, org) {
	//myLogger.debug(">>>>>  EX_INCSTATUS | getHours() | Begin");

	//myLogger.debug(">>>>>  EX_INCSTATUS | getHours() | startDt: " + startDt);
	//myLogger.debug(">>>>>  EX_INCSTATUS | getHours() | endDt: " + endDt);
	//myLogger.debug(">>>>>  EX_INCSTATUS | getHours() | calName: " + calName);
	//myLogger.debug(">>>>>  EX_INCSTATUS | getHours() | shift: " + shift);
	//myLogger.debug(">>>>>  EX_INCSTATUS | getHours() | org: " + org);

	startDt = DateUtility.getDate(startDt);
	endDt = DateUtility.getDate(endDt);

	//  var swhere = "calnum = '"+calName+"' and orgid = '"+org+"' and shiftnum ='"+shift+"' and workdate between to_date(substr('" + startDt.toLocaleString() +"' ,0,12),'mm-dd-yyyy hh:mi:ss am') and to_date(substr('"+endDt.toLocaleString() +"',0,12) ,'mm-dd-yyyy hh:mi:ss am')";

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
	//myLogger.debug(">>>>>  EX_INCSTATUS | getNonWrkMins() | Begin");

	//var swhereNon = "startdate between to_date(substr('" + startDt.toLocaleString() +"' ,0,12),'mm-dd-yyyy hh:mi:ss am') and to_date(substr('"+endDt.toLocaleString() +"',0,12) ,'mm-dd-yyyy hh:mi:ss am')";
	//var nonWrkSet = mbo.getMboSet("$nonworktime", "NONWORKTIME",swhereNon);

	startDt = DateUtility.getDate(startDt);
	endDt = DateUtility.getDate(endDt);
	//  var swhere = "calnum = '"+calName+"' and orgid = '"+org+"' and shiftnum ='"+shift+"' and workdate between to_date(substr('" + startDt.toLocaleString() +"' ,0,12),'mm-dd-yyyy hh:mi:ss am') and to_date(substr('"+endDt.toLocaleString() +"',0,12) ,'mm-dd-yyyy hh:mi:ss am')";

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

	//myLogger.debug(">>>>>  EX_INCSTATUS | getStartHours() | Begin");

	//var swhere = "calnum = '"+calName+"' and orgid = '"+org+"' and shiftnum ='"+shift+"' and workdate =  to_date(substr('" + workDate.toLocaleString() +"' ,0,12),'mm-dd-yyyy hh:mi:ss am') ";
	//var calSet = mbo.getMboSet("$workperiod", "WORKPERIOD",swhere);
	workDateCopy = DateUtility.getDate(workDate);
	var workDate2 = new Date(workDateCopy);
	workDate2 = ISODateString(workDate2);

	var sqf = new SqlFormat(mbo, "calnum = :1 and orgid = :2 and shiftnum = :3 and workdate = :4");
	sqf.setObject(1, "WORKPERIOD", "CALNUM", calName);
	sqf.setObject(2, "WORKPERIOD", "ORGID", org);
	sqf.setObject(3, "WORKPERIOD", "SHIFTNUM", shift);
	sqf.setObject(4, "WORKPERIOD", "WORKDATE", workDate2);
	var calSet = mbo.getMboSet("$workperiod", "WORKPERIOD", sqf.format());

	//workDate = workDate;
	//workDate = workDate.getDate();
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

	//myLogger.debug(">>>>>  EX_INCSTATUS | getEndHours() | Begin");

	//var swhere = "calnum = '"+calName+"' and orgid = '"+org+"' and shiftnum ='"+shift+"' and workdate =  to_date(substr('" + workDate.toLocaleString() +"' ,0,12),'mm-dd-yyyy hh:mi:ss am') ";
	workDateCopy = DateUtility.getDate(workDate);
	var workDate2 = new Date(workDateCopy);
	workDate2 = ISODateString(workDate2);

	var sqf = new SqlFormat(mbo, "calnum = :1 and orgid = :2 and shiftnum = :3 and workdate = :4");
	sqf.setObject(1, "WORKPERIOD", "CALNUM", calName);
	sqf.setObject(2, "WORKPERIOD", "ORGID", org);
	sqf.setObject(3, "WORKPERIOD", "SHIFTNUM", shift);
	sqf.setObject(4, "WORKPERIOD", "WORKDATE", workDate2);
	var calSet = mbo.getMboSet("$workperiod", "WORKPERIOD", sqf.format());

	//workDate = workDate;
	//workDate = workDate.getDate();
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
	//myLogger.debug(">>>>>  EX_INCSTATUS | calcRem() | Begin");
	secondinmillis = 1000;
	minuteinmillis = secondinmillis * 60;
	elapsedminutes = tdiff / minuteinmillis;
	return elapsedminutes;
}


function ISODateString(d) {
	//myLogger.debug(">>>>>  EX_INCSTATUS | ISODateString() | Begin");
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
	myLogger.debug(">>>>>  EX_INCSTATUS | statusTrackingMinutes() | Begin");
	myLogger.debug(">>>>>  EX_INCSTATUS | statusTrackingMinutes() | statusTracking:" + statusTracking);

	var arrSplitString = statusTracking.split(":");

	myLogger.debug(">>>>>  EX_INCSTATUS | statusTrackingMinutes() | arrSplitString[0]:" + arrSplitString[0]);
	myLogger.debug(">>>>>  EX_INCSTATUS | statusTrackingMinutes() | arrSplitString[1]:" + arrSplitString[1]);
	myLogger.debug(">>>>>  EX_INCSTATUS | statusTrackingMinutes() | arrSplitString[2]:" + arrSplitString[2]);

	var totalMinutes;

	totalMinutes = parseInt(arrSplitString[0]) * 60;
	totalMinutes = totalMinutes + parseInt(arrSplitString[1]);
	totalMinutes = totalMinutes + (parseInt(arrSplitString[2]) / 60);

	myLogger.debug(">>>>>  EX_INCSTATUS | statusTrackingMinutes() | totalMinutes:" + totalMinutes);

	return Math.round(totalMinutes);
}