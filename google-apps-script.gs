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
    } else if (action === 'verifyStudent') {
      return verifyStudent(data);
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

/**
 * Config 저장.
 * data 가 배열이면 기존 동작(전체 교체).
 * data 가 { mode:'replaceGrade', grade:N, rows:[...] } 이면 해당 학년만 교체.
 */
function saveConfig(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Config');

  // 학년별 부분 교체 모드
  if (data && !Array.isArray(data) && data.mode === 'replaceGrade') {
    const targetGrade = Number(data.grade);
    const incoming = Array.isArray(data.rows) ? data.rows : [];
    if (!targetGrade) {
      return createJSONOutput({ status: 'error', message: '학년이 지정되지 않았습니다.' });
    }

    // 기존 데이터 읽기
    const existingValues = sheet.getLastRow() > 0 ? sheet.getDataRange().getValues() : [];
    const existingHeaders = existingValues.length > 0 ? existingValues[0].map(h => String(h || '').trim()) : [];
    const existingRows = existingValues.length > 1 ? existingValues.slice(1) : [];
    const gradeIdx = existingHeaders.indexOf('학년') !== -1 ? existingHeaders.indexOf('학년') : existingHeaders.indexOf('grade');

    // 다른 학년 행은 보존
    const keptObjs = [];
    if (gradeIdx !== -1) {
      existingRows.forEach(row => {
        const g = Number(row[gradeIdx]);
        if (g !== targetGrade) {
          const obj = {};
          existingHeaders.forEach((h, i) => { if (h) obj[h] = row[i]; });
          keptObjs.push(obj);
        }
      });
    }

    const merged = keptObjs.concat(incoming);
    sheet.clear();
    if (merged.length === 0) return createJSONOutput({ status: 'success', count: 0 });

    // 헤더 재구성: 기존 + 새 데이터의 모든 키 합집합 (학년 컬럼은 반드시 포함)
    const headerSet = new Set();
    merged.forEach(obj => Object.keys(obj || {}).forEach(k => headerSet.add(k)));
    if (!headerSet.has('학년')) headerSet.add('학년');
    const headers = [...headerSet];
    sheet.appendRow(headers);
    const out = merged.map(obj => headers.map(h => obj[h] !== undefined ? obj[h] : ''));
    sheet.getRange(2, 1, out.length, headers.length).setValues(out);
    return createJSONOutput({ status: 'success', count: incoming.length, totalRows: merged.length });
  }

  // 전체 교체 (기존 동작)
  sheet.clear();

  if (!data || (Array.isArray(data) && data.length === 0)) return createJSONOutput({ status: 'success' });

  const arr = Array.isArray(data) ? data : [];
  if (arr.length === 0) return createJSONOutput({ status: 'success' });

  const headers = Object.keys(arr[0]);
  sheet.appendRow(headers);

  const rows = arr.map(obj => headers.map(header => obj[header]));
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
    const headers = ['Timestamp', 'Grade', 'Class', 'Number', 'Major', 'SelectedCourses', 'JointCourses', 'TotalCredits', 'ValidationResult', 'AiRecommendation'];
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

  const idAliases = ['학번', 'studentId', 'student_id', 'StudentId', 'ID', 'id'];
  const codeAliases = ['학생코드', 'StudentCode', 'studentCode', 'student_code'];

  const rawHeaders = data[0].map(h => String(h == null ? '' : h).trim());
  const findIdx = aliases => {
    for (let i = 0; i < rawHeaders.length; i++) {
      if (aliases.indexOf(rawHeaders[i]) !== -1) return i;
    }
    return -1;
  };
  const idIdx = findIdx(idAliases);
  const codeIdx = findIdx(codeAliases);

  const rows = data.slice(1);
  const result = rows.map(row => {
    const obj = {};
    rawHeaders.forEach((header, index) => {
      if (header) obj[header] = row[index];
    });
    if (idIdx !== -1) obj['학번'] = row[idIdx];
    if (codeIdx !== -1) obj['학생코드'] = row[codeIdx];
    return obj;
  }).filter(r => String(r['학번'] || '').trim() !== '');

  return createJSONOutput(result);
}

function normalizeStudentCode_(s) {
  if (s == null || s === '') return '';
  return String(s).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function normalizeStudentId_(s) {
  if (s == null || s === '') return '';
  return String(s).trim().replace(/\s/g, '');
}

function normalizeName_(s) {
  if (s == null) return '';
  return String(s).trim().replace(/\s+/g, ' ');
}

function generateStudentCode_() {
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  var code = '';
  for (var i = 0; i < 10; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * 학생 페이지 로그인: 학생코드(10자리) + 학번 (이름 제거 — 개인정보 보호)
 */
function verifyStudent(data) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Registry');
  if (!sheet || sheet.getLastRow() <= 1) {
    return createJSONOutput({ status: 'error', message: '등록된 학적이 없습니다.' });
  }
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var hi = {};
  for (var c = 0; c < headers.length; c++) {
    hi[headers[c]] = c;
  }
  var codeCol = hi['학생코드'] !== undefined ? '학생코드' : (hi['StudentCode'] !== undefined ? 'StudentCode' : null);
  if (!codeCol) {
    return createJSONOutput({ status: 'error', message: '학적에 학생코드 열이 없습니다. 관리자에서 학적을 다시 등록해주세요.' });
  }
  var wantCode = normalizeStudentCode_(data.studentCode || data.student_code);
  if (wantCode.length < 6) {
    return createJSONOutput({ status: 'error', message: '학생 코드는 6자리 이상 영문·숫자입니다.' });
  }
  var wantId = normalizeStudentId_(data.studentId || data.student_id || data.학번);
  if (wantId.length !== 5) {
    return createJSONOutput({ status: 'error', message: '학번 5자리를 입력해주세요.' });
  }
  var rows = sheet.getDataRange().getValues();
  for (var r = 1; r < rows.length; r++) {
    var row = rows[r];
    var rowObj = {};
    for (var j = 0; j < headers.length; j++) {
      rowObj[headers[j]] = row[j];
    }
    var rowCode = normalizeStudentCode_(rowObj[codeCol]);
    var rowId = normalizeStudentId_(rowObj['학번']);
    if (rowCode === wantCode && rowId === wantId) {
      return createJSONOutput({ status: 'success', student: { 학번: wantId } });
    }
  }
  return createJSONOutput({ status: 'error', message: '학생 코드 또는 학번이 일치하지 않습니다.' });
}

function pickRegistryField_(obj, keys) {
  for (var i = 0; i < keys.length; i++) {
    var v = obj[keys[i]];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return '';
}

function saveRegistry(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Registry');

  if (!data || data.length === 0) {
    sheet.clear();
    return createJSONOutput({ status: 'success' });
  }

  var oldMap = {};
  if (sheet.getLastRow() > 1) {
    var vals = sheet.getDataRange().getValues();
    var hdr = vals[0];
    var hidx = {};
    for (var i = 0; i < hdr.length; i++) hidx[String(hdr[i]).trim()] = i;
    var idIdx = hidx['학번'];
    var codeIdx = hidx['학생코드'] !== undefined ? hidx['학생코드'] : hidx['StudentCode'];
    if (idIdx !== undefined && codeIdx !== undefined) {
      for (var rr = 1; rr < vals.length; rr++) {
        var row = vals[rr];
        var oid = normalizeStudentId_(row[idIdx]);
        var ocode = normalizeStudentCode_(row[codeIdx]);
        if (oid && ocode.length === 10) {
          oldMap[oid] = ocode;
        }
      }
    }
  }

  var idKeys = ['학번', 'studentId', 'student_id', 'StudentId', 'ID', 'id'];
  var codeKeys = ['학생코드', 'StudentCode', 'studentCode', 'student_code', 'code'];

  var usedInUpload = {};
  var processed = [];
  for (var k = 0; k < data.length; k++) {
    var obj = data[k] || {};
    var sid = normalizeStudentId_(pickRegistryField_(obj, idKeys));
    if (!sid) continue;
    var manual = normalizeStudentCode_(pickRegistryField_(obj, codeKeys));
    var code = '';
    if (manual.length === 10) {
      code = manual;
    } else if (oldMap[sid]) {
      code = oldMap[sid];
    }
    while (!code || code.length !== 10 || usedInUpload[code]) {
      code = generateStudentCode_();
    }
    usedInUpload[code] = true;
    processed.push([sid, code]);
  }

  var headers = ['학번', '학생코드'];
  sheet.clear();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (processed.length > 0) {
    sheet.getRange(2, 1, processed.length, headers.length).setValues(processed);
  }

  return createJSONOutput({ status: 'success', count: processed.length });
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
  if (rows.length > 0) sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  return createJSONOutput({ status: 'success' });
}

function createJSONOutput(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
