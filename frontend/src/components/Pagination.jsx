import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { Skeleton } from "./Loaders";
import "./Pagination.css";

const SIZES = [10, 20, 50, 100];

/** 1 … 4 5 [6] 7 8 … 20 */
const pageList = (page, pages) => {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const out = [1];
  const from = Math.max(2, page - 1);
  const to = Math.min(pages - 1, page + 1);
  if (from > 2) out.push("…l");
  for (let i = from; i <= to; i += 1) out.push(i);
  if (to < pages - 1) out.push("…r");
  out.push(pages);
  return out;
};

/**
 * Table footer for server-side pagination.
 * meta = { page, limit, total, pages, from, to } (comes from the API)
 */
export default function Pagination({
  meta,
  loading,
  limit,
  onPage,
  onLimit,
  label = "records",
}) {
  const page = meta?.page ?? 1;
  const pages = meta?.pages ?? 1;
  const total = meta?.total ?? 0;
  const go = (n) => {
    if (loading || n < 1 || n > pages || n === page) return;
    onPage(n);
  };

  return (
    <div className="pager">
      <div className="pager-info">
        {!meta ? (
          <Skeleton width={150} height={10} />
        ) : total === 0 ? (
          `No ${label}`
        ) : (
          <>
            Showing <b>{meta.from}</b>–<b>{meta.to}</b> of <b>{total}</b>{" "}
            {label}
          </>
        )}
      </div>
      <div className="pager-controls">
        <label className="pager-size">
          Rows
          <select
            value={limit}
            onChange={(e) => onLimit(Number(e.target.value))}
            aria-label="Rows per page"
          >
            {SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        {pages > 1 && (
          <nav className="pager-pages" aria-label="Pagination">
            <button
              type="button"
              title="First page"
              disabled={loading || page === 1}
              onClick={() => go(1)}
            >
              <ChevronsLeft size={14} />
            </button>
            <button
              type="button"
              title="Previous page"
              disabled={loading || page === 1}
              onClick={() => go(page - 1)}
            >
              <ChevronLeft size={14} />
            </button>
            {pageList(page, pages).map((n) =>
              typeof n === "string" ? (
                <span key={n} className="pager-gap">
                  …
                </span>
              ) : (
                <button
                  type="button"
                  key={n}
                  className={n === page ? "on" : ""}
                  aria-current={n === page ? "page" : undefined}
                  disabled={loading}
                  onClick={() => go(n)}
                >
                  {n}
                </button>
              ),
            )}
            <button
              type="button"
              title="Next page"
              disabled={loading || page === pages}
              onClick={() => go(page + 1)}
            >
              <ChevronRight size={14} />
            </button>
            <button
              type="button"
              title="Last page"
              disabled={loading || page === pages}
              onClick={() => go(pages)}
            >
              <ChevronsRight size={14} />
            </button>
          </nav>
        )}
      </div>
    </div>
  );
}
