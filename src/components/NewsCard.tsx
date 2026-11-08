"use client";

import Link from "next/link";
import { useState } from "react";

type Props = {
  id: string;
  title: string;
  summary: string;
  originalUrl: string;
  source: string;
  publishedAt: string | null;
  categoryName: string;
  categoryColor: string;
  notionPageUrl: string | null;
};

export default function NewsCard(props: Props) {
  const [notionUrl, setNotionUrl] = useState(props.notionPageUrl);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsConnect, setNeedsConnect] = useState(false);

  async function saveToNotion() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/notion/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId: props.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNeedsConnect(Boolean(data.needsConnect));
        throw new Error(data.error ?? "저장에 실패했습니다.");
      }
      setNotionUrl(data.notionPageUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  const date = props.publishedAt
    ? new Date(props.publishedAt).toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" })
    : null;

  return (
    <article className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2 text-xs">
        <span
          className="rounded-full px-2 py-0.5 font-medium"
          style={{ backgroundColor: `${props.categoryColor}1a`, color: props.categoryColor }}
        >
          {props.categoryName}
        </span>
        <span className="text-slate-400">
          {props.source}
          {date && ` · ${date}`}
        </span>
      </div>

      <h2 className="mb-2 font-semibold leading-snug text-slate-900">{props.title}</h2>
      <p className="mb-4 flex-1 whitespace-pre-line text-sm leading-relaxed text-slate-600">{props.summary}</p>

      <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3 text-sm">
        <a href={props.originalUrl} target="_blank" rel="noreferrer" className="text-slate-500 hover:text-slate-900">
          원문 보기 ↗
        </a>
        {notionUrl ? (
          <a href={notionUrl} target="_blank" rel="noreferrer" className="font-medium text-emerald-600 hover:text-emerald-500">
            Notion에서 열기 ↗
          </a>
        ) : (
          <button
            onClick={saveToNotion}
            disabled={saving}
            className="rounded-md border border-slate-300 px-3 py-1 font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
          >
            {saving ? "저장 중…" : "Notion 저장"}
          </button>
        )}
      </div>
      {error && (
        <p className="mt-2 text-xs text-red-600">
          {error}{" "}
          {needsConnect && (
            <Link href="/settings" className="underline">
              설정으로 이동
            </Link>
          )}
        </p>
      )}
    </article>
  );
}
