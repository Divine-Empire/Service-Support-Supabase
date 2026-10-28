import { useState, useEffect, useMemo } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Modal } from "../components/ui/modal";
import { useToast } from "../hooks/use-toast";
import { LoaderIcon, Loader2Icon, Download } from "lucide-react";
import { supabase } from "../lib/supabase/client";
import { fetchDropdownRows } from "../lib/supabase/dropdown";
import { computeStagePlanned } from "../lib/supabase/stagePlanning";
import { exportCsv } from "../lib/exportCsv";
import { ColumnSelector } from "../components/shared/ColumnSelector";
import StatusTabs from "../components/shared/StatusTabs";
import { FilterSearch } from "../components/shared/FilterBar";
import ListTable from "../components/shared/ListTable";
import { useClientList } from "../hooks/useClientList";
import FilterDialog, { FilterSection } from "../components/shared/FilterDialog";
import { FOLLOW_UP_COLUMNS, toCsvTable } from "./followUpColumns";

// Order Received form dropdowns (same sss_dropdown categories the old
// Order Received page used).
const DROPDOWN_CATEGORY_TO_KEY = {
  payment_term: "Payment Terms",
  payment_mode: "Payment Mode",
  acceptance_via: "Acceptance Via",
  senior_approved_by: "Senior Approved By",
};

