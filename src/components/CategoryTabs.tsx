import Link from "next/link";

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
    <div className="flex gap-2 overflow-x-auto pb-1">
      {all.map((t) => {
        const active = t.id === selected;
        return (
          <Link
            key={t.id}
            href={t.id === "all" ? "/" : `/?category=${t.id}`}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
              active
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
            }`}
          >
            {t.id !== "all" && (
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.color }} />
            )}
            {t.name}
            <span className={active ? "text-slate-300" : "text-slate-400"}>{t.count}</span>
          </Link>
        );
      })}
    </div>
  );
}
