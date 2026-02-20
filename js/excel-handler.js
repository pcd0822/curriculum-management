/**
 * Excel Handler
 * Wrapper around SheetJS (XLSX) for reading and writing Excel files.
 */

const ExcelHandler = {
    /**
     * Reads an Excel file and returns the data as JSON.
     * @param {File} file - The uploaded file object.
     * @returns {Promise<Array>} - Array of row objects.
     */
    readExcel: (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet);
                    resolve(jsonData);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = (error) => reject(error);
            reader.readAsArrayBuffer(file);
        });
    },

    /**
     * Downloads data as an Excel file.
     * @param {Array} data - Array of objects to save.
     * @param {string} fileName - Name of the file to save.
     * @param {string} sheetName - Name of the sheet.
     */
    downloadExcel: (data, fileName, sheetName = 'Sheet1') => {
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
        XLSX.writeFile(workbook, fileName);
    },

    /**
     * Generates a template Excel file for course data.
     */
    downloadTemplate: () => {
        const templateData = [
            {
                "과목명": "예시: 문학",
                "영문ID": "munhag",
                "학년": 2,
                "학기": 1,
                "학점": 4,
                "교과군": "기초교과",
                "세부교과": "국어",
                "필수여부": "FALSE", // TRUE or FALSE
                "개설여부": "TRUE",   // TRUE or FALSE
                "선수과목": "" // 콤마로 구분된 영문ID (예: korean1, korean2)
            }
        ];
        ExcelHandler.downloadExcel(templateData, 'course_template_korean.xlsx', 'Courses');
    },

    /**
     * Generates a template Excel file for student registry.
     */
    downloadRegistryTemplate: () => {
        const templateData = [
            {
                "학번": "20513",
                "이름": "홍길동"
            },
            {
                "학번": "20514",
                "이름": "이순신"
            }
        ];
        ExcelHandler.downloadExcel(templateData, 'student_registry_template.xlsx', 'Registry');
    },

    /**
     * Reads an Excel file and returns raw rows (array of arrays). First row = headers.
     * @param {File} file - The uploaded file object.
     * @returns {Promise<Array<Array>>} - Array of rows, each row is array of cell values.
     */
    readExcelRaw: (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
                    resolve(rows);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = (error) => reject(error);
            reader.readAsArrayBuffer(file);
        });
    },

    /**
     * Generates and downloads the bulk enrollment template xlsx.
     * Row 1: 학번, 이름, 희망진로, ... (과목명 (학년-학기)) so duplicate subjects are distinct per semester.
     * Row 2+: sample student rows with 0/1 for each column.
     * @param {Array} optionalCourses - List of course objects (subjectName, grade, semester, id/slug).
     */
    /**
     * 공동교육과정 개설 과목 템플릿 다운로드
     */
    downloadJointCurriculumTemplate: () => {
        const templateData = [
            {
                '분류': '예시',
                '거점학교': 'OO고',
                '과목명': '예시: 심화수학',
                'slug': 'simhwasuhak',
                '세부교과': '수학',
                '교과편제': '진로',
                '학년': 2,
                '학기': 1,
                '학점': 4,
                '운영일시': '화요일 7교시',
                '선이수과목': '수학I, 수학II'
            }
        ];
        ExcelHandler.downloadExcel(templateData, '공동교육과정_개설과목_양식.xlsx', '공동교육과정');
    },

    downloadBulkEnrollmentTemplate: (optionalCourses) => {
        const list = (optionalCourses || []).filter(c => (c.subjectName || c.과목명 || '').toString().trim());
        const headers = list.map(c => {
            const name = (c.subjectName || c.과목명 || '').toString().trim();
            const g = c.grade ?? c.학년 ?? '';
            const s = c.semester ?? c.학기 ?? '';
            return `${name} (${g}-${s})`;
        });
        const headerRow = ['학번', '이름', '희망 진로', ...headers];
        const sampleRows = [
            ['20101', '홍길동', '컴퓨터공학', ...headers.map((_, i) => i < 2 ? 1 : 0)],
            ['20102', '이순신', '간호사', ...headers.map((_, i) => i >= 1 && i < 3 ? 1 : 0)]
        ];
        const data = [headerRow, ...sampleRows];
        const worksheet = XLSX.utils.aoa_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, '수강신청일괄');
        XLSX.writeFile(workbook, '수강신청_일괄등록_양식.xlsx');
    }
};

window.ExcelHandler = ExcelHandler;
