import { useState, useEffect } from "react";
import { Button } from "../components/ui/button";
import { useToast } from "../hooks/use-toast";
import { Loader2Icon, Mail } from "lucide-react";
import { supabase } from "../lib/supabase/client";
import { sendTadaApprovalEmail } from "../lib/notifications/email";
import { ListToolbar, ListTable, StatusBadge } from "../components/shared";
import { useClientList } from "../hooks/useClientList";

// Kept local: unlike lib/format, an unparseable value is shown as-is.
const formatDate = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

// Pending: resend action + trip details. History: decision details.
const COLUMNS = [
  { key: "action", label: "Action", fixed: true, tabs: ["pending"], cell: (r, { onResend, resendingTicketId }) => (
    <Button size="sm" variant="outline" onClick={() => onResend(r)} disabled={resendingTicketId === r.ticketId}>
      {resendingTicketId === r.ticketId ? (
        <Loader2Icon className="animate-spin w-4 h-4 mr-1" />
      ) : (
        <Mail className="w-4 h-4 mr-1" />
      )}
      Resend Email
    </Button>
  ) },
  { key: "sentAt", label: "Sent At", defaultVisible: true, tabs: ["pending"], text: (r) => formatDate(r.sentAt) },
  { key: "ticketId", label: "Ticket ID", defaultVisible: true, strong: true, text: (r) => r.ticketId },
  { key: "companyName", label: "Company Name", defaultVisible: true, text: (r) => r.companyName },
  { key: "engineerAssign", label: "Engineer", defaultVisible: true, text: (r) => r.engineerAssign },
  { key: "travelDate", label: "Travel Date", defaultVisible: true, tabs: ["pending"], text: (r) => formatDate(r.travelDate) },
  { key: "returnDate", label: "Return Date", defaultVisible: true, tabs: ["pending"], text: (r) => formatDate(r.returnDate) },
  { key: "amount", label: "Amount", defaultVisible: true, text: (r) => `₹${r.amount || "0"}` },
  { key: "status", label: "Status", defaultVisible: true, tabs: ["history"], cell: (r) => (
    <StatusBadge tone={r.status === "approved" ? "success" : "danger"}>{r.status === "approved" ? "Approved" : "Rejected"}</StatusBadge>
  ) },
  { key: "decidedAt", label: "Decided At", defaultVisible: true, tabs: ["history"], text: (r) => formatDate(r.decidedAt) },
  { key: "rejectRemarks", label: "Reject Remarks", defaultVisible: true, tabs: ["history"], wrap: true, width: 220, text: (r) => r.rejectRemarks },
];

