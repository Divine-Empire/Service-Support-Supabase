import { useState, useEffect } from "react";
import { Loader2Icon } from "lucide-react";
import { Button } from "../components/ui/button";
import { Modal } from "../components/ui/modal";
import { ListToolbar, ListTable, StatusBadge } from "../components/shared";
import { useClientList } from "../hooks/useClientList";
import { useToast } from "../hooks/use-toast";
import { supabase } from "../lib/supabase/client";
import { computeStagePlanned } from "../lib/supabase/stagePlanning";

// CRM Verification — site-visit tickets after OTP Verification.
//   Pending: sss_otp_verification.crm_verification_planned set and no
//            sss_crm_verification row for the ticket yet.
//   History: a sss_crm_verification row exists.
// Submitting generates invoice_planned (Invoice TAT), except for FOC orders
// (follow-up 'Order Received' row payment_mode = 'FOC'), which stop here.

// Not the lib/format versions: these keep an unparseable value as-is and omit seconds.
const formatDate = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

const formatDateTime = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return `${formatDate(value)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const fileLink = (url) =>
  url ? (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-primary hover:underline"
    >
      View
    </a>
  ) : (
    <span className="text-muted-foreground">-</span>
  );

const COLUMNS = [
  { key: "select", label: "Select", fixed: true, tabs: ["pending"], cell: (r, { selectedIds, onToggle }) => (
    <input
      type="checkbox"
      checked={selectedIds.includes(r.ticketId)}
      onChange={() => onToggle(r.ticketId)}
      aria-label={`Select ${r.ticketId}`}
      className="h-4 w-4"
      data-testid={`checkbox-crm-${r.ticketId}`}
    />
  ) },
  { key: "ticketId", label: "Ticket-ID", defaultVisible: true, strong: true, text: (r) => r.ticketId },
  { key: "clientName", label: "Client Name", defaultVisible: true, text: (r) => r.clientName },
  { key: "companyName", label: "Company Name", defaultVisible: true, wrap: true, width: 180, text: (r) => r.companyName },
  { key: "engineerAssign", label: "Engineer Name", defaultVisible: true, text: (r) => r.engineerAssign },
  { key: "siteVisitDate", label: "Site Visit Date", defaultVisible: true, text: (r) => formatDate(r.siteVisitDate) },
  { key: "serviceReportFile", label: "Service Report", defaultVisible: true, cell: (r) => fileLink(r.serviceReportFile) },
  { key: "quotationReceiveFile", label: "Quotation Receive", defaultVisible: true, cell: (r) => fileLink(r.quotationReceiveFile) },
  { key: "videoLink", label: "Video", defaultVisible: false, cell: (r) => fileLink(r.videoLink) },
  { key: "locallyPurchasedSpares", label: "Locally Purchased Spares", defaultVisible: false, text: (r) => r.locallyPurchasedSpares },
  { key: "remarks", label: "Remarks", defaultVisible: false, wrap: true, width: 200, text: (r) => r.remarks },
  { key: "planned", label: "Planned", defaultVisible: true, tabs: ["pending"], text: (r) => formatDateTime(r.planned) },
  { key: "verifiedBy", label: "Verified By", defaultVisible: true, tabs: ["history"], text: (r) => r.verifiedBy },
  { key: "verifiedAt", label: "Verified On", defaultVisible: true, tabs: ["history"], text: (r) => formatDateTime(r.verifiedAt) },
  { key: "invoicePlanned", label: "Invoice Planned", defaultVisible: true, tabs: ["history"], cell: (r) =>
    r.invoicePlanned ? formatDateTime(r.invoicePlanned) : <StatusBadge tone="warning">No invoice (FOC)</StatusBadge> },
];

export default function CrmVerification() {
  const [pendingData, setPendingData] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const fetchData = async () => {
    setFetchLoading(true);
    setLoadError(null);
    try {
      const { data: otpRows, error: otpError } = await supabase
        .from("sss_otp_verification")
        .select("*")
        .not("crm_verification_planned", "is", null)
        .order("crm_verification_planned", { ascending: true });

      if (otpError) throw otpError;

      const ticketIds = (otpRows || []).map((o) => o.ticket_id);
      if (ticketIds.length === 0) {
        setPendingData([]);
        setHistoryData([]);
        setSelectedIds([]);
        return;
      }

      const [
        { data: ticketsData, error: ticketsError },
        { data: crmRows, error: crmError },
        { data: orderRows, error: orderError },
      ] = await Promise.all([
        supabase
          .from("sss_tickets")
          .select("ticket_id, uuid, client_name, company_name, phone_number, engineer_assign")
          .in("ticket_id", ticketIds),
        supabase.from("sss_crm_verification").select("*").in("ticket_id", ticketIds),
        supabase
          .from("sss_follow_up")
          .select("ticket_id, payment_mode")
          .eq("stage", "Order Received")
          .in("ticket_id", ticketIds),
      ]);

      if (ticketsError) throw ticketsError;
      if (crmError) throw crmError;
      if (orderError) throw orderError;

      const ticketByTicket = new Map((ticketsData || []).map((t) => [t.ticket_id, t]));
      const crmByTicket = new Map((crmRows || []).map((c) => [c.ticket_id, c]));
      const paymentModeByTicket = new Map((orderRows || []).map((o) => [o.ticket_id, o.payment_mode]));

      const pending = [];
      const history = [];

      (otpRows || []).forEach((o) => {
        const t = ticketByTicket.get(o.ticket_id) || {};
        const row = {
          ticketId: o.ticket_id,
          ticketUuid: o.ticket_uuid,
          clientName: t.client_name || "",
          companyName: t.company_name || "",
          phoneNumber: t.phone_number || "",
          engineerAssign: t.engineer_assign || "",
          siteVisitDate: o.site_visit_date || "",
          serviceReportFile: o.service_report_file || "",
          quotationReceiveFile: o.quotation_receive_file || "",
          videoLink: o.video_link || "",
          locallyPurchasedSpares: o.locally_purchased_spares || "",
          remarks: o.remarks || "",
          planned: o.crm_verification_planned,
          paymentMode: paymentModeByTicket.get(o.ticket_id) || "",
        };

        const crm = crmByTicket.get(o.ticket_id);
        if (crm) {
          history.push({
            ...row,
            verifiedBy: crm.verified_by || "",
            verifiedAt: crm.created_at,
            invoicePlanned: crm.invoice_planned,
            delayMinutes: crm.delay_minutes,
          });
        } else {
          pending.push(row);
        }
      });

      setPendingData(pending);
      setHistoryData(history.reverse());
      setSelectedIds([]);
    } catch (error) {
      console.error("Error fetching data:", error);
      setLoadError(error.message || "Failed to load data");
      toast({
        title: "Error",
        description: "Failed to load data",
        variant: "destructive",
      });
    } finally {
      setFetchLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const list = useClientList({
    key: "crm-verification",
    data: { pending: pendingData, history: historyData },
    loading: fetchLoading,
    error: loadError,
    onRetry: fetchData,
    searchKeys: ["ticketId", "clientName", "companyName", "engineerAssign", "phoneNumber"],
    filters: [
      { key: "engineer", label: "Engineer", allLabel: "All Engineers", get: (r) => r.engineerAssign },
      { key: "payment", label: "Payment Mode", allLabel: "All Payment Modes", get: (r) => r.paymentMode },
    ],
    columns: COLUMNS,
    sort: "none", // pending: oldest planned first; history is already reversed above
  });

  // Select-all covers every pending row matching the search/filters, across pages.
  const selectableIds = list.tab === "pending" ? list.allFiltered.map((p) => p.ticketId) : [];
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.includes(id));

  const toggleSelected = (id) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const toggleAll = () => setSelectedIds(allSelected ? [] : selectableIds);

  // The Select column header carries the select-all checkbox.
  const tableList = {
    ...list,
    activeColumns: list.activeColumns.map((c) =>
      c.key === "select"
        ? {
            ...c,
            label: (
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                aria-label="Select all pending tickets"
                className="h-4 w-4"
                data-testid="checkbox-crm-all"
              />
            ),
          }
        : c
    ),
  };

  const handleSubmit = async () => {
    const rows = pendingData.filter((p) => selectedIds.includes(p.ticketId));
    if (rows.length === 0) return;

    setIsSubmitting(true);
    try {
      const invoicePlanned = await computeStagePlanned("invoice", {
        orderReceivedSubmittedAt: new Date(),
      });
      const verifiedBy = localStorage.getItem("currentUsername") || null;

      const { error } = await supabase.from("sss_crm_verification").insert(
        rows.map((r) => ({
          ticket_id: r.ticketId,
          ticket_uuid: r.ticketUuid,
          verified_by: verifiedBy,
          // FOC orders end at CRM Verification — no invoice.
          invoice_planned: r.paymentMode === "FOC" ? null : invoicePlanned,
        }))
      );

      if (error) throw error;

      toast({
        title: "Success",
        description: `${rows.length} ticket(s) verified`,
      });
      setShowConfirm(false);
      fetchData();
    } catch (error) {
      console.error("Error submitting CRM verification:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit CRM verification",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <ListToolbar
        list={list}
        searchPlaceholder="Search by ticket ID, client, company, engineer or phone..."
        actions={
          list.tab === "pending" && (
            <Button
              type="button"
              onClick={() => setShowConfirm(true)}
              disabled={selectedIds.length === 0 || isSubmitting}
              data-testid="button-submit-crm"
            >
              Submit ({selectedIds.length})
            </Button>
          )
        }
      />
      <ListTable
        list={tableList}
        ctx={{ selectedIds, onToggle: toggleSelected }}
        rowKey={(r) => r.ticketId}
        emptyTitle={{ pending: "No pending CRM verifications.", history: "No CRM verification history found." }}
        ariaLabel="CRM verification"
      />

      <Modal
        isOpen={showConfirm}
        onClose={() => !isSubmitting && setShowConfirm(false)}
        title="Confirm CRM Verification"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-foreground">
            Verify <span className="font-semibold">{selectedIds.length}</span> ticket(s)? This moves
            them to History and generates their Invoice planned date (FOC orders get no invoice).
          </p>
          <p className="break-words text-sm text-muted-foreground">{selectedIds.join(", ")}</p>
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              data-testid="button-confirm-crm"
            >
              {isSubmitting && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
              Confirm
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowConfirm(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
