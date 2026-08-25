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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { Modal } from "../components/ui/modal";
import { useToast } from "../hooks/use-toast";
import { Eye, Loader2Icon, LoaderIcon } from "lucide-react";
import { supabase } from "../lib/supabase/client";
import { computeStagePlanned } from "../lib/supabase/stagePlanning";

const formatInputDate = (dateStr) => {
  if (!dateStr) return "";
  const str = String(dateStr).trim().split(" ")[0];

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  const match = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (match) {
    const day = match[1].padStart(2, "0");
    const month = match[2].padStart(2, "0");
    let year = match[3];
    if (year.length === 2) {
      year = "20" + year;
    }
    return `${year}-${month}-${day}`;
  }

  const matchY = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (matchY) {
    const year = matchY[1];
    const month = matchY[2].padStart(2, "0");
    const day = matchY[3].padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
  } catch (e) {}

  return "";
};

export default function TADA() {
  const [activeTab, setActiveTab] = useState("pending");
  const [showTADAModal, setShowTADAModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [formData, setFormData] = useState({});
  const [searchItem, setSearchItem] = useState("");
  const { toast } = useToast();

  const [pendingData, setPendingData] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    setFetchLoading(true);
    try {
      // Tickets ready for TADA (site_visit.tada_planned set).
      const { data: siteVisitRows, error: siteVisitError } = await supabase
        .from("site_visit")
        .select("ticket_id, ticket_uuid, engineer_assign, date_of_visit, transportation, tada_planned")
        .not("tada_planned", "is", null)
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
        .from("tickets")
        .select("*")
        .in("ticket_id", ticketIds)
        .order("created_at", { ascending: true });

      if (ticketsError) throw ticketsError;

      // Warranty Check and Quotation are display-only here — joined from
      // their owning stages.
      const { data: warrantyRows, error: warrantyError } = await supabase
        .from("warranty_check")
        .select("ticket_id, warranty_check")
        .in("ticket_id", ticketIds);

      if (warrantyError) throw warrantyError;

      const warrantyByTicket = new Map((warrantyRows || []).map((w) => [w.ticket_id, w.warranty_check]));

      const { data: quotationRows, error: quotationError } = await supabase
        .from("quotation")
        .select("ticket_id, quotation_no, quotation_pdf_link")
        .in("ticket_id", ticketIds);

      if (quotationError) throw quotationError;

      const quotationByTicket = new Map((quotationRows || []).map((q) => [q.ticket_id, q]));

      const { data: tadaRows, error: tadaError } = await supabase
        .from("tada")
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
          category: t.enquiry_type || "",
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
        handleTADAClick(targetTicket);
        // Clean the query param from the URL without reloading
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, "", cleanUrl);
      }
    }
  }, [pendingData]);


  const handleTADAClick = (ticket) => {
    setSelectedTicket(ticket);
    setFormData({
      ticketId: ticket.ticketId,
      clientName: ticket.clientName,
      phoneNumber: ticket.phoneNumber,
      enquiryReceiverName: ticket.enquiryReceiverName || "",
      warrantyCheck: ticket.warrantyCheck || "",
      machineName: ticket.machineName || "",
      engineerAssign: ticket.engineerAssign || "",
      siteName: ticket.siteAddress || ticket.siteName || "",
      dateOfVisit: ticket.dateOfVisit || "",
      transportation: ticket.transportation || "",
      travelDate: formatInputDate(ticket.dateOfVisit),
      returnDate: "",
      destination: "",
      purposeOfTravel: "",
      amount: "",
      expectedCompletionDate: "",
      expectedCompletionTime: "",
    });
    setShowTADAModal(true);
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setIsSubmitting(true); // Start loading

    try {
      const submittedAt = new Date();
      const otpVerificationPlanned = await computeStagePlanned("otpVerification", {
        tadaSubmittedAt: submittedAt,
      });

      const { error } = await supabase.from("tada").insert({
        ticket_id: selectedTicket.ticketId,
        ticket_uuid: selectedTicket.ticketUuid,
        travel_date: formData.travelDate || null,
        return_date: formData.returnDate || null,
        destination: formData.destination || null,
        purpose_of_travel: formData.purposeOfTravel || null,
        amount: formData.amount || null,
        expected_completion_date: formData.expectedCompletionDate || null,
        expected_completion_time: formData.expectedCompletionTime || null,
        // Readiness stamp for the next stage (OTP Verification, not yet
        // migrated) — see stagePlanning.js.
        otp_verification_planned: otpVerificationPlanned,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Ticket details saved successfully",
      });

      setShowTADAModal(false);
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
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are 0-indexed
    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
  };

  const filteredPendingDataa = pendingData
    .filter((item) => {
      const q = searchItem.toLowerCase();
      const matchesSearch =
        String(item.ticketId || "").toLowerCase().includes(q) ||
        String(item.clientName || "").toLowerCase().includes(q) ||
        String(item.companyName || "").toLowerCase().includes(q) ||
        String(item.phoneNumber || "").toLowerCase().includes(q);
      return matchesSearch;
    })
    .reverse();

  const filteredHistoryDataa = historyData
    .filter((item) => {
      const q = searchItem.toLowerCase();
      const matchesSearch =
        String(item.ticketId || "").toLowerCase().includes(q) ||
        String(item.clientName || "").toLowerCase().includes(q) ||
        String(item.companyName || "").toLowerCase().includes(q) ||
        String(item.phoneNumber || "").toLowerCase().includes(q);
      return matchesSearch;
    })
    .reverse();

  const userName = localStorage.getItem("currentUsername");

  const roleStorage = localStorage.getItem("o2d-auth-storage");
  const parsedData = JSON.parse(roleStorage);
  const role = parsedData.state.user.role;

  const filteredPendingData = role === "user" ? filteredPendingDataa.filter(
    (item) => item["CREName"] === userName
  )
    : role === "engineer" ? filteredPendingDataa.filter((item) => item["engineerAssign"] === userName)
      : filteredPendingDataa;


  const filteredHistoryData = role === "user" ? filteredHistoryDataa.filter(
    (item) => item["CREName"] === userName
  ) : role === "engineer" ? filteredHistoryDataa.filter((item) => item["engineerAssign"] === userName) : filteredHistoryDataa;

  // Minutes late, always >= 0 (or blank when no delay was computed). See
  // tada.delay_minutes / migration 0031 — unlike prior stages, this is never
  // shown as negative/"early".
  const formatDelay = (minutes) => {
    if (minutes === null || minutes === undefined) return "-";
    return `${minutes} min`;
  };

  return (
    <div className="space-y-2">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardHeader className="bg-gradient-to-r from-blue-50/50 to-indigo-50/50 rounded-t-lg border-b border-blue-100 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">

            {/* Left Side: Tabs buttons */}
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
                  placeholder="Search by ticket ID, client, company or phone..."
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
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Date
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[120px] sticky top-0">
                          Ticket ID
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
                          Warranty Check
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Engineer Assign
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Site Name
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Date of Visit
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Transportation
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-center w-[120px] sticky top-0">
                          Quotation PDF
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-blue-100">
                      {filteredPendingData.length === 0 ? (
                        <tr>
                          <td
                            colSpan={23}
                            className="text-center py-8 bg-white"
                            data-testid="text-no-pending"
                          >
                            {fetchLoading ? (
                              <div className="flex justify-center items-center text-blue-700">
                                <LoaderIcon className="animate-spin w-8 h-8" />
                              </div>
                            ) : (
                              <h1 className="text-blue-700">
                                No pending TADA requests found.
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
                                variant="outline"
                                className="bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-600 hover:from-blue-100 hover:to-indigo-100 hover:text-blue-700 transition-all duration-300 border border-blue-200 hover:border-blue-300 rounded-lg px-3 py-1.5 shadow-sm hover:shadow-md group"
                                onClick={() => handleTADAClick(ticket)}
                                data-testid={`button-tada-${ticket.ticketId}`}
                              >
                                <Eye className="w-4 h-4 mr-2 transition-all group-hover:scale-110 text-blue-500 group-hover:text-blue-600" />
                                <span className="font-medium">TADA</span>
                              </Button>
                            </td>
                            <td className="px-4 py-3 text-blue-900">
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
                              {ticket.companyName || "-"}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.clientName}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.phoneNumber}
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
                              {ticket.quotationNo ? String(ticket.quotationNo).replace(/^(Quotation|Quo|QUO|Quo\.)[:\-\s.]*/i, "").trim() : "-"}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.warrantyCheck}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.engineerAssign || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.siteName || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {formatDate(ticket.dateOfVisit) || ""}
                            </td>
                            <td className="px-4 py-3">
                              <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                                {ticket.transportation || ""}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {ticket.quotationPdfLink ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-full p-1"
                                  onClick={() => window.open(ticket.quotationPdfLink, "_blank")}
                                  title="View Quotation PDF"
                                >
                                  <Eye className="w-5 h-5" />
                                </Button>
                              ) : (
                                <span className="text-gray-400">-</span>
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
                            No pending TADA requests found.
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
                            {/* Header with Ticket ID and Action */}
                            <div className="flex justify-between items-start">
                              <div>
                                <h3 className="font-bold text-blue-800 text-lg">
                                  {ticket.ticketId}
                                </h3>
                                <p className="text-sm text-gray-600">
                                  {ticket.clientName}
                                </p>
                                <div className="mt-2 space-y-1 border-t border-gray-100 pt-2">
                                  <p className="text-sm">
                                    <span className="font-medium text-gray-500">Company:</span>{" "}
                                    <span className="text-blue-700">{ticket.companyName || "N/A"}</span>
                                  </p>
                                  <p className="text-sm">
                                    <span className="font-medium text-gray-500">Quotation No:</span>{" "}
                                    <span className="text-blue-700">{ticket.quotationNo ? String(ticket.quotationNo).replace(/^(Quotation|Quo|QUO|Quo\.)[:\-\s.]*/i, "").trim() : "N/A"}</span>
                                  </p>
                                  {ticket.quotationPdfLink && (
                                    <div className="flex items-center gap-2 mt-1">
                                      <span className="text-sm font-medium text-gray-500">PDF:</span>
                                      <Button
                                        variant="link"
                                        size="sm"
                                        className="h-auto p-0 text-blue-600 font-medium flex items-center gap-1"
                                        onClick={() => window.open(ticket.quotationPdfLink, "_blank")}
                                      >
                                        <Eye className="w-3 h-3" /> View
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                className="bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-600 hover:from-blue-100 hover:to-indigo-100 border border-blue-200"
                                onClick={() => handleTADAClick(ticket)}
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                TADA
                              </Button>
                            </div>

                            {/* Contact & Warranty Info */}
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
                                  Warranty
                                </p>
                                <p className="text-blue-900">
                                  {ticket.warrantyCheck}
                                </p>
                              </div>
                            </div>

                            {/* Machine & Enquiry Details */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Machine
                                </p>
                                <p className="text-blue-900">
                                  {ticket.machineName || "N/A"}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Call Type
                                </p>
                                <p className="text-blue-900">
                                  {ticket.callType || "N/A"}
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

                            {/* Visit Date & Transportation */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Visit Date
                                </p>
                                <p className="text-blue-900">
                                  {formatDate(ticket.dateOfVisit) || "N/A"}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Transportation
                                </p>
                                <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                                  {ticket.transportation || "N/A"}
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

            <TabsContent value="history" className="mt-0">
              <div className="relative overflow-x-auto">
                <div className="max-h-[calc(103vh-200px)] overflow-y-auto">
                  <table className="hidden sm:block w-full">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-gradient-to-r from-blue-600 to-indigo-600">
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Date
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[120px] sticky top-0">
                          Ticket ID
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
                          Engineer Assign
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Travel Date
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Return Date
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Destination
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Purpose
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Amount
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[170px] sticky top-0">
                          OTP Verification Planned
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[120px] sticky top-0">
                          Delay
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-center w-[120px] sticky top-0">
                          Quotation PDF
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-blue-100">
                      {filteredHistoryData.length === 0 ? (
                        <tr>
                          <td
                            colSpan={24}
                            className="text-center py-8 bg-white"
                            data-testid="text-no-history"
                          >
                            {fetchLoading ? (
                              <div className="flex justify-center items-center text-blue-700">
                                <LoaderIcon className="animate-spin w-8 h-8" />
                              </div>
                            ) : (
                              <h1 className="text-blue-700">
                                No TADA history found.
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
                            <td className="px-4 py-3 text-blue-900">
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
                              {ticket.companyName || "-"}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.clientName}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.phoneNumber}
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
                              {ticket.quotationNo ? String(ticket.quotationNo).replace(/^(Quotation|Quo|QUO|Quo\.)[:\-\s.]*/i, "").trim() : "-"}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.engineerAssign || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {formatDate(ticket.travelDate) || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {formatDate(ticket.returnDate) || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.destinationInput || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.purposeOfTravel || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              ₹{ticket.amount || "0"}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.otpVerificationPlanned
                                ? new Date(ticket.otpVerificationPlanned).toLocaleString("en-IN")
                                : "-"}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  ticket.delayMinutes > 0
                                    ? "bg-red-100 text-red-800"
                                    : "bg-emerald-100 text-emerald-800"
                                }`}
                              >
                                {formatDelay(ticket.delayMinutes)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {ticket.quotationPdfLink ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-full p-1"
                                  onClick={() => window.open(ticket.quotationPdfLink, "_blank")}
                                  title="View Quotation PDF"
                                >
                                  <Eye className="w-5 h-5" />
                                </Button>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
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
                            No TADA history found.
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
                            {/* Header */}
                            <div>
                              <h3 className="font-bold text-blue-800 text-lg">
                                {ticket.ticketId}
                              </h3>
                              <p className="text-sm text-gray-600">
                                {ticket.clientName}
                              </p>
                              <div className="mt-2 space-y-1 border-t border-gray-100 pt-2 text-sm">
                                <p><span className="font-medium text-gray-500">Company:</span> <span className="text-blue-700">{ticket.companyName || "N/A"}</span></p>
                                <p><span className="font-medium text-gray-500">Quotation No:</span> <span className="text-blue-700">{ticket.quotationNo ? String(ticket.quotationNo).replace(/^(Quotation|Quo|QUO|Quo\.)[:\-\s.]*/i, "").trim() : "N/A"}</span></p>
                                {ticket.quotationPdfLink && (
                                  <Button
                                    variant="link"
                                    size="sm"
                                    className="p-0 h-auto text-blue-600 font-medium flex items-center gap-1 mt-1"
                                    onClick={() => window.open(ticket.quotationPdfLink, "_blank")}
                                  >
                                    <Eye className="w-3 h-3" /> View Quotation
                                  </Button>
                                )}
                              </div>
                            </div>

                            {/* Engineer & Amount */}
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
                                  Amount
                                </p>
                                <p className="text-blue-900 font-semibold">
                                  ₹{ticket.amount || "0"}
                                </p>
                              </div>
                            </div>

                            {/* Travel Dates */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Travel Date
                                </p>
                                <p className="text-blue-900">
                                  {formatDate(ticket.travelDate) || "N/A"}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Return Date
                                </p>
                                <p className="text-blue-900">
                                  {formatDate(ticket.returnDate) || "N/A"}
                                </p>
                              </div>
                            </div>

                            {/* Destination */}
                            <div>
                              <p className="text-gray-500 font-medium text-sm">
                                Destination
                              </p>
                              <p className="text-blue-900">
                                {ticket.destinationInput || "N/A"}
                              </p>
                            </div>

                            {/* Purpose */}
                            <div>
                              <p className="text-gray-500 font-medium text-sm">
                                Purpose of Travel
                              </p>
                              <p className="text-blue-900 line-clamp-2">
                                {ticket.purposeOfTravel || "N/A"}
                              </p>
                            </div>

                            {/* OTP Verification Planned & Delay */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500 font-medium">
                                  OTP Verification Planned
                                </p>
                                <p className="text-blue-900">
                                  {ticket.otpVerificationPlanned
                                    ? new Date(ticket.otpVerificationPlanned).toLocaleString("en-IN")
                                    : "N/A"}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Delay
                                </p>
                                <span
                                  className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                    ticket.delayMinutes > 0
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

      {/* TADA Modal */}
      <Modal
        isOpen={showTADAModal}
        onClose={() => setShowTADAModal(false)}
        title="TADA (Travel and Daily Allowance)"
        size="2xl"
      >
        <div className="bg-white rounded-lg max-h-[70vh] overflow-y-auto">
          <div className="p-6">
            <form
              onSubmit={handleSubmit}
              className="grid grid-cols-1 md:grid-cols-2 gap-6  "
            >
              {/* Pre-filled fields */}
              <div className="space-y-1">
                <Label className="text-gray-600 font-medium">Ticket ID</Label>
                <Input
                  value={formData.ticketId || ""}
                  disabled
                  className="bg-gray-50 border border-gray-200 text-gray-700 rounded-lg py-2 px-3 focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-gray-600 font-medium">Client Name</Label>
                <Input
                  value={formData.clientName || ""}
                  disabled
                  className="bg-gray-50 border border-gray-200 text-gray-700 rounded-lg py-2 px-3 focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-gray-600 font-medium">
                  Phone Number
                </Label>
                <Input
                  value={formData.phoneNumber || ""}
                  disabled
                  className="bg-gray-50 border border-gray-200 text-gray-700 rounded-lg py-2 px-3 focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-gray-600 font-medium">
                  Machine Name
                </Label>
                <Input
                  value={formData.machineName || ""}
                  disabled
                  className="bg-gray-50 border border-gray-200 text-gray-700 rounded-lg py-2 px-3 focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-gray-600 font-medium">
                  Engineer Assign
                </Label>
                <Input
                  value={formData.engineerAssign || ""}
                  disabled
                  className="bg-gray-50 border border-gray-200 text-gray-700 rounded-lg py-2 px-3 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-gray-600 font-medium">
                  Site Name
                </Label>
                <Input
                  value={formData.siteName || ""}
                  disabled
                  className="bg-gray-50 border border-gray-200 text-gray-700 rounded-lg py-2 px-3 focus:outline-none"
                />
              </div>

              {/* Editable fields */}
              <div className="space-y-1">
                <Label className="text-gray-600 font-medium">
                  Travel Date *
                </Label>
                <Input
                  type="date"
                  value={formData.travelDate || ""}
                  data-testid="input-travel-date"
                  className="bg-gray-50 border border-gray-200 text-gray-500 rounded-lg py-2 px-3 focus:outline-none cursor-not-allowed"
                  disabled
                  readOnly
                />
              </div>

              <div className="space-y-1">
                <Label className="text-gray-600 font-medium">
                  Return Date *
                </Label>
                <Input
                  type="date"
                  value={formData.returnDate || ""}
                  onChange={(e) =>
                    handleInputChange("returnDate", e.target.value)
                  }
                  data-testid="input-return-date"
                  className="border-gray-300 rounded-lg py-2 px-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-gray-600 font-medium">
                  Destination *
                </Label>
                <Input
                  placeholder="Enter destination"
                  value={formData.destination || ""}
                  onChange={(e) =>
                    handleInputChange("destination", e.target.value)
                  }
                  data-testid="input-destination"
                  className="border-gray-300 rounded-lg py-2 px-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-gray-600 font-medium">
                  Purpose of Travel *
                </Label>
                <Input
                  placeholder="Enter purpose"
                  value={formData.purposeOfTravel || ""}
                  onChange={(e) =>
                    handleInputChange("purposeOfTravel", e.target.value)
                  }
                  data-testid="input-purpose"
                  className="border-gray-300 rounded-lg py-2 px-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-gray-600 font-medium">
                  Expected Completion Date *
                </Label>
                <Input
                  type="date"
                  value={formData.expectedCompletionDate || ""}
                  onChange={(e) =>
                    handleInputChange("expectedCompletionDate", e.target.value)
                  }
                  required
                  data-testid="input-expected-completion-date"
                  className="border-gray-300 rounded-lg py-2 px-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-gray-600 font-medium">
                  Expected Completion Time *
                </Label>
                <Input
                  type="time"
                  value={formData.expectedCompletionTime || ""}
                  onChange={(e) =>
                    handleInputChange("expectedCompletionTime", e.target.value)
                  }
                  required
                  data-testid="input-expected-completion-time"
                  className="border-gray-300 rounded-lg py-2 px-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="md:col-span-2 space-y-1">
                <Label className="text-gray-600 font-medium">
                  Amount *
                </Label>
                <Input
                  type="number"
                  placeholder="Enter amount"
                  value={formData.amount || ""}
                  onChange={(e) =>
                    handleInputChange("amount", e.target.value)
                  }
                  data-testid="input-amount"
                  className="border-gray-300 rounded-lg py-2 px-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="md:col-span-2 flex justify-end space-x-4 pt-6 border-t border-gray-200">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowTADAModal(false)}
                  data-testid="button-cancel-tada"
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  data-testid="button-submit-tada"
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm"
                >
                  {isSubmitting ? (
                    <span className="flex items-center">
                      <Loader2Icon className="animate-spin mr-2" />
                      Processing...
                    </span>
                  ) : (
                    "Submit"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </Modal>
    </div>
  );
}
