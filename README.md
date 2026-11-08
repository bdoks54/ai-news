# AI 뉴스 수집기

TechCrunch와 The Verge의 AI 뉴스를 RSS로 가져와서 Claude가 한국어로 번역하고 요약하고 카테고리별로 분류한 다음 카드 형태로 보여주는 앱입니다. 카드의 버튼을 누르면 뉴스를 Notion에 저장할 수 있습니다. 자세한 요구사항은 [PRD.md](./PRD.md)에 있습니다.

## 시작하기

### 1. 환경 변수
`.env.example` 파일을 복사해 `.env.local`을 만들고 값을 채웁니다.

| 변수 | 얻는 곳 |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Clerk 대시보드 → API Keys |
| `DATABASE_URL` | Neon 콘솔 → Connection string |
| `ANTHROPIC_API_KEY` | Anthropic Console → API Keys |
| `TOKEN_ENCRYPTION_KEY` | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` 실행 결과 |
| `APP_URL` | 로컬에서는 `http://localhost:3000`, 배포한 뒤에는 실제 도메인 |

### 2. 데이터베이스 테이블 만들기
```bash
npm run db:push
```

### 3. 실행
```bash
npm run dev
```
브라우저에서 http://localhost:3000 을 엽니다. 로그인하면 기본 카테고리 6개가 자동으로 만들어집니다.

### 4. Notion 연결
1. **설정** 화면에서 **Notion 연결하기**를 누르고, Notion에서 접근을 허용합니다.
2. 뉴스를 저장할 상위 페이지 URL을 입력합니다. 입력하지 않으면 개인 페이지로 저장됩니다.
3. 뉴스 카드에서 **Notion 저장**을 누릅니다.

## 구조
- `src/proxy.ts`: Clerk 로그인 보호 (Next.js 16에서는 middleware 대신 proxy를 씁니다)
- `src/db/schema.ts`: 테이블 정의 (categories, articles, notion_connections)
- `src/lib/rss.ts`: RSS 수집
- `src/lib/claude.ts`: 번역, 요약, 분류(구조화된 출력)와 Notion 저장(MCP 커넥터)
- `src/lib/notion-oauth.ts`: Notion MCP OAuth (동적 클라이언트 등록, PKCE, 토큰 갱신)
- `src/app/api/...`: 뉴스 가져오기, 재분류, Notion 저장, OAuth API

## 참고
- 기본 모델은 `claude-sonnet-5-5`입니다. 바꾸려면 `CLAUDE_MODEL` 환경 변수를 설정합니다.
- Claude 요청에는 서버 측 폴백(`fallbacks: "default"`)이 켜져 있습니다. 안전 분류기가 요청을 거절하면 다른 모델이 자동으로 다시 처리합니다.
