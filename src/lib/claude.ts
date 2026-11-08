import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

const client = new Anthropic();

// 번역/요약/분류와 Notion 저장에 쓰는 모델. 필요하면 CLAUDE_MODEL로 바꾼다.
const MODEL = process.env.CLAUDE_MODEL ?? "claude-sonnet-5-5";

// 안전 분류기가 요청을 거절하면 서버 측에서 자동으로 다른 모델로 다시 시도한다.
const FALLBACK_BETA = "server-side-fallback-2026-07-01";
const MCP_BETA = "mcp-client-2025-11-20";
const NOTION_MCP_URL = "https://mcp.notion.com/mcp";

export type CategoryHint = { name: string; description: string };

function categoryList(categories: CategoryHint[]) {
  return categories
    .map((c) => `- ${c.name}${c.description ? `: ${c.description}` : ""}`)
    .join("\n");
}

// ───────────────────────── 번역 + 요약 + 분류 ─────────────────────────

const SummarySchema = z.object({
  items: z.array(
    z.object({
      index: z.number().int(),
      titleKo: z.string(),
      summaryKo: z.string(),
      category: z.string(),
    }),
  ),
});

export type SummaryInput = { title: string; snippet: string; url: string };
export type SummaryResult = { titleKo: string; summaryKo: string; category: string };

/**
 * 기사 묶음을 한 번에 한국어로 번역/요약하고 카테고리를 고른다.
 * 결과 배열은 입력과 같은 순서이며, 처리하지 못한 기사는 null이다.
 */
export async function summarizeArticles(
  articles: SummaryInput[],
  categories: CategoryHint[],
): Promise<(SummaryResult | null)[]> {
  const list = articles
    .map(
      (a, i) =>
        `<article index="${i}">\n<title>${a.title}</title>\n<url>${a.url}</url>\n<content>${a.snippet}</content>\n</article>`,
    )
    .join("\n");

  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(SummarySchema) },
    system:
      "당신은 해외 AI 뉴스를 한국 독자에게 전달하는 IT 전문 기자입니다. " +
      "기사 제목은 자연스러운 한국어로 번역하고, 내용은 핵심만 담아 3~4문장의 한국어로 요약합니다. " +
      "회사명, 제품명, 모델명 같은 고유명사는 원문 표기를 유지합니다.",
    messages: [
      {
        role: "user",
        content:
          `아래 기사들을 처리해 주세요. 각 기사마다 index, titleKo, summaryKo, category를 반환합니다.\n` +
          `category는 반드시 아래 목록의 이름 중 하나를 그대로 쓰고, 어느 것에도 맞지 않으면 "미분류"로 씁니다.\n\n` +
          `<categories>\n${categoryList(categories)}\n</categories>\n\n${list}`,
      },
    ],
  });

  if (response.stop_reason === "refusal" || !response.parsed_output) {
    console.error("[claude] 요약 실패:", response.stop_reason);
    return articles.map(() => null);
  }

  const byIndex = new Map(response.parsed_output.items.map((it) => [it.index, it]));
  return articles.map((_, i) => {
    const it = byIndex.get(i);
    return it ? { titleKo: it.titleKo, summaryKo: it.summaryKo, category: it.category } : null;
  });
}

// ───────────────────────── 재분류 ─────────────────────────

const ClassifySchema = z.object({
  items: z.array(z.object({ index: z.number().int(), category: z.string() })),
});

