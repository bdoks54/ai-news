# UI 가이드 — AI 뉴스 수집기

이 문서는 **AI 뉴스 수집기**의 화면 구성과 스타일 규칙을 정리한다. 모든 스타일은 **Tailwind CSS v4** 유틸리티 클래스로 작성하고, 새 컴포넌트를 만들거나 기존 컴포넌트를 고칠 때 이 문서를 기준으로 삼는다.

- 스타일 진입점: `src/app/globals.css` (`@import "tailwindcss"` + `@theme inline` 토큰)
- Tailwind는 PostCSS가 아니라 Turbopack CSS 로더(`@tailwindcss/turbopack`)로 동작한다.
- 별도 UI 라이브러리는 쓰지 않는다. 공통 패턴은 이 문서의 클래스 조합을 그대로 재사용한다.

---

## 1. 디자인 원칙

1. **읽기가 먼저다.** 이 앱의 핵심은 한국어 요약문을 빠르게 훑어보는 것이다. 장식보다 여백, 줄 간격, 글자 대비를 우선한다.
2. **차분한 바탕, 포인트는 하나.** 화면은 slate 계열 무채색으로 구성하고, 강조색(indigo)은 주요 동작 한 곳에만 쓴다. 카테고리 색은 작은 점과 배지에만 쓴다.
3. **일관된 모양.** 모서리, 테두리, 그림자 규칙을 통일해 카드·버튼·탭이 한 시스템처럼 보이게 한다.
4. **상태를 숨기지 않는다.** 로딩, 빈 목록, 오류, 완료 상태를 모두 화면에 문장으로 보여 준다.

---

## 2. 색상

### 2.1 기본 팔레트 (slate)

| 용도 | 클래스 | 값 |
| --- | --- | --- |
| 페이지 배경 | `bg-background` | `#f8fafc` (slate-50) |
| 카드·헤더·입력 배경 | `bg-white` | `#ffffff` |
| 본문 제목 | `text-slate-900` | |
| 요약 본문 | `text-slate-600` | |
| 보조 텍스트 (설명, 링크) | `text-slate-500` | |
| 메타 정보 (출처, 날짜, 개수) | `text-slate-400` | |
| 기본 테두리 | `border-slate-200` | |
| 입력·보조 버튼 테두리 | `border-slate-300` | |
| 카드 내부 구분선 | `border-slate-100` | |

### 2.2 의미 색상

| 의미 | 클래스 | 사용처 |
| --- | --- | --- |
| 주요 동작 | `bg-indigo-600 hover:bg-indigo-500 text-white` | ‘뉴스 가져오기’처럼 화면당 하나뿐인 핵심 버튼 |
| 선택 상태 / 확정 동작 | `bg-slate-900 text-white` | 선택된 카테고리 탭, 폼 제출 버튼 |
| 완료 | `text-emerald-600` | ‘Notion에서 열기’ 등 저장 완료 표시 |
| 오류 | `text-red-600` | 인라인 오류 메시지 |

### 2.3 카테고리 색

카테고리마다 DB에 `color`(hex)가 저장되어 있다. 동적인 값이라 Tailwind 클래스가 아니라 `style`로 적용한다.

- **점(dot)**: `h-2 w-2 rounded-full` + `style={{ backgroundColor: color }}`
- **배지**: 글자는 원색, 배경은 원색에 투명도 10%(`1a`)를 붙인다.
  `style={{ backgroundColor: `${color}1a`, color }}`
- **미분류**는 항상 `#94a3b8`(slate-400)을 쓴다.

기본 카테고리 색 (`src/lib/categories.ts`):

| 카테고리 | 색 |
| --- | --- |
| LLM/모델 | `#6366f1` |
| 비즈니스/투자 | `#10b981` |
| 정책/규제 | `#f59e0b` |
| 연구 | `#ec4899` |
| 제품/도구 | `#0ea5e9` |
| 기타 | `#64748b` |

---

## 3. 타이포그래피

- 글꼴: `font-sans` = Geist → Apple SD Gothic Neo → Malgun Gothic. 한글은 시스템 고딕으로 표시된다.
- `<html lang="ko">`와 `antialiased`를 유지한다.

