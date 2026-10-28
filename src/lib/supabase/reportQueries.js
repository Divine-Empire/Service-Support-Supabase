// Read-only query layer for the Report stage. No tables, no writes: every
// function takes the supabase client (so it can also be exercised from a
// node script) and returns plain rows / aggregates.
//
// Cost rules applied throughout:
//  - select only the columns that are used,
//  - always filter by a date window on the server (never "fetch the whole
//    table and filter in JS"),
//  - page past PostgREST's 1000-row cap with a FRESH query builder per page
//    (reusing one builder across concurrent .range() calls races),
//  - `.in()` lists are capped at 100 ids per request (URL length),
//  - each Report tab only queries when it is opened.

const PAGE = 1000;
const IN_CHUNK = 100;

export const CATS = ["SPARE", "SERVICE", "NABL", "NON NABL", "OTHER"];

// tickets.category holds compound, admin-editable strings. Same bucketing
// rules the Dashboard's weekly report always used: an exact SPARE/SERVICE
// wins; anything with NABL in it is NABL / NON NABL; the rest (e.g. "SPARE
// AND SERVICE") falls into OTHER.
export function normalizeCategory(catRaw) {
  if (!catRaw) return "OTHER";
  const c = String(catRaw).trim().toUpperCase().replace(/\s+/g, " ");
  if (c === "SPARE") return "SPARE";
  if (c === "SERVICE") return "SERVICE";
  if (c.includes("NON-NABL") || c.includes("NON NABL") || c.includes("NONNABL")) return "NON NABL";
  if (c.includes("NABL")) return "NABL";
  return "OTHER";
}

// "YYYY-MM-DD" (local) helpers. Range inputs are local calendar days;
// start = 00:00:00.000 local, end = 23:59:59.999 local, both inclusive.
export function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function defaultRange(days = 7) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  return { from: ymd(start), to: ymd(end) };
}
function dayStart(ymdStr) {
  const [y, m, d] = ymdStr.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}
function dayEnd(ymdStr) {
  const [y, m, d] = ymdStr.split("-").map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}
export function rangeBounds(from, to) {
  return { start: dayStart(from), end: dayEnd(to) };
}

