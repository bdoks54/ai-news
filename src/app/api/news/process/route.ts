import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { processPendingArticles } from "@/lib/process";

export const maxDuration = 300;

/** 저장만 되어 있고 아직 처리하지 않은 기사를 한국어로 번역·요약하고 카테고리를 분류한다. */
export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const result = await processPendingArticles(userId);
  return NextResponse.json(result);
}
