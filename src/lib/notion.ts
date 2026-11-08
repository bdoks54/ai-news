import "server-only";

// Notion 내부 통합 토큰(NOTION_API_TOKEN)으로 Notion REST API를 직접 호출해
// NOTION_DATABASE_ID 데이터베이스에 기사를 한 행씩 등록한다.
// 데이터베이스는 Notion에서 ⋯ → 연결에 통합을 추가해 공유해 두어야 한다.
const API_URL = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";
// rich_text 한 덩어리의 최대 길이와 덩어리 수
const MAX_TEXT = 2000;
const MAX_CHUNKS = 100;

// 데이터베이스 속성 이름. Notion에서 속성 이름을 바꾸면 여기도 함께 바꾼다.
const PROP = {
  title: "제목", // title
  summary: "요약", // rich_text
  date: "날짜", // date
  url: "출처", // url (원문 링크)
  category: "카테고리", // select (없는 옵션은 Notion이 자동으로 만든다)
} as const;

export type NotionArticle = {
  titleKo: string;
  summaryKo: string;
  categoryName: string;
  sourceLabel: string;
  originalUrl: string;
  originalTitle: string;
  publishedAt: Date | null;
};

export class NotionError extends Error {
  constructor(
    message: string,
    /** 토큰·데이터베이스 설정을 고쳐야 하는 오류인지 */
    readonly needsSetup = false,
  ) {
    super(message);
  }
}

/** 환경 변수에서 토큰과 데이터베이스 id를 읽는다. 설정이 없으면 NotionError. */
export function getNotionConfig() {
  const token = process.env.NOTION_API_TOKEN;
  if (!token) throw new NotionError("NOTION_API_TOKEN이 설정되어 있지 않습니다.", true);
  const databaseId = parseNotionId(process.env.NOTION_DATABASE_ID ?? "");
  if (!databaseId) {
    throw new NotionError("NOTION_DATABASE_ID에 저장할 데이터베이스 id 또는 URL을 넣어 주세요.", true);
  }
  return { token, databaseId };
}

/** Notion URL 또는 id에서 32자리 id를 뽑는다. URL의 ?v=(보기 id)는 무시한다. */
export function parseNotionId(input: string): string | null {
  const path = input.trim().split(/[?#]/)[0];
  const match = path.replace(/-/g, "").match(/[0-9a-f]{32}$/i);
  return match ? match[0].toLowerCase() : null;
}

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

function text(content: string, link?: string) {
  return { type: "text" as const, text: { content, ...(link ? { link: { url: link } } : {}) } };
}

/** 긴 문자열을 rich_text 길이 제한에 맞게 자른다. */
function chunks(content: string) {
  const out = [];
  for (let i = 0; i < content.length && out.length < MAX_CHUNKS; i += MAX_TEXT) {
    out.push(text(content.slice(i, i + MAX_TEXT)));
  }
  return out;
}

function paragraph(richText: ReturnType<typeof text>[]) {
  return { object: "block", type: "paragraph", paragraph: { rich_text: richText } };
}

function buildProperties(a: NotionArticle) {
  return {
    [PROP.title]: { title: [text(a.titleKo.slice(0, MAX_TEXT))] },
    [PROP.summary]: { rich_text: chunks(a.summaryKo) },
    [PROP.date]: { date: a.publishedAt ? { start: a.publishedAt.toISOString() } : null },
    [PROP.url]: { url: a.originalUrl },
    // select 옵션 이름에는 쉼표를 쓸 수 없다.
    [PROP.category]: { select: { name: a.categoryName.replace(/,/g, " ").slice(0, 100) } },
  };
}

/** 페이지 본문: 출처·원문 제목, 원문 북마크, 요약 */
function buildChildren(a: NotionArticle) {
  const summary = a.summaryKo
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => paragraph(chunks(line)));

  return [
    paragraph([text(`${a.sourceLabel} · `), text(a.originalTitle.slice(0, MAX_TEXT), a.originalUrl)]),
    { object: "block", type: "bookmark", bookmark: { url: a.originalUrl } },
    { object: "block", type: "heading_2", heading_2: { rich_text: [text("요약")] } },
    ...(summary.length ? summary : [paragraph([text("요약이 없습니다.")])]),
  ];
}

function toNotionError(status: number, data: { code?: string; message?: string } | null) {
  console.error("[notion] 요청 실패:", status, data?.code, data?.message);
  if (status === 401) {
    return new NotionError("Notion 토큰이 올바르지 않습니다. NOTION_API_TOKEN을 확인해 주세요.", true);
  }
  if (data?.code === "object_not_found" || status === 403) {
    return new NotionError(
      "데이터베이스에 접근할 수 없습니다. Notion에서 데이터베이스의 ⋯ → 연결에 통합을 추가해 주세요.",
      true,
    );
  }
  if (data?.code === "validation_error") {
    // 속성 이름·형식이 PROP과 다를 때. Notion 메시지에 어떤 속성인지 나온다.
    return new NotionError(`데이터베이스 속성이 맞지 않습니다: ${data.message ?? ""}`, true);
  }
  if (status === 429) return new NotionError("Notion 요청이 많습니다. 잠시 후 다시 시도해 주세요.");
  return new NotionError("Notion 저장에 실패했습니다.");
}

export type NotionStatus =
  | { ok: true; databaseTitle: string; databaseUrl: string }
  | { ok: false; reason: string };

/** 설정 화면용: 토큰과 데이터베이스 접근 권한을 확인한다. */
export async function checkNotionStatus(): Promise<NotionStatus> {
  let config;
  try {
    config = getNotionConfig();
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "설정을 확인해 주세요." };
  }
  const res = await fetch(`${API_URL}/databases/${config.databaseId}`, {
    headers: headers(config.token),
  }).catch(() => null);
  if (!res) return { ok: false, reason: "Notion에 연결하지 못했습니다." };
  const data = await res.json().catch(() => null);
  if (!res.ok) return { ok: false, reason: toNotionError(res.status, data).message };

  const db = data as { url: string; title: { plain_text: string }[] };
  return {
    ok: true,
    databaseTitle: db.title.map((t) => t.plain_text).join("") || "제목 없음",
    databaseUrl: db.url,
  };
}

/** 기사를 데이터베이스에 한 행으로 등록하고, 만들어진 페이지 URL을 돌려준다. */
export async function createNotionPage(
  token: string,
  databaseId: string,
  article: NotionArticle,
): Promise<string> {
  const res = await fetch(`${API_URL}/pages`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({
      parent: { database_id: databaseId },
      properties: buildProperties(article),
      children: buildChildren(article),
    }),
  });

  const data = (await res.json().catch(() => null)) as
    | { url?: string; code?: string; message?: string }
    | null;
  if (res.ok && data?.url) return data.url;
  throw toNotionError(res.status, data);
}
