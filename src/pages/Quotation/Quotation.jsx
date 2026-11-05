import { useState, useEffect } from "react";
import { Button } from "../../components/ui/button";
import { Modal } from "../../components/ui/modal";
import { useToast } from "../../hooks/use-toast";
import MakeQuotation from "./MakeQuotation";
import { supabase } from "../../lib/supabase/client";
import { fetchDropdownRows } from "../../lib/supabase/dropdown";
import { ListToolbar, ListTable } from "../../components/shared";
import { useClientList } from "../../hooks/useClientList";
import useAuth from "../../hooks/useAuth";
import { COLUMNS, COLUMNS_NON_ADMIN } from "./columns";
import QuotationFormModal from "./QuotationFormModal";
import ItemListModal from "./ItemListModal";

export default function Quotation() {
  const [masterData, setMasterData] = useState({});
  // The Create / Revise form: null = closed, { ticket, historyEdit } = open.
  const [quotationForm, setQuotationForm] = useState(null);

  const [pendingData, setPendingData] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [showMakeQuotationModal, setShowMakeQuotationModal] = useState(false);
  const [showItemListModal, setShowItemListModal] = useState(false);
  const [selectedItemList, setSelectedItemList] = useState([]);
  const { toast } = useToast();
  const { isAdmin } = useAuth();

  const fetchData = async () => {
    setFetchLoading(true);
    setLoadError(null);
    try {
      // Tickets ready for Quotation (warranty_check.quotation_planned set).
      const { data: warrantyRows, error: warrantyError } = await supabase
        .from("sss_warranty_check")
        .select("ticket_id, quotation_planned")
        .not("quotation_planned", "is", null);

      if (warrantyError) throw warrantyError;

      const ticketIds = (warrantyRows || []).map((w) => w.ticket_id);

      if (ticketIds.length === 0) {
        setPendingData([]);
        setHistoryData([]);
        return;
      }

      const { data: ticketsData, error: ticketsError } = await supabase
        .from("sss_tickets")
        .select("*")
        .in("ticket_id", ticketIds)
        .order("created_at", { ascending: true });

      if (ticketsError) throw ticketsError;

      const { data: quotationRows, error: quotationError } = await supabase
        .from("sss_quotation")
        .select("*")
        .in("ticket_id", ticketIds);

      if (quotationError) throw quotationError;

      const quotationByTicket = new Map(
        (quotationRows || []).map((q) => [q.ticket_id, q])
      );

      // Latest Video-Call attempt per ticket, for the "OTP Status" column and
      // the item list (a ticket only reaches Quotation via Video-Call's 'no'
      // outcome, or by skipping Video-Call entirely).
      const { data: videoCallRows, error: videoCallError } = await supabase
        .from("sss_video_call")
        .select("ticket_id, regeneration_status, item_qty, remarks, created_at")
        .in("ticket_id", ticketIds)
        .order("created_at", { ascending: false });

      if (videoCallError) throw videoCallError;

      const latestVideoCallByTicket = new Map();
      (videoCallRows || []).forEach((v) => {
        if (!latestVideoCallByTicket.has(v.ticket_id)) {
          latestVideoCallByTicket.set(v.ticket_id, v);
        }
      });

      // Latest Follow-Up entry per ticket — the one and only closing signal
      // for this stage's "pending" list: once a ticket's latest follow_up
      // row is stage = 'Order Received', it's considered fully handed off
      // and drops out of Quotation's pending (still stays in history if it
      // was ever quoted).
      const { data: followUpRows, error: followUpError } = await supabase
        .from("sss_follow_up")
        .select("ticket_id, stage, created_at")
        .in("ticket_id", ticketIds)
        .order("created_at", { ascending: false });

      if (followUpError) throw followUpError;

      const latestFollowUpByTicket = new Map();
      (followUpRows || []).forEach((f) => {
        if (!latestFollowUpByTicket.has(f.ticket_id)) {
          latestFollowUpByTicket.set(f.ticket_id, f);
        }
      });

      // Aside from the Order-Received closing signal above, there's no
      // other closing signal for this stage (revising a quotation never
      // removes a ticket from pending) — pending and history are two
      // independent views over the same gated set, not a partition: pending
      // = every gated ticket whose latest follow_up isn't 'Order Received';
      // history = the subset that's been quoted at least once, for browsing
      // past quotations (unaffected by Order Received).
      const pending = [];
      const history = [];

      (ticketsData || []).forEach((t) => {
        const latestVideoCall = latestVideoCallByTicket.get(t.ticket_id);
        const q = quotationByTicket.get(t.ticket_id);
        const latestFollowUp = latestFollowUpByTicket.get(t.ticket_id);

        const base = {
          ticketId: t.ticket_id,
          ticketUuid: t.uuid,
          timeStemp: t.created_at || "",
          enquiryType: t.enquiry_type || "",
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
          engineerAssign: t.engineer_assign || "",
          enquiryItemList: t.enquiry_item_list || "",
          otpVarificationStatus: latestVideoCall?.regeneration_status || "",
          itemQty: latestVideoCall?.item_qty ? JSON.stringify(latestVideoCall.item_qty) : "",
          videoCallRemarks: latestVideoCall?.remarks || "",
          hasQuotation: !!q,
          quotationNo: q?.quotation_no || "",
          basicAmount: q?.basic_amount ?? "",
          totalQutation: q?.total_amount ?? "",
          quotationPdfLink: q?.quotation_pdf_link || "",
          quotationShareBy: q?.quotation_share_by || "",
          shareThrough: q?.share_through || "",
          remarks: q?.remarks || "",
          delayMinutes: q?.delay_minutes,
        };

        if (latestFollowUp?.stage !== "Order Received") {
          pending.push(base);
        }
        if (q) history.push(base);
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

  const DROPDOWN_CATEGORY_TO_KEY = {
    quotation_share_by: "Quotation Share by",
  };

  const fetchMasterSheet = async () => {
    try {
      const data = await fetchDropdownRows(Object.keys(DROPDOWN_CATEGORY_TO_KEY));

      const structuredData = {};
      (data || []).forEach(({ category, value }) => {
        const key = DROPDOWN_CATEGORY_TO_KEY[category];
        if (!key) return;
        if (!structuredData[key]) structuredData[key] = [];
        structuredData[key].push(value);
      });

      setMasterData([structuredData]);
    } catch (error) {
      console.error("Error fetching master data:", error);
      toast({
        title: "Error",
        description: "Failed to load master data",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchMasterSheet();
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openItemList = (rawJson) => {
    try {
      const parsed = rawJson ? JSON.parse(rawJson) : [];
      setSelectedItemList(Array.isArray(parsed) ? parsed : []);
    } catch {
      setSelectedItemList([]);
    }
    setShowItemListModal(true);
  };

  // isHistoryEdit: opened from the History tab's admin-only "Edit" action, which lets a later
  // sss_make_quotation revision be pulled in for a ticket already past this stage. "Cancel Ticket" is
  // hidden in that mode (see migration 0063 for the current_stage-regression fix this relies on).
  const handleQuotationClick = (ticket, { isHistoryEdit = false } = {}) =>
    setQuotationForm({ ticket, historyEdit: isHistoryEdit });

  const list = useClientList({
    key: "quotation",
    data: { pending: pendingData, history: historyData },
    loading: fetchLoading,
    error: loadError,
    onRetry: fetchData,
    searchKeys: ["ticketId", "clientName", "companyName", "phoneNumber", "quotationNo"],
    filters: [
      // Quotation Copy = the "Quotation PDF" column; "Not Uploaded" = that cell is blank.
      { key: "quotationCopy", label: "Quotation Copy", allLabel: "All Quotation Copy", get: (r) => (String(r.quotationPdfLink || "").trim() ? "Uploaded" : "Not Uploaded") },
      { key: "category", label: "Category", allLabel: "All Categories", multi: true, get: (r) => r.category },
      { key: "shareBy", label: "Share By", allLabel: "All Share By", get: (r) => r.quotationShareBy, tabs: ["history"] },
    ],
    columns: isAdmin ? COLUMNS : COLUMNS_NON_ADMIN,
  });

  return (
    <div className="space-y-3">
      <ListToolbar
        list={list}
        searchPlaceholder="Search by ticket ID, client, company, phone or quotation no..."
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setShowMakeQuotationModal(true);
            }}
          >
            Make Quotation
          </Button>
        }
      />
      <ListTable
        list={list}
        ctx={{
          onQuote: (t) => handleQuotationClick(t),
          onEdit: (t) => handleQuotationClick(t, { isHistoryEdit: true }),
          onItems: openItemList,
        }}
        rowKey={(r) => r.ticketId}
        cardTitle={(r) => r.ticketId}
        emptyTitle={{ pending: "No pending quotations found.", history: "No quotation history found." }}
        ariaLabel="Quotations"
      />

      {quotationForm && (
        <QuotationFormModal
          key={quotationForm.ticket.ticketId}
          ticket={quotationForm.ticket}
          historyEdit={quotationForm.historyEdit}
          masterData={masterData}
          onClose={() => setQuotationForm(null)}
          onSaved={fetchData}
          onCancelled={(ticketId) => setPendingData((prev) => prev.filter((t) => t.ticketId !== ticketId))}
        />
      )}

      <Modal
        isOpen={showMakeQuotationModal}
        onClose={() => setShowMakeQuotationModal(false)}
        title="Make Quotation"
        size="6xl"
      >
        <MakeQuotation ticket={null} />
      </Modal>

      {showItemListModal && <ItemListModal items={selectedItemList} onClose={() => setShowItemListModal(false)} />}
    </div>
  );
}
