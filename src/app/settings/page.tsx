import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { notionConnections } from "@/db/schema";
import { disconnectNotion, saveParentPage } from "./actions";

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const { userId } = await auth();
  if (!userId) return null;

  const { notion, reason } = await searchParams;
  const [conn] = await db
    .select({ parentPageUrl: notionConnections.parentPageUrl, updatedAt: notionConnections.updatedAt })
    .from(notionConnections)
    .where(eq(notionConnections.userId, userId));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-xl font-bold">설정</h1>

      {notion === "connected" && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Notion이 연결되었습니다.</p>
      )}
      {notion === "error" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Notion 연결에 실패했습니다. {typeof reason === "string" ? reason : ""}
        </p>
      )}

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold">Notion 연결</h2>
            <p className="text-sm text-slate-500">
              {conn ? "연결됨 · 뉴스 카드의 ‘Notion 저장’ 버튼을 사용할 수 있습니다." : "연결되어 있지 않습니다."}
            </p>
          </div>
          {conn ? (
            <form action={disconnectNotion}>
              <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">연결 해제</button>
            </form>
          ) : (
            // OAuth 리다이렉트이므로 Link 대신 a 태그를 쓴다.
            <a
              href="/api/notion/oauth/start"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              Notion 연결하기
            </a>
          )}
        </div>

        {conn && (
          <form action={saveParentPage} className="space-y-2 border-t border-slate-100 pt-4">
            <label className="block text-sm font-medium" htmlFor="parentPageUrl">
              저장할 상위 페이지 URL
            </label>
            <p className="text-xs text-slate-500">
              뉴스가 이 페이지의 하위 페이지로 저장됩니다. 비워 두면 워크스페이스의 개인 페이지로 저장됩니다.
            </p>
            <div className="flex gap-2">
              <input
                id="parentPageUrl"
                name="parentPageUrl"
                defaultValue={conn.parentPageUrl ?? ""}
                placeholder="https://www.notion.so/..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <button className="shrink-0 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
                저장
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
