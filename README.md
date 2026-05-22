# 고교학점제 수강신청 도우미 (curriculum-management)

고교학점제 도입 학교의 **학생 수강신청**과 **교사·관리자의 교육과정 관리**를 지원하는 웹 애플리케이션입니다. 학교별 Google Sheets를 DB로 사용하므로 학교마다 별도 서버를 운영할 필요가 없습니다.

> 본 README는 빠른 사용 가이드 + 아키텍처 요약입니다. DB 스키마·API 엔드포인트·검증 규칙 등 상세 명세는 [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md)를 참고하세요.

---

## 1. 무엇을 하는 앱인가

| 사용자 | 할 수 있는 일 |
|--------|------------|
| **학생** | 학생코드+학번으로 인증 → 학기별 과목 선택 → 실시간 학점/검증 확인 → AI 진로 추천 → 제출 |
| **교사·교과 담당** | 엑셀로 교육과정 편제표 일괄 업로드, 학기별 선택 규칙(개수·학점) 설정, 공동교육과정 등록 |
| **관리자** | 학적부 업로드(학생코드 자동 발급), 학생 페이지 URL/QR 배포, 제출 현황·반 통계·AI 진로 분석 대시보드 열람 |
| **사이트 운영자** | 라우터 GAS 1회 셋업 → 각 학교 관리자가 Google 계정으로 로그인하면 자기 학교 GAS URL이 자동 매핑됨 |

---

## 2. 아키텍처 한눈에

```
[학생 브라우저]──┐
                 │            ┌─────────────────────────┐
[관리자 브라우저]─┼──HTTPS──→ │ Netlify (정적 + Functions)│
                 │            │  - React SPA (Vite 빌드)  │
                 │            │  - /.netlify/functions/*  │
                 └──Google──→ │  └─ OpenAI / Career.net  │
                   로그인     └──────────┬──────────────┘
                                          │
                              ┌───────────┴──────────────┐
                              │                          │
                       ┌──────▼────────┐         ┌───────▼─────────┐
                       │ 라우터 GAS    │         │ 학교별 데이터 GAS│
                       │ (운영자 1개)  │ ←mapping│ (학교마다 1개)   │
                       │ email→apiUrl  │         │ + Google Sheets │
                       └───────────────┘         └─────────────────┘
```

- **프론트엔드**: React 18 + Vite + Tailwind 4. SPA(React Router). 진입 HTML은 `index.react.html`.
- **백엔드 = Google Apps Script**: 시트 하나 = 테이블 하나. CORS 우회를 위해 모든 POST는 `Content-Type: text/plain` + `redirect: follow`.
- **AI 호출**: 키 보호를 위해 Netlify Functions(`netlify/functions/`)에서만 OpenAI/Career.net을 호출. 브라우저에 키를 노출하지 않습니다.
- **멀티 테넌트**: 라우터 GAS가 `Google 로그인 이메일 → 학교 GAS URL`을 보관. 같은 컴퓨터에서 다른 관리자가 로그인해도 시트가 섞이지 않도록 `gas_api_url:{email}` 형태로 localStorage 키도 분리(`src/api/db.js`).

---

## 3. 빠른 시작 (개발자용)

### 3-1. 로컬 개발

```bash
npm install
npm run dev          # http://localhost:5173 (Vite)
```

빌드 / 미리보기:

```bash
npm run build        # → dist/
npm run preview
```

> `dashboard/` 디렉터리는 별도 실험용 Vite 프로젝트(TypeScript)이며 메인 빌드에는 포함되지 않습니다.

### 3-2. Netlify 배포

`netlify.toml` 설정 그대로 두면 됩니다.

```toml
[build]
  command = "npm run build"
  publish = "dist"

[functions]
  directory = "netlify/functions"

[[redirects]]
  from = "/*"
  to = "/index.react.html"
  status = 200
```

**필수 환경변수** (Netlify Site settings → Environment variables):

| 변수 | 필수 | 설명 |
|------|------|------|
| `OPENAI_API_KEY` | O | AI 과목 추천(GPT-4o) |
| `VITE_GAS_ROUTER_URL` | O | 라우터 GAS Web App URL (멀티 테넌트 사용 시) |
| `CAREERNET_API_BASE_URL` | X | 미설정 시 Career.net은 Mock 응답 |
| `CAREERNET_API_KEY` | X | 〃 |
| `CAREERNET_API_PATH` | X | 기본값 `/recommend` |

---

## 4. 사용 방법

