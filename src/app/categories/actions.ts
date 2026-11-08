"use server";

import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { UNCATEGORIZED } from "@/lib/categories";

export type ActionState = { error?: string; ok?: boolean };

const CategoryInput = z.object({
  name: z
    .string()
    .trim()
    .min(1, "이름을 입력해 주세요.")
    .max(30, "이름은 30자 이내로 입력해 주세요.")
    .refine((v) => v !== UNCATEGORIZED, `‘${UNCATEGORIZED}’는 예약된 이름입니다.`),
  description: z.string().trim().max(200, "설명은 200자 이내로 입력해 주세요."),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "색상 값이 올바르지 않습니다."),
});

async function requireUser() {
  const { userId } = await auth();
  if (!userId) throw new Error("로그인이 필요합니다.");
  return userId;
}

function isUniqueViolation(e: unknown) {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code === "23505" || err?.cause?.code === "23505";
}

function parse(formData: FormData) {
  return CategoryInput.safeParse({
    name: formData.get("name") ?? "",
    description: formData.get("description") ?? "",
    color: formData.get("color") ?? "#6366f1",
  });
}

export async function createCategory(_: ActionState, formData: FormData): Promise<ActionState> {
  const userId = await requireUser();
  const parsed = parse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    await db.insert(categories).values({ userId, ...parsed.data });
  } catch (e) {
    if (isUniqueViolation(e)) return { error: "같은 이름의 카테고리가 이미 있습니다." };
    throw e;
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateCategory(_: ActionState, formData: FormData): Promise<ActionState> {
  const userId = await requireUser();
  const id = String(formData.get("id") ?? "");
  const parsed = parse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    await db
      .update(categories)
      .set(parsed.data)
      .where(and(eq(categories.id, id), eq(categories.userId, userId)));
  } catch (e) {
    if (isUniqueViolation(e)) return { error: "같은 이름의 카테고리가 이미 있습니다." };
    throw e;
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/** 삭제하면 이 카테고리의 뉴스는 FK(ON DELETE SET NULL)에 의해 미분류가 된다. */
export async function deleteCategory(formData: FormData) {
  const userId = await requireUser();
  const id = String(formData.get("id") ?? "");
  await db.delete(categories).where(and(eq(categories.id, id), eq(categories.userId, userId)));
  revalidatePath("/", "layout");
}
