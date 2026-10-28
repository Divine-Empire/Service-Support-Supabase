import { useState, useEffect, useRef } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Modal } from "../components/ui/modal";
import { useToast } from "../hooks/use-toast";
import { Loader2Icon, LoaderIcon } from "lucide-react";
import MakeQuotation from "./Quotation/MakeQuotation";
import { supabase } from "../lib/supabase/client";
import { fetchDropdownRows } from "../lib/supabase/dropdown";
import { sendQuotationSharedNotification } from "../lib/notifications/whatsapp";
import { ListToolbar, ListTable, StatusBadge } from "../components/shared";
import { useClientList } from "../hooks/useClientList";
import useAuth from "../hooks/useAuth";

// Kept local: an unparseable value is shown as-is (lib/format returns "").
const formatDate = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const linkCell = (url, label) =>
  url ? (
    <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
      {label}
    </a>
  ) : (
    ""
  );

const itemListCell = (r, { onItems }) => (
  <Button size="sm" variant="outline" onClick={() => onItems(r.itemQty)}>
    Show Item List
  </Button>
);

// Pending: Quotation action + enquiry/video-call columns. History: what was quoted/shared
// (admin-only Edit). Pending and History intentionally overlap (see fetchData).
const COLUMNS = [
  { key: "quote", label: "Action", fixed: true, tabs: ["pending"], cell: (r, { onQuote }) => (
    <Button size="sm" variant="outline" onClick={() => onQuote(r)} data-testid={`button-quotation-${r.ticketId}`}>
      Quotation
    </Button>
  ) },
  { key: "edit", label: "Action", fixed: true, tabs: ["history"], cell: (r, { onEdit }) => (
    <Button
      size="sm"
      variant="outline"
      onClick={() => onEdit(r)}
      title="Edit this ticket's quotation — e.g. to pull in a revised Make Quotation PDF"
    >
      Edit
    </Button>
  ) },
  { key: "date", label: "Date", defaultVisible: true, strong: true, text: (r) => formatDate(r.timeStemp) },
  { key: "ticketId", label: "Ticket-ID", defaultVisible: true, strong: true, text: (r) => r.ticketId },
  { key: "enquiryType", label: "Enquiry Type", defaultVisible: true, text: (r) => r.enquiryType },
  { key: "sourceOfEnquiry", label: "Source of enquiry", defaultVisible: false, text: (r) => r.sourceOfEnquiry },
  { key: "callType", label: "Call type", defaultVisible: false, text: (r) => r.callType },
  { key: "enquiryReceiverName", label: "Enquiry Receiver Name", defaultVisible: false, text: (r) => r.enquiryReceiverName },
  { key: "clientType", label: "Client Type", defaultVisible: false, text: (r) => r.clientType },
  { key: "companyName", label: "Company Name", defaultVisible: true, text: (r) => r.companyName },
  { key: "clientName", label: "Client Name", defaultVisible: true, text: (r) => r.clientName },
  { key: "phoneNumber", label: "Phone Number", defaultVisible: true, text: (r) => r.phoneNumber },
  { key: "siteAddress", label: "Site Address", defaultVisible: false, wrap: true, width: 200, text: (r) => r.siteAddress },
  { key: "gstNo", label: "GST No.", defaultVisible: false, text: (r) => r.gstNo },
  { key: "machineName", label: "Machine Name", defaultVisible: false, text: (r) => r.machineName },
  { key: "category", label: "Category", defaultVisible: false, text: (r) => r.category },
  { key: "mentionIssue", label: "Mention Issue", defaultVisible: false, wrap: true, width: 200, text: (r) => r.mentionIssue },
  { key: "serviceLocation", label: "Service Location", defaultVisible: false, text: (r) => r.serviceLocation },
  { key: "enquiryItemList", label: "Enquiry-Item-List", defaultVisible: false, tabs: ["pending"], cell: (r) => linkCell(r.enquiryItemList, "View") },
  { key: "otpStatus", label: "OTP Status", defaultVisible: false, tabs: ["pending"], cell: (r) => (
    r.otpVarificationStatus ? <StatusBadge>{r.otpVarificationStatus}</StatusBadge> : ""
  ) },
  { key: "quotationNo", label: "Quotation No.", defaultVisible: true, text: (r) => r.quotationNo },
  { key: "basicValue", label: "Quotation Basic Value", defaultVisible: true, tabs: ["pending"], text: (r) => (
    r.basicAmount !== null && r.basicAmount !== undefined ? String(r.basicAmount).trim() || "0" : "N/A"
  ) },
  { key: "basicAmount", label: "Basic Amount", defaultVisible: true, tabs: ["history"], text: (r) => `₹${r.basicAmount || "0"}` },
  { key: "totalAmount", label: "Total Amount", defaultVisible: true, tabs: ["history"], text: (r) => `₹${r.totalQutation || "0"}` },
  { key: "shareBy", label: "Share By", defaultVisible: false, tabs: ["history"], text: (r) => r.quotationShareBy },
  { key: "shareThrough", label: "Share Through", defaultVisible: false, tabs: ["history"], text: (r) => r.shareThrough },
  { key: "quotationPdf", label: "Quotation PDF", defaultVisible: true, cell: (r) => linkCell(r.quotationPdfLink, "View PDF") },
  { key: "videoCallRemarks", label: "Video Call Remarks", defaultVisible: false, tabs: ["pending"], wrap: true, width: 200, text: (r) => r.videoCallRemarks },
  { key: "remarks", label: "Remarks", defaultVisible: false, tabs: ["history"], wrap: true, width: 200, text: (r) => r.remarks },
  { key: "itemList", label: "Item List", defaultVisible: true, cell: itemListCell },
];
// The History "Edit" action is admin-only.
const COLUMNS_NON_ADMIN = COLUMNS.filter((c) => c.key !== "edit");

