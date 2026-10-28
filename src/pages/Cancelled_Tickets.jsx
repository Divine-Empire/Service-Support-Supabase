import { useState, useEffect } from "react";
import { ListToolbar, ListTable, StatusBadge } from "../components/shared";
import { useClientList } from "../hooks/useClientList";
import { useToast } from "../hooks/use-toast";
import { supabase } from "../lib/supabase/client";
import { formatDate } from "../lib/format";

const COLUMNS = [
  { key: "cancelledOn", label: "Cancelled On", defaultVisible: true, text: (r) => formatDate(r.timeStemp) },
  { key: "ticketId", label: "Ticket ID", defaultVisible: true, strong: true, text: (r) => r.ticketId },
  { key: "clientName", label: "Client Name", defaultVisible: true, text: (r) => r.clientName },
  { key: "phoneNumber", label: "Phone Number", defaultVisible: false, text: (r) => r.phoneNumber },
  { key: "companyName", label: "Company Name", defaultVisible: true, wrap: true, width: 200, text: (r) => r.companyName },
  { key: "category", label: "Category", defaultVisible: true, text: (r) => r.category },
  { key: "mentionIssue", label: "Mention Issue", defaultVisible: true, wrap: true, width: 250, text: (r) => r.mentionIssue },
  { key: "cancelledFromStage", label: "Cancelled From Stage", defaultVisible: true, cell: (r) =>
    r.cancelledFromStage ? <StatusBadge tone="danger">{r.cancelledFromStage}</StatusBadge> : "" },
  { key: "remarks", label: "Remarks", defaultVisible: true, wrap: true, width: 200, text: (r) => r.remarks },
];

export default function CancelledTickets() {
  const [cancelledData, setCancelledData] = useState([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const { toast } = useToast();

  const fetchCancelledTickets = async () => {
    setFetchLoading(true);
    setLoadError(null);
    try {
      const { data: cancelRows, error: cancelError } = await supabase
        .from("sss_cancelled_tickets")
        .select("*")
        .order("created_at", { ascending: false });

      if (cancelError) throw cancelError;

      if (!cancelRows || cancelRows.length === 0) {
        setCancelledData([]);
        return;
      }

      const ticketIds = [...new Set(cancelRows.map((c) => c.ticket_id))];

      const { data: ticketsData, error: ticketsError } = await supabase
        .from("sss_tickets")
        .select("*")
        .in("ticket_id", ticketIds);

      if (ticketsError) throw ticketsError;

      const ticketByTicketId = new Map((ticketsData || []).map((t) => [t.ticket_id, t]));

      const formatted = cancelRows.map((c) => {
        const t = ticketByTicketId.get(c.ticket_id);
        return {
          id: c.id,
          timeStemp: c.created_at || "",
          ticketId: c.ticket_id,
          cancelledFromStage: c.cancelled_from_stage || "",
          remarks: c.remarks || "",
          clientName: t?.client_name || "",
          phoneNumber: t?.phone_number || "",
          companyName: t?.company_name || "",
          category: t?.category || "",
          mentionIssue: t?.mention_issue || "",
          CREName: t?.cre_name || "",
        };
      });

      setCancelledData(formatted);
    } catch (error) {
      console.error("Error fetching cancelled tickets:", error);
      setLoadError(error.message || "Failed to load cancelled tickets");
      toast({
        title: "Error",
        description: "Failed to load cancelled tickets",
        variant: "destructive",
      });
    } finally {
      setFetchLoading(false);
    }
  };

  useEffect(() => {
    fetchCancelledTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const list = useClientList({
    key: "cancelled-tickets",
    data: { pending: cancelledData },
    tabLabels: { pending: "Cancelled" },
    loading: fetchLoading,
    error: loadError,
    onRetry: fetchCancelledTickets,
    searchKeys: ["ticketId", "clientName", "companyName", "phoneNumber"],
    filters: [
      { key: "category", label: "Category", allLabel: "All Categories", get: (r) => r.category },
      { key: "stage", label: "Cancelled From Stage", allLabel: "All Stages", get: (r) => r.cancelledFromStage },
    ],
    columns: COLUMNS,
    sort: "none", // rows already arrive newest first
  });

  return (
    <div className="space-y-3">
      <ListToolbar list={list} searchPlaceholder="Search by ticket, client, company or phone..." />
      <ListTable
        list={list}
        rowKey={(r) => r.id}
        emptyTitle="No cancelled tickets found."
        ariaLabel="Cancelled tickets"
      />
    </div>
  );
}