// Pages through a query. `build()` must return a NEW builder each call and
// must include a deterministic .order().
async function fetchAll(build) {
  const out = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

async function fetchByIds(supabase, table, columns, idColumn, ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  const chunks = [];
  for (let i = 0; i < unique.length; i += IN_CHUNK) chunks.push(unique.slice(i, i + IN_CHUNK));
  const results = await Promise.all(
    chunks.map(async (chunk) => {
      const { data, error } = await supabase.from(table).select(columns).in(idColumn, chunk);
      if (error) throw error;
      return data || [];
    })
  );
  return results.flat();
}

// ───────────────────────── Weekly report ─────────────────────────

export async function fetchWeeklyReport(supabase, { from, to }) {
  const { start, end } = rangeBounds(from, to);
  const now = new Date();
  now.setHours(23, 59, 59, 999);
  const pendingWindowStart = new Date(now);
  pendingWindowStart.setDate(pendingWindowStart.getDate() - 60);
  pendingWindowStart.setHours(0, 0, 0, 0);
  // Everything created before this can't matter: enquiries counts need
  // [start,end], "till date pending" needs the last 60 days.
  const windowStart = new Date(Math.min(start.getTime(), pendingWindowStart.getTime())).toISOString();

  const [tickets, warrantyRows, videoCallRows, quotationRows, invoiceRows] = await Promise.all([
    fetchAll(() =>
      supabase
        .from("sss_tickets")
        .select("ticket_id, category, call_type, created_at, warranty_check_planned")
        .gte("created_at", windowStart)
        .order("created_at", { ascending: true })
        .order("ticket_id", { ascending: true })
    ),
    fetchAll(() =>
      supabase
        .from("sss_warranty_check")
        .select("ticket_id, video_call_planned, quotation_planned")
        .gte("created_at", windowStart)
        .order("created_at", { ascending: true })
        .order("ticket_id", { ascending: true })
    ),
    fetchAll(() =>
      supabase
        .from("sss_video_call")
        .select("ticket_id")
        .gte("created_at", windowStart)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
    ),
    fetchAll(() =>
      supabase
        .from("sss_quotation")
        .select("ticket_id, basic_amount")
        .gte("created_at", windowStart)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
    ),
    fetchAll(() =>
      supabase
        .from("sss_invoice")
        .select("ticket_id, created_at, spare_amount_basic, service_amount_basic, invoice_amount_nabl_basic")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
    ),
  ]);

  // An invoice can belong to a ticket older than windowStart; look up just
  // those categories instead of loading every ticket.
  const known = new Map(tickets.map((t) => [t.ticket_id, t]));
  const missingIds = invoiceRows.map((i) => i.ticket_id).filter((id) => !known.has(id));
  const extraTickets = await fetchByIds(supabase, "sss_tickets", "ticket_id, category", "ticket_id", missingIds);
  const categoryByTicket = new Map(tickets.map((t) => [t.ticket_id, t.category]));
  extraTickets.forEach((t) => categoryByTicket.set(t.ticket_id, t.category));

  const warrantyByTicket = new Map(warrantyRows.map((w) => [w.ticket_id, w]));
  const videoCallTicketIds = new Set(videoCallRows.map((v) => v.ticket_id));
  const quotationByTicket = new Map(quotationRows.map((q) => [q.ticket_id, q]));
  const quotationTicketIds = new Set(quotationRows.map((q) => q.ticket_id));

  const result = {};
  CATS.forEach((cat) => {
    result[cat] = {
      outgoingEnq: 0,
      outgoingValue: 0,
      incomingEnq: 0,
      incomingValue: 0,
      tillDatePending: 0,
      tillDatePendingValue: 0,
      totalBilling: 0,
      invoiceValue: 0,
    };
  });

  tickets.forEach((t) => {
    const ts = t.created_at ? new Date(t.created_at) : null;
    if (!ts) return;
    const bucket = result[normalizeCategory(t.category)];
    const basicValue = Number(quotationByTicket.get(t.ticket_id)?.basic_amount) || 0;

    if (ts >= start && ts <= end) {
      if (t.call_type === "Outgoing") {
        bucket.outgoingEnq++;
        bucket.outgoingValue += basicValue;
      }
      if (t.call_type === "Incoming") {
        bucket.incomingEnq++;
        bucket.incomingValue += basicValue;
      }
    }

    // Till-date pending: last 60 days, ticket stuck at Warranty-Check,
    // Video-Call or Quotation (existence-based, same rule as before).
    if (ts >= pendingWindowStart) {
      const wc = warrantyByTicket.get(t.ticket_id);
      const pendingWC = !!t.warranty_check_planned && !wc;
      const pendingVC = !!wc?.video_call_planned && !videoCallTicketIds.has(t.ticket_id);
      const pendingQuo = !!wc?.quotation_planned && !quotationTicketIds.has(t.ticket_id);
      if (pendingWC || pendingVC || pendingQuo) {
        bucket.tillDatePending++;
        bucket.tillDatePendingValue += basicValue;
      }
    }
  });

  invoiceRows.forEach((inv) => {
    const category = normalizeCategory(categoryByTicket.get(inv.ticket_id));
    const bucket = result[category];
    bucket.totalBilling++;
    if (category === "SPARE") bucket.invoiceValue += Number(inv.spare_amount_basic) || 0;
    else if (category === "SERVICE") bucket.invoiceValue += Number(inv.service_amount_basic) || 0;
    else if (category === "NABL") bucket.invoiceValue += Number(inv.invoice_amount_nabl_basic) || 0;
  });

  return { result, start, end };
}

// ───────────────────────── Video-Call summary ─────────────────────────
// Assigned  = tickets whose sss_warranty_check.video_call_planned falls in
//             the range (cancelling a ticket nulls that column).
// Completed = a sss_video_call row exists for the ticket.
// Engineer  = sss_tickets.engineer_assign.

export async function fetchVideoCallSummary(supabase, { from, to }) {
  const { start, end } = rangeBounds(from, to);
  const planned = await fetchAll(() =>
    supabase
      .from("sss_warranty_check")
      .select("ticket_id, video_call_planned")
      .gte("video_call_planned", start.toISOString())
      .lte("video_call_planned", end.toISOString())
      .order("video_call_planned", { ascending: true })
      .order("ticket_id", { ascending: true })
  );
  const ids = planned.map((p) => p.ticket_id);
  const [tickets, calls] = await Promise.all([
    fetchByIds(supabase, "sss_tickets", "ticket_id, company_name, client_name, engineer_assign", "ticket_id", ids),
    fetchByIds(supabase, "sss_video_call", "ticket_id, created_at", "ticket_id", ids),
  ]);
  const ticketById = new Map(tickets.map((t) => [t.ticket_id, t]));
  const completedAt = new Map();
  calls.forEach((c) => {
    const prev = completedAt.get(c.ticket_id);
    if (!prev || c.created_at < prev) completedAt.set(c.ticket_id, c.created_at);
  });
  return planned.map((p) => {
    const t = ticketById.get(p.ticket_id) || {};
    return {
      ticketId: p.ticket_id,
      plannedAt: p.video_call_planned,
      companyName: t.company_name || "",
      clientName: t.client_name || "",
      engineer: (t.engineer_assign || "").trim() || "Unassigned",
      completed: completedAt.has(p.ticket_id),
      completedAt: completedAt.get(p.ticket_id) || "",
    };
  });
}

// ───────────────────────── Site-visit summary ─────────────────────────
// Assigned  = tickets with a sss_follow_up.site_visit_planned in the range
//             (counted once per ticket).
// Completed = a sss_otp_verification row exists for the ticket.
// Engineer  = the visit's own sss_site_visit.engineer_assign (latest row),
//             falling back to sss_tickets.engineer_assign.

export async function fetchSiteVisitSummary(supabase, { from, to }) {
  const { start, end } = rangeBounds(from, to);
  const planned = await fetchAll(() =>
    supabase
      .from("sss_follow_up")
      .select("ticket_id, site_visit_planned")
      .gte("site_visit_planned", start.toISOString())
      .lte("site_visit_planned", end.toISOString())
      .order("site_visit_planned", { ascending: true })
      .order("id", { ascending: true })
  );
  const plannedByTicket = new Map();
  planned.forEach((p) => plannedByTicket.set(p.ticket_id, p.site_visit_planned)); // latest wins
  const ids = [...plannedByTicket.keys()];

  const [tickets, visits, otps] = await Promise.all([
    fetchByIds(supabase, "sss_tickets", "ticket_id, company_name, client_name, engineer_assign", "ticket_id", ids),
    fetchByIds(supabase, "sss_site_visit", "ticket_id, engineer_assign, created_at", "ticket_id", ids),
    fetchByIds(supabase, "sss_otp_verification", "ticket_id, created_at", "ticket_id", ids),
  ]);
  const ticketById = new Map(tickets.map((t) => [t.ticket_id, t]));
  const visitEngineer = new Map();
  [...visits]
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
    .forEach((v) => {
      if ((v.engineer_assign || "").trim()) visitEngineer.set(v.ticket_id, v.engineer_assign.trim());
    });
  const otpAt = new Map(otps.map((o) => [o.ticket_id, o.created_at]));

  return ids.map((id) => {
    const t = ticketById.get(id) || {};
    return {
      ticketId: id,
      plannedAt: plannedByTicket.get(id),
      companyName: t.company_name || "",
      clientName: t.client_name || "",
      engineer: visitEngineer.get(id) || (t.engineer_assign || "").trim() || "Unassigned",
      completed: otpAt.has(id),
      completedAt: otpAt.get(id) || "",
    };
  });
}

// ───────────────────────── Quotations ─────────────────────────
// sss_make_quotation has no updated_at: a revision is a NEW row whose
// quotation_no carries a "-NN" suffix, so "Revised" = suffix present,
// "Created" = base number.

export async function fetchQuotationReport(supabase, { from, to }) {
  const { start, end } = rangeBounds(from, to);
  const rows = await fetchAll(() =>
    supabase
      .from("sss_make_quotation")
      .select("quotation_no, consignee_name, pdf_url, prepared_by, created_at")
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString())
      .order("created_at", { ascending: false })
      .order("quotation_no", { ascending: false })
  );
  return rows.map((r) => ({
    quotationNo: r.quotation_no,
    type: /-\d{2}$/.test(r.quotation_no || "") ? "Revised" : "Created",
    companyName: r.consignee_name || "",
    pdfUrl: r.pdf_url || "",
    preparedBy: r.prepared_by || "",
    createdAt: r.created_at,
  }));
}