export default function Quotation() {
  const [showQuotationModal, setShowQuotationModal] = useState(false);
  const [masterData, setMasterData] = useState({});
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [formData, setFormData] = useState({});

  const [pendingData, setPendingData] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingQuotation, setIsUploadingQuotation] = useState(false);
  const [quotationPdfFile, setQuotationPdfFile] = useState(null);
  // Latest Quotation No. the user picked — lets the async items lookup in
  // handleQuotationNoChange drop a stale response after a quick A -> B switch.
  const latestQuotationNoRef = useRef("");
  const [isCancelled, setIsCancelled] = useState(false);
  // Whether the Create/Revise modal was opened from History's admin-only
  // "Edit" action — hides the "Cancel Ticket" option in that mode.
  const [isHistoryEditMode, setIsHistoryEditMode] = useState(false);
  const [showMakeQuotationModal, setShowMakeQuotationModal] = useState(false);
  const [showItemListModal, setShowItemListModal] = useState(false);
  const [selectedItemList, setSelectedItemList] = useState([]);
  // Quotations previously built (via "Make Quotation") for the ticket
  // currently open in the Create/Revise Quotation modal — powers the
  // Quotation No. dropdown and its Basic/Total/PDF autofill.
  const [generatedQuotations, setGeneratedQuotations] = useState([]);
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

  // isHistoryEdit: opened from the History tab's admin-only "Edit" action —
  // lets a later sss_make_quotation revision be pulled in for a ticket
  // that's already moved past this stage (Order Received, Invoice, ...).
  // The "Cancel Ticket" option is hidden in this mode — cancelling a ticket
  // that's already progressed doesn't make sense from here. See migration
  // 0063 for the current_stage-regression fix this relies on.
  const handleQuotationClick = (ticket, { isHistoryEdit = false } = {}) => {
    setSelectedTicket(ticket);
    setIsHistoryEditMode(isHistoryEdit);
    setIsCancelled(false);
    setFormData({
      ticketId: ticket.ticketId,
      clientName: ticket.clientName,
      phoneNumber: ticket.phoneNumber,
      enquiryReceiverName: ticket.enquiryReceiverName || "",
      machineName: ticket.machineName || "",
      siteAddress: ticket.siteAddress || "",
      // Prefill from the existing quotation when revising; blank for a first-time quote.
      quotationNo: ticket.quotationNo || "",
      basicAmount: ticket.basicAmount || "",
      totalAmountWithTax: ticket.totalQutation || "",
      quotationPdfLink: ticket.quotationPdfLink || "",
      quotationShareBy: ticket.quotationShareBy || "",
      shareThrough: ticket.shareThrough || "",
      remarks: ticket.remarks || "",
    });
    setQuotationPdfFile(null);
    setGeneratedQuotations([]);
    setShowQuotationModal(true);

    if (ticket.ticketUuid) {
      fetchGeneratedQuotations(ticket.ticketUuid);
    }
  };

  // Every quotation (and revision) built via "Make Quotation" for this
  // ticket — mirrors Lead-To-Order-Supabase-New's MakeQuotationFrom.jsx
  // fetchGeneratedQuotations, sourced from make_quotation.ticket_uuid.
  const fetchGeneratedQuotations = async (ticketUuid) => {
    try {
      const { data, error } = await supabase
        .from("sss_make_quotation")
        .select("quotation_no, grand_total, pdf_url, created_at")
        .eq("ticket_uuid", ticketUuid)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setGeneratedQuotations(data || []);
    } catch (error) {
      console.error("Error fetching generated quotations for ticket:", error);
      setGeneratedQuotations([]);
    }
  };

  // Selecting a Quotation No. pre-fills Total Amount / PDF link from the
  // matched make_quotation row, and Basic Amount from the sum of that
  // quotation's non-freight quotation_items.amount. Fields stay editable
  // afterward (pre-fill, not lock) — same as MakeQuotationFrom.jsx.
  //
  // Everything is replaced (or cleared) on every switch so nothing from the
  // previously selected quotation can linger: a manually picked PDF file
  // (which would otherwise hide the new link and be uploaded on submit), the
  // old link when the new row has none, or the old amounts.
  const handleQuotationNoChange = (value) => {
    latestQuotationNoRef.current = value;
    const matched = generatedQuotations.find((q) => q.quotation_no === value);

    setQuotationPdfFile(null);
    setFormData((prev) => ({
      ...prev,
      quotationNo: value,
      totalAmountWithTax:
        matched && matched.grand_total !== undefined && matched.grand_total !== null
          ? String(matched.grand_total)
          : "",
      quotationPdfLink: matched?.pdf_url || "",
      basicAmount: "",
    }));

    if (value) {
      supabase
        .from("sss_quotation_items")
        .select("amount, is_freight")
        .eq("quotation_no", value)
        .then(({ data: items, error }) => {
          // User already moved on to another quotation — ignore this response.
          if (latestQuotationNoRef.current !== value) return;
          if (!error && items && items.length > 0) {
            const subtotal = items.reduce((sum, item) => {
              if (item.is_freight) return sum;
              return sum + (Number(item.amount) || 0);
            }, 0);
            handleInputChange("basicAmount", String(Math.round(subtotal * 100) / 100));
          }
        });
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const uploadImageToDrive = async (file) => {
    try {
      const path = `quotation/${selectedTicket?.ticketId}_${Date.now()}_${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("ticket_enquiry")
        .upload(path, file, { contentType: file.type });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("ticket_enquiry").getPublicUrl(path);

      return { success: true, fileUrl: data.publicUrl };
    } catch (error) {
      console.error("Error uploading image:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to upload image",
        variant: "destructive",
      });
      return { success: false, error: error.message || "Failed to upload image" };
    }
  };

  // Just holds the picked file — actual upload happens at submit time in
  // handleSubmit, so cancelling the form never leaves an orphaned upload behind.
  const handleQuotationChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setQuotationPdfFile(file);
    handleInputChange("quotationPdfLink", "");
  };

  const removeQuotationPdfFile = () => {
    setQuotationPdfFile(null);
    handleInputChange("quotationPdfLink", "");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!quotationPdfFile && !formData.quotationPdfLink) {
      toast({ title: "Validation Error", description: "Please Upload quotation PDF", variant: "destructive" });
      return;
    }

    if (!formData.quotationShare) {
      toast({ title: "Validation Error", description: "Please select quotation Share", variant: "destructive" });
      return;
    }

    if (!formData.quotationShareBy) {
      toast({ title: "Validation Error", description: "Please select quotation Shareby", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);

    try {
      let fileUrl = formData.quotationPdfLink || "";

      if (quotationPdfFile) {
        setIsUploadingQuotation(true);
        const uploadResult = await uploadImageToDrive(quotationPdfFile);
        setIsUploadingQuotation(false);
        if (!uploadResult.success) {
          throw new Error(uploadResult.error || "Failed to upload quotation PDF");
        }
        fileUrl = uploadResult.fileUrl;
      }

      const payload = {
        ticket_id: selectedTicket.ticketId,
        ticket_uuid: selectedTicket.ticketUuid,
        quotation_no: formData.quotationNo || null,
        basic_amount: formData.basicAmount ? Number(formData.basicAmount) : null,
        total_amount: formData.totalAmountWithTax ? Number(formData.totalAmountWithTax) : null,
        quotation_pdf_link: fileUrl || null,
        quotation_share_by: formData.quotationShareBy || null,
        share_through: "Mail",
        remarks: formData.remarks || null,
      };

      // Locked in on the FIRST quotation only — omitted on every later
      // revision so it's never overwritten (revising a quotation shouldn't
      // restart FollowUp's readiness clock).
      if (!selectedTicket.hasQuotation) {
        payload.follow_up_planned = new Date().toISOString();
      }

      const { error } = await supabase
        .from("sss_quotation")
        .upsert(payload, { onConflict: "ticket_uuid" });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Ticket details saved successfully",
      });

      // Fire-and-forget: a WhatsApp failure should never block this
      // submission, which has already succeeded at this point. Only sent
      // when the user explicitly chose to share the quotation.
      if (formData.quotationShare === "Yes") {
        sendQuotationSharedNotification({
          clientPhoneNumber: selectedTicket.phoneNumber,
          clientName: selectedTicket.clientName,
          companyName: selectedTicket.companyName,
          ticketId: selectedTicket.ticketId,
          quotationNo: formData.quotationNo,
          pdfUrl: fileUrl,
          pdfFileName: `Quotation_${formData.quotationNo}.pdf`,
        }).then(({ success, error }) => {
          if (!success) {
            toast({
              title: "WhatsApp notification not sent",
              description: error || "Quotation was saved, but the WhatsApp message could not be sent.",
              variant: "destructive",
            });
          }
        });
      }

      setShowQuotationModal(false);
      setQuotationPdfFile(null);
      fetchData();
    } catch (error) {
      console.error("Error submitting ticket:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save ticket details",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setIsUploadingQuotation(false);
    }
  };

  const [cancelSubmit, setCancelSubmit] = useState(false);

  const handleSubmitCancel = async (e) => {
    e.preventDefault();

    setCancelSubmit(true);

    try {
      const { error } = await supabase.from("sss_cancelled_tickets").insert({
        ticket_id: selectedTicket.ticketId,
        ticket_uuid: selectedTicket.ticketUuid,
        cancelled_from_stage: "Quotation",
        remarks: formData.cancelRemarks || null,
      });

      if (error) throw error;

      // Removes it from THIS page's own pending list only — does not
      // globally exclude the ticket from any other stage's pending query
      // (see migration 0046's comment).
      setPendingData((prevPending) =>
        prevPending.filter(
          (ticket) => ticket.ticketId !== selectedTicket.ticketId
        )
      );
      setShowQuotationModal(false);
      setIsCancelled(false);
      toast({
        title: "Success",
        description: "Ticket cancelled successfully",
      });
    } catch (error) {
      console.error("Error cancelling ticket:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to cancel ticket",
        variant: "destructive",
      });
    } finally {
      setCancelSubmit(false);
    }
  };

  const list = useClientList({
    key: "quotation",
    data: { pending: pendingData, history: historyData },
    loading: fetchLoading,
    error: loadError,
    onRetry: fetchData,
    searchKeys: ["ticketId", "clientName", "companyName", "phoneNumber", "quotationNo"],
    filters: [
      { key: "enquiryType", label: "Enquiry Type", allLabel: "All Enquiry Types", get: (r) => r.enquiryType },
      { key: "category", label: "Category", allLabel: "All Categories", get: (r) => r.category },
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
              setSelectedTicket(null);
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

      {/* Create Quotation Modal */}
      <Modal
        isOpen={showQuotationModal}
        onClose={() => setShowQuotationModal(false)}
        title={selectedTicket?.hasQuotation ? "Revise Quotation" : "Create Quotation"}
        size="2xl"
      >
        <div className="max-h-[calc(100vh-200px)] overflow-y-auto px-4 pb-4">
          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            {!isHistoryEditMode && (
              <div className="flex items-center space-x-2 mb-10">
                <input
                  type="checkbox"
                  id="cancelTicket"
                  checked={isCancelled}
                  onChange={(e) => setIsCancelled(e.target.checked)}
                  className="h-4 w-4 rounded border-input accent-destructive"
                />
                <Label
                  htmlFor="cancelTicket"
                  className="text-destructive font-medium"
                >
                  Cancel Ticket
                </Label>
              </div>
            )}

            <div></div>

            {/* Pre-filled fields */}
            <div>
              <Label htmlFor="quo-ticketId">Ticket ID</Label>
              <Input
                id="quo-ticketId"
                value={formData.ticketId || ""}
                disabled
                className="bg-muted"
              />
            </div>
            <div>
              <Label htmlFor="quo-clientName">Client Name</Label>
              <Input
                id="quo-clientName"
                value={formData.clientName || ""}
                disabled
                className="bg-muted"
              />
            </div>
            <div>
              <Label htmlFor="quo-phoneNumber">Phone Number</Label>
              <Input
                id="quo-phoneNumber"
                value={formData.phoneNumber || ""}
                disabled
                className="bg-muted"
              />
            </div>

            {!isCancelled && (
              <>
                <div>
                  <Label htmlFor="quo-siteAddress">Site Address</Label>
                  <Input
                    id="quo-siteAddress"
                    value={formData.siteAddress || ""}
                    disabled
                    className="bg-muted"
                  />
                </div>

                <div>
                  <Label htmlFor="quo-quotationNo">Quotation No. *</Label>
                  <select
                    id="quo-quotationNo"
                    value={formData.quotationNo || ""}
                    onChange={(e) => handleQuotationNoChange(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    data-testid="select-quotation-no"
                    required
                  >
                    <option value="">Select quotation number</option>
                    {generatedQuotations.map((q) => (
                      <option key={q.quotation_no} value={q.quotation_no}>
                        {q.quotation_no}
                        {q.grand_total ? ` — ₹${q.grand_total}` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Editable fields */}
                <div>
                  <Label htmlFor="quo-basicAmount">Basic Amount *</Label>
                  <Input
                    id="quo-basicAmount"
                    type="number"
                    placeholder="Enter basic amount"
                    value={formData.basicAmount || ""}
                    onChange={(e) =>
                      handleInputChange("basicAmount", e.target.value)
                    }
                    data-testid="input-basic-amount"
                  />
                </div>
                <div>
                  <Label htmlFor="quo-totalAmount">Total Amount with Tax *</Label>
                  <Input
                    id="quo-totalAmount"
                    type="number"
                    placeholder="Enter total amount"
                    value={formData.totalAmountWithTax || ""}
                    onChange={(e) =>
                      handleInputChange("totalAmountWithTax", e.target.value)
                    }
                    data-testid="input-total-amount"
                  />
                </div>
                <div>
                  <Label htmlFor="quo-pdfFile" className="flex items-center gap-2">
                    Quotation PDF Link *
                    {isUploadingQuotation && (
                      <LoaderIcon className="animate-spin w-4 h-4 text-primary" />
                    )}
                  </Label>
                  {quotationPdfFile ? (
                    <div className="flex items-center justify-between border border-input rounded-md p-2 bg-muted text-foreground text-sm">
                      <span className="truncate max-w-[250px]" title={quotationPdfFile.name}>
                        {quotationPdfFile.name}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={removeQuotationPdfFile}
                        className="text-destructive hover:text-destructive h-8 px-2 py-1 text-xs font-semibold"
                      >
                        Remove
                      </Button>
                    </div>
                  ) : formData.quotationPdfLink ? (
                    <div className="flex items-center justify-between border border-success/25 rounded-md p-2 bg-success/10 text-success text-sm">
                      <a href={formData.quotationPdfLink} target="_blank" rel="noopener noreferrer" className="font-semibold underline truncate max-w-[250px]">
                        View File
                      </a>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={removeQuotationPdfFile}
                        className="text-destructive hover:text-destructive h-8 px-2 py-1 text-xs font-semibold"
                      >
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <Input
                      id="quo-pdfFile"
                      type="file"
                      onChange={handleQuotationChange}
                      data-testid="input-pdf-link"
                    />
                  )}
                  {isUploadingQuotation && (
                    <p className="text-xs text-primary mt-1">Uploading file, please wait...</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="quo-shareBy">Quotation Share By *</Label>
                  <select
                    id="quo-shareBy"
                    value={formData.quotationShareBy || ""}
                    onChange={(e) =>
                      handleInputChange("quotationShareBy", e.target.value)
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Select Share By</option>
                    {masterData[0]?.["Quotation Share by"]?.map((person) => (
                      <option key={person} value={person}>
                        {person}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="quo-share">Quotation Share *</Label>
                  <select
                    id="quo-share"
                    value={formData.quotationShare || ""}
                    onChange={(e) =>
                      handleInputChange("quotationShare", e.target.value)
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    data-testid="select-quotation-share"
                  >
                    <option value="">Select Quotation Share</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>
                <div className="md:col-span-2 flex space-x-4 pt-4 sticky bottom-0 bg-background py-4">
                  <Button
                    type="submit"
                    disabled={isSubmitting || isUploadingQuotation}
                    data-testid="button-submit-quotation"
                    className="px-6"
                  >
                    {isSubmitting && <Loader2Icon className="animate-spin" />}
                    Submit
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowQuotationModal(false)}
                    data-testid="button-cancel-quotation"
                  >
                    Cancel
                  </Button>
                </div>
              </>
            )}

            {isCancelled && (
              <>
                <div>
                  <Label htmlFor="quo-cancelRemarks">Remarks</Label>
                  <Textarea
                    id="quo-cancelRemarks"
                    rows={3}
                    value={formData.cancelRemarks || ""}
                    onChange={(e) =>
                      handleInputChange("cancelRemarks", e.target.value)
                    }
                    data-testid="textarea-remark"
                  />
                </div>

                <div className="flex justify-center py-6">
                  <Button
                    type="button"
                    onClick={handleSubmitCancel}
                    disabled={cancelSubmit}
                    variant="destructive"
                    className="px-8 py-3"
                  >
                    {cancelSubmit && (
                      <Loader2Icon className="animate-spin w-4 h-4 mr-2" />
                    )}
                    Confirm Cancellation
                  </Button>
                </div>
              </>
            )}
          </form>
        </div>
      </Modal>

      <Modal
        isOpen={showMakeQuotationModal}
        onClose={() => setShowMakeQuotationModal(false)}
        title="Make Quotation"
        size="6xl"
      >
        <MakeQuotation
          ticket={selectedTicket}
          onClose={() => setShowMakeQuotationModal(false)}
        />
      </Modal>

      {/* Item List Modal */}
      <Modal isOpen={showItemListModal} onClose={() => setShowItemListModal(false)} title="Item List" size="lg">
        <div className="max-h-[60vh] overflow-y-auto">
          {selectedItemList.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <p className="text-sm font-medium">No items found for this ticket.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary text-muted-foreground">
                  <th className="px-4 py-2 text-left font-semibold w-10">#</th>
                  <th className="px-4 py-2 text-left font-semibold">Item Name</th>
                  <th className="px-4 py-2 text-center font-semibold w-20">Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {selectedItemList.map((row, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-2.5 text-muted-foreground font-medium">{idx + 1}</td>
                    <td className="px-4 py-2.5 text-foreground">{row.item || "—"}</td>
                    <td className="px-4 py-2.5 text-center text-foreground font-semibold">{row.qty || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="pt-4 flex justify-end">
          <Button type="button" onClick={() => setShowItemListModal(false)}>
            Close
          </Button>
        </div>
      </Modal>
    </div>
  );
}
