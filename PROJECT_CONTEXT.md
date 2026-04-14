# PROJECT_CONTEXT — 고교학점제 수강신청 도우미

> 최종 갱신: 2026-04-14

---

## 1. 프로젝트 개요

고교학점제(Credit-Based High School System) 도입에 맞춰 학생 수강신청과 교사/관리자 교육과정 관리를 지원하는 웹 애플리케이션.

| 항목 | 내용 |
|------|------|
| 프론트엔드 | Vanilla HTML/JS + Tailwind CSS (CDN) |
| 백엔드 | Google Apps Script (Web App) |
| DB | Google Sheets (5개 시트) |
| Serverless | Netlify Functions (AI 추천) |
| AI | OpenAI GPT-4o, Career.net API (Mock 포함) |
| 배포 | Netlify (정적 파일 + Functions) |

---

## 2. 파일 구조

```
curriculum-management/
├── index.html                    # 학생용 수강신청 페이지 (1,926줄)
├── admin.html                    # 관리자 대시보드 (5,889줄)
├── google-apps-script.gs         # GAS 백엔드 (415줄)
├── manifest.json                 # PWA 매니페스트
├── icon-app.svg                  # 앱 아이콘
├── js/
│   ├── db.js                     # GAS API 래퍼 (DB 객체)
│   ├── validation.js             # 수강 검증 엔진
│   ├── roadmap.js                # AI 추천 ↔ 개설과목 매칭
│   ├── excel-handler.js          # SheetJS 래퍼 (엑셀 읽기/쓰기)
│   ├── theme.js                  # 테마 관리 (4종)
│   ├── student-code.js           # 학생코드 생성/정규화
│   └── qrcode-generator.js       # QRCode.js 래퍼
├── netlify/
│   └── functions/
│       ├── ai-recommendation.js        # OpenAI 과목 추천
│       └── careernet-recommendation.js # Career.net 진로 매칭
├── temp_ai_logic.js              # (임시) AI 분석 실험 코드
└── temp_grade_logic.js           # (임시) 학년 로직 실험 코드
```

### 외부 라이브러리 (CDN)

| 라이브러리 | 용도 |
|-----------|------|
| Tailwind CSS | UI 스타일링 |
| SheetJS (XLSX v0.18.5) | 엑셀 파일 처리 |
| Chart.js | 통계 차트 |
| QRCode.js | QR코드 생성 |
| html2canvas | 스크린샷/PDF 내보내기 |
| Google Fonts (Noto Sans KR, Outfit) | 폰트 |

---

## 3. DB 스키마 (Google Sheets)

Google Sheets를 DB로 사용하며, 시트 이름이 테이블 역할을 합니다. GAS `setup()` 함수로 초기 생성됩니다.

### 3-1. Config (교육과정 편제표)

교과목 마스터 데이터. 학교별 개설 과목 정보.

| 컬럼 | 타입 | 설명 | 예시 |
|------|------|------|------|
| `과목명` | string | 한글 과목명 | `문학` |
| `영문ID` | string (slug) | 고유 식별자 | `munhag` |
| `학년` | int | 개설 학년 | `2` |
| `학기` | int | 개설 학기 | `1` |
| `학점` | int | 이수 학점 | `4` |
| `교과군` | string | 대분류 카테고리 | `기초교과`, `탐구교과`, `예술교과`, `교양교과` |
| `세부교과` | string | 소분류 | `국어`, `수학`, `영어`, `사회`, `과학` 등 |
| `필수여부` | boolean(string) | 필수 과목 여부 | `TRUE` / `FALSE` |
| `개설여부` | boolean(string) | 해당 학기 개설 여부 | `TRUE` / `FALSE` |
| `선수과목` | string | 선이수 과목 (slug, 콤마 구분) | `korean1, korean2` |

### 3-2. Registry (학적부)

학생 목록 + 인증용 코드. 엑셀 업로드 또는 관리자가 등록.

| 컬럼 | 타입 | 설명 | 예시 |
|------|------|------|------|
| `학번` | string(5자리) | 학년+반+번호 | `20513` |
| `이름` | string | 학생 이름 | `홍길동` |
| `학생코드` | string(10자리) | 자동 생성된 인증 코드 (A-Z, 0-9) | `X7KD9M2FP1` |

