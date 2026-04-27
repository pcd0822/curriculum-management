/**
 * Database API Module (ES Module)
 * Exact mirror of js/db.js patterns for GAS compatibility.
 */

const STORAGE_KEY = 'gas_api_url';
let apiUrl = null;

// 앱 시작 시 localStorage에서 자동 복원
try {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) apiUrl = saved;
} catch { /* SSR or blocked storage */ }

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

/* ── GET helpers (same pattern as original js/db.js) ── */

export async function fetchConfig() {
  if (!apiUrl) throw new Error('API URL not configured');
  const response = await fetch(`${apiUrl}?action=getConfig`);
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

export function saveConfigByGrade(grade, rows) {
  return gasPost('saveConfig', { mode: 'replaceGrade', grade: Number(grade), rows: rows || [] });
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
