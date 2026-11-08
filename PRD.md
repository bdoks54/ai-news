# PRD: AI 뉴스 수집기 (AI News Collector)

## 1. 개요
해외 AI 뉴스를 RSS로 수집하고, Claude AI가 한국어로 번역과 요약을 한 뒤 카테고리별로 분류해서 카드 형태로 보여주는 웹앱입니다. 마음에 드는 뉴스는 버튼 한 번으로 Notion에 저장합니다.

### 1.1 목표
- 해외 AI 뉴스를 한국어 요약으로 빠르게 훑어볼 수 있게 합니다.
- 사용자가 정의한 카테고리로 자동 분류해서 관심 분야만 골라 볼 수 있게 합니다.
- 중요한 뉴스는 Notion에 쌓아 개인 지식 베이스로 활용할 수 있게 합니다.

### 1.2 대상 사용자
- AI 업계 동향을 매일 확인해야 하지만 영어 기사를 일일이 읽을 시간이 부족한 개발자, 기획자, 연구자

## 2. 뉴스 소스
| 소스 | RSS URL |
|---|---|
| TechCrunch AI | https://techcrunch.com/category/artificial-intelligence/feed/ |
| The Verge AI | https://www.theverge.com/rss/ai-artificial-intelligence/index.xml |

## 3. 기능 요구사항

### F1. 로그인 (Clerk)
- 앱을 실행하면 로그인부터 해야 합니다. 로그인하지 않은 사용자는 모든 페이지에서 로그인 화면으로 이동합니다.
- 뉴스, 카테고리, Notion 연결 정보는 **사용자별로 분리**해서 저장합니다.

### F2. 뉴스 가져오기
- "뉴스 가져오기" 버튼을 누르면 수집이 시작됩니다. 자동 주기 수집은 하지 않고, 필요할 때만 실행합니다.
- 두 RSS 피드를 동시에 받아옵니다.
- 이미 저장된 기사는 원문 URL로 걸러서 건너뜁니다.
- 새 기사마다 Claude가 다음을 생성합니다.
  - 한국어 제목
  - 한국어 요약(3~4문장)
  - 카테고리(사용자 카테고리 목록 중 하나)
- 처리하는 동안 로딩 상태를 보여주고, 끝나면 "N건 추가됨"을 알려줍니다.

### F3. 자동 카테고리 분류
- Claude가 사용자의 카테고리 이름과 설명을 참고해서 각 기사를 분류합니다.
- 맞는 카테고리가 없으면 **미분류**로 둡니다.
- 처음 로그인하면 기본 카테고리를 만들어 줍니다: LLM/모델, 비즈니스/투자, 정책/규제, 연구, 제품/도구, 기타

### F4. 카테고리별 보기
- 상단 탭은 **전체**, 각 카테고리, **미분류**로 구성합니다.
- 탭을 고르면 해당 카테고리의 뉴스만 보여줍니다.

### F5. 카테고리 관리
- 카테고리를 언제든 **추가, 수정(이름·설명·색상), 삭제**할 수 있습니다.
- 카테고리를 삭제하면 그 카테고리의 뉴스는 **미분류**로 옮깁니다.
- **재분류** 버튼을 누르면 미분류 뉴스(또는 전체 뉴스)를 현재 카테고리 목록 기준으로 Claude가 다시 분류합니다.

### F6. 뉴스 카드
- 카드에 표시하는 항목: 한국어 제목, 한국어 요약, 카테고리 배지, 출처(TechCrunch 또는 The Verge), 게시일, 원문 링크
- 카드에 **"Notion 저장"** 버튼을 둡니다.
- 이미 저장한 뉴스는 버튼 대신 **"Notion에서 열기"** 링크를 보여줍니다.