> **학생코드 생성 규칙**: 10자리 영문 대문자 + 숫자. `crypto.getRandomValues` 사용. 기존 코드가 있으면 보존, 없으면 자동 생성. 중복 체크 포함.

### 3-3. Responses (수강신청 결과)

학생이 제출한 수강신청 데이터.

| 컬럼 | 타입 | 설명 | 예시 |
|------|------|------|------|
| `Timestamp` | Date | 제출 시각 (서버 자동) | `2026-04-14T09:00:00` |
| `Grade` | string | 학년 | `2` |
| `Class` | string | 반 | `05` |
| `Number` | string | 번호 | `13` |
| `Name` | string | 이름 | `홍길동` |
| `Major` | string | 희망 진로 | `컴퓨터공학` |
| `SelectedCourses` | string | 선택 과목 목록 (콤마 구분) | `문학, 미적분, 물리학Ⅰ` |
| `JointCourses` | string | 공동교육과정 과목 (콤마 구분) | `심화수학, AI기초` |
| `TotalCredits` | int | 총 신청 학점 | `176` |
| `ValidationResult` | string | 검증 결과 텍스트 | `모든 검증을 통과하였습니다.` |
| `AiRecommendation` | string | AI 추천 결과 텍스트 | (AI 응답 전문) |

### 3-4. Settings (설정)

A1 셀에 JSON 문자열 하나로 저장되는 애플리케이션 전역 설정.

```jsonc
{
  "schoolName": "OO고등학교",
  "requireStudentGate": true,          // 학생 인증 게이트 활성화
  "allowMultiSemesterDuplicate": false, // 동일 과목 다학기 중복 허용
  "duplicateCourseSlugs": [],           // 중복 허용 과목 슬러그 목록
  "selectionRules": {                   // 학기별 선택 제한
    "2-1": [{ "credits": 4, "count": 3 }, { "credits": 2, "count": 1 }],
    "2-2": [{ "credits": 4, "count": 3 }],
    "3-1": [{ "credits": "all", "count": 5 }]
  },
  "multiSemesterRules": {},             // 다학기 연결 규칙
  "jointCurriculum": { ... }            // 공동교육과정 관련 설정
}
```

### 3-5. JointCurriculum (공동교육과정)

거점학교 간 공유 과목 목록.

| 컬럼 | 타입 | 설명 | 예시 |
|------|------|------|------|
| `분류` | string | 분류 태그 | `이공` |
| `거점학교` | string | 개설 학교 | `OO고` |
| `과목명` | string | 과목명 | `심화수학` |
| `slug` | string | 고유 식별자 | `simhwasuhak` |
| `세부교과` | string | 교과 분류 | `수학` |
| `교과편제` | string | 과정 유형 | `진로`, `융합`, `일반` |
| `학년` | int | 대상 학년 | `2` |
| `학기` | int | 개설 학기 | `1` |
| `학점` | int | 이수 학점 | `4` |
| `운영일시` | string | 수업 시간 | `화요일 7교시` |
| `선이수과목` | string | 선이수 조건 | `수학I, 수학II` |

---

## 4. API 엔드포인트

### 4-1. Google Apps Script (백엔드 REST API)

GAS Web App URL 하나로 GET/POST를 `action` 파라미터로 라우팅.

#### GET 엔드포인트

| action | 설명 | 응답 |
|--------|------|------|
| `getConfig` | 교육과정 편제표 조회 | `Array<Config Row>` |
| `getRegistry` | 학적부 조회 | `Array<Registry Row>` |
| `getResponses` | 수강신청 결과 조회 | `Array<Response Row>` |
| `getSettings` | 설정 JSON 조회 | `Object (Settings)` |
| `getJointCurriculum` | 공동교육과정 목록 조회 | `Array<JointCurriculum Row>` |

**호출 방식**: `GET {GAS_URL}?action={action}`

#### POST 엔드포인트

