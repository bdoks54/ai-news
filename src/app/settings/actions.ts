"use server";

import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { notionConnections } from "@/db/schema";

export async function saveParentPage(formData: FormData) {
  const { userId } = await auth();
  if (!userId) throw new Error("로그인이 필요합니다.");
  const raw = String(formData.get("parentPageUrl") ?? "").trim();
  const value = /^https:\/\/([\w-]+\.)?notion\.(so|site)\//.test(raw) ? raw : null;
  await db
    .update(notionConnections)
    .set({ parentPageUrl: value, updatedAt: new Date() })
    .where(eq(notionConnections.userId, userId));
  revalidatePath("/settings");
}

export async function disconnectNotion() {
  const { userId } = await auth();
  if (!userId) throw new Error("로그인이 필요합니다.");
  await db.delete(notionConnections).where(eq(notionConnections.userId, userId));
  revalidatePath("/settings");
}
