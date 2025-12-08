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
    }
};

window.ExcelHandler = ExcelHandler;
