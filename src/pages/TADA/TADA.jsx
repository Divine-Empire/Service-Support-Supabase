import { useState, useEffect } from "react";
import { ListToolbar, ListTable } from "../../components/shared";
import { useClientList } from "../../hooks/useClientList";
import useAuth from "../../hooks/useAuth";
import { useToast } from "../../hooks/use-toast";
import { supabase } from "../../lib/supabase/client";
import { COLUMNS } from "./columns";
import TadaFormModal from "./TadaFormModal";
import RescheduleModal from "./RescheduleModal";

export default function TADA() {
  const [tadaTicket, setTadaTicket] = useState(null);
  const { toast } = useToast();
  const { role } = useAuth();

  const [pendingData, setPendingData] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const [rescheduleTicket, setRescheduleTicket] = useState(null);

  const fetchData = async () => {
    setFetchLoading(true);
    setLoadError(null);
    try {
      // Tickets ready for TADA (site_visit.tada_planned set). Excludes
      // rescheduled rows — once an engineer reschedules, that row's
      // tada_planned no longer counts and the ticket drops out of this
      // pending list (see migration 0054).
      const { data: siteVisitRows, error: siteVisitError } = await supabase
        .from("sss_site_visit")
        .select("ticket_id, ticket_uuid, engineer_assign, date_of_visit, transportation, tada_planned")
        .not("tada_planned", "is", null)
        .is("rescheduled_at", null)
        .order("created_at", { ascending: false });

      if (siteVisitError) throw siteVisitError;

      const ticketIds = [...new Set((siteVisitRows || []).map((s) => s.ticket_id))];

      if (ticketIds.length === 0) {
        setPendingData([]);
        setHistoryData([]);
        return;
      }

      const siteVisitByTicket = new Map((siteVisitRows || []).map((s) => [s.ticket_id, s]));

      const { data: ticketsData, error: ticketsError } = await supabase
        .from("sss_tickets")
        .select("*")
        .in("ticket_id", ticketIds)
        .order("created_at", { ascending: true });

      if (ticketsError) throw ticketsError;

      // Warranty Check and Quotation are display-only here — joined from
      // their owning stages.
      const { data: warrantyRows, error: warrantyError } = await supabase
        .from("sss_warranty_check")
        .select("ticket_id, warranty_check")
        .in("ticket_id", ticketIds);

      if (warrantyError) throw warrantyError;

      const warrantyByTicket = new Map((warrantyRows || []).map((w) => [w.ticket_id, w.warranty_check]));

      const { data: quotationRows, error: quotationError } = await supabase
        .from("sss_quotation")
        .select("ticket_id, quotation_no, quotation_pdf_link")
        .in("ticket_id", ticketIds);

      if (quotationError) throw quotationError;

      const quotationByTicket = new Map((quotationRows || []).map((q) => [q.ticket_id, q]));

      const { data: tadaRows, error: tadaError } = await supabase
        .from("sss_tada")
        .select("*")
        .in("ticket_id", ticketIds);

      if (tadaError) throw tadaError;

      const tadaByTicket = new Map((tadaRows || []).map((t) => [t.ticket_id, t]));

      const pending = [];
      const history = [];

      (ticketsData || []).forEach((t) => {
        const sv = siteVisitByTicket.get(t.ticket_id);
        const q = quotationByTicket.get(t.ticket_id);

        const base = {
          ticketId: t.ticket_id,
          ticketUuid: t.uuid,
          timeStemp: t.created_at || "",
          sourceOfEnquiry: t.source_of_enquiry || "",
          callType: t.call_type || "",
          enquiryReceiverName: t.enquiry_receiver_name || "",
          clientType: t.client_type || "",
          companyName: t.company_name || "",
          clientName: t.client_name || "",
          phoneNumber: t.phone_number || "",
          siteAddress: t.site_address || "",
          gstNo: t.gst_no || "",
          machineName: t.machine_name || "",
          category: t.category || "",
          mentionIssue: t.mention_issue || "",
          serviceLocation: t.service_location || "",
          CREName: t.cre_name || "",
          engineerAssign: sv?.engineer_assign || t.engineer_assign || "",
          siteName: t.site_address || "",
          warrantyCheck: warrantyByTicket.get(t.ticket_id) || "",
          quotationNo: q?.quotation_no || "",
          quotationPdfLink: q?.quotation_pdf_link || "",
          dateOfVisit: sv?.date_of_visit || "",
          transportation: sv?.transportation || "",
        };

        const tada = tadaByTicket.get(t.ticket_id);
        if (tada) {
          history.push({
            ...base,
            travelDate: tada.travel_date || "",
            returnDate: tada.return_date || "",
            destinationInput: tada.destination || "",
            purposeOfTravel: tada.purpose_of_travel || "",
            amount: tada.amount || "",
            expectedCompletionDate: tada.expected_completion_date || "",
            expectedCompletionTime: tada.expected_completion_time || "",
            otpVerificationPlanned: tada.otp_verification_planned || "",
            delayMinutes: tada.delay_minutes,
          });
        } else {
          pending.push(base);
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

  // Auto-open modal when arriving via a TADA deep-link (e.g. /tada?ticketId=XXX)
  useEffect(() => {
    if (pendingData.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const ticketIdFromUrl = params.get("ticketId");
    if (ticketIdFromUrl) {
      const targetTicket = pendingData.find(
        (t) => t.ticketId === decodeURIComponent(ticketIdFromUrl)
      );
      if (targetTicket) {
        setTadaTicket(targetTicket);
        // Clean the query param from the URL without reloading
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, "", cleanUrl);
      }
    }
  }, [pendingData]);


  const handleTADAClick = (ticket) => setTadaTicket(ticket);
  const handleRescheduleClick = (ticket) => setRescheduleTicket(ticket);

  const list = useClientList({
    key: "tada",
    data: { pending: pendingData, history: historyData },
    loading: fetchLoading,
    error: loadError,
    onRetry: fetchData,
    searchKeys: ["ticketId", "clientName", "companyName", "phoneNumber"],
    filters: [
      { key: "engineer", label: "Engineer", allLabel: "All Engineers", get: (r) => r.engineerAssign },
      { key: "category", label: "Category", allLabel: "All Categories", get: (r) => r.category },
      { key: "transportation", label: "Transportation", allLabel: "All Transportation", get: (r) => r.transportation, tabs: ["pending"] },
    ],
    columns: COLUMNS,
  });

  return (
    <div className="space-y-3">
      <ListToolbar list={list} filtersInDialog searchPlaceholder="Search by ticket ID, client, company or phone..." />
      <ListTable
        list={list}
        ctx={{
          onTada: handleTADAClick,
          onReschedule: handleRescheduleClick,
          canReschedule: role === "admin" || role === "engineer",
        }}
        rowKey={(r) => r.ticketId}
        emptyTitle={{ pending: "No pending TADA requests found.", history: "No TADA history found." }}
        ariaLabel="TADA tickets"
      />

      {tadaTicket && (
        <TadaFormModal key={tadaTicket.ticketId} ticket={tadaTicket} onClose={() => setTadaTicket(null)} onSaved={fetchData} />
      )}
      {rescheduleTicket && (
        <RescheduleModal ticket={rescheduleTicket} onClose={() => setRescheduleTicket(null)} onDone={fetchData} />
      )}
    </div>
  );
}
