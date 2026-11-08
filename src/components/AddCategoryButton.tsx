"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import CategoryForm from "@/components/CategoryForm";

/** 카테고리 바 끝의 ‘+ 추가’ 버튼. 누르면 CategoryForm 팝오버를 연다. */
export default function AddCategoryButton() {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    wrapperRef.current?.querySelector<HTMLInputElement>('input[name="name"]')?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onPointerDown(e: PointerEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="카테고리 추가"
        aria-expanded={open}
        className="flex shrink-0 items-center gap-1 rounded-full border border-dashed border-slate-300 px-3 py-1.5 text-sm text-slate-500 transition hover:border-slate-500 hover:text-slate-900"
      >
        <span aria-hidden>＋</span> 추가
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="카테고리 추가"
          className="absolute right-0 z-20 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-4 shadow-lg"
        >
          <CategoryForm onDone={close} />
        </div>
      )}
    </div>
  );
}
