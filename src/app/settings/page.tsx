import { auth } from "@clerk/nextjs/server";
import { checkNotionStatus } from "@/lib/notion";

export default async function SettingsPage() {
  const { userId } = await auth();
  if (!userId) return null;

  const status = await checkNotionStatus();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-xl font-bold">설정</h1>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <div>
          <h2 className="font-semibold">Notion 연결</h2>
          {status.ok ? (
            <p className="text-sm text-slate-500">
              연결됨 · 뉴스가{" "}
              <a
                href={status.databaseUrl}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-emerald-600 hover:text-emerald-500"
              >
                {status.databaseTitle} ↗
              </a>{" "}
              데이터베이스에 저장됩니다.
            </p>
          ) : (
            <p className="text-sm text-red-600">{status.reason}</p>
          )}
        </div>

        <div className="space-y-1 border-t border-slate-100 pt-4 text-sm text-slate-600">
          <p>Notion 저장은 서버의 환경 변수로 설정합니다.</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <code className="text-slate-900">NOTION_API_TOKEN</code>: Notion 내부 통합 토큰(<code>ntn_…</code>)
            </li>
            <li>
              <code className="text-slate-900">NOTION_DATABASE_ID</code>: 뉴스를 저장할 데이터베이스 id 또는 URL
            </li>
          </ul>
          <p className="text-slate-500">
            데이터베이스는 Notion에서 오른쪽 위 <span className="font-medium">⋯ → 연결</span>에 통합을 추가해야
            저장할 수 있습니다. 속성은 제목(제목), 요약(텍스트), 날짜(날짜), 출처(URL), 카테고리(선택)가 필요합니다. 환경 변수를 바꾼 뒤에는 서버를 다시 시작해 주세요.
          </p>
        </div>
      </section>
    </div>
  );
}
