import { auth } from "@clerk/nextjs/server";
import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { articles } from "@/db/schema";
import { getOrCreateCategories, resolveCategoryId } from "@/lib/categories";
import { summarizeArticles } from "@/lib/claude";
import { fetchAllFeeds } from "@/lib/rss";

export const maxDuration = 300;

const BATCH_SIZE = 10;
const CONCURRENCY = 3;

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const cats = await getOrCreateCategories(userId);
  const { items, failed } = await fetchAllFeeds();
  if (items.length === 0) {
    return NextResponse.json({ added: 0, failedFeeds: failed });
  }

  // 이미 저장된 기사는 건너뛴다.
  const existing = await db
    .select({ url: articles.originalUrl })
    .from(articles)
    .where(and(eq(articles.userId, userId), inArray(articles.originalUrl, items.map((i) => i.url))));
  const existingUrls = new Set(existing.map((e) => e.url));
  const fresh = items.filter((i) => !existingUrls.has(i.url));

  const batches: (typeof fresh)[] = [];
  for (let i = 0; i < fresh.length; i += BATCH_SIZE) batches.push(fresh.slice(i, i + BATCH_SIZE));

  let added = 0;
  let failedArticles = 0;
  const hints = cats.map((c) => ({ name: c.name, description: c.description }));

  // 동시에 CONCURRENCY개 묶음씩 Claude에 보낸다.
  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    const group = batches.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(group.map((b) => summarizeArticles(b, hints)));

    for (let g = 0; g < group.length; g++) {
      const result = results[g];
      const batch = group[g];
      if (result.status === "rejected") {
        console.error("[fetch] 요약 묶음 실패:", result.reason);
        failedArticles += batch.length;
        continue;
      }
      const rows = batch.flatMap((item, idx) => {
        const s = result.value[idx];
        if (!s) {
          failedArticles++;
          return [];
        }
        return [
          {
            userId,
            source: item.source,
            originalUrl: item.url,
            originalTitle: item.title,
            author: item.author,
            titleKo: s.titleKo,
            summaryKo: s.summaryKo,
            publishedAt: item.publishedAt,
            categoryId: resolveCategoryId(s.category, cats),
          },
        ];
      });
      if (rows.length > 0) {
        const inserted = await db
          .insert(articles)
          .values(rows)
          .onConflictDoNothing()
          .returning({ id: articles.id });
        added += inserted.length;
      }
    }
  }

  return NextResponse.json({ added, failedArticles, failedFeeds: failed });
}