### 4-1. 사이트 운영자 (최초 1회)

1. 새 Google Sheet 생성 (예: "Curriculum Router").
2. **Extensions → Apps Script** 에서 `google-apps-script-router.gs` 내용을 붙여넣고 저장.
3. `setupRouter()` 1회 실행 → `Mappings` 시트 생성 확인.
4. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. 발급된 URL을 Netlify 환경변수 `VITE_GAS_ROUTER_URL`에 등록.

### 4-2. 학교 관리자 (학교당 1회)

1. 학교용 새 Google Sheet 생성 (예: "OO고 수강신청 2026").
2. **Extensions → Apps Script** 에서 `google-apps-script.gs` 내용을 붙여넣고 저장.
3. `setup()` 함수 1회 실행 → `Config`, `Registry`, `Responses`, `Settings`, `JointCurriculum` 시트 자동 생성.
4. **Deploy → New deployment → Web app** (위와 동일한 권한 설정) → URL 발급.
5. 배포된 사이트에서 **관리자 대시보드 → Google 로그인 → 발급받은 GAS URL 등록**.
   - 라우터 GAS에 `이메일 → URL` 매핑이 자동 저장되어, 이후 같은 계정으로 로그인 시 자동 복원됩니다.
6. **교육과정 관리** 탭: 편제표 양식 다운로드 → 작성 → 업로드.
7. **선택 규칙** 탭: 학기별 과목 수/학점 제한 입력.
8. **학적 관리** 탭: 학적부 엑셀 업로드 → 학생코드가 자동 생성됨(10자리 영숫자).
9. **배포 및 공유** 탭: 학생 페이지 URL/QR 배포 + 학생코드 목록 CSV 다운로드.

### 4-3. 학생

1. 관리자가 배포한 URL 접속.
2. 인증 게이트에 **학생코드(10자리) + 학번(5자리) + 이름** 입력.
3. 희망 진로 입력 → 학기별 과목 선택.
4. (선택) AI 추천 받기 → 진로 기반 과목 + 학생부 키워드/탐구활동 제안 확인.
5. (선택) 공동교육과정(거점학교) 과목 추가.
6. 실시간 검증 통과 확인 후 제출.

---

## 5. 코드가 어떻게 동작하는가

### 5-1. 디렉터리 구조 (핵심만)

```
src/
├─ main.jsx               # React 진입점 (index.react.html이 로드)
├─ App.jsx                # React Router 라우트 정의
├─ pages/                 # 화면 단위 컴포넌트
│  ├─ LoginPage.jsx       # 학생 인증 게이트
│  ├─ CoursesPage.jsx     # 학기별 과목 선택
│  ├─ CreditsPage.jsx     # 학점 현황·검증
│  ├─ CareerPage.jsx      # 진로 기반 추천
│  ├─ AiRecommendPage.jsx # AI 과목 추천
│  ├─ ProfilePage.jsx     # 학생 정보·제출
│  └─ AdminPage.jsx       # 관리자 대시보드 (탭 6종)
├─ components/            # 공용 UI (Header/Sidebar/CourseCard 등)
└─ api/
   ├─ db.js               # 학교 데이터 GAS 래퍼 (소유자별 URL 격리)
   ├─ router.js           # 라우터 GAS 호출 (이메일↔apiUrl 매핑)
   ├─ student.js          # 학생 인증·세션
   ├─ careernet.js        # Career.net Function 래퍼
   └─ excel.js            # SheetJS(xlsx) 래퍼 — 업/다운로드

netlify/functions/
├─ ai-recommendation.js        # OpenAI GPT-4o 호출 (학생/admin 두 모드)
└─ careernet-recommendation.js # Career.net 호출 (또는 Mock)

google-apps-script.gs          # 학교별 데이터 GAS — Config/Registry/Responses/Settings/Joint
google-apps-script-router.gs   # 운영자용 라우터 GAS — Mappings 시트
PROJECT_CONTEXT.md             # DB 스키마·API·검증규칙 등 상세 명세
```

레거시 vanilla 버전(`index.html`, `admin.html`, `js/`)은 React 마이그레이션 이전 코드입니다. 현재 Netlify 배포는 `index.react.html`로만 라우팅되며, 레거시 파일은 참고용으로 보존되어 있습니다.

### 5-2. 데이터 흐름

**학생 수강신청**

