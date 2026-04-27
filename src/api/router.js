/**
 * Router API — 별도 GAS Web App에 매핑 [email → apiUrl] 저장/조회.
 * 환경변수 VITE_GAS_ROUTER_URL에 라우터 GAS의 Web App URL을 등록.
 */

const ROUTER_URL = String(import.meta.env.VITE_GAS_ROUTER_URL || '').trim();

export function isRouterConfigured() {
  return !!ROUTER_URL;
}

/**
 * 이메일로 본인 매핑 조회.
 * @returns { email, apiUrl, schoolName, updatedAt } | null
 */
export async function fetchMyMapping(email) {
  if (!ROUTER_URL) return null;
  if (!email) return null;
  try {
    const url = `${ROUTER_URL}?action=getMapping&email=${encodeURIComponent(email)}`;
    const res = await fetch(url);
    const json = await res.json();
    if (json.status === 'success') return json.mapping || null;
    return null;
  } catch (e) {
    console.warn('[router] fetchMyMapping failed', e);
    return null;
  }
}

/**
 * 본인 매핑 등록/갱신. ID 토큰 필수 (서버에서 검증).
 */
export async function registerMyMapping({ idToken, apiUrl, schoolName }) {
  if (!ROUTER_URL) throw new Error('Router URL이 설정되어 있지 않습니다 (VITE_GAS_ROUTER_URL).');
  if (!idToken) throw new Error('ID 토큰이 필요합니다. 다시 로그인해주세요.');
  if (!apiUrl) throw new Error('apiUrl이 비어있습니다.');
  const res = await fetch(ROUTER_URL, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'setMapping', idToken, apiUrl, schoolName: schoolName || '' }),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { throw new Error('라우터 응답 파싱 실패: ' + text.slice(0, 200)); }
  if (json.status !== 'success') throw new Error(json.message || '매핑 저장 실패');
  return json;
}

/**
 * 본인 매핑 삭제.
 */
export async function deleteMyMapping({ idToken }) {
  if (!ROUTER_URL) throw new Error('Router URL이 설정되어 있지 않습니다.');
  if (!idToken) throw new Error('ID 토큰이 필요합니다.');
  const res = await fetch(ROUTER_URL, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'deleteMapping', idToken }),
  });
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    if (json.status !== 'success') throw new Error(json.message || '삭제 실패');
    return json;
  } catch (e) {
    if (e instanceof SyntaxError) throw new Error('라우터 응답 파싱 실패: ' + text.slice(0, 200));
    throw e;
  }
}
