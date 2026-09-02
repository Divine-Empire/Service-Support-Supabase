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
import { Loader2Icon, LoaderIcon } from "lucide-react";
import { supabase } from "../lib/supabase/client";

export default function SpareDispatchDetails() {
  const [activeTab, setActiveTab] = useState("pending");
  const [showModal, setShowModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [formData, setFormData] = useState({});
  const [searchItem, setSearchItem] = useState("");
  const { toast } = useToast();

  const [pendingData, setPendingData] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // File is only HELD here on selection — actual upload happens at submit
  // time in handleSubmit, so cancelling the form never leaves an orphaned
  // upload behind, and nothing hits Storage until Submit is clicked.
  const [biltyCopyFile, setBiltyCopyFile] = useState(null);

  const fetchData = async () => {
    setFetchLoading(true);
    try {
      // Tickets ready for Spare Dispatch Details (invoice.spare_dispatch_planned
      // set — only true when tickets.enquiry_type = 'SPARE').
      const { data: invoiceRows, error: invoiceError } = await supabase
        .from("sss_invoice")
        .select("ticket_id, spare_dispatch_planned")
        .not("spare_dispatch_planned", "is", null);

      if (invoiceError) throw invoiceError;

      const ticketIds = [...new Set((invoiceRows || []).map((i) => i.ticket_id))];

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

      const { data: invoiceFullRows } = await supabase
        .from("sss_invoice")
        .select("ticket_id, invoice_no_spare, attachment_spear, invoice_no_service, attachment_service, invoice_no_nabl, attachment_nabl")
        .in("ticket_id", ticketIds);

      const { data: dispatchRows, error: dispatchError } = await supabase
        .from("sss_spare_dispatch_details")
        .select("*")
        .in("ticket_id", ticketIds);

      if (dispatchError) throw dispatchError;

      const invoiceByTicket = new Map((invoiceFullRows || []).map((i) => [i.ticket_id, i]));
      const dispatchByTicket = new Map((dispatchRows || []).map((d) => [d.ticket_id, d]));

      const pending = [];
      const history = [];

      (ticketsData || []).forEach((t) => {
        const inv = invoiceByTicket.get(t.ticket_id);

        const base = {
          ticketId: t.ticket_id,
          ticketUuid: t.uuid,
          timeStemp: t.created_at || "",
          clientName: t.client_name || "",
          phoneNumber: t.phone_number || "",
          companyName: t.company_name || "",
          mentionIssue: t.mention_issue || "",
          CREName: t.cre_name || "",
          invoiceNoSpare: inv?.invoice_no_spare || inv?.invoice_no_service || inv?.invoice_no_nabl || "",
          attachmentSpear: inv?.attachment_spear || inv?.attachment_service || inv?.attachment_nabl || "",
        };

        const d = dispatchByTicket.get(t.ticket_id);
        if (d) {
          history.push({
            ...base,
            transporterName: d.transporter_name || "",
            docketBiltyNo: d.docket_bilty_no || "",
            dispatchDate: d.dispatch_date || "",
            courierTransportDetails: d.courier_transport_details || "",
            biltyCopyAttachment: d.bilty_copy_attachment || "",
            delayMinutes: d.delay_minutes,
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

  const handleClick = (ticket) => {
    setSelectedTicket(ticket);
    setFormData({
      ticketId: ticket.ticketId,
      clientName: ticket.clientName,
      phoneNumber: ticket.phoneNumber,
      companyName: ticket.companyName || "",
      transporterName: "",
      docketBiltyNo: "",
      dispatchDate: "",
      courierTransportDetails: "",
    });
    setBiltyCopyFile(null);
    setShowModal(true);
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const uploadToStorage = async (file) => {
    const path = `spare_dispatch/${selectedTicket?.ticketId}_${Date.now()}_${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("ticket_enquiry")
      .upload(path, file, { contentType: file.type });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from("ticket_enquiry").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setBiltyCopyFile(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.transporterName) {
      alert("Please enter Transporter Name");
      return;
    }
    if (!formData.docketBiltyNo) {
      alert("Please enter Docket/Bilty No.");
      return;
    }
    if (!formData.dispatchDate) {
      alert("Please select Dispatch Date");
      return;
    }
    if (!biltyCopyFile) {
      alert("Please select a Bilty Copy file");
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload only now that Submit was actually clicked — nothing was
      // uploaded on file selection.
      const biltyCopyUrl = biltyCopyFile ? await uploadToStorage(biltyCopyFile) : null;

      const { error } = await supabase.from("sss_spare_dispatch_details").insert({
        ticket_id: selectedTicket.ticketId,
        ticket_uuid: selectedTicket.ticketUuid,
        transporter_name: formData.transporterName || null,
        docket_bilty_no: formData.docketBiltyNo || null,
        dispatch_date: formData.dispatchDate || null,
        courier_transport_details: formData.courierTransportDetails || null,
        bilty_copy_attachment: biltyCopyUrl,
        // No <next_stage>_planned column — nothing comes after this stage yet.
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Spare dispatch details saved successfully",
      });

      setShowModal(false);
      fetchData();
    } catch (error) {
      console.error("Error submitting spare dispatch details:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save spare dispatch details",
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
  // convention, matching predecessor Invoice. See
  // spare_dispatch_details.delay_minutes.
  const formatDelay = (minutes) => {
    if (minutes === null || minutes === undefined) return "-";
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
        String(item.phoneNumber || "").toLowerCase().includes(q) ||
        String(item.mentionIssue || "").toLowerCase().includes(q) ||
        String(item.invoiceNoSpare || "").toLowerCase().includes(q)
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
        String(item.phoneNumber || "").toLowerCase().includes(q) ||
        String(item.mentionIssue || "").toLowerCase().includes(q) ||
        String(item.invoiceNoSpare || "").toLowerCase().includes(q)
      );
    })
    .reverse();

  const userName = localStorage.getItem("currentUsername");
  const roleStorage = localStorage.getItem("o2d-auth-storage");
  const parsedData = roleStorage ? JSON.parse(roleStorage) : null;
  const role = parsedData?.state?.user?.role;

  const filteredPendingData = role === "user"
    ? filteredPendingDataa.filter((item) => item.CREName === userName)
    : filteredPendingDataa;

  const filteredHistoryData = role === "user"
    ? filteredHistoryDataa.filter((item) => item.CREName === userName)
    : filteredHistoryDataa;

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
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[120px] sticky top-0">Action</th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Date</th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[120px] sticky top-0">Ticket ID</th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[200px] sticky top-0">Company Name</th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Person Name</th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Phone Number</th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[200px] sticky top-0">Issue</th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Spare Invoice No.</th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Spare Invoice Copy</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-blue-100">
                        {filteredPendingData.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="text-center py-8 bg-white" data-testid="text-no-pending">
                              {fetchLoading ? (
                                <div className="flex justify-center items-center text-blue-700">
                                  <LoaderIcon className="animate-spin w-8 h-8" />
                                </div>
                              ) : (
                                <h1 className="text-blue-700">No pending spare dispatches found.</h1>
                              )}
                            </td>
                          </tr>
                        ) : (
                          filteredPendingData.map((ticket, ind) => (
                            <tr key={ticket.ticketId} className={ind % 2 === 0 ? "bg-blue-50/50" : "bg-white"}>
                              <td className="px-4 py-3">
                                <Button
                                  size="sm"
                                  onClick={() => handleClick(ticket)}
                                  variant="outline"
                                  className="bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-600 hover:from-blue-100 hover:to-indigo-100 hover:text-blue-700 transition-all duration-300 border border-blue-200 hover:border-blue-300 rounded-lg px-3 py-1.5 shadow-sm hover:shadow-md group"
                                  data-testid={`button-dispatch-${ticket.ticketId}`}
                                >
                                  <span className="font-medium">Process</span>
                                </Button>
                              </td>
                              <td className="px-4 py-3 text-blue-900">{formatDate(ticket.timeStemp)}</td>
                              <td className="px-4 py-3 font-medium text-blue-800">{ticket.ticketId}</td>
                              <td className="px-4 py-3 text-blue-900">{ticket.companyName || "-"}</td>
                              <td className="px-4 py-3 text-blue-900">{ticket.clientName}</td>
                              <td className="px-4 py-3 text-blue-900">{ticket.phoneNumber}</td>
                              <td className="px-4 py-3 text-blue-900 truncate max-w-xs hover:whitespace-normal">{ticket.mentionIssue || "-"}</td>
                              <td className="px-4 py-3 text-blue-900 font-medium">{ticket.invoiceNoSpare || "-"}</td>
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
                                  "-"
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
                        <div className="text-center py-8 bg-white" data-testid="text-no-pending">
                          {fetchLoading ? (
                            <div className="flex justify-center items-center text-blue-700">
                              <LoaderIcon className="animate-spin w-8 h-8" />
                            </div>
                          ) : (
                            <h1 className="text-blue-700">No pending spare dispatches found.</h1>
                          )}
                        </div>
                      ) : (
                        filteredPendingData.map((ticket, ind) => (
                          <Card
                            key={ticket.ticketId}
                            className={`${ind % 2 === 0 ? "bg-blue-50/50" : "bg-white"} border-l-4 border-l-blue-500`}
                          >
                            <CardContent className="p-4 space-y-3">
                              <div className="flex justify-between items-start">
                                <div>
                                  <h3 className="font-bold text-blue-800 text-lg">{ticket.ticketId}</h3>
                                  <p className="text-sm text-gray-600 font-medium">Company: {ticket.companyName || "N/A"}</p>
                                  <p className="text-sm text-gray-600">Person: {ticket.clientName}</p>
                                </div>
                                <Button
                                  size="sm"
                                  onClick={() => handleClick(ticket)}
                                  variant="outline"
                                  className="bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-600 hover:from-blue-100 hover:to-indigo-100 border border-blue-200"
                                >
                                  Process
                                </Button>
                              </div>
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <p className="text-gray-500 font-medium">Phone</p>
                                  <p className="text-blue-900">{ticket.phoneNumber}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500 font-medium">Spare Invoice No.</p>
                                  <p className="text-blue-900">{ticket.invoiceNoSpare || "N/A"}</p>
                                </div>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium text-sm">Issue</p>
                                <p className="text-blue-900 line-clamp-2">{ticket.mentionIssue || "N/A"}</p>
                              </div>
                              {ticket.attachmentSpear && (
                                <div className="text-sm">
                                  <p className="text-gray-500 font-medium">Spare Invoice Copy</p>
                                  <a href={ticket.attachmentSpear} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">View</a>
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

              <TabsContent value="history" className="mt-0">
                <div className="relative overflow-x-auto">
                  <div className="max-h-[calc(103vh-200px)] overflow-y-auto">
                    <table className="hidden sm:block w-full">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-gradient-to-r from-blue-600 to-indigo-600">
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Date</th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[120px] sticky top-0">Ticket ID</th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[200px] sticky top-0">Company Name</th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Person Name</th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Phone Number</th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[200px] sticky top-0">Issue</th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Spare Invoice No.</th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Spare Invoice Copy</th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Transporter Name</th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Docket/Bilty No.</th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Dispatch Date</th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[200px] sticky top-0">Courier/Transport Details</th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Bilty Copy</th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[120px] sticky top-0">Delay</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-blue-100">
                        {filteredHistoryData.length === 0 ? (
                          <tr>
                            <td colSpan={14} className="text-center py-8 bg-white" data-testid="text-no-history">
                              {fetchLoading ? (
                                <div className="flex justify-center items-center text-blue-700">
                                  <LoaderIcon className="animate-spin w-8 h-8" />
                                </div>
                              ) : (
                                <h1 className="text-blue-700">No spare dispatch history found.</h1>
                              )}
                            </td>
                          </tr>
                        ) : (
                          filteredHistoryData.map((ticket, ind) => (
                            <tr key={ind} className={ind % 2 === 0 ? "bg-blue-50/50" : "bg-white"}>
                              <td className="px-4 py-3 text-blue-900">{formatDate(ticket.timeStemp)}</td>
                              <td className="px-4 py-3 font-medium text-blue-800">{ticket.ticketId}</td>
                              <td className="px-4 py-3 text-blue-900">{ticket.companyName || "-"}</td>
                              <td className="px-4 py-3 text-blue-900">{ticket.clientName}</td>
                              <td className="px-4 py-3 text-blue-900">{ticket.phoneNumber}</td>
                              <td className="px-4 py-3 text-blue-900 truncate max-w-xs hover:whitespace-normal">{ticket.mentionIssue || "-"}</td>
                              <td className="px-4 py-3 text-blue-900 font-medium">{ticket.invoiceNoSpare || "-"}</td>
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
                                  "-"
                                )}
                              </td>
                              <td className="px-4 py-3 text-blue-900">{ticket.transporterName}</td>
                              <td className="px-4 py-3 text-blue-900">{ticket.docketBiltyNo}</td>
                              <td className="px-4 py-3 text-blue-900">{formatDate(ticket.dispatchDate) || ""}</td>
                              <td className="px-4 py-3 text-blue-900 truncate max-w-xs hover:whitespace-normal">{ticket.courierTransportDetails}</td>
                              <td className="px-4 py-3">
                                {ticket.biltyCopyAttachment ? (
                                  <a
                                    href={ticket.biltyCopyAttachment}
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
                        <div className="text-center py-8 bg-white" data-testid="text-no-history">
                          {fetchLoading ? (
                            <div className="flex justify-center items-center text-blue-700">
                              <LoaderIcon className="animate-spin w-8 h-8" />
                            </div>
                          ) : (
                            <h1 className="text-blue-700">No spare dispatch history found.</h1>
                          )}
                        </div>
                      ) : (
                        filteredHistoryData.map((ticket, ind) => (
                          <Card
                            key={ind}
                            className={`${ind % 2 === 0 ? "bg-blue-50/50" : "bg-white"} border-l-4 border-l-blue-500`}
                          >
                            <CardContent className="p-4 space-y-3">
                              <div>
                                <h3 className="font-bold text-blue-800 text-lg">{ticket.ticketId}</h3>
                                <p className="text-sm text-gray-600 font-medium">Company: {ticket.companyName || "N/A"}</p>
                                <p className="text-sm text-gray-600">Person: {ticket.clientName}</p>
                              </div>
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <p className="text-gray-500 font-medium">Phone</p>
                                  <p className="text-blue-900">{ticket.phoneNumber}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500 font-medium">Spare Invoice No.</p>
                                  <p className="text-blue-900">{ticket.invoiceNoSpare || "N/A"}</p>
                                </div>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium text-sm">Issue</p>
                                <p className="text-blue-900 line-clamp-2">{ticket.mentionIssue || "N/A"}</p>
                              </div>
                              {ticket.attachmentSpear && (
                                <div className="text-sm">
                                  <p className="text-gray-500 font-medium">Spare Invoice Copy</p>
                                  <a href={ticket.attachmentSpear} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">View</a>
                                </div>
                              )}
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <p className="text-gray-500 font-medium">Transporter Name</p>
                                  <p className="text-blue-900">{ticket.transporterName || "N/A"}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500 font-medium">Docket/Bilty No.</p>
                                  <p className="text-blue-900">{ticket.docketBiltyNo || "N/A"}</p>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <p className="text-gray-500 font-medium">Dispatch Date</p>
                                  <p className="text-blue-900">{formatDate(ticket.dispatchDate) || "N/A"}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500 font-medium">Delay</p>
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
                              <div>
                                <p className="text-gray-500 font-medium text-sm">Courier/Transport Details</p>
                                <p className="text-blue-900 line-clamp-2">{ticket.courierTransportDetails || "N/A"}</p>
                              </div>
                              {ticket.biltyCopyAttachment && (
                                <div>
                                  <p className="text-gray-500 font-medium text-sm">Bilty Copy</p>
                                  <a
                                    href={ticket.biltyCopyAttachment}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 text-sm"
                                  >
                                    View File
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

      {/* Spare Dispatch Details Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Spare Dispatch Details"
        size="2xl"
      >
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <Label>Company Name</Label>
            <Input value={formData.companyName || ""} disabled className="bg-slate-50" />
          </div>

          <div>
            <Label>Transporter Name *</Label>
            <Input
              placeholder="Enter transporter name"
              value={formData.transporterName || ""}
              onChange={(e) => handleInputChange("transporterName", e.target.value)}
              data-testid="input-transporter-name"
            />
          </div>
          <div>
            <Label>Docket/Bilty No. *</Label>
            <Input
              placeholder="Enter docket/bilty no."
              value={formData.docketBiltyNo || ""}
              onChange={(e) => handleInputChange("docketBiltyNo", e.target.value)}
              data-testid="input-docket-bilty-no"
            />
          </div>
          <div>
            <Label>Dispatch Date *</Label>
            <Input
              type="date"
              value={formData.dispatchDate || ""}
              onChange={(e) => handleInputChange("dispatchDate", e.target.value)}
              data-testid="input-dispatch-date"
            />
          </div>
          <div>
            <Label>Courier/Transport Details</Label>
            <Input
              placeholder="Enter courier/transport details"
              value={formData.courierTransportDetails || ""}
              onChange={(e) => handleInputChange("courierTransportDetails", e.target.value)}
              data-testid="input-courier-transport-details"
            />
          </div>
          <div className="md:col-span-2">
            <Label>Bilty Copy Upload *</Label>
            <Input
              type="file"
              onChange={handleFileSelect}
              disabled={isSubmitting}
              data-testid="input-bilty-copy"
              required
            />
            {biltyCopyFile && (
              <p className="text-xs text-emerald-700 mt-1 truncate">Selected: {biltyCopyFile.name}</p>
            )}
          </div>

          <div className="md:col-span-2 flex space-x-4 pt-4">
            <Button
              type="submit"
              disabled={isSubmitting}
              data-testid="button-submit-dispatch"
              className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-70 disabled:transform-none"
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
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowModal(false)}
              data-testid="button-cancel-dispatch"
            >
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