```
LoginPage  ── verifyStudent(코드+학번) ─→ GAS(Registry 조회) ─→ {status, student}
CoursesPage ─ fetchConfig() ───────────→ GAS(Config 시트)    ─→ 과목 목록
            ─ fetchSettings() ─────────→ GAS(Settings.A1 JSON) → 선택 규칙
            ─ 체크박스 변경 시 클라이언트 Validation 실행
ProfilePage ─ submitResponse(payload) ──→ GAS(Responses append)
```

**관리자 운영**

```
AdminPage(Google 로그인) ─ router.getMapping(email) ─→ apiUrl 자동 복원
                         ─ router.setMapping(idToken, apiUrl) ─→ 첫 등록
편제표 업로드 ─ excel.read() → saveConfig(rows)
학적 업로드 ─→ saveRegistry(rows)  # GAS에서 학생코드 자동 발급
규칙 저장 ─→ saveSettings(json)
대시보드 ─→ fetchResponses() → 차트/리포트 렌더링
```

**AI 추천 (브라우저는 API 키를 보지 못함)**

```
브라우저 ─ POST /.netlify/functions/ai-recommendation ─→ Netlify Function
                                                       │ OPENAI_API_KEY 사용
                                                       ↓
                                                    OpenAI GPT-4o
                                                       │ 모드별 응답
                                                       ↓
                       학생 모드: 평문 추천 / admin 모드: JSON(균형·심화·키워드·활동)
```

### 5-3. 검증 규칙 (요약)

| 항목 | 기준 |
|------|------|
| 총 이수 학점 | ≥ 174 |
| 기초교과 비율 | ≤ 50% |
| 예술교과 | ≥ 10학점 |
| 생활·교양 교과군 | ≥ 16학점 |
| 선수과목 | 선이수 미충족 시 차단 |
| 학기별 제한 | Settings의 `selectionRules`에 정의된 (학점, 개수) 조합 |

상세 코드는 `js/validation.js` (레거시 기준) 및 React 측 검증 모듈을 참고하세요.

---

## 6. 보안 메모

- **GAS는 CORS를 거의 지원하지 않습니다.** 모든 POST는 `Content-Type: text/plain;charset=utf-8` + `redirect: 'follow'` 조합으로만 통과합니다. 헤더를 바꾸면 즉시 깨집니다.
- **학생 인증은 3-factor(코드+학번+이름)**이며 GAS 서버 측에서 정규화 후 비교합니다. 클라이언트 단독 검증을 신뢰하지 않습니다.
- **관리자 라우터 매핑**은 클라이언트가 보낸 Google ID 토큰을 `https://oauth2.googleapis.com/tokeninfo`에서 검증한 뒤 그 이메일로만 매핑을 쓸 수 있습니다. 다른 사람 매핑을 임의로 덮어쓸 수 없습니다. 보안 강화를 위해 `EXPECTED_AUDIENCE`(Google OAuth Client ID)를 라우터 GAS의 스크립트 속성에 등록하세요.
- **시트 단위 권한 격리는 각 학교 GAS의 doGet/doPost가 책임집니다.** 라우터 GAS는 URL 매핑만 보관하며, 시트 자체의 데이터 보호는 학교 측 GAS와 시트 권한으로 제어합니다.
- **저장 정책**: `Responses` 시트만 append, 나머지는 시트 전체 덮어쓰기(`sheet.clear()` → 재작성). 동시 편집 시 마지막 저장이 이깁니다.

---

## 7. 트러블슈팅

| 증상 | 원인 / 해결 |
|------|------------|
| `GAS 배포 URL을 확인해주세요. HTML 응답이 반환되었습니다.` | GAS URL이 잘못됐거나 권한이 "Anyone"이 아님. 재배포 필요. |
| AI 추천 실패 (500) | Netlify에 `OPENAI_API_KEY` 미설정 또는 잔액 부족. Function 로그 확인. |
| 다른 관리자 시트가 보임 | 캐시된 `gas_api_url` 누출. 로그아웃 후 재로그인하면 라우터에서 본인 매핑만 복원됨. |
| 학생 인증 실패 (정상 코드인데) | 학생코드/학번을 OCR/복사할 때 공백·특수문자 혼입. 입력은 서버에서 대문자+영숫자만 통과시킴. |
| 엑셀 업로드 후 학생코드가 안 보임 | `saveRegistry` 후 화면 새로고침 또는 학적 패널 다시 열기. 코드는 서버에서 자동 발급됨. |

---

## 8. 라이선스 / 기여

내부 운영용 프로젝트입니다. 학교 단위 커스터마이즈가 잦으므로 fork 후 수정을 권장합니다.
