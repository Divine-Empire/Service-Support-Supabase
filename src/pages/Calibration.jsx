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
import { computeStagePlanned } from "../lib/supabase/stagePlanning";

export default function Calibration() {
  const [activeTab, setActiveTab] = useState("pending");
  const [showCalibrationModal, setShowCalibrationModal] = useState(false);
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
  const [calibrationUploadFile, setCalibrationUploadFile] = useState(null);

  const fetchData = async () => {
    setFetchLoading(true);
    try {
      // Tickets ready for Calibration (invoice.calibration_planned set —
      // only true when tickets.enquiry_type = 'NABL').
      const { data: invoiceRows, error: invoiceError } = await supabase
        .from("invoice")
        .select("ticket_id, calibration_planned")
        .not("calibration_planned", "is", null);

      if (invoiceError) throw invoiceError;

      const ticketIds = [...new Set((invoiceRows || []).map((i) => i.ticket_id))];

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

      const { data: calibrationRows, error: calibrationError } = await supabase
        .from("calibration")
        .select("*")
        .in("ticket_id", ticketIds);

      if (calibrationError) throw calibrationError;

      const calibrationByTicket = new Map((calibrationRows || []).map((c) => [c.ticket_id, c]));

      const pending = [];
      const history = [];

      (ticketsData || []).forEach((t) => {
        const base = {
          ticketId: t.ticket_id,
          ticketUuid: t.uuid,
          timeStemp: t.created_at || "",
          clientName: t.client_name || "",
          phoneNumber: t.phone_number || "",
          companyName: t.company_name || "",
          CREName: t.cre_name || "",
        };

        const cal = calibrationByTicket.get(t.ticket_id);
        if (cal) {
          history.push({
            ...base,
            calibrationDate: cal.calibration_date || "",
            calibrationPeriodMonth: cal.calibration_period_month ?? "",
            calibrationDueDate: cal.calibration_due_date || "",
            calibrationUploadFile: cal.calibration_upload_file || "",
            delayMinutes: cal.delay_minutes,
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

  const handleCalibrationClick = (ticket) => {
    setSelectedTicket(ticket);
    setFormData({
      ticketId: ticket.ticketId,
      clientName: ticket.clientName,
      phoneNumber: ticket.phoneNumber,
      companyName: ticket.companyName || "",
      calibrationDate: "",
      calibrationPeriodMonth: "",
    });
    setCalibrationUploadFile(null);
    setShowCalibrationModal(true);
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Calibration Due Date is derived (calibration date + period in months) —
  // purely informational (when this calibration itself expires), not a
  // stage-gating column.
  const calibrationDueDate = (() => {
    if (!formData.calibrationDate || !formData.calibrationPeriodMonth) return "";
    const months = parseInt(formData.calibrationPeriodMonth, 10);
    if (isNaN(months) || months <= 0) return "";
    const d = new Date(formData.calibrationDate);
    if (isNaN(d.getTime())) return "";
    const due = new Date(d);
    due.setMonth(due.getMonth() + months);
    if (due.getDate() !== d.getDate()) due.setDate(0);
    return due.toISOString().split("T")[0];
  })();

  const uploadToStorage = async (file) => {
    const path = `calibration/${selectedTicket?.ticketId}_${Date.now()}_${file.name}`;

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
    setCalibrationUploadFile(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.calibrationDate) {
      alert("Please select Calibration Date");
      return;
    }
    if (!formData.calibrationPeriodMonth) {
      alert("Please enter Calibration Period (Month)");
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload only now that Submit was actually clicked — nothing was
      // uploaded on file selection.
      const calibrationUploadUrl = calibrationUploadFile
        ? await uploadToStorage(calibrationUploadFile)
        : null;

      const submittedAt = new Date();
      const calibrationCertificatePlanned = await computeStagePlanned("calibrationCertificate", {
        calibrationSubmittedAt: submittedAt,
      });

      const { error } = await supabase.from("calibration").insert({
        ticket_id: selectedTicket.ticketId,
        ticket_uuid: selectedTicket.ticketUuid,
        calibration_date: formData.calibrationDate || null,
        calibration_period_month: formData.calibrationPeriodMonth || null,
        calibration_due_date: calibrationDueDate || null,
        calibration_upload_file: calibrationUploadUrl,
        // Readiness stamp for the next stage (Calibration Certificate) —
        // every Calibration submission gets this. See stagePlanning.js.
        calibration_certificate_planned: calibrationCertificatePlanned,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Calibration details saved successfully",
      });

      setShowCalibrationModal(false);
      fetchData();
    } catch (error) {
      console.error("Error submitting calibration:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save calibration details",
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
  // convention, matching predecessor Invoice. See calibration.delay_minutes.
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
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Client Name</th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[200px] sticky top-0">Company Name</th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Phone Number</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-blue-100">
                        {filteredPendingData.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="text-center py-8 bg-white" data-testid="text-no-pending">
                              {fetchLoading ? (
                                <div className="flex justify-center items-center text-blue-700">
                                  <LoaderIcon className="animate-spin w-8 h-8" />
                                </div>
                              ) : (
                                <h1 className="text-blue-700">No pending calibrations found.</h1>
                              )}
                            </td>
                          </tr>
                        ) : (
                          filteredPendingData.map((ticket, ind) => (
                            <tr key={ticket.ticketId} className={ind % 2 === 0 ? "bg-blue-50/50" : "bg-white"}>
                              <td className="px-4 py-3">
                                <Button
                                  size="sm"
                                  onClick={() => handleCalibrationClick(ticket)}
                                  variant="outline"
                                  className="bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-600 hover:from-blue-100 hover:to-indigo-100 hover:text-blue-700 transition-all duration-300 border border-blue-200 hover:border-blue-300 rounded-lg px-3 py-1.5 shadow-sm hover:shadow-md group"
                                  data-testid={`button-calibration-${ticket.ticketId}`}
                                >
                                  <span className="font-medium">Calibration</span>
                                </Button>
                              </td>
                              <td className="px-4 py-3 text-blue-900">{formatDate(ticket.timeStemp)}</td>
                              <td className="px-4 py-3 font-medium text-blue-800">{ticket.ticketId}</td>
                              <td className="px-4 py-3 text-blue-900">{ticket.clientName}</td>
                              <td className="px-4 py-3 text-blue-900">{ticket.companyName || "-"}</td>
                              <td className="px-4 py-3 text-blue-900">{ticket.phoneNumber}</td>
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
                            <h1 className="text-blue-700">No pending calibrations found.</h1>
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
                                  <p className="text-sm text-gray-600">{ticket.clientName}</p>
                                  <p className="text-sm text-gray-600 font-medium">Company: {ticket.companyName || "N/A"}</p>
                                </div>
                                <Button
                                  size="sm"
                                  onClick={() => handleCalibrationClick(ticket)}
                                  variant="outline"
                                  className="bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-600 hover:from-blue-100 hover:to-indigo-100 border border-blue-200"
                                >
                                  Calibration
                                </Button>
                              </div>
                              <div className="text-sm">
                                <p className="text-gray-500 font-medium">Phone</p>
                                <p className="text-blue-900">{ticket.phoneNumber}</p>
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
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Date</th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[120px] sticky top-0">Ticket ID</th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Client Name</th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Phone Number</th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Calibration Date</th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Calibration Period (Month)</th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Calibration Due Date</th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Upload</th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[120px] sticky top-0">Delay</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-blue-100">
                        {filteredHistoryData.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="text-center py-8 bg-white" data-testid="text-no-history">
                              {fetchLoading ? (
                                <div className="flex justify-center items-center text-blue-700">
                                  <LoaderIcon className="animate-spin w-8 h-8" />
                                </div>
                              ) : (
                                <h1 className="text-blue-700">No calibration history found.</h1>
                              )}
                            </td>
                          </tr>
                        ) : (
                          filteredHistoryData.map((ticket, ind) => (
                            <tr key={ind} className={ind % 2 === 0 ? "bg-blue-50/50" : "bg-white"}>
                              <td className="px-4 py-3 text-blue-900">{formatDate(ticket.timeStemp)}</td>
                              <td className="px-4 py-3 font-medium text-blue-800">{ticket.ticketId}</td>
                              <td className="px-4 py-3 text-blue-900">{ticket.clientName}</td>
                              <td className="px-4 py-3 text-blue-900">{ticket.phoneNumber}</td>
                              <td className="px-4 py-3 text-blue-900">{formatDate(ticket.calibrationDate) || ""}</td>
                              <td className="px-4 py-3 text-blue-900">{ticket.calibrationPeriodMonth}</td>
                              <td className="px-4 py-3 text-blue-900">{formatDate(ticket.calibrationDueDate) || ""}</td>
                              <td className="px-4 py-3">
                                {ticket.calibrationUploadFile ? (
                                  <a
                                    href={ticket.calibrationUploadFile}
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
                            <h1 className="text-blue-700">No calibration history found.</h1>
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
                                <p className="text-sm text-gray-600">{ticket.clientName}</p>
                              </div>
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <p className="text-gray-500 font-medium">Calibration Date</p>
                                  <p className="text-blue-900">{formatDate(ticket.calibrationDate) || "N/A"}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500 font-medium">Period (Month)</p>
                                  <p className="text-blue-900">{ticket.calibrationPeriodMonth || "N/A"}</p>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <p className="text-gray-500 font-medium">Due Date</p>
                                  <p className="text-blue-900">{formatDate(ticket.calibrationDueDate) || "N/A"}</p>
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
                              {ticket.calibrationUploadFile && (
                                <div>
                                  <p className="text-gray-500 font-medium text-sm">Upload</p>
                                  <a
                                    href={ticket.calibrationUploadFile}
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

      {/* Calibration Modal */}
      <Modal
        isOpen={showCalibrationModal}
        onClose={() => setShowCalibrationModal(false)}
        title="Calibration"
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
            <Label>Calibration Date *</Label>
            <Input
              type="date"
              value={formData.calibrationDate || ""}
              onChange={(e) => handleInputChange("calibrationDate", e.target.value)}
              data-testid="input-calibration-date"
            />
          </div>
          <div>
            <Label>Calibration Period (Month) *</Label>
            <Input
              type="number"
              min="1"
              placeholder="Enter number of months"
              value={formData.calibrationPeriodMonth || ""}
              onChange={(e) => handleInputChange("calibrationPeriodMonth", e.target.value)}
              data-testid="input-calibration-period"
            />
          </div>
          <div>
            <Label>Calibration Due Date</Label>
            <Input value={calibrationDueDate ? formatDate(calibrationDueDate) : ""} disabled className="bg-slate-50" />
          </div>
          <div>
            <Label>Calibration Upload</Label>
            <Input
              type="file"
              onChange={handleFileSelect}
              disabled={isSubmitting}
              data-testid="input-calibration-upload"
            />
            {calibrationUploadFile && (
              <p className="text-xs text-emerald-700 mt-1 truncate">Selected: {calibrationUploadFile.name}</p>
            )}
          </div>

          <div className="md:col-span-2 flex space-x-4 pt-4">
            <Button
              type="submit"
              disabled={isSubmitting}
              data-testid="button-submit-calibration"
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
              onClick={() => setShowCalibrationModal(false)}
              data-testid="button-cancel-calibration"
            >
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
