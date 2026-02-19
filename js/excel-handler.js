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
     * Row 1: 학번, 이름, 희망진로, ...subject names (optional only, grade-semester order).
     * Row 2+: sample student rows with 0/1 for each subject.
     * @param {Array} optionalCourses - List of course objects (subjectName, grade, semester, id/slug).
     */
    downloadBulkEnrollmentTemplate: (optionalCourses) => {
        const subjectNames = (optionalCourses || []).map(c => (c.subjectName || c.과목명 || '').toString().trim()).filter(Boolean);
        const headerRow = ['학번', '이름', '희망 진로', ...subjectNames];
        const sampleRows = [
            ['20101', '홍길동', '컴퓨터공학', ...subjectNames.map((_, i) => i < 2 ? 1 : 0)],
            ['20102', '이순신', '간호사', ...subjectNames.map((_, i) => i >= 1 && i < 3 ? 1 : 0)]
        ];
        const data = [headerRow, ...sampleRows];
        const worksheet = XLSX.utils.aoa_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, '수강신청일괄');
        XLSX.writeFile(workbook, '수강신청_일괄등록_양식.xlsx');
    }
};

window.ExcelHandler = ExcelHandler;
