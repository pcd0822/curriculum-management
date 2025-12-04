/**
 * Google Apps Script for Curriculum Planner Backend
 * 
 * Instructions:
 * 1. Create a new Google Sheet.
 * 2. Go to Extensions > Apps Script.
 * 3. Paste this code into Code.gs.
 * 4. Run the 'setup' function once to create necessary sheets.
 * 5. Deploy as Web App:
 *    - Click 'Deploy' > 'New deployment'.
 *    - Select type 'Web app'.
 *    - Execute as: 'Me'.
 *    - Who has access: 'Anyone'.
 *    - Click 'Deploy' and copy the Web App URL.
 */

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName('Config')) ss.insertSheet('Config');
  if (!ss.getSheetByName('Responses')) ss.insertSheet('Responses');
  if (ss.getSheetByName('Sheet1')) ss.deleteSheet(ss.getSheetByName('Sheet1'));
}

function doGet(e) {
  const action = e.parameter.action;
  
  if (action === 'getConfig') {
    return getConfig();
  } else if (action === 'getResponses') {
    return getResponses();
  }
  
  return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Invalid action' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const request = JSON.parse(e.postData.contents);
    const action = request.action;
    const data = request.data;
    
    if (action === 'saveConfig') {
      return saveConfig(data);
    } else if (action === 'submitResponse') {
      return submitResponse(data);
    }
    
    return createJSONOutput({ status: 'error', message: 'Invalid action' });
  } catch (error) {
    return createJSONOutput({ status: 'error', message: error.toString() });
  }
}

function getConfig() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Config');
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) return createJSONOutput([]);
  
  const headers = data[0];
  const rows = data.slice(1);
  const result = rows.map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index];
    });
    return obj;
  });
  
  return createJSONOutput(result);
}

function saveConfig(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Config');
  sheet.clear();
  
  if (!data || data.length === 0) return createJSONOutput({ status: 'success' });
  
  const headers = Object.keys(data[0]);
  sheet.appendRow(headers);
  
  const rows = data.map(obj => headers.map(header => obj[header]));
  // Batch write for performance
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
  
  return createJSONOutput({ status: 'success' });
}

function submitResponse(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Responses');
  
  // If sheet is empty, add headers
  if (sheet.getLastRow() === 0) {
    const headers = ['Timestamp', 'Grade', 'Class', 'Number', 'Name', 'Major', 'SelectedCourses', 'JointCourses', 'TotalCredits'];
    sheet.appendRow(headers);
  }
  
  const row = [
    new Date(),
    data.grade,
    data.classNumber,
    data.studentNumber,
    data.studentName,
    data.major,
    data.selectedSchoolCourses,
    data.selectedJointCourses,
    data.totalCredits
  ];
  
  sheet.appendRow(row);
  return createJSONOutput({ status: 'success' });
}

function getResponses() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Responses');
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) return createJSONOutput([]);
  
  const headers = data[0];
  const rows = data.slice(1);
  const result = rows.map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index];
    });
    return obj;
  });
  
  return createJSONOutput(result);
}

function createJSONOutput(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