/** 이미 요약된 기사들을 현재 카테고리 목록 기준으로 다시 분류한다. */
export async function classifyArticles(
  articles: { title: string; summary: string }[],
  categories: CategoryHint[],
): Promise<(string | null)[]> {
  const list = articles
    .map((a, i) => `<article index="${i}">\n<title>${a.title}</title>\n<summary>${a.summary}</summary>\n</article>`)
    .join("\n");

  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 8000,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(ClassifySchema) },
    messages: [
      {
        role: "user",
        content:
          `각 기사에 가장 알맞은 카테고리를 골라 index와 category를 반환해 주세요.\n` +
          `category는 반드시 아래 목록의 이름 중 하나를 그대로 쓰고, 맞는 것이 없으면 "미분류"로 씁니다.\n\n` +
          `<categories>\n${categoryList(categories)}\n</categories>\n\n${list}`,
      },
    ],
  });

  if (response.stop_reason === "refusal" || !response.parsed_output) {
    return articles.map(() => null);
  }
  const byIndex = new Map(response.parsed_output.items.map((it) => [it.index, it.category]));
  return articles.map((_, i) => byIndex.get(i) ?? null);
}

// ───────────────────────── Notion 저장 (MCP 커넥터) ─────────────────────────

export type NotionArticle = {
  titleKo: string;
  summaryKo: string;
  categoryName: string;
  sourceLabel: string;
  originalUrl: string;
  originalTitle: string;
  publishedAt: Date | null;
};

const NOTION_URL_RE = /https:\/\/(?:www\.)?notion\.so\/[^\s"'<>)\]]+/g;

/**
 * Claude API의 MCP 커넥터로 Notion 원격 MCP 서버에 연결해 페이지를 만든다.
 * 만들어진 페이지 URL을 돌려준다.
 */
export async function saveArticleToNotion(
  accessToken: string,
  article: NotionArticle,
  parentPageUrl: string | null,
): Promise<string> {
  const date = article.publishedAt ? article.publishedAt.toISOString().slice(0, 10) : "알 수 없음";
  const where = parentPageUrl
    ? `다음 Notion 페이지의 하위 페이지로 만드세요: ${parentPageUrl}`
    : "상위 페이지를 지정하지 않고 워크스페이스의 개인 페이지로 만드세요.";

  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 4096,
    betas: [MCP_BETA, FALLBACK_BETA],
    fallbacks: "default",
    output_config: { effort: "low" },
    mcp_servers: [
      { type: "url", url: NOTION_MCP_URL, name: "notion", authorization_token: accessToken },
    ],
    tools: [{ type: "mcp_toolset", mcp_server_name: "notion" }],
    messages: [
      {
        role: "user",
        content:
          `Notion 도구로 아래 뉴스를 새 페이지 하나로 저장하세요. ${where}\n` +
          `페이지 제목은 한국어 제목으로 하고, 본문에는 카테고리, 출처, 게시일, 원문 링크, 원문 제목, 요약을 보기 좋게 넣으세요. ` +
          `페이지를 만든 뒤에는 만들어진 페이지의 URL만 한 줄로 답하세요.\n\n` +
          `<news>\n한국어 제목: ${article.titleKo}\n카테고리: ${article.categoryName}\n출처: ${article.sourceLabel}\n` +
          `게시일: ${date}\n원문 링크: ${article.originalUrl}\n원문 제목: ${article.originalTitle}\n요약: ${article.summaryKo}\n</news>`,
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("Claude가 요청을 처리하지 못했습니다.");
  }

  // 1) 최종 답변 텍스트, 2) MCP 도구 결과 순으로 Notion URL을 찾는다.
  const texts: string[] = [];
  for (const block of response.content) {
    if (block.type === "text") texts.push(block.text);
  }
  for (const block of response.content) {
    if (block.type === "mcp_tool_result") {
      if (block.is_error) {
        const msg = typeof block.content === "string" ? block.content : block.content.map((c) => c.text).join(" ");
        console.error("[notion] MCP 도구 오류:", msg);
        continue;
      }
      texts.push(typeof block.content === "string" ? block.content : block.content.map((c) => c.text).join("\n"));
    }
  }
  for (const t of texts) {
    const match = t.match(NOTION_URL_RE);
    if (match) return match[0];
  }
  throw new Error("Notion 페이지를 만들지 못했습니다.");
}
