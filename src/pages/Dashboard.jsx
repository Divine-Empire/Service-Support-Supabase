import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Loader2, PhoneCall, FileText } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import toast from "react-hot-toast";
import { supabase } from "../lib/supabase/client";

// The 5 stages this dashboard has always covered (1:1 with the legacy
// sheet-based version — NOT every migrated stage; see project memory for
// the "expand coverage later" note). Each stage's own page implements the
// authoritative pending/history logic; this dashboard mirrors it rather
// than reinventing it, so keep these two in sync if a stage's rule changes.
const serviceStages = [
  { id: 2, name: "Video Call Solution", color: "bg-purple-500", route: "/videocall" },
  { id: 4, name: "Quotation", color: "bg-cyan-500", route: "/quotation" },
  { id: 5, name: "Follow-Up", color: "bg-teal-500", route: "/followup" },
  { id: 6, name: "Site Visit Plan", color: "bg-emerald-500", route: "/siteplan" },
  { id: 7, name: "Invoice", color: "bg-amber-500", route: "/invoice" },
];

// Fallback "who owns this stage" map for the PDF report, used only when
// tat_config.responsible_person (migration 0047, admin-editable via Master
// > TAT Config) hasn't been filled in yet for that stage. The legacy
// version fuzzy-matched literal Google Sheet header-row text, which has no
// Supabase equivalent at all.
const STAGE_RESPONSIBLE = {
  "Video Call Solution": "PIYUSH TIWARI / Assigned Engineer",
  "Quotation": "PIYUSH TIWARI",
  "Follow-Up": "PIYUSH TIWARI",
  "Site Visit Plan": "PIYUSH TIWARI",
  "Invoice": "Accountant",
};

// Dashboard's own stage display names don't always match tat_config's
// stage_name values 1:1 (e.g. "Video Call Solution" here vs "Video-Call" in
// tat_config) — this crosswalks the two. Site Visit Plan has no TAT-driven
// planned column at all (see stagePlanning.js), so it has no tat_config
// entry and always falls back to STAGE_RESPONSIBLE.
const TAT_CONFIG_STAGE_NAME = {
  "Video Call Solution": "Video-Call",
  "Quotation": "Quotation",
  "Follow-Up": "Follow-Up",
  "Site Visit Plan": null,
  "Invoice": "Invoice",
};

function getRoleAndUser() {
  const userName = localStorage.getItem("currentUsername");
  const roleStorage = localStorage.getItem("o2d-auth-storage");
  const parsedData = roleStorage ? JSON.parse(roleStorage) : null;
  const role = parsedData?.state?.user?.role;
  return { userName, role };
}

function filterByRole(rows) {
  return rows;
}


