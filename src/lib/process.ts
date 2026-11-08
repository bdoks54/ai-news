import "server-only";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { articles } from "@/db/schema";
import { getOrCreateCategories, resolveCategoryId } from "@/lib/categories";
import { summarizeArticles } from "@/lib/claude";

const BATCH_SIZE = 10;
const CONCURRENCY = 3;

export type ProcessResult = { processed: number; failed: number; remaining: number };

/**
 * 아직 처리하지 않은 기사(titleKo가 null)를 Claude로 번역·요약·분류해 채운다.
 * 실패한 기사는 null로 남으므로 다음 호출 때 다시 시도된다.
 */
export async function processPendingArticles(
  userId: string,
  { limit = 30 }: { limit?: number } = {},
): Promise<ProcessResult> {
  const pendingWhere = and(eq(articles.userId, userId), isNull(articles.titleKo));

  const pending = await db
    .select({
      id: articles.id,
      title: articles.originalTitle,
      snippet: articles.snippet,
      url: articles.originalUrl,
    })
    .from(articles)
    .where(pendingWhere)
    .orderBy(desc(articles.publishedAt))
    .limit(limit);

  let processed = 0;
  let failed = 0;

  if (pending.length > 0) {
    const cats = await getOrCreateCategories(userId);
    const hints = cats.map((c) => ({ name: c.name, description: c.description }));

    const batches: (typeof pending)[] = [];
    for (let i = 0; i < pending.length; i += BATCH_SIZE) batches.push(pending.slice(i, i + BATCH_SIZE));

    // 동시에 CONCURRENCY개 묶음씩 Claude에 보낸다.
    for (let i = 0; i < batches.length; i += CONCURRENCY) {
      const group = batches.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(group.map((b) => summarizeArticles(b, hints)));

      for (let g = 0; g < group.length; g++) {
        const result = results[g];
        const batch = group[g];
        if (result.status === "rejected") {
          console.error("[process] 묶음 처리 실패:", result.reason);
          failed += batch.length;
          continue;
        }

        const updates = batch.flatMap((article, idx) => {
          const s = result.value[idx];
          if (!s) {
            failed++;
            return [];
          }
          return [
            db
              .update(articles)
              .set({
                titleKo: s.titleKo,
                summaryKo: s.summaryKo,
                categoryId: resolveCategoryId(s.category, cats),
              })
              .where(and(eq(articles.id, article.id), eq(articles.userId, userId))),
          ];
        });
        await Promise.all(updates);
        processed += updates.length;
      }
    }
  }

  const [{ value: remaining }] = await db.select({ value: count() }).from(articles).where(pendingWhere);
  return { processed, failed, remaining };
}
