import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { articles, categories } from "@/db/schema";
import { getOrCreateCategories } from "@/lib/categories";
import { SOURCE_LABEL } from "@/lib/rss";
import CategoryTabs from "@/components/CategoryTabs";
import FetchButton from "@/components/FetchButton";
import NewsCard from "@/components/NewsCard";
import Pagination from "@/components/Pagination";

export const metadata: Metadata = { title: "대시보드 · AI 뉴스 수집기" };

const UNCATEGORIZED_COLOR = "#94a3b8";

/** 한 페이지에 보여 줄 카드 수 (3열 × 3줄). */
const PAGE_SIZE = 9;

/** 메인 화면. articles와 categories를 조인해 최신순으로 카드 목록을 그린다. `/`는 여기로 리다이렉트된다. */
export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const { userId } = await auth();
  if (!userId) return null;

  const { category, page: pageParam } = await searchParams;
  const selected = typeof category === "string" ? category : "all";
  const requestedPage = typeof pageParam === "string" ? Number.parseInt(pageParam, 10) : 1;

  const cats = await getOrCreateCategories(userId);

  const filter =
    selected === "uncategorized"
      ? and(eq(articles.userId, userId), isNull(articles.categoryId))
      : cats.some((c) => c.id === selected)
        ? and(eq(articles.userId, userId), eq(articles.categoryId, selected))
        : eq(articles.userId, userId);

  // 카테고리별 개수를 먼저 구해 전체 페이지 수를 알아낸 뒤, 범위를 벗어난 page는 마지막 페이지로 맞춘다.
  const counts = await db
    .select({ categoryId: articles.categoryId, count: sql<number>`count(*)::int` })
    .from(articles)
    .where(eq(articles.userId, userId))
    .groupBy(articles.categoryId);

  const countMap = new Map(counts.map((c) => [c.categoryId ?? "uncategorized", c.count]));
  const total = counts.reduce((sum, c) => sum + c.count, 0);
  const isFiltered = selected === "uncategorized" || cats.some((c) => c.id === selected);
  const filteredTotal = isFiltered ? (countMap.get(selected) ?? 0) : total;
  const totalPages = Math.max(1, Math.ceil(filteredTotal / PAGE_SIZE));
  const page = Number.isFinite(requestedPage) ? Math.min(Math.max(requestedPage, 1), totalPages) : 1;

  const rows = await db
    .select({
      article: articles,
      categoryName: categories.name,
      categoryColor: categories.color,
    })
    .from(articles)
    // categories 쪽에도 userId 조건을 걸어 다른 사용자의 카테고리와는 절대 조인되지 않게 한다.
    .leftJoin(categories, and(eq(articles.categoryId, categories.id), eq(categories.userId, userId)))
    .where(filter)
    // 최신순: 발행일이 없는 기사는 맨 뒤로, 같은 발행일이면 늦게 저장된 순.
    // 같은 정렬 키가 겹쳐도 페이지 간 순서가 흔들리지 않도록 id를 마지막 정렬 키로 둔다.
    .orderBy(sql`${articles.publishedAt} desc nulls last`, desc(articles.createdAt), desc(articles.id))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">AI 뉴스</h1>
          <p className="text-sm text-slate-500">TechCrunch · The Verge의 AI 소식을 한국어로 요약했습니다.</p>
        </div>
        <FetchButton />
      </div>

      <CategoryTabs
        selected={selected}
        total={total}
        tabs={[
          ...cats.map((c) => ({ id: c.id, name: c.name, color: c.color, count: countMap.get(c.id) ?? 0 })),
          {
            id: "uncategorized",
            name: "미분류",
            color: UNCATEGORIZED_COLOR,
            count: countMap.get("uncategorized") ?? 0,
          },
        ]}
      />

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
          {total === 0
            ? "아직 가져온 뉴스가 없습니다. ‘뉴스 가져오기’ 버튼을 눌러 보세요."
            : "이 카테고리에 해당하는 뉴스가 없습니다."}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map(({ article: a, categoryName, categoryColor }) => (
            <NewsCard
              key={a.id}
              id={a.id}
              // 아직 번역 전이면 원문 제목·snippet을 보여 준다.
              title={a.titleKo ?? a.originalTitle}
              summary={a.summaryKo ?? a.snippet}
              originalUrl={a.originalUrl}
              source={SOURCE_LABEL[a.source]}
              publishedAt={a.publishedAt?.toISOString() ?? null}
              categoryName={categoryName ?? "미분류"}
              categoryColor={categoryColor ?? UNCATEGORIZED_COLOR}
              notionPageUrl={a.notionPageUrl}
            />
          ))}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} category={isFiltered ? selected : "all"} />
    </div>
  );
}