export default function Dashboard() {
  const navigate = useNavigate();

  const [fetchLoading, setFetchLoading] = useState(false);
  const [allTicketsCount, setAllTicketsCount] = useState(0);
  const [quotationPendingCount, setQuotationPendingCount] = useState(0);
  const [siteVisitPendingCount, setSiteVisitPendingCount] = useState(0);
  const [invoicePendingCount, setInvoicePendingCount] = useState(0);
  const [stageCounts, setStageCounts] = useState({});
  const [stageOverdueCounts, setStageOverdueCounts] = useState({});
  const [followUpCategoryBreakdown, setFollowUpCategoryBreakdown] = useState({});
  // Detail rows for the PDF report's per-stage pages — only Follow-Up and
  // Site Visit Plan ever get a "Detailed Report" page (see report-pdf.jsx).
  // Collected here (once, in fetchData) so Generate Report doesn't need its
  // own independent re-fetch — the legacy version fetched+re-parsed the
  // whole sheet a third time just for this button.
  const [followUpDetailRows, setFollowUpDetailRows] = useState([]);
  const [siteVisitDetailRows, setSiteVisitDetailRows] = useState([]);
  const [responsiblePersonByStage, setResponsiblePersonByStage] = useState({});
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  const formatDate = (raw) => {
    if (!raw) return "-";
    const d = new Date(raw);
    if (isNaN(d.getTime())) return String(raw);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  };

  const fetchData = async () => {
    setFetchLoading(true);
    try {
      const { userName, role } = getRoleAndUser();

      const { data: ticketsRaw, error: ticketsError } = await supabase
        .from("sss_tickets")
        .select("ticket_id, cre_name, engineer_assign, category, company_name, site_address, warranty_check_planned, created_at");
      if (ticketsError) throw ticketsError;

      const tickets = filterByRole(ticketsRaw || [], role, userName);
      setAllTicketsCount(tickets.length);

      const [
        { data: warrantyRows, error: e1 },
        { data: videoCallRows, error: e2 },
        { data: quotationRows, error: e3 },
        { data: followUpRows, error: e4 },
        { data: siteVisitRows, error: e5 },
        { data: crmVerificationRows, error: e6 },
        { data: invoiceRows, error: e7 },
        { data: tatConfigRows, error: e10 },
      ] = await Promise.all([
        supabase.from("sss_warranty_check").select("ticket_id, video_call_planned, quotation_planned"),
        supabase.from("sss_video_call").select("ticket_id, enquiry_solved, created_at").order("created_at", { ascending: true }),
        supabase.from("sss_quotation").select("ticket_id, follow_up_planned, basic_amount"),
        supabase.from("sss_follow_up").select("ticket_id, stage, site_visit_planned, invoice_planned, what_did_customer_say, next_date_of_call, created_at").order("created_at", { ascending: true }),
        supabase.from("sss_site_visit").select("ticket_id"),
        supabase.from("sss_crm_verification").select("ticket_id, invoice_planned"),
        supabase.from("sss_invoice").select("ticket_id"),
        supabase.from("sss_tat_config").select("stage_name, responsible_person"),
      ]);
      for (const err of [e1, e2, e3, e4, e5, e6, e7, e10]) if (err) throw err;

      // Admin-editable per-stage owner (Master > TAT Config) — falls back to
      // STAGE_RESPONSIBLE when a stage has no tat_config row, or the row
      // exists but responsible_person was never filled in.
      const responsiblePersonByTatStageName = new Map(
        (tatConfigRows || []).map((r) => [r.stage_name, r.responsible_person])
      );
      const responsibleMap = {};
      serviceStages.forEach((s) => {
        const tatStageName = TAT_CONFIG_STAGE_NAME[s.name];
        responsibleMap[s.name] =
          (tatStageName && responsiblePersonByTatStageName.get(tatStageName)) || STAGE_RESPONSIBLE[s.name] || "-";
      });
      setResponsiblePersonByStage(responsibleMap);

      const warrantyByTicket = new Map((warrantyRows || []).map((w) => [w.ticket_id, w]));

      // video_call allows multiple attempts per ticket — rows fetched
      // oldest-first, so the last write into the map for a given ticket_id
      // is the latest attempt (same "latest row per ticket" pattern used on
      // VideoCallSolution.jsx itself).
      const latestVideoCallByTicket = new Map();
      (videoCallRows || []).forEach((v) => latestVideoCallByTicket.set(v.ticket_id, v));

      const quotationByTicket = new Map((quotationRows || []).map((q) => [q.ticket_id, q]));
      const siteVisitTicketIds = new Set((siteVisitRows || []).map((s) => s.ticket_id));
      const invoiceTicketIds = new Set((invoiceRows || []).map((i) => i.ticket_id));
      // Invoice is planned on the follow-up Order Received row (non site-visit)
      // or on sss_crm_verification (site-visit, after CRM Verification).
      const invoicePlannedByTicket = new Map();
      (followUpRows || []).forEach((f) => {
        if (f.stage === "Order Received" && f.invoice_planned) invoicePlannedByTicket.set(f.ticket_id, f.invoice_planned);
      });
      (crmVerificationRows || []).forEach((c) => {
        if (c.invoice_planned) invoicePlannedByTicket.set(c.ticket_id, c.invoice_planned);
      });

      // follow_up is append-only (multiple log rows per ticket) — need both
      // the LATEST row (for site_visit_planned) and whether ANY row ever
      // said 'Order Received' (the exclusion rule Quotation.jsx/FollowUp.jsx
      // already use to decide when a ticket stops being "pending").
      const latestFollowUpByTicket = new Map();
      const hasOrderReceivedByTicket = new Set();
      (followUpRows || []).forEach((f) => {
        latestFollowUpByTicket.set(f.ticket_id, f);
        if (f.stage === "Order Received") hasOrderReceivedByTicket.add(f.ticket_id);
      });

      const now = new Date();

      const counts = { "Video Call Solution": 0, "Quotation": 0, "Follow-Up": 0, "Site Visit Plan": 0, "Invoice": 0 };
      const overdueCounts = { "Video Call Solution": 0, "Quotation": 0, "Follow-Up": 0, "Site Visit Plan": 0, "Invoice": 0 };
      const followUpCategories = {};
      const fuDetailRows = [];
      const svDetailRows = [];
      let zeroValueQuotations = 0;

      tickets.forEach((t) => {
        const wc = warrantyByTicket.get(t.ticket_id);

        // Video Call Solution — gated by warranty_check.video_call_planned.
        // Pending = no attempt yet, or the latest attempt was rescheduled
        // (same definition VideoCallSolution.jsx's own fetchData uses).
        if (wc?.video_call_planned) {
          const latestVc = latestVideoCallByTicket.get(t.ticket_id);
          if (!latestVc || latestVc.enquiry_solved === "rescheduled") {
            counts["Video Call Solution"]++;
            if (new Date(wc.video_call_planned) < now) overdueCounts["Video Call Solution"]++;
          }
        }

        // Quotation — gated by warranty_check.quotation_planned. Stays
        // pending (even after a quotation is drafted) until the ticket's
        // follow-up log shows 'Order Received' — matches Quotation.jsx's
        // own pending-exclusion rule exactly.
        const stillOpen = !hasOrderReceivedByTicket.has(t.ticket_id);
        if (wc?.quotation_planned && stillOpen) {
          counts["Quotation"]++;
          if (new Date(wc.quotation_planned) < now) overdueCounts["Quotation"]++;
          // Dashboard card: pending quotations whose basic_amount is 0 or
          // blank (no quotation row yet counts as blank).
          if (!Number(quotationByTicket.get(t.ticket_id)?.basic_amount)) zeroValueQuotations++;
        }

        // Follow-Up — gated by quotation.follow_up_planned, same exit
        // condition as Quotation above (a ticket can be pending at both
        // simultaneously — that's by design, not a bug).
        const q = quotationByTicket.get(t.ticket_id);
        if (q?.follow_up_planned && stillOpen) {
          counts["Follow-Up"]++;
          const isOverdue = new Date(q.follow_up_planned) < now;
          if (isOverdue) overdueCounts["Follow-Up"]++;

          const cat = t.category || "Uncategorized";
          if (!followUpCategories[cat]) followUpCategories[cat] = { pending: 0, overdue: 0 };
          followUpCategories[cat].pending++;
          if (isOverdue) followUpCategories[cat].overdue++;

          const latestFu = latestFollowUpByTicket.get(t.ticket_id);
          fuDetailRows.push({
            stage: "Follow-Up",
            date: formatDate(q.follow_up_planned || t.created_at),
            companyName: t.company_name || "-",
            category: t.category || "-",
            siteAddress: t.site_address || "-",
            followUpStage: latestFu?.stage || "-",
            basicAmount: q.basic_amount ?? "-",
            whatDidCustomerSay: latestFu?.what_did_customer_say || "-",
            dateOfLastFollowUp: formatDate(latestFu?.next_date_of_call),
          });
        }

        // Site Visit Plan — gated by follow_up.site_visit_planned (latest
        // row). Pending = no site_visit row yet.
        const latestFu = latestFollowUpByTicket.get(t.ticket_id);
        if (latestFu?.site_visit_planned && !siteVisitTicketIds.has(t.ticket_id)) {
          counts["Site Visit Plan"]++;
          if (new Date(latestFu.site_visit_planned) < now) overdueCounts["Site Visit Plan"]++;
          svDetailRows.push({
            stage: "Site Visit Plan",
            date: formatDate(latestFu.site_visit_planned || t.created_at),
            companyName: t.company_name || "-",
            siteAddress: t.site_address || "-",
            category: t.category || "-",
          });
        }

        // Invoice — gated by follow_up / crm_verification invoice_planned.
        // Pending = no invoice row yet.
        const invoicePlanned = invoicePlannedByTicket.get(t.ticket_id);
        if (invoicePlanned && !invoiceTicketIds.has(t.ticket_id)) {
          counts["Invoice"]++;
          if (new Date(invoicePlanned) < now) overdueCounts["Invoice"]++;
        }
      });

      setQuotationPendingCount(zeroValueQuotations);
      setSiteVisitPendingCount(counts["Site Visit Plan"]);
      setInvoicePendingCount(counts["Invoice"]);
      setStageCounts(counts);
      setStageOverdueCounts(overdueCounts);
      setFollowUpCategoryBreakdown(followUpCategories);
      setFollowUpDetailRows(fuDetailRows);
      setSiteVisitDetailRows(svDetailRows);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setFetchLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleGenerateReport = async () => {
    setIsGeneratingReport(true);
    try {
      const { pdf } = await import("@react-pdf/renderer");
      const { ReportDocument } = await import("./report-pdf");

      const summaryData = [];
      serviceStages.forEach((s) => {
        const pending = stageCounts[s.name] || 0;
        if (pending > 0) {
          summaryData.push({ stage: s.name, pending, responsible: responsiblePersonByStage[s.name] || STAGE_RESPONSIBLE[s.name] || "-" });
          if (s.name === "Follow-Up") {
            Object.entries(followUpCategoryBreakdown).forEach(([category, data]) => {
              if (data.pending > 0) {
                summaryData.push({ stage: `  - ${category}`, pending: data.pending, responsible: "" });
              }
            });
          }
        }
      });

      const detailedData = [...followUpDetailRows, ...siteVisitDetailRows];
      const followUpCategoryCounts = Object.fromEntries(
        Object.entries(followUpCategoryBreakdown).map(([cat, data]) => [cat, data.pending])
      );

      const blob = await pdf(
        <ReportDocument
          summaryData={summaryData}
          detailedData={detailedData}
          followUpCategoryBreakdown={followUpCategoryCounts}
        />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Service_Report_${new Date().toISOString().split("T")[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Failed to generate report");
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // Skeleton Components
  const SkeletonCard = () => (
    <Card className="shadow rounded-2xl p-4 flex items-center gap-3">
      <div className="w-8 h-8 bg-gray-300 rounded-full animate-pulse"></div>
      <div className="flex-1">
        <div className="h-4 bg-gray-300 rounded w-1/2 mb-2 animate-pulse"></div>
        <div className="h-6 bg-gray-300 rounded w-1/4 animate-pulse"></div>
      </div>
    </Card>
  );

  const SkeletonTable = () => (
    <Card className="p-6 shadow rounded-2xl">
      <div className="h-6 bg-gray-300 rounded w-1/3 mb-4 animate-pulse"></div>
      <div className="h-64 bg-gray-200 rounded animate-pulse"></div>
    </Card>
  );

  if (fetchLoading) {
    return (
      <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        <SkeletonTable />
        <SkeletonTable />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="shadow rounded-2xl p-4 flex items-center gap-3">
          <PhoneCall className="w-8 h-8 text-blue-500" />
          <div>
            <p className="text-sm text-gray-500">Enquiries</p>
            <p className="text-xl font-bold">{allTicketsCount}</p>
          </div>
        </Card>

        <Card className="shadow rounded-2xl p-4 flex items-center gap-3">
          <FileText className="w-8 h-8 text-blue-500" />
          <div>
            <p className="text-sm text-gray-500">Quotations</p>
            <p className="text-xl font-bold">{quotationPendingCount}</p>
          </div>
        </Card>

        <Card className="shadow rounded-2xl p-4 flex items-center gap-3">
          <FileText className="w-8 h-8 text-blue-500" />
          <div>
            <p className="text-sm text-gray-500">Site Visits</p>
            <p className="text-xl font-bold">{siteVisitPendingCount}</p>
          </div>
        </Card>

        <Card className="shadow rounded-2xl p-4 flex items-center gap-3">
          <FileText className="w-8 h-8 text-blue-500" />
          <div>
            <p className="text-sm text-gray-500">Invoices</p>
            <p className="text-xl font-bold">{invoicePendingCount}</p>
          </div>
        </Card>

      </div>

      {/* Pending Items by Stage */}
      <Card className="shadow rounded-2xl">
        <CardHeader className="pb-1 flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold">
            Pending Items by Stage
          </CardTitle>
          <Button
            variant="default"
            className="bg-blue-600 hover:bg-blue-700 h-9 text-xs flex items-center text-white gap-2 font-medium"
            onClick={handleGenerateReport}
            disabled={isGeneratingReport}
          >
            {isGeneratingReport ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
            {isGeneratingReport ? "Generating..." : "Generate Report"}
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs w-[300px]">Stage</TableHead>
                <TableHead className="text-xs text-right w-[120px]">
                  Pending
                </TableHead>
                <TableHead className="text-xs text-center w-[180px]">
                  Pending Overdue
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {serviceStages.map((stage) => {
                const dynamicCount = stageCounts[stage.name] || 0;
                const overdueCount = stageOverdueCounts[stage.name] || 0;

                const rowsToRender = [];

                rowsToRender.push(
                  <TableRow
                    key={stage.id}
                    className="hover:bg-gray-50/50 cursor-pointer"
                    onClick={() => navigate(stage.route)}
                  >
                    <TableCell className="text-xs font-medium">
                      <Link
                        to={stage.route}
                        className="flex items-center gap-2 text-blue-600 hover:underline font-semibold"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div
                          className={`w-2.5 h-2.5 rounded-full ${stage.color}`}
                        ></div>
                        {stage.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs text-right text-muted-foreground">
                      {dynamicCount}
                    </TableCell>
                    <TableCell className="text-xs text-center text-red-500 font-medium">
                      {overdueCount > 0 ? overdueCount : "-"}
                    </TableCell>
                  </TableRow>
                );

                if (stage.name === "Follow-Up" && Object.keys(followUpCategoryBreakdown).length > 0) {
                  Object.entries(followUpCategoryBreakdown).forEach(([category, data]) => {
                    rowsToRender.push(
                      <TableRow key={`followup-${category}`} className="bg-gray-50/30 hover:bg-gray-50/60 border-l-4 border-l-teal-500/50">
                        <TableCell className="text-xs font-medium pl-8 text-gray-500">
                          ↳ {category}
                        </TableCell>
                        <TableCell className="text-xs text-right text-gray-400">
                          {data.pending}
                        </TableCell>
                        <TableCell className="text-xs text-center text-red-400 font-medium">
                          {data.overdue > 0 ? data.overdue : "-"}
                        </TableCell>
                      </TableRow>
                    );
                  });
                }

                return rowsToRender;
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

    </div>
  );
}
