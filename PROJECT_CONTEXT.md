# PROJECT_CONTEXT — 고교학점제 수강신청 도우미

> 최종 갱신: 2026-05-25
>
> 빠른 사용 가이드는 [`README.md`](./README.md), 본 문서는 DB 스키마 · API · 검증 규칙 · 보안 정책 등 상세 명세입니다.

---

## 1. 프로젝트 개요

고교학점제(Credit-Based High School System) 도입에 맞춰 **학생 수강신청**과 **교사/관리자 교육과정 관리**를 지원하는 웹 애플리케이션. 학교마다 별도 서버를 운영할 필요 없이 학교별 Google Sheets를 DB로 사용.

| 항목 | 내용 |
|------|------|
| 프론트엔드 | React 18 + Vite 6 + Tailwind CSS 4 (SPA, React Router v6) |
| 빌드 진입점 | `index.react.html` |
| 백엔드(데이터) | 학교별 Google Apps Script Web App (`google-apps-script.gs`) |
| 백엔드(라우터) | 운영자용 Google Apps Script Web App (`google-apps-script-router.gs`) |
| DB | Google Sheets — 학교별 시트 6개(`Config_G1~3`, `Config`, `Registry`, `Responses`, `Settings`, `JointCurriculum`) + 라우터 시트 1개(`Mappings`) |
| Serverless | Netlify Functions (AI 추천 · Career.net 연동) |
| AI | OpenAI GPT-4o, Career.net API (Mock 폴백) |
| 배포 | Netlify (정적 파일 + Functions) |

---

## 2. 파일 구조

```
curriculum-management/
├── index.react.html              # 빌드 진입점 (React 마운트)
├── manifest.json                 # PWA 매니페스트
├── icon-app.svg
├── package.json / vite.config.js / netlify.toml / tailwind.config.js
│
├── src/
│   ├── main.jsx                  # React 진입점
│   ├── App.jsx                   # 라우트 정의
│   ├── index.css                 # Tailwind 진입 CSS
│   ├── pages/
│   │   ├── LoginPage.jsx         # 학생 인증 게이트(학번+학생코드)
│   │   ├── CoursesPage.jsx       # 학기별 과목 선택
│   │   ├── CreditsPage.jsx       # 학점 현황·검증
│   │   ├── CareerPage.jsx        # 진로 기반 추천
│   │   ├── AiRecommendPage.jsx   # AI 과목 추천
│   │   ├── ProfilePage.jsx       # 학생 정보·제출
│   │   └── AdminPage.jsx         # 관리자 대시보드 (탭 6종)
│   ├── components/
│   │   ├── AdminLogin.jsx        # Google ID 토큰 로그인 + 라우터 매핑
│   │   ├── Header.jsx / Sidebar.jsx / MobileNav.jsx
│   │   ├── CourseCard.jsx / GaugeChart.jsx / StatCard.jsx
│   └── api/
│       ├── db.js                 # 학교 데이터 GAS 래퍼 (소유자별 URL 격리)
│       ├── router.js             # 라우터 GAS 호출 (이메일↔apiUrl 매핑)
│       ├── student.js            # 학생 세션(학번만 보관)
│       ├── careernet.js          # Career.net Function 래퍼
│       └── excel.js              # SheetJS 래퍼 (업·다운로드)
│
├── netlify/
│   └── functions/
│       ├── ai-recommendation.js          # OpenAI GPT-4o 호출 (학생/admin 두 모드)
│       └── careernet-recommendation.js   # Career.net 호출 (또는 Mock)
│
├── google-apps-script.gs                 # 학교별 데이터 GAS (430+줄)
├── google-apps-script-router.gs          # 운영자용 라우터 GAS
│
├── design-refs/                          # 디자인 시안 PNG
└── README.md / PROJECT_CONTEXT.md
```

### 외부 라이브러리

| 라이브러리 | 용도 |
|-----------|------|
| React 18 / React Router 6 | UI 프레임워크 / SPA 라우팅 |
| Vite 6 / @vitejs/plugin-react | 번들러 / 개발 서버 |
| Tailwind CSS 4 / @tailwindcss/vite | 스타일링 |
| xlsx (SheetJS 0.18.x) | 엑셀 업·다운로드 |
| jspdf | PDF 내보내기 |

---

## 3. DB 스키마 (Google Sheets)

시트 이름이 테이블 역할. 학교별 GAS의 `setup()` 함수가 초기 생성.

### 3-1. `Config_G1` / `Config_G2` / `Config_G3` (코호트별 편제표)

해당 학년(코호트) 학생들이 6학기 전체에 걸쳐 이수할 과목 마스터.

