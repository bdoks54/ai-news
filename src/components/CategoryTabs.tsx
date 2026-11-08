import Link from "next/link";
import AddCategoryButton from "@/components/AddCategoryButton";

type Tab = { id: string; name: string; color: string; count: number };

export default function CategoryTabs({
  tabs,
  selected,
  total,
}: {
  tabs: Tab[];
  selected: string;
  total: number;
}) {
  const all = [{ id: "all", name: "전체", color: "#0f172a", count: total }, ...tabs];
  return (
    <div className="flex items-start gap-2">
      {/* 탭만 가로 스크롤한다. 추가 버튼의 팝오버가 스크롤 영역에 잘리지 않도록 버튼은 바깥에 둔다. */}
      <nav aria-label="카테고리" className="flex min-w-0 gap-2 overflow-x-auto pb-1">
        {all.map((t) => {
          const active = t.id === selected;
          return (
            <Link
              key={t.id}
              href={t.id === "all" ? "/dashboard" : `/dashboard?category=${t.id}`}
              aria-current={active ? "page" : undefined}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
                active
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
              }`}
            >
              {t.id !== "all" && (
                <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: t.color }} />
              )}
              {t.name}
              <span className={active ? "text-slate-300" : "text-slate-400"}>{t.count}</span>
            </Link>
          );
        })}
      </nav>
      <AddCategoryButton />
    </div>
  );
}
