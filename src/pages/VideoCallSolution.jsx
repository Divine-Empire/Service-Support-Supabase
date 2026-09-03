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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { Modal } from "../components/ui/modal";
import { useToast } from "../hooks/use-toast";
import { Loader2Icon, LoaderIcon, Plus, Trash2 } from "lucide-react";
import { Textarea } from "../components/ui/textarea";
import { supabase } from "../lib/supabase/client";
import { fetchDropdownRows } from "../lib/supabase/dropdown";

export default function VideoCallSolution() {
  const [activeTab, setActiveTab] = useState("pending");
  const [showSolutionModal, setShowSolutionModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [formData, setFormData] = useState({});
  const [masterData, setMasterData] = useState({});
  const [lastOtpGenerations, setLastOtpGenerations] = useState({});

  const [pendingData, setPendingData] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchItem, setSearchItem] = useState("");
  const [isCancelled, setIsCancelled] = useState(false);
  const { toast } = useToast();

  const [isVideoCallSolved, setIsVideoCallSolved] = useState(false);
  const [itemRows, setItemRows] = useState([{ item: "", qty: "" }]);

  const handleAddItemRow = () => {
    if (itemRows.length < 15) {
      setItemRows([...itemRows, { item: "", qty: "" }]);
    }
  };

  const handleItemRowChange = (index, field, value) => {
    const newRows = [...itemRows];
    newRows[index][field] = value;
    setItemRows(newRows);
  };

  const handleDeleteItemRow = (index) => {
    if (itemRows.length > 1) {
      const newRows = itemRows.filter((_, i) => i !== index);
      setItemRows(newRows);
    }
  };

  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  // Holds the picked file only — actual upload happens at submit time in
  // handleSubmit, so cancelling the form or switching the outcome away from
  // "no" never leaves an orphaned upload behind.
  const [audioFile, setAudioFile] = useState(null);

  const handleAudioFileSelect = (file) => {
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_SIZE) {
      alert("Audio file size exceeds the 10MB limit.");
      return;
    }
    setAudioFile(file);
  };

  const removeAudioFile = () => {
    setAudioFile(null);
    handleInputChange("audioUrl", "");
  };

  const uploadAudioToDrive = async (file) => {
    setIsUploadingAudio(true);
    try {
      const path = `video_call/${selectedTicket?.ticketId}_${Date.now()}_${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("ticket_enquiry")
        .upload(path, file, { contentType: file.type });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("ticket_enquiry").getPublicUrl(path);

      return { success: true, fileUrl: data.publicUrl };
    } catch (error) {
      console.error("Error uploading audio:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to upload audio",
        variant: "destructive",
      });
      return { success: false, error: error.message };
    } finally {
      setIsUploadingAudio(false);
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

  const fetchData = async () => {
    setFetchLoading(true);
    try {
      // Tickets ready for Video-Call (warranty_check.video_call_planned set).
      const { data: warrantyRows, error: warrantyError } = await supabase
        .from("sss_warranty_check")
        .select("ticket_id, video_call_planned")
        .not("video_call_planned", "is", null);

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

      // All attempts for these tickets, newest first, so the first one seen
      // per ticket_id below is that ticket's LATEST attempt.
      const { data: attempts, error: attemptsError } = await supabase
        .from("sss_video_call")
        .select("*")
        .in("ticket_id", ticketIds)
        .order("created_at", { ascending: false });

      if (attemptsError) throw attemptsError;

      const latestAttemptByTicket = new Map();
      (attempts || []).forEach((a) => {
        if (!latestAttemptByTicket.has(a.ticket_id)) {
          latestAttemptByTicket.set(a.ticket_id, a);
        }
      });

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
          siteName: t.site_address || "",
          gstNo: t.gst_no || "",
          machineName: t.machine_name || "",
          category: t.category || "",
          mentionIssue: t.mention_issue || "",
          serviceLocation: t.service_location || "",
          CREName: t.cre_name || "",
          engineerAssign: t.engineer_assign || "",
          otp: t.otp || "",
        };

        // Latest attempt still 'rescheduled' (or no attempt yet) => still
        // pending — a ticket only leaves Video-Call once an attempt lands
        // on 'yes' or 'no'.
        const latest = latestAttemptByTicket.get(t.ticket_id);

        if (!latest || latest.enquiry_solved === "rescheduled") {
          pending.push(base);
        } else {
          history.push({
            ...base,
            actual2: latest.created_at || "",
            videoCallServicesSolve: latest.enquiry_solved || "",
            otpVarificationStatus: latest.regeneration_status || "",
            audioUrl: latest.audio_link || "",
            remarks: latest.remarks || "",
            itemQty: latest.item_qty ? JSON.stringify(latest.item_qty) : "",
            serviceType: latest.service_type || "",
            rescheduledTime: latest.rescheduled_time || "",
            alternateEngineer: latest.alternate_engineer || "",
            delayMinutes: latest.delay_minutes,
          });
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

  const [alternateEngineerOptions, setAlternateEngineerOptions] = useState([]);

  // Categories this page uses: 'Service Location' (reused for the "Service
  // Type" select, matching the legacy sheet's own reuse), 'Engineer Assign
  // Name' (reused for "Alternate Engineer" — same engineer pool), and
  // 'Item-Name' (the Item & Quantity Details table's item datalist, seeded
  // in migration 0025 from the DROPDOWN sheet's own 'Item-Name' column).
  const DROPDOWN_CATEGORY_TO_KEY = {
    service_location: "Service Location",
    engineer_assign_name: "Engineer Assign Name",
    item_name: "Item-Name",
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
      setAlternateEngineerOptions(structuredData["Engineer Assign Name"] || []);
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
    fetchData();
    fetchMasterSheet();
  }, []);

  const handleSolutionClick = (ticket) => {
    setSelectedTicket(ticket);
    setFormData({
      videoCallServicesSolve: "",
      otpVerification: "",
      remarks: "",
      cancelRemarks: "",
      serviceType: ticket.serviceType || "",
      audioUrl: ticket.audioUrl || "",
      rescheduledDateTime: "",
      alternateEngineer: "",
    });
    setAudioFile(null);
    setItemRows([{ item: "", qty: "" }]);
    setIsVideoCallSolved(false);
    setIsCancelled(false);
    setShowSolutionModal(true);
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setIsSubmitting(true); // Start loading

    if (!formData.videoCallServicesSolve) {
      alert("Please Select Video Call Services");
      setIsSubmitting(false);
      return;
    }



    if (formData.videoCallServicesSolve === "no" && !formData.serviceType) {
      alert("Please Select Service Type");
      setIsSubmitting(false);
      return;
    }

    if (formData.videoCallServicesSolve === "rescheduled") {
      if (!formData.rescheduledDateTime) {
        alert("Please select Rescheduled Date & Time");
        setIsSubmitting(false);
        return;
      }
      if (!formData.alternateEngineer) {
        alert("Please select Alternate Engineer");
        setIsSubmitting(false);
        return;
      }
    }

    if (isVideoCallSolved) {
      if (
        !formData.otpVerification ||
        formData.otpVerification.toString() !== (selectedTicket.otp || "").toString()
      ) {
        alert("Wrong OTP, Please Enter Right OTP");
        setIsSubmitting(false);
        return;
      }
    } else if (formData.videoCallServicesSolve === "no") {
      const validRows = itemRows.filter(row => row.item.trim() !== "" && row.qty.toString().trim() !== "");
      if (validRows.length === 0) {
        alert("Please add at least one item and quantity.");
        setIsSubmitting(false);
        return;
      }

      const hasEmptyField = itemRows.some(row => {
        return (row.item.trim() !== "" && !row.qty) || (row.item.trim() === "" && row.qty);
      });
      if (hasEmptyField) {
        alert("Please complete both Item Name and Quantity for all rows.");
        setIsSubmitting(false);
        return;
      }
    }

    const insertPayload = {
      ticket_id: selectedTicket.ticketId,
      ticket_uuid: selectedTicket.ticketUuid,
      enquiry_solved: formData.videoCallServicesSolve,
      regeneration_status:
        formData.videoCallServicesSolve === "yes"
          ? "Verified"
          : formData.videoCallServicesSolve === "rescheduled"
          ? "Rescheduled"
          : "Skipped",
      remarks: formData.remarks || "",
    };

    // Snapshot of the OTP that was actually verified — the live/regeneratable
    // value stays on tickets.otp.
    if (formData.videoCallServicesSolve === "yes") {
      insertPayload.otp_generation = selectedTicket.otp || "";
    }

    if (formData.videoCallServicesSolve === "no") {
      insertPayload.item_qty = itemRows
        .filter((row) => row.item.trim() !== "")
        .map((row) => ({ item: row.item.trim(), qty: row.qty }));
      insertPayload.service_type = formData.serviceType || "";
    }

    if (formData.videoCallServicesSolve === "rescheduled") {
      insertPayload.rescheduled_time = formData.rescheduledDateTime
        ? new Date(formData.rescheduledDateTime).toISOString()
        : null;
      insertPayload.alternate_engineer = formData.alternateEngineer || "";
    }

    try {
      // Audio only uploads now, at submit time — not when the file was picked.
      if (formData.videoCallServicesSolve === "no" && audioFile) {
        const uploadResult = await uploadAudioToDrive(audioFile);
        if (!uploadResult.success) {
          throw new Error(uploadResult.error || "Failed to upload audio");
        }
        insertPayload.audio_link = uploadResult.fileUrl;
      } else if (formData.videoCallServicesSolve === "no") {
        insertPayload.audio_link = formData.audioUrl || "";
      }

      // Every submission (yes/no/rescheduled) is its own attempt row — a
      // 'rescheduled' attempt doesn't close the ticket out, it just records
      // this attempt while the ticket stays pending. fetchData() below
      // recomputes pending/history from the latest attempt, so a
      // 'rescheduled' ticket correctly stays in the pending list.
      const { error } = await supabase.from("sss_video_call").insert(insertPayload);
      if (error) throw error;

      toast({
        title: "Success",
        description: "Submitted successfully",
      });
      setShowSolutionModal(false);
      setIsVideoCallSolved(false);
      setAudioFile(null);
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

  const [cancelSubmit, setCancelSubmit] = useState(false);

  const handleSubmitCancel = async (e) => {
    e.preventDefault();

    setCancelSubmit(true);

    try {
      const { error } = await supabase.from("sss_cancelled_tickets").insert({
        ticket_id: selectedTicket.ticketId,
        ticket_uuid: selectedTicket.ticketUuid,
        cancelled_from_stage: "Video Call Solution",
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
      setShowSolutionModal(false);
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
      // setShowForm(false);
    }
  };

  function generateSixDigitNumber() {
    let result = "";
    for (let i = 0; i < 6; i++) {
      const digit = Math.floor(Math.random() * 10).toString();
      result += digit.toString();
    }
    return result;
  }

  const [isResending, setIsResending] = useState(false);

  const canGenerateOtp = (ticketId) => {
    if (!lastOtpGenerations[ticketId]) return true;

    const lastGenDate = new Date(lastOtpGenerations[ticketId]);
    const today = new Date();

    return (
      lastGenDate.getDate() !== today.getDate() ||
      lastGenDate.getMonth() !== today.getMonth() ||
      lastGenDate.getFullYear() !== today.getFullYear()
    );
  };

  const ResendOTP = async () => {
    const ticketId = selectedTicket?.ticketId;

    // Check if OTP was already generated today for this specific ticket
    if (!canGenerateOtp(ticketId)) {
      toast({
        title: "Error",
        description: "You can only generate one OTP per day for this ticket",
        variant: "destructive",
      });
      return;
    }

    setIsResending(true);
    const sixDigitNumber1 = generateSixDigitNumber();

    try {
      // Store the current timestamp as last generation time for this ticket
      setLastOtpGenerations((prev) => ({
        ...prev,
        [ticketId]: new Date().toISOString(),
      }));

      // Store in localStorage for persistence across page refreshes
      const storedGenerations = JSON.parse(
        localStorage.getItem("lastOtpGenerations") || "{}"
      );
      storedGenerations[ticketId] = new Date().toISOString();
      localStorage.setItem(
        "lastOtpGenerations",
        JSON.stringify(storedGenerations)
      );

      // The live/regeneratable OTP lives on tickets.otp — there's no
      // video_call row yet for a still-pending ticket to hold it.
      const { error } = await supabase
        .from("sss_tickets")
        .update({ otp: sixDigitNumber1 })
        .eq("ticket_id", ticketId);

      if (error) throw error;

      setSelectedTicket((prev) => ({
        ...prev,
        otp: sixDigitNumber1,
      }));
      toast({
        title: "Success",
        description: "OTP sent successfully",
      });
    } catch (error) {
      console.error("Error submitting ticket:", error);
      toast({
        title: "Error",
        description: "Failed to send OTP",
        variant: "destructive",
      });
    } finally {
      setIsResending(false);
    }
  };

  // Load last OTP generation time from localStorage on component mount
  useEffect(() => {
    const storedGenerations = localStorage.getItem("lastOtpGenerations");
    if (storedGenerations) {
      setLastOtpGenerations(JSON.parse(storedGenerations));
    }
  }, []);

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
  ) : role === "engineer" ? filteredPendingDataa.filter(
    (item) => item["engineerAssign"] === userName
  ) : filteredPendingDataa;

  const filteredHistoryData = role === "user" ? filteredHistoryDataa.filter(
    (item) => item["CREName"] === userName
  ) : role === "engineer" ? filteredHistoryDataa.filter(
    (item) => item["engineerAssign"] === userName
  ) : filteredHistoryDataa;

  // console.log("filteredPendingData", filteredPendingData);
  // console.log("filteredHistoryData", filteredHistoryData);

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
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[120px] sticky top-0">
                          Client Type
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[180px] sticky top-0">
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
                      </tr>
                    </thead>
                    {/* Table body - scrollable */}
                    <tbody className="bg-white divide-y divide-blue-100">
                      {filteredPendingData.length === 0 ? (
                        <tr>
                          <td
                            colSpan={16}
                            className="text-center py-8 bg-white"
                            data-testid="text-no-pending"
                          >
                            {fetchLoading ? (
                              <div className="flex justify-center items-center text-blue-700">
                                <LoaderIcon className="animate-spin w-8 h-8" />
                              </div>
                            ) : (
                              <h1 className="text-blue-700">
                                No pending video call solutions found.
                              </h1>
                            )}
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
                                onClick={() => handleSolutionClick(ticket)}
                                variant="outline"
                                className="bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-600 hover:from-blue-100 hover:to-indigo-100 hover:text-blue-700 transition-all duration-300 border border-blue-200 hover:border-blue-300 rounded-lg px-3 py-1.5 shadow-sm hover:shadow-md group"
                                data-testid={`button-solution-${ticket.id}`}
                              >
                                <span className="font-medium">Solution</span>
                              </Button>
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {formatDate(ticket.timeStemp)}
                            </td>
                            <td className="px-4 py-3 font-medium text-blue-800">
                              {ticket.ticketId}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.sourceOfEnquiry}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.callType}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.enquiryReceiverName}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.clientType}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.companyName}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.clientName}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.phoneNumber}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.siteAddress}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.gstNo}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.machineName}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.category}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.mentionIssue}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.serviceLocation}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>

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
                            No pending video call solutions found.
                          </h1>
                        )}
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
                                <p className="text-sm text-gray-500">
                                  {formatDate(ticket.timeStemp)}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                onClick={() => handleSolutionClick(ticket)}
                                variant="outline"
                                className="bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-600 hover:from-blue-100 hover:to-indigo-100 border border-blue-200"
                              >
                                Solution
                              </Button>
                            </div>

                            {/* Client & Company */}
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

                            {/* Contact Details */}
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

                            {/* Call Details */}
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

                            {/* Receiver & GST No */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500 font-medium">Receiver Name</p>
                                <p className="text-blue-900">{ticket.enquiryReceiverName || "N/A"}</p>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">GST No.</p>
                                <p className="text-blue-900">{ticket.gstNo || "N/A"}</p>
                              </div>
                            </div>

                            {/* Machine & Category */}
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

                            {/* Issue & Service Location */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500 font-medium">Mention Issue</p>
                                <p className="text-blue-900">{ticket.mentionIssue || "N/A"}</p>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">Service Location</p>
                                <p className="text-blue-900">{ticket.serviceLocation || "N/A"}</p>
                              </div>
                            </div>

                            {/* Address Info */}
                            <div>
                              <p className="text-gray-500 font-medium text-xs">Site Address</p>
                              <p className="text-blue-900 text-sm">{ticket.siteAddress || "N/A"}</p>
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
                {/* Table container with fixed header and scrollable body */}
                <div className="max-h-[calc(103vh-200px)] overflow-y-auto">
                  <table className="hidden sm:block w-full">
                    {/* Table header - fixed */}
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
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[120px] sticky top-0">
                          Client Type
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[180px] sticky top-0">
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
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[180px] sticky top-0">
                          Video Call Services Solve
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          OTP Verifications
                        </th>
                      </tr>
                    </thead>
                    {/* Table body - scrollable */}
                    <tbody className="bg-white divide-y divide-blue-100">
                      {filteredHistoryData.length === 0 ? (
                        <tr>
                          <td
                            colSpan={17}
                            className="text-center py-8 bg-white"
                            data-testid="text-no-history"
                          >
                            {fetchLoading ? (
                              <div className="flex justify-center items-center text-blue-700">
                                <LoaderIcon className="animate-spin w-8 h-8" />
                              </div>
                            ) : (
                              <h1 className="text-blue-700">
                                No video call solution history found.
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
                              {ticket.sourceOfEnquiry}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.callType}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.enquiryReceiverName}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.clientType}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.companyName}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.clientName}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.phoneNumber}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.siteAddress}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.gstNo}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.machineName}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.category}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.mentionIssue}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.serviceLocation}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${ticket.videoCallServicesSolve === "yes"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-red-100 text-red-800"
                                  }`}
                              >
                                {ticket.videoCallServicesSolve === "yes"
                                  ? "Yes"
                                  : "No"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  ticket.otpVarificationStatus === "Yes" || ticket.otpVarificationStatus === "Verified"
                                    ? "bg-green-100 text-green-800"
                                    : ticket.otpVarificationStatus === "Skipped"
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-red-100 text-red-800"
                                }`}
                              >
                                {ticket.otpVarificationStatus === "Yes" || ticket.otpVarificationStatus === "Verified"
                                  ? "Verified"
                                  : ticket.otpVarificationStatus === "Skipped"
                                  ? "Skipped"
                                  : "Not Verified"}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>

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
                            No video call solution history found.
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
                              <p className="text-sm text-gray-500">
                                {formatDate(ticket.timeStemp)}
                              </p>
                            </div>

                            {/* Client & Company */}
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

                            {/* Contact Details */}
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

                            {/* Call Details */}
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

                            {/* Receiver & GST No */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500 font-medium">Receiver Name</p>
                                <p className="text-blue-900">{ticket.enquiryReceiverName || "N/A"}</p>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">GST No.</p>
                                <p className="text-blue-900">{ticket.gstNo || "N/A"}</p>
                              </div>
                            </div>

                            {/* Machine & Category */}
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

                            {/* Issue & Service Location */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500 font-medium">Mention Issue</p>
                                <p className="text-blue-900">{ticket.mentionIssue || "N/A"}</p>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">Service Location</p>
                                <p className="text-blue-900">{ticket.serviceLocation || "N/A"}</p>
                              </div>
                            </div>

                            {/* Address Info */}
                            <div>
                              <p className="text-gray-500 font-medium text-xs">Site Address</p>
                              <p className="text-blue-900 text-sm">{ticket.siteAddress || "N/A"}</p>
                            </div>

                            {/* Solution Status */}
                            <div className="grid grid-cols-2 gap-3 text-sm border-t border-blue-100 pt-2 mt-2">
                              <div>
                                <p className="text-gray-500 font-medium">Video Call Solved</p>
                                <span
                                  className={`px-2 py-0.5 text-xs font-semibold rounded-full ${ticket.videoCallServicesSolve === "yes"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-red-100 text-red-800"
                                    }`}
                                >
                                  {ticket.videoCallServicesSolve === "yes"
                                    ? "Yes"
                                    : "No"}
                                </span>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">OTP Status</p>
                                <span
                                  className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                                    ticket.otpVarificationStatus === "Yes" || ticket.otpVarificationStatus === "Verified"
                                      ? "bg-green-100 text-green-800"
                                      : ticket.otpVarificationStatus === "Skipped"
                                      ? "bg-blue-100 text-blue-800"
                                      : "bg-red-100 text-red-800"
                                  }`}
                                >
                                  {ticket.otpVarificationStatus === "Yes" || ticket.otpVarificationStatus === "Verified"
                                    ? "Verified"
                                    : ticket.otpVarificationStatus === "Skipped"
                                    ? "Skipped"
                                    : "Not Verified"}
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

      {/* Video Call Solution Modal */}
      <Modal
        isOpen={showSolutionModal}
        onClose={() => {
          setShowSolutionModal(false);
          setIsVideoCallSolved(false);
        }}
        title="Video Call Solution"
        size="2xl"
      >
        <div className="bg-white rounded-lg">
          <div className="p-6">
            <form
              onSubmit={handleSubmit}
              className="grid grid-cols-1 md:grid-cols-2 gap-2"
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
                <Label className="text-gray-600 font-medium">
                  Phone Number
                </Label>
                <Input
                  value={selectedTicket?.phoneNumber || ""}
                  disabled
                  className="bg-gray-50 border border-gray-200 text-gray-700 rounded-lg py-2 px-3 focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-gray-600 font-medium">
                  Machine Name
                </Label>
                <Input
                  value={selectedTicket?.machineName || ""}
                  disabled
                  className="bg-gray-50 border border-gray-200 text-gray-700 rounded-lg py-2 px-3 focus:outline-none"
                />
              </div>

              {!isCancelled && (
                <>
                  <div className="space-y-1">
                    <Label className="text-gray-600 font-medium">
                      Enquiry Receiver Name
                    </Label>
                    <Input
                      value={selectedTicket?.enquiryReceiverName || ""}
                      disabled
                      className="bg-gray-50 border border-gray-200 text-gray-700 rounded-lg py-2 px-3 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-gray-600 font-medium">
                      Site Name
                    </Label>
                    <Input
                      value={selectedTicket?.siteName || ""}
                      disabled
                      className="bg-gray-50 border border-gray-200 text-gray-700 rounded-lg py-2 px-3 focus:outline-none"
                    />
                  </div>

                  {/* Editable fields */}
                  <div className="space-y-1">
                    <Label className="text-gray-600 font-medium font-sans">
                      Video Call Services Solve *
                    </Label>
                    <Select
                      value={formData.videoCallServicesSolve || ""}
                      onValueChange={(value) => {
                        handleInputChange("videoCallServicesSolve", value);
                        setIsVideoCallSolved(value === "yes");
                        if (value === "yes") {
                          handleInputChange("audioUrl", "");
                        }
                      }}
                    >
                      <SelectTrigger
                        data-testid="select-video-solved"
                        className="border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <SelectValue placeholder="Select option" />
                      </SelectTrigger>
                      <SelectContent className="bg-white rounded-lg border-gray-200 shadow-lg">
                        <SelectItem value="yes" className="hover:bg-gray-50">
                          Yes
                        </SelectItem>
                        <SelectItem value="no" className="hover:bg-gray-50">
                          No
                        </SelectItem>
                        <SelectItem value="rescheduled" className="hover:bg-gray-50">
                          Rescheduled
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.videoCallServicesSolve === "rescheduled" && (
                    <>
                      <div className="space-y-1">
                        <Label className="text-gray-600 font-medium font-sans">
                          Rescheduled Date & Time *
                        </Label>
                        <Input
                          type="datetime-local"
                          value={formData.rescheduledDateTime || ""}
                          onChange={(e) => handleInputChange("rescheduledDateTime", e.target.value)}
                          className="border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-gray-600 font-medium font-sans">
                          Alternate Engineer *
                        </Label>
                        <Select
                          value={formData.alternateEngineer || ""}
                          onValueChange={(value) => handleInputChange("alternateEngineer", value)}
                        >
                          <SelectTrigger className="border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                            <SelectValue placeholder="Select Engineer" />
                          </SelectTrigger>
                          <SelectContent className="bg-white rounded-lg border-gray-200 shadow-lg max-h-60 overflow-y-auto">
                            {alternateEngineerOptions.map((name) => (
                              <SelectItem key={name} value={name} className="hover:bg-gray-50">
                                {name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}

                  {formData.videoCallServicesSolve === "no" && (
                    <div className="space-y-1 md:col-span-2">
                      <Label className="flex items-center gap-2 text-gray-600 font-medium font-sans">
                        Audio Recording (max 10MB)
                      </Label>
                      {audioFile ? (
                        <div className="flex items-center justify-between border border-blue-200 rounded-md p-2 bg-blue-50 text-blue-800 text-sm">
                          <span className="truncate max-w-[400px]" title={audioFile.name}>
                            {audioFile.name}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={removeAudioFile}
                            className="text-red-500 hover:text-red-700 h-8 px-2 py-1 text-xs font-semibold hover:bg-red-50"
                          >
                            Remove
                          </Button>
                        </div>
                      ) : formData.audioUrl ? (
                        <div className="flex items-center justify-between border border-emerald-200 rounded-md p-2 bg-emerald-50 text-emerald-800 text-sm">
                          <a href={formData.audioUrl} target="_blank" rel="noopener noreferrer" className="font-semibold underline truncate max-w-[400px]">
                            View Uploaded Audio
                          </a>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={removeAudioFile}
                            className="text-red-500 hover:text-red-700 h-8 px-2 py-1 text-xs font-semibold hover:bg-red-50"
                          >
                            Remove
                          </Button>
                        </div>
                      ) : (
                        <Input
                          type="file"
                          accept="audio/*"
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              handleAudioFileSelect(e.target.files[0]);
                            }
                          }}
                          className="border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      )}
                    </div>
                  )}

                  {formData.videoCallServicesSolve === "no" && (
                    <div className="space-y-1">
                      <Label className="text-gray-600 font-medium font-sans">
                        Service Type *
                      </Label>
                      <Select
                        value={formData.serviceType || ""}
                        onValueChange={(value) => {
                          handleInputChange("serviceType", value);
                        }}
                      >
                        <SelectTrigger
                          data-testid="select-service-type"
                          className="border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <SelectValue placeholder="Select Service Type" />
                        </SelectTrigger>
                        <SelectContent className="bg-white rounded-lg border-gray-200 shadow-lg max-h-60 overflow-y-auto">
                          {(masterData[0]?.["Service Location"] || []).map((name, idx) => (
                            <SelectItem key={idx} value={name} className="hover:bg-gray-50">
                              {name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {isVideoCallSolved && (
                    <>
                      <div className="space-y-1">
                        <Label className="text-gray-600 font-medium">
                          OTP Verification *
                        </Label>
                        <Input
                          maxLength={6}
                          placeholder="Enter 6-digit OTP"
                          value={formData.otpVerification || ""}
                          onChange={(e) =>
                            handleInputChange("otpVerification", e.target.value)
                          }
                          data-testid="input-otp"
                          className="text-center text-lg tracking-widest border border-gray-300 rounded-lg py-2 px-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <div className="w-full flex justify-center items-center flex-col mt-2">
                          <div
                            onClick={
                              canGenerateOtp(selectedTicket?.ticketId)
                                ? ResendOTP
                                : null
                            }
                            data-testid="button-resend-otp"
                            className={`px-2 py-1 ${canGenerateOtp(selectedTicket?.ticketId)
                              ? "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 cursor-pointer"
                              : "bg-gray-400 cursor-not-allowed"
                              } text-white rounded-lg transition-all duration-300 shadow-lg text-center w-full flex justify-center items-center`}
                          >
                            {isResending ? (
                              <span className="flex items-center">
                                <LoaderIcon className="animate-spin mr-2" />
                                Resend OTPing...
                              </span>
                            ) : (
                              "Resend OTP"
                            )}
                          </div>

                          {!canGenerateOtp(selectedTicket?.ticketId) && (
                            <p className="text-xs text-gray-500 mt-1">
                              Next OTP available tomorrow
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1 md:col-span-2">
                        <Label className="text-gray-600 font-medium">Remarks</Label>
                        <Textarea
                          placeholder="Enter remarks..."
                          value={formData.remarks || ""}
                          onChange={(e) => handleInputChange("remarks", e.target.value)}
                          className="border border-gray-300 rounded-lg py-2 px-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          rows={3}
                        />
                      </div>
                    </>
                  )}

                  {!isVideoCallSolved && formData.videoCallServicesSolve === "no" && (
                    <div className="space-y-4 md:col-span-2 border-t border-blue-100 pt-4 mt-2">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="text-sm font-semibold text-blue-800">Item & Quantity Details *</h4>
                        <Button
                          type="button"
                          onClick={handleAddItemRow}
                          disabled={itemRows.length >= 15}
                          className="flex items-center space-x-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs shadow transition-all duration-300"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Row ({itemRows.length}/15)</span>
                        </Button>
                      </div>

                      <div className="border rounded-lg overflow-hidden border-blue-100">
                        <table className="min-w-full divide-y divide-blue-100">
                          <thead className="bg-blue-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-blue-700">Item Name *</th>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-blue-700 w-24">Qty *</th>
                              <th className="px-4 py-2 text-center text-xs font-semibold text-blue-700 w-16">Action</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-blue-50">
                            {itemRows.map((row, index) => (
                              <tr key={index}>
                                <td className="px-4 py-2">
                                  <Input
                                    placeholder="Enter item name..."
                                    value={row.item}
                                    onChange={(e) => handleItemRowChange(index, "item", e.target.value)}
                                    className="w-full border-gray-200 rounded focus:ring-1 focus:ring-blue-500 text-sm h-8"
                                    required={index === 0}
                                    list={`item-options-${index}`}
                                  />
                                  <datalist id={`item-options-${index}`}>
                                    {masterData[0]?.["Item-Name"]?.map((option) => (
                                      <option key={option} value={option} />
                                    ))}
                                  </datalist>
                                </td>
                                <td className="px-4 py-2">
                                  <Input
                                    type="number"
                                    min="1"
                                    placeholder="Qty"
                                    value={row.qty}
                                    onChange={(e) => handleItemRowChange(index, "qty", e.target.value)}
                                    className="w-full border-gray-200 rounded focus:ring-1 focus:ring-blue-500 text-sm h-8"
                                    required={index === 0}
                                  />
                                </td>
                                <td className="px-4 py-2 text-center">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => handleDeleteItemRow(index)}
                                    disabled={itemRows.length <= 1}
                                    className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 h-auto rounded-md disabled:opacity-50"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-gray-600 font-medium">Remarks</Label>
                        <Textarea
                          placeholder="Enter remarks..."
                          value={formData.remarks || ""}
                          onChange={(e) => handleInputChange("remarks", e.target.value)}
                          className="border border-gray-300 rounded-lg py-2 px-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          rows={3}
                        />
                      </div>
                    </div>
                  )}

                  <div className="md:col-span-2 flex justify-end space-x-4 pt-6 border-t border-gray-200">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowSolutionModal(false);
                        setIsVideoCallSolved(false);
                      }}
                      data-testid="button-cancel-solution"
                      className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-70 disabled:transform-none"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      data-testid="button-submit-solution"
                      disabled={isSubmitting}
                      className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-70 disabled:transform-none"
                    >
                      {isSubmitting ? (
                        <span className="flex items-center">
                          <LoaderIcon className="animate-spin mr-2" />
                          Processing...
                        </span>
                      ) : (
                        "Submit"
                      )}
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
        </div>
      </Modal>
    </div>
  );
}
