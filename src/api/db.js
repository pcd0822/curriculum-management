/**
 * Database API Module (ES Module)
 * Mirrors js/db.js but as ES module exports for the React SPA.
 */

let apiUrl = null;

/* ─── helpers ─── */

async function gasGet(action) {
  if (!apiUrl) throw new Error('API URL not configured');
  const res = await fetch(`${apiUrl}?action=${action}`);
  if (!res.ok) throw new Error(`Failed to ${action}`);
  return res.json();
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
        throw new Error('서버(Google Apps Script) 응답 오류입니다. 배포 상태를 확인해주세요.');
      }
      throw new Error('서버 응답을 처리할 수 없습니다: ' + text.substring(0, 100));
    }
    throw e;
  }
}

/* ─── public API ─── */

export function init(url) {
  apiUrl = url;
}

export function isConfigured() {
  return !!apiUrl;
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

export function fetchRecommendedCourses() {
  return gasGet('getRecommendedCourses');
}

export function saveRecommendedCourses(data) {
  return gasPost('saveRecommendedCourses', data);
}