| 컬럼 | 타입 | 설명 | 예시 |
|------|------|------|------|
| `과목명` | string | 한글 과목명 | `문학` |
| `영문ID` | string | 고유 식별자 | `munhag` |
| `학년` | int | 개설 학년 | `2` |
| `학기` | int | 개설 학기 | `1` |
| `학점` | int | 이수 학점 | `4` |
| `교과군` | string | 대분류 | `기초교과`, `탐구교과`, `예술교과`, `교양교과` |
| `세부교과` | string | 소분류 | `국어`, `수학`, `영어`, `사회`, `과학` 등 |
| `필수여부` | bool(string) | `TRUE`/`FALSE` | |
| `개설여부` | bool(string) | `TRUE`/`FALSE` | |
| `선수과목` | string | slug 콤마 구분 | `korean1, korean2` |

> 단일 `Config` 시트는 구버전 호환용으로 유지(`cohort` 파라미터 미지정 시 사용).

### 3-2. `Registry` (학적부)

학생 인증용 최소 정보. **개인정보 보호상 이름은 저장하지 않음.**

| 컬럼 | 타입 | 설명 | 예시 |
|------|------|------|------|
| `학번` | string(5자리) | 학년+반+번호 | `20513` |
| `학생코드` | string(10자리) | 자동 생성 (A-Z, 0-9) | `X7KD9M2FP1` |

**학생코드 발급 규칙**: 10자리 영문 대문자 + 숫자. 기존 코드가 있으면 보존, 없으면 자동 생성. 업로드 단위 충돌 방지 + 최대 1000회 재시도 제한.

### 3-3. `Responses` (수강신청 결과)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `Timestamp` | Date | 제출 시각 (서버 자동) |
| `Grade` / `Class` / `Number` | string | 학년 / 반 / 번호 |
| `Major` | string | 희망 진로 |
| `SelectedCourses` | string | 콤마 구분 |
| `JointCourses` | string | 공동교육과정 과목 (콤마 구분) |
| `TotalCredits` | int | 총 신청 학점 |
| `ValidationResult` | string | 검증 결과 텍스트 |
| `AiRecommendation` | string | AI 추천 결과 텍스트 |

> 이름 컬럼은 저장하지 않음(학번으로만 식별).

### 3-4. `Settings`

A1 셀에 단일 JSON 문자열로 저장되는 전역 설정.

```jsonc
{
  "schoolName": "OO고등학교",
  "requireStudentGate": true,
  "allowMultiSemesterDuplicate": false,
  "duplicateCourseSlugs": [],
  "selectionRules": {
    "2-1": [{ "credits": 4, "count": 3 }, { "credits": 2, "count": 1 }],
    "2-2": [{ "credits": 4, "count": 3 }],
    "3-1": [{ "credits": "all", "count": 5 }]
  },
  "multiSemesterRules": {},
  "jointCurriculum": { ... }
}
```

### 3-5. `JointCurriculum` (공동교육과정)

| 컬럼 | 예시 |
|------|------|
| `분류` / `거점학교` / `과목명` / `slug` / `세부교과` / `교과편제` / `학년` / `학기` / `학점` / `운영일시` / `선이수과목` | (생략) |

### 3-6. 라우터 GAS의 `Mappings` 시트

| email | apiUrl | schoolName | updatedAt |
|-------|--------|------------|-----------|
| `admin@school.kr` (소문자) | 학교 GAS Web App URL | (선택) | 마지막 갱신 시각 |

---

## 4. API

### 4-1. 학교 데이터 GAS (`google-apps-script.gs`)

GAS Web App URL 하나에서 GET/POST를 `action` 파라미터로 라우팅. 모든 POST는 CORS 우회를 위해 `Content-Type: text/plain;charset=utf-8` + `redirect: 'follow'`.

#### GET

| action | 응답 |
|--------|------|
| `getConfig?cohort=1|2|3` | `Array<Config Row>` (cohort 생략 시 단일 Config 시트) |
| `getRegistry` | `Array<{ 학번, 학생코드, … }>` |
| `getResponses` | `Array<Response Row>` |
| `getSettings` | `Object` (Settings JSON) |
| `getJointCurriculum` | `Array<JointCurriculum Row>` |
| `getRegisteredCohorts` | `[{ cohort, count }, ...]` (편제표 등록된 학년 목록) |

#### POST

| action | body.data | 응답 |
|--------|-----------|------|
| `saveConfig` | `{ cohort, rows }` 또는 `Array<Config Row>` (호환) | `{ status, count?, sheet? }` |
| `saveRegistry` | `Array<{ 학번, 학생코드? }>` (코드 없으면 자동 발급) | `{ status, count }` |
| `submitResponse` | `Response Row` (append) | `{ status }` |
| `saveSettings` | `Object` (Settings) | `{ status }` |
| `saveJointCurriculum` | `Array<JointCurriculum Row>` | `{ status }` |
| `verifyStudent` | `{ studentCode, studentId }` | `{ status, student? }` |