| 요소 | 클래스 |
| --- | --- |
| 페이지 제목 (h1) | `text-xl font-bold text-slate-900` |
| 페이지 설명 | `text-sm text-slate-500` |
| 카드 제목 (h2) | `font-semibold leading-snug text-slate-900` |
| 카드 요약 | `text-sm leading-relaxed text-slate-600` |
| 메타 정보, 배지 | `text-xs` |
| 버튼, 탭, 내비게이션 | `text-sm` |

읽기 편한 요약을 위한 규칙:
- 요약문에는 `leading-relaxed`를 쓰고 `whitespace-pre-line`으로 Claude가 넣은 줄바꿈을 살린다.
- 한 줄이 너무 길어지지 않도록 카드 폭으로 줄 길이를 제한한다(3열 그리드 기준 약 30~40자).
- 굵기는 `font-bold`(페이지 제목), `font-semibold`(카드 제목, 주요 버튼), `font-medium`(배지, 보조 버튼) 세 단계만 쓴다.

---

## 4. 레이아웃

```
┌──────────────────────────────────────────────────────────┐
│ AI 뉴스 수집기                  뉴스  카테고리  설정  (👤) │  ← 헤더 (sticky)
├──────────────────────────────────────────────────────────┤
│ AI 뉴스                                  [ 뉴스 가져오기 ] │  ← 페이지 헤더
│ TechCrunch · The Verge의 AI 소식을 한국어로 요약했습니다.  │
│                                                          │
│ (전체 42) (● LLM/모델 8) (● 연구 5) … (● 미분류 2) (+ 추가) │  ← 카테고리 바
│                                                          │
│ ┌────────────┐ ┌────────────┐ ┌────────────┐             │
│ │ 뉴스 카드   │ │ 뉴스 카드   │ │ 뉴스 카드   │             │  ← 카드 그리드
│ └────────────┘ └────────────┘ └────────────┘             │
└──────────────────────────────────────────────────────────┘
```

- 콘텐츠 폭: `mx-auto w-full max-w-6xl px-4`
- 본문 상하 여백: `py-6`
- 페이지 내부 섹션 간격: `space-y-6`
- 헤더: `sticky top-0 z-10 h-14 border-b border-slate-200 bg-white/90 backdrop-blur`
  - 왼쪽은 앱 이름 `AI 뉴스 수집기` (`font-bold text-slate-900`, `/dashboard` 링크)
  - 오른쪽은 내비게이션 `뉴스 · 카테고리 · 설정` + Clerk `UserButton` (`gap-4 text-sm text-slate-600 hover:text-slate-900`)

### 반응형

| 화면 폭 | 카드 열 수 |
| --- | --- |
| 기본 (모바일) | 1열 |
| `sm` (≥640px) | 2열 |
| `lg` (≥1024px) | 3열 |

그리드: `grid gap-4 sm:grid-cols-2 lg:grid-cols-3`

---

## 5. 메인 화면: 대시보드 (`/dashboard`)

`/`로 접속하면 `/dashboard`로 리다이렉트된다(`next.config.ts`의 `redirects`). 메인 화면은 위에서부터 **페이지 헤더 → 카테고리 바 → 뉴스 카드 그리드** 순서다.

### 5.1 페이지 헤더

```tsx
<div className="flex flex-wrap items-center justify-between gap-3">
  <div>
    <h1 className="text-xl font-bold">AI 뉴스</h1>
    <p className="text-sm text-slate-500">TechCrunch · The Verge의 AI 소식을 한국어로 요약했습니다.</p>
  </div>
  <FetchButton />
</div>
```

- 오른쪽의 ‘뉴스 가져오기’ 버튼이 화면의 유일한 indigo 버튼이다.
- 결과 메시지(`12건 추가됨 · 1건 처리 실패`)는 버튼 왼쪽에 `text-sm text-slate-600`으로 표시한다.

### 5.2 카테고리 바

뉴스 카드 목록 바로 위에 둔다. 순서는 **전체 → 사용자 카테고리들 → 미분류 → `+ 추가` 버튼**이며, 추가 버튼은 항상 맨 끝에 온다.

```
(전체 42) (● LLM/모델 8) (● 비즈니스/투자 6) … (● 미분류 2) (＋ 추가)
```

컨테이너:

```tsx
<div className="flex items-center gap-2 overflow-x-auto pb-1">
```