// Per-engineer rollup shared by the Video-Call and Site-Visit tabs.
export function summarizeByEngineer(rows) {
  const map = new Map();
  rows.forEach((r) => {
    const e = map.get(r.engineer) || { engineer: r.engineer, assigned: 0, completed: 0 };
    e.assigned++;
    if (r.completed) e.completed++;
    map.set(r.engineer, e);
  });
  return [...map.values()]
    .map((e) => ({ ...e, pending: e.assigned - e.completed }))
    .sort((a, b) => b.assigned - a.assigned || a.engineer.localeCompare(b.engineer));
}

// ───────────────────────── Follow-Up ─────────────────────────
// Section 1 "planned": tickets whose sss_quotation.follow_up_planned falls in
//   the range, with their order status (Resolved ever / On Hold / Pending).
// Section 2 "resolvedOutside": Order Received resolved inside the range
//   (sss_follow_up.order_resolved_at) but planned outside it.
// Cancelled tickets are excluded from both (cancelling also nulls
// follow_up_planned, so they never reach section 1 anyway).

export async function fetchFollowUpReport(supabase, { from, to }) {
  const { start, end } = rangeBounds(from, to);
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  const [plannedQuotes, resolvedRows] = await Promise.all([
    fetchAll(() =>
      supabase
        .from("sss_quotation")
        .select("ticket_id, quotation_no, follow_up_planned")
        .gte("follow_up_planned", startIso)
        .lte("follow_up_planned", endIso)
        .order("follow_up_planned", { ascending: true })
        .order("ticket_id", { ascending: true })
    ),
    fetchAll(() =>
      supabase
        .from("sss_follow_up")
        .select("ticket_id, order_resolved_at, payment_mode, payment_term, hold_order, hold_released_at")
        .eq("stage", "Order Received")
        .gte("order_resolved_at", startIso)
        .lte("order_resolved_at", endIso)
        .order("order_resolved_at", { ascending: true })
        .order("id", { ascending: true })
    ),
  ]);

  const plannedIds = plannedQuotes.map((q) => q.ticket_id);
  const resolvedOnlyIds = resolvedRows
    .map((r) => r.ticket_id)
    .filter((id) => !plannedIds.includes(id));

  // Order Received rows for the planned tickets (ever resolved, any date).
  const [plannedOrderRows, outsideQuotes] = await Promise.all([
    fetchByIds(
      supabase,
      "sss_follow_up",
      "ticket_id, order_resolved_at, payment_mode, hold_order, hold_released_at, created_at, stage",
      "ticket_id",
      plannedIds
    ),
    fetchByIds(
      supabase,
      "sss_quotation",
      "ticket_id, quotation_no, follow_up_planned",
      "ticket_id",
      resolvedOnlyIds
    ),
  ]);

  const allIds = [...new Set([...plannedIds, ...resolvedOnlyIds])];
  const [tickets, cancelled] = await Promise.all([
    fetchByIds(
      supabase,
      "sss_tickets",
      "ticket_id, company_name, client_name, engineer_assign",
      "ticket_id",
      allIds
    ),
    fetchByIds(supabase, "sss_cancelled_tickets", "ticket_id", "ticket_id", allIds),
  ]);

  const ticketById = new Map(tickets.map((t) => [t.ticket_id, t]));
  const cancelledIds = new Set(cancelled.map((c) => c.ticket_id));

  // One Order Received row per ticket: prefer a resolved one, else newest.
  const orderByTicket = new Map();
  plannedOrderRows
    .filter((r) => r.stage === "Order Received")
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
    .forEach((r) => {
      const prev = orderByTicket.get(r.ticket_id);
      if (!prev || r.order_resolved_at || !prev.order_resolved_at) orderByTicket.set(r.ticket_id, r);
    });

  const base = (id) => {
    const t = ticketById.get(id) || {};
    return {
      ticketId: id,
      companyName: t.company_name || "",
      clientName: t.client_name || "",
      engineer: t.engineer_assign || "",
    };
  };

  const planned = plannedQuotes
    .filter((q) => !cancelledIds.has(q.ticket_id))
    .map((q) => {
      const o = orderByTicket.get(q.ticket_id);
      const status = o?.order_resolved_at
        ? "Resolved"
        : o?.hold_order === "Yes"
          ? "On Hold"
          : "Pending";
      return {
        ...base(q.ticket_id),
        quotationNo: q.quotation_no || "",
        followUpPlanned: q.follow_up_planned,
        status,
        resolvedOn: o?.order_resolved_at || "",
        paymentMode: o?.payment_mode || "",
      };
    });

  const quoteById = new Map(outsideQuotes.map((q) => [q.ticket_id, q]));
  const seen = new Set();
  const resolvedOutside = resolvedRows
    .filter((r) => !plannedIds.includes(r.ticket_id) && !cancelledIds.has(r.ticket_id))
    .filter((r) => (seen.has(r.ticket_id) ? false : (seen.add(r.ticket_id), true)))
    .map((r) => {
      const q = quoteById.get(r.ticket_id) || {};
      return {
        ...base(r.ticket_id),
        quotationNo: q.quotation_no || "",
        followUpPlanned: q.follow_up_planned || "",
        resolvedOn: r.order_resolved_at,
        paymentMode: r.payment_mode || "",
        released: r.hold_released_at ? "Yes" : "No",
      };
    });

  return { planned, resolvedOutside };
}