#### 학생 인증(`verifyStudent`)

- **2-factor**: 학생코드(10자리 영숫자) + 학번(5자리). 이름은 개인정보라 받지 않음.
- 정규화: 코드 → 대문자 + 영숫자만, 학번 → 공백 제거.
- 응답 성공: `{ status: 'success', student: { 학번 } }`.
- 응답 실패: `{ status: 'error', message: '…' }`.

#### 동시성 보호

`saveConfig` / `saveRegistry` / `saveSettings` / `saveJointCurriculum` / `submitResponse`는 모두 `LockService.getDocumentLock()`로 보호되어 동시 호출 시 직렬화됨. 락 획득 실패(20초 초과) 시 `{ status: 'error' }` 명시 응답.

### 4-2. 라우터 GAS (`google-apps-script-router.gs`)

운영자가 1회 셋업. 학교 관리자 이메일 → 학교 GAS URL을 매핑하여 멀티 테넌트 지원.

| action | method | body | 설명 |
|--------|--------|------|------|
| `getMapping?email=…` | GET | — | 이메일로 매핑 조회 |
| `setMapping` | POST | `{ idToken, apiUrl, schoolName? }` | Google ID 토큰 검증 후 자기 이메일에만 매핑 작성/갱신 |
| `deleteMapping` | POST | `{ idToken }` | 자기 이메일 매핑 삭제 |

**토큰 검증 규칙**:
- `https://oauth2.googleapis.com/tokeninfo`로 검증.
- `email_verified`, `aud`(=`EXPECTED_AUDIENCE` 스크립트 속성), `exp`(만료) 모두 체크.
- `EXPECTED_AUDIENCE` 미설정 시 모든 매핑 변경 요청 거부 (다른 앱 토큰 재사용 차단).

### 4-3. Netlify Functions

#### `POST /.netlify/functions/ai-recommendation`

OpenAI GPT-4o 기반 과목 추천. 학생 모드(평문)와 admin 모드(JSON) 두 가지.

- **입력 검증/캡**: `major` 200자, `availableCourses` 10,000자, `jointCurriculum` 200항목 · 각 필드 200자. 제어문자 제거.
- **CORS**: `Access-Control-Allow-Origin: *` + `OPTIONS` preflight 204 응답.

요청 body:
```json
{
  "major": "컴퓨터공학",
  "availableCourses": "문학, 미적분, 물리학Ⅰ, ...",
  "mode": "admin",
  "jointCurriculum": [...]
}
```

응답:

| 모드 | 형식 |
|------|------|
| 학생(기본) | 평문 텍스트 — 7개 추천 과목 + 사유 |
| `admin` | `{ balancedRecommendations[], advancedRecommendations[], subjects[], keywords[], activities[] }` |

#### `POST /.netlify/functions/careernet-recommendation`

Career.net 진로 정보 연동. `CAREERNET_API_BASE_URL` + `CAREERNET_API_KEY`가 없으면 Mock(키워드별 샘플 과목) 반환. 마찬가지로 CORS / OPTIONS 지원.

---

## 5. 프론트엔드 구조

### 5-1. 라우팅 (`src/App.jsx`)

| 경로 | 컴포넌트 | 설명 |
|------|---------|------|
| `/` | `LoginPage` | 학생 인증 게이트 |
| `/courses` | `CoursesPage` | 학기별 과목 선택 |
| `/credits` | `CreditsPage` | 학점 현황·검증 |
| `/career` | `CareerPage` | 진로 기반 추천 |
| `/ai` | `AiRecommendPage` | AI 추천 |
| `/profile` | `ProfilePage` | 학생 정보·제출 |
| `/admin` | `AdminPage` | 관리자 대시보드 (탭 6종) |

### 5-2. 학생 세션 (`src/api/student.js`)

- `localStorage` 키 `verifiedStudent` 에 `{ 학번 }` 만 저장.
- `sessionStorage`와 미러링하여 기존 코드 호환 유지.

### 5-3. API 래퍼 / 멀티 테넌트 격리 (`src/api/db.js`)

- 학생용 키: `gas_api_url`
- 관리자용 키: `gas_api_url:{email}` (같은 컴퓨터에서 여러 관리자가 로그인해도 시트가 섞이지 않음)
- 관리자가 Google 로그인하면 `router.js` 가 라우터 GAS에서 매핑을 조회해 `gas_api_url:{email}` 을 자동 복원.

### 5-4. 관리자 페이지 탭