- 모바일에서는 줄바꿈하지 않고 가로로 스크롤한다. 각 항목에 `shrink-0`을 붙인다.

**카테고리 탭 (pill)**

| 상태 | 클래스 |
| --- | --- |
| 공통 | `flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition` |
| 기본 | `border-slate-200 bg-white text-slate-700 hover:border-slate-400` |
| 선택됨 | `border-slate-900 bg-slate-900 text-white` |

- 탭 안 구성: `[색 점] 이름 개수`
- ‘전체’에는 색 점을 붙이지 않는다.
- 개수는 기본 `text-slate-400`, 선택됨 `text-slate-300`.
- 탭은 `<Link>`로 만들고 `/dashboard?category=<id|uncategorized>`로 필터링한다. ‘전체’는 `/dashboard`.
- 선택된 탭에는 `aria-current="page"`를 붙인다.

**카테고리 추가 버튼**

탭과 같은 pill 모양이지만 **점선 테두리**로 ‘필터가 아니라 동작’임을 구분한다.

```tsx
<button
  type="button"
  className="flex shrink-0 items-center gap-1 rounded-full border border-dashed border-slate-300 px-3 py-1.5 text-sm text-slate-500 transition hover:border-slate-500 hover:text-slate-900"
  aria-label="카테고리 추가"
>
  <span aria-hidden>＋</span> 추가
</button>
```

- 누르면 버튼 아래에 작은 팝오버를 띄우고 `CategoryForm`(색상, 이름, 분류 기준 설명)을 재사용한다.
  - 팝오버: `absolute z-20 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-lg`
  - 가로 스크롤 컨테이너 안에서는 팝오버가 잘리므로, 추가 버튼과 팝오버는 스크롤 영역 밖(바로 오른쪽)에 `relative` 래퍼로 둔다.
  - 저장에 성공하면 팝오버를 닫는다. 새 카테고리 탭은 서버 액션의 `revalidatePath`로 바로 나타난다.
  - `Esc` 키와 바깥 클릭으로 닫히게 하고, 열릴 때 이름 입력칸에 포커스를 준다.
- 카테고리 수정·삭제와 재분류는 대시보드에서 하지 않고 `/categories` 페이지에서 한다.

### 5.3 뉴스 카드

```
┌───────────────────────────────────┐
│ [LLM/모델]   TechCrunch · 2026년 11월 8일 │  ← 배지 + 메타
│                                   │
│ 한국어 제목이 들어갑니다            │  ← 제목
│                                   │
│ 한국어 요약문이 3~5줄 정도로        │  ← 요약 (flex-1)
│ 들어갑니다.                        │
│───────────────────────────────────│
│ 원문 보기 ↗           [Notion 저장] │  ← 하단 동작
└───────────────────────────────────┘
```

| 부분 | 클래스 |
| --- | --- |
| 카드 | `flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm` |
| 상단 줄 | `mb-3 flex items-center justify-between gap-2 text-xs` |
| 카테고리 배지 | `rounded-full px-2 py-0.5 font-medium` + 카테고리 색 style |
| 메타 (출처 · 날짜) | `text-slate-400` |
| 제목 | `mb-2 font-semibold leading-snug text-slate-900` |
| 요약 | `mb-4 flex-1 whitespace-pre-line text-sm leading-relaxed text-slate-600` |
| 하단 줄 | `flex items-center justify-between gap-2 border-t border-slate-100 pt-3 text-sm` |
| 원문 링크 | `text-slate-500 hover:text-slate-900` |

- 요약에 `flex-1`을 주어 같은 줄 카드의 하단 동작 줄 높이를 맞춘다.
- 날짜는 `toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" })` 형식이다.
- 외부 링크는 `target="_blank" rel="noreferrer"`를 쓰고 텍스트 끝에 `↗`를 붙인다.
- Notion 저장 버튼은 세 가지 상태를 가진다.
  - 저장 전: 보조 버튼 `Notion 저장`
  - 저장 중: `저장 중…` + `disabled:cursor-wait disabled:opacity-60`
  - 저장 후: `Notion에서 열기 ↗` 링크 (`font-medium text-emerald-600 hover:text-emerald-500`)
