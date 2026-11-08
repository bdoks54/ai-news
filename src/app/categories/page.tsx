import { auth } from "@clerk/nextjs/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { articles } from "@/db/schema";
import { getOrCreateCategories } from "@/lib/categories";
import CategoryForm from "@/components/CategoryForm";
import CategoryRow from "@/components/CategoryRow";
import ReclassifyButtons from "@/components/ReclassifyButtons";

export default async function CategoriesPage() {
  const { userId } = await auth();
  if (!userId) return null;

  const [cats, counts] = await Promise.all([
    getOrCreateCategories(userId),
    db
      .select({ categoryId: articles.categoryId, count: sql<number>`count(*)::int` })
      .from(articles)
      .where(eq(articles.userId, userId))
      .groupBy(articles.categoryId),
  ]);
  const countMap = new Map(counts.map((c) => [c.categoryId, c.count]));
  const uncategorized = countMap.get(null) ?? 0;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-xl font-bold">카테고리 관리</h1>
        <p className="text-sm text-slate-500">
          Claude는 카테고리 이름과 설명을 보고 뉴스를 분류합니다. 설명을 구체적으로 적을수록 분류가 정확해집니다.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 font-semibold">새 카테고리</h2>
        <CategoryForm />
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">카테고리 목록 ({cats.length})</h2>
        {cats.map((c) => (
          <CategoryRow key={c.id} category={c} count={countMap.get(c.id) ?? 0} />
        ))}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-1 font-semibold">재분류</h2>
        <p className="mb-4 text-sm text-slate-500">
          카테고리를 바꾼 뒤 현재 목록 기준으로 뉴스를 다시 분류합니다. 현재 미분류 뉴스: {uncategorized}건
        </p>
        <ReclassifyButtons />
      </section>
    </div>
  );
}