| 탭 ID | 이름 | 주요 기능 |
|-------|------|----------|
| `tab-system` | 시스템 설정 | API URL, 학교명, 인증 게이트 on/off |
| `tab-courses` | 교육과정 관리 | 코호트별 편제표 엑셀 업·다운로드 / 미리보기 |
| `tab-rules` | 선택 규칙 | 학기별 과목 수·학점 제한, 다학기 연결 규칙 |
| `tab-share` | 배포 및 공유 | 학생 페이지 URL, QR, 학적 관리(코드 자동 발급) |
| `tab-bulk` | 일괄 등록 | 수강신청 엑셀 일괄 업로드 |
| `tab-dashboard` | 대시보드 | 제출 현황, 학생 리포트, 반 통계, AI 진로 적합도 분석 |

---

## 6. 데이터 흐름

### 학생 수강신청
```
LoginPage    ── verifyStudent(코드+학번) ─→ GAS(Registry) ─→ { status, student }
CoursesPage  ─ fetchConfig(cohort) ─→ GAS(Config_GN)
             ─ fetchSettings() ─→ GAS(Settings.A1 JSON)
             ─ 체크박스 변경 시 클라이언트 Validation 실행
ProfilePage  ─ submitResponse(payload) ─→ GAS(Responses append)
```

### 관리자 운영
```
AdminPage(Google 로그인) ─ router.getMapping(email) ─→ apiUrl 자동 복원
                         ─ router.setMapping(idToken, apiUrl) ─→ 첫 등록
편제표 업로드 ─ excel.read() → saveConfig({ cohort, rows })
학적 업로드 ─→ saveRegistry(rows)  # GAS에서 학생코드 자동 발급
규칙 저장 ─→ saveSettings(json)
대시보드 ─→ fetchResponses() → 차트/리포트 렌더링
```

### AI 추천 (브라우저는 API 키를 보지 못함)
```
브라우저 ─ POST /.netlify/functions/ai-recommendation ─→ Netlify Function
                                                       │ OPENAI_API_KEY 사용
                                                       ↓
                                                    OpenAI GPT-4o
                                                       ↓
                       학생 모드: 평문 추천 / admin 모드: JSON
```

---

## 7. 검증 규칙 (요약)

| 항목 | 기준 |
|------|------|
| 총 이수 학점 | ≥ 174 |
| 기초교과 비율 | ≤ 50% |
| 예술교과 | ≥ 10학점 |
| 생활·교양 교과군 | ≥ 16학점 |
| 선수과목 | 선이수 미충족 시 차단 |
| 학기별 제한 | `Settings.selectionRules`의 (학점, 개수) 조합 |

상세 코드는 `src/pages/CreditsPage.jsx` 및 `src/pages/CoursesPage.jsx`의 검증 로직 참고.

---

## 8. 환경변수

| 변수 | 위치 | 필수 | 설명 |
|------|------|------|------|
| `OPENAI_API_KEY` | Netlify | O | OpenAI API 키 (AI 추천) |
| `VITE_GAS_ROUTER_URL` | Netlify (빌드 시 주입) | O(멀티테넌트 사용 시) | 라우터 GAS Web App URL |
| `CAREERNET_API_BASE_URL` | Netlify | X | 미설정 시 Mock |
| `CAREERNET_API_KEY` | Netlify | X | 〃 |
| `CAREERNET_API_PATH` | Netlify | X | 기본값 `/recommend` |
| `EXPECTED_AUDIENCE` | 라우터 GAS 스크립트 속성 | O | Google OAuth Client ID. 미설정 시 모든 매핑 변경 거부 |

---

## 9. 보안 & 제약사항

- **학생 인증은 2-factor**: 학생코드 + 학번. GAS 서버에서 정규화 후 비교. 이름은 개인정보라 수집·저장·검증 모두 안 함.
- **CORS**: GAS Web App은 CORS 제약상 `text/plain` + `redirect: follow` 조합으로만 통과. Netlify Functions는 `Access-Control-Allow-*` 헤더 + `OPTIONS` preflight 처리.
- **시트 쓰기 직렬화**: 모든 save 액션과 submitResponse가 `LockService.getDocumentLock()`로 보호되어 동시 호출 시 race condition·데이터 손실을 차단.
- **저장 정책**: `Responses` 시트만 append, 나머지는 락 보호 하에 시트 전체 덮어쓰기(`sheet.clear()` → 재작성).
- **관리자 라우터 보안**: Google ID 토큰을 tokeninfo로 검증 + `email_verified` + `aud`(=`EXPECTED_AUDIENCE`) + `exp` 모두 확인. `EXPECTED_AUDIENCE` 미설정 시 매핑 변경 자체가 거부됨.
- **AI 입력 보호**: `ai-recommendation` Function이 입력 길이·제어문자를 정리하여 prompt injection 표면과 비용 폭증을 동시에 완화.
- **AI 호출 일관성**: `temperature: 0.3`.
- **학생코드 발급**: 충돌 시 재시도하되 1000회 상한 — 학번당 무한 루프 방지.
