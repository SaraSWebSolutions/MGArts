import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { getErrorMessage } from "./services/api";
import {
  customersApi,
  settingsApi,
  taxRatesApi,
  workersApi,
} from "./services/endpoints";

/** load a list on mount / when deps change; returns { rows, loading, reload } */
export function useList(fetcher, deps = []) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const latest = useRef(fetcher);
  useEffect(() => {
    latest.current = fetcher;
  });
  const key = JSON.stringify(deps);
  const reload = useCallback(async () => {
    try {
      setRows(await latest.current());
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to load"));
    } finally {
      setLoading(false);
    }
  }, [key]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch
  useEffect(() => {
    setRows([]);
    setLoading(true);
    reload();
  }, [reload]);
  return { rows, loading, reload };
}

/**
 * Server-side paginated list.
 * fetcher({ page, limit, search }) must return { rows, meta, summary } (api.page(...)).
 * deps = the filters; changing a filter / the search / the page size goes back to page 1.
 * `loading` is true while a response is on its way: rows is [] then, so the table
 * shows skeleton rows (and Stat / Pagination show their own loaders).
 */
export function usePaged(fetcher, deps = [], { pageSize = 10 } = {}) {
  const [data, setData] = useState({ rows: [], meta: null, summary: null });
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(pageSize);
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const latest = useRef(fetcher);
  const reqId = useRef(0);
  useEffect(() => {
    latest.current = fetcher;
  });

  // search box -> API call only after the user stops typing
  useEffect(() => {
    const t = setTimeout(() => setSearch(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  const filterKey = `${JSON.stringify(deps)}|${search}|${limit}`;
  const [pg, setPg] = useState({ k: filterKey, n: 1 });
  const page = pg.k === filterKey ? pg.n : 1; // any filter change -> page 1
  const setPage = useCallback((n) => setPg({ k: filterKey, n }), [filterKey]);

  const load = useCallback(
    async (silent = false) => {
      const id = ++reqId.current; // ignore answers that arrive late
      if (!silent) setLoading(true);
      try {
        const res = await latest.current({
          page,
          limit,
          ...(search ? { search } : {}),
        });
        if (id !== reqId.current) return;
        setData(res);
        if (res.meta && res.meta.page !== page) setPage(res.meta.page); // last page was emptied
      } catch (err) {
        if (id === reqId.current)
          toast.error(getErrorMessage(err, "Failed to load"));
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [page, limit, search, filterKey],
  );
  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, [load]);

  const reload = useCallback(() => load(true), [load]); // after save / delete: no flicker
  return {
    rows: loading ? [] : data.rows,
    meta: data.meta,
    summary: data.summary,
    loading,
    reload,
    page,
    setPage,
    limit,
    setLimit,
    q,
    setQ,
  };
}

/** run an API action with toast feedback; returns true on success */
export async function run(action, okMsg, failMsg) {
  try {
    await action();
    if (okMsg) toast.success(okMsg);
    return true;
  } catch (err) {
    toast.error(getErrorMessage(err, failMsg || "Action failed"));
    return false;
  }
}

/** customers / workers / tax rates for dropdowns */
export function useMasters() {
  const [m, setM] = useState({ customers: [], workers: [], taxRates: [] });
  useEffect(() => {
    Promise.all([customersApi.list(), workersApi.list(), taxRatesApi.list()])
      .then(([customers, workers, taxRates]) =>
        setM({ customers, workers, taxRates }),
      )
      .catch(() => {});
  }, []);
  return m;
}

export function useSettings() {
  const [settings, setSettings] = useState(null);
  useEffect(() => {
    settingsApi
      .get()
      .then(setSettings)
      .catch(() => {});
  }, []);
  return { settings };
}
