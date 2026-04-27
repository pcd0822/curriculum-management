/**
 * Database API Module (ES Module)
 *
 * 핵심 정책: API URL은 **소유자(이메일)별로 격리**된다.
 *   - 학생 흐름  → 'gas_api_url'                         (이메일 없음)
 *   - 관리자 흐름 → 'gas_api_url:{email}'                  (이메일별)
 * 자동 복원 시점에 활성 adminSession의 이메일이 있으면 그 이메일의 키를 우선 시도하고,
 * 없으면 학생용 키를 시도한다. 이로써 같은 컴퓨터에서 다른 계정으로 로그인했을 때
 * 이전 계정의 시트가 새 계정에 매핑되지 않는다.
 */

const STUDENT_KEY = 'gas_api_url';
const ADMIN_KEY_PREFIX = 'gas_api_url:';
const ADMIN_SESSION_KEY = 'adminSession';

let apiUrl = null;
let activeOwner = null; // null=student, string=admin email

function readActiveAdminEmail() {
  try {
    const raw = localStorage.getItem(ADMIN_SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s?.email) return null;
    if (s.expiresAt && Date.now() > Number(s.expiresAt)) return null;
    return String(s.email).toLowerCase();
  } catch {
    return null;
  }
}

// 앱 시작 시 자동 복원: 활성 관리자 세션이 있으면 그 이메일 키를 우선 시도
try {
  const adminEmail = readActiveAdminEmail();
  if (adminEmail) {
    const url = localStorage.getItem(ADMIN_KEY_PREFIX + adminEmail);
    if (url) {
      apiUrl = url;
      activeOwner = adminEmail;
    }
    // 매핑 없으면 비활성 상태 유지 (학생 키로 폴백하지 않음 — 다른 사람 시트로 누출 차단)
  } else {
    const url = localStorage.getItem(STUDENT_KEY);
    if (url) {
      apiUrl = url;
      activeOwner = null;
    }
  }
} catch { /* SSR or blocked storage */ }

/* ─── public API ─── */

/**
 * @param {string} url
 * @param {{ ownerEmail?: string|null }} [opts] — 명시 시 소유자별 키에 저장.
 *   ownerEmail 미지정 시 현재 activeOwner 유지.
 *   ownerEmail === null 명시 시 학생 키에 저장.
 */
export function init(url, opts = {}) {
  apiUrl = url;
  if (Object.prototype.hasOwnProperty.call(opts, 'ownerEmail')) {
    activeOwner = opts.ownerEmail ? String(opts.ownerEmail).toLowerCase() : null;
  }
  try {
    if (activeOwner) {
      localStorage.setItem(ADMIN_KEY_PREFIX + activeOwner, url);
    } else {
      localStorage.setItem(STUDENT_KEY, url);
    }
  } catch { /* ignore */ }
}

/** 글로벌 상태만 비움 (localStorage는 보존). 인증 변경 시 호출하여 이전 계정 시트 노출 차단 */
export function reset() {
  apiUrl = null;
  activeOwner = null;
}

export function isConfigured() {
  return !!apiUrl;
}

export function getApiUrl() {
  return apiUrl || '';
}

export function getActiveOwner() {
  return activeOwner;
}

/* ── GET helpers (same pattern as original js/db.js) ── */

/**
 * 편제표 조회.
 * cohort 인자가 있으면 그 코호트(1|2|3)의 편제표만 조회.
 * 없으면 단일 Config 시트(구버전 호환).
 */
export async function fetchConfig(cohort) {
  if (!apiUrl) throw new Error('API URL not configured');
  const url = cohort
    ? `${apiUrl}?action=getConfig&cohort=${encodeURIComponent(cohort)}`
    : `${apiUrl}?action=getConfig`;
  const response = await fetch(url);
  return await response.json();
}

/**
 * 등록된 코호트 목록 + 행 수.
 * @returns Promise<Array<{ cohort: 1|2|3, count: number }>>
 */
export async function fetchRegisteredCohorts() {
  if (!apiUrl) throw new Error('API URL not configured');
  const response = await fetch(`${apiUrl}?action=getRegisteredCohorts`);
  return await response.json();
}

export async function fetchSettings() {
  if (!apiUrl) throw new Error('API URL not configured');
  const response = await fetch(`${apiUrl}?action=getSettings`);
  return await response.json();
}

export async function fetchResponses() {
  if (!apiUrl) throw new Error('API URL not configured');
  const response = await fetch(`${apiUrl}?action=getResponses`);
  return await response.json();
}

export async function fetchRegistry() {
  if (!apiUrl) throw new Error('API URL not configured');
  const response = await fetch(`${apiUrl}?action=getRegistry`);
  return await response.json();
}

export async function fetchJointCurriculum() {
  if (!apiUrl) throw new Error('API URL not configured');
  const response = await fetch(`${apiUrl}?action=getJointCurriculum`);
  return await response.json();
}

/* ── POST helpers (exact same pattern as original js/db.js) ── */

async function gasPost(action, data) {
  if (!apiUrl) throw new Error('API URL not configured');
  const response = await fetch(apiUrl, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, data }),
  });
  const text = await response.text();
  try {
    const json = JSON.parse(text);
    if (json.status === 'error') throw new Error(json.message || 'Server error');
    return json;
  } catch (e) {
    if (e instanceof SyntaxError) {
      if (text.includes('<!DOCTYPE html>')) {
        throw new Error('GAS 배포 URL을 확인해주세요. HTML 응답이 반환되었습니다.');
      }
      throw new Error('서버 응답 파싱 실패: ' + text.substring(0, 200));
    }
    throw e;
  }
}

export function saveConfig(courses) {
  return gasPost('saveConfig', courses);
}

/** 코호트(현 학년) 단위로 편제표 전체 교체. cohort=1|2|3 */
export function saveConfigByCohort(cohort, rows) {
  return gasPost('saveConfig', { cohort: Number(cohort), rows: rows || [] });
}

export function saveSettings(settings) {
  return gasPost('saveSettings', settings);
}

export function submitResponse(responseData) {
  return gasPost('submitResponse', responseData);
}

export function deleteResponse(ids) {
  return gasPost('deleteResponse', ids);
}

export function saveRegistry(registry) {
  return gasPost('saveRegistry', registry);
}

export function saveJointCurriculum(data) {
  return gasPost('saveJointCurriculum', data);
}

export function verifyStudent({ studentCode, studentId }) {
  return gasPost('verifyStudent', { studentCode, studentId });
}