| action | 설명 | 요청 body.data | 응답 |
|--------|------|---------------|------|
| `saveConfig` | 편제표 전체 덮어쓰기 | `Array<Config Row>` | `{ status: 'success' }` |
| `saveRegistry` | 학적부 저장 (코드 자동생성) | `Array<Registry Row>` | `{ status: 'success' }` |
| `submitResponse` | 수강신청 1건 추가 (append) | `Response Row` | `{ status: 'success' }` |
| `saveSettings` | 설정 JSON 덮어쓰기 | `Object (Settings)` | `{ status: 'success' }` |
| `saveJointCurriculum` | 공동교육과정 덮어쓰기 | `Array<JointCurriculum Row>` | `{ status: 'success' }` |
| `verifyStudent` | 학생 인증 (3-factor) | `{ studentCode, studentId, name }` | `{ status, student? }` |

**호출 방식**: `POST {GAS_URL}` with `Content-Type: text/plain;charset=utf-8`
```json
{ "action": "saveConfig", "data": [...] }
```

> **특이사항**: GAS Web App은 CORS 제약으로 `Content-Type: text/plain` 사용. `redirect: 'follow'` 필수.

#### 학생 인증 (verifyStudent) 상세

- **입력**: 학생코드(10자리) + 학번(5자리) + 이름
- **검증**: Registry 시트에서 3개 값 모두 일치하는 행 탐색
- **정규화**: 코드→대문자+영숫자만, 학번→공백제거, 이름→trim+중복공백 정리
- **응답 성공**: `{ status: 'success', student: { 학번, 이름 } }`
- **응답 실패**: `{ status: 'error', message: '...' }`

### 4-2. Netlify Functions (서버리스)

#### `POST /.netlify/functions/ai-recommendation`

OpenAI GPT-4o 기반 과목 추천.

**요청 body**:
```json
{
  "major": "컴퓨터공학",
  "availableCourses": "문학, 미적분, 물리학Ⅰ, ...",
  "mode": "admin",                    // 'admin' | undefined(학생)
  "jointCurriculum": [...]            // admin 모드 전용
}
```

**모드별 응답**:

| 모드 | 응답 형식 |
|------|----------|
| 학생 (기본) | 평문 텍스트 — 7개 추천 과목 + 사유 |
| admin | JSON `{ balancedRecommendations[], advancedRecommendations[], subjects[], keywords[], activities[] }` |

- `balancedRecommendations`: 균형 추천 3개 `{ subject, reason }`
- `advancedRecommendations`: 심화(공동교육과정) 추천 3개 `{ subject, reason }`
- `subjects`: 정규 교육과정 추천 5-7개 `"과목명: 사유"`
- `keywords`: 학생부 기재용 키워드 5개
- `activities`: 탐구 활동 3개

**환경변수**: `OPENAI_API_KEY`

#### `POST /.netlify/functions/careernet-recommendation`

Career.net 진로 정보 연동 (API 미설정 시 Mock 응답).

**요청 body**:
```json
{
  "major": "간호사",
  "keyword": "간호",
  "schoolCourses": [...]
}
```

**응답**:
```json
{
  "source": "mock" | "api" | "error",
  "subjects": [{ "name": "생명과학Ⅰ", "reason": "의·약·생명 계열 기초" }],
  "message": "..."
}
```

**Mock 카테고리**: 간호/의료, 법/행정/인문, 예술/디자인/음악/미술, 이공 계열(기본)

**환경변수**: `CAREERNET_API_BASE_URL`, `CAREERNET_API_KEY`, `CAREERNET_API_PATH`

---

## 5. 프론트엔드 구조

### 5-1. 학생 페이지 (`index.html`)

단일 HTML 파일, SPA 패턴. 전역 상태를 스크립트 변수로 관리.

#### 화면 흐름

```
[학생 인증 게이트] → [메인 화면]
      │                    ├── 학생 정보 입력 (학번, 이름, 희망 진로)
      │                    ├── 학기별 과목 선택 (체크박스)
      │                    ├── 공동교육과정 수기 추가
      │                    ├── AI 추천 + Career.net 연동
      │                    ├── 실시간 검증 결과
      │                    ├── 선택 과목 목록 + 학점 합계
      │                    └── [제출 모달] → 최종 확인 → 제출
```

