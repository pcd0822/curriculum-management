/**
 * Database API Module (ES Module)
 * Mirrors js/db.js — communicates with Google Apps Script Web App.
 */

const STORAGE_KEY = 'gas_api_url';
let apiUrl = null;

// 앱 시작 시 localStorage에서 자동 복원
try {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) apiUrl = saved;
} catch { /* SSR or blocked storage */ }

/* ─── helpers ─── */

async function gasGet(action) {
  if (!apiUrl) throw new Error('API URL not configured');
  const url = `${apiUrl}?action=${action}`;
  // GAS Web App은 302 redirect를 반환하므로 반드시 redirect: 'follow'
  const res = await fetch(url, { redirect: 'follow' });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    if (text.includes('<!DOCTYPE html>')) {
      throw new Error('GAS 배포 URL을 확인해주세요. HTML 응답이 반환되었습니다.');
    }
    throw new Error('서버 응답 파싱 실패: ' + text.substring(0, 100));
  }
}

async function gasPost(action, data) {
  if (!apiUrl) throw new Error('API URL not configured');
  const res = await fetch(apiUrl, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, data }),
  });

  const text = await res.text();
  try {
    const json = JSON.parse(text);
    if (json.status === 'error') throw new Error(json.message || 'Server error');
    return json;
  } catch (e) {
    if (e instanceof SyntaxError) {
      if (text.includes('<!DOCTYPE html>')) {
        throw new Error('GAS 배포 URL을 확인해주세요. HTML 응답이 반환되었습니다.');
      }
      throw new Error('서버 응답 파싱 실패: ' + text.substring(0, 100));
    }
    throw e;
  }
}

/* ─── public API ─── */

export function init(url) {
  apiUrl = url;
  try { localStorage.setItem(STORAGE_KEY, url); } catch { /* ignore */ }
}

export function isConfigured() {
  return !!apiUrl;
}

export function getApiUrl() {
  return apiUrl || '';
}

export function fetchConfig() {
  return gasGet('getConfig');
}

export function saveConfig(courses) {
  return gasPost('saveConfig', courses);
}

export function fetchSettings() {
  return gasGet('getSettings');
}

export function saveSettings(settings) {
  return gasPost('saveSettings', settings);
}

export function fetchResponses() {
  return gasGet('getResponses');
}

export function submitResponse(responseData) {
  return gasPost('submitResponse', responseData);
}

export function deleteResponse(ids) {
  return gasPost('deleteResponse', ids);
}

export function fetchRegistry() {
  return gasGet('getRegistry');
}

export function saveRegistry(registry) {
  return gasPost('saveRegistry', registry);
}

export function fetchJointCurriculum() {
  return gasGet('getJointCurriculum');
}

export function saveJointCurriculum(data) {
  return gasPost('saveJointCurriculum', data);
}

export function verifyStudent({ studentCode, studentId, name }) {
  return gasPost('verifyStudent', { studentCode, studentId, name });
}
