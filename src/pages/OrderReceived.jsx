import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
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
import { Loader2Icon, LoaderIcon } from "lucide-react";
import { supabase } from "../lib/supabase/client";
import { fetchDropdownRows } from "../lib/supabase/dropdown";
import { computeStagePlanned } from "../lib/supabase/stagePlanning";

export default function OrderReceived() {
  const [activeTab, setActiveTab] = useState("pending");
  const [showOrderReceivedModal, setShowOrderReceivedModal] = useState(false);
  const [masterData, setMasterData] = useState({});
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [formData, setFormData] = useState({});

  const [pendingData, setPendingData] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingSeniorApproval, setIsUploadingSeniorApproval] = useState(false);
  const [isUploadingAdvancePaymentAttachment, setIsUploadingAdvancePaymentAttachment] = useState(false);
  const [searchItem, setSearchItem] = useState("");
  const [enquiryTypeFilter, setEnquiryTypeFilter] = useState("all");
  const { toast } = useToast();

  const fetchData = async () => {
    setFetchLoading(true);
    try {
      // Tickets ready for Order Received (follow_up.order_received_planned
      // set) — this is the ONLY gate. Warehouse tickets (both the direct
      // Warranty-Check path and the video_call service_type='Warehouse'
      // path) also flow through Quotation -> Follow-Up like every other
      // ticket, so they reach here the same way once their Follow-Up log
      // records stage='Order Received' — no separate warehouse-side gate.
      const { data: followUpRows, error: followUpError } = await supabase
        .from("sss_follow_up")
        .select("ticket_id, order_received_planned")
        .not("order_received_planned", "is", null);

      if (followUpError) throw followUpError;

      const ticketIds = [...new Set((followUpRows || []).map((f) => f.ticket_id))];

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

      // Quotation No./PDF are display-only here — joined from their owning stage.
      const { data: quotationRows, error: quotationError } = await supabase
        .from("sss_quotation")
        .select("ticket_id, quotation_no, quotation_pdf_link")
        .in("ticket_id", ticketIds);

      if (quotationError) throw quotationError;

      const quotationByTicket = new Map((quotationRows || []).map((q) => [q.ticket_id, q]));

      // "Client Approval" — the attachment FollowUp.jsx collects when it logs
      // stage='Order Received' (the proof the client actually confirmed the
      // order). Take the latest such row per ticket.
      const { data: orderReceivedFollowUpRows, error: orderReceivedFollowUpError } = await supabase
        .from("sss_follow_up")
        .select("ticket_id, stage, client_attachment_url, created_at")
        .in("ticket_id", ticketIds)
        .eq("stage", "Order Received")
        .order("created_at", { ascending: false });

      if (orderReceivedFollowUpError) throw orderReceivedFollowUpError;

      const clientApprovalByTicket = new Map();
      (orderReceivedFollowUpRows || []).forEach((f) => {
        if (!clientApprovalByTicket.has(f.ticket_id)) {
          clientApprovalByTicket.set(f.ticket_id, f.client_attachment_url || "");
        }
      });

      const { data: orderReceivedRows, error: orderReceivedError } = await supabase
        .from("sss_order_received")
        .select("*")
        .in("ticket_id", ticketIds);

      if (orderReceivedError) throw orderReceivedError;

      const orderReceivedByTicket = new Map((orderReceivedRows || []).map((o) => [o.ticket_id, o]));

      const pending = [];
      const history = [];

      (ticketsData || []).forEach((t) => {
        const q = quotationByTicket.get(t.ticket_id);
        const base = {
          ticketId: t.ticket_id,
          ticketUuid: t.uuid,
          timeStemp: t.created_at || "",
          clientName: t.client_name || "",
          companyName: t.company_name || "",
          phoneNumber: t.phone_number || "",
          machineName: t.machine_name || "",
          CREName: t.cre_name || "",
          engineerAssign: t.engineer_assign || "",
          quotationNo: q?.quotation_no || "",
          issue: t.mention_issue || "",
          quotationCopy: q?.quotation_pdf_link || "",
          clientApproval: clientApprovalByTicket.get(t.ticket_id) || "",
          // Drives the "Enquiry Type" filter below (All/NABL/NON-NABL/SERVICE/SPARE).
          enquiryType: t.enquiry_type || "",
        };

        const orderReceived = orderReceivedByTicket.get(t.ticket_id);
        if (orderReceived) {
          history.push({
            ...base,
            paymentTerm: orderReceived.payment_term || "",
            acceptanceVia: orderReceived.acceptance_via || "",
            seniorApproval: orderReceived.senior_approval || "",
            seniorApprovedBy: orderReceived.senior_approved_by || "",
            advancePaymentAttachment: orderReceived.advance_payment_attachment || "",
            paymentMode: orderReceived.payment_mode || "",
            delayMinutes: orderReceived.delay_minutes,
          });
        } else {
          pending.push(base);
        }
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
    payment_term: "Payment Terms",
    payment_mode: "Payment Mode",
    acceptance_via: "Acceptance Via",
    senior_approved_by: "Senior Approved By",
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

  const filteredPendingDataa = pendingData
    .filter((item) => {
      const q = searchItem.toLowerCase();
      const matchesSearch =
        String(item.ticketId || "").toLowerCase().includes(q) ||
        String(item.clientName || "").toLowerCase().includes(q) ||
        String(item.companyName || "").toLowerCase().includes(q) ||
        String(item.phoneNumber || "").toLowerCase().includes(q) ||
        String(item.quotationNo || "").toLowerCase().includes(q);

      const matchesEnquiryType =
        enquiryTypeFilter === "all" || item.enquiryType === enquiryTypeFilter;

      return matchesSearch && matchesEnquiryType;
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

      const matchesEnquiryType =
        enquiryTypeFilter === "all" || item.enquiryType === enquiryTypeFilter;

      return matchesSearch && matchesEnquiryType;
    })
    .reverse();

  const userName = localStorage.getItem("currentUsername");

  const roleStorage = localStorage.getItem("o2d-auth-storage");
  const parsedData = JSON.parse(roleStorage);
  const role = parsedData.state.user.role;

  const filteredPendingData = role === "user" ? filteredPendingDataa.filter(
    (item) => item["CREName"] === userName
  ) : role === "engineer" ? filteredPendingDataa.filter(
    (item) => item["engineerAssign"] === userName
  ) : filteredPendingDataa;

  const filteredHistoryData = role === "user" ? filteredHistoryDataa.filter(
    (item) => item["CREName"] === userName
  ) : role === "engineer" ? filteredHistoryDataa.filter(
    (item) => item["engineerAssign"] === userName
  ) : filteredHistoryDataa;

  const handleOrderReceivedClick = (ticket) => {
    setSelectedTicket(ticket);
    setFormData({
      ticketId: ticket.ticketId,
      clientName: ticket.clientName,
      phoneNumber: ticket.phoneNumber,
      quotationNo: ticket.quotationNo || "",
      paymentTerm: "",
      acceptanceVia: "",
      seniorApprovalUrl: "",
      advancePaymentAttachmentUrl: "",
      paymentMode: "",
      seniorApprovedBy: "",
    });
    setShowOrderReceivedModal(true);
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const uploadToStorage = async (file) => {
    const path = `order_received/${selectedTicket?.ticketId}_${Date.now()}_${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("ticket_enquiry")
      .upload(path, file, { contentType: file.type });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from("ticket_enquiry").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSeniorApprovalChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploadingSeniorApproval(true);
    try {
      const url = await uploadToStorage(file);
      handleInputChange("seniorApprovalUrl", url);
      toast({
        title: "Success",
        description: "Senior Approval uploaded successfully",
      });
    } catch (error) {
      console.error(error);
      e.target.value = null;
      handleInputChange("seniorApprovalUrl", "");
      toast({
        title: "Error",
        description: "Failed to upload Senior Approval",
        variant: "destructive",
      });
    } finally {
      setIsUploadingSeniorApproval(false);
    }
  };

  const handleAdvancePaymentAttachmentChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploadingAdvancePaymentAttachment(true);
    try {
      const url = await uploadToStorage(file);
      handleInputChange("advancePaymentAttachmentUrl", url);
      toast({
        title: "Success",
        description: "Advance Payment Attachment uploaded successfully",
      });
    } catch (error) {
      console.error(error);
      e.target.value = null;
      handleInputChange("advancePaymentAttachmentUrl", "");
      toast({
        title: "Error",
        description: "Failed to upload Advance Payment Attachment",
        variant: "destructive",
      });
    } finally {
      setIsUploadingAdvancePaymentAttachment(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

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

    // Advance Payment Attachment / Senior Approval only apply once a Payment
    // Mode is chosen, and are skipped entirely for FOC (no payment is
    // actually happening, so there's nothing to attach/approve).
    const isFOC = formData.paymentMode === "FOC";
    if (!isFOC) {
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

    setIsSubmitting(true);

    try {
      const submittedAt = new Date();
      // FOC closes the ticket right here — invoice_planned is left null so
      // it never reaches Invoice.jsx's pending list.
      const invoicePlanned = isFOC
        ? null
        : await computeStagePlanned("invoice", {
            orderReceivedSubmittedAt: submittedAt,
          });

      const { error } = await supabase.from("sss_order_received").insert({
        ticket_id: selectedTicket.ticketId,
        ticket_uuid: selectedTicket.ticketUuid,
        payment_term: formData.paymentTerm || null,
        acceptance_via: formData.acceptanceVia || null,
        senior_approval: isFOC ? null : formData.seniorApprovalUrl || null,
        senior_approved_by: isFOC ? null : formData.seniorApprovedBy || null,
        advance_payment_attachment: isFOC ? null : formData.advancePaymentAttachmentUrl || null,
        payment_mode: formData.paymentMode || null,
        // Readiness stamp for the next stage (Invoice, not yet migrated) —
        // null for Payment Mode = FOC, which closes the ticket at this stage
        // instead. See stagePlanning.js.
        invoice_planned: invoicePlanned,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Order Received details saved successfully",
      });
      setShowOrderReceivedModal(false);
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
    }
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

  // Minutes late (negative) or early (positive) — the ORIGINAL delay
  // convention, matching Quotation/FollowUp. See
  // order_received.delay_minutes / migration 0033.
  const formatDelay = (minutes) => {
    if (minutes === null || minutes === undefined) return "-";
    if (minutes < 0) return `${Math.abs(minutes)} min late`;
    return `${minutes} min early`;
  };

  return (
    <div className="space-y-2">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardHeader className="bg-gradient-to-r from-blue-50/50 to-indigo-50/50 rounded-t-lg border-b border-blue-100 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
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

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 flex-1 md:justify-end w-full md:w-auto">
              <div className="relative flex-1 max-w-md w-full">
                <Input
                  id="searchFilter"
                  placeholder="Search by ticket ID, client, company, phone or quotation no..."
                  className="pl-10 py-2 w-full rounded-md border-blue-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white"
                  data-testid="input-search-filter"
                  onChange={(e) => setSearchItem(e.target.value)}
                />
              </div>

              <Select value={enquiryTypeFilter} onValueChange={setEnquiryTypeFilter}>
                <SelectTrigger
                  className="bg-white border-blue-200 shadow-sm w-full sm:w-[160px] h-9 text-sm text-blue-800"
                  data-testid="select-enquiry-type-filter"
                >
                  <SelectValue placeholder="Enquiry Type" />
                </SelectTrigger>
                <SelectContent className="bg-white border border-gray-300 rounded-md shadow-lg">
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="NABL">NABL</SelectItem>
                  <SelectItem value="NON-NABL">NON-NABL</SelectItem>
                  <SelectItem value="SERVICE">SERVICE</SelectItem>
                  <SelectItem value="SPARE">SPARE</SelectItem>
                </SelectContent>
              </Select>
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
                            Client Name
                          </th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[200px] sticky top-0">
                            Company Name
                          </th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                            Phone Number
                          </th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                            Machine Name
                          </th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                            Quotation No.
                          </th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[200px] sticky top-0">
                            Issue
                          </th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[130px] sticky top-0">
                            Quotation Copy
                          </th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[130px] sticky top-0">
                            Client Approval
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-blue-100">
                        {fetchLoading ? (
                          <tr>
                            <td colSpan={11} className="text-center py-8 bg-white">
                              <div className="flex justify-center items-center text-blue-700">
                                <LoaderIcon className="animate-spin w-8 h-8 mr-2" />
                              </div>
                            </td>
                          </tr>
                        ) : filteredPendingData.length === 0 ? (
                          <tr>
                            <td
                              colSpan={11}
                              className="text-center py-8 bg-white"
                              data-testid="text-no-pending"
                            >
                              <h1 className="text-blue-700">
                                No pending orders found.
                              </h1>
                            </td>
                          </tr>
                        ) : (
                          filteredPendingData.map((ticket, ind) => (
                            <tr
                              key={ticket.ticketId}
                              className={
                                ind % 2 === 0 ? "bg-blue-50/50" : "bg-white"
                              }
                            >
                              <td className="px-4 py-3">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-600 hover:from-blue-100 hover:to-indigo-100 hover:text-blue-700 transition-all duration-300 border border-blue-200 hover:border-blue-300 rounded-lg px-3 py-1.5 shadow-sm hover:shadow-md group"
                                  onClick={() => handleOrderReceivedClick(ticket)}
                                  data-testid={`button-order-received-${ticket.ticketId}`}
                                >
                                  <span className="font-medium">Order Received</span>
                                </Button>
                              </td>
                              <td className="px-4 py-3 font-medium text-blue-800">
                                {formatDate(ticket.timeStemp)}
                              </td>
                              <td className="px-4 py-3 font-medium text-blue-800">
                                {ticket.ticketId}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.clientName || ""}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.companyName || ""}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.phoneNumber || ""}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.machineName || ""}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.quotationNo || ""}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.issue || ""}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.quotationCopy ? (
                                  <a
                                    href={ticket.quotationCopy}
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
                                {ticket.clientApproval ? (
                                  <a
                                    href={ticket.clientApproval}
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
                            No pending orders found.
                          </h1>
                        </div>
                      ) : (
                        filteredPendingData.map((ticket, ind) => (
                          <Card
                            key={ticket.ticketId}
                            className={`${ind % 2 === 0 ? "bg-blue-50/50" : "bg-white"
                              } border-l-4 border-l-blue-500`}
                          >
                            <CardContent className="p-4 space-y-3">
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
                                  onClick={() => handleOrderReceivedClick(ticket)}
                                >
                                  Order Received
                                </Button>
                              </div>

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
                                    Quotation No.
                                  </p>
                                  <p className="text-blue-900">
                                    {ticket.quotationNo || "N/A"}
                                  </p>
                                </div>
                              </div>

                              <div>
                                <p className="text-gray-500 font-medium text-sm">
                                  Issue
                                </p>
                                <p className="text-blue-900 line-clamp-2">
                                  {ticket.issue || "N/A"}
                                </p>
                              </div>

                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <p className="text-gray-500 font-medium">
                                    Quotation Copy
                                  </p>
                                  {ticket.quotationCopy ? (
                                    <a
                                      href={ticket.quotationCopy}
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
                                <div>
                                  <p className="text-gray-500 font-medium">
                                    Client Approval
                                  </p>
                                  {ticket.clientApproval ? (
                                    <a
                                      href={ticket.clientApproval}
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
                            Client Name
                          </th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[200px] sticky top-0">
                            Company Name
                          </th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                            Phone Number
                          </th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                            Quotation No.
                          </th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                            Payment Term
                          </th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                            Acceptance Via
                          </th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                            Advance Payment Attachment
                          </th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                            Senior Approval
                          </th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                            Senior Approved By
                          </th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                            Payment Mode
                          </th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[130px] sticky top-0">
                            Delay
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-blue-100">
                        {fetchLoading ? (
                          <tr>
                            <td colSpan={13} className="text-center py-8 bg-white">
                              <div className="flex justify-center items-center text-blue-700">
                                <LoaderIcon className="animate-spin w-8 h-8 mr-2" />
                              </div>
                            </td>
                          </tr>
                        ) : filteredHistoryData.length === 0 ? (
                          <tr>
                            <td
                              colSpan={13}
                              className="text-center py-8 bg-white"
                              data-testid="text-no-history"
                            >
                              <h1 className="text-blue-700">
                                No order received history found.
                              </h1>
                            </td>
                          </tr>
                        ) : (
                          filteredHistoryData.map((ticket, ind) => (
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
                                {ticket.clientName || ""}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.companyName || ""}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.phoneNumber || ""}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.quotationNo || ""}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.paymentTerm || ""}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.acceptanceVia || ""}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.advancePaymentAttachment ? (
                                  <a
                                    href={ticket.advancePaymentAttachment}
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
                                {ticket.seniorApproval ? (
                                  <a
                                    href={ticket.seniorApproval}
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
                                {ticket.seniorApprovedBy || ""}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.paymentMode || ""}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                    ticket.delayMinutes < 0
                                      ? "bg-red-100 text-red-800"
                                      : "bg-emerald-100 text-emerald-800"
                                  }`}
                                >
                                  {formatDelay(ticket.delayMinutes)}
                                </span>
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
                      ) : filteredHistoryData.length === 0 ? (
                        <div
                          className="text-center py-8 bg-white"
                          data-testid="text-no-history"
                        >
                          <h1 className="text-blue-700">
                            No order received history found.
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
                              <div>
                                <h3 className="font-bold text-blue-800 text-lg">
                                  {ticket.ticketId}
                                </h3>
                                <p className="text-sm text-gray-600">
                                  {ticket.clientName}
                                </p>
                              </div>

                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <p className="text-gray-500 font-medium">
                                    Payment Term
                                  </p>
                                  <p className="text-blue-900">
                                    {ticket.paymentTerm || "N/A"}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-gray-500 font-medium">
                                    Payment Mode
                                  </p>
                                  <p className="text-blue-900">
                                    {ticket.paymentMode || "N/A"}
                                  </p>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <p className="text-gray-500 font-medium">
                                    Acceptance Via
                                  </p>
                                  <p className="text-blue-900">
                                    {ticket.acceptanceVia || "N/A"}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-gray-500 font-medium">
                                    Senior Approval
                                  </p>
                                  {ticket.seniorApproval ? (
                                    <a
                                      href={ticket.seniorApproval}
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
                              </div>

                              <div>
                                <p className="text-gray-500 font-medium">
                                  Senior Approved By
                                </p>
                                <p className="text-blue-900">
                                  {ticket.seniorApprovedBy || "N/A"}
                                </p>
                              </div>

                              <div>
                                <p className="text-gray-500 font-medium">
                                  Advance Payment Attachment
                                </p>
                                {ticket.advancePaymentAttachment ? (
                                  <a
                                    href={ticket.advancePaymentAttachment}
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

                              <div>
                                <p className="text-gray-500 font-medium text-sm">
                                  Delay
                                </p>
                                <span
                                  className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                    ticket.delayMinutes < 0
                                      ? "bg-red-100 text-red-800"
                                      : "bg-emerald-100 text-emerald-800"
                                  }`}
                                >
                                  {formatDelay(ticket.delayMinutes)}
                                </span>
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

      {/* Order Received Modal */}
      <Modal
        isOpen={showOrderReceivedModal}
        onClose={() => setShowOrderReceivedModal(false)}
        title="Order Received"
        size="2xl"
      >
        <div className="max-h-[calc(100vh-200px)] overflow-y-auto px-4 pb-4">
          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
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
            <div>
              <Label>Quotation No.</Label>
              <Input
                value={formData.quotationNo || ""}
                disabled
                className="bg-slate-50"
              />
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
                <SelectContent className="bg-white border border-gray-300 rounded-md shadow-lg">
                  {masterData.length > 0 && masterData[0]["Payment Terms"] ? (
                    masterData[0]["Payment Terms"].map(
                      (item, ind) =>
                        item && (
                          <SelectItem
                            key={ind}
                            value={item}
                            className="hover:bg-blue-50 focus:bg-blue-50"
                          >
                            {item}
                          </SelectItem>
                        )
                    )
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
                <SelectContent className="bg-white border border-gray-300 rounded-md shadow-lg">
                  {masterData.length > 0 && masterData[0]["Acceptance Via"] ? (
                    masterData[0]["Acceptance Via"].map(
                      (item, ind) =>
                        item && (
                          <SelectItem
                            key={ind}
                            value={item}
                            className="hover:bg-blue-50 focus:bg-blue-50"
                          >
                            {item}
                          </SelectItem>
                        )
                    )
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
                <SelectContent className="bg-white border border-gray-300 rounded-md shadow-lg">
                  {masterData.length > 0 && masterData[0]["Payment Mode"] ? (
                    masterData[0]["Payment Mode"].map(
                      (item, ind) =>
                        item && (
                          <SelectItem
                            key={ind}
                            value={item}
                            className="hover:bg-blue-50 focus:bg-blue-50"
                          >
                            {item}
                          </SelectItem>
                        )
                    )
                  ) : (
                    <SelectItem value="loading" disabled>
                      Loading options...
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Conditional fields based on Payment Mode — same pattern as
                FollowUp.jsx's renderConditionalFields(). Skipped entirely for
                FOC, since no payment is actually happening there. */}
            {formData.paymentMode && formData.paymentMode !== "FOC" && (
              <>
                <div>
                  <Label className="flex items-center gap-2">
                    Advance Payment Attachment *
                    {isUploadingAdvancePaymentAttachment && (
                      <LoaderIcon className="animate-spin w-4 h-4 text-blue-600" />
                    )}
                  </Label>
                  <Input
                    type="file"
                    disabled={isUploadingAdvancePaymentAttachment}
                    onChange={handleAdvancePaymentAttachmentChange}
                    data-testid="input-advance-payment-attachment"
                  />
                  {isUploadingAdvancePaymentAttachment && (
                    <p className="text-xs text-blue-600 mt-1">Uploading file, please wait...</p>
                  )}
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
                    onChange={handleSeniorApprovalChange}
                    data-testid="input-senior-approval"
                  />
                  {isUploadingSeniorApproval && (
                    <p className="text-xs text-blue-600 mt-1">Uploading file, please wait...</p>
                  )}
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
                    <SelectContent className="bg-white border border-gray-300 rounded-md shadow-lg">
                      {masterData.length > 0 && masterData[0]["Senior Approved By"] ? (
                        masterData[0]["Senior Approved By"].map(
                          (item, ind) =>
                            item && (
                              <SelectItem
                                key={ind}
                                value={item}
                                className="hover:bg-blue-50 focus:bg-blue-50"
                              >
                                {item}
                              </SelectItem>
                            )
                        )
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

            <div className="md:col-span-2 flex space-x-4 pt-4 sticky bottom-0 bg-white py-4">
              <Button
                type="submit"
                disabled={isSubmitting || isUploadingSeniorApproval || isUploadingAdvancePaymentAttachment}
                data-testid="button-submit-order-received"
                className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-70 disabled:transform-none"
              >
                {isSubmitting && <Loader2Icon className="animate-spin" />}
                Submit
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowOrderReceivedModal(false)}
                data-testid="button-cancel-order-received"
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
}