#### 전역 상태

| 변수 | 타입 | 설명 |
|------|------|------|
| `PROCESSED_COURSES` | `Array<Object>` | 가공된 개설 과목 목록 (Config → 프론트 정규화) |
| `jointCourses` | `Array<Object>` | 학생이 추가한 공동교육과정 과목 |
| `selectionRules` | `Object` | 학기별 선택 제한 규칙 (`Settings`에서 로드) |
| `studentSessionVerified` | `boolean` | 학생 인증 완료 여부 |
| `requiresStudentGate` | `boolean` | 인증 게이트 활성화 여부 (`Settings`에서 로드) |

#### 주요 함수

| 함수 | 역할 |
|------|------|
| `init()` | API URL 로드 → 설정/편제표/학적 로드 → 렌더링 |
| `loadData()` | Config + Settings + Registry 를 GAS에서 fetch |
| `renderCourses()` | 학기별 과목 목록 렌더링 (체크박스 + 학점 표시) |
| `getSelected()` | 체크된 과목 ID → 과목 객체 배열 반환 |
| `validateSelections()` | `Validation.validate()` 호출 → 결과 UI 반영 |
| `validateSelectionRules(selected)` | 학기별 개수/학점 제한 추가 검증 |
| `applyLimits()` | 학기별 선택 수 초과 시 체크박스 비활성화 |
| `renderSelectedCourses()` | 선택된 과목 목록 UI 업데이트 |
| `openSubmitModal()` | 제출 전 최종 확인 모달 |
| `runCombinedRecommendation()` | AI + Career.net 추천 동시 실행 → 로드맵 표시 |
| `bindLoginGateHandlers()` | 학생 인증 게이트 이벤트 바인딩 |

#### 핵심 DOM 요소

| ID | 역할 |
|----|------|
| `student-login-gate` | 인증 모달 오버레이 |
| `course-list-container` | 학기별 과목 체크박스 영역 |
| `selected-courses-list` | 선택된 과목 목록 |
| `total-credits` | 총 학점 표시 |
| `validation-messages` | 검증 결과 메시지 |
| `ai-helper-content` | AI 추천 결과 영역 |
| `joint-course-list` | 공동교육과정 목록 |
| `submit-modal` | 제출 확인 모달 |

### 5-2. 관리자 페이지 (`admin.html`)

탭 기반 SPA. `switchTab(tabName)` 함수로 탭 전환.

#### 탭 구성

| 탭 ID | 이름 | 설명 |
|-------|------|------|
| `tab-system` | 시스템 설정 | API URL, 학교명, 인증 게이트 on/off |
| `tab-courses` | 교육과정 관리 | 엑셀 업로드/다운로드, 편제표 미리보기 |
| `tab-rules` | 선택 규칙 | 학기별 과목 수/학점 제한, 다학기 연결 규칙 |
| `tab-share` | 배포 및 공유 | 학생 페이지 URL, QR코드 생성, 학적 관리 |
| `tab-bulk` | 일괄 등록 | 수강신청 일괄 업로드 (엑셀) |
| `tab-dashboard` | 대시보드 | 제출 현황, 학생별 리포트, 반 통계, AI 분석 |

#### 대시보드 주요 기능

| 기능 | 함수 | 설명 |
|------|------|------|
| 제출 현황 | `loadStudentData()` | Responses 시트 조회 → 테이블 렌더링 |
| 학생 리포트 | `renderDetailedStudentReport(s)` | 개별 학생 상세: 학점 분포 차트, 과목 목록, 검증 결과, AI 추천 |
| 반 통계 | `renderClassStatsDashboard()` | 반별 과목 선택 통계, 진로 적합도 차트 |
| 과목별 통계 | `renderClassSubjectStats()` | 과목별 선택 인원 수, 학년별 분포 |
| 진로 적합도 | `analyzeClassCareerSuitability()` | 학생별 선택 과목 vs AI 추천 과목 매칭 점수 |
| 검증 통계 | `renderValidationStats()` | 학급 내 검증 통과/미통과 비율 |
| 인쇄 | `html2canvas` | 리포트카드 이미지/PDF 내보내기 |

