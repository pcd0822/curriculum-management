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
