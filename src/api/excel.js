/**
 * Excel Handler (ES Module) — wraps SheetJS for the React SPA.
 */
import * as XLSX from 'xlsx';

export function readExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        resolve(XLSX.utils.sheet_to_json(ws));
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export function downloadExcel(data, fileName, sheetName = 'Sheet1') {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, fileName);
}

export function downloadTemplate() {
  downloadExcel([{
    과목명: '예시: 문학', 영문ID: 'munhag', 학년: 2, 학기: 1, 학점: 4,
    교과군: '기초교과', 세부교과: '국어', 필수여부: 'FALSE', 개설여부: 'TRUE', 선수과목: ''
  }], 'course_template_korean.xlsx', 'Courses');
}

export function downloadRegistryTemplate() {
  downloadExcel([
    { 학번: '20513', 이름: '홍길동', 학생코드: '' },
    { 학번: '20514', 이름: '이순신', 학생코드: '' },
  ], 'student_registry_template.xlsx', 'Registry');
}

export function downloadJointCurriculumTemplate() {
  downloadExcel([{
    분류: '예시', 거점학교: 'OO고', 과목명: '예시: 심화수학', slug: 'simhwasuhak',
    세부교과: '수학', 교과편제: '진로', 학년: 2, 학기: 1, 학점: 4,
    운영일시: '화요일 7교시', 선이수과목: '수학I, 수학II'
  }], '공동교육과정_개설과목_양식.xlsx', '공동교육과정');
}

export function downloadBulkEnrollmentTemplate(optionalCourses) {
  const list = (optionalCourses || []).filter(c => (c.subjectName || c.과목명 || '').toString().trim());
  const headers = list.map(c => {
    const name = (c.subjectName || c.과목명 || '').toString().trim();
    return `${name} (${c.grade ?? c.학년 ?? ''}-${c.semester ?? c.학기 ?? ''})`;
  });
  const headerRow = ['학번', '이름', '희망 진로', ...headers];
  const sampleRows = [
    ['20101', '홍길동', '컴퓨터공학', ...headers.map((_, i) => i < 2 ? 1 : 0)],
    ['20102', '이순신', '간호사', ...headers.map((_, i) => i >= 1 && i < 3 ? 1 : 0)],
  ];
  const ws = XLSX.utils.aoa_to_sheet([headerRow, ...sampleRows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '수강신청일괄');
  XLSX.writeFile(wb, '수강신청_일괄등록_양식.xlsx');
}
