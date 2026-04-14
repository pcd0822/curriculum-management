/**
 * 학생 코드: 10자리 영문 대문자 + 숫자 (0-9, A-Z)
 */
const STUDENT_CODE_LENGTH = 10;
const STUDENT_CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function normalizeStudentCodeInput(str) {
    if (str == null) return '';
    return String(str).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * @returns {string} 10자리 코드
 */
function generateStudentCode() {
    const out = [];
    const buf = new Uint8Array(STUDENT_CODE_LENGTH);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        crypto.getRandomValues(buf);
    } else {
        for (let i = 0; i < STUDENT_CODE_LENGTH; i++) buf[i] = Math.floor(Math.random() * 256);
    }
    for (let i = 0; i < STUDENT_CODE_LENGTH; i++) {
        out.push(STUDENT_CODE_CHARS[buf[i] % STUDENT_CODE_CHARS.length]);
    }
    return out.join('');
}

/**
 * 엑셀 등에서 난수 충돌 시 재시도용
 * @param {Set<string>} used
 */
function generateUniqueStudentCode(used) {
    let code;
    let guard = 0;
    do {
        code = generateStudentCode();
        guard++;
        if (guard > 5000) throw new Error('학생 코드 생성에 실패했습니다.');
    } while (used.has(code));
    used.add(code);
    return code;
}

window.STUDENT_CODE_LENGTH = STUDENT_CODE_LENGTH;
window.normalizeStudentCodeInput = normalizeStudentCodeInput;
window.generateStudentCode = generateStudentCode;
window.generateUniqueStudentCode = generateUniqueStudentCode;
