import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { categories, type Category } from "@/db/schema";

export const UNCATEGORIZED = "미분류";

const DEFAULT_CATEGORIES = [
  { name: "LLM/모델", description: "새 언어 모델, 모델 성능, 벤치마크, 오픈소스 모델 공개", color: "#6366f1" },
  { name: "비즈니스/투자", description: "투자 유치, 인수합병, 기업 실적, 시장 동향, 인사", color: "#10b981" },
  { name: "정책/규제", description: "정부 정책, 법률, 소송, 저작권, 안전 규제", color: "#f59e0b" },
  { name: "연구", description: "논문, 연구 성과, 새로운 기법", color: "#ec4899" },
  { name: "제품/도구", description: "AI 제품 출시, 기능 업데이트, 개발 도구, 앱", color: "#0ea5e9" },
  { name: "기타", description: "위 카테고리에 해당하지 않는 AI 관련 소식", color: "#64748b" },
];

/** 사용자의 카테고리 목록. 처음 사용하는 사용자에게는 기본 카테고리를 만들어 준다. */
export async function getOrCreateCategories(userId: string): Promise<Category[]> {
  const existing = await db
    .select()
    .from(categories)
    .where(eq(categories.userId, userId))
    .orderBy(asc(categories.createdAt), asc(categories.name));
  if (existing.length > 0) return existing;

  await db
    .insert(categories)
    .values(DEFAULT_CATEGORIES.map((c) => ({ ...c, userId })))
    .onConflictDoNothing();
  return db
    .select()
    .from(categories)
    .where(eq(categories.userId, userId))
    .orderBy(asc(categories.createdAt), asc(categories.name));
}

/** Claude가 고른 카테고리 이름을 id로 바꾼다. 목록에 없으면 null(미분류). */
export function resolveCategoryId(name: string | null | undefined, cats: Category[]): string | null {
  if (!name) return null;
  const normalized = name.trim().toLowerCase();
  return cats.find((c) => c.name.trim().toLowerCase() === normalized)?.id ?? null;
}
