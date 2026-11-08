import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { articles, categories } from "@/db/schema";
import { UNCATEGORIZED } from "@/lib/categories";
import { saveArticleToNotion } from "@/lib/claude";
import { getValidAccessToken } from "@/lib/notion-oauth";
import { SOURCE_LABEL } from "@/lib/rss";

export const maxDuration = 120;

const Body = z.object({ articleId: z.string().uuid() });

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });

  const [row] = await db
    .select({ article: articles, categoryName: categories.name })
    .from(articles)
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .where(and(eq(articles.id, parsed.data.articleId), eq(articles.userId, userId)));
  if (!row) return NextResponse.json({ error: "기사를 찾을 수 없습니다." }, { status: 404 });
  if (row.article.notionPageUrl) {
    return NextResponse.json({ notionPageUrl: row.article.notionPageUrl });
  }

  let conn;
  try {
    conn = await getValidAccessToken(userId);
  } catch (e) {
    console.error("[notion] 토큰 갱신 실패:", e);
    conn = null;
  }
  if (!conn) {
    return NextResponse.json(
      { error: "Notion이 연결되어 있지 않습니다. 설정에서 Notion을 연결해 주세요.", needsConnect: true },
      { status: 409 },
    );
  }

  try {
    const a = row.article;
    const url = await saveArticleToNotion(
      conn.accessToken,
      {
        titleKo: a.titleKo,
        summaryKo: a.summaryKo,
        categoryName: row.categoryName ?? UNCATEGORIZED,
        sourceLabel: SOURCE_LABEL[a.source],
        originalUrl: a.originalUrl,
        originalTitle: a.originalTitle,
        publishedAt: a.publishedAt,
      },
      conn.parentPageUrl,
    );
    await db.update(articles).set({ notionPageUrl: url }).where(eq(articles.id, a.id));
    return NextResponse.json({ notionPageUrl: url });
  } catch (e) {
    console.error("[notion] 저장 실패:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Notion 저장에 실패했습니다." },
      { status: 502 },
    );
  }
}
