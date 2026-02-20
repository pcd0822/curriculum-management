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
  if (!ss.getSheetByName('Settings')) ss.insertSheet('Settings');
  if (!ss.getSheetByName('Responses')) ss.insertSheet('Responses');
  if (!ss.getSheetByName('Registry')) ss.insertSheet('Registry');
  if (!ss.getSheetByName('JointCurriculum')) ss.insertSheet('JointCurriculum');
  if (ss.getSheetByName('Sheet1')) ss.deleteSheet(ss.getSheetByName('Sheet1'));
}

function doGet(e) {
  const action = e.parameter.action;
  
  if (action === 'getConfig') {
    return getConfig();
  } else if (action === 'getJointCurriculum') {
    return getJointCurriculum();
  } else if (action === 'getResponses') {
    return getResponses();
  } else if (action === 'getSettings') {
    return getSettings();
  } else if (action === 'getRegistry') {
    return getRegistry();
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
    } else if (action === 'saveJointCurriculum') {
      return saveJointCurriculum(data);
    } else if (action === 'submitResponse') {
      return submitResponse(data);
    } else if (action === 'saveSettings') {
      return saveSettings(data);
    } else if (action === 'saveRegistry') {
      return saveRegistry(data);
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
    const headers = ['Timestamp', 'Grade', 'Class', 'Number', 'Name', 'Major', 'SelectedCourses', 'JointCourses', 'TotalCredits', 'ValidationResult', 'AiRecommendation'];
    sheet.appendRow(headers);
  } else {
    // Check if new headers exist, if not add them
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const missingHeaders = [];
    if (!headers.includes('ValidationResult')) missingHeaders.push('ValidationResult');
    if (!headers.includes('AiRecommendation')) missingHeaders.push('AiRecommendation');
    
    if (missingHeaders.length > 0) {
      // Append missing headers
      sheet.getRange(1, headers.length + 1, 1, missingHeaders.length).setValues([missingHeaders]);
    }
  }
  
  // Re-fetch headers to ensure correct mapping
  const currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = [];
  
  // Construct row based on headers
  currentHeaders.forEach(header => {
    if (header === 'Timestamp') row.push(new Date());
    else if (header === 'Grade') row.push(data.Grade || data.grade);
    else if (header === 'Class') row.push(data.Class || data.classNum);
    else if (header === 'Number') row.push(data.Number || data.studentNum);
    else if (header === 'Name') row.push(data.Name || data.name);
    else if (header === 'Major') row.push(data.Major || data.major);
    else if (header === 'SelectedCourses') row.push(data.SelectedCourses || data.selectedCourses);
    else if (header === 'JointCourses') row.push(Array.isArray(data.JointCourses || data.jointCourses) ? (data.JointCourses || data.jointCourses).map(c => c.subjectName).join(', ') : (data.JointCourses || data.jointCourses || ''));
    else if (header === 'TotalCredits') row.push(data.TotalCredits || data.totalCredits);
    else if (header === 'ValidationResult') row.push(data.ValidationResult || data.validationResult || '');
    else if (header === 'AiRecommendation') row.push(data.AiRecommendation || data.aiRecommendation || '');
    else row.push(''); // Unknown header placeholder
  });
  
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

function getSettings() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Settings');
  
  if (sheet.getLastRow() === 0) return createJSONOutput({}); // Empty settings
  
  const data = sheet.getDataRange().getValues();
  // Assume settings are stored as Key-Value pairs in columns A and B
  // Or as a single JSON string in A1? Let's use Key-Value for simplicity or JSON for flexibility.
  // Let's use a simple JSON structure stored in cell A1 for maximum flexibility with complex objects.
  
  const settingsJson = sheet.getRange(1, 1).getValue();
  if (!settingsJson) return createJSONOutput({});
  
  try {
    return createJSONOutput(JSON.parse(settingsJson));
  } catch (e) {
    return createJSONOutput({});
  }
}

function saveSettings(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Settings');
  sheet.clear();
  
  // Save as JSON string in A1
  sheet.getRange(1, 1).setValue(JSON.stringify(data));
  
  return createJSONOutput({ status: 'success' });
}

function getRegistry() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Registry');
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

function saveRegistry(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Registry');
  sheet.clear();
  
  if (!data || data.length === 0) return createJSONOutput({ status: 'success' });
  
  const headers = Object.keys(data[0]);
  sheet.appendRow(headers);
  
  const rows = data.map(obj => headers.map(header => obj[header]));
  
  // Batch write
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
  
  return createJSONOutput({ status: 'success' });
}

function getJointCurriculum() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('JointCurriculum');
  if (!sheet || sheet.getLastRow() <= 1) return createJSONOutput([]);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1);
  const result = rows.map(row => {
    const obj = {};
    headers.forEach((header, index) => { obj[header] = row[index]; });
    return obj;
  });
  return createJSONOutput(result);
}

function saveJointCurriculum(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('JointCurriculum');
  if (!sheet) sheet = ss.insertSheet('JointCurriculum');
  sheet.clear();
  if (!data || data.length === 0) return createJSONOutput({ status: 'success' });
  const headers = Object.keys(data[0]);
  sheet.appendRow(headers);
  const rows = data.map(obj => headers.map(h => obj[h]));
  if (rows.length > 0) sheet.getRange(2, 1, rows.length + 1, headers.length).setValues(rows);
  return createJSONOutput({ status: 'success' });
}

function createJSONOutput(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
