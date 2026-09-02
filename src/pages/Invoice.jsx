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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { Modal } from "../components/ui/modal";
import { useToast } from "../hooks/use-toast";
import { Loader2Icon, LoaderIcon, Eye } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { supabase } from "../lib/supabase/client";
import { fetchDropdownRows } from "../lib/supabase/dropdown";
import { computeStagePlanned } from "../lib/supabase/stagePlanning";

export default function Invoice() {
  const [activeTab, setActiveTab] = useState("pending");
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [formData, setFormData] = useState({});
  const [searchItem, setSearchItem] = useState("");
  const { toast } = useToast();

  const [masterData, setMasterData] = useState({});

  const [pendingData, setPendingData] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Files are only HELD here on selection — actual upload happens at submit
  // time in handleSubmit (all three in parallel), so cancelling the form or
  // switching tickets never leaves an orphaned upload behind, and nothing
  // hits Storage until Submit is actually clicked.
  const [attachmentServiceFile, setAttachmentServiceFile] = useState(null);
  const [attachmentSpearFile, setAttachmentSpearFile] = useState(null);
  const [attachmentNABLFile, setAttachmentNABLFile] = useState(null);
  // "Advance Details" eye icon on the Pending tab — shows Payment Mode +
  // Advance Payment Attachment + Senior Approval together for one ticket.
  const [advanceDetailsTicket, setAdvanceDetailsTicket] = useState(null);

  const fetchData = async () => {
    setFetchLoading(true);
    try {
      // Tickets ready for Invoice (order_received.invoice_planned set).
      const { data: orderReceivedRows, error: orderReceivedError } = await supabase
        .from("sss_order_received")
        .select("ticket_id, invoice_planned")
        .not("invoice_planned", "is", null);

      if (orderReceivedError) throw orderReceivedError;

      const ticketIds = [...new Set((orderReceivedRows || []).map((o) => o.ticket_id))];

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

      // Full order_received row — every pending-Invoice ticket has one by
      // definition (invoice_planned only ever gets set on that row), so this
      // also doubles as the Payment Term/Payment Mode/Senior Approval/
      // Advance Payment Attachment source for the Pending tab.
      const { data: orderReceivedFullRows, error: orderReceivedFullError } = await supabase
        .from("sss_order_received")
        .select("ticket_id, payment_term, payment_mode, senior_approval, advance_payment_attachment")
        .in("ticket_id", ticketIds);

      if (orderReceivedFullError) throw orderReceivedFullError;

      const orderReceivedFullByTicket = new Map(
        (orderReceivedFullRows || []).map((o) => [o.ticket_id, o])
      );

      // "Client Approval" — same attachment FollowUp.jsx collects when it
      // logs stage='Order Received' (see OrderReceived.jsx's identical fetch).
      const { data: invoiceFollowUpRows, error: invoiceFollowUpError } = await supabase
        .from("sss_follow_up")
        .select("ticket_id, stage, client_attachment_url, created_at")
        .in("ticket_id", ticketIds)
        .eq("stage", "Order Received")
        .order("created_at", { ascending: false });

      if (invoiceFollowUpError) throw invoiceFollowUpError;

      const clientApprovalByTicket = new Map();
      (invoiceFollowUpRows || []).forEach((f) => {
        if (!clientApprovalByTicket.has(f.ticket_id)) {
          clientApprovalByTicket.set(f.ticket_id, f.client_attachment_url || "");
        }
      });

      const { data: invoiceRows, error: invoiceError } = await supabase
        .from("sss_invoice")
        .select("*")
        .in("ticket_id", ticketIds);

      if (invoiceError) throw invoiceError;

      const invoiceByTicket = new Map((invoiceRows || []).map((i) => [i.ticket_id, i]));

      const pending = [];
      const history = [];

      (ticketsData || []).forEach((t) => {
        const q = quotationByTicket.get(t.ticket_id);
        const orderReceived = orderReceivedFullByTicket.get(t.ticket_id);

        const base = {
          ticketId: t.ticket_id,
          ticketUuid: t.uuid,
          timeStemp: t.created_at || "",
          clientName: t.client_name || "",
          phoneNumber: t.phone_number || "",
          companyName: t.company_name || "",
          siteAddress: t.site_address || "",
          gstNo: t.gst_no || "",
          gstAddress: t.gst_address || "",
          CREName: t.cre_name || "",
          // Drives whether this ticket gets calibration_planned/spare_dispatch_planned
          // at submit time — see stagePlanning.js's 'calibration'/'sparedispatch' rules.
          enquiryType: t.enquiry_type || "",
          quotationNo: q?.quotation_no || "",
          quotationPdfLink: q?.quotation_pdf_link || "",
          paymentTerm: orderReceived?.payment_term || "",
          paymentMode: orderReceived?.payment_mode || "",
          seniorApproval: orderReceived?.senior_approval || "",
          advancePaymentAttachment: orderReceived?.advance_payment_attachment || "",
          clientApproval: clientApprovalByTicket.get(t.ticket_id) || "",
        };

        const inv = invoiceByTicket.get(t.ticket_id);
        if (inv) {
          history.push({
            ...base,
            invoicePostedBy: inv.invoice_posted_by || "",
            invoiceDate: inv.invoice_date || "",
            invoiceNoNABL: inv.invoice_no_nabl || "",
            invoiceNoSERVICE: inv.invoice_no_service || "",
            invoiceNoSPARE: inv.invoice_no_spare || "",
            invoiceAmountNABLBasic: inv.invoice_amount_nabl_basic,
            invoiceAmountNABLGst: inv.invoice_amount_nabl_gst,
            serviceAmountBasic: inv.service_amount_basic,
            serviceAmountGst: inv.service_amount_gst,
            spareAmountBasic: inv.spare_amount_basic,
            spareAmountGst: inv.spare_amount_gst,
            attachmentService: inv.attachment_service || "",
            attachmentSpear: inv.attachment_spear || "",
            attachmentNABL: inv.attachment_nabl || "",
            delayMinutes: inv.delay_minutes,
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
    invoice_posted_by: "Invoice Posted By",
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

  const handleInvoiceClick = (ticket) => {
    setSelectedTicket(ticket);
    setFormData({
      ticketId: ticket.ticketId,
      clientName: ticket.clientName,
      phoneNumber: ticket.phoneNumber,
      companyName: ticket.companyName || "",
      siteAddress: ticket.siteAddress || "",
      quotationNo: ticket.quotationNo || "",
      quotationPdfLink: ticket.quotationPdfLink || "",
      invoicePostedBy: "",
      // Left blank on purpose (was defaulted to today) — CREs were clicking
      // straight past it without checking, risking a wrong date going onto
      // the invoice. Now they must pick it deliberately.
      invoiceDate: "",
      invoiceNoNABL: "",
      invoiceNoSERVICE: "",
      invoiceNoSPARE: "",
      invoiceAmountNABLBasic: "",
      invoiceAmountNABLGst: "",
      serviceAmountBasic: "",
      serviceAmountGst: "",
      spareAmountBasic: "",
      spareAmountGst: "",
    });
    setAttachmentServiceFile(null);
    setAttachmentSpearFile(null);
    setAttachmentNABLFile(null);
    setShowInvoiceModal(true);
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const uploadToStorage = async (file, prefix) => {
    const path = `invoice/${prefix}_${selectedTicket?.ticketId}_${Date.now()}_${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("ticket_enquiry")
      .upload(path, file, { contentType: file.type });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from("ticket_enquiry").getPublicUrl(path);
    return data.publicUrl;
  };

  function generateSixDigitNumber() {
    let result = "";
    for (let i = 0; i < 6; i++) {
      result += Math.floor(Math.random() * 10).toString();
    }
    return result;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // All three uploads happen here, in parallel, only now that Submit was
      // actually clicked — nothing was uploaded on file selection.
      const [attachmentServiceUrl, attachmentSpearUrl, attachmentNABLUrl] = await Promise.all([
        attachmentServiceFile ? uploadToStorage(attachmentServiceFile, "service") : Promise.resolve(null),
        attachmentSpearFile ? uploadToStorage(attachmentSpearFile, "spear") : Promise.resolve(null),
        attachmentNABLFile ? uploadToStorage(attachmentNABLFile, "nabl") : Promise.resolve(null),
      ]);

      const submittedAt = new Date();
      // Both are conditional on tickets.enquiry_type — only one (or neither)
      // ever comes back non-null for a given ticket. See stagePlanning.js's
      // 'calibration'/'sparedispatch' rules.
      const planningCtx = { ticket: selectedTicket, invoiceSubmittedAt: submittedAt };
      const calibrationPlanned = await computeStagePlanned("calibration", planningCtx);
      const spareDispatchPlanned = await computeStagePlanned("sparedispatch", planningCtx);

      const { error } = await supabase.from("sss_invoice").insert({
        ticket_id: selectedTicket.ticketId,
        ticket_uuid: selectedTicket.ticketUuid,
        invoice_posted_by: formData.invoicePostedBy || null,
        invoice_date: formData.invoiceDate || null,
        invoice_no_nabl: formData.invoiceNoNABL || null,
        invoice_no_service: formData.invoiceNoSERVICE || null,
        invoice_no_spare: formData.invoiceNoSPARE || null,
        invoice_amount_nabl_basic: formData.invoiceAmountNABLBasic || null,
        invoice_amount_nabl_gst: formData.invoiceAmountNABLGst || null,
        service_amount_basic: formData.serviceAmountBasic || null,
        service_amount_gst: formData.serviceAmountGst || null,
        spare_amount_basic: formData.spareAmountBasic || null,
        spare_amount_gst: formData.spareAmountGst || null,
        attachment_service: attachmentServiceUrl,
        attachment_spear: attachmentSpearUrl,
        attachment_nabl: attachmentNABLUrl,
        otp: generateSixDigitNumber(),
        // Readiness stamp for Calibration.jsx — only set when tickets.enquiry_type = 'NABL'.
        calibration_planned: calibrationPlanned,
        // Readiness stamp for SpareDispatchDetails.jsx — only set when tickets.enquiry_type = 'SPARE'.
        spare_dispatch_planned: spareDispatchPlanned,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Invoice submitted successfully",
      });
      setShowInvoiceModal(false);
      fetchData();
    } catch (error) {
      console.error("Error submitting invoice:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save invoice details",
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
  // convention, matching predecessor Order Received. See
  // invoice.delay_minutes / migration 0036.
  const formatDelay = (minutes) => {
    if (minutes === null || minutes === undefined) return "N/A";
    if (minutes < 0) return `${Math.abs(minutes)} min late`;
    return `${minutes} min early`;
  };

  const filteredPendingDataa = pendingData
    .filter((item) => {
      const q = searchItem.toLowerCase();
      return (
        String(item.ticketId || "").toLowerCase().includes(q) ||
        String(item.clientName || "").toLowerCase().includes(q) ||
        String(item.companyName || "").toLowerCase().includes(q) ||
        String(item.quotationNo || "").toLowerCase().includes(q) ||
        String(item.phoneNumber || "").toLowerCase().includes(q)
      );
    })
    .reverse();

  const filteredHistoryDataa = historyData
    .filter((item) => {
      const q = searchItem.toLowerCase();
      return (
        String(item.ticketId || "").toLowerCase().includes(q) ||
        String(item.clientName || "").toLowerCase().includes(q) ||
        String(item.companyName || "").toLowerCase().includes(q) ||
        String(item.quotationNo || "").toLowerCase().includes(q) ||
        String(item.phoneNumber || "").toLowerCase().includes(q)
      );
    })
    .reverse();

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

  return (
    <div className="space-y-2">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardHeader className="bg-gradient-to-r from-blue-50/50 to-indigo-50/50 rounded-t-lg border-b border-blue-100 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
            {/* Left Side: Tabs triggers */}
            <div className="flex flex-wrap items-center gap-4">
              <TabsList className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200">
                <TabsTrigger
                  value="pending"
                  data-testid="tab-pending"
                  className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                >
                  Pending ({filteredPendingData.length})
                </TabsTrigger>
                <TabsTrigger
                  value="history"
                  data-testid="tab-history"
                  className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                >
                  History ({filteredHistoryData.length})
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Right Side: Search Input */}
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
                          Ticket ID
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Quotation No.
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Client Name
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Phone Number
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Company Name
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[200px] sticky top-0">
                          Site Address
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          GST Number
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[200px] sticky top-0">
                          Billing Address
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Payment Term
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[120px] sticky top-0">
                          Client Approval
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[120px] sticky top-0">
                          Senior Approval
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[120px] sticky top-0">
                          Advance Details
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Quotation Pdf Link
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-blue-100">
                      {filteredPendingData.length === 0 ? (
                        <tr>
                          <td
                            colSpan={14}
                            className="text-center py-8 bg-white"
                            data-testid="text-no-pending"
                          >
                            {fetchLoading ? (
                              <div className="flex justify-center items-center text-blue-700">
                                <LoaderIcon className="animate-spin w-8 h-8" />
                              </div>
                            ) : (
                              <h1 className="text-blue-700">
                                No pending invoices found.
                              </h1>
                            )}
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
                                onClick={() => handleInvoiceClick(ticket)}
                                variant="outline"
                                className="bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-600 hover:from-blue-100 hover:to-indigo-100 hover:text-blue-700 transition-all duration-300 border border-blue-200 hover:border-blue-300 rounded-lg px-3 py-1.5 shadow-sm hover:shadow-md group"
                                data-testid={`button-invoice-${ticket.ticketId}`}
                              >
                                <span className="font-medium">Invoice</span>
                              </Button>
                            </td>
                            <td className="px-4 py-3 font-medium text-blue-800">
                              {ticket.ticketId}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.quotationNo}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.clientName}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.phoneNumber || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.companyName || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.siteAddress || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.gstNo || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.gstAddress || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.paymentTerm || ""}
                            </td>
                            <td className="px-4 py-3">
                              {ticket.clientApproval ? (
                                <a
                                  href={ticket.clientApproval}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 text-xs font-semibold"
                                >
                                  View
                                </a>
                              ) : (
                                ""
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {ticket.seniorApproval ? (
                                <a
                                  href={ticket.seniorApproval}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 text-xs font-semibold"
                                >
                                  View
                                </a>
                              ) : (
                                ""
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setAdvanceDetailsTicket(ticket)}
                                className="h-7 px-2 border-purple-200 text-purple-700 hover:bg-purple-50"
                                data-testid={`button-advance-details-${ticket.ticketId}`}
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </Button>
                            </td>
                            <td className="px-4 py-3">
                              {ticket.quotationPdfLink ? (
                                <a
                                  href={ticket.quotationPdfLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 text-xs font-semibold"
                                >
                                  View PDF
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
                    {filteredPendingData.length === 0 ? (
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
                            No pending invoices found.
                          </h1>
                        )}
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
                                onClick={() => handleInvoiceClick(ticket)}
                                variant="outline"
                                className="bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-600 hover:from-blue-100 hover:to-indigo-100 border border-blue-200"
                              >
                                Invoice
                              </Button>
                            </div>

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
                                  Phone
                                </p>
                                <p className="text-blue-900">
                                  {ticket.phoneNumber || "N/A"}
                                </p>
                              </div>
                            </div>

                            <div>
                              <p className="text-gray-500 font-medium text-sm">
                                Company Name
                              </p>
                              <p className="text-blue-900">
                                {ticket.companyName || "N/A"}
                              </p>
                            </div>

                            <div>
                              <p className="text-gray-500 font-medium text-sm">
                                Site Address
                              </p>
                              <p className="text-blue-900">
                                {ticket.siteAddress || "N/A"}
                              </p>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500 font-medium">
                                  GST Number
                                </p>
                                <p className="text-blue-900">
                                  {ticket.gstNo || "N/A"}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Payment Term
                                </p>
                                <p className="text-blue-900">
                                  {ticket.paymentTerm || "N/A"}
                                </p>
                              </div>
                            </div>

                            <div>
                              <p className="text-gray-500 font-medium text-sm">
                                Billing Address
                              </p>
                              <p className="text-blue-900">
                                {ticket.gstAddress || "N/A"}
                              </p>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-sm items-end">
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Client Approval
                                </p>
                                {ticket.clientApproval ? (
                                  <a href={ticket.clientApproval} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 text-xs">View</a>
                                ) : (
                                  <p className="text-blue-900 text-xs">N/A</p>
                                )}
                              </div>
                              <div className="flex items-center gap-3">
                                <div>
                                  <p className="text-gray-500 font-medium">
                                    Senior Approval
                                  </p>
                                  {ticket.seniorApproval ? (
                                    <a href={ticket.seniorApproval} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 text-xs">View</a>
                                  ) : (
                                    <p className="text-blue-900 text-xs">N/A</p>
                                  )}
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setAdvanceDetailsTicket(ticket)}
                                  className="h-7 px-2 border-purple-200 text-purple-700 hover:bg-purple-50"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>

                            <div>
                              <p className="text-gray-500 font-medium text-sm">
                                Quotation PDF
                              </p>
                              {ticket.quotationPdfLink ? (
                                <a
                                  href={ticket.quotationPdfLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 text-xs"
                                >
                                  View PDF
                                </a>
                              ) : (
                                <p className="text-blue-900 text-xs">N/A</p>
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
                          Ticket ID
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Quotation No
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Client Name
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Phone Number
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Company Name
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Invoice Date
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[180px] sticky top-0">
                          Invoice Posted By
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Invoice No (NABL)
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Invoice No (SERVICE)
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Invoice No (SPARE)
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[170px] sticky top-0">
                          Invoice Amount NABL (Basic)
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[160px] sticky top-0">
                          Invoice Amount NABL (GST)
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Service Amount (Basic)
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Service Amount (GST)
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Spare Amount (Basic)
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Spare Amount (GST)
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Attachment Service
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Attachment Spear
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Attachment NABL
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[130px] sticky top-0">
                          Delay
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-blue-100">
                      {filteredHistoryData.length === 0 ? (
                        <tr>
                          <td
                            colSpan={19}
                            className="text-center py-8 bg-white"
                            data-testid="text-no-history"
                          >
                            {fetchLoading ? (
                              <div className="flex justify-center items-center text-blue-700">
                                <LoaderIcon className="animate-spin w-8 h-8" />
                              </div>
                            ) : (
                              <h1 className="text-blue-700">
                                No invoice history found.
                              </h1>
                            )}
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
                              {ticket.ticketId || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.quotationNo || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.clientName || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.phoneNumber || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.companyName || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.invoiceDate ? formatDate(ticket.invoiceDate) : ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.invoicePostedBy || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.invoiceNoNABL || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.invoiceNoSERVICE || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.invoiceNoSPARE || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              ₹{ticket.invoiceAmountNABLBasic || "0"}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              ₹{ticket.invoiceAmountNABLGst || "0"}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              ₹{ticket.serviceAmountBasic || "0"}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              ₹{ticket.serviceAmountGst || "0"}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              ₹{ticket.spareAmountBasic || "0"}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              ₹{ticket.spareAmountGst || "0"}
                            </td>
                            <td className="px-4 py-3">
                              {ticket.attachmentService ? (
                                <a
                                  href={ticket.attachmentService}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 text-xs font-semibold"
                                >
                                  View
                                </a>
                              ) : (
                                ""
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {ticket.attachmentSpear ? (
                                <a
                                  href={ticket.attachmentSpear}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 text-xs font-semibold"
                                >
                                  View
                                </a>
                              ) : (
                                ""
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {ticket.attachmentNABL ? (
                                <a
                                  href={ticket.attachmentNABL}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 text-xs font-semibold"
                                >
                                  View
                                </a>
                              ) : (
                                ""
                              )}
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
                    {filteredHistoryData.length === 0 ? (
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
                            No invoice history found.
                          </h1>
                        )}
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
                                  Invoice Date
                                </p>
                                <p className="text-blue-900">
                                  {ticket.invoiceDate ? formatDate(ticket.invoiceDate) : "N/A"}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Posted By
                                </p>
                                <p className="text-blue-900">
                                  {ticket.invoicePostedBy || "N/A"}
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Invoice No (NABL)
                                </p>
                                <p className="text-blue-900">
                                  {ticket.invoiceNoNABL || "N/A"}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Invoice No (SERVICE)
                                </p>
                                <p className="text-blue-900">
                                  {ticket.invoiceNoSERVICE || "N/A"}
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Service Amount
                                </p>
                                <p className="text-blue-900">
                                  ₹{ticket.serviceAmountBasic || "0"} + ₹{ticket.serviceAmountGst || "0"} GST
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Spare Amount
                                </p>
                                <p className="text-blue-900">
                                  ₹{ticket.spareAmountBasic || "0"} + ₹{ticket.spareAmountGst || "0"} GST
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Attachments
                                </p>
                                <div className="flex gap-2 text-xs">
                                  {ticket.attachmentService && (
                                    <a href={ticket.attachmentService} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">Service</a>
                                  )}
                                  {ticket.attachmentSpear && (
                                    <a href={ticket.attachmentSpear} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">Spear</a>
                                  )}
                                  {ticket.attachmentNABL && (
                                    <a href={ticket.attachmentNABL} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">NABL</a>
                                  )}
                                </div>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">
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

      {/* Invoice Modal */}
      <Modal
        isOpen={showInvoiceModal}
        onClose={() => setShowInvoiceModal(false)}
        title="Invoice"
        size="2xl"
      >
        <div className="max-h-[calc(100vh-200px)] overflow-y-auto px-4 pb-4">
          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            <div>
              <Label>Ticket ID</Label>
              <Input value={formData.ticketId || ""} disabled className="bg-slate-50" />
            </div>
            <div>
              <Label>Client Name</Label>
              <Input value={formData.clientName || ""} disabled className="bg-slate-50" />
            </div>
            <div>
              <Label>Phone Number</Label>
              <Input value={formData.phoneNumber || ""} disabled className="bg-slate-50" />
            </div>
            <div>
              <Label>Quotation No.</Label>
              <Input value={formData.quotationNo || ""} disabled className="bg-slate-50" />
            </div>
            <div>
              <Label>Company Name</Label>
              <Input value={formData.companyName || ""} disabled className="bg-slate-50" />
            </div>
            <div>
              <Label>Site Address</Label>
              <Input value={formData.siteAddress || ""} disabled className="bg-slate-50" />
            </div>

            <div>
              <Label>Invoice Posted By *</Label>
              <Select
                value={formData.invoicePostedBy || undefined}
                onValueChange={(value) => handleInputChange("invoicePostedBy", value)}
              >
                <SelectTrigger data-testid="select-invoice-posted-by">
                  <SelectValue placeholder="Select who posted this invoice" />
                </SelectTrigger>
                <SelectContent className="bg-white border border-gray-300 rounded-md shadow-lg">
                  {masterData.length > 0 && masterData[0]["Invoice Posted By"] ? (
                    masterData[0]["Invoice Posted By"].map(
                      (item, ind) =>
                        item && (
                          <SelectItem key={ind} value={item} className="hover:bg-blue-50 focus:bg-blue-50">
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
              <Label>Invoice Date *</Label>
              <Input
                type="date"
                value={formData.invoiceDate || ""}
                onChange={(e) => handleInputChange("invoiceDate", e.target.value)}
                required
                data-testid="input-invoice-date"
              />
            </div>

            <div>
              <Label>Invoice No (NABL)</Label>
              <Input
                value={formData.invoiceNoNABL || ""}
                onChange={(e) => handleInputChange("invoiceNoNABL", e.target.value)}
                placeholder="Enter Invoice No (NABL)"
              />
            </div>
            <div>
              <Label>Invoice No (SERVICE)</Label>
              <Input
                value={formData.invoiceNoSERVICE || ""}
                onChange={(e) => handleInputChange("invoiceNoSERVICE", e.target.value)}
                placeholder="Enter Invoice No (SERVICE)"
              />
            </div>
            <div>
              <Label>Invoice No (SPARE)</Label>
              <Input
                value={formData.invoiceNoSPARE || ""}
                onChange={(e) => handleInputChange("invoiceNoSPARE", e.target.value)}
                placeholder="Enter Invoice No (SPARE)"
              />
            </div>

            <div>
              <Label>Invoice Amount NABL (Basic)</Label>
              <Input
                type="number"
                value={formData.invoiceAmountNABLBasic || ""}
                onChange={(e) => handleInputChange("invoiceAmountNABLBasic", e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <Label>Invoice Amount NABL (GST)</Label>
              <Input
                type="number"
                value={formData.invoiceAmountNABLGst || ""}
                onChange={(e) => handleInputChange("invoiceAmountNABLGst", e.target.value)}
                placeholder="0"
              />
            </div>

            <div>
              <Label>Service Amount (Basic)</Label>
              <Input
                type="number"
                value={formData.serviceAmountBasic || ""}
                onChange={(e) => handleInputChange("serviceAmountBasic", e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <Label>Service Amount (GST)</Label>
              <Input
                type="number"
                value={formData.serviceAmountGst || ""}
                onChange={(e) => handleInputChange("serviceAmountGst", e.target.value)}
                placeholder="0"
              />
            </div>

            <div>
              <Label>Spare Amount (Basic)</Label>
              <Input
                type="number"
                value={formData.spareAmountBasic || ""}
                onChange={(e) => handleInputChange("spareAmountBasic", e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <Label>Spare Amount (GST)</Label>
              <Input
                type="number"
                value={formData.spareAmountGst || ""}
                onChange={(e) => handleInputChange("spareAmountGst", e.target.value)}
                placeholder="0"
              />
            </div>

            <div>
              <Label>Attachment (Service)</Label>
              <Input
                type="file"
                onChange={(e) => setAttachmentServiceFile(e.target.files[0] || null)}
                disabled={isSubmitting}
              />
              {attachmentServiceFile && (
                <p className="text-xs text-emerald-700 mt-1 truncate">Selected: {attachmentServiceFile.name}</p>
              )}
            </div>
            <div>
              <Label>Attachment (Spear)</Label>
              <Input
                type="file"
                onChange={(e) => setAttachmentSpearFile(e.target.files[0] || null)}
                disabled={isSubmitting}
              />
              {attachmentSpearFile && (
                <p className="text-xs text-emerald-700 mt-1 truncate">Selected: {attachmentSpearFile.name}</p>
              )}
            </div>
            <div>
              <Label>Attachment (NABL)</Label>
              <Input
                type="file"
                onChange={(e) => setAttachmentNABLFile(e.target.files[0] || null)}
                disabled={isSubmitting}
              />
              {attachmentNABLFile && (
                <p className="text-xs text-emerald-700 mt-1 truncate">Selected: {attachmentNABLFile.name}</p>
              )}
            </div>

            <div className="md:col-span-2 flex justify-end space-x-4 pt-6 border-t border-gray-200 sticky bottom-0 bg-white py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowInvoiceModal(false)}
                data-testid="button-cancel-invoice"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                data-testid="button-submit-invoice"
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm"
              >
                {isSubmitting ? (
                  <span className="flex items-center">
                    <Loader2Icon className="animate-spin mr-2" />
                    Uploading & Submitting...
                  </span>
                ) : (
                  "Submit"
                )}
              </Button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Advance Details — Payment Mode + Advance Payment Attachment +
          Senior Approval together, for the Pending tab's eye icon. */}
      <Modal
        isOpen={!!advanceDetailsTicket}
        onClose={() => setAdvanceDetailsTicket(null)}
        title="Advance Details"
        size="sm"
      >
        <div className="p-2 space-y-4">
          <div>
            <p className="text-gray-500 font-medium text-sm">Payment Mode</p>
            <p className="text-blue-900">{advanceDetailsTicket?.paymentMode || "N/A"}</p>
          </div>
          <div>
            <p className="text-gray-500 font-medium text-sm">Advance Payment Attachment</p>
            {advanceDetailsTicket?.advancePaymentAttachment ? (
              <a
                href={advanceDetailsTicket.advancePaymentAttachment}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                View File
              </a>
            ) : (
              <p className="text-blue-900">N/A</p>
            )}
          </div>
          <div>
            <p className="text-gray-500 font-medium text-sm">Senior Approval</p>
            {advanceDetailsTicket?.seniorApproval ? (
              <a
                href={advanceDetailsTicket.seniorApproval}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                View File
              </a>
            ) : (
              <p className="text-blue-900">N/A</p>
            )}
          </div>
          <div className="flex justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setAdvanceDetailsTicket(null)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
