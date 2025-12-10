// AI Career Analysis Logic
function analyzeClassCareerSuitability(students) {
    const ctx = document.getElementById('classCareerChart');
    if (!ctx) return;

    // Heuristic Mapping (Simple Keyword Matching)
    const stats = {
        '높음 (80% 이상)': 0,
        '보통 (50~80%)': 0,
        '낮음 (50% 미만)': 0
    };

    students.forEach(s => {
        if (!s.Major || !s.SelectedCourses) return;

        const major = s.Major;
        const courses = s.SelectedCourses;

        // 1. Identify Target Category
        let targetKeywords = [];
        if (major.includes('공학') || major.includes('컴퓨터') || major.includes('SW') || major.includes('과학') || major.includes('이과')) targetKeywords = ['과학', '수학', '정보', '물리', '화학'];
        else if (major.includes('의') || major.includes('간호') || major.includes('생명') || major.includes('보건')) targetKeywords = ['생명', '화학', '과학', '수학'];
        else if (major.includes('경영') || major.includes('경제') || major.includes('사회')) targetKeywords = ['사회', '경제', '수학', '통계'];
        else if (major.includes('인문') || major.includes('어문') || major.includes('교육')) targetKeywords = ['사회', '윤리', '역사', '제2외국어', '철학'];
        else if (major.includes('예술') || major.includes('체육') || major.includes('미술') || major.includes('음악')) targetKeywords = ['미술', '음악', '체육', '예술'];
        else targetKeywords = ['진로', '교양']; // Default

        // 2. Count Matches
        const selectedList = courses.split(',');
        let matches = 0;

        selectedList.forEach(c => {
            const cName = c.trim();
            const meta = allCourseData.find(x => x.slug && cName.startsWith(x.slug));
            const realName = meta ? meta.subjectName : (cName.includes('-') ? cName.slice(0, cName.lastIndexOf('-')) : cName);

            if (targetKeywords.some(k => realName.includes(k))) {
                matches++;
            }
        });

        // Normalize Score (Assume 4 relevant courses is "Good")
        const percentage = Math.min((matches / 4) * 100, 100);

        if (percentage >= 80) stats['높음 (80% 이상)']++;
        else if (percentage >= 50) stats['보통 (50~80%)']++;
        else stats['낮음 (50% 미만)']++;
    });

    if (window.dashboardCharts && window.dashboardCharts.classCareer) {
        window.dashboardCharts.classCareer.destroy();
    }
    window.dashboardCharts = window.dashboardCharts || {};

    window.dashboardCharts.classCareer = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(stats),
            datasets: [{
                data: Object.values(stats),
                backgroundColor: ['#10B981', '#FBBF24', '#EF4444'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right' }
            }
        }
    });
}
