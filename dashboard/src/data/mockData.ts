export interface ConfigRow {
  과목명: string;
  영문ID: string;
  학년: number;
  학기: number;
  학점: number;
  교과군: string;
  세부교과: string;
  필수여부: string;
  개설여부: string;
  선수과목: string;
}

export interface ResponseRow {
  Timestamp: string;
  Grade: string;
  Class: string;
  Number: string;
  Name: string;
  Major: string;
  SelectedCourses: string;
  JointCourses: string;
  TotalCredits: number;
  ValidationResult: string;
  AiRecommendation: string;
}

export interface RegistryRow {
  학번: string;
  이름: string;
  학생코드: string;
}

export interface Settings {
  schoolName: string;
  requireStudentGate: boolean;
  selectionRules: Record<string, { credits: number | string; count: number }[]>;
}

export const MOCK_CONFIG: ConfigRow[] = [
  { 과목명: '문학', 영문ID: 'munhag', 학년: 2, 학기: 1, 학점: 4, 교과군: '기초교과', 세부교과: '국어', 필수여부: 'TRUE', 개설여부: 'TRUE', 선수과목: '' },
  { 과목명: '미적분', 영문ID: 'miguebun', 학년: 2, 학기: 1, 학점: 4, 교과군: '기초교과', 세부교과: '수학', 필수여부: 'TRUE', 개설여부: 'TRUE', 선수과목: '' },
  { 과목명: '영어Ⅱ', 영문ID: 'english2', 학년: 2, 학기: 1, 학점: 4, 교과군: '기초교과', 세부교과: '영어', 필수여부: 'TRUE', 개설여부: 'TRUE', 선수과목: '' },
  { 과목명: '한국사', 영문ID: 'khistory', 학년: 2, 학기: 1, 학점: 4, 교과군: '기초교과', 세부교과: '사회', 필수여부: 'TRUE', 개설여부: 'TRUE', 선수과목: '' },
  { 과목명: '물리학Ⅰ', 영문ID: 'physics1', 학년: 2, 학기: 1, 학점: 4, 교과군: '탐구교과', 세부교과: '과학', 필수여부: 'FALSE', 개설여부: 'TRUE', 선수과목: '' },
  { 과목명: '화학Ⅰ', 영문ID: 'chem1', 학년: 2, 학기: 2, 학점: 4, 교과군: '탐구교과', 세부교과: '과학', 필수여부: 'FALSE', 개설여부: 'TRUE', 선수과목: '' },
  { 과목명: '세계사', 영문ID: 'worldhist', 학년: 2, 학기: 2, 학점: 4, 교과군: '탐구교과', 세부교과: '사회', 필수여부: 'FALSE', 개설여부: 'TRUE', 선수과목: '' },
  { 과목명: '음악', 영문ID: 'music', 학년: 2, 학기: 1, 학점: 4, 교과군: '예술교과', 세부교과: '예술', 필수여부: 'FALSE', 개설여부: 'TRUE', 선수과목: '' },
  { 과목명: '미술', 영문ID: 'art', 학년: 2, 학기: 2, 학점: 4, 교과군: '예술교과', 세부교과: '예술', 필수여부: 'FALSE', 개설여부: 'TRUE', 선수과목: '' },
  { 과목명: '미술 창작', 영문ID: 'artcreate', 학년: 3, 학기: 1, 학점: 2, 교과군: '예술교과', 세부교과: '예술', 필수여부: 'FALSE', 개설여부: 'TRUE', 선수과목: 'art' },
  { 과목명: '기술가정', 영문ID: 'techfam', 학년: 2, 학기: 1, 학점: 4, 교과군: '교양교과', 세부교과: '교양', 필수여부: 'FALSE', 개설여부: 'TRUE', 선수과목: '' },
  { 과목명: '제2외국어', 영문ID: 'lang2', 학년: 2, 학기: 2, 학점: 4, 교과군: '교양교과', 세부교과: '제2외국어', 필수여부: 'FALSE', 개설여부: 'TRUE', 선수과목: '' },
  { 과목명: '정보', 영문ID: 'info', 학년: 3, 학기: 1, 학점: 4, 교과군: '교양교과', 세부교과: '정보', 필수여부: 'FALSE', 개설여부: 'TRUE', 선수과목: '' },
  { 과목명: '철학', 영문ID: 'philo', 학년: 3, 학기: 1, 학점: 4, 교과군: '교양교과', 세부교과: '교양', 필수여부: 'FALSE', 개설여부: 'TRUE', 선수과목: '' },
  { 과목명: '확률과 통계', 영문ID: 'probstat', 학년: 3, 학기: 1, 학점: 4, 교과군: '기초교과', 세부교과: '수학', 필수여부: 'FALSE', 개설여부: 'TRUE', 선수과목: 'miguebun' },
  { 과목명: '생명과학Ⅰ', 영문ID: 'bio1', 학년: 3, 학기: 1, 학점: 4, 교과군: '탐구교과', 세부교과: '과학', 필수여부: 'FALSE', 개설여부: 'TRUE', 선수과목: '' },
  { 과목명: '영어 회화', 영문ID: 'engconv', 학년: 3, 학기: 2, 학점: 4, 교과군: '기초교과', 세부교과: '영어', 필수여부: 'FALSE', 개설여부: 'TRUE', 선수과목: 'english2' },
  { 과목명: '윤리와 사상', 영문ID: 'ethics', 학년: 3, 학기: 2, 학점: 4, 교과군: '탐구교과', 세부교과: '사회', 필수여부: 'FALSE', 개설여부: 'TRUE', 선수과목: '' },
];

