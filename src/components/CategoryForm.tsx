"use client";

import { useActionState, useEffect, useRef } from "react";
import { createCategory, updateCategory, type ActionState } from "@/app/categories/actions";

type Initial = { id: string; name: string; description: string; color: string };

export default function CategoryForm({
  initial,
  onDone,
}: {
  initial?: Initial;
  onDone?: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    initial ? updateCategory : createCategory,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      if (!initial) formRef.current?.reset();
      onDone?.();
    }
  }, [state, initial, onDone]);

  return (
    <form ref={formRef} action={action} className="space-y-3">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <div className="flex gap-2">
        <input
          type="color"
          name="color"
          defaultValue={initial?.color ?? "#6366f1"}
          className="h-10 w-12 shrink-0 cursor-pointer rounded border border-slate-300"
          aria-label="색상"
        />
        <input
          name="name"
          required
          maxLength={30}
          defaultValue={initial?.name}
          placeholder="카테고리 이름 (예: 로보틱스)"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <input
        name="description"
        maxLength={200}
        defaultValue={initial?.description}
        placeholder="분류 기준 설명 (예: 휴머노이드, 자율주행, 로봇 하드웨어)"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
      <div className="flex items-center gap-2">
        <button
          disabled={pending}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
        >
          {pending ? "저장 중…" : initial ? "저장" : "추가"}
        </button>
        {initial && (
          <button type="button" onClick={onDone} className="px-3 py-2 text-sm text-slate-500">
            취소
          </button>
        )}
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
