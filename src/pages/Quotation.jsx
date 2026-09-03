import { useState, useEffect } from "react";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { Modal } from "../components/ui/modal";
import { useToast } from "../hooks/use-toast";
import { Loader2Icon, LoaderIcon } from "lucide-react";
import MakeQuotation from "./Quotation/MakeQuotation";
import { supabase } from "../lib/supabase/client";
import { fetchDropdownRows } from "../lib/supabase/dropdown";

export default function Quotation() {
  const [activeTab, setActiveTab] = useState("pending");
  const [showQuotationModal, setShowQuotationModal] = useState(false);
  const [masterData, setMasterData] = useState({});
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [formData, setFormData] = useState({});

  const [pendingData, setPendingData] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingQuotation, setIsUploadingQuotation] = useState(false);
  const [quotationPdfFile, setQuotationPdfFile] = useState(null);
  const [searchItem, setSearchItem] = useState("");
  const [filterTotalQuotation, setFilterTotalQuotation] = useState("all");
  const [isCancelled, setIsCancelled] = useState(false);
  const [showMakeQuotationModal, setShowMakeQuotationModal] = useState(false);
  const [showItemListModal, setShowItemListModal] = useState(false);
  const [selectedItemList, setSelectedItemList] = useState([]);
  // Quotations previously built (via "Make Quotation") for the ticket
  // currently open in the Create/Revise Quotation modal — powers the
  // Quotation No. dropdown and its Basic/Total/PDF autofill.
  const [generatedQuotations, setGeneratedQuotations] = useState([]);
  const { toast } = useToast();

  const fetchData = async () => {
    setFetchLoading(true);
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
        .select("ticket_id, regeneration_status, item_qty, created_at")
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
          otpVarificationStatus: latestVideoCall?.regeneration_status || "",
          itemQty: latestVideoCall?.item_qty ? JSON.stringify(latestVideoCall.item_qty) : "",
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
  }, []);

  // Get unique Basic Value (without tax) values for pending section only
  const uniquePendingTotalQuotations = [
    ...new Set(
      pendingData
        .map((item) => {
          const val = item.basicAmount;
          // Convert to string and trim to handle various formats
          if (val === null || val === undefined) return null;
          const strVal = String(val).trim();
          // Return the value even if it's empty or "0"
          return strVal !== "" ? strVal : "0";
        })
        .filter((val) => val !== null)
    ),
  ].sort((a, b) => {
    // Sort numerically if both are numbers, otherwise alphabetically
    const numA = parseFloat(a);
    const numB = parseFloat(b);
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB;
    }
    return a.localeCompare(b);
  });

  const filteredPendingDataa = pendingData
    .filter((item) => {
      const q = searchItem.toLowerCase();
      const matchesSearch =
        String(item.ticketId || "").toLowerCase().includes(q) ||
        String(item.clientName || "").toLowerCase().includes(q) ||
        String(item.companyName || "").toLowerCase().includes(q) ||
        String(item.phoneNumber || "").toLowerCase().includes(q) ||
        String(item.quotationNo || "").toLowerCase().includes(q);

      // Handle basicAmount comparison - convert to string and trim
      // Include items where basicAmount is 0, "0", empty string, or any other value
      let itemTotalQuotation =
        item.basicAmount !== null && item.basicAmount !== undefined
          ? String(item.basicAmount).trim()
          : "";

      // Convert empty string to "0" for comparison
      if (itemTotalQuotation === "") {
        itemTotalQuotation = "0";
      }

      const filterValue = String(filterTotalQuotation || "").trim();
      const matchesTotalQuotation =
        filterTotalQuotation === "all" || itemTotalQuotation === filterValue;

      return matchesSearch && matchesTotalQuotation;
    })
    .reverse();

  const filteredHistoryDataa = historyData
    .filter((item) => {
      const q = searchItem.toLowerCase();
      const matchesSearch =
        String(item.ticketId || "").toLowerCase().includes(q) ||
        String(item.clientName || "").toLowerCase().includes(q) ||
        String(item.companyName || "").toLowerCase().includes(q) ||
        String(item.phoneNumber || "").toLowerCase().includes(q) ||
        String(item.quotationNo || "").toLowerCase().includes(q);

      return matchesSearch;
    })
    .reverse();



  const openItemList = (rawJson) => {
    try {
      const parsed = rawJson ? JSON.parse(rawJson) : [];
      setSelectedItemList(Array.isArray(parsed) ? parsed : []);
    } catch {
      setSelectedItemList([]);
    }
    setShowItemListModal(true);
  };

  const handleQuotationClick = (ticket) => {
    setSelectedTicket(ticket);
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
  const handleQuotationNoChange = (value) => {
    handleInputChange("quotationNo", value);

    const matched = generatedQuotations.find((q) => q.quotation_no === value);
    if (matched) {
      if (matched.grand_total !== undefined && matched.grand_total !== null) {
        handleInputChange("totalAmountWithTax", String(matched.grand_total));
      }
      if (matched.pdf_url) {
        handleInputChange("quotationPdfLink", matched.pdf_url);
      }
    }

    if (value) {
      supabase
        .from("sss_quotation_items")
        .select("amount, is_freight")
        .eq("quotation_no", value)
        .then(({ data: items, error }) => {
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
      alert("Please Upload quotation PDF");
      return;
    }

    if (!formData.quotationShare) {
      alert("Please select quotation Share");
      return;
    }

    if (!formData.quotationShareBy) {
      alert("Please select quotation Shareby");
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
    if (isNaN(date.getTime())) return dateString;
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const userName = localStorage.getItem("currentUsername");

  const roleStorage = localStorage.getItem("o2d-auth-storage");
  const parsedData = JSON.parse(roleStorage);
  const role = parsedData.state.user.role;

  const filteredPendingData = role === "user" ? filteredPendingDataa.filter(
    (item) => item["CREName"] === userName
  ) : filteredPendingDataa;

  const filteredHistoryData = role === "user" ? filteredHistoryDataa.filter(
    (item) => item["CREName"] === userName
  ) : filteredHistoryDataa;

  // console.log("filteredPendingData", filteredPendingData);
  // console.log("filteredHistoryData", filteredHistoryData);

  return (
    <div className="space-y-2">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardHeader className="bg-gradient-to-r from-blue-50/50 to-indigo-50/50 rounded-t-lg border-b border-blue-100 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
            {/* Left Side: Tabs buttons and Make Quotation Button */}
            <div className="flex flex-wrap items-center gap-4">
              <TabsList className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200">
                <TabsTrigger
                  value="pending"
                  data-testid="tab-pending"
                  className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                >
                  Pending ({filteredPendingData?.length})
                </TabsTrigger>
                <TabsTrigger
                  value="history"
                  data-testid="tab-history"
                  className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                >
                  History ({filteredHistoryData?.length})
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Right Side: Search and Dropdown Filter */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 flex-1 md:justify-end w-full md:w-auto">
              <div className="relative flex-1 max-w-md w-full">
                <Input
                  id="searchFilter"
                  placeholder="Search by ticket ID, client, company or phone..."
                  className="pl-10 py-2 w-full rounded-md border-blue-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white"
                  data-testid="input-search-filter"
                  onChange={(e) => setSearchItem(e.target.value)}
                />
              </div>

              {activeTab === "pending" && (
                <div className="w-full sm:w-48">
                  <select
                    id="totalQuotationFilter"
                    value={filterTotalQuotation}
                    onChange={(e) => setFilterTotalQuotation(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-blue-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    data-testid="select-total-quotation-filter"
                  >
                    <option value="all">All Quotation Basic Value</option>
                    {uniquePendingTotalQuotations.map((quotation) => (
                      <option key={quotation} value={quotation}>
                        {quotation}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <Button
                size="sm"
                variant="outline"
                className="bg-gradient-to-br from-green-50 to-emerald-50 text-green-600 border-green-200 hover:from-green-100 hover:to-emerald-100 shadow-sm"
                onClick={() => {
                  setSelectedTicket(null);
                  setShowMakeQuotationModal(true);
                }}
              >
                <span className="font-medium">Make Quotation</span>
              </Button>
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
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          OTP Status
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Quotation No.
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Quotation Basic Value
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Quotation PDF
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Item List
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-blue-100">
                      {fetchLoading ? (
                        <tr>
                          <td
                            colSpan={20}
                            className="text-center py-8 bg-white"
                          >
                            <div className="flex justify-center items-center text-blue-700">
                              <LoaderIcon className="animate-spin w-8 h-8 mr-2" />
                            </div>
                          </td>
                        </tr>
                      ) : filteredPendingData.length === 0 ? (
                        <tr>
                          <td
                            colSpan={20}
                            className="text-center py-8 bg-white"
                            data-testid="text-no-pending"
                          >
                            <h1 className="text-blue-700">
                              No pending quotations found.
                            </h1>
                          </td>
                        </tr>
                      ) : (
                        filteredPendingData.map((ticket, ind) => (
                          <tr
                            key={ind}
                            className={
                              ind % 2 === 0 ? "bg-blue-50/50" : "bg-white"
                            }
                          >
                            <td className="px-4 py-3">
                              <Button
                                size="sm"
                                variant="outline"
                                className="bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-600 hover:from-blue-100 hover:to-indigo-100 hover:text-blue-700 transition-all duration-300 border border-blue-200 hover:border-blue-300 rounded-lg px-3 py-1.5 shadow-sm hover:shadow-md group"
                                onClick={() => handleQuotationClick(ticket)}
                                data-testid={`button-quotation-${ticket.id}`}
                              >
                                <span className="font-medium">Quotation</span>
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
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.otpVarificationStatus || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.quotationNo || "-"}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.basicAmount !== null &&
                              ticket.basicAmount !== undefined
                                ? String(ticket.basicAmount).trim() || "0"
                                : "N/A"}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.quotationPdfLink ? (
                                <a
                                  href={ticket.quotationPdfLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 hover:underline"
                                >
                                  View PDF
                                </a>
                              ) : (
                                ""
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <Button
                                size="sm"
                                variant="outline"
                                className="bg-gradient-to-br from-purple-50 to-violet-50 text-purple-600 hover:from-purple-100 hover:to-violet-100 hover:text-purple-700 transition-all duration-300 border border-purple-200 hover:border-purple-300 rounded-lg px-3 py-1.5 shadow-sm hover:shadow-md"
                                onClick={() => openItemList(ticket.itemQty)}
                              >
                                <span className="font-medium">Show Item List</span>
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>

                  {/* Mobile Card View */}
                  <div className="sm:hidden space-y-4">
                    {fetchLoading ? (
                      <div className="text-center py-8 bg-white">
                        <div className="flex justify-center items-center text-blue-700">
                          <LoaderIcon className="animate-spin w-8 h-8 mr-2" />
                        </div>
                      </div>
                    ) : filteredPendingData.length === 0 ? (
                      <div
                        className="text-center py-8 bg-white"
                        data-testid="text-no-pending"
                      >
                        <h1 className="text-blue-700">
                          No pending quotations found.
                        </h1>
                      </div>
                    ) : (
                      filteredPendingData.map((ticket, ind) => (
                        <Card
                          key={ind}
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
                                <p className="text-sm text-gray-600">
                                  {ticket.clientName}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                className="bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-600 hover:from-blue-100 hover:to-indigo-100 border border-blue-200"
                                onClick={() => handleQuotationClick(ticket)}
                              >
                                Quotation
                              </Button>
                            </div>

                            {/* Company & Contact Info */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Company
                                </p>
                                <p className="text-blue-900">
                                  {ticket.companyName}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Phone
                                </p>
                                <p className="text-blue-900">
                                  {ticket.phoneNumber}
                                </p>
                              </div>
                            </div>

                            {/* Enquiry Details */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Enquiry Receiver
                                </p>
                                <p className="text-blue-900">
                                  {ticket.enquiryReceiverName || "N/A"}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Warranty
                                </p>
                                <p className="text-blue-900">
                                  {ticket.warrantyCheck || "N/A"}
                                </p>
                              </div>
                            </div>

                            {/* Machine & Engineer */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Machine Name
                                </p>
                                <p className="text-blue-900">
                                  {ticket.machineName || "N/A"}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Engineer
                                </p>
                                <p className="text-blue-900">
                                  {ticket.engineerAssign || "N/A"}
                                </p>
                              </div>
                            </div>

                            {/* Enquiry Type & Site */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Enquiry Type
                                </p>
                                <p className="text-blue-900">
                                  {ticket.enquiryType || "N/A"}
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

                             {/* OTP Status & Quotation No. */}
                             <div className="grid grid-cols-2 gap-3 text-sm">
                               <div>
                                 <p className="text-gray-500 font-medium">
                                   OTP Status
                                 </p>
                                 <p className="text-blue-900">
                                   {ticket.otpVarificationStatus || "N/A"}
                                 </p>
                               </div>
                               <div>
                                 <p className="text-gray-500 font-medium">
                                   Quotation No.
                                 </p>
                                 <p className="text-blue-900">
                                   {ticket.quotationNo || "N/A"}
                                 </p>
                               </div>
                             </div>

                             {/* Quotation Basic Value */}
                             <div className="grid grid-cols-2 gap-3 text-sm">
                               <div>
                                 <p className="text-gray-500 font-medium">
                                   Quotation Basic Value
                                 </p>
                                 <p className="text-blue-900">
                                   {ticket.basicAmount !== null &&
                                     ticket.basicAmount !== undefined
                                     ? String(ticket.basicAmount).trim() || "0"
                                     : "N/A"}
                                 </p>
                               </div>
                             </div>

                            {/* Quotation PDF */}
                            <div className="text-sm">
                              <p className="text-gray-500 font-medium">
                                Quotation PDF
                              </p>
                              {ticket.quotationPdfLink ? (
                                <a
                                  href={ticket.quotationPdfLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 text-sm"
                                >
                                  View PDF
                                </a>
                              ) : (
                                <p className="text-blue-900">N/A</p>
                              )}
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
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Quotation No.
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Basic Amount
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Total Amount
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Share By
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Share Through
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Quotation PDF
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Remarks
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Item List
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-blue-100">
                      {fetchLoading ? (
                        <tr>
                          <td
                            colSpan={22}
                            className="text-center py-8 bg-white"
                          >
                            <div className="flex justify-center items-center text-blue-700">
                              <LoaderIcon className="animate-spin w-8 h-8 mr-2" />
                              <span>Loading quotation history...</span>
                            </div>
                          </td>
                        </tr>
                      ) : filteredHistoryData.length === 0 ? (
                        <tr>
                          <td
                            colSpan={22}
                            className="text-center py-8 bg-white"
                            data-testid="text-no-history"
                          >
                            <h1 className="text-blue-700">
                              No quotation history found.
                            </h1>
                          </td>
                        </tr>
                      ) : (
                        [...filteredHistoryData]
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
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.quotationNo || ""}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                ₹{ticket.basicAmount || "0"}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                ₹{ticket.totalQutation || "0"}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.quotationShareBy || ""}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.shareThrough || ""}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.quotationPdfLink ? (
                                  <a
                                    href={ticket.quotationPdfLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 hover:underline"
                                  >
                                    View PDF
                                  </a>
                                ) : (
                                  ""
                                )}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.remarks || ""}
                              </td>
                              <td className="px-4 py-3">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="bg-gradient-to-br from-purple-50 to-violet-50 text-purple-600 hover:from-purple-100 hover:to-violet-100 hover:text-purple-700 transition-all duration-300 border border-purple-200 hover:border-purple-300 rounded-lg px-3 py-1.5 shadow-sm hover:shadow-md"
                                  onClick={() => openItemList(ticket.itemQty)}
                                >
                                  <span className="font-medium">Show Item List</span>
                                </Button>
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>

                  {/* Mobile Card View */}
                  <div className="sm:hidden space-y-4">
                    {fetchLoading ? (
                      <div className="text-center py-8 bg-white">
                        <div className="flex justify-center items-center text-blue-700">
                          <LoaderIcon className="animate-spin w-8 h-8 mr-2" />
                          <span>Loading quotation history...</span>
                        </div>
                      </div>
                    ) : filteredHistoryData.length === 0 ? (
                      <div
                        className="text-center py-8 bg-white"
                        data-testid="text-no-history"
                      >
                        <h1 className="text-blue-700">
                          No quotation history found.
                        </h1>
                      </div>
                    ) : (
                      filteredHistoryData.map((ticket, ind) => (
                        <Card
                          key={ind}
                          className={`${ind % 2 === 0 ? "bg-blue-50/50" : "bg-white"
                            } border-l-4 border-l-blue-500`}
                        >
                          <CardContent className="p-4 space-y-3">
                            {/* Header */}
                            <div>
                              <h3 className="font-bold text-blue-800 text-lg">
                                {ticket.ticketId}
                              </h3>
                              <p className="text-sm text-gray-600">
                                {ticket.clientName}
                              </p>
                            </div>

                            {/* Company & Contact */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Company
                                </p>
                                <p className="text-blue-900">
                                  {ticket.companyName}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Phone
                                </p>
                                <p className="text-blue-900">
                                  {ticket.phoneNumber}
                                </p>
                              </div>
                            </div>

                            {/* Quotation Details */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Quotation No.
                                </p>
                                <p className="text-blue-900">
                                  {ticket.quotationNo}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Basic Amount
                                </p>
                                <p className="text-blue-900">
                                  ₹{ticket.basicAmount || "0"}
                                </p>
                              </div>
                            </div>

                            {/* Amount Details */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Total Amount
                                </p>
                                <p className="text-blue-900 font-semibold">
                                  ₹{ticket.totalQutation || "0"}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Share By
                                </p>
                                <p className="text-blue-900">
                                  {ticket.quotationShareBy || "N/A"}
                                </p>
                              </div>
                            </div>

                            {/* Share Details */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Share Through
                                </p>
                                <p className="text-blue-900">
                                  {ticket.shareThrough || "N/A"}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Quotation PDF
                                </p>
                                {ticket.quotationPdfLink ? (
                                  <a
                                    href={ticket.quotationPdfLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 text-sm"
                                  >
                                    View PDF
                                  </a>
                                ) : (
                                  <p className="text-blue-900">N/A</p>
                                )}
                              </div>
                            </div>

                            {/* Remarks */}
                            <div>
                              <p className="text-gray-500 font-medium text-sm">
                                Remarks
                              </p>
                              <p className="text-blue-900 line-clamp-2">
                                {ticket.remarks || "N/A"}
                              </p>
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
            <div className="flex items-center space-x-2 mb-10">
              <input
                type="checkbox"
                id="cancelTicket"
                checked={isCancelled}
                onChange={(e) => setIsCancelled(e.target.checked)}
                className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
              />
              <Label
                htmlFor="cancelTicket"
                className="text-red-600 font-medium"
              >
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

            {!isCancelled && (
              <>
                <div>
                  <Label>Site Address</Label>
                  <Input
                    value={formData.siteAddress || ""}
                    disabled
                    className="bg-slate-50"
                  />
                </div>

                <div>
                  <Label>Quotation No. *</Label>
                  <select
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
                  <Label>Basic Amount *</Label>
                  <Input
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
                  <Label>Total Amount with Tax *</Label>
                  <Input
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
                  <Label className="flex items-center gap-2">
                    Quotation PDF Link *
                    {isUploadingQuotation && (
                      <LoaderIcon className="animate-spin w-4 h-4 text-blue-600" />
                    )}
                  </Label>
                  {quotationPdfFile ? (
                    <div className="flex items-center justify-between border border-blue-200 rounded-md p-2 bg-blue-50 text-blue-800 text-sm">
                      <span className="truncate max-w-[250px]" title={quotationPdfFile.name}>
                        {quotationPdfFile.name}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={removeQuotationPdfFile}
                        className="text-red-500 hover:text-red-700 h-8 px-2 py-1 text-xs font-semibold hover:bg-red-50"
                      >
                        Remove
                      </Button>
                    </div>
                  ) : formData.quotationPdfLink ? (
                    <div className="flex items-center justify-between border border-emerald-200 rounded-md p-2 bg-emerald-50 text-emerald-800 text-sm">
                      <a href={formData.quotationPdfLink} target="_blank" rel="noopener noreferrer" className="font-semibold underline truncate max-w-[250px]">
                        View File
                      </a>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={removeQuotationPdfFile}
                        className="text-red-500 hover:text-red-700 h-8 px-2 py-1 text-xs font-semibold hover:bg-red-50"
                      >
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <Input
                      type="file"
                      onChange={handleQuotationChange}
                      data-testid="input-pdf-link"
                    />
                  )}
                  {isUploadingQuotation && (
                    <p className="text-xs text-blue-600 mt-1">Uploading file, please wait...</p>
                  )}
                </div>
                <div>
                  <Label>Quotation Share By *</Label>
                  <select
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
                  <Label>Quotation Share *</Label>
                  <select
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
                <div className="md:col-span-2 flex space-x-4 pt-4 sticky bottom-0 bg-white py-4">
                  <Button
                    type="submit"
                    disabled={isSubmitting || isUploadingQuotation}
                    data-testid="button-submit-quotation"
                    className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-70 disabled:transform-none"
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
      {showItemListModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowItemListModal(false)}
          />
          {/* Modal Card */}
          <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden border border-purple-100">
            {/* Header */}
            <div className="flex items-center px-6 py-4 bg-gradient-to-r from-purple-600 to-violet-600">
              <h2 className="text-lg font-semibold text-white tracking-wide">Item List</h2>
            </div>
            {/* Body */}
            <div className="px-6 py-5 max-h-[60vh] overflow-y-auto">
              {selectedItemList.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <p className="text-4xl mb-3">📦</p>
                  <p className="text-sm font-medium">No items found for this ticket.</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-purple-50 text-purple-700">
                      <th className="px-4 py-2 text-left rounded-tl-lg font-semibold w-10">#</th>
                      <th className="px-4 py-2 text-left font-semibold">Item Name</th>
                      <th className="px-4 py-2 text-center rounded-tr-lg font-semibold w-20">Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-50">
                    {selectedItemList.map((row, idx) => (
                      <tr
                        key={idx}
                        className={idx % 2 === 0 ? "bg-white" : "bg-purple-50/40"}
                      >
                        <td className="px-4 py-2.5 text-gray-500 font-medium">{idx + 1}</td>
                        <td className="px-4 py-2.5 text-gray-800">{row.item || "—"}</td>
                        <td className="px-4 py-2.5 text-center text-gray-800 font-semibold">{row.qty || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setShowItemListModal(false)}
                className="px-5 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-violet-600 text-white text-sm font-medium hover:from-purple-700 hover:to-violet-700 transition-all duration-200 shadow-md hover:shadow-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
