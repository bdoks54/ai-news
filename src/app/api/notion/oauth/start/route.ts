import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { buildAuthorizeUrl, createPkce, OAUTH_COOKIE, registerClient } from "@/lib/notion-oauth";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const clientId = await registerClient();
  const { verifier, challenge, state } = createPkce();

  const res = NextResponse.redirect(buildAuthorizeUrl(clientId, challenge, state));
  res.cookies.set(OAUTH_COOKIE, JSON.stringify({ clientId, verifier, state, userId }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/notion/oauth",
    maxAge: 600,
  });
  return res;
}
