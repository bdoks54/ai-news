# AI 뉴스 수집기

TechCrunch와 The Verge의 AI 뉴스를 RSS로 가져오면, Claude가 한국어로 번역·요약하고 사용자 카테고리로 분류해 카드로 보여 주는 웹앱입니다. 마음에 드는 뉴스는 버튼 한 번으로 Notion 데이터베이스에 저장할 수 있습니다. 자세한 요구사항은 [PRD.md](./PRD.md), 화면 규칙은 [ui.md](./ui.md)에 있습니다.

## 주요 기능

- **로그인**: Clerk로 로그인합니다. 뉴스와 카테고리는 사용자별로 따로 저장됩니다.
- **뉴스 가져오기**: 최근 24시간 기사를 모은 뒤, Claude가 한국어 제목·요약·카테고리를 만듭니다. 이미 가져온 기사는 원문 URL로 걸러 건너뜁니다.
- **카테고리**: 처음 로그인하면 기본 카테고리 6개(LLM/모델, 비즈니스/투자, 정책/규제, 연구, 제품/도구, 기타)가 만들어집니다. `/categories`에서 추가·수정·삭제하고 다시 분류할 수 있습니다.
- **대시보드**: 카테고리 탭으로 걸러 보고, 한 페이지에 카드 9개씩 넘겨 봅니다.
- **Notion 저장**: 카드의 `Notion 저장` 버튼을 누르면 지정한 Notion 데이터베이스에 한 행으로 추가됩니다.

## 기술 스택

Next.js 16 (App Router, Turbopack) · React 19 · Tailwind CSS v4 · Clerk · Neon Postgres + Drizzle ORM · Anthropic Claude API · Notion API

## 시작하기

### 1. 패키지 설치

```bash
npm install
```

### 2. 환경 변수

`.env.example`을 복사해 `.env.local`을 만들고 값을 채웁니다.

| 변수 | 얻는 곳 |
| --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Clerk 대시보드 → API Keys |
| `DATABASE_URL` | Neon 콘솔 → Connection string |
| `ANTHROPIC_API_KEY` | Anthropic Console → API Keys |
| `CLAUDE_MODEL` (선택) | 기본값 `claude-sonnet-5-5` |
| `TOKEN_ENCRYPTION_KEY` | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` 실행 결과 |
| `APP_URL` | 로컬에서는 `http://localhost:3000`, 배포한 뒤에는 실제 도메인 |
| `NOTION_API_TOKEN` | [Notion 통합](https://www.notion.so/profile/integrations)에서 만든 내부 통합 토큰 (`ntn_…`) |
| `NOTION_DATABASE_ID` | 저장할 Notion 데이터베이스의 id 또는 URL (`?v=`가 붙은 URL도 됩니다) |

### 3. Notion 데이터베이스 준비

1. Notion에 데이터베이스를 만들고 아래 속성을 추가합니다. 이름과 형식이 정확히 같아야 합니다.

   | 속성 | 형식 | 들어가는 값 |
   | --- | --- | --- |
   | 제목 | 제목 | 한국어 제목 |
   | 요약 | 텍스트 | 한국어 요약 |
   | 날짜 | 날짜 | 기사 게시 시각 |
   | 출처 | URL | 원문 링크 |
   | 카테고리 | 선택 | 카테고리 이름 (없는 옵션은 자동으로 만들어집니다) |

2. 데이터베이스 오른쪽 위 **⋯ → 연결**에서 내 통합을 추가합니다.
3. 데이터베이스 URL을 `NOTION_DATABASE_ID`에 넣습니다.

속성 이름을 바꾸고 싶다면 `src/lib/notion.ts`의 `PROP`도 함께 고칩니다.

### 4. 데이터베이스 테이블 만들기

```bash
npm run db:push
```

`src/db/schema.ts`를 Neon에 반영합니다.

### 5. 실행

```bash
npm run dev
```

http://localhost:3000 을 열고 로그인하면 `/dashboard`로 이동합니다. **설정** 화면에서 Notion 데이터베이스 연결 상태를 확인할 수 있습니다.

## 명령어

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 |
| `npm run build` | 프로덕션 빌드 (타입 검사 포함) |
| `npm run start` | 빌드 결과 실행 |
| `npm run lint` | ESLint |
| `npm run db:push` | 스키마를 Neon에 바로 반영 |
| `npm run db:generate` / `db:migrate` / `db:studio` | drizzle-kit 마이그레이션 생성·적용, DB 브라우저 |

## 동작 방식

‘뉴스 가져오기’ 버튼은 두 단계를 차례로 호출합니다.

1. **수집** (`/api/news/fetch`): 두 RSS 피드에서 최근 24시간 기사를 가져와 원문 그대로 저장합니다. 피드 하나가 실패해도 나머지는 계속 처리합니다.
2. **처리** (`/api/news/process`): 아직 번역되지 않은 기사를 최대 30건까지 10건씩 묶어 Claude에 보내고, 한국어 제목·요약·카테고리를 채웁니다. 실패한 기사는 다음 실행 때 다시 처리합니다.

처리 전 기사는 원문 제목과 RSS 본문 일부로 먼저 보입니다.

## 폴더 구조

```
src/
├─ proxy.ts                 # Clerk 로그인 보호 (Next.js 16의 middleware)
├─ db/schema.ts             # categories, articles, notion_connections 테이블
├─ lib/
│  ├─ rss.ts                # RSS 수집
│  ├─ claude.ts             # 번역·요약·분류 (구조화된 출력)
│  ├─ process.ts            # 미처리 기사 일괄 처리
│  ├─ categories.ts         # 기본 카테고리, 카테고리 이름 → id 매핑
│  └─ notion.ts             # Notion 데이터베이스 저장
├─ app/
│  ├─ dashboard/            # 메인 화면
│  ├─ categories/           # 카테고리 관리
│  ├─ settings/             # Notion 연결 상태
│  └─ api/                  # news/fetch, news/process, news/reclassify, notion/save
└─ components/              # 뉴스 카드, 카테고리 탭, 페이지 나누기 등
```

## 참고

- Claude 요청에는 서버 측 폴백(`fallbacks: "default"`)이 켜져 있어, 요청이 거절되면 다른 모델이 자동으로 다시 처리합니다.
- Notion 토큰은 서버 환경 변수 하나를 모든 사용자가 함께 쓰므로, 저장한 뉴스는 모두 같은 데이터베이스에 쌓입니다.
- 예전의 Notion OAuth 연결 코드(`src/lib/notion-oauth.ts`, `/api/notion/oauth/*`)는 남아 있지만 지금은 쓰지 않습니다.
