/**
 * 편제표(PROCESSED_COURSES)와 추천 과목명을 매칭하고, 로드맵 적용을 돕습니다.
 */

function normalizeSubjectToken(s) {
    return String(s || '')
        .replace(/\([^)]*\)/g, '')
        .replace(/[\s·．.]/g, '')
        .toLowerCase();
}

/**
 * 추천 문자열(과목명 일부)을 개설 과목 목록과 매칭합니다.
 * @param {string[]} hints - 과목명 후보
 * @param {object[]} processedCourses - PROCESSED_COURSES
 * @returns {object[]} 매칭된 과목 객체 (중복 id 제거)
 */
function matchRecommendedToCourses(hints, processedCourses) {
    const optional = (processedCourses || []).filter((c) => !c.required);
    const seen = new Set();
    const out = [];

    const hintList = (hints || [])
        .map((h) => String(h).trim())
        .filter(Boolean);

    for (const hint of hintList) {
        const nHint = normalizeSubjectToken(hint.split(/[:：]/)[0]);
        if (!nHint) continue;

        let best = null;
        let bestScore = 0;
        for (const c of optional) {
            const name = (c.subjectName || '').toString();
            const nName = normalizeSubjectToken(name);
            if (!nName) continue;
            let score = 0;
            if (nName === nHint) score = 100;
            else if (nName.includes(nHint) || nHint.includes(nName)) score = 80;
            else if (nHint.length >= 2 && (nName.indexOf(nHint.slice(0, 3)) >= 0 || nHint.indexOf(nName.slice(0, 3)) >= 0)) score = 50;
            if (score > bestScore) {
                bestScore = score;
                best = c;
            }
        }
        if (best && bestScore >= 50 && !seen.has(best.id)) {
            seen.add(best.id);
            out.push(best);
        }
    }
    return out;
}

/**
 * AI 텍스트 응답에서 과목명 후보 추출 (줄 단위, 콜론 앞)
 */
function parseAiSubjectLines(aiText) {
    if (!aiText) return [];
    const lines = String(aiText).split(/\n+/);
    const names = [];
    for (const line of lines) {
        const t = line.trim();
        if (!t || t.startsWith('#')) continue;
        const beforeColon = t.split(/[:：]/)[0].replace(/^[\d.\-\s]+/, '').trim();
        if (beforeColon.length >= 2) names.push(beforeColon);
    }
    return names;
}

/**
 * 학년-학기별로 그룹화
 */
function groupCoursesBySemester(courses) {
    const map = {};
    for (const c of courses || []) {
        const k = `${c.grade}-${c.semester}`;
        if (!map[k]) map[k] = [];
        map[k].push(c);
    }
    return map;
}

/**
 * 선택 규칙 요약 문자열 (안내용)
 */
function summarizeSelectionRules(selectionRules) {
    const keys = Object.keys(selectionRules || {}).sort();
    if (!keys.length) return '등록된 학기별 선택 규칙이 없습니다.';
    return keys
        .map((key) => {
            const rules = selectionRules[key];
            const [g, s] = key.split('-');
            const parts = (rules || []).map((r) => {
                const c = r.credits === 'all' ? '전체 학점' : `${r.credits}학점`;
                return `${c} 과목 ${r.count}개`;
            });
            return `${g}학년 ${s}학기: ${parts.join(', ')}`;
        })
        .join(' / ');
}

window.matchRecommendedToCourses = matchRecommendedToCourses;
window.parseAiSubjectLines = parseAiSubjectLines;
window.groupCoursesBySemester = groupCoursesBySemester;
window.summarizeSelectionRules = summarizeSelectionRules;