#### 주요 전역 함수 (admin)

| 함수 | 역할 |
|------|------|
| `switchTab(tabName)` | 탭 전환 (6개 탭) |
| `loadConfig()` | 편제표 로드 + 미리보기 테이블 렌더 |
| `loadCourseCount()` | 개설 과목 수 카운트 표시 |
| `loadRulesAndClassification()` | 학기별 선택 규칙 UI 렌더 |
| `saveMultiRules()` | 다학기 규칙 저장 |
| `updateShareLink()` | 학생 페이지 URL 생성 |
| `renderRegistryCodesPanel()` | 학생 코드 목록 + 복사/CSV 내보내기 |
| `runBulkEnrollmentUpload()` | 엑셀 일괄 등록 → Responses에 append |
| `updateDashboardCounts()` | 대시보드 요약 숫자 갱신 |
| `getAiRecommendations(major)` | admin 모드 AI 추천 호출 |
| `fetchAiCareerAnalysis(major, ...)` | 진로 분석 AI 호출 |

---

## 6. JS 모듈 상세

### 6-1. `db.js` — DB 객체

GAS API와 통신하는 싱글턴 래퍼. `window.DB`로 전역 노출.

| 메서드 | HTTP | action | 설명 |
|--------|------|--------|------|
| `init(url)` | - | - | API URL 설정 |
| `isConfigured()` | - | - | URL 설정 여부 |
| `fetchConfig()` | GET | `getConfig` | 편제표 조회 |
| `saveConfig(courses)` | POST | `saveConfig` | 편제표 저장 |
| `fetchSettings()` | GET | `getSettings` | 설정 조회 |
| `saveSettings(settings)` | POST | `saveSettings` | 설정 저장 |
| `fetchResponses()` | GET | `getResponses` | 수강신청 결과 조회 |
| `submitResponse(data)` | POST | `submitResponse` | 수강신청 제출 |
| `deleteResponse(ids)` | POST | `deleteResponse` | 응답 삭제 |
| `fetchRegistry()` | GET | `getRegistry` | 학적부 조회 |
| `saveRegistry(registry)` | POST | `saveRegistry` | 학적부 저장 |
| `fetchJointCurriculum()` | GET | `getJointCurriculum` | 공동교육과정 조회 |
| `saveJointCurriculum(data)` | POST | `saveJointCurriculum` | 공동교육과정 저장 |
| `verifyStudent({ studentCode, studentId, name })` | POST | `verifyStudent` | 학생 인증 |

### 6-2. `validation.js` — 검증 엔진

`window.Validation.validate(selectedCourses, jointCourses, limits)` → `{ valid, messages[], type }`

| 검증 항목 | 기준 | 에러 메시지 |
|-----------|------|------------|
| 총 학점 | ≥ 174 | `총 이수 학점(174)이 부족합니다.` |
| 기초교과 비율 | ≤ 50% | `기초교과 이수 단위가 50% 초과` |
| 예술교과 | ≥ 10학점 | `예술교과 이수 학점(10) 부족` |
| 교양교과 | ≥ 16학점 | `생활·교양 교과군 필수 이수 학점(16) 부족` |
| 선수과목 | 선이수 과목 포함 여부 | `'X' 수강을 위해 선이수 과목(Y) 필요` |

### 6-3. `roadmap.js` — AI 매칭

| 함수 | 설명 |
|------|------|
| `normalizeSubjectToken(s)` | 괄호/공백/특수문자 제거 + 소문자 정규화 |
| `matchRecommendedToCourses(hints, courses)` | AI 추천 과목명 → 개설 과목 매칭 (100/80/50점 스코어링) |
| `parseAiSubjectLines(aiText)` | AI 텍스트 응답에서 과목명 추출 (콜론 앞 텍스트) |
| `groupCoursesBySemester(courses)` | 학년-학기별 그룹핑 |
| `summarizeSelectionRules(rules)` | 학기별 선택 규칙 텍스트 요약 |

