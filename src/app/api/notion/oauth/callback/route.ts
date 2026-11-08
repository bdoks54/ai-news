import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { exchangeCode, OAUTH_COOKIE, saveConnection } from "@/lib/notion-oauth";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  const settings = new URL("/settings", req.url);
  const fail = (reason: string) => {
    settings.searchParams.set("notion", "error");
    settings.searchParams.set("reason", reason);
    const res = NextResponse.redirect(settings);
    res.cookies.delete({ name: OAUTH_COOKIE, path: "/api/notion/oauth" });
    return res;
  };

  if (!userId) return fail("로그인이 필요합니다.");

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");
  if (error) return fail(error);

  let saved: { clientId: string; verifier: string; state: string; userId: string };
  try {
    saved = JSON.parse(req.cookies.get(OAUTH_COOKIE)?.value ?? "");
  } catch {
    return fail("인증 세션이 만료되었습니다. 다시 시도해 주세요.");
  }
  if (!code || !state || state !== saved.state || saved.userId !== userId) {
    return fail("인증 정보가 올바르지 않습니다.");
  }

  try {
    const token = await exchangeCode(code, saved.clientId, saved.verifier);
    await saveConnection(userId, saved.clientId, token);
  } catch (e) {
    console.error("[notion] 토큰 교환 실패:", e);
    return fail("Notion 토큰을 받지 못했습니다.");
  }

  settings.searchParams.set("notion", "connected");
  const res = NextResponse.redirect(settings);
  res.cookies.delete({ name: OAUTH_COOKIE, path: "/api/notion/oauth" });
  return res;
}
