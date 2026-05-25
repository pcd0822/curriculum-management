/**
 * Careernet / Netlify Functions API wrapper (ES Module)
 */

const BASE = '/.netlify/functions';

/* ─── 진로심리검사 (careernet-test) ─── */

export async function getQuestions(testId) {
  const res = await fetch(`${BASE}/careernet-test?action=questions&q=${testId}`);
  if (!res.ok) throw new Error('검사 문항을 불러올 수 없습니다.');
  return res.json();
}

export async function submitReport(payload) {
  const res = await fetch(`${BASE}/careernet-test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'report', ...payload }),
  });
  if (!res.ok) throw new Error('검사 결과 제출에 실패했습니다.');
  return res.json();
}

/* ─── 학과 정보 (careernet-test, cnet actions) ─── */

export async function getMajorList(subject, page = 1, perPage = 20, search = '') {
  const params = new URLSearchParams({
    action: 'major_list',
    subject: subject || '',
    thisPage: String(page),
    perPage: String(perPage),
  });
  if (search) params.set('searchTitle', search);
  const res = await fetch(`${BASE}/careernet-test?${params}`);
  if (!res.ok) throw new Error('학과 목록을 불러올 수 없습니다.');
  return res.json();
}

export async function getMajorDetail(majorSeq) {
  const res = await fetch(`${BASE}/careernet-test?action=major_view&majorSeq=${majorSeq}`);
  if (!res.ok) throw new Error('학과 상세 정보를 불러올 수 없습니다.');
  return res.json();
}

/* ─── AI 추천 (ai-recommendation) ─── */

export async function getAiRecommendation(major, courses) {
  const res = await fetch(`${BASE}/ai-recommendation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ major, availableCourses: courses }),
  });
  if (!res.ok) throw new Error('AI 추천을 받을 수 없습니다.');
  return res.json();
}

/* ─── 커리어넷 기반 추천 (careernet-recommendation) ─── */

export async function getCareernetRecommendation(major, keyword) {
  const res = await fetch(`${BASE}/careernet-recommendation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ major, keyword }),
  });
  if (!res.ok) throw new Error('커리어넷 추천을 받을 수 없습니다.');
  return res.json();
}

/* ─── 학과명 자동완성 (학과 정보 탐색용 — 커리어넷) ───
 * subject(계열 코드) 안에서 q로 학과명 부분일치 검색 → distinct 학과명 배열.
 */
export async function suggestInfoMajors(subject, q) {
  if (!q || !q.trim()) return [];
  try {
    const data = await getMajorList(subject || '', 1, 20, q.trim());
    const raw = data?.dataSearch?.content;
    const items = Array.isArray(raw) ? raw : (raw ? [raw] : []);
    const names = new Set();
    items.forEach((m) => {
      const n = String(m.mClass || m.major || '').trim();
      if (n) names.add(n);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'ko'));
  } catch {
    return [];
  }
}

/* ─── 학과명 자동완성 (교수님 인터뷰용 — odcloud) ─── */
export async function suggestInterviewMajors(q) {
  if (!q || !q.trim()) return [];
  try {
    const res = await fetch(`${BASE}/careernet-interview?suggest=${encodeURIComponent(q.trim())}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.suggestions) ? data.suggestions : [];
  } catch {
    return [];
  }
}

/* ─── 학과명 자동완성 (커리큘럼용 — odcloud) ─── */
export async function suggestCurriculumMajors(q) {
  if (!q || !q.trim()) return [];
  try {
    const res = await fetch(`${BASE}/careernet-curriculum?suggest=${encodeURIComponent(q.trim())}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.suggestions) ? data.suggestions : [];
  } catch {
    return [];
  }
}

/* ─── 학과 교수님 인터뷰 ───
 * Netlify Function 프록시 경유 (공공데이터포털 odcloud).
 * 서버에서 인증키(ODCLOUD_API_KEY) 보관 + 응답 정규화.
 */
export async function getProfessorInterview(majorName) {
  if (!majorName || !majorName.trim()) {
    throw new Error('학과명을 입력하세요.');
  }
  const res = await fetch(`${BASE}/careernet-interview?major=${encodeURIComponent(majorName.trim())}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `교수 인터뷰를 불러올 수 없습니다. (${res.status})`);
  }
  return data; // { major, totalCount, interviews: [{ professor, position, qas: [{question, answer}] }] }
}

/* ─── 학과 커리큘럼 (강의계획서) ───
 * Netlify Function 프록시 경유 (공공데이터포털 odcloud).
 * 2단계 호출 패턴:
 *   - university 미지정 → 매칭된 대학 목록 반환 (stage: 'universities')
 *   - university 지정 → 그 대학 커리큘럼 반환 (stage: 'courses')
 */
export async function getMajorCurriculum(majorName, universityName) {
  if (!majorName || !majorName.trim()) {
    throw new Error('학과명을 입력하세요.');
  }
  const params = new URLSearchParams({ major: majorName.trim() });
  if (universityName && universityName.trim()) {
    params.set('university', universityName.trim());
  }
  const res = await fetch(`${BASE}/careernet-curriculum?${params.toString()}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `학과 커리큘럼을 불러올 수 없습니다. (${res.status})`);
  }
  return data;
}

/* ─── 과목 상세 ───
 * 원본 데이터셋의 한 행에 학습목표·교재·선행학습자료가 모두 포함되어 있어 별도 API 호출이 불필요.
 * UI에서 그대로 모달에 표시할 수 있도록 fallback 객체를 그대로 돌려준다.
 * (시그니처는 유지하여 추후 별도 상세 API가 생기면 이 함수만 fetch로 교체하면 된다.)
 */
export async function getCurriculumCourseDetail(courseId, fallback = {}) {
  if (!courseId) throw new Error('과목 ID가 없습니다.');
  return { ...fallback };
}
