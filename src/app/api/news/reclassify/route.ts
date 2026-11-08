import { auth } from "@clerk/nextjs/server";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { articles } from "@/db/schema";
import { getOrCreateCategories, resolveCategoryId } from "@/lib/categories";
import { classifyArticles } from "@/lib/claude";

export const maxDuration = 300;

const BATCH_SIZE = 25;
const Body = z.object({ scope: z.enum(["uncategorized", "all"]) });

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });

  const cats = await getOrCreateCategories(userId);
  const hints = cats.map((c) => ({ name: c.name, description: c.description }));

  const targets = await db
    .select({ id: articles.id, title: articles.titleKo, summary: articles.summaryKo })
    .from(articles)
    .where(
      parsed.data.scope === "uncategorized"
        ? and(eq(articles.userId, userId), isNull(articles.categoryId))
        : eq(articles.userId, userId),
    );

  let updated = 0;
  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = targets.slice(i, i + BATCH_SIZE);
    const names = await classifyArticles(batch, hints);

    // 같은 카테고리로 분류된 기사끼리 묶어서 한 번에 업데이트한다.
    const groups = new Map<string | null, string[]>();
    batch.forEach((a, idx) => {
      if (names[idx] === null) return; // 분류 실패는 기존 값 유지
      const catId = resolveCategoryId(names[idx], cats);
      groups.set(catId, [...(groups.get(catId) ?? []), a.id]);
    });
    for (const [categoryId, ids] of groups) {
      await db
        .update(articles)
        .set({ categoryId })
        .where(and(eq(articles.userId, userId), inArray(articles.id, ids)));
      updated += ids.length;
    }
  }

  return NextResponse.json({ total: targets.length, updated });
}