### F7. Notion 저장 (Notion MCP 서버)
- 사용자는 앱에서 Notion 계정을 한 번 연결합니다(OAuth). 저장할 상위 페이지도 지정합니다.
- "Notion 저장"을 누르면 서버가 Claude API의 **MCP 커넥터**로 Notion 원격 MCP 서버(`https://mcp.notion.com/mcp`)에 연결합니다. 그러면 Claude가 지정된 페이지 아래에 새 페이지를 만듭니다.
- 페이지에 들어가는 내용: 제목(한국어), 요약, 카테고리, 출처, 원문 링크, 게시일
- 저장이 끝나면 만들어진 Notion 페이지 URL을 기사에 기록합니다.

## 4. 기술 스택
| 영역 | 기술 |
|---|---|
| 프레임워크 | Next.js (App Router, TypeScript), Tailwind CSS |
| 로그인 | Clerk |
| 데이터베이스 | Neon (Postgres), Drizzle ORM |
| 번역·요약·분류 | Claude API (`@anthropic-ai/sdk`, 구조화된 JSON 출력) |
| Notion 저장 | Notion MCP 서버 (Claude API MCP 커넥터) |
| RSS 파싱 | rss-parser |

## 5. 데이터 모델
- **categories**: id, userId, name, description, color, createdAt
  - (userId, name)에 unique를 겁니다.
- **articles**: id, userId, source, originalUrl, originalTitle, author(nullable), titleKo, summaryKo, publishedAt, categoryId(nullable), notionPageUrl(nullable), createdAt
  - (userId, originalUrl)에 unique를 겁니다.
  - 카테고리를 삭제하면 categoryId를 NULL로 바꿉니다.
- **notion_connections**: userId(PK), clientId, accessToken(암호화), refreshToken(암호화), expiresAt, parentPageId

## 6. 화면 구성
- `/sign-in`, `/sign-up`: Clerk 로그인과 회원가입
- `/`: 뉴스 목록. 상단에 "뉴스 가져오기" 버튼, 카테고리 탭, 카드 그리드
- `/categories`: 카테고리 관리(추가, 수정, 삭제)와 재분류
- `/settings`: Notion 연결과 해제, 저장할 상위 페이지 지정

## 7. API
| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/api/news/fetch` | RSS 수집, 번역·요약·분류, 저장 |
| POST | `/api/news/reclassify` | 미분류 또는 전체 뉴스 재분류 |
| POST | `/api/notion/save` | 선택한 뉴스를 Notion에 저장 |
| GET | `/api/notion/oauth/start` | Notion MCP OAuth 시작(동적 클라이언트 등록, PKCE) |
| GET | `/api/notion/oauth/callback` | 토큰 교환 후 저장 |

## 8. 비기능 요구사항
- **보안**: 모든 API에서 Clerk 인증을 확인하고, 데이터는 userId로만 조회합니다. Notion 토큰은 AES-GCM으로 암호화해서 저장합니다. API 키는 서버에만 둡니다.
- **성능**: 기사를 묶음 단위로 Claude에 요청해서 호출 횟수를 줄입니다. 수집 API의 최대 실행 시간은 넉넉하게 설정합니다.
- **안정성**: 피드 하나가 실패해도 나머지 피드의 결과는 저장합니다.

## 9. 환경 변수
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
DATABASE_URL=
ANTHROPIC_API_KEY=
TOKEN_ENCRYPTION_KEY=   # 32바이트 base64
APP_URL=http://localhost:3000
```

## 10. 범위 밖 (이번 버전에서 하지 않는 것)
- 주기적 자동 수집(크론)
- RSS 소스 추가와 관리 UI
- 뉴스 검색, 북마크, 공유

## 11. 완료 기준
1. 로그인하지 않으면 로그인 화면으로 이동합니다.
2. "뉴스 가져오기"를 누르면 한국어 카드가 카테고리와 함께 나옵니다. 다시 누르면 중복 없이 0건이 추가됩니다.
3. 카테고리 탭으로 필터가 됩니다. 카테고리를 추가, 수정, 삭제할 수 있고, 삭제하면 그 뉴스가 미분류로 옮겨지며, 재분류가 동작합니다.
4. Notion을 연결한 뒤 "Notion 저장"을 누르면 Notion에 페이지가 생기고, 카드가 "Notion에서 열기"로 바뀝니다.
5. 다른 사용자의 데이터는 보이지 않습니다.
