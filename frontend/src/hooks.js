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
    reload();
  }, [reload]);
  return { rows, loading, reload };
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
