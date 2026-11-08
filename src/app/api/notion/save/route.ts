import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { articles, categories } from "@/db/schema";
import { UNCATEGORIZED } from "@/lib/categories";
import { createNotionPage, getNotionConfig, NotionError } from "@/lib/notion";
import { SOURCE_LABEL } from "@/lib/rss";

export const maxDuration = 60;

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

  try {
    const { token, databaseId } = getNotionConfig();
    const a = row.article;
    const url = await createNotionPage(token, databaseId, {
      // 아직 번역 전이면 원문 제목·snippet으로 대체한다.
      titleKo: a.titleKo ?? a.originalTitle,
      summaryKo: a.summaryKo ?? a.snippet,
      categoryName: row.categoryName ?? UNCATEGORIZED,
      sourceLabel: SOURCE_LABEL[a.source],
      originalUrl: a.originalUrl,
      originalTitle: a.originalTitle,
      publishedAt: a.publishedAt,
    });
    await db
      .update(articles)
      .set({ notionPageUrl: url })
      .where(and(eq(articles.id, a.id), eq(articles.userId, userId)));
    return NextResponse.json({ notionPageUrl: url });
  } catch (e) {
    if (e instanceof NotionError) {
      return NextResponse.json(
        { error: e.message, needsConnect: e.needsSetup },
        { status: e.needsSetup ? 409 : 502 },
      );
    }
    console.error("[notion] 저장 실패:", e);
    return NextResponse.json({ error: "Notion 저장에 실패했습니다." }, { status: 502 });
  }
}
