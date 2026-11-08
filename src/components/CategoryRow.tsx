"use client";

import { useCallback, useState } from "react";
import { deleteCategory } from "@/app/categories/actions";
import CategoryForm from "./CategoryForm";

type Category = { id: string; name: string; description: string; color: string };

export default function CategoryRow({ category, count }: { category: Category; count: number }) {
  const [editing, setEditing] = useState(false);
  const close = useCallback(() => setEditing(false), []);

  if (editing) {
    return (
      <div className="rounded-xl border border-indigo-200 bg-white p-4">
        <CategoryForm initial={category} onDone={close} />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
      <div className="min-w-0 flex-1">
        <div className="font-medium">
          {category.name} <span className="text-sm font-normal text-slate-400">{count}건</span>
        </div>
        {category.description && <p className="truncate text-sm text-slate-500">{category.description}</p>}
      </div>
      <button onClick={() => setEditing(true)} className="text-sm text-slate-600 hover:text-slate-900">
        수정
      </button>
      <form
        action={deleteCategory}
        onSubmit={(e) => {
          if (!confirm(`‘${category.name}’ 카테고리를 삭제할까요? 이 카테고리의 뉴스 ${count}건은 미분류로 이동합니다.`)) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="id" value={category.id} />
        <button className="text-sm text-red-600 hover:text-red-500">삭제</button>
      </form>
    </div>
  );
}
