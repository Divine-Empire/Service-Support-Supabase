import { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { Modal } from "../components/ui/modal";
import { useToast } from "../hooks/use-toast";
import { LoaderIcon, Loader2Icon } from "lucide-react";
import { supabase } from "../lib/supabase/client";

export default function FollowUp() {
  const [activeTab, setActiveTab] = useState("pending");
  const [dateFilterTab, setDateFilterTab] = useState("");

  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [formData, setFormData] = useState({});
  const [followUpData, setFollowUpData] = useState([]);
  const [searchItem, setSearchItem] = useState("");
  const [clientAttachmentFilter, setClientAttachmentFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const { toast } = useToast();

<<<<<<< HEAD
=======
  const [masterData, setMasterData] = useState({});

>>>>>>> 2fb6fc02d3513c41c6187e88e88fa6fb9cdd9a7c
  // console.log("followUpData", followUpData);

  const [pendingData, setPendingData] = useState([]);
  const [historyData, setHistoryData] = useState([]);

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);
  const [isUploadingClientAttachment, setIsUploadingClientAttachment] = useState(false);

  const fetchData = async () => {
    setFetchLoading(true);
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

      // A ticket leaves pending once ANY row logs stage = 'Order Received' —
      // the deal's closed, regardless of how many 'Followup' logs preceded it.
      const orderReceivedTicketIds = new Set(
        (followUpRows || [])
          .filter((f) => f.stage === "Order Received")
          .map((f) => f.ticket_id)
      );

<<<<<<< HEAD
      // Latest follow_up log per ticket (rows are fetched created_at
      // ascending above, so the last one seen per ticket_id is the newest) —
      // powers Pending's "Last Call Date / Last Remarks / Next Call Date /
      // Next Action" columns. A ticket can already have prior 'Followup'
      // log rows while still pending (not yet 'Order Received').
      const latestFollowUpByTicket = new Map();
      (followUpRows || []).forEach((f) => {
        latestFollowUpByTicket.set(f.ticket_id, f);
      });

=======
>>>>>>> 2fb6fc02d3513c41c6187e88e88fa6fb9cdd9a7c
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

      (ticketsData || []).forEach((t) => {
        const q = quotationByTicket.get(t.ticket_id);
<<<<<<< HEAD
        const latestFollowUp = latestFollowUpByTicket.get(t.ticket_id);
=======
>>>>>>> 2fb6fc02d3513c41c6187e88e88fa6fb9cdd9a7c
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
<<<<<<< HEAD
          // Pending tab's "Last Call Date / Last Remarks / Next Call Date /
          // Next Action" — sourced from this ticket's own latest follow_up
          // log row (if any), not from the quotation.
          lastCallDate: latestFollowUp?.created_at || "",
          lastRemarks: latestFollowUp?.what_did_customer_say || "",
          nextCallDate: latestFollowUp?.next_date_of_call || "",
          nextAction: latestFollowUp?.next_action || "",
=======
>>>>>>> 2fb6fc02d3513c41c6187e88e88fa6fb9cdd9a7c
        };

        ticketsMapObj[t.ticket_id] = base;

        if (!orderReceivedTicketIds.has(t.ticket_id)) {
          pending.push(base);
        }
      });

      setTicketsMap(ticketsMapObj);
      setPendingData(pending);
      setFollowUpData(followUpRows || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error",
        description: "Failed to load data",
        variant: "destructive",
      });
    } finally {
      setFetchLoading(false);
    }
  };

<<<<<<< HEAD
  useEffect(() => {
=======
  // Only 'Engineer Assign Name' is seeded/used on this page. 'Stage' isn't a
  // dropdown at all — its two legal values ('Followup' / 'Order Received')
  // drive different form branches in code, so it's a hardcoded select
  // instead of an admin-editable dropdown category.
  const fetchMasterSheet = async () => {
    try {
      const { data, error } = await supabase
        .from("sss_dropdown")
        .select("value")
        .eq("category", "engineer_assign_name")
        .order("value", { ascending: true });

      if (error) throw error;

      setMasterData([{ "Engineer Assign Name": (data || []).map((d) => d.value) }]);
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
>>>>>>> 2fb6fc02d3513c41c6187e88e88fa6fb9cdd9a7c
    fetchData();
  }, []);



  const formatInputDate = (dateStr) => {
    if (!dateStr) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    const cleanStr = dateStr.split(" ")[0];
    const parts = cleanStr.split("/");
    if (parts.length === 3) {
      const day = parts[0].padStart(2, "0");
      const month = parts[1].padStart(2, "0");
      const year = parts[2];
      if (year.length === 4) {
        return `${year}-${month}-${day}`;
      }
    }
    try {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split("T")[0];
      }
    } catch (e) {}
    return "";
  };

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
      stage: "",
      whatDidCustomerSay: "",
      nextAction: "",
      nextDateOfCall: "",
      clientAttachmentUrl: "",
    });
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
<<<<<<< HEAD
          description: "Client Approval uploaded successfully",
