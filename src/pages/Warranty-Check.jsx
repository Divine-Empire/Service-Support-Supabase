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
import { LoaderIcon, Eye, FileText, Loader2Icon } from "lucide-react";
import { supabase } from "../lib/supabase/client";
import { computeStagePlanned } from "../lib/supabase/stagePlanning";

export default function WarrantyCheck() {
  const [activeTab, setActiveTab] = useState("pending");
  const [showModal, setShowModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [formData, setFormData] = useState({
    warrantyCheck: "",
    billNumber: "",
    billAttachment: null,
  });

  const [pendingData, setPendingData] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchItem, setSearchItem] = useState("");
  const { toast } = useToast();

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const fetchData = async () => {
    setFetchLoading(true);
    try {
      const { data: ticketsData, error: ticketsError } = await supabase
        .from("tickets")
        .select("*")
        .not("warranty_check_planned", "is", null)
        .order("created_at", { ascending: true });

      if (ticketsError) throw ticketsError;

      const { data: warrantyData, error: warrantyError } = await supabase
        .from("warranty_check")
        .select("*");

      if (warrantyError) throw warrantyError;

      const warrantyByTicket = new Map(
        (warrantyData || []).map((w) => [w.ticket_id, w])
      );

      const pending = [];
      const history = [];

      (ticketsData || []).forEach((t) => {
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
          videoCall: t.video_call || "",
        };

        const w = warrantyByTicket.get(t.ticket_id);
        if (w) {
          history.push({
            ...base,
            actual3: w.created_at || "",
            warrantyCheck: w.warranty_check || "",
            billNumber: w.bill_number || "",
            billAttachment: w.bill_attachment || "",
            delayMinutes: w.delay_minutes,
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

  const handleProcessClick = (ticket) => {
    setSelectedTicket(ticket);
    setFormData({
      warrantyCheck: "",
      billNumber: "",
      billAttachment: null,
    });
    setShowModal(true);
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const uploadBillAttachment = async (file) => {
    const path = `warranty/${selectedTicket?.ticketId}_${Date.now()}_${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("ticket_enquiry")
      .upload(path, file, { contentType: file.type });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from("ticket_enquiry").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (!formData.warrantyCheck) {
      toast({
        title: "Validation Error",
        description: "Please select Warranty Check option.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    if (formData.warrantyCheck === "yes") {
      if (!formData.billNumber) {
        toast({
          title: "Validation Error",
          description: "Please enter the Bill Number.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }
      if (!formData.billAttachment) {
        toast({
          title: "Validation Error",
          description: "Please attach the Bill file.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }
    }

    try {
      let billAttachmentUrl = "";
      if (formData.warrantyCheck === "yes" && formData.billAttachment) {
        billAttachmentUrl = await uploadBillAttachment(formData.billAttachment);
      }

      const submittedAt = new Date();

      // Warranty-Check branches into exactly one of three outcomes — see
      // stagePlanning.js: service_location='Warehouse' wins first, then
      // video_call='Yes', then a direct-to-Quotation fallback. Only one of
      // these three ever comes back non-null.
      const planningCtx = { ticket: selectedTicket, warrantyCheckSubmittedAt: submittedAt };
      const warehousePlanned = await computeStagePlanned("warehouse", planningCtx);
      const videoCallPlanned = await computeStagePlanned("videoCall", planningCtx);
      const quotationPlanned = await computeStagePlanned("quotationDirect", planningCtx);

      const { error } = await supabase.from("warranty_check").insert({
        ticket_id: selectedTicket.ticketId,
        ticket_uuid: selectedTicket.ticketUuid,
        warranty_check: formData.warrantyCheck,
        bill_number: formData.warrantyCheck === "yes" ? formData.billNumber : "",
        bill_attachment: formData.warrantyCheck === "yes" ? billAttachmentUrl : "",
        // Mutually exclusive — exactly one of these three is non-null. See
        // stagePlanning.js's warehouse/videoCall/quotationDirect rules.
        warehouse_planned: warehousePlanned,
        video_call_planned: videoCallPlanned,
        quotation_planned: quotationPlanned,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Warranty check submitted successfully",
      });
      setShowModal(false);
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

  const filteredPendingDataa = pendingData
    .filter((item) => {
      const q = searchItem.toLowerCase();
      return (
        String(item.ticketId || "").toLowerCase().includes(q) ||
        String(item.clientName || "").toLowerCase().includes(q) ||
        String(item.companyName || "").toLowerCase().includes(q) ||
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
        String(item.phoneNumber || "").toLowerCase().includes(q)
      );
    })
    .reverse();

  const userName = localStorage.getItem("currentUsername");
  const roleStorage = localStorage.getItem("o2d-auth-storage");
  let role = "admin";
  try {
    if (roleStorage) {
      const parsedData = JSON.parse(roleStorage);
      role = parsedData.state.user.role;
    }
  } catch (e) {
    console.error("Error parsing role storage", e);
  }

  const filteredPendingData =
    role === "user"
      ? filteredPendingDataa.filter((item) => item.CREName === userName)
      : role === "engineer"
      ? filteredPendingDataa.filter((item) => item.engineerAssign === userName)
      : filteredPendingDataa;

  const filteredHistoryData =
    role === "user"
      ? filteredHistoryDataa.filter((item) => item.CREName === userName)
      : role === "engineer"
      ? filteredHistoryDataa.filter((item) => item.engineerAssign === userName)
      : filteredHistoryDataa;

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
                  <table className="hidden sm:table w-full">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                        <th className="border-b border-blue-500 px-4 py-3 text-left w-[120px] sticky top-0">Action</th>
                        <th className="border-b border-blue-500 px-4 py-3 text-left w-[120px] sticky top-0">Date</th>
                        <th className="border-b border-blue-500 px-4 py-3 text-left w-[120px] sticky top-0">Ticket-ID</th>
                        <th className="border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Source of enquiry</th>
                        <th className="border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Call type</th>
                        <th className="border-b border-blue-500 px-4 py-3 text-left w-[180px] sticky top-0">Enquiry Receiver Name</th>
                        <th className="border-b border-blue-500 px-4 py-3 text-left w-[120px] sticky top-0">Client Type</th>
                        <th className="border-b border-blue-500 px-4 py-3 text-left w-[180px] sticky top-0">Company Name</th>
                        <th className="border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Client Name</th>
                        <th className="border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Phone Number</th>
                        <th className="border-b border-blue-500 px-4 py-3 text-left w-[200px] sticky top-0">Site Address</th>
                        <th className="border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">GST No.</th>
                        <th className="border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Machine Name</th>
                        <th className="border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Category</th>
                        <th className="border-b border-blue-500 px-4 py-3 text-left w-[200px] sticky top-0">Mention Issue</th>
                        <th className="border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Service Location</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-blue-100">
                      {filteredPendingData.length === 0 ? (
                        <tr>
                          <td colSpan={16} className="text-center py-8 bg-white text-blue-700">
                            {fetchLoading ? (
                              <div className="flex justify-center items-center">
                                <LoaderIcon className="animate-spin w-8 h-8" />
                              </div>
                            ) : (
                              "No pending warranty checks found."
                            )}
                          </td>
                        </tr>
                      ) : (
                        filteredPendingData.map((ticket, ind) => (
                          <tr key={ind} className={ind % 2 === 0 ? "bg-blue-50/50" : "bg-white"}>
                            <td className="px-4 py-3">
                              <Button
                                size="sm"
                                onClick={() => handleProcessClick(ticket)}
                                variant="outline"
                                className="bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-600 hover:from-blue-100 hover:to-indigo-100 hover:text-blue-700 transition-all duration-300 border border-blue-200 hover:border-blue-300 rounded-lg px-3 py-1.5 shadow-sm hover:shadow-md"
                              >
                                <span className="font-medium">Process</span>
                              </Button>
                            </td>
                            <td className="px-4 py-3 text-blue-900">{formatDate(ticket.timeStemp)}</td>
                            <td className="px-4 py-3 font-medium text-blue-800">{ticket.ticketId}</td>
                            <td className="px-4 py-3 text-blue-900">{ticket.sourceOfEnquiry}</td>
                            <td className="px-4 py-3 text-blue-900">{ticket.callType}</td>
                            <td className="px-4 py-3 text-blue-900">{ticket.enquiryReceiverName}</td>
                            <td className="px-4 py-3 text-blue-900">{ticket.clientType}</td>
                            <td className="px-4 py-3 text-blue-900">{ticket.companyName}</td>
                            <td className="px-4 py-3 text-blue-900">{ticket.clientName}</td>
                            <td className="px-4 py-3 text-blue-900">{ticket.phoneNumber}</td>
                            <td className="px-4 py-3 text-blue-900">{ticket.siteAddress}</td>
                            <td className="px-4 py-3 text-blue-900">{ticket.gstNo}</td>
                            <td className="px-4 py-3 text-blue-900">{ticket.machineName}</td>
                            <td className="px-4 py-3 text-blue-900">{ticket.category}</td>
                            <td className="px-4 py-3 text-blue-900">{ticket.mentionIssue}</td>
                            <td className="px-4 py-3 text-blue-900">{ticket.serviceLocation}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>

                  {/* Mobile Layout */}
                  <div className="sm:hidden space-y-4">
                    {filteredPendingData.length === 0 ? (
                      <div className="text-center py-8 bg-white text-blue-700">
                        {fetchLoading ? (
                          <div className="flex justify-center items-center">
                            <LoaderIcon className="animate-spin w-8 h-8" />
                          </div>
                        ) : (
                          "No pending warranty checks found."
                        )}
                      </div>
                    ) : (
                      filteredPendingData.map((ticket, ind) => (
                        <Card key={ind} className={`${ind % 2 === 0 ? "bg-blue-50/50" : "bg-white"} border-l-4 border-l-blue-500`}>
                          <CardContent className="p-4 space-y-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <h3 className="font-bold text-blue-800 text-lg">{ticket.ticketId}</h3>
                                <p className="text-sm text-gray-500">{formatDate(ticket.timeStemp)}</p>
                              </div>
                              <Button
                                size="sm"
                                onClick={() => handleProcessClick(ticket)}
                                variant="outline"
                                className="bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-600 hover:from-blue-100 hover:to-indigo-100 border border-blue-200"
                              >
                                Process
                              </Button>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500 font-medium">Client Name</p>
                                <p className="text-blue-900">{ticket.clientName || "N/A"}</p>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">Company Name</p>
                                <p className="text-blue-900">{ticket.companyName || "N/A"}</p>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500 font-medium">Phone Number</p>
                                <p className="text-blue-900">{ticket.phoneNumber || "N/A"}</p>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">Client Type</p>
                                <p className="text-blue-900">{ticket.clientType || "N/A"}</p>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500 font-medium">Call Type</p>
                                <p className="text-blue-900">{ticket.callType || "N/A"}</p>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">Source of Enquiry</p>
                                <p className="text-blue-900">{ticket.sourceOfEnquiry || "N/A"}</p>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500 font-medium">Machine Name</p>
                                <p className="text-blue-900">{ticket.machineName || "N/A"}</p>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">Category</p>
                                <p className="text-blue-900">{ticket.category || "N/A"}</p>
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
                  <table className="hidden sm:table w-full">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                        <th className="border-b border-blue-500 px-4 py-3 text-left w-[120px] sticky top-0">Date</th>
                        <th className="border-b border-blue-500 px-4 py-3 text-left w-[120px] sticky top-0">Ticket-ID</th>
                        <th className="border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Source of enquiry</th>
                        <th className="border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Call type</th>
                        <th className="border-b border-blue-500 px-4 py-3 text-left w-[180px] sticky top-0">Enquiry Receiver Name</th>
                        <th className="border-b border-blue-500 px-4 py-3 text-left w-[120px] sticky top-0">Client Type</th>
                        <th className="border-b border-blue-500 px-4 py-3 text-left w-[180px] sticky top-0">Company Name</th>
                        <th className="border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Client Name</th>
                        <th className="border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Phone Number</th>
                        <th className="border-b border-blue-500 px-4 py-3 text-left w-[200px] sticky top-0">Site Address</th>
                        <th className="border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">GST No.</th>
                        <th className="border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Machine Name</th>
                        <th className="border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Category</th>
                        <th className="border-b border-blue-500 px-4 py-3 text-left w-[200px] sticky top-0">Mention Issue</th>
                        <th className="border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Service Location</th>
                        <th className="border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Warranty Check</th>
                        <th className="border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Bill Number</th>
                        <th className="border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Bill Copy</th>
                        <th className="border-b border-blue-500 px-4 py-3 text-left w-[120px] sticky top-0">Delay (min)</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-blue-100">
                      {filteredHistoryData.length === 0 ? (
                        <tr>
                          <td colSpan={19} className="text-center py-8 bg-white text-blue-700">
                            {fetchLoading ? (
                              <div className="flex justify-center items-center">
                                <LoaderIcon className="animate-spin w-8 h-8" />
                              </div>
                            ) : (
                              "No history found."
                            )}
                          </td>
                        </tr>
                      ) : (
                        filteredHistoryData.map((ticket, ind) => (
                          <tr key={ind} className={ind % 2 === 0 ? "bg-blue-50/50" : "bg-white"}>
                            <td className="px-4 py-3 text-blue-900">{formatDate(ticket.timeStemp)}</td>
                            <td className="px-4 py-3 font-medium text-blue-800">{ticket.ticketId}</td>
                            <td className="px-4 py-3 text-blue-900">{ticket.sourceOfEnquiry}</td>
                            <td className="px-4 py-3 text-blue-900">{ticket.callType}</td>
                            <td className="px-4 py-3 text-blue-900">{ticket.enquiryReceiverName}</td>
                            <td className="px-4 py-3 text-blue-900">{ticket.clientType}</td>
                            <td className="px-4 py-3 text-blue-900">{ticket.companyName}</td>
                            <td className="px-4 py-3 text-blue-900">{ticket.clientName}</td>
                            <td className="px-4 py-3 text-blue-900">{ticket.phoneNumber}</td>
                            <td className="px-4 py-3 text-blue-900">{ticket.siteAddress}</td>
                            <td className="px-4 py-3 text-blue-900">{ticket.gstNo}</td>
                            <td className="px-4 py-3 text-blue-900">{ticket.machineName}</td>
                            <td className="px-4 py-3 text-blue-900">{ticket.category}</td>
                            <td className="px-4 py-3 text-blue-900">{ticket.mentionIssue}</td>
                            <td className="px-4 py-3 text-blue-900">{ticket.serviceLocation}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  ticket.warrantyCheck === "yes"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-red-100 text-red-800"
                                }`}
                              >
                                {ticket.warrantyCheck === "yes" ? "Yes" : "No"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-blue-900">{ticket.billNumber || "N/A"}</td>
                            <td className="px-4 py-3">
                              {ticket.billAttachment ? (
                                <a
                                  href={ticket.billAttachment}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center text-blue-600 hover:text-blue-800 hover:underline gap-1 text-sm font-medium"
                                >
                                  <Eye className="w-4 h-4" />
                                  View Bill
                                </a>
                              ) : (
                                "N/A"
                              )}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.delayMinutes ?? "N/A"}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>

                  {/* Mobile Layout */}
                  <div className="sm:hidden space-y-4">
                    {filteredHistoryData.length === 0 ? (
                      <div className="text-center py-8 bg-white text-blue-700">
                        {fetchLoading ? (
                          <div className="flex justify-center items-center">
                            <LoaderIcon className="animate-spin w-8 h-8" />
                          </div>
                        ) : (
                          "No history found."
                        )}
                      </div>
                    ) : (
                      filteredHistoryData.map((ticket, ind) => (
                        <Card key={ind} className={`${ind % 2 === 0 ? "bg-blue-50/50" : "bg-white"} border-l-4 border-l-blue-500`}>
                          <CardContent className="p-4 space-y-3">
                            <div>
                              <h3 className="font-bold text-blue-800 text-lg">{ticket.ticketId}</h3>
                              <p className="text-sm text-gray-500">{formatDate(ticket.timeStemp)}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500 font-medium">Client Name</p>
                                <p className="text-blue-900">{ticket.clientName || "N/A"}</p>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">Company Name</p>
                                <p className="text-blue-900">{ticket.companyName || "N/A"}</p>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500 font-medium">Warranty Check</p>
                                <span
                                  className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                                    ticket.warrantyCheck === "yes"
                                      ? "bg-green-100 text-green-800"
                                      : "bg-red-100 text-red-800"
                                  }`}
                                >
                                  {ticket.warrantyCheck === "yes" ? "Yes" : "No"}
                                </span>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">Bill Number</p>
                                <p className="text-blue-900">{ticket.billNumber || "N/A"}</p>
                              </div>
                            </div>

                            {ticket.billAttachment && (
                              <div className="pt-2 border-t border-blue-100">
                                <a
                                  href={ticket.billAttachment}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center text-blue-600 hover:text-blue-800 gap-1 text-sm font-medium"
                                >
                                  <FileText className="w-4 h-4" />
                                  View Bill Copy
                                </a>
                              </div>
                            )}
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

      {/* Warranty Check Form Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          if (!isSubmitting) setShowModal(false);
        }}
        title="Warranty Check"
        size="lg"
      >
        <div className="bg-white rounded-lg">
          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Pre-filled info for context */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-gray-600 font-medium">Ticket ID</Label>
                  <Input
                    value={selectedTicket?.ticketId || ""}
                    disabled
                    className="bg-gray-50 border border-gray-200 text-gray-700 rounded-lg py-2 px-3 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-gray-600 font-medium">Client Name</Label>
                  <Input
                    value={selectedTicket?.clientName || ""}
                    disabled
                    className="bg-gray-50 border border-gray-200 text-gray-700 rounded-lg py-2 px-3 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-gray-600 font-medium">Phone Number</Label>
                  <Input
                    value={selectedTicket?.phoneNumber || ""}
                    disabled
                    className="bg-gray-50 border border-gray-200 text-gray-700 rounded-lg py-2 px-3 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-gray-600 font-medium">Machine Name</Label>
                  <Input
                    value={selectedTicket?.machineName || ""}
                    disabled
                    className="bg-gray-50 border border-gray-200 text-gray-700 rounded-lg py-2 px-3 focus:outline-none"
                  />
                </div>
              </div>

              {/* Editable Fields */}
              <div className="space-y-4 pt-4 border-t border-gray-100">
                <div className="space-y-1">
                  <Label className="text-gray-600 font-medium">
                    Warranty Check *
                  </Label>
                  <Select
                    value={formData.warrantyCheck}
                    onValueChange={(value) => handleInputChange("warrantyCheck", value)}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger className="border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                      <SelectValue placeholder="Select Yes/No" />
                    </SelectTrigger>
                    <SelectContent className="bg-white rounded-lg border-gray-200 shadow-lg">
                      <SelectItem value="yes" className="hover:bg-gray-50">
                        Yes
                      </SelectItem>
                      <SelectItem value="no" className="hover:bg-gray-50">
                        No
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.warrantyCheck === "yes" && (
                  <>
                    <div className="space-y-1">
                      <Label className="text-gray-600 font-medium">
                        Bill Number Input *
                      </Label>
                      <Input
                        placeholder="Enter bill number"
                        value={formData.billNumber}
                        onChange={(e) => handleInputChange("billNumber", e.target.value)}
                        disabled={isSubmitting}
                        required
                        className="border border-gray-300 rounded-lg py-2 px-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-gray-600 font-medium">
                        Bill Attachment *
                      </Label>
                      <Input
                        type="file"
                        onChange={(e) => handleInputChange("billAttachment", e.target.files[0] || null)}
                        disabled={isSubmitting}
                        required
                        className="border border-gray-300 rounded-lg py-2 px-3 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowModal(false)}
                  disabled={isSubmitting}
                  className="px-6 py-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg shadow-md hover:shadow-lg transition-all duration-300"
                >
                  {isSubmitting ? (
                    <span className="flex items-center">
                      <Loader2Icon className="animate-spin mr-2 w-4 h-4" />
                      Uploading & Submitting...
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