export const MOCK_RESPONSES: ResponseRow[] = [
  { Timestamp: '2026-04-10T09:00:00', Grade: '2', Class: '05', Number: '13', Name: '홍길동', Major: '컴퓨터공학', SelectedCourses: '문학, 미적분, 영어Ⅱ, 한국사, 물리학Ⅰ, 음악, 기술가정, 화학Ⅰ, 정보, 확률과 통계, 생명과학Ⅰ, 영어 회화, 철학', JointCourses: '', TotalCredits: 176, ValidationResult: '모든 검증을 통과하였습니다.', AiRecommendation: '' },
  { Timestamp: '2026-04-10T09:15:00', Grade: '2', Class: '05', Number: '07', Name: '김영희', Major: '경영학', SelectedCourses: '문학, 미적분, 영어Ⅱ, 한국사, 세계사, 미술, 제2외국어, 기술가정, 확률과 통계, 윤리와 사상, 철학', JointCourses: '', TotalCredits: 160, ValidationResult: '총 이수 학점(174)이 부족합니다. 현재 160학점입니다.', AiRecommendation: '' },
  { Timestamp: '2026-04-10T09:30:00', Grade: '2', Class: '03', Number: '21', Name: '박민수', Major: '의학', SelectedCourses: '문학, 미적분, 영어Ⅱ, 한국사, 물리학Ⅰ, 화학Ⅰ, 음악, 미술, 기술가정, 제2외국어, 생명과학Ⅰ, 정보, 확률과 통계', JointCourses: '', TotalCredits: 180, ValidationResult: '모든 검증을 통과하였습니다.', AiRecommendation: '' },
  { Timestamp: '2026-04-11T10:00:00', Grade: '2', Class: '03', Number: '05', Name: '이수진', Major: '디자인', SelectedCourses: '문학, 미적분, 영어Ⅱ, 한국사, 미술, 미술 창작, 음악, 기술가정, 제2외국어, 세계사, 철학, 윤리와 사상', JointCourses: '', TotalCredits: 174, ValidationResult: '모든 검증을 통과하였습니다.', AiRecommendation: '' },
  { Timestamp: '2026-04-11T10:30:00', Grade: '2', Class: '01', Number: '18', Name: '최준호', Major: '물리학', SelectedCourses: '문학, 미적분, 영어Ⅱ, 한국사, 물리학Ⅰ, 화학Ⅰ, 기술가정, 확률과 통계, 생명과학Ⅰ, 정보', JointCourses: 'AI기초', TotalCredits: 168, ValidationResult: '예술교과(음악/미술) 이수 학점(10)이 부족합니다. 현재 0학점입니다.', AiRecommendation: '' },
];

export const MOCK_REGISTRY: RegistryRow[] = [
  { 학번: '20513', 이름: '홍길동', 학생코드: 'X7KD9M2FP1' },
  { 학번: '20507', 이름: '김영희', 학생코드: 'A3BN7R4QW2' },
  { 학번: '20321', 이름: '박민수', 학생코드: 'K8LD2V5TH6' },
  { 학번: '20305', 이름: '이수진', 학생코드: 'P1MR8Y3GC9' },
  { 학번: '20118', 이름: '최준호', 학생코드: 'W4FJ6X1NB5' },
  { 학번: '20102', 이름: '정하늘', 학생코드: 'Q9GT5Z8EA7' },
  { 학번: '30112', 이름: '강서연', 학생코드: 'U2HK4C7FS3' },
];

export const MOCK_SETTINGS: Settings = {
  schoolName: 'OO고등학교',
  requireStudentGate: true,
  selectionRules: {
    '2-1': [{ credits: 4, count: 3 }, { credits: 2, count: 1 }],
    '2-2': [{ credits: 4, count: 3 }],
    '3-1': [{ credits: 'all', count: 5 }],
  },
};

export const CATEGORY_COLORS: Record<string, string> = {
  '기초교과': '#6366f1',
  '탐구교과': '#8b5cf6',
  '예술교과': '#f59e0b',
  '교양교과': '#10b981',
  '체육교과': '#0ea5e9',
  '기타': '#94a3b8',
};

export const COMPLIANCE_RULES = {
  totalCredits: { label: '총 이수 학점', required: 174, unit: '학점' },
  basicRatio: { label: '기초교과 비율', max: 50, unit: '%' },
  artCredits: { label: '예술교과 학점', required: 10, unit: '학점' },
  liberalCredits: { label: '교양교과 학점', required: 16, unit: '학점' },
} as const;
