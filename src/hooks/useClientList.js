import { useState, useEffect, useMemo } from "react";

// The UI half of useStageList for pages whose data is still loaded in the browser
// (one fetch, then Pending / History split in JS). It returns the SAME shape, so a page
// moves to server paging later by swapping this hook for useStageList — the toolbar,
// table and columns do not change.
//
//   const list = useClientList({
//     key: "warehouse",                       // localStorage key for the column choice
//     data: { pending: pendingRows, history: historyRows },
//     loading: fetchLoading, error: loadError, onRetry: fetchData,
//     tabLabels: { pending: "Pending", history: "History" },
//     searchKeys: ["ticketId", "clientName", "companyName", "phoneNumber"],  // or (row) => string
//     filters: [{ key: "priority", label: "Priority", allLabel: "All Priorities",
//                 get: (row) => row.priority, tabs: ["history"] }],
//     columns: [{ key, label, defaultVisible, fixed, tabs, cell(row, {tab}), text(row), strong }],
//     sort: "reverse",                        // rows arrive oldest-first; show newest first
//   })
//
// Tab counts are the full tab sizes (like the server version), not the filtered size.
export { PAGE_SIZES } from "./useStageList";

const norm = (v) => String(v ?? "").toLowerCase();

function loadSaved(storageKey) {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (saved && typeof saved === "object" && !Array.isArray(saved)) return saved;
  } catch {
    /* ignore corrupt saved value */
  }
  return {};
}

export function useClientList({
  key,
  data,
  loading = false,
  error = null,
  onRetry,
  tabLabels = { pending: "Pending", history: "History" },
  searchKeys = [],
  filters: filterSpec = [],
  columns = [],
  sort = "reverse",
  defaultPageSize = 20,
  initialTab = Object.keys(data)[0],
}) {
  const tabIds = Object.keys(data);
  const [tab, setTabState] = useState(initialTab);
  const [search, setSearchState] = useState("");
  const [filterValues, setFilterValues] = useState(() => Object.fromEntries(filterSpec.map((f) => [f.key, "all"])));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(defaultPageSize);

  const resetPage = () => setPage(1);
  const setTab = (t) => { setTabState(t); resetPage(); };
  const setSearch = (v) => { setSearchState(v); resetPage(); };
  const setFilter = (k, v) => { setFilterValues((p) => ({ ...p, [k]: v })); resetPage(); };
  const setPageSize = (n) => { setPageSizeState(n); resetPage(); };
  const clearAll = () => {
    setSearchState("");
    setFilterValues(Object.fromEntries(filterSpec.map((f) => [f.key, "all"])));
    resetPage();
  };

  // ── data ────────────────────────────────────────────────────────────────
  const activeFilters = filterSpec.filter((f) => !f.tabs || f.tabs.includes(tab));
  const source = data[tab] || [];

  const filtered = useMemo(() => {
    const q = norm(search).trim();
    const matches = typeof searchKeys === "function"
      ? (row) => searchKeys(row).some((v) => norm(v).includes(q))
      : (row) => searchKeys.some((k) => norm(row[k]).includes(q));
    let rows = source.filter((row) => {
      if (q && !matches(row)) return false;
      for (const f of activeFilters) {
        const v = filterValues[f.key];
        if (v && v !== "all" && String(f.get(row) ?? "") !== v) return false;
      }
      return true;
    });
    if (typeof sort === "function") rows = [...rows].sort(sort);
    else if (sort === "reverse") rows = [...rows].reverse();
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, search, filterValues, tab, sort]);

  const filterOptions = Object.fromEntries(
    filterSpec.map((f) => {
      const all = tabIds.flatMap((t) => (!f.tabs || f.tabs.includes(t) ? data[t] || [] : []));
      return [f.key, Array.from(new Set(all.map((r) => f.get(r)).filter((v) => v !== "" && v != null).map(String))).sort()];
    })
  );

  const total = filtered.length;
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  // Keep the page in range if the data shrank underneath us (e.g. after a submit).
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);
  const rows = filtered.slice((page - 1) * pageSize, page * pageSize);

  // ── columns ─────────────────────────────────────────────────────────────
  const storageKey = `sss-columns:${key}`;
  const [saved, setSaved] = useState(() => loadSaved(storageKey));
  const persist = (next) => {
    setSaved(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* storage unavailable */ }
  };
  const tabColumns = columns.filter((c) => !c.tabs || c.tabs.includes(tab));
  const isVisible = (c) => c.fixed || (c.key in saved ? !!saved[c.key] : c.defaultVisible !== false);
  const visibleKeys = tabColumns.filter(isVisible).map((c) => c.key);
  const toggleColumn = (k) => persist({ ...saved, [k]: !visibleKeys.includes(k) });
  const resetColumns = () => {
    const next = { ...saved };
    for (const c of tabColumns) delete next[c.key];
    persist(next);
  };
  const activeColumns = tabColumns.filter(isVisible);

  const chips = [
    ...(search.trim() ? [{ key: "search", label: `Search: ${search.trim()}`, onRemove: () => setSearch("") }] : []),
    ...activeFilters
      .filter((f) => filterValues[f.key] && filterValues[f.key] !== "all")
      .map((f) => ({ key: f.key, label: `${f.label}: ${filterValues[f.key]}`, onRemove: () => setFilter(f.key, "all") })),
  ];

  const tabs = tabIds.map((id) => ({ id, label: tabLabels[id] ?? id, count: (data[id] || []).length }));

  return {
    tab, setTab, tabs,
    search, setSearch,
    filterSpec: activeFilters, filterValues, setFilter, filterOptions, chips, clearAll,
    page, setPage, pageSize, setPageSize, totalPages, total,
    allFiltered: filtered, // every row matching search/filters, for Export CSV
    rows,
    loading,
    fetching: loading,
    error,
    retry: onRetry,
    columnPanel: { columns: tabColumns, visibleKeys, onToggle: toggleColumn, onReset: resetColumns },
    activeColumns,
  };
}
