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

export default function CalibrationCertificate() {
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
  const [attachmentFile, setAttachmentFile] = useState(null);

  const fetchData = async () => {
    setFetchLoading(true);
    try {
      // Tickets ready for Calibration Certificate
      // (calibration.calibration_certificate_planned set).
      const { data: calibrationRows, error: calibrationError } = await supabase
        .from("calibration")
        .select("ticket_id, calibration_certificate_planned")
        .not("calibration_certificate_planned", "is", null);

      if (calibrationError) throw calibrationError;

      const ticketIds = [...new Set((calibrationRows || []).map((c) => c.ticket_id))];

      if (ticketIds.length === 0) {
        setPendingData([]);
        setHistoryData([]);
        return;
      }

      const { data: ticketsData, error: ticketsError } = await supabase
        .from("tickets")
        .select("*")
        .in("ticket_id", ticketIds)
        .order("created_at", { ascending: true });

      if (ticketsError) throw ticketsError;

      const { data: certificateRows, error: certificateError } = await supabase
        .from("calibration_certificate")
        .select("*")
        .in("ticket_id", ticketIds);

      if (certificateError) throw certificateError;

      const { data: quotationRows } = await supabase
        .from("quotation")
        .select("ticket_id, quotation_no, quotation_pdf_link")
        .in("ticket_id", ticketIds);

      const { data: invoiceFullRows } = await supabase
        .from("invoice")
        .select("ticket_id, invoice_no_nabl, invoice_no_service, invoice_no_spare, attachment_nabl, attachment_service, attachment_spear")
        .in("ticket_id", ticketIds);

      const certificateByTicket = new Map((certificateRows || []).map((c) => [c.ticket_id, c]));
      const quotationByTicket = new Map((quotationRows || []).map((q) => [q.ticket_id, q]));
      const invoiceByTicket = new Map((invoiceFullRows || []).map((i) => [i.ticket_id, i]));

      const pending = [];
      const history = [];

      (ticketsData || []).forEach((t) => {
        const q = quotationByTicket.get(t.ticket_id);
        const inv = invoiceByTicket.get(t.ticket_id);

        const base = {
          ticketId: t.ticket_id,
          ticketUuid: t.uuid,
          timeStemp: t.created_at || "",
          clientName: t.client_name || "",
          phoneNumber: t.phone_number || "",
          companyName: t.company_name || "",
          CREName: t.cre_name || "",
          quotationNo: q?.quotation_no || "",
          quotationPdfLink: q?.quotation_pdf_link || "",
          invoiceNo: inv?.invoice_no_nabl || inv?.invoice_no_service || inv?.invoice_no_spare || "",
          invoiceCopy: inv?.attachment_nabl || inv?.attachment_service || inv?.attachment_spear || "",
        };

        const cert = certificateByTicket.get(t.ticket_id);
        if (cert) {
          history.push({
            ...base,
            certificateTypeName: cert.certificate_type_name || "",
            numberOfCertificatesDocuments: cert.number_of_certificates_documents ?? "",
            fullDestinationAddress: cert.full_destination_address || "",
            dateOfDispatch: cert.date_of_dispatch || "",
            courierCompanyName: cert.courier_company_name || "",
            courierTrackingNumber: cert.courier_tracking_number || "",
            expectedDeliveryDate: cert.expected_delivery_date || "",
            attachment: cert.attachment || "",
            delayMinutes: cert.delay_minutes,
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
      certificateTypeName: "",
      numberOfCertificatesDocuments: "",
      fullDestinationAddress: "",
      dateOfDispatch: "",
      courierCompanyName: "",
      courierTrackingNumber: "",
      expectedDeliveryDate: "",
    });
    setAttachmentFile(null);
    setShowModal(true);
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const uploadToStorage = async (file) => {
    const path = `calibration_certificate/${selectedTicket?.ticketId}_${Date.now()}_${file.name}`;

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
    setAttachmentFile(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.certificateTypeName) {
      alert("Please enter Certificate Type/Name");
      return;
    }
    if (!formData.numberOfCertificatesDocuments) {
      alert("Please enter Number of Certificates/Documents");
      return;
    }
    if (!formData.dateOfDispatch) {
      alert("Please select Date of Dispatch");
      return;
    }
    if (!formData.courierCompanyName) {
      alert("Please enter Courier Company Name");
      return;
    }
    if (!formData.courierTrackingNumber) {
      alert("Please enter Courier Tracking Number");
      return;
    }
    if (!formData.fullDestinationAddress) {
      alert("Please enter Full Destination Address");
      return;
    }
    if (!formData.expectedDeliveryDate) {
      alert("Please select Expected Delivery Date");
      return;
    }
    if (!attachmentFile) {
      alert("Please select an Attachment file");
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload only now that Submit was actually clicked — nothing was
      // uploaded on file selection.
      const attachmentUrl = attachmentFile ? await uploadToStorage(attachmentFile) : null;

      const { error } = await supabase.from("calibration_certificate").insert({
        ticket_id: selectedTicket.ticketId,
        ticket_uuid: selectedTicket.ticketUuid,
        certificate_type_name: formData.certificateTypeName || null,
        number_of_certificates_documents: formData.numberOfCertificatesDocuments || null,
        full_destination_address: formData.fullDestinationAddress || null,
        date_of_dispatch: formData.dateOfDispatch || null,
        courier_company_name: formData.courierCompanyName || null,
        courier_tracking_number: formData.courierTrackingNumber || null,
        expected_delivery_date: formData.expectedDeliveryDate || null,
        attachment: attachmentUrl,
        // No <next_stage>_planned column — nothing comes after this stage yet.
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Calibration certificate details saved successfully",
      });

      setShowModal(false);
      fetchData();
    } catch (error) {
      console.error("Error submitting calibration certificate:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save calibration certificate details",
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
  // convention, matching predecessor Calibration. See
  // calibration_certificate.delay_minutes.
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
        String(item.quotationNo || "").toLowerCase().includes(q) ||
        String(item.invoiceNo || "").toLowerCase().includes(q)
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
        String(item.quotationNo || "").toLowerCase().includes(q) ||
        String(item.invoiceNo || "").toLowerCase().includes(q)
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
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Quotation Number</th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Quotation Copy</th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Invoice Number</th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Invoice Copy</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-blue-100">
                        {filteredPendingData.length === 0 ? (
                          <tr>
                            <td colSpan={10} className="text-center py-8 bg-white" data-testid="text-no-pending">
                              {fetchLoading ? (
                                <div className="flex justify-center items-center text-blue-700">
                                  <LoaderIcon className="animate-spin w-8 h-8" />
                                </div>
                              ) : (
                                <h1 className="text-blue-700">No pending calibration certificates found.</h1>
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
                                  data-testid={`button-certificate-${ticket.ticketId}`}
                                >
                                  <span className="font-medium">Process</span>
                                </Button>
                              </td>
                              <td className="px-4 py-3 text-blue-900">{formatDate(ticket.timeStemp)}</td>
                              <td className="px-4 py-3 font-medium text-blue-800">{ticket.ticketId}</td>
                              <td className="px-4 py-3 text-blue-900">{ticket.companyName || "-"}</td>
                              <td className="px-4 py-3 text-blue-900">{ticket.clientName}</td>
                              <td className="px-4 py-3 text-blue-900">{ticket.phoneNumber}</td>
                              <td className="px-4 py-3 text-blue-900 font-medium">{ticket.quotationNo || "-"}</td>
                              <td className="px-4 py-3">
                                {ticket.quotationPdfLink ? (
                                  <a
                                    href={ticket.quotationPdfLink}
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
                              <td className="px-4 py-3 text-blue-900 font-medium">{ticket.invoiceNo || "-"}</td>
                              <td className="px-4 py-3">
                                {ticket.invoiceCopy ? (
                                  <a
                                    href={ticket.invoiceCopy}
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
                            <h1 className="text-blue-700">No pending calibration certificates found.</h1>
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
                                  <p className="text-gray-500 font-medium">Quotation No.</p>
                                  <p className="text-blue-900">{ticket.quotationNo || "N/A"}</p>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <p className="text-gray-500 font-medium">Invoice No.</p>
                                  <p className="text-blue-900">{ticket.invoiceNo || "N/A"}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500 font-medium">Quotation Copy</p>
                                  {ticket.quotationPdfLink ? (
                                    <a href={ticket.quotationPdfLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">View</a>
                                  ) : "N/A"}
                                </div>
                              </div>
                              {ticket.invoiceCopy && (
                                <div className="text-sm">
                                  <p className="text-gray-500 font-medium">Invoice Copy</p>
                                  <a href={ticket.invoiceCopy} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">View</a>
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
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Quotation Number</th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Quotation Copy</th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Invoice Number</th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Invoice Copy</th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Certificate Type/Name</th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">No. of Certificates</th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[200px] sticky top-0">Destination Address</th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Date of Dispatch</th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Courier Company</th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Tracking No.</th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Expected Delivery</th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[120px] sticky top-0">Attachment</th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[120px] sticky top-0">Delay</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-blue-100">
                        {filteredHistoryData.length === 0 ? (
                          <tr>
                            <td colSpan={18} className="text-center py-8 bg-white" data-testid="text-no-history">
                              {fetchLoading ? (
                                <div className="flex justify-center items-center text-blue-700">
                                  <LoaderIcon className="animate-spin w-8 h-8" />
                                </div>
                              ) : (
                                <h1 className="text-blue-700">No calibration certificate history found.</h1>
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
                              <td className="px-4 py-3 text-blue-900 font-medium">{ticket.quotationNo || "-"}</td>
                              <td className="px-4 py-3">
                                {ticket.quotationPdfLink ? (
                                  <a
                                    href={ticket.quotationPdfLink}
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
                              <td className="px-4 py-3 text-blue-900 font-medium">{ticket.invoiceNo || "-"}</td>
                              <td className="px-4 py-3">
                                {ticket.invoiceCopy ? (
                                  <a
                                    href={ticket.invoiceCopy}
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
                              <td className="px-4 py-3 text-blue-900">{ticket.certificateTypeName}</td>
                              <td className="px-4 py-3 text-blue-900">{ticket.numberOfCertificatesDocuments}</td>
                              <td className="px-4 py-3 text-blue-900 truncate max-w-xs hover:whitespace-normal">{ticket.fullDestinationAddress}</td>
                              <td className="px-4 py-3 text-blue-900">{formatDate(ticket.dateOfDispatch) || ""}</td>
                              <td className="px-4 py-3 text-blue-900">{ticket.courierCompanyName}</td>
                              <td className="px-4 py-3 text-blue-900">{ticket.courierTrackingNumber}</td>
                              <td className="px-4 py-3 text-blue-900">{formatDate(ticket.expectedDeliveryDate) || ""}</td>
                              <td className="px-4 py-3">
                                {ticket.attachment ? (
                                  <a
                                    href={ticket.attachment}
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
                            <h1 className="text-blue-700">No calibration certificate history found.</h1>
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
                                  <p className="text-gray-500 font-medium">Quotation No.</p>
                                  <p className="text-blue-900">{ticket.quotationNo || "N/A"}</p>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <p className="text-gray-500 font-medium">Invoice No.</p>
                                  <p className="text-blue-900">{ticket.invoiceNo || "N/A"}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500 font-medium">Quotation Copy</p>
                                  {ticket.quotationPdfLink ? (
                                    <a href={ticket.quotationPdfLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">View</a>
                                  ) : "N/A"}
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <p className="text-gray-500 font-medium">Certificate Type</p>
                                  <p className="text-blue-900">{ticket.certificateTypeName || "N/A"}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500 font-medium">No. of Certificates</p>
                                  <p className="text-blue-900">{ticket.numberOfCertificatesDocuments || "N/A"}</p>
                                </div>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium text-sm">Destination Address</p>
                                <p className="text-blue-900 line-clamp-2">{ticket.fullDestinationAddress || "N/A"}</p>
                              </div>
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <p className="text-gray-500 font-medium">Dispatch Date</p>
                                  <p className="text-blue-900">{formatDate(ticket.dateOfDispatch) || "N/A"}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500 font-medium">Courier Company</p>
                                  <p className="text-blue-900">{ticket.courierCompanyName || "N/A"}</p>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <p className="text-gray-500 font-medium">Tracking Number</p>
                                  <p className="text-blue-900">{ticket.courierTrackingNumber || "N/A"}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500 font-medium">Expected Delivery</p>
                                  <p className="text-blue-900">{formatDate(ticket.expectedDeliveryDate) || "N/A"}</p>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <p className="text-gray-500 font-medium">Attachment</p>
                                  {ticket.attachment ? (
                                    <a
                                      href={ticket.attachment}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:text-blue-800 text-sm"
                                    >
                                      View
                                    </a>
                                  ) : (
                                    <p className="text-blue-900 text-sm">N/A</p>
                                  )}
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

      {/* Calibration Certificate Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Calibration Certificate"
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
            <Label>Certificate Type/Name *</Label>
            <Input
              placeholder="Enter certificate type"
              value={formData.certificateTypeName || ""}
              onChange={(e) => handleInputChange("certificateTypeName", e.target.value)}
              data-testid="input-certificate-type"
              required
            />
          </div>
          <div>
            <Label>Number of Certificates/Documents *</Label>
            <Input
              type="number"
              min="0"
              placeholder="Enter number"
              value={formData.numberOfCertificatesDocuments || ""}
              onChange={(e) => handleInputChange("numberOfCertificatesDocuments", e.target.value)}
              data-testid="input-certificate-count"
              required
            />
          </div>
          <div>
            <Label>Date of Dispatch *</Label>
            <Input
              type="date"
              value={formData.dateOfDispatch || ""}
              onChange={(e) => handleInputChange("dateOfDispatch", e.target.value)}
              data-testid="input-dispatch-date"
              required
            />
          </div>
          <div>
            <Label>Courier Company Name *</Label>
            <Input
              placeholder="Enter courier company"
              value={formData.courierCompanyName || ""}
              onChange={(e) => handleInputChange("courierCompanyName", e.target.value)}
              data-testid="input-courier-company"
              required
            />
          </div>
          <div>
            <Label>Courier Tracking Number *</Label>
            <Input
              placeholder="Enter tracking number"
              value={formData.courierTrackingNumber || ""}
              onChange={(e) => handleInputChange("courierTrackingNumber", e.target.value)}
              data-testid="input-tracking-number"
              required
            />
          </div>
          <div className="md:col-span-2">
            <Label>Full Destination Address *</Label>
            <Input
              placeholder="Enter full address"
              value={formData.fullDestinationAddress || ""}
              onChange={(e) => handleInputChange("fullDestinationAddress", e.target.value)}
              data-testid="input-destination-address"
              required
            />
          </div>
          <div>
            <Label>Expected Delivery Date *</Label>
            <Input
              type="date"
              value={formData.expectedDeliveryDate || ""}
              onChange={(e) => handleInputChange("expectedDeliveryDate", e.target.value)}
              data-testid="input-delivery-date"
              required
            />
          </div>
          <div>
            <Label>Attachment *</Label>
            <Input
              type="file"
              onChange={handleFileSelect}
              disabled={isSubmitting}
              data-testid="input-attachment"
              required
            />
            {attachmentFile && (
              <p className="text-xs text-emerald-700 mt-1 truncate">Selected: {attachmentFile.name}</p>
            )}
          </div>

          <div className="md:col-span-2 flex space-x-4 pt-4">
            <Button
              type="submit"
              disabled={isSubmitting}
              data-testid="button-submit-certificate"
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
              data-testid="button-cancel-certificate"
            >
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
