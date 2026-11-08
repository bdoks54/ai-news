import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { notionConnections } from "@/db/schema";
import { decrypt, encrypt } from "./crypto";

// Notion 원격 MCP 서버의 OAuth 메타데이터
// (https://mcp.notion.com/.well-known/oauth-authorization-server)
const AUTHORIZE_URL = "https://mcp.notion.com/authorize";
const TOKEN_URL = "https://mcp.notion.com/token";
const REGISTER_URL = "https://mcp.notion.com/register";

export const OAUTH_COOKIE = "notion_oauth";

export function redirectUri() {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/api/notion/oauth/callback`;
}

/** 동적 클라이언트 등록(RFC 7591). 비밀키 없는 공개 클라이언트 + PKCE 방식. */
export async function registerClient(): Promise<string> {
  const res = await fetch(REGISTER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: "AI News Collector",
      redirect_uris: [redirectUri()],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    }),
  });
  if (!res.ok) throw new Error(`Notion 클라이언트 등록 실패 (${res.status})`);
  const data = (await res.json()) as { client_id: string };
  return data.client_id;
}

export function createPkce() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const state = randomBytes(16).toString("base64url");
  return { verifier, challenge, state };
}

export function buildAuthorizeUrl(clientId: string, challenge: string, state: string) {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri());
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", state);
  return url.toString();
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
};

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  if (!res.ok) {
    throw new Error(`Notion 토큰 요청 실패 (${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as TokenResponse;
}

export async function exchangeCode(code: string, clientId: string, verifier: string) {
  return tokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(),
    client_id: clientId,
    code_verifier: verifier,
  });
}

export async function saveConnection(userId: string, clientId: string, token: TokenResponse) {
  const values = {
    clientId,
    accessToken: encrypt(token.access_token),
    refreshToken: token.refresh_token ? encrypt(token.refresh_token) : null,
    expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null,
    updatedAt: new Date(),
  };
  await db
    .insert(notionConnections)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: notionConnections.userId, set: values });
}

/** 저장된 토큰을 돌려준다. 만료가 가까우면 refresh token으로 갱신한다. */
export async function getValidAccessToken(userId: string) {
  const [conn] = await db
    .select()
    .from(notionConnections)
    .where(eq(notionConnections.userId, userId));
  if (!conn) return null;

  const expiringSoon = conn.expiresAt && conn.expiresAt.getTime() - Date.now() < 60_000;
  if (!expiringSoon) {
    return { accessToken: decrypt(conn.accessToken), parentPageUrl: conn.parentPageUrl };
  }
  if (!conn.refreshToken) return null;

  const token = await tokenRequest({
    grant_type: "refresh_token",
    refresh_token: decrypt(conn.refreshToken),
    client_id: conn.clientId,
  });
  // 새 refresh token이 오지 않으면 기존 것을 유지한다.
  await saveConnection(userId, conn.clientId, {
    ...token,
    refresh_token: token.refresh_token ?? decrypt(conn.refreshToken),
  });
  return { accessToken: token.access_token, parentPageUrl: conn.parentPageUrl };
}
