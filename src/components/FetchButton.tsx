"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export default function FetchButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function handleClick() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/news/fetch", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "뉴스를 가져오지 못했습니다.");

      const parts = [`${data.added}건 추가됨`];
      if (data.failedArticles > 0) parts.push(`${data.failedArticles}건 처리 실패`);
      if (data.failedFeeds?.length > 0) parts.push(`${data.failedFeeds.join(", ")} 피드 실패`);
      setMessage(parts.join(" · "));
      startTransition(() => router.refresh());
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {message && <span className="text-sm text-slate-600">{message}</span>}
      <button
        onClick={handleClick}
        disabled={loading}
        className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-wait disabled:opacity-70"
      >
        {loading && (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
        )}
        {loading ? "가져오는 중… (최대 몇 분)" : "뉴스 가져오기"}
      </button>
    </div>
  );
}
