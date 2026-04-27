/**
 * Curriculum Planner — Router GAS
 *
 * 별도의 Google Sheet에 이 스크립트를 붙여 넣고 Web App으로 배포하세요.
 * 사이트 운영자(전체 관리자)가 1회만 셋업합니다.
 *
 * 1. 새 Google Sheet 생성 (예: "Curriculum Router")
 * 2. Extensions > Apps Script > 이 코드 붙여넣기
 * 3. setupRouter() 함수 1회 실행 → Mappings 시트 생성됨
 * 4. Deploy > New deployment > Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. 발급된 URL을 Netlify 환경변수 VITE_GAS_ROUTER_URL에 등록
 *
 * 매핑 구조:
 *   email      — Google 로그인한 관리자 이메일 (소문자 정규화)
 *   apiUrl     — 그 관리자가 사용하는 학교 GAS Web App URL
 *   schoolName — (선택) 학교 이름
 *   updatedAt  — 마지막 갱신 시각
 *
 * 보안:
 *   - getMapping은 이메일만으로 조회 가능 (apiUrl 자체는 본질적으로 노출 가능 — 시트 데이터 보호는
 *     각 학교 GAS의 doGet/doPost에서 별도로 해야 함)
 *   - setMapping은 클라이언트가 보낸 Google ID 토큰을 https://oauth2.googleapis.com/tokeninfo
 *     로 검증하여 토큰의 email로만 매핑을 작성/갱신함 → 다른 사람의 매핑을 임의로 덮어쓸 수 없음
 *   - audience(aud)도 검증해야 안전 (스크립트 속성 EXPECTED_AUDIENCE 에 Client ID 등록 권장)
 */

function setupRouter() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName('Mappings')) ss.insertSheet('Mappings');
  var sh = ss.getSheetByName('Mappings');
  if (sh.getLastRow() === 0) {
    sh.appendRow(['email', 'apiUrl', 'schoolName', 'updatedAt']);
  }
  if (ss.getSheetByName('Sheet1')) ss.deleteSheet(ss.getSheetByName('Sheet1'));
}

function doGet(e) {
  var action = e.parameter.action;
  if (action === 'getMapping') {
    return getMapping(e.parameter.email || '');
  }
  return jsonOut({ status: 'error', message: 'Invalid action' });
}

function doPost(e) {
  try {
    var req = JSON.parse(e.postData.contents);
    if (req.action === 'setMapping') {
      return setMapping(req);
    }
    if (req.action === 'deleteMapping') {
      return deleteMapping(req);
    }
    return jsonOut({ status: 'error', message: 'Invalid action' });
  } catch (err) {
    return jsonOut({ status: 'error', message: String(err) });
  }
}

/* ─── 매핑 조회 ─── */
function getMapping(email) {
  var em = normEmail_(email);
  if (!em) return jsonOut({ status: 'success', mapping: null });
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Mappings');
  if (!sh || sh.getLastRow() <= 1) return jsonOut({ status: 'success', mapping: null });
  var rows = sh.getDataRange().getValues();
  for (var r = 1; r < rows.length; r++) {
    if (normEmail_(rows[r][0]) === em) {
      return jsonOut({
        status: 'success',
        mapping: {
          email: rows[r][0],
          apiUrl: rows[r][1] || '',
          schoolName: rows[r][2] || '',
          updatedAt: rows[r][3] || '',
        },
      });
    }
  }
  return jsonOut({ status: 'success', mapping: null });
}

/* ─── 매핑 저장 (ID 토큰 검증) ─── */
function setMapping(req) {
  var idToken = req.idToken;
  var apiUrl = String(req.apiUrl || '').trim();
  var schoolName = String(req.schoolName || '').trim();

  if (!idToken) return jsonOut({ status: 'error', message: 'idToken 누락' });
  if (!apiUrl) return jsonOut({ status: 'error', message: 'apiUrl 누락' });

  var verify = verifyIdToken_(idToken);
  if (!verify.ok) return jsonOut({ status: 'error', message: '토큰 검증 실패: ' + verify.message });
  var email = normEmail_(verify.email);
  if (!email) return jsonOut({ status: 'error', message: '토큰에서 이메일을 찾을 수 없음' });

  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Mappings');
  var rows = sh.getDataRange().getValues();
  var now = new Date();
  var foundRow = -1;
  for (var r = 1; r < rows.length; r++) {
    if (normEmail_(rows[r][0]) === email) {
      foundRow = r + 1; // 1-based
      break;
    }
  }
  if (foundRow > 0) {
    sh.getRange(foundRow, 1, 1, 4).setValues([[email, apiUrl, schoolName, now]]);
  } else {
    sh.appendRow([email, apiUrl, schoolName, now]);
  }
  return jsonOut({ status: 'success', email: email, apiUrl: apiUrl });
}

/* ─── 매핑 삭제 (자기 자신만) ─── */
function deleteMapping(req) {
  var idToken = req.idToken;
  if (!idToken) return jsonOut({ status: 'error', message: 'idToken 누락' });
  var verify = verifyIdToken_(idToken);
  if (!verify.ok) return jsonOut({ status: 'error', message: '토큰 검증 실패: ' + verify.message });
  var email = normEmail_(verify.email);
  if (!email) return jsonOut({ status: 'error', message: '토큰에서 이메일을 찾을 수 없음' });

  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Mappings');
  var rows = sh.getDataRange().getValues();
  for (var r = rows.length - 1; r >= 1; r--) {
    if (normEmail_(rows[r][0]) === email) {
      sh.deleteRow(r + 1);
      return jsonOut({ status: 'success' });
    }
  }
  return jsonOut({ status: 'success', message: 'no mapping' });
}

/* ─── ID 토큰 검증 ─── */
function verifyIdToken_(idToken) {
  try {
    var resp = UrlFetchApp.fetch(
      'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken),
      { muteHttpExceptions: true }
    );
    if (resp.getResponseCode() !== 200) {
      return { ok: false, message: 'tokeninfo HTTP ' + resp.getResponseCode() };
    }
    var info = JSON.parse(resp.getContentText());
    if (!info.email) return { ok: false, message: 'no email claim' };
    if (!info.email_verified || info.email_verified === 'false') {
      return { ok: false, message: 'email not verified' };
    }
    var expectedAud = PropertiesService.getScriptProperties().getProperty('EXPECTED_AUDIENCE');
    if (expectedAud && info.aud !== expectedAud) {
      return { ok: false, message: 'audience mismatch' };
    }
    return { ok: true, email: info.email };
  } catch (e) {
    return { ok: false, message: String(e) };
  }
}

/* ─── 헬퍼 ─── */
function normEmail_(s) {
  return String(s == null ? '' : s).trim().toLowerCase();
}
function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