export default function FollowUp() {
  const [dateFilterTab, setDateFilterTab] = useState("");
  // Independent of the Today/Overdue/Pending chips (combined with them via
  // AND): keeps only rows whose last call was logged today.
  const [lastCallTodayOnly, setLastCallTodayOnly] = useState(false);

  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [formData, setFormData] = useState({});
  const [followUpData, setFollowUpData] = useState([]);
  const [searchItem, setSearchItem] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const { toast } = useToast();

  // console.log("followUpData", followUpData);

  const [pendingData, setPendingData] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  // Order Received rows with hold_order = 'Yes' (not released yet).
  const [holdData, setHoldData] = useState([]);
  const [selectedHoldIds, setSelectedHoldIds] = useState([]);
  const [isReleasingHold, setIsReleasingHold] = useState(false);
  const [masterData, setMasterData] = useState({});
  const [isUploadingAdvancePayment, setIsUploadingAdvancePayment] = useState(false);
  const [isUploadingSeniorApproval, setIsUploadingSeniorApproval] = useState(false);

  const uniqueCategories = useMemo(() => {
    const categories = new Set();
    pendingData.forEach((item) => {
      if (item.category) categories.add(String(item.category).trim());
    });
    historyData.forEach((item) => {
      if (item.category) categories.add(String(item.category).trim());
    });
    return Array.from(categories).sort((a, b) => a.localeCompare(b));
  }, [pendingData, historyData]);

  const [ticketsMap, setTicketsMap] = useState({});
  const [fetchLoading, setFetchLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);
  const [isUploadingClientAttachment, setIsUploadingClientAttachment] = useState(false);

  // --- History tab: "Client Approval" attachment edit modal state ---
  // Scoped separately from the Pending tab's Follow-Up form state above,
  // since this edits one specific sss_follow_up row (by its own id), not a
  // new follow-up submission.
  const [editingHistoryRow, setEditingHistoryRow] = useState(null);
  const [, setEditAttachmentFile] = useState(null);
  const [editAttachmentUrl, setEditAttachmentUrl] = useState("");
  const [isUploadingEditAttachment, setIsUploadingEditAttachment] = useState(false);
  const [isSavingEditAttachment, setIsSavingEditAttachment] = useState(false);
  // Order Received rows: Acceptance Via / Advance Payment / Senior Approval
  // are editable from History too (moved here from the Order Received page).
  const [editOrderFields, setEditOrderFields] = useState({});
  const [isUploadingEditOrderFile, setIsUploadingEditOrderFile] = useState(false);

  const fetchData = async () => {
    setFetchLoading(true);
    setLoadError(null);
    try {
      // Tickets ready for Follow-Up (quotation.follow_up_planned set).
      const { data: quotationRows, error: quotationError } = await supabase
        .from("sss_quotation")
        .select("ticket_id, follow_up_planned, quotation_no, basic_amount, total_amount, quotation_pdf_link, quotation_share_by, share_through, remarks")
        .not("follow_up_planned", "is", null);

      if (quotationError) throw quotationError;

      const ticketIds = (quotationRows || []).map((q) => q.ticket_id);

      if (ticketIds.length === 0) {
        setPendingData([]);
        setHoldData([]);
        setFollowUpData([]);
        setTicketsMap({});
        return;
      }

      const quotationByTicket = new Map(
        (quotationRows || []).map((q) => [q.ticket_id, q])
      );

      const { data: ticketsData, error: ticketsError } = await supabase
        .from("sss_tickets")
        .select("*")
        .in("ticket_id", ticketIds)
        .order("created_at", { ascending: true });

      if (ticketsError) throw ticketsError;

      // Every submission is a permanent log row (append-only, multiple rows
      // per ticket allowed) — matches the legacy Follow-Up sheet's own
      // always-insert behavior.
      const { data: followUpRows, error: followUpError } = await supabase
        .from("sss_follow_up")
        .select("*")
        .in("ticket_id", ticketIds)
        .order("created_at", { ascending: true });

      if (followUpError) throw followUpError;

      // A ticket leaves pending once its 'Order Received' row carries the
      // order details (payment_mode). Legacy rows logged before Order Received
      // was merged into this stage have none yet — those tickets stay pending
      // and their form submit updates that same row.
      const orderReceivedRowByTicket = new Map();
      (followUpRows || []).forEach((f) => {
        if (f.stage === "Order Received") orderReceivedRowByTicket.set(f.ticket_id, f);
      });

      // Latest follow_up log per ticket (rows are fetched created_at
      // ascending above, so the last one seen per ticket_id is the newest) —
      // powers Pending's "Last Call Date / Last Remarks / Next Call Date /
      // Next Action" columns. A ticket can already have prior 'Followup'
      // log rows while still pending (not yet 'Order Received').
      const latestFollowUpByTicket = new Map();
      (followUpRows || []).forEach((f) => {
        latestFollowUpByTicket.set(f.ticket_id, f);
      });

      // Needed at submit time to decide whether an 'Order Received' log also
      // stamps site_visit_planned (only when the ticket's own video_call
      // attempt chose Service Type = 'Site Visit').
      const { data: videoCallRows, error: videoCallError } = await supabase
        .from("sss_video_call")
        .select("ticket_id, service_type, created_at")
        .in("ticket_id", ticketIds)
        .order("created_at", { ascending: false });

      if (videoCallError) throw videoCallError;

      const latestVideoCallByTicket = new Map();
      (videoCallRows || []).forEach((v) => {
        if (!latestVideoCallByTicket.has(v.ticket_id)) {
          latestVideoCallByTicket.set(v.ticket_id, v);
        }
      });

      const ticketsMapObj = {};
      const pending = [];
      const hold = [];

      (ticketsData || []).forEach((t) => {
        const q = quotationByTicket.get(t.ticket_id);
        const latestFollowUp = latestFollowUpByTicket.get(t.ticket_id);
        const base = {
          ticketId: t.ticket_id,
          ticketUuid: t.uuid,
          timeStemp: t.created_at || "",
          sourceOfEnquiry: t.source_of_enquiry || "",
          enquiryType: t.enquiry_type || "",
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
          quotationNo: q?.quotation_no || "",
          basicAmount: q?.basic_amount ?? "",
          totalAmoutWithTex: q?.total_amount ?? "",
          quotationPdfLink: q?.quotation_pdf_link || "",
          quotationShareByPersonName: q?.quotation_share_by || "",
          ShareThrough: q?.share_through || "",
          quotationremarks: q?.remarks || "",
          // If the ticket never went through Video-Call at all (no row
          // exists — it skipped that stage entirely), service_type is never
          // set there, so fall back to tickets.service_location instead.
          videoCallServiceType: latestVideoCallByTicket.has(t.ticket_id)
            ? latestVideoCallByTicket.get(t.ticket_id)?.service_type || ""
            : t.service_location || "",
          // Pending tab's "Last Call Date / Last Remarks / Next Call Date /
          // Next Action" — sourced from this ticket's own latest follow_up
          // log row (if any), not from the quotation.
          lastCallDate: latestFollowUp?.created_at || "",
          lastRemarks: latestFollowUp?.what_did_customer_say || "",
          nextCallDate: latestFollowUp?.next_date_of_call || "",
          nextAction: latestFollowUp?.next_action || "",
        };

        ticketsMapObj[t.ticket_id] = base;

        const orderRow = orderReceivedRowByTicket.get(t.ticket_id);
        if (!orderRow) {
          pending.push(base);
        } else if (!orderRow.payment_mode) {
          pending.push({
            ...base,
            legacyOrderRow: orderRow,
            clientAttachment: orderRow.client_attachment_url || "",
          });
        } else if (orderRow.hold_order === "Yes") {
          hold.push({
            ...base,
            orderRow,
            paymentMode: orderRow.payment_mode,
            holdDate: orderRow.created_at,
          });
        }
      });

      setTicketsMap(ticketsMapObj);
      setPendingData(pending);
      setHoldData(hold);
      setSelectedHoldIds([]);
      // History hides Order Received rows still on hold.
      setFollowUpData((followUpRows || []).filter((f) => f.hold_order !== "Yes"));
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

  const fetchMasterData = async () => {
    try {
      const rows = await fetchDropdownRows(Object.keys(DROPDOWN_CATEGORY_TO_KEY));
      const structured = {};
      (rows || []).forEach(({ category, value }) => {
        const key = DROPDOWN_CATEGORY_TO_KEY[category];
        if (!key || !value) return;
        if (!structured[key]) structured[key] = [];
        structured[key].push(value);
      });
      setMasterData(structured);
    } catch (error) {
      console.error("Error fetching master data:", error);
      toast({
        title: "Error",
        description: "Failed to load dropdown options",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchData();
    fetchMasterData();
  }, []);



  const handleFollowUpClick = (ticket) => {
    setSelectedTicket(ticket);
    setFormData({
      ticketId: ticket.ticketId,
      ticketUuid: ticket.ticketUuid,
      clientName: ticket.clientName,
      phoneNumber: ticket.phoneNumber,
      quotationNo: ticket.quotationNo || "",
      enquiryReceiverName: ticket.enquiryReceiverName || "",
      machineName: ticket.machineName || "",
      engineerAssign: ticket.engineerAssign || "",
      basicAmount: ticket.basicAmount || "",
      totalAmountWithTax: ticket.totalAmoutWithTex || "",
      quotationPdfLink: ticket.quotationPdfLink || "",
      quotationShareBy: ticket.quotationShareByPersonName || "",
      shareThrough: ticket.ShareThrough || "",
      remarks: ticket.quotationremarks || "",
      // Legacy 'Order Received' row without order details: only the Order
      // Received form applies, and its Client Approval is already uploaded.
      stage: ticket.legacyOrderRow ? "Order Received" : "",
      whatDidCustomerSay: "",
      nextAction: "",
      nextDateOfCall: "",
      clientAttachmentUrl: ticket.legacyOrderRow?.client_attachment_url || "",
      paymentTerm: "",
      acceptanceVia: "",
      paymentMode: "",
      advancePaymentAttachmentUrl: "",
      seniorApprovalUrl: "",
      seniorApprovedBy: "",
      holdOrder: "",
    });
    setIsCancelled(false);
    setShowFollowUpModal(true);
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const uploadImageToDrive = async (file) => {
    try {
      const path = `follow_up/${selectedTicket?.ticketId}_${Date.now()}_${file.name}`;

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

  const handleClientAttachmentChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploadingClientAttachment(true);
    try {
      const result = await uploadImageToDrive(file);
      if (result.success && result.fileUrl) {
        handleInputChange("clientAttachmentUrl", result.fileUrl);
        toast({
          title: "Success",
          description: "Client Approval uploaded successfully",
        });
      } else {
        e.target.value = null;
        handleInputChange("clientAttachmentUrl", "");
      }
    } catch (error) {
      console.error(error);
      e.target.value = null;
      handleInputChange("clientAttachmentUrl", "");
    } finally {
      setIsUploadingClientAttachment(false);
    }
  };

  // Advance Payment / Senior Approval uploads (Order Received form).
  const handleOrderFileChange = (field, setUploading) => async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      const result = await uploadImageToDrive(file);
      if (result.success && result.fileUrl) {
        handleInputChange(field, result.fileUrl);
        toast({ title: "Success", description: "File uploaded successfully" });
      } else {
        e.target.value = null;
        handleInputChange(field, "");
      }
    } finally {
      setUploading(false);
    }
  };

  // Next stage once an order is confirmed and not on hold:
  //   Site Visit ticket -> site_visit_planned (Site Visit -> TADA -> OTP -> CRM -> Invoice)
  //   FOC               -> nothing (no invoice)
  //   anything else     -> invoice_planned (Invoice TAT)
  // existingSiteVisitPlanned keeps a legacy row's earlier stamp.
  const computeOrderPlanned = async ({ serviceType, paymentMode, baseTime, existingSiteVisitPlanned }) => {
    if (serviceType === "Site Visit") {
      return {
        site_visit_planned: existingSiteVisitPlanned || baseTime.toISOString(),
        invoice_planned: null,
      };
    }
    if (paymentMode === "FOC") return { site_visit_planned: null, invoice_planned: null };
    return {
      site_visit_planned: null,
      invoice_planned: await computeStagePlanned("invoice", { orderReceivedSubmittedAt: baseTime }),
    };
  };

  // --- History tab: "Client Approval" attachment edit modal handlers ---
  const handleEditHistoryAttachmentClick = (row) => {
    setEditingHistoryRow(row);
    setEditAttachmentUrl(row["client-attachment"] || "");
    setEditAttachmentFile(null);
    setIsUploadingEditAttachment(false);
    setEditOrderFields({
      acceptanceVia: row.acceptance_via || "",
      advancePaymentAttachmentUrl: row.advance_payment_attachment || "",
      seniorApprovalUrl: row.senior_approval || "",
    });
  };

  const handleEditOrderFileChange = (field) => async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploadingEditOrderFile(true);
    try {
      const path = `follow_up/${editingHistoryRow?.ticketId || editingHistoryRow?.ticket_id}_${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("ticket_enquiry")
        .upload(path, file, { contentType: file.type });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("ticket_enquiry").getPublicUrl(path);
      setEditOrderFields((prev) => ({ ...prev, [field]: data.publicUrl }));
      toast({ title: "Success", description: "File uploaded successfully" });
    } catch (error) {
      console.error("Error uploading file:", error);
      e.target.value = null;
      toast({
        title: "Error",
        description: error.message || "Failed to upload file",
        variant: "destructive",
      });
    } finally {
      setIsUploadingEditOrderFile(false);
    }
  };

  const closeEditHistoryAttachmentModal = () => {
    setEditingHistoryRow(null);
    setEditAttachmentFile(null);
    setEditAttachmentUrl("");
    setIsUploadingEditAttachment(false);
    setIsSavingEditAttachment(false);
    setEditOrderFields({});
    setIsUploadingEditOrderFile(false);
  };

  const handleEditAttachmentFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploadingEditAttachment(true);
    try {
      // Reuses the same Supabase storage bucket/path pattern as
      // uploadImageToDrive (the Pending tab's Follow-Up form upload), but
      // keyed off the History row's own ticket_id rather than selectedTicket.
      const path = `follow_up/${editingHistoryRow?.ticketId || editingHistoryRow?.ticket_id}_${Date.now()}_${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("ticket_enquiry")
        .upload(path, file, { contentType: file.type });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("ticket_enquiry").getPublicUrl(path);

      setEditAttachmentFile(file);
      setEditAttachmentUrl(data.publicUrl);
      toast({
        title: "Success",
        description: "Client Approval uploaded successfully",
      });
    } catch (error) {
      console.error("Error uploading edit attachment:", error);
      e.target.value = null;
      toast({
        title: "Error",
        description: error.message || "Failed to upload image",
        variant: "destructive",
      });
    } finally {
      setIsUploadingEditAttachment(false);
    }
  };

  const handleSaveEditHistoryAttachment = async () => {
    if (!editingHistoryRow?.id) {
      toast({
        title: "Error",
        description: "Missing follow-up row id, cannot save",
        variant: "destructive",
      });
      return;
    }

    setIsSavingEditAttachment(true);
    try {
      const isOrderRow = editingHistoryRow.stage === "Order Received" && !!editingHistoryRow.payment_mode;
      const isFOCRow = editingHistoryRow.payment_mode === "FOC";
      const { error } = await supabase
        .from("sss_follow_up")
        .update({
          client_attachment_url: editAttachmentUrl || null,
          ...(isOrderRow
            ? {
                acceptance_via: editOrderFields.acceptanceVia || null,
                ...(isFOCRow
                  ? {}
                  : {
                      advance_payment_attachment: editOrderFields.advancePaymentAttachmentUrl || null,
                      senior_approval: editOrderFields.seniorApprovalUrl || null,
                    }),
              }
            : {}),
        })
        .eq("id", editingHistoryRow.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Follow-up updated successfully",
      });

      closeEditHistoryAttachmentModal();
      fetchData();
    } catch (error) {
      console.error("Error updating Client Approval:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update Client Approval",
        variant: "destructive",
      });
    } finally {
      setIsSavingEditAttachment(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // if (!formData.clientName || !formData.phoneNumber || !formData.title) {
    //  toast({
    //    title: "Error",
    //    description: "Please fill in all required fields",
    //    variant: "destructive",
    //  });
    //  return;
    // }

    if (!formData.stage) {
      alert("Please select a Stage");
      return;
    }

    if (formData.stage === "Followup") {
      if (!formData.whatDidCustomerSay) {
        alert("Please Write Something in What did Customer Say");
        return;
      }

      if (!formData.nextAction) {
        alert("Please Write Something in Next Action");
        return;
      }
      if (!formData.nextDateOfCall) {
        alert("Please Select Next Date of Call");
        return;
      }
    } else if (formData.stage === "Order Received") {
      if (!formData.clientAttachmentUrl) {
        alert("Please add and upload file for client Attachment");
        return;
      }
      if (!formData.paymentTerm) {
        alert("Please select Payment Term");
        return;
      }
      if (!formData.acceptanceVia) {
        alert("Please select Acceptance Via");
        return;
      }
      if (!formData.paymentMode) {
        alert("Please select Payment Mode");
        return;
      }
      // Advance Payment / Senior Approval are skipped for FOC (no payment).
      if (formData.paymentMode !== "FOC") {
        if (!formData.advancePaymentAttachmentUrl) {
          alert("Please add and upload Advance Payment Attachment");
          return;
        }
        if (!formData.seniorApprovalUrl) {
          alert("Please add and upload Senior Approval");
          return;
        }
        if (!formData.seniorApprovedBy) {
          alert("Please select Senior Approved By");
          return;
        }
      }
      if (!formData.holdOrder) {
        alert("Please select Hold Order");
        return;
      }
    }

    setIsSubmitting(true);

    try {
      let error;
      if (formData.stage === "Order Received") {
        const isFOC = formData.paymentMode === "FOC";
        const legacyRow = selectedTicket?.legacyOrderRow;
        // On hold: no next-stage planned until released from the Hold Orders tab.
        const planned =
          formData.holdOrder === "Yes"
            ? { site_visit_planned: legacyRow?.site_visit_planned || null, invoice_planned: null }
            : await computeOrderPlanned({
                serviceType: selectedTicket?.videoCallServiceType,
                paymentMode: formData.paymentMode,
                baseTime: new Date(),
                existingSiteVisitPlanned: legacyRow?.site_visit_planned,
              });

        const orderFields = {
          client_attachment_url: formData.clientAttachmentUrl || null,
          payment_term: formData.paymentTerm || null,
          acceptance_via: formData.acceptanceVia || null,
          payment_mode: formData.paymentMode || null,
          advance_payment_attachment: isFOC ? null : formData.advancePaymentAttachmentUrl || null,
          senior_approval: isFOC ? null : formData.seniorApprovalUrl || null,
          senior_approved_by: isFOC ? null : formData.seniorApprovedBy || null,
          hold_order: formData.holdOrder,
          // The separate Order Received stage is gone — never feed it again.
          order_received_planned: null,
          ...planned,
        };

        ({ error } = legacyRow
          ? await supabase.from("sss_follow_up").update(orderFields).eq("id", legacyRow.id)
          : await supabase.from("sss_follow_up").insert({
              ticket_id: formData.ticketId,
              ticket_uuid: formData.ticketUuid,
              stage: formData.stage,
              engineer_assign: formData.engineerAssign || null,
              ...orderFields,
            }));
      } else {
        ({ error } = await supabase.from("sss_follow_up").insert({
          ticket_id: formData.ticketId,
          ticket_uuid: formData.ticketUuid,
          stage: formData.stage,
          engineer_assign: formData.engineerAssign || null,
          what_did_customer_say: formData.whatDidCustomerSay || null,
          next_action: formData.nextAction || null,
          next_date_of_call: formData.nextDateOfCall || null,
        }));
      }

      if (error) throw error;

      setShowFollowUpModal(false);

      toast({
        title: "Success",
        description: "follow-up added successfully",
      });

      fetchData();
    } catch (error) {
      console.error("Error submitting ticket:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save ticket",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Hold Orders tab: release the selected orders and generate their
  // next-stage planned from the release time.
  const handleReleaseHold = async () => {
    const rows = holdData.filter((h) => selectedHoldIds.includes(h.orderRow.id));
    if (rows.length === 0) return;

    setIsReleasingHold(true);
    try {
      const releasedAt = new Date();
      const results = await Promise.all(
        rows.map(async (h) => {
          const planned = await computeOrderPlanned({
            serviceType: h.videoCallServiceType,
            paymentMode: h.paymentMode,
            baseTime: releasedAt,
            existingSiteVisitPlanned: h.orderRow.site_visit_planned,
          });
          return supabase
            .from("sss_follow_up")
            .update({
              hold_order: "No",
              hold_released_at: releasedAt.toISOString(),
              hold_released_by: localStorage.getItem("currentUsername") || null,
              ...planned,
            })
            .eq("id", h.orderRow.id)
            .eq("hold_order", "Yes");
        })
      );
      const failed = results.find((r) => r.error);
      if (failed) throw failed.error;

      toast({
        title: "Success",
        description: `${rows.length} order(s) released from hold`,
      });
      fetchData();
    } catch (error) {
      console.error("Error releasing hold orders:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to release hold orders",
        variant: "destructive",
      });
    } finally {
      setIsReleasingHold(false);
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
        cancelled_from_stage: "Follow-Up",
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
      toast({
        title: "Success",
        description: "Ticket cancelled successfully",
      });
      setShowFollowUpModal(false);
      setIsCancelled(false);
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

  const renderConditionalFields = () => {
    const stage = formData.stage;

    if (
      // stage === "call-not-picked" ||
      stage === "Followup"
      // stage === "introductory-call"
    ) {
      return (
        <>
          <div>
            <Label>What Did The Customer Say *</Label>
            <Textarea
              rows={3}
              value={formData.whatDidCustomerSay || ""}
              onChange={(e) =>
                handleInputChange("whatDidCustomerSay", e.target.value)
              }
              data-testid="textarea-customer-say"
            />
          </div>
          <div>
            <Label>Next Action *</Label>
            <Select
              value={formData.nextAction || undefined}
              onValueChange={(value) => handleInputChange("nextAction", value)}
            >
              <SelectTrigger className="bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500" data-testid="select-next-action">
                <SelectValue placeholder="Select Next Action" />
              </SelectTrigger>
              <SelectContent className="bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                {[
                  "Quotation Sent",
                  "Follow-up Required",
                  "Customer Contacted",
                  "Under Discussion",
                  "Price Negotiation",
                  "Waiting for Customer Response",
                  "Purchase Decision Pending",
                  "Quotation Revised",
                  "Order Confirmed",
                  "Order Lost",
                  "On Hold",
                  "Not Interested",
                ].map((option) => (
                  <SelectItem key={option} value={option} className="hover:bg-blue-50 focus:bg-blue-50">
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Next Date Of Call *</Label>
            <Input
              type="date"
              value={formData.nextDateOfCall || ""}
              onChange={(e) =>
                handleInputChange("nextDateOfCall", e.target.value)
              }
              data-testid="input-next-date"
            />
          </div>
        </>
      );
    } else if (stage === "Order Received") {
      return (
        <>
          <div>
            <Label className="flex items-center gap-2">
              Client Approval *
              {isUploadingClientAttachment && (
                <LoaderIcon className="animate-spin w-4 h-4 text-blue-600" />
              )}
            </Label>
            <Input
              type="file"
              disabled={isUploadingClientAttachment}
              onChange={handleClientAttachmentChange}
              data-testid="approval-attachments"
            />
            {isUploadingClientAttachment && (
              <p className="text-xs text-blue-600 mt-1">Uploading file, please wait...</p>
            )}
            {formData.clientAttachmentUrl && (
              <p className="mt-1 text-sm text-green-600">
                Current attachment:{" "}
                <a
                  href={formData.clientAttachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-green-800 font-medium"
                >
                  View File
                </a>
              </p>
            )}
          </div>
          <div>
            <Label>Payment Term *</Label>
            <Select
              value={formData.paymentTerm || undefined}
              onValueChange={(value) => handleInputChange("paymentTerm", value)}
            >
              <SelectTrigger data-testid="select-payment-term">
                <SelectValue placeholder="Select payment term" />
              </SelectTrigger>
              <SelectContent className="bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                {(masterData["Payment Terms"] || []).length > 0 ? (
                  masterData["Payment Terms"].map((item) => (
                    <SelectItem key={item} value={item} className="hover:bg-blue-50 focus:bg-blue-50">
                      {item}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="loading" disabled>
                    Loading options...
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Acceptance Via *</Label>
            <Select
              value={formData.acceptanceVia || undefined}
              onValueChange={(value) => handleInputChange("acceptanceVia", value)}
            >
              <SelectTrigger data-testid="select-acceptance-via">
                <SelectValue placeholder="Acceptance Via" />
              </SelectTrigger>
              <SelectContent className="bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                {(masterData["Acceptance Via"] || []).length > 0 ? (
                  masterData["Acceptance Via"].map((item) => (
                    <SelectItem key={item} value={item} className="hover:bg-blue-50 focus:bg-blue-50">
                      {item}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="loading" disabled>
                    Loading options...
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Payment Mode *</Label>
            <Select
              value={formData.paymentMode || undefined}
              onValueChange={(value) => handleInputChange("paymentMode", value)}
            >
              <SelectTrigger data-testid="select-payment-mode">
                <SelectValue placeholder="Select payment mode" />
              </SelectTrigger>
              <SelectContent className="bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                {(masterData["Payment Mode"] || []).length > 0 ? (
                  masterData["Payment Mode"].map((item) => (
                    <SelectItem key={item} value={item} className="hover:bg-blue-50 focus:bg-blue-50">
                      {item}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="loading" disabled>
                    Loading options...
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          {formData.paymentMode && formData.paymentMode !== "FOC" && (
            <>
            <div>
              <Label className="flex items-center gap-2">
                Advance Payment Attachment *
                {isUploadingAdvancePayment && (
                  <LoaderIcon className="animate-spin w-4 h-4 text-blue-600" />
                )}
              </Label>
              <Input
                type="file"
                disabled={isUploadingAdvancePayment}
                onChange={handleOrderFileChange("advancePaymentAttachmentUrl", setIsUploadingAdvancePayment)}
                data-testid="input-advance-payment-attachment"
              />
              {formData.advancePaymentAttachmentUrl && (
                <p className="mt-1 text-sm text-green-600">
                  Uploaded:{" "}
                  <a
                    href={formData.advancePaymentAttachmentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-green-800 font-medium"
                  >
                    View File
                  </a>
                </p>
              )}
            </div>
            <div>
              <Label className="flex items-center gap-2">
                Senior Approval *
                {isUploadingSeniorApproval && (
                  <LoaderIcon className="animate-spin w-4 h-4 text-blue-600" />
                )}
              </Label>
              <Input
                type="file"
                disabled={isUploadingSeniorApproval}
                onChange={handleOrderFileChange("seniorApprovalUrl", setIsUploadingSeniorApproval)}
                data-testid="input-senior-approval"
              />
              {formData.seniorApprovalUrl && (
                <p className="mt-1 text-sm text-green-600">
                  Uploaded:{" "}
                  <a
                    href={formData.seniorApprovalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-green-800 font-medium"
                  >
                    View File
                  </a>
                </p>
              )}
            </div>
            <div>
              <Label>Senior Approved By *</Label>
              <Select
                value={formData.seniorApprovedBy || undefined}
                onValueChange={(value) => handleInputChange("seniorApprovedBy", value)}
              >
                <SelectTrigger data-testid="select-senior-approved-by">
                  <SelectValue placeholder="Select senior" />
                </SelectTrigger>
                <SelectContent className="bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {(masterData["Senior Approved By"] || []).length > 0 ? (
                    masterData["Senior Approved By"].map((item) => (
                      <SelectItem key={item} value={item} className="hover:bg-blue-50 focus:bg-blue-50">
                        {item}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="loading" disabled>
                      Loading options...
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            </>
          )}
          <div>
            <Label>Hold Order *</Label>
            <Select
              value={formData.holdOrder || undefined}
              onValueChange={(value) => handleInputChange("holdOrder", value)}
            >
              <SelectTrigger data-testid="select-hold-order">
                <SelectValue placeholder="Select Yes / No" />
              </SelectTrigger>
              <SelectContent className="bg-white border border-gray-300 rounded-md shadow-lg">
                <SelectItem value="Yes" className="hover:bg-blue-50 focus:bg-blue-50">Yes</SelectItem>
                <SelectItem value="No" className="hover:bg-blue-50 focus:bg-blue-50">No</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      );
    }
    return null;
  };

  const filteredPendingData = pendingData
    .filter((item) => {
      const q = searchItem.toLowerCase();
      const matchesSearch =
        String(item.ticketId || "").toLowerCase().includes(q) ||
        String(item.clientName || "").toLowerCase().includes(q) ||
        String(item.companyName || "").toLowerCase().includes(q) ||
        String(item.phoneNumber || "").toLowerCase().includes(q) ||
        String(item.quotationNo || "").toLowerCase().includes(q);

      const matchesCategory =
        categoryFilter === "all" ||
        String(item.category || "").trim() === categoryFilter.trim();

      return matchesSearch && matchesCategory;
    })
    .reverse();

  const filteredHoldData = holdData
    .filter((item) => {
      const q = searchItem.toLowerCase();
      const matchesSearch =
        String(item.ticketId || "").toLowerCase().includes(q) ||
        String(item.clientName || "").toLowerCase().includes(q) ||
        String(item.companyName || "").toLowerCase().includes(q) ||
        String(item.phoneNumber || "").toLowerCase().includes(q) ||
        String(item.quotationNo || "").toLowerCase().includes(q);

      const matchesCategory =
        categoryFilter === "all" ||
        String(item.category || "").trim() === categoryFilter.trim();

      return matchesSearch && matchesCategory;
    })
    .reverse();

  const allHoldSelected =
    filteredHoldData.length > 0 &&
    filteredHoldData.every((h) => selectedHoldIds.includes(h.orderRow.id));

  const toggleHoldSelected = (id) =>
    setSelectedHoldIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const toggleAllHoldSelected = () =>
    setSelectedHoldIds(allHoldSelected ? [] : filteredHoldData.map((h) => h.orderRow.id));

  const enrichedFollowUpData = followUpData.map((item) => {
    const ticketDetails = ticketsMap[item.ticket_id] || {};
    return {
      ...item,
      // 16 core pipeline properties
      timeStemp: ticketDetails.timeStemp || item.created_at || "",
      timestamp: item.created_at || "",
      ticketId: item.ticket_id || "",
      what_did_the_customer_say: item.what_did_customer_say || "",
      "client-attachment": item.client_attachment_url || "",
      sourceOfEnquiry: ticketDetails.sourceOfEnquiry || "",
      enquiryType: ticketDetails.enquiryType || "",
      callType: ticketDetails.callType || "",
      enquiryReceiverName: ticketDetails.enquiryReceiverName || "",
      clientType: ticketDetails.clientType || "",
      companyName: ticketDetails.companyName || "",
      clientName: ticketDetails.clientName || "",
      phoneNumber: ticketDetails.phoneNumber || "",
      siteAddress: ticketDetails.siteAddress || "",
      gstNo: ticketDetails.gstNo || "",
      machineName: ticketDetails.machineName || "",
      category: ticketDetails.category || "",
      mentionIssue: ticketDetails.mentionIssue || "",
      serviceLocation: ticketDetails.serviceLocation || "",

      quotationNo: ticketDetails.quotationNo || "",

      // Roles lookup fallback
      cre_name: item.cre_name || ticketDetails.CREName || "",
      engineer_assign: item.engineer_assign || ticketDetails.engineerAssign || "",
    };
  });

  const filteredHistoryData = enrichedFollowUpData
    .filter((item) => {
      const q = searchItem.toLowerCase();
      const matchesSearch =
        String(item.ticketId || "").toLowerCase().includes(q) ||
        String(item.clientName || "").toLowerCase().includes(q) ||
        String(item.companyName || "").toLowerCase().includes(q) ||
        String(item.phoneNumber || "").toLowerCase().includes(q) ||
        String(item.quotationNo || "").toLowerCase().includes(q);

      const matchesCategory =
        categoryFilter === "all" ||
        String(item.category || "").trim() === categoryFilter.trim();

      return matchesSearch && matchesCategory;
    })
    .reverse();

  // Pending-tab rows carry nextCallDate/lastCallDate (from the ticket's
  // latest follow_up log), History-tab rows are raw sss_follow_up rows
  // (next_date_of_call/created_at). Both are normalized to a local
  // YYYY-MM-DD string so comparisons are timezone-safe.
  const toLocalYmd = (raw) => {
    if (!raw) return "";
    const s = String(raw);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const d = new Date(s);
    if (isNaN(d.getTime())) return "";
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const todayYmd = toLocalYmd(new Date());
  const nextCallYmd = (item) => toLocalYmd(item.nextCallDate ?? item.next_date_of_call);
  const lastCallYmd = (item) => toLocalYmd(item.lastCallDate ?? item.created_at);

  const matchesDateChip = (item, chip) => {
    const next = nextCallYmd(item);
    if (chip === "today") return next === todayYmd;
    if (chip === "overdue") return next !== "" && next < todayYmd;
    // Pending: no next call date yet, or one that is still ahead.
    if (chip === "pending") return next === "" || next > todayYmd;
    return true;
  };

  const filterByDateCategory = (data) =>
    data.filter(
      (item) =>
        matchesDateChip(item, dateFilterTab) &&
        (!lastCallTodayOnly || lastCallYmd(item) === todayYmd)
    );

  const chipCount = (data, chip) =>
    data.filter(
      (item) =>
        matchesDateChip(item, chip) &&
        (!lastCallTodayOnly || lastCallYmd(item) === todayYmd)
    ).length;
  const lastCallTodayCount = (data) =>
    data.filter(
      (item) =>
        matchesDateChip(item, dateFilterTab) && lastCallYmd(item) === todayYmd
    ).length;

  const attachmentFilteredPendingData = filteredPendingData;

  const finalFilteredPendingDataa = filterByDateCategory(attachmentFilteredPendingData);
  const finalFilteredHistoryDataa = filterByDateCategory(filteredHistoryData);

  // Rows are already searched / category- / date-chip-filtered above; the list hook only
  // owns the tab, paging and visible columns. Tab counts are therefore the filtered counts.
  const columns = FOLLOW_UP_COLUMNS.map((c) =>
    c.key === "hold:select"
      ? {
          ...c,
          label: (
            <input
              type="checkbox"
              aria-label="Select all held orders"
              checked={allHoldSelected}
              onChange={toggleAllHoldSelected}
              className="h-4 w-4"
              data-testid="checkbox-hold-all"
            />
          ),
        }
      : c
  );
  const list = useClientList({
    key: "followup",
    data: {
      pending: finalFilteredPendingDataa,
      hold: filteredHoldData,
      history: finalFilteredHistoryDataa,
    },
    loading: fetchLoading,
    error: loadError,
    onRetry: fetchData,
    tabLabels: { pending: "Pending", hold: "Hold Orders", history: "History" },
    columns,
    sort: "none",
  });
  const activeTab = list.tab;
  const chipBase = activeTab === "history" ? filteredHistoryData : attachmentFilteredPendingData;
  // Search / category / chips live on the page, so send the list back to page 1 when they change.
  const { setPage } = list;
  useEffect(() => {
    setPage(1);
  }, [searchItem, categoryFilter, dateFilterTab, lastCallTodayOnly, setPage]);



  const handleExportCsv = () => {
    const cols = list.activeColumns;
    const rows =
      activeTab === "history"
        ? finalFilteredHistoryDataa
        : activeTab === "hold"
        ? filteredHoldData
        : finalFilteredPendingDataa;
    if (rows.length === 0) {
      toast({ title: "Nothing to export", description: "No rows match the current filters.", variant: "destructive" });
      return;
    }
    const { headers, rows: body } = toCsvTable(cols, rows);
    exportCsv(`followup_${activeTab}_${todayYmd}`, headers, body);
  };

  // Everything that narrows the list besides the search box lives in the Filters dialog.
  const dateChipsApply = activeTab !== "hold";
  const activeFilterCount =
    (categoryFilter !== "all" ? 1 : 0) +
    (dateChipsApply && dateFilterTab ? 1 : 0) +
    (dateChipsApply && lastCallTodayOnly ? 1 : 0);
  const clearAllFilters = () => {
    setCategoryFilter("all");
    setDateFilterTab("");
    setLastCallTodayOnly(false);
  };
  const chipClass = (on, tone = "primary") =>
    `rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
      on
        ? tone === "danger"
          ? "border-destructive bg-destructive text-destructive-foreground"
          : "border-primary bg-primary text-primary-foreground"
        : "border-input bg-card text-foreground hover:bg-accent"
    }`;

  // console.log("finalFilteredPendingDataa", finalFilteredPendingDataa);
  // console.log("finalFilteredHistoryDataa", finalFilteredHistoryDataa);


  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="max-w-full overflow-x-auto scrollbar-hide">
          <StatusTabs tabs={list.tabs} activeTab={list.tab} onChange={list.setTab} label="Follow-up views" />
        </div>
        <FilterSearch
          value={searchItem}
          onChange={setSearchItem}
          placeholder="Search by ticket ID, client, company, phone or quotation no..."
          className="min-w-[220px]"
        />
      <FilterDialog activeCount={activeFilterCount} onClear={clearAllFilters}>
        {dateChipsApply && (
          <FilterSection title="Follow-up date">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                aria-pressed={dateFilterTab === "today"}
                onClick={() => setDateFilterTab(dateFilterTab === "today" ? "" : "today")}
                className={chipClass(dateFilterTab === "today")}
              >
                Today ({chipCount(chipBase, "today")})
              </button>
              <button
                type="button"
                aria-pressed={dateFilterTab === "overdue"}
                onClick={() => setDateFilterTab(dateFilterTab === "overdue" ? "" : "overdue")}
                className={chipClass(dateFilterTab === "overdue", "danger")}
              >
                Overdue ({chipCount(chipBase, "overdue")})
              </button>
              <button
                type="button"
                aria-pressed={dateFilterTab === "pending"}
                onClick={() => setDateFilterTab(dateFilterTab === "pending" ? "" : "pending")}
                className={chipClass(dateFilterTab === "pending")}
              >
                Pending ({chipCount(chipBase, "pending")})
              </button>
            </div>
          </FilterSection>
        )}

        {dateChipsApply && (
          <FilterSection title="Last call">
            <button
              type="button"
              aria-pressed={lastCallTodayOnly}
              onClick={() => setLastCallTodayOnly((v) => !v)}
              className={chipClass(lastCallTodayOnly)}
            >
              Last Call: Today ({lastCallTodayCount(chipBase)})
            </button>
          </FilterSection>
        )}

        <FilterSection title="Category">
          <select
            id="categoryFilter"
            aria-label="Category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none"
            data-testid="select-category-filter"
          >
            <option value="all">All Categories</option>
            {uniqueCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </FilterSection>

        <FilterSection title="Export">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            className="gap-2"
            data-testid="button-export-csv"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            Export CSV
          </Button>
          <p className="text-xs text-muted-foreground">
            Downloads the current tab with the filters above and the visible columns.
          </p>
        </FilterSection>
      </FilterDialog>
        {activeTab !== "hold" && <ColumnSelector {...list.columnPanel} />}
        {activeTab === "hold" && (
          <Button
            type="button"
            onClick={handleReleaseHold}
            disabled={selectedHoldIds.length === 0 || isReleasingHold}
            data-testid="button-release-hold"
          >
            {isReleasingHold && <Loader2Icon className="animate-spin w-4 h-4 mr-2" />}
            Submit ({selectedHoldIds.length})
          </Button>
        )}
      </div>

      <ListTable
        list={list}
        ctx={{
          onFollowUp: handleFollowUpClick,
          onEditHistory: handleEditHistoryAttachmentClick,
          selectedHoldIds,
          onToggleHold: toggleHoldSelected,
        }}
        rowKey={(r, tab) =>
          tab === "hold" ? r.orderRow.id : tab === "pending" ? r.ticketId : r.id ?? r.ticket_id + "-" + r.created_at
        }
        cardTitle={(r) => r.ticketId}
        emptyTitle={{
          pending: "No pending follow-ups found.",
          hold: "No orders on hold.",
          history: "No follow-up history found.",
        }}
        ariaLabel="Follow-ups"
      />

      {/* Follow-Up Modal */}
      <Modal
        isOpen={showFollowUpModal}
        onClose={() => setShowFollowUpModal(false)}
        title="Follow-Up"
        size="4xl"
      >
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <div className="flex items-center space-x-2 mb-10">
            <input
              type="checkbox"
              id="cancelTicket"
              checked={isCancelled}
              onChange={(e) => setIsCancelled(e.target.checked)}
              className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
            />
            <Label htmlFor="cancelTicket" className="text-red-600 font-medium">
              Cancel Ticket
            </Label>
          </div>

          <div></div>

          {/* Pre-filled fields */}
          <div>
            <Label>Ticket ID</Label>
            <Input
              value={formData.ticketId || ""}
              disabled
              className="bg-slate-50"
            />
          </div>
          <div>
            <Label>Client Name</Label>
            <Input
              value={formData.clientName || ""}
              disabled
              className="bg-slate-50"
            />
          </div>
          <div>
            <Label>Phone Number</Label>
            <Input
              value={formData.phoneNumber || ""}
              disabled
              className="bg-slate-50"
            />
          </div>
          {/* NEW: Quotation No Field in Modal */}
          <div>
            <Label>Quotation No.</Label>
            <Input
              value={formData.quotationNo || ""}
              disabled
              className="bg-slate-50"
            />
          </div>

          {!isCancelled && (
            <>
              <div>
                <Label>Stage</Label>
                <Select
                  value={formData.stage || undefined} // Use undefined instead of empty string
                  onValueChange={(value) => handleInputChange("stage", value)}
                  disabled={!!selectedTicket?.legacyOrderRow}
                >
                  <SelectTrigger data-testid="select-stage">
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-gray-300 rounded-md shadow-lg">
                    <SelectItem value="Followup" className="hover:bg-blue-50 focus:bg-blue-50">
                      Followup
                    </SelectItem>
                    <SelectItem value="Order Received" className="hover:bg-blue-50 focus:bg-blue-50">
                      Order Received
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Conditional fields based on stage */}
              {renderConditionalFields()}

              <div className="md:col-span-2 flex space-x-4 pt-4">
                <Button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    isUploadingClientAttachment ||
                    isUploadingAdvancePayment ||
                    isUploadingSeniorApproval ||
                    (formData.stage === "Order Received" && !formData.holdOrder)
                  }
                  data-testid="button-submit-followup"
                  className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-70 disabled:transform-none"
                >
                  {isSubmitting && <Loader2Icon className="animate-spin" />}
                  Submit
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowFollowUpModal(false)}
                  data-testid="button-cancel-followup"
                >
                  Cancel
                </Button>
              </div>
            </>
          )}

          {isCancelled && (
            <>
              <div>
                <Label>Remarks</Label>
                <Textarea
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
                  className="bg-red-600 hover:bg-red-700 text-white px-8 py-3"
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
      </Modal>

      {/* History tab: Client Approval attachment edit modal (Task B) */}
      <Modal
        isOpen={!!editingHistoryRow}
        onClose={closeEditHistoryAttachmentModal}
        title="Edit Follow-Up"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <Label className="flex items-center gap-2">
              Client Approval
              {isUploadingEditAttachment && (
                <LoaderIcon className="animate-spin w-4 h-4 text-blue-600" />
              )}
            </Label>
            <Input
              type="file"
              disabled={isUploadingEditAttachment || isSavingEditAttachment}
              onChange={handleEditAttachmentFileChange}
              data-testid="edit-history-approval-attachment"
            />
            {isUploadingEditAttachment && (
              <p className="text-xs text-blue-600 mt-1">Uploading file, please wait...</p>
            )}
            {editAttachmentUrl && (
              <p className="mt-1 text-sm text-green-600">
                Currently uploaded:{" "}
                <a
                  href={editAttachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-green-800 font-medium"
                >
                  View File
                </a>
              </p>
            )}
          </div>

          {editingHistoryRow?.stage === "Order Received" && editingHistoryRow?.payment_mode && (
            <>
              <div>
                <Label>Acceptance Via</Label>
                <Select
                  value={editOrderFields.acceptanceVia || undefined}
                  onValueChange={(value) =>
                    setEditOrderFields((prev) => ({ ...prev, acceptanceVia: value }))
                  }
                >
                  <SelectTrigger data-testid="edit-select-acceptance-via">
                    <SelectValue placeholder="Acceptance Via" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-gray-300 rounded-md shadow-lg">
                    {(masterData["Acceptance Via"] || []).map((item) => (
                      <SelectItem key={item} value={item} className="hover:bg-blue-50 focus:bg-blue-50">
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {editingHistoryRow.payment_mode !== "FOC" &&
                [
                  ["advancePaymentAttachmentUrl", "Advance Payment Attachment"],
                  ["seniorApprovalUrl", "Senior Approval"],
                ].map(([field, label]) => (
                  <div key={field}>
                    <Label className="flex items-center gap-2">{label}</Label>
                    <Input
                      type="file"
                      disabled={isUploadingEditOrderFile || isSavingEditAttachment}
                      onChange={handleEditOrderFileChange(field)}
                    />
                    {editOrderFields[field] && (
                      <p className="mt-1 text-sm text-green-600">
                        Currently uploaded:{" "}
                        <a
                          href={editOrderFields[field]}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline hover:text-green-800 font-medium"
                        >
                          View File
                        </a>
                      </p>
                    )}
                  </div>
                ))}
              {isUploadingEditOrderFile && (
                <p className="text-xs text-blue-600">Uploading file, please wait...</p>
              )}
            </>
          )}

          <div className="flex space-x-4 pt-2">
            <Button
              type="button"
              onClick={handleSaveEditHistoryAttachment}
              disabled={isUploadingEditAttachment || isSavingEditAttachment || isUploadingEditOrderFile}
              data-testid="button-save-edit-history-attachment"
              className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-70"
            >
              {isSavingEditAttachment && <Loader2Icon className="animate-spin" />}
              Save
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={closeEditHistoryAttachmentModal}
              disabled={isSavingEditAttachment}
              data-testid="button-cancel-edit-history-attachment"
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
