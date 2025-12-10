// Tab 4: Grade Subject Stats (Refactored: Separate Grade/Semester Filters)
function renderGradeSubjectStats(container, students, grade) {
    if (!container) return;

    // Initialize filters if unset
    if (!window.gradeDashboardSemesterFilter) window.gradeDashboardSemesterFilter = 'all';
    if (!window.gradeDashboardSelectGrade) window.gradeDashboardSelectGrade = window.dashboardGradeFilter !== 'all' ? window.dashboardGradeFilter : '2';

    // Helper to handle filter change
    // Attach to window so it's accessible globally
    window.handleGradeStatsFilterChange = () => {
        window.gradeDashboardSelectGrade = document.getElementById('grade-stats-grade-select').value;
        window.gradeDashboardSemesterFilter = document.getElementById('grade-stats-semester-select').value;
        renderClassStatsDashboard();
    };

    const currentFilterGrade = window.gradeDashboardSelectGrade || '2';

    const html = `
                <div class="mb-4 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-gray-50 p-3 rounded border border-gray-200">
                     <div class="flex gap-4 items-center flex-wrap">
                         <span class="font-bold text-gray-700">🔍 필터: </span>
                         
                         <!-- Grade Filter -->
                         <div class="flex items-center gap-2">
                             <label class="text-xs font-bold text-gray-500">학년</label>
                             <select id="grade-stats-grade-select" onchange="handleGradeStatsFilterChange()" class="border p-1 rounded text-sm bg-white">
                                <option value="2" ${currentFilterGrade === '2' ? 'selected' : ''}>2학년</option>
                                <option value="3" ${currentFilterGrade === '3' ? 'selected' : ''}>3학년</option>
                             </select>
                         </div>

                         <!-- Semester Filter -->
                         <div class="flex items-center gap-2">
                             <label class="text-xs font-bold text-gray-500">학기</label>
                             <select id="grade-stats-semester-select" onchange="handleGradeStatsFilterChange()" class="border p-1 rounded text-sm bg-white">
                                <option value="all" ${window.gradeDashboardSemesterFilter === 'all' ? 'selected' : ''}>전체 학기</option>
                                <option value="1" ${window.gradeDashboardSemesterFilter === '1' ? 'selected' : ''}>1학기</option>
                                <option value="2" ${window.gradeDashboardSemesterFilter === '2' ? 'selected' : ''}>2학기</option>
                             </select>
                         </div>
                     </div>
                     <span class="text-xs text-gray-400 self-end md:self-center">* 전체 데이터 기준</span>
                </div>
                <div id="grade-subject-table-container"></div>
            `;
    container.innerHTML = html;

    const targetGrade = currentFilterGrade;

    // Filter ALL students by selected grade
    const gradeStudents = allStudentData.filter(s => String(s.Grade) === String(targetGrade));
    const totalStudents = gradeStudents.length;

    if (totalStudents === 0) {
        const tableContainer = document.getElementById('grade-subject-table-container');
        if (tableContainer) tableContainer.innerHTML = '<div class="p-8 text-center text-gray-500">해당 학년의 학생 데이터가 없습니다.</div>';
        return;
    }

    // Counts
    const subjectCounts = {};
    gradeStudents.forEach(s => {
        if (!s.SelectedCourses) return;
        s.SelectedCourses.split(',').forEach(cName => {
            const name = cName.trim();
            if (!name) return;

            let searchKey = name;
            if (searchKey.includes('-')) searchKey = searchKey.split('-')[0];

            const meta = allCourseData.find(c => c.slug === searchKey || c.subjectName === searchKey || c.subjectName === name);
            const finalName = meta ? meta.subjectName : (name.includes('-') ? name.split('-')[0] : name);

            if (finalName) {
                subjectCounts[finalName] = (subjectCounts[finalName] || 0) + 1;
            }
        });
    });

    // Filter Courses
    let courses = allCourseData.filter(c => String(c.grade) === String(targetGrade));

    if (window.gradeDashboardSemesterFilter !== 'all') {
        courses = courses.filter(c => String(c.semester) === String(window.gradeDashboardSemesterFilter));
    }

    courses.sort((a, b) => {
        if (a.semester !== b.semester) return a.semester - b.semester;
        return a.subjectName.localeCompare(b.subjectName);
    });

    let tableHtml = `
                <table class="w-full text-sm text-left border-collapse">
                    <thead class="bg-gray-100 text-gray-700 uppercase">
                        <tr>
                            <th class="border p-2 text-center w-16">학기</th>
                            <th class="border p-2 text-center">과목명</th>
                            <th class="border p-2 text-center w-24">신청 인원</th>
                            <th class="border p-2 text-center w-24">비율</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white">
            `;

    if (courses.length === 0) {
        tableHtml += `<tr><td colspan="4" class="p-8 text-center text-gray-500">데이터가 없습니다.</td></tr>`;
    } else {
        courses.forEach(c => {
            const count = subjectCounts[c.subjectName] || 0;
            const percent = totalStudents > 0 ? ((count / totalStudents) * 100).toFixed(1) : '0.0';
            const isZero = count === 0;

            tableHtml += `
                        <tr class="hover:bg-gray-50">
                            <td class="border p-2 text-center text-gray-500">${c.semester}학기</td>
                            <td class="border p-2 font-medium text-gray-800">${c.subjectName}</td>
                            <td class="border p-2 text-center font-bold ${isZero ? 'text-gray-400' : 'text-blue-600'}">${count}명</td>
                            <td class="border p-2 text-center text-gray-500">${percent}%</td>
                        </tr>
                    `;
        });
    }
    tableHtml += `</tbody></table>`;

    const tableContainer = document.getElementById('grade-subject-table-container');
    if (tableContainer) tableContainer.innerHTML = tableHtml;
}