=======
          description: "Client Attachment uploaded successfully",
>>>>>>> 2fb6fc02d3513c41c6187e88e88fa6fb9cdd9a7c
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
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from("sss_follow_up").insert({
        ticket_id: formData.ticketId,
        ticket_uuid: formData.ticketUuid,
        stage: formData.stage,
        engineer_assign: formData.engineerAssign || null,
        what_did_customer_say: formData.stage === "Followup" ? formData.whatDidCustomerSay || null : null,
        next_action: formData.stage === "Followup" ? formData.nextAction || null : null,
        next_date_of_call: formData.stage === "Followup" ? formData.nextDateOfCall || null : null,
        client_attachment_url: formData.stage === "Order Received" ? formData.clientAttachmentUrl || null : null,
        // Readiness stamp for the next stage (OrderReceived.jsx, not yet
        // migrated) — placeholder until a real calculation rule is given.
        order_received_planned: formData.stage === "Order Received" ? new Date().toISOString() : null,
        // Only gates SiteVisitPlan.jsx when the order is confirmed AND this
        // ticket's video call resulted in a "Site Visit" service type.
        site_visit_planned:
          formData.stage === "Order Received" && selectedTicket?.videoCallServiceType === "Site Visit"
            ? new Date().toISOString()
            : null,
      });

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

  const formatDateTime = (date) => {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const seconds = String(d.getSeconds()).padStart(2, "0");

    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";

    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are 0-indexed
    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
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
<<<<<<< HEAD
              Client Approval *
=======
              Client Attachments *
>>>>>>> 2fb6fc02d3513c41c6187e88e88fa6fb9cdd9a7c
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

  const filterByDateCategory = (data) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return data.filter((item) => {
      const nextDate = new Date(item.nextDateOfCall);
      nextDate.setHours(0, 0, 0, 0);

      if (dateFilterTab === "today") {
        return nextDate.getTime() === today.getTime();
      } else if (dateFilterTab === "upcoming") {
        return nextDate.getTime() > today.getTime();
      } else if (dateFilterTab === "overdue") {
        return nextDate.getTime() < today.getTime();
      }
      return true;
    });
  };

  const attachmentFilteredPendingData = filteredPendingData.filter((item) => {
    if (clientAttachmentFilter === "hasAttachment") {
      return item.clientAttachment && String(item.clientAttachment).trim() !== "";
    } else if (clientAttachmentFilter === "noAttachment") {
      return !item.clientAttachment || String(item.clientAttachment).trim() === "";
    }
    return true;
  });

  const finalFilteredPendingDataa = filterByDateCategory(attachmentFilteredPendingData);
  const finalFilteredHistoryDataa = filterByDateCategory(filteredHistoryData);



  const userName = localStorage.getItem("currentUsername");

  const roleStorage = localStorage.getItem("o2d-auth-storage");
  const parsedData = JSON.parse(roleStorage);
  const role = parsedData.state.user.role;

  const finalFilteredPendingData = role === "user" ? finalFilteredPendingDataa.filter(
    (item) => item["CREName"] === userName
  ) : role === "engineer" ? finalFilteredPendingDataa.filter(
    (item) => item["engineerAssign"] === userName
  ) : finalFilteredPendingDataa;

  const finalFilteredHistoryData = role === "user" ? finalFilteredHistoryDataa.filter(
    (item) => item["cre_name"] === userName
  ) : role === "engineer" ? finalFilteredHistoryDataa.filter(
    (item) => item["engineer_assign"] === userName
  ) : finalFilteredHistoryDataa;

  // console.log("finalFilteredPendingDataa", finalFilteredPendingDataa);
  // console.log("finalFilteredHistoryDataa", finalFilteredHistoryDataa);


  return (
    <div className="space-y-2">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardHeader className="bg-gradient-to-r from-blue-50/50 to-indigo-50/50 rounded-t-lg border-b border-blue-100 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
            
            {/* Left Side: Tabs buttons and Date Category Filters */}
            <div className="flex flex-wrap items-center gap-4">
              <TabsList className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200">
                <TabsTrigger
                  value="pending"
                  data-testid="tab-pending"
                  className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                >
                  Pending ({finalFilteredPendingData.length})
                </TabsTrigger>
                <TabsTrigger
                  value="history"
                  data-testid="tab-history"
                  className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                >
                  History ({finalFilteredHistoryData.length})
                </TabsTrigger>
              </TabsList>

              <div className="flex gap-2 bg-gradient-to-r from-green-50 to-teal-50 border border-green-200 p-1 rounded-lg w-fit">
                <button
                  type="button"
                  onClick={() => setDateFilterTab("")}
                  className="px-4 py-2 rounded-md text-sm transition-all bg-transparent text-gray-700 hover:bg-green-100 border border-red-500"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => setDateFilterTab("today")}
                  className={`px-4 py-2 rounded-md text-sm transition-all ${
                    dateFilterTab === "today"
                      ? "bg-green-600 text-white shadow-md"
                      : "bg-transparent text-gray-700 hover:bg-green-100"
                  }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setDateFilterTab("upcoming")}
                  className={`px-4 py-2 rounded-md text-sm transition-all ${
                    dateFilterTab === "upcoming"
                      ? "bg-green-600 text-white shadow-md"
                      : "bg-transparent text-gray-700 hover:bg-green-100"
                  }`}
                >
                  Upcoming
                </button>
                <button
                  type="button"
                  onClick={() => setDateFilterTab("overdue")}
                  className={`px-4 py-2 rounded-md text-sm transition-all ${
                    dateFilterTab === "overdue"
                      ? "bg-red-600 text-white shadow-md"
                      : "bg-transparent text-gray-700 hover:bg-red-100"
                  }`}
                >
                  Overdue
                </button>
              </div>
            </div>

            {/* Right Side: Search Input, Category Filter, and Client Attachment Filter */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 flex-1 md:justify-end w-full md:w-auto">
              <div className="relative flex-1 max-w-xs w-full">
                <Input
                  id="searchFilter"
                  placeholder="Search by ticket ID, client, company, phone or quotation no..."
                  className="pl-10 py-2 w-full rounded-md border-blue-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white"
                  data-testid="input-search-filter"
                  onChange={(e) => setSearchItem(e.target.value)}
                />
              </div>

              <div className="w-full sm:w-44">
                <select
                  id="categoryFilter"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-blue-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  data-testid="select-category-filter"
                >
                  <option value="all">All Categories</option>
                  {uniqueCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {activeTab === "pending" && (
                <div className="w-full sm:w-44">
                  <select
                    id="clientAttachmentFilter"
                    value={clientAttachmentFilter}
                    onChange={(e) => setClientAttachmentFilter(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-blue-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    data-testid="select-client-attachment-filter"
                  >
<<<<<<< HEAD
                    <option value="all">All Approvals</option>
                    <option value="hasAttachment">Client Approval Not Empty</option>
                    <option value="noAttachment">Client Approval Empty</option>
=======
                    <option value="all">All Attachments</option>
                    <option value="hasAttachment">Client Attachment Not Empty</option>
                    <option value="noAttachment">Client Attachment Empty</option>
>>>>>>> 2fb6fc02d3513c41c6187e88e88fa6fb9cdd9a7c
                  </select>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="mt-2">

              <TabsContent value="pending" className="mt-0">
              <div className="relative overflow-x-auto">
                <div className="max-h-[calc(103vh-200px)] overflow-y-auto">
                  <table className="hidden sm:block w-full">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-gradient-to-r from-blue-600 to-indigo-600">
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[120px] sticky top-0">
                          Action
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[120px] sticky top-0">
                          Date
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[120px] sticky top-0">
                          Ticket-ID
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Source of enquiry
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Call type
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[180px] sticky top-0">
                          Enquiry Receiver Name
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Client Type
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[200px] sticky top-0">
                          Company Name
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Client Name
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Phone Number
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[200px] sticky top-0">
                          Site Address
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          GST No.
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Machine Name
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Category
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[200px] sticky top-0">
                          Mention Issue
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Service Location
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[120px] sticky top-0">
                          Quotation No.
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Basic Amount
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Total Amount
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Quotation PDF
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
<<<<<<< HEAD
                          Client Approval
=======
                          Client Attachment
>>>>>>> 2fb6fc02d3513c41c6187e88e88fa6fb9cdd9a7c
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Shared By
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Share Through
                        </th>
<<<<<<< HEAD
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Last Call Date
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[200px] sticky top-0">
                          Last Remarks
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Next Call Date
=======
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[200px] sticky top-0">
                          Remarks
>>>>>>> 2fb6fc02d3513c41c6187e88e88fa6fb9cdd9a7c
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[200px] sticky top-0">
                          Next Action
                        </th>
<<<<<<< HEAD
=======
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[200px] sticky top-0">
                          Next Date Of Call
                        </th>
>>>>>>> 2fb6fc02d3513c41c6187e88e88fa6fb9cdd9a7c
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-blue-100">
                      {finalFilteredPendingData.length === 0 ? (
                        <tr>
                          <td
<<<<<<< HEAD
                            colSpan={27}
=======
                            colSpan={26}
>>>>>>> 2fb6fc02d3513c41c6187e88e88fa6fb9cdd9a7c
                            className="text-center py-8 bg-white"
                            data-testid="text-no-pending"
                          >
                            {fetchLoading ? (
                              <div className="flex justify-center items-center text-blue-700">
                                <LoaderIcon className="animate-spin w-8 h-8" />
                              </div>
                            ) : (
                              <h1 className="text-blue-700">
                                No pending follow-ups found.
                              </h1>
                            )}
                          </td>
                        </tr>
                      ) : (
                        finalFilteredPendingData.map((ticket, ind) => (
                          <tr
                            key={ticket.id}
                            className={
                              ind % 2 === 0 ? "bg-blue-50/50" : "bg-white"
                            }
                          >
                            <td className="px-4 py-3">
                              <Button
                                size="sm"
                                onClick={() => handleFollowUpClick(ticket)}
                                variant="outline"
                                className="bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-600 hover:from-blue-100 hover:to-indigo-100 hover:text-blue-700 transition-all duration-300 border border-blue-200 hover:border-blue-300 rounded-lg px-3 py-1.5 shadow-sm hover:shadow-md group"
                                data-testid={`button-followup-${ticket.id}`}
                              >
                                <span className="font-medium">Follow-Up</span>
                              </Button>
                            </td>
                            <td className="px-4 py-3 font-medium text-blue-800">
                              {formatDate(ticket.timeStemp)}
                            </td>
                            <td className="px-4 py-3 font-medium text-blue-800">
                              {ticket.ticketId}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.sourceOfEnquiry || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.callType || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.enquiryReceiverName || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.clientType || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.companyName || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.clientName || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.phoneNumber || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.siteAddress || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.gstNo || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.machineName || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.category || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.mentionIssue || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.serviceLocation || ""}
                            </td>
                            <td className="px-4 py-3 font-medium text-blue-800">
                              {ticket.quotationNo || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.basicAmount || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.totalAmoutWithTex || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.quotationPdfLink ? (
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    window.open(
                                      ticket.quotationPdfLink,
                                      "_blank"
                                    );
                                  }}
                                  className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer font-medium px-2 py-1 rounded transition-colors"
                                >
                                  Download
                                </button>
                              ) : (
                                <span className="text-gray-400">No file</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.clientAttachment ? (
                                <a
                                  href={ticket.clientAttachment}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                                >
                                  View
                                </a>
                              ) : (
                                <span className="text-gray-400">No file</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.quotationShareByPersonName || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.ShareThrough || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
<<<<<<< HEAD
                              {formatDate(ticket.lastCallDate) || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.lastRemarks || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {formatDate(ticket.nextCallDate) || ""}
=======
                              {ticket.quotationremarks || ""}
>>>>>>> 2fb6fc02d3513c41c6187e88e88fa6fb9cdd9a7c
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.nextAction || ""}
                            </td>
<<<<<<< HEAD
=======
                            <td className="px-4 py-3 text-blue-900">
                              {formatDate(ticket.nextDateOfCall) || ""}
                            </td>
>>>>>>> 2fb6fc02d3513c41c6187e88e88fa6fb9cdd9a7c
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>

                  {/* Mobile Card View */}
                  <div className="sm:hidden space-y-4">
                    {finalFilteredPendingData.length === 0 ? (
                      <div
                        className="text-center py-8 bg-white"
                        data-testid="text-no-pending"
                      >
                        {fetchLoading ? (
                          <div className="flex justify-center items-center text-blue-700">
                            <LoaderIcon className="animate-spin w-8 h-8" />
                          </div>
                        ) : (
                          <h1 className="text-blue-700">
                            No pending follow-ups found.
                          </h1>
                        )}
                      </div>
                    ) : (
                      finalFilteredPendingData.map((ticket, ind) => (
                        <Card
                          key={ticket.id}
                          className={`${ind % 2 === 0 ? "bg-blue-50/50" : "bg-white"
                            } border-l-4 border-l-blue-500`}
                        >
                          <CardContent className="p-4 space-y-3">
                            {/* Header with Ticket ID and Action */}
                            <div className="flex justify-between items-start">
                              <div>
                                <h3 className="font-bold text-blue-800 text-lg">
                                  {ticket.ticketId}
                                </h3>
                                {/* NEW: Quotation No in Mobile View */}
                                <p className="text-sm text-gray-700 font-medium">
                                  Quote: {ticket.quotationNo || "N/A"}
                                </p>
                                <p className="text-sm text-gray-600">
                                  {ticket.clientName}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                onClick={() => handleFollowUpClick(ticket)}
                                variant="outline"
                                className="bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-600 hover:from-blue-100 hover:to-indigo-100 border border-blue-200"
                              >
                                Follow-Up
                              </Button>
                            </div>

                            {/* Contact & Enquiry Info */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Phone
                                </p>
                                <p className="text-blue-900">
                                  {ticket.phoneNumber}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Enquiry Receiver
                                </p>
                                <p className="text-blue-900">
                                  {ticket.enquiryReceiverName || "N/A"}
                                </p>
                              </div>
                            </div>

                            {/* Technical Details */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Warranty
                                </p>
                                <p className="text-blue-900">
                                  {ticket.warrantyCheck || "N/A"}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Machine
                                </p>
                                <p className="text-blue-900">
                                  {ticket.machineName || "N/A"}
                                </p>
                              </div>
                            </div>

                            {/* Engineer & Site */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Engineer
                                </p>
                                <p className="text-blue-900">
                                  {ticket.engineerAssign || "N/A"}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Site Name
                                </p>
                                <p className="text-blue-900">
                                  {ticket.siteName || "N/A"}
                                </p>
                              </div>
                            </div>

                            {/* Financial Details */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Basic Amount
                                </p>
                                <p className="text-blue-900">
                                  {ticket.basicAmount || "N/A"}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Total Amount
                                </p>
                                <p className="text-blue-900">
                                  {ticket.totalAmoutWithTex || "N/A"}
                                </p>
                              </div>
                            </div>

                            {/* Quotation Details */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Shared By
                                </p>
                                <p className="text-blue-900">
                                  {ticket.quotationShareByPersonName || "N/A"}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Share Through
                                </p>
                                <p className="text-blue-900">
                                  {ticket.ShareThrough || "N/A"}
                                </p>
                              </div>
                            </div>

                            {/* Quotation PDF */}
                            <div>
                              <p className="text-gray-500 font-medium text-sm">
                                Quotation PDF
                              </p>
                              {ticket.quotationPdfLink ? (
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    window.open(
                                      ticket.quotationPdfLink,
                                      "_blank"
                                    );
                                  }}
                                  className="text-blue-600 hover:text-blue-800 text-sm"
                                >
                                  Download PDF
                                </button>
                              ) : (
                                <p className="text-blue-900">No file</p>
                              )}
                            </div>

                            {/* Follow-up Details */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500 font-medium">
<<<<<<< HEAD
                                  Last Call Date
                                </p>
                                <p className="text-blue-900">
                                  {formatDate(ticket.lastCallDate) || "N/A"}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Last Remarks
                                </p>
                                <p className="text-blue-900 line-clamp-2">
                                  {ticket.lastRemarks || "N/A"}
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Next Call Date
                                </p>
                                <p className="text-blue-900">
                                  {formatDate(ticket.nextCallDate) || "N/A"}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">
=======
>>>>>>> 2fb6fc02d3513c41c6187e88e88fa6fb9cdd9a7c
                                  Next Action
                                </p>
                                <p className="text-blue-900">
                                  {ticket.nextAction || "N/A"}
                                </p>
                              </div>
<<<<<<< HEAD
=======
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Next Call Date
                                </p>
                                <p className="text-blue-900">
                                  {formatDate(ticket.nextDateOfCall) || "N/A"}
                                </p>
                              </div>
                            </div>

                            {/* Remarks */}
                            <div>
                              <p className="text-gray-500 font-medium text-sm">
                                Remarks
                              </p>
                              <p className="text-blue-900 line-clamp-2">
                                {ticket.quotationremarks || "N/A"}
                              </p>
>>>>>>> 2fb6fc02d3513c41c6187e88e88fa6fb9cdd9a7c
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </div>
              </div>
        </TabsContent>

              <TabsContent value="history" className="mt-0">
              <div className="relative overflow-x-auto">
                <div className="max-h-[calc(103vh-200px)] overflow-y-auto">
                  <table className="hidden sm:block w-full">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-gradient-to-r from-blue-600 to-indigo-600">
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Date
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Ticket-ID
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Source of enquiry
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Call type
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[180px] sticky top-0">
                          Enquiry Receiver Name
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Client Type
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[200px] sticky top-0">
                          Company Name
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Client Name
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Phone Number
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[200px] sticky top-0">
                          Site Address
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          GST No.
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Machine Name
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Category
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[200px] sticky top-0">
                          Mention Issue
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Service Location
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Quotation No.
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Stage
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Engineer Assign
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
<<<<<<< HEAD
                          Client Approval
=======
                          Client Attachment
>>>>>>> 2fb6fc02d3513c41c6187e88e88fa6fb9cdd9a7c
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          What Did The Customer Say
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Next Action
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Next Date Of Call
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-blue-100">
                      {finalFilteredHistoryData.length === 0 ? (
                        <tr>
                          <td
                            colSpan={22}
                            className="text-center py-8 bg-white"
                            data-testid="text-no-history"
                          >
                            {fetchLoading ? (
                              <div className="flex justify-center items-center text-blue-700">
                                <LoaderIcon className="animate-spin w-8 h-8" />
                              </div>
                            ) : (
                              <h1 className="text-blue-700">
                                No follow-up history found.
                              </h1>
                            )}
                          </td>
                        </tr>
                      ) : (
                        [...finalFilteredHistoryData]
                          .map((ticket, ind) => (
                            <tr
                              key={ind}
                              className={
                                ind % 2 === 0 ? "bg-blue-50/50" : "bg-white"
                              }
                            >
                              <td className="px-4 py-3 font-medium text-blue-800">
                                {formatDate(ticket.timeStemp)}
                              </td>
                              <td className="px-4 py-3 font-medium text-blue-800">
                                {ticket.ticketId}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.sourceOfEnquiry || ""}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.callType || ""}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.enquiryReceiverName || ""}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.clientType || ""}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.companyName || ""}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.clientName || ""}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.phoneNumber || ""}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.siteAddress || ""}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.gstNo || ""}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.machineName || ""}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.category || ""}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.mentionIssue || ""}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.serviceLocation || ""}
                              </td>
                              <td className="px-4 py-3 font-medium text-blue-800">
                                {ticket.quotationNo || ""}
                              </td>
                              <td className="px-4 py-3 font-medium text-blue-800">
                                {ticket.stage || ""}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.engineer_assign || ""}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket["client-attachment"] ? (
                                  <a
                                    href={ticket["client-attachment"]}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 hover:underline"
                                  >
                                    View
                                  </a>
                                ) : (
                                  ""
                                )}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.what_did_the_customer_say || ""}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.next_action || ""}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {formatDate(ticket.next_date_of_call) || ""}
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>

                  {/* Mobile Card View */}
                  <div className="md:hidden space-y-4">
                    {finalFilteredHistoryData.length === 0 ? (
                      <div
                        className="text-center py-8 bg-white"
                        data-testid="text-no-history"
                      >
                        {fetchLoading ? (
                          <div className="flex justify-center items-center text-blue-700">
                            <LoaderIcon className="animate-spin w-8 h-8" />
                          </div>
                        ) : (
                          <h1 className="text-blue-700">
                            No follow-up history found.
                          </h1>
                        )}
                      </div>
                    ) : (
                      [...finalFilteredHistoryData].map((ticket, ind) => (
                        <Card
                          key={ind}
                          className={`${ind % 2 === 0 ? "bg-blue-50/50" : "bg-white"
                            } border-l-4 border-l-blue-500`}
                        >
                          <CardContent className="p-4 space-y-3">
                            {/* Header */}
                            <div>
                              <h3 className="font-bold text-blue-800 text-lg">
                                {ticket.ticket_id}
                              </h3>
                              <p className="text-sm text-gray-700 font-medium">
                                Quote: {ticket.quotationNo || "N/A"}
                              </p>
                              <p className="text-sm text-gray-500">
                                {formatDate(ticket.timestamp)}
                              </p>
                            </div>

                            {/* Stage & Engineer */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Stage
                                </p>
                                <p className="text-blue-900">
                                  {ticket.stage || "N/A"}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Engineer Assign
                                </p>
                                <p className="text-blue-900">
                                  {ticket.engineer_assign || "N/A"}
                                </p>
                              </div>
                            </div>

<<<<<<< HEAD
                            {/* Client Approval */}
                            <div>
                              <p className="text-gray-500 font-medium text-sm">
                                Client Approval
=======
                            {/* Client Attachment */}
                            <div>
                              <p className="text-gray-500 font-medium text-sm">
                                Client Attachment
>>>>>>> 2fb6fc02d3513c41c6187e88e88fa6fb9cdd9a7c
                              </p>
                              {ticket["client-attachment"] ? (
                                <a
                                  href={ticket["client-attachment"]}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 text-sm"
                                >
                                  View
                                </a>
                              ) : (
                                <p className="text-blue-900">N/A</p>
                              )}
                            </div>

                            {/* Customer Feedback */}
                            <div>
                              <p className="text-gray-500 font-medium text-sm">
                                Customer Feedback
                              </p>
                              <p className="text-blue-900 line-clamp-2">
                                {ticket.what_did_the_customer_say || "N/A"}
                              </p>
                            </div>

                            {/* Next Steps */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Next Action
                                </p>
                                <p className="text-blue-900">
                                  {ticket.next_action || "N/A"}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Next Call Date
                                </p>
                                <p className="text-blue-900">
                                  {formatDate(ticket.next_date_of_call) ||
                                    "N/A"}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </div>
              </div>
        </TabsContent>
            </div>
          </CardContent>
        </Card>
      </Tabs>

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
<<<<<<< HEAD
=======
          <div>
            <Label>Engineer Assign</Label>
            <Select
              value={formData.engineerAssign || undefined}
              onValueChange={(value) =>
                handleInputChange("engineerAssign", value)
              }
            >
              <SelectTrigger
                className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                data-testid="select-engineer-assign"
              >
                <SelectValue placeholder={formData.engineerAssign || "Select Engineer"} />
              </SelectTrigger>
              <SelectContent className="bg-white border border-gray-300 rounded-md shadow-lg">
                {masterData.length > 0 &&
                  masterData[0]["Engineer Assign Name"] ? (
                  masterData[0]["Engineer Assign Name"].map((item, ind) => (
                    <SelectItem
                      key={ind}
                      value={item}
                      className="hover:bg-blue-50 focus:bg-blue-50"
                    >
                      {item}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="Loading" disabled>
                    Loading options...
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
>>>>>>> 2fb6fc02d3513c41c6187e88e88fa6fb9cdd9a7c

          {!isCancelled && (
            <>
              <div>
                <Label>Stage</Label>
                <Select
                  value={formData.stage || undefined} // Use undefined instead of empty string
                  onValueChange={(value) => handleInputChange("stage", value)}
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
                  disabled={isSubmitting || isUploadingClientAttachment}
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
    </div>
  );
}
