/**
 * 학생 세션 정보 — 로그인 후 앱 종료(브라우저 닫기) 전까지 유지.
 * sessionStorage는 탭 단위로만 유지되므로 localStorage로 통일.
 */
const KEY = 'verifiedStudent';

export function setVerifiedStudent(student) {
  try {
    localStorage.setItem(KEY, JSON.stringify(student || {}));
  } catch { /* ignore */ }
  // sessionStorage에도 미러링하여 기존 코드 호환 유지
  try { sessionStorage.setItem(KEY, JSON.stringify(student || {})); } catch {}
}

export function getVerifiedStudent() {
  try {
    const ls = localStorage.getItem(KEY);
    if (ls) return JSON.parse(ls);
  } catch {}
  try {
    const ss = sessionStorage.getItem(KEY);
    if (ss) {
      const v = JSON.parse(ss);
      // 다음 호출부터는 localStorage에서 즉시 읽히도록 마이그레이션
      try { localStorage.setItem(KEY, ss); } catch {}
      return v;
    }
  } catch {}
  return {};
}

export function clearVerifiedStudent() {
  try { localStorage.removeItem(KEY); } catch {}
  try { sessionStorage.removeItem(KEY); } catch {}
}

export function getStudentAvatarLabel() {
  const s = getVerifiedStudent();
  const name = s.name || s.이름 || '';
  return name ? String(name).charAt(0) : '?';
}
