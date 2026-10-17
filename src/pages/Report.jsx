import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Download } from "lucide-react";
import toast from "react-hot-toast";
import { Card, CardContent, CardHeader } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { supabase } from "../lib/supabase/client";
import {
  CATS,
  defaultRange,
  fetchQuotationReport,
  fetchSiteVisitSummary,
  fetchVideoCallSummary,
  fetchWeeklyReport,
  summarizeByEngineer,
  ymd,
} from "../lib/supabase/reportQueries";

const fmtDate = (raw) => {
  if (!raw) return "-";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return String(raw);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};
const fmtDateTime = (raw) => {
  if (!raw) return "-";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return String(raw);
  return `${fmtDate(d)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const inr = (v) => `₹${Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

async function exportSheet(filename, headers, rows) {
  if (rows.length === 0) {
    toast.error("No records to export");
    return;
  }
  const XLSX = await import("xlsx");
  const aoa = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = headers.map((h, i) => ({
    wch: Math.min(40, Math.max(String(h).length, ...rows.map((r) => String(r[i] ?? "").length)) + 2),
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  XLSX.writeFile(wb, `${filename}_${ymd(new Date())}.xlsx`);
}

const TABS = [
  { id: "weekly", label: "Weekly Report" },
  { id: "video", label: "Video-Call Summary" },
  { id: "site", label: "Site Visits" },
  { id: "quotation", label: "Quotations" },
];

function DateRange({ range, setRange, onReset }) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col">
        <span className="text-[10px] text-gray-500">From</span>
        <Input
          type="date"
          className="h-10 w-[150px] bg-white border-blue-200"
          value={range.from}
          max={range.to || undefined}
          onChange={(e) => setRange({ ...range, from: e.target.value })}
        />
      </div>
      <div className="flex flex-col">
        <span className="text-[10px] text-gray-500">To</span>
        <Input
          type="date"
          className="h-10 w-[150px] bg-white border-blue-200"
          value={range.to}
          min={range.from || undefined}
          onChange={(e) => setRange({ ...range, to: e.target.value })}
        />
      </div>
      <Button variant="outline" className="h-10" onClick={onReset}>
        Reset
      </Button>
    </div>
  );
}

function StatCard({ label, value, tone = "blue" }) {
  const tones = {
    blue: "border-blue-200 text-blue-700",
    green: "border-green-200 text-green-700",
    amber: "border-amber-200 text-amber-700",
    purple: "border-purple-200 text-purple-700",
  };
  return (
    <div className={`rounded-xl border bg-white px-4 py-3 shadow-sm ${tones[tone]}`}>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

const Loading = () => (
  <div className="flex items-center justify-center py-12">
    <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
  </div>
);

// ───────────────────────── Weekly ─────────────────────────

function WeeklyTab({ range, reloadKey }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!range.from || !range.to) return;
    let cancelled = false;
    setLoading(true);
    fetchWeeklyReport(supabase, range)
      .then((d) => !cancelled && setData(d))
      .catch((e) => {
        console.error(e);
        toast.error("Failed to load weekly report");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [range.from, range.to, reloadKey]);

  const rows = useMemo(() => {
    if (!data) return [];
    const r = data.result;
    const sum = (key) => CATS.reduce((a, c) => a + r[c][key], 0);
    const conv = (c) => {
      const p = c === "TOTAL" ? sum("tillDatePending") : r[c].tillDatePending;
      const b = c === "TOTAL" ? sum("totalBilling") : r[c].totalBilling;
      return p === 0 ? "-" : `${((b / p) * 100).toFixed(1)}%`;
    };
    const val = (c, key) => (c === "TOTAL" ? sum(key) : r[c][key]);
    const noInvoiceValue = (c) => c === "OTHER" || c === "NON NABL";
    // TOTAL for invoice value only covers categories that have a dedicated
    // amount column (SPARE/SERVICE/NABL).
    const invTotal = ["SPARE", "SERVICE", "NABL"].reduce((a, c) => a + r[c].invoiceValue, 0);
    const invBilling = ["SPARE", "SERVICE", "NABL"].reduce((a, c) => a + r[c].totalBilling, 0);
    return [
      { label: "OUTGOING ENQUIRIES", get: (c) => val(c, "outgoingEnq") },
      { label: "↳ Total Value", sub: true, get: (c) => inr(val(c, "outgoingValue")) },
      { label: "INCOMING ENQUIRIES", get: (c) => val(c, "incomingEnq") },
      { label: "↳ Total Value", sub: true, get: (c) => inr(val(c, "incomingValue")) },
      { label: "TILL DATE PENDING ENQ", note: "(last 60 days)", get: (c) => val(c, "tillDatePending") },
      { label: "↳ Total Value", sub: true, get: (c) => inr(val(c, "tillDatePendingValue")) },
      { label: "TOTAL NO. BILLING", get: (c) => val(c, "totalBilling") },
      { label: "CONVERSION %", get: conv },
      {
        label: "INVOICE VALUE",
        get: (c) => (c === "TOTAL" ? inr(invTotal) : noInvoiceValue(c) ? "-" : inr(r[c].invoiceValue)),
      },
      {
        label: "AVG TCK SIZE",
        get: (c) => {
          if (c === "TOTAL") return invBilling === 0 ? "-" : inr(invTotal / invBilling);
          if (noInvoiceValue(c) || r[c].totalBilling === 0) return "-";
          return inr(r[c].invoiceValue / r[c].totalBilling);
        },
      },
    ];
  }, [data]);

  const columns = [...CATS, "TOTAL"];

  const handleExport = () =>
    exportSheet(
      "Weekly_Report",
      ["Metric", ...columns],
      rows.map((row) => [row.label.replace("↳ ", ""), ...columns.map((c) => row.get(c))])
    );

  return (
    <>
      <div className="flex items-center justify-between px-4 py-2">
        <p className="text-xs text-gray-400">
          {data ? `${fmtDate(data.start)} – ${fmtDate(data.end)}` : ""} · TILL DATE PENDING ENQ always
          reflects the last 60 days · OTHER = mixed categories (e.g. SPARE AND SERVICE)
        </p>
        <Button size="sm" variant="outline" onClick={handleExport} disabled={!data}>
          <Download className="mr-1 h-4 w-4" /> Export
        </Button>
      </div>
      {loading || !data ? (
        <Loading />
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-800 hover:bg-slate-800">
              <TableHead className="w-[210px] py-3 text-xs font-bold text-white">CATEGORY</TableHead>
              {columns.map((c) => (
                <TableHead key={c} className="py-3 text-center text-xs font-bold text-white">
                  {c}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => (
              <TableRow
                key={i}
                className={row.sub ? "bg-gray-50/20 border-l-2 border-l-blue-400/50" : i % 2 === 0 ? "bg-white" : "bg-gray-50/60"}
              >
                <TableCell className={`py-2.5 text-xs ${row.sub ? "pl-6 font-medium text-gray-500" : "font-semibold text-gray-700"}`}>
                  {row.label}
                  {row.note && <span className="ml-1 text-[10px] font-normal text-gray-400">{row.note}</span>}
                </TableCell>
                {columns.map((c) => (
                  <TableCell
                    key={c}
                    className={`py-2.5 text-center text-xs ${c === "TOTAL" ? "font-bold" : "font-medium"} text-gray-600`}
                  >
                    {row.get(c)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}

// ───────────────────────── Video-Call / Site visits ─────────────────────────

function AssignmentTab({ kind, range, reloadKey }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [engineer, setEngineer] = useState("all");
  const isVideo = kind === "video";

  useEffect(() => {
    if (!range.from || !range.to) return;
    let cancelled = false;
    setLoading(true);
    (isVideo ? fetchVideoCallSummary : fetchSiteVisitSummary)(supabase, range)
      .then((d) => {
        if (!cancelled) {
          setRows(d);
          setEngineer("all");
        }
      })
      .catch((e) => {
        console.error(e);
        toast.error("Failed to load report");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [kind, range.from, range.to, reloadKey]);

  const engineers = useMemo(() => [...new Set(rows.map((r) => r.engineer))].sort((a, b) => a.localeCompare(b)), [rows]);
  const filtered = useMemo(() => (engineer === "all" ? rows : rows.filter((r) => r.engineer === engineer)), [rows, engineer]);
  const byEngineer = useMemo(() => summarizeByEngineer(filtered), [filtered]);
  const completed = filtered.filter((r) => r.completed).length;

  const doneLabel = isVideo ? "Video-Call Done" : "OTP Verified";
  const handleExport = () =>
    exportSheet(
      isVideo ? "Video_Call_Summary" : "Site_Visit_Summary",
      ["Ticket ID", "Company Name", "Client Name", "Engineer", isVideo ? "Video-Call Planned" : "Site Visit Planned", "Status", isVideo ? "Video-Call Done At" : "OTP Verified At"],
      filtered.map((r) => [
        r.ticketId,
        r.companyName,
        r.clientName,
        r.engineer,
        fmtDateTime(r.plannedAt),
        r.completed ? "Completed" : "Pending",
        r.completed ? fmtDateTime(r.completedAt) : "",
      ])
    );

  return (
    <div className="space-y-4 px-4 pb-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex items-end gap-2">
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-500">Engineer</span>
            <select
              className="h-10 w-[220px] rounded-md border border-blue-200 bg-white px-3 text-sm shadow-sm"
              value={engineer}
              onChange={(e) => setEngineer(e.target.value)}
            >
              <option value="all">All Engineers</option>
              {engineers.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>
          <span className="pb-2 text-xs font-medium text-blue-700">
            Showing {filtered.length} of {rows.length}
          </span>
        </div>
        <Button size="sm" variant="outline" onClick={handleExport} disabled={loading}>
          <Download className="mr-1 h-4 w-4" /> Export
        </Button>
      </div>

      {loading ? (
        <Loading />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard label={isVideo ? "Assigned (planned in range)" : "Visits Assigned (planned in range)"} value={filtered.length} />
            <StatCard label={isVideo ? "Completed" : "Completed (OTP verified)"} value={completed} tone="green" />
            <StatCard label="Pending" value={filtered.length - completed} tone="amber" />
          </div>

          <div className="overflow-x-auto rounded-lg border border-blue-100 bg-white">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-800 hover:bg-slate-800">
                  {["Engineer", "Assigned", "Completed", "Pending"].map((h) => (
                    <TableHead key={h} className="text-xs font-bold text-white">
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {byEngineer.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-center text-sm text-gray-400">
                      No records in this range
                    </TableCell>
                  </TableRow>
                ) : (
                  byEngineer.map((e) => (
                    <TableRow key={e.engineer}>
                      <TableCell className="text-sm font-medium">{e.engineer}</TableCell>
                      <TableCell className="text-sm">{e.assigned}</TableCell>
                      <TableCell className="text-sm text-green-700">{e.completed}</TableCell>
                      <TableCell className="text-sm text-amber-700">{e.pending}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="max-h-[50vh] overflow-auto rounded-lg border border-blue-100 bg-white">
            <Table>
              <TableHeader className="sticky top-0">
                <TableRow className="bg-slate-800 hover:bg-slate-800">
                  {["Ticket ID", "Company Name", "Engineer", isVideo ? "Video-Call Planned" : "Site Visit Planned", "Status", doneLabel].map((h) => (
                    <TableHead key={h} className="text-xs font-bold text-white">
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.ticketId}>
                    <TableCell className="text-sm">{r.ticketId}</TableCell>
                    <TableCell className="text-sm">{r.companyName || "-"}</TableCell>
                    <TableCell className="text-sm">{r.engineer}</TableCell>
                    <TableCell className="text-sm">{fmtDateTime(r.plannedAt)}</TableCell>
                    <TableCell className="text-sm">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${r.completed ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                        {r.completed ? "Completed" : "Pending"}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{r.completed ? fmtDateTime(r.completedAt) : "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}

// ───────────────────────── Quotations ─────────────────────────

function QuotationTab({ range, reloadKey }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [type, setType] = useState("all");

  useEffect(() => {
    if (!range.from || !range.to) return;
    let cancelled = false;
    setLoading(true);
    fetchQuotationReport(supabase, range)
      .then((d) => !cancelled && setRows(d))
      .catch((e) => {
        console.error(e);
        toast.error("Failed to load quotations");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [range.from, range.to, reloadKey]);

  const created = rows.filter((r) => r.type === "Created").length;
  const revised = rows.length - created;
  const filtered = type === "all" ? rows : rows.filter((r) => r.type === type);

  const handleExport = () =>
    exportSheet(
      "Quotation_Report",
      ["Quotation Number", "Type", "Company Name", "Quotation Copy", "Prepared By", "Created At"],
      filtered.map((r) => [r.quotationNo, r.type, r.companyName, r.pdfUrl, r.preparedBy, fmtDateTime(r.createdAt)])
    );

  return (
    <div className="space-y-4 px-4 pb-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex items-end gap-2">
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-500">Type</span>
            <select
              className="h-10 w-[160px] rounded-md border border-blue-200 bg-white px-3 text-sm shadow-sm"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="all">All</option>
              <option value="Created">Created</option>
              <option value="Revised">Revised</option>
            </select>
          </div>
          <span className="pb-2 text-xs font-medium text-blue-700">
            Showing {filtered.length} of {rows.length}
          </span>
        </div>
        <Button size="sm" variant="outline" onClick={handleExport} disabled={loading}>
          <Download className="mr-1 h-4 w-4" /> Export
        </Button>
      </div>

      {loading ? (
        <Loading />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Total" value={rows.length} />
            <StatCard label="Created" value={created} tone="green" />
            <StatCard label="Revised" value={revised} tone="purple" />
          </div>
          <div className="max-h-[60vh] overflow-auto rounded-lg border border-blue-100 bg-white">
            <Table>
              <TableHeader className="sticky top-0">
                <TableRow className="bg-slate-800 hover:bg-slate-800">
                  {["Quotation Number", "Type", "Quotation Copy", "Company Name", "Created At"].map((h) => (
                    <TableHead key={h} className="text-xs font-bold text-white">
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-center text-sm text-gray-400">
                      No quotations in this range
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r) => (
                    <TableRow key={r.quotationNo}>
                      <TableCell className="text-sm font-medium">{r.quotationNo}</TableCell>
                      <TableCell className="text-sm">
                        <span className={`rounded-full px-2 py-0.5 text-xs ${r.type === "Created" ? "bg-green-100 text-green-800" : "bg-purple-100 text-purple-800"}`}>
                          {r.type}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.pdfUrl ? (
                          <a href={r.pdfUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                            View
                          </a>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{r.companyName || "-"}</TableCell>
                      <TableCell className="text-sm">{fmtDateTime(r.createdAt)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}

// ───────────────────────── Page ─────────────────────────

export default function Report() {
  const [activeTab, setActiveTab] = useState("weekly");
  // Each tab keeps its own range; the Quotations tab defaults to today, the
  // rest to the last 7 days. Only the open tab queries (and only on first
  // open or when its own range changes).
  const [ranges, setRanges] = useState(() => ({
    weekly: defaultRange(7),
    video: defaultRange(7),
    site: defaultRange(7),
    quotation: defaultRange(1),
  }));
  const [reloadKeys, setReloadKeys] = useState({ weekly: 0, video: 0, site: 0, quotation: 0 });
  const [opened, setOpened] = useState({ weekly: true });

  const switchTab = useCallback((t) => {
    setActiveTab(t);
    setOpened((o) => ({ ...o, [t]: true }));
  }, []);

  const setRange = (tab) => (r) => setRanges((prev) => ({ ...prev, [tab]: r }));
  const resetRange = (tab) => () => setRange(tab)(defaultRange(tab === "quotation" ? 1 : 7));

  const range = ranges[activeTab];

  return (
    <div className="space-y-2">
      <Tabs value={activeTab} onValueChange={switchTab} className="w-full">
        <Card className="border-0 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-lg">
          <CardHeader className="flex flex-col items-center justify-between gap-4 rounded-t-lg border-b border-blue-100 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 px-6 py-4 md:flex-row">
            <TabsList className="border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              {TABS.map((t) => (
                <TabsTrigger
                  key={t.id}
                  value={t.id}
                  className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                >
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
            <DateRange range={range} setRange={setRange(activeTab)} onReset={resetRange(activeTab)} />
          </CardHeader>
          <CardContent className="p-0 pt-2">
            {activeTab === "weekly" && opened.weekly && <WeeklyTab range={ranges.weekly} reloadKey={reloadKeys.weekly} />}
            {activeTab === "video" && opened.video && <AssignmentTab kind="video" range={ranges.video} reloadKey={reloadKeys.video} />}
            {activeTab === "site" && opened.site && <AssignmentTab kind="site" range={ranges.site} reloadKey={reloadKeys.site} />}
            {activeTab === "quotation" && opened.quotation && <QuotationTab range={ranges.quotation} reloadKey={reloadKeys.quotation} />}
          </CardContent>
        </Card>
      </Tabs>
    </div>
  );
}
