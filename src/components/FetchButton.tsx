"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export default function FetchButton() {
  const router = useRouter();
  // null = 대기, "fetch" = RSS 수집 중, "process" = Claude 번역·요약 중
  const [stage, setStage] = useState<"fetch" | "process" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const loading = stage !== null;

  async function handleClick() {
    setStage("fetch");
    setMessage(null);
    const parts: string[] = [];
    try {
      // 1단계: RSS 기사를 원문 그대로 저장한다.
      const res = await fetch("/api/news/fetch", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "뉴스를 가져오지 못했습니다.");

      parts.push(`${data.added}건 추가됨`);
      if (data.skipped > 0) parts.push(`${data.skipped}건 이미 저장됨`);
      if (data.failedFeeds?.length > 0) parts.push(`${data.failedFeeds.join(", ")} 피드 실패`);

      // 2단계: 아직 처리하지 않은 기사를 번역·요약·분류한다.
      setStage("process");
      const pres = await fetch("/api/news/process", { method: "POST" });
      const pdata = await pres.json().catch(() => ({}));
      if (!pres.ok) {
        parts.push(pdata.error ?? "번역·요약에 실패했습니다.");
      } else {
        if (pdata.processed > 0) parts.push(`${pdata.processed}건 번역·요약 완료`);
        if (pdata.failed > 0) parts.push(`${pdata.failed}건 처리 실패`);
        if (pdata.remaining > 0) parts.push(`${pdata.remaining}건 대기 중`);
      }
      setMessage(parts.join(" · "));
      startTransition(() => router.refresh());
    } catch (e) {
      parts.push(e instanceof Error ? e.message : "오류가 발생했습니다.");
      setMessage(parts.join(" · "));
    } finally {
      setStage(null);
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
        {stage === "fetch" ? "가져오는 중…" : stage === "process" ? "번역·요약 중…" : "뉴스 가져오기"}
      </button>
    </div>
  );
}
