import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { articles } from "@/db/schema";
import { fetchAllFeeds } from "@/lib/rss";

export const maxDuration = 60;

/** 이 시간 안에 발행된 기사만 가져온다. */
const WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * 지난 24시간 동안의 RSS 기사를 파싱해 articles에 저장한다.
 * 번역·요약·분류는 아직 하지 않으므로 titleKo/summaryKo/categoryId는 null(미분류)로 둔다.
 */
export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { items, failed } = await fetchAllFeeds({ since: new Date(Date.now() - WINDOW_MS) });
  if (items.length === 0) {
    return NextResponse.json({ added: 0, skipped: 0, failedFeeds: failed });
  }

  // (userId, originalUrl) 유니크 제약으로 이미 저장된 기사는 건너뛴다.
  const inserted = await db
    .insert(articles)
    .values(
      items.map((item) => ({
        userId,
        source: item.source,
        originalUrl: item.url,
        originalTitle: item.title,
        author: item.author,
        snippet: item.snippet,
        publishedAt: item.publishedAt,
      })),
    )
    .onConflictDoNothing()
    .returning({ id: articles.id });

  return NextResponse.json({
    added: inserted.length,
    skipped: items.length - inserted.length,
    failedFeeds: failed,
  });
}