- 오류는 카드 맨 아래에 `mt-2 text-xs text-red-600`으로 표시한다. Notion 연결이 필요하면 `설정으로 이동` 링크를 덧붙인다.

---

## 6. 공통 컴포넌트

### 6.1 버튼

| 종류 | 클래스 | 예 |
| --- | --- | --- |
| 주요 | `rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-wait disabled:opacity-70` | 뉴스 가져오기 |
| 확정 | `rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60` | 폼 추가·저장 |
| 보조 | `rounded-md border border-slate-300 px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60` | Notion 저장 |
| 텍스트 | `px-3 py-2 text-sm text-slate-500 hover:text-slate-900` | 취소 |
| 추가 (점선 pill) | 5.2 참고 | 카테고리 추가 |

- 진행 중인 버튼은 문구를 `…`로 끝나는 진행형으로 바꾼다(`가져오는 중…`, `저장 중…`).
- 오래 걸리는 동작은 버튼 안에 스피너를 넣는다:
  `h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white`

### 6.2 입력

- 텍스트 입력: `w-full rounded-lg border border-slate-300 px-3 py-2 text-sm`
- 색상 선택: `h-10 w-12 shrink-0 cursor-pointer rounded border border-slate-300`
- 플레이스홀더에는 예시를 쓴다. (예: `카테고리 이름 (예: 로보틱스)`)

### 6.3 상태 표시

| 상태 | 표현 |
| --- | --- |
| 페이지 로딩 | 가운데 스피너 `h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700` (`py-20`) |
| 빈 목록 | `rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500` |
| 인라인 오류 | `text-sm text-red-600` (카드 안에서는 `text-xs`) |
| 처리 결과 | `text-sm text-slate-600` 한 줄 요약, 항목은 ` · `로 구분 |

빈 목록 문구:
- 뉴스가 하나도 없을 때: `아직 가져온 뉴스가 없습니다. ‘뉴스 가져오기’ 버튼을 눌러 보세요.`
- 선택한 카테고리에 뉴스가 없을 때: `이 카테고리에 해당하는 뉴스가 없습니다.`

---

## 7. 모양 규칙 요약

| 항목 | 규칙 |
| --- | --- |
| 모서리 | 카드·빈 상태·팝오버 `rounded-xl`, 버튼·입력 `rounded-lg`, 작은 보조 버튼 `rounded-md`, 탭·배지·점 `rounded-full` |
| 그림자 | 카드 `shadow-sm`, 팝오버 `shadow-lg`. 그 밖에는 쓰지 않는다. |
| 테두리 | 기본 `border-slate-200`, 동작 요소 `border-slate-300`, 추가 동작은 `border-dashed` |
| 간격 | 섹션 `space-y-6`, 카드 그리드 `gap-4`, 탭 사이 `gap-2`, 카드 안쪽 `p-5` |
| 전환 | hover 변화가 있는 요소에는 `transition` |

---

## 8. 접근성

- 클릭 가능한 요소는 `<a>`/`<Link>`(이동)와 `<button>`(동작)으로 구분한다. `div`에 `onClick`을 달지 않는다.
- 아이콘이나 기호만 있는 요소에는 `aria-label`을 단다(예: 색상 선택 `aria-label="색상"`).
- 장식용 기호(`＋`, 색 점)는 `aria-hidden`으로 숨긴다.
- 키보드 포커스가 보여야 한다. 기본 아웃라인을 지우면 `focus-visible:ring-2 focus-visible:ring-indigo-500`로 대신한다.
- 색만으로 정보를 전달하지 않는다. 카테고리는 항상 색과 이름을 함께 보여 준다.
- 본문 텍스트는 `text-slate-600` 이상 진하게 써서 흰 배경 대비를 확보한다. `text-slate-400`은 메타 정보에만 쓴다.

---

## 9. 작성 규칙

- 사용자에게 보이는 문구, 코드 주석, 문서는 한국어로 쓴다.
- 문구는 짧은 존댓말 평서형(`~합니다`, `~해 보세요`)으로 통일한다.
- 새 색이나 크기가 필요하면 임의 값(`text-[13px]`)을 쓰기 전에 이 문서의 기존 단계로 해결할 수 있는지 먼저 확인한다. 꼭 필요하면 `globals.css`의 `@theme`에 토큰으로 추가하고 이 문서를 고친다.