### 6-4. `excel-handler.js` — 엑셀 처리

| 함수 | 설명 |
|------|------|
| `readExcel(file)` | 엑셀 → JSON 배열 |
| `readExcelRaw(file)` | 엑셀 → 2차원 배열 (헤더 포함) |
| `downloadExcel(data, fileName, sheetName)` | JSON → 엑셀 다운로드 |
| `downloadTemplate()` | 교육과정 편제표 양식 다운로드 |
| `downloadRegistryTemplate()` | 학적부 양식 다운로드 |
| `downloadJointCurriculumTemplate()` | 공동교육과정 양식 다운로드 |
| `downloadBulkEnrollmentTemplate(courses)` | 수강신청 일괄등록 양식 다운로드 |

### 6-5. `theme.js` — 테마 관리

4종 테마, CSS 커스텀 프로퍼티로 전환. `localStorage`에 저장.

| 테마 | 키 |
|------|-----|
| 라이트 | `light` |
| 다크 네온 | `dark-neon` |
| 도쿄 나이트 | `tokyo-night` |
| 솔라라이즈드 라이트 | `solarized-light` |

CSS 변수: `--bg-color`, `--text-color`, `--text-muted`, `--card-bg`, `--border-color`, `--primary-color`, `--secondary-color`, `--input-bg`, `--hover-bg`

### 6-6. `student-code.js` — 학생코드

| 함수 | 설명 |
|------|------|
| `normalizeStudentCodeInput(str)` | 입력 정규화 (대문자 + 영숫자만) |
| `generateStudentCode()` | 10자리 랜덤 코드 생성 (`crypto.getRandomValues`) |
| `generateUniqueStudentCode(usedSet)` | 중복 방지 코드 생성 (최대 5000회 재시도) |

---

## 7. 데이터 흐름

### 학생 수강신청 흐름

```
1. 학생 → index.html 접속
2. [인증 게이트] studentCode(10자리) + 학번(5자리) + 이름
   → DB.verifyStudent() → GAS verifyStudent() → Registry 시트 대조
3. 인증 성공 → 학번/이름 잠금, 희망 진로만 입력
4. Config 로드 → 학기별 과목 체크박스 렌더
5. 과목 선택 → 실시간 학점 계산 + 검증 (Validation.validate)
6. (선택) AI 추천 → Netlify Function → OpenAI GPT-4o
7. (선택) 공동교육과정 수기 추가
8. 제출 → DB.submitResponse() → GAS → Responses 시트에 append
```

### 관리자 운영 흐름

```
1. admin.html → 시스템 설정 탭: GAS URL 입력
2. 교육과정 관리: 엑셀 업로드 → DB.saveConfig()
3. 학적 관리: 엑셀 업로드 → DB.saveRegistry() (코드 자동 생성)
4. 선택 규칙 설정 → DB.saveSettings()
5. 배포: 학생 페이지 URL + QR코드 생성/배포
6. 대시보드: DB.fetchResponses() → 테이블/차트/리포트
7. AI 분석: 학생별 진로 적합도 분석
```

---

## 8. 환경변수

| 변수 | 위치 | 설명 |
|------|------|------|
| `OPENAI_API_KEY` | Netlify | OpenAI API 키 (필수: AI 추천) |
| `CAREERNET_API_BASE_URL` | Netlify | Career.net API URL (선택) |
| `CAREERNET_API_KEY` | Netlify | Career.net API 키 (선택) |
| `CAREERNET_API_PATH` | Netlify | Career.net 경로 (기본: `/recommend`) |

---

## 9. 보안 & 제약사항

- 학생 인증: 3-factor (코드 + 학번 + 이름), 서버 사이드 검증
- GAS는 CORS 제한 → `Content-Type: text/plain` + `redirect: follow`
- 모든 저장 작업은 시트 전체 덮어쓰기 (`sheet.clear()` → 재작성), Responses만 append 방식
- 클라이언트 + 서버 양쪽에서 입력 정규화 (공백, 대소문자, 특수문자)
- AI 호출은 `temperature: 0.3`으로 일관성 유지
