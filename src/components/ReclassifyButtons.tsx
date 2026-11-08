"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ReclassifyButtons() {
  const router = useRouter();
  const [running, setRunning] = useState<null | "uncategorized" | "all">(null);
  const [message, setMessage] = useState<string | null>(null);

  async function run(scope: "uncategorized" | "all") {
    if (scope === "all" && !confirm("모든 뉴스를 다시 분류할까요? 뉴스가 많으면 시간이 걸립니다.")) return;
    setRunning(scope);
    setMessage(null);
    try {
      const res = await fetch("/api/news/reclassify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "재분류에 실패했습니다.");
      setMessage(`${data.total}건 중 ${data.updated}건 재분류 완료`);
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setRunning(null);
    }
  }

  const btn =
    "rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button className={btn} disabled={running !== null} onClick={() => run("uncategorized")}>
        {running === "uncategorized" ? "재분류 중…" : "미분류 뉴스 재분류"}
      </button>
      <button className={btn} disabled={running !== null} onClick={() => run("all")}>
        {running === "all" ? "재분류 중…" : "전체 뉴스 재분류"}
      </button>
      {message && <span className="text-sm text-slate-600">{message}</span>}
    </div>
  );
}
