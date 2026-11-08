import Link from "next/link";

type Props = {
  page: number;
  totalPages: number;
  /** 현재 카테고리 필터. "all"이면 쿼리에 넣지 않는다. */
  category: string;
};

const BASE = "flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-sm transition";
const IDLE = "border-slate-300 bg-white text-slate-700 hover:bg-slate-50";
const CURRENT = "border-slate-900 bg-slate-900 text-white";
const DISABLED = "border-slate-200 bg-white text-slate-300";

function href(category: string, page: number) {
  const params = new URLSearchParams();
  if (category !== "all") params.set("category", category);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/dashboard?${qs}` : "/dashboard";
}

/** 표시할 페이지 번호 목록. 첫·끝 페이지와 현재 페이지 앞뒤 1쪽을 보여 주고, 사이는 null(…)로 줄인다. */
function pageItems(page: number, totalPages: number): (number | null)[] {
  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const items: (number | null)[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) items.push(null);
    items.push(p);
  });
  return items;
}

/** 대시보드 카드 목록 아래의 페이지 이동. 페이지가 하나뿐이면 그리지 않는다. */
export default function Pagination({ page, totalPages, category }: Props) {
  if (totalPages <= 1) return null;

  return (
    <nav aria-label="페이지" className="flex items-center justify-center gap-1">
      {page > 1 ? (
        <Link href={href(category, page - 1)} className={`${BASE} ${IDLE}`}>
          이전
        </Link>
      ) : (
        <span className={`${BASE} ${DISABLED}`} aria-disabled="true">
          이전
        </span>
      )}

      {pageItems(page, totalPages).map((p, i) =>
        p === null ? (
          <span key={`gap-${i}`} className="px-1 text-sm text-slate-400" aria-hidden>
            …
          </span>
        ) : (
          <Link
            key={p}
            href={href(category, p)}
            className={`${BASE} ${p === page ? CURRENT : IDLE}`}
            aria-current={p === page ? "page" : undefined}
          >
            {p}
          </Link>
        ),
      )}

      {page < totalPages ? (
        <Link href={href(category, page + 1)} className={`${BASE} ${IDLE}`}>
          다음
        </Link>
      ) : (
        <span className={`${BASE} ${DISABLED}`} aria-disabled="true">
          다음
        </span>
      )}
    </nav>
  );
}