// Internal visibility for this page is entirely handled by the existing
// Page Access mechanism (Settings.jsx / Sidebar.jsx) — nothing special is
// done here. Assign "TADA Approval" to admin + whichever specific user
// should see it, from Settings.
export default function TadaApproval() {
  const [pendingData, setPendingData] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [resendingTicketId, setResendingTicketId] = useState(null);
  const { toast } = useToast();

  const fetchData = async () => {
    setFetchLoading(true);
    setLoadError(null);
    try {
      const { data: approvalRows, error: approvalError } = await supabase
        .from("sss_senior_approval")
        .select("*")
        .order("sent_at", { ascending: false });

      if (approvalError) throw approvalError;

      const ticketIds = [...new Set((approvalRows || []).map((a) => a.ticket_id))];

      if (ticketIds.length === 0) {
        setPendingData([]);
        setHistoryData([]);
        return;
      }

      const { data: ticketsData, error: ticketsError } = await supabase
        .from("sss_tickets")
        .select("*")
        .in("ticket_id", ticketIds);

      if (ticketsError) throw ticketsError;

      const ticketsByTicket = new Map((ticketsData || []).map((t) => [t.ticket_id, t]));

      const { data: tadaRows, error: tadaError } = await supabase
        .from("sss_tada")
        .select("*")
        .in("ticket_id", ticketIds);

      if (tadaError) throw tadaError;

      const tadaByTicket = new Map((tadaRows || []).map((t) => [t.ticket_id, t]));

      const pending = [];
      const history = [];

      (approvalRows || []).forEach((a) => {
        const t = ticketsByTicket.get(a.ticket_id) || {};
        const tada = tadaByTicket.get(a.ticket_id) || {};

        const row = {
          id: a.id,
          ticketId: a.ticket_id,
          ticketUuid: a.ticket_uuid,
          token: a.token,
          status: a.status,
          sentAt: a.sent_at,
          decidedAt: a.decided_at,
          rejectRemarks: a.reject_remarks,
          companyName: t.company_name || "",
          clientName: t.client_name || "",
          siteAddress: t.site_address || "",
          machineName: t.machine_name || "",
          engineerAssign: tada.engineer_assign || t.engineer_assign || "",
          travelDate: tada.travel_date || "",
          returnDate: tada.return_date || "",
          destination: tada.destination || "",
          purposeOfTravel: tada.purpose_of_travel || "",
          amount: tada.amount || "",
          previousAdvanceDate: tada.previous_advance_date || "",
          previousAdvanceSettlementDate: tada.previous_advance_settlement_date || "",
          previousAdvanceBalance: tada.previous_advance_balance || "",
          balanceAmount: tada.balance_amount || "",
        };

        if (a.status === "pending") {
          pending.push(row);
        } else {
          history.push(row);
        }
      });

      setPendingData(pending);
      setHistoryData(history);
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

  const handleResendEmail = async (row) => {
    setResendingTicketId(row.ticketId);
    try {
      const { success, error } = await sendTadaApprovalEmail({
        token: row.token,
        ticketId: row.ticketId,
        companyName: row.companyName,
        siteAddress: row.siteAddress,
        machineName: row.machineName,
        travelDate: row.travelDate,
        returnDate: row.returnDate,
        amount: row.amount,
        purposeOfTravel: row.purposeOfTravel,
        previousAdvanceDate: row.previousAdvanceDate,
        previousAdvanceSettlementDate: row.previousAdvanceSettlementDate,
        previousAdvanceBalance: row.previousAdvanceBalance,
        balanceAmount: row.balanceAmount,
        engineerName: row.engineerAssign,
      });

      if (success) {
        // Bump sent_at so it's clear when the last resend happened.
        await supabase
          .from("sss_senior_approval")
          .update({ sent_at: new Date().toISOString() })
          .eq("id", row.id);
        toast({ title: "Success", description: `Approval email re-sent for ${row.ticketId}` });
        fetchData();
      } else {
        toast({
          title: "Error",
          description: error || "Failed to resend approval email",
          variant: "destructive",
        });
      }
    } finally {
      setResendingTicketId(null);
    }
  };

  // Rows are already newest-first from the query, so no extra sort.
  const list = useClientList({
    key: "tada-approval",
    data: { pending: pendingData, history: historyData },
    loading: fetchLoading,
    error: loadError,
    onRetry: fetchData,
    sort: "none",
    searchKeys: ["ticketId", "clientName", "companyName", "engineerAssign"],
    filters: [
      { key: "engineer", label: "Engineer", allLabel: "All Engineers", get: (r) => r.engineerAssign },
      { key: "status", label: "Status", allLabel: "All Statuses", get: (r) => r.status, tabs: ["history"] },
    ],
    columns: COLUMNS,
  });

  return (
    <div className="space-y-3">
      <ListToolbar list={list} searchPlaceholder="Search by ticket ID, client, company or engineer..." />
      <ListTable
        list={list}
        ctx={{ onResend: handleResendEmail, resendingTicketId }}
        rowKey={(r) => r.id}
        emptyTitle={{ pending: "No pending TADA approvals found.", history: "No TADA approval history found." }}
        ariaLabel="TADA approvals"
      />
    </div>
  );
}
