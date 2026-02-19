/**
 * Validation Module
 * Handles course selection validation logic.
 */

const Validation = {
    /**
     * Validates the selected courses against curriculum rules.
     * @param {Array} selectedCourses - List of selected course objects.
     * @param {Array} jointCourses - List of joint curriculum courses.
     * @param {Object} limits - Selection limits per semester.
     * @returns {Object} - { valid: boolean, messages: Array<string>, type: 'success'|'error' }
     */
    validate: (selectedCourses, jointCourses, limits) => {
        let errorMessages = [];
        let totalCredits = 0;
        let basicCredits = 0;
        let artCredits = 0;
        let electiveGroupCredits = 0; // 교양, 제2외국어, 정보

        // Helper to map joint course subCategory to main category
        const jointMap = {
            '국어': '기초교과', '수학': '기초교과', '영어': '기초교과',
            '사회': '탐구교과', '과학': '탐구교과',
            '체육': '체육교과', '예술': '예술교과',
            '제2외국어': '교양교과', '교양': '교양교과', '정보': '교양교과'
        };

        // Calculate credits
        const allSelected = [...selectedCourses, ...jointCourses.map(c => ({
            ...c,
            category: jointMap[c.subCategory] || '기타',
            isJoint: true
        }))];

        allSelected.forEach(course => {
            totalCredits += course.credits;
            if (course.category === '기초교과') basicCredits += course.credits;
            if (course.category === '예술교과') artCredits += course.credits;
            if (['교양교과', '제2외국어', '정보'].includes(course.category)) electiveGroupCredits += course.credits;
        });

        // 1. Total Credits Check (Example: 174)
        if (totalCredits < 174) {
            errorMessages.push(`총 이수 학점(174)이 부족합니다. 현재 ${totalCredits}학점입니다.`);
        }

        // 2. Basic Subjects Ratio Check (> 50%)
        if (totalCredits > 0 && basicCredits > (totalCredits * 0.5)) {
            errorMessages.push(`기초교과(국/수/영/한국사) 이수 단위가 총 이수 단위의 50%를 초과하였습니다.`);
        }

        // 3. Art Subjects Check (>= 10)
        if (artCredits < 10) {
            errorMessages.push(`예술교과(음악/미술) 이수 학점(10)이 부족합니다. 현재 ${artCredits}학점입니다.`);
        }

        // 4. Elective Group Check (>= 16)
        if (electiveGroupCredits < 16) {
            errorMessages.push(`생활·교양 교과군(기술·가정/제2외국어/한문/교양) 필수 이수 학점(16)이 부족합니다. 현재 ${electiveGroupCredits}학점입니다.`);
        }

        // 5. Prerequisites Check (슬러그→과목명: 선택과목 식별을 slug·subjectName 모두로)
        const selectedIds = new Set();
        selectedCourses.forEach(c => {
            if (c.slug) selectedIds.add(c.slug);
            if (c.subjectName) selectedIds.add(c.subjectName);
        });
        selectedCourses.forEach(course => {
            if (course.prerequisites && course.prerequisites.length > 0) {
                let prereqs = [];
                if (Array.isArray(course.prerequisites)) prereqs = course.prerequisites;
                else if (typeof course.prerequisites === 'string') prereqs = course.prerequisites.split(',').map(s => s.trim());

                prereqs.forEach(reqSlug => {
                    if (reqSlug && !selectedIds.has(reqSlug)) {
                        errorMessages.push(`'${course.subjectName || course.name}' 과목을 수강하기 위해서는 선이수 과목(${reqSlug})을 먼저 이수해야 합니다.`);
                    }
                });
            }
        });

        if (errorMessages.length > 0) {
            return { valid: false, messages: errorMessages, type: 'error' };
        } else {
            return { valid: true, messages: ['모든 검증을 통과하였습니다.'], type: 'success' };
        }
    }
};

window.Validation = Validation;
