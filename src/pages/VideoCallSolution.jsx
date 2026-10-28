import { useState, useEffect, useMemo } from "react";
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
import { Modal } from "../components/ui/modal";
import { ListToolbar, ListTable, StatusBadge } from "../components/shared";
import { useClientList } from "../hooks/useClientList";
import useAuth from "../hooks/useAuth";
import { useToast } from "../hooks/use-toast";
import { Loader2Icon, LoaderIcon, Plus, Trash2 } from "lucide-react";
import { Textarea } from "../components/ui/textarea";
import { supabase } from "../lib/supabase/client";
import { fetchDropdownRows } from "../lib/supabase/dropdown";
import { fetchEngineerNames } from "../lib/supabase/engineers";
import { fetchItemNames } from "../lib/supabase/items";
import {
  sendVideoCallRescheduledNotifications,
  sendVideoCallOtpResendNotification,
} from "../lib/notifications/whatsapp";
import { formatDate, formatTime12hr } from "../lib/format";

const isOtpVerified = (r) => r.otpVarificationStatus === "Yes" || r.otpVarificationStatus === "Verified";
const otpLabel = (r) => (isOtpVerified(r) ? "Verified" : r.otpVarificationStatus === "Skipped" ? "Skipped" : "Not Verified");
const solvedLabel = (r) => (r.videoCallServicesSolve === "yes" ? "Yes" : "No");

// Pending: Action + ticket details. History: same details plus the video-call outcome.
const COLUMNS = [
  { key: "action", label: "Action", fixed: true, tabs: ["pending"], cell: (r, { onSolution }) => (
    <Button size="sm" variant="outline" onClick={() => onSolution(r)} data-testid={`button-solution-${r.ticketId}`}>
      Solution
    </Button>
  ) },
  { key: "date", label: "Date", defaultVisible: true, text: (r) => formatDate(r.timeStemp) },
  { key: "plannedDate", label: "Planned Date", defaultVisible: true, text: (r) => formatDate(r.plannedDate) },
  { key: "ticketId", label: "Ticket-ID", defaultVisible: true, strong: true, text: (r) => r.ticketId },
  { key: "sourceOfEnquiry", label: "Source of enquiry", defaultVisible: false, text: (r) => r.sourceOfEnquiry },
  { key: "callType", label: "Call type", defaultVisible: false, text: (r) => r.callType },
  { key: "enquiryReceiverName", label: "Enquiry Receiver Name", defaultVisible: false, text: (r) => r.enquiryReceiverName },
  { key: "clientType", label: "Client Type", defaultVisible: false, text: (r) => r.clientType },
  { key: "companyName", label: "Company Name", defaultVisible: true, text: (r) => r.companyName },
  { key: "clientName", label: "Client Name", defaultVisible: true, text: (r) => r.clientName },
  { key: "phoneNumber", label: "Phone Number", defaultVisible: false, text: (r) => r.phoneNumber },
  { key: "siteAddress", label: "Site Address", defaultVisible: false, wrap: true, width: 200, text: (r) => r.siteAddress },
  { key: "gstNo", label: "GST No.", defaultVisible: false, text: (r) => r.gstNo },
  { key: "machineName", label: "Machine Name", defaultVisible: true, text: (r) => r.machineName },
  { key: "category", label: "Category", defaultVisible: false, text: (r) => r.category },
  { key: "mentionIssue", label: "Mention Issue", defaultVisible: true, wrap: true, width: 200, text: (r) => r.mentionIssue },
  { key: "ticketRemarks", label: "Ticket Remarks", defaultVisible: false, wrap: true, width: 200, text: (r) => r.ticketRemarks },
  { key: "engineerAssign", label: "Engineer Assign", defaultVisible: false, adminOnly: true, text: (r) => r.engineerAssign },
  { key: "enquiryItemList", label: "Enquiry Item List", defaultVisible: false, cell: (r) =>
    r.enquiryItemList ? (
      <a href={r.enquiryItemList} target="_blank" rel="noreferrer" className="text-primary underline hover:no-underline">View</a>
    ) : null },
  { key: "serviceLocation", label: "Service Location", defaultVisible: true, text: (r) => r.serviceLocation },
  { key: "videoCallServicesSolve", label: "Video Call Services Solve", defaultVisible: true, tabs: ["history"], cell: (r) => (
    <StatusBadge tone={r.videoCallServicesSolve === "yes" ? "success" : "danger"}>{solvedLabel(r)}</StatusBadge>
  ) },
  { key: "otpVerifications", label: "OTP Verifications", defaultVisible: true, tabs: ["history"], cell: (r) => (
    <StatusBadge tone={isOtpVerified(r) ? "success" : r.otpVarificationStatus === "Skipped" ? "info" : "danger"}>{otpLabel(r)}</StatusBadge>
  ) },
  { key: "videoCallRemarks", label: "Video Call Remarks", defaultVisible: true, tabs: ["history"], wrap: true, width: 200, text: (r) => r.remarks },
];

export default function VideoCallSolution() {
  const { isAdmin } = useAuth();
  const [showSolutionModal, setShowSolutionModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [formData, setFormData] = useState({});
  const [masterData, setMasterData] = useState({});
  const [lastOtpGenerations, setLastOtpGenerations] = useState({});

  const [pendingData, setPendingData] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const [, setIsUploadingAudio] = useState(false);
  // Holds the picked file only — actual upload happens at submit time in
  // handleSubmit, so cancelling the form or switching the outcome away from
  // "no" never leaves an orphaned upload behind.
  const [audioFile, setAudioFile] = useState(null);

  const handleAudioFileSelect = (file) => {
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_SIZE) {
      toast({ title: "Validation Error", description: "Audio file size exceeds the 10MB limit.", variant: "destructive" });
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


  const fetchData = async () => {
    setFetchLoading(true);
    setLoadError(null);
    try {
      // Tickets ready for Video-Call (warranty_check.video_call_planned set).
      const { data: warrantyRows, error: warrantyError } = await supabase
        .from("sss_warranty_check")
        .select("ticket_id, video_call_planned")
        .not("video_call_planned", "is", null);

      if (warrantyError) throw warrantyError;

      const ticketIds = (warrantyRows || []).map((w) => w.ticket_id);

      const plannedDateMap = new Map();
      (warrantyRows || []).forEach((w) => {
        plannedDateMap.set(w.ticket_id, w.video_call_planned);
      });

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
          // sss_tickets.remarks (the ticket's own remarks) — distinct from the
          // video-call attempt's `remarks` on History rows.
          ticketRemarks: t.remarks || "",
          serviceLocation: t.service_location || "",
          CREName: t.cre_name || "",
          engineerAssign: t.engineer_assign || "",
          enquiryItemList: t.enquiry_item_list || "",
          otp: t.otp || "",
          videoCallTime: t.video_call_time || "",
          plannedDate: plannedDateMap.get(t.ticket_id) || "",
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
      setLoadError(error.message || "Failed to load data");
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
  // Type" select, matching the legacy sheet's own reuse). Engineer names
  // ('Alternate Engineer') come from Master > Engineer Contacts, not a
  // dropdown category — see engineers.js. Item names (the Item & Quantity
  // Details table's item datalist) used to come from the 'item_name'
  // dropdown category too, but that's now retired in favor of Master > Items
  // reading/writing `lto_items` directly (the same shared catalog
  // Lead-To-Order-Supabase-New uses) — see items.js.
  const DROPDOWN_CATEGORY_TO_KEY = {
    service_location: "Service Location",
  };

  const fetchMasterSheet = async () => {
    try {
      const [data, engineerNames, itemNames] = await Promise.all([
        fetchDropdownRows(Object.keys(DROPDOWN_CATEGORY_TO_KEY)),
        fetchEngineerNames(),
        fetchItemNames(),
      ]);

      const structuredData = {};
      (data || []).forEach(({ category, value }) => {
        const key = DROPDOWN_CATEGORY_TO_KEY[category];
        if (!key) return;
        if (!structuredData[key]) structuredData[key] = [];
        structuredData[key].push(value);
      });

      structuredData["Engineer Assign Name"] = engineerNames;
      structuredData["Item-Name"] = itemNames;

      setMasterData([structuredData]);
      setAlternateEngineerOptions(engineerNames);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      toast({ title: "Validation Error", description: "Please Select Video Call Services", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }



    if (formData.videoCallServicesSolve === "no" && !formData.serviceType) {
      toast({ title: "Validation Error", description: "Please Select Service Type", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }

    if (formData.videoCallServicesSolve === "rescheduled") {
      if (!formData.rescheduledDateTime) {
        toast({ title: "Validation Error", description: "Please select Rescheduled Date & Time", variant: "destructive" });
        setIsSubmitting(false);
        return;
      }
      if (!formData.alternateEngineer) {
        toast({ title: "Validation Error", description: "Please select Alternate Engineer", variant: "destructive" });
        setIsSubmitting(false);
        return;
      }
    }

    if (isVideoCallSolved) {
      if (
        !formData.otpVerification ||
        formData.otpVerification.toString() !== (selectedTicket.otp || "").toString()
      ) {
        toast({ title: "Validation Error", description: "Wrong OTP, Please Enter Right OTP", variant: "destructive" });
        setIsSubmitting(false);
        return;
      }
    } else if (formData.videoCallServicesSolve === "no") {
      const validRows = itemRows.filter(row => row.item.trim() !== "" && row.qty.toString().trim() !== "");
      if (validRows.length === 0) {
        toast({ title: "Validation Error", description: "Please add at least one item and quantity.", variant: "destructive" });
        setIsSubmitting(false);
        return;
      }

      const hasEmptyField = itemRows.some(row => {
        return (row.item.trim() !== "" && !row.qty) || (row.item.trim() === "" && row.qty);
      });
      if (hasEmptyField) {
        toast({ title: "Validation Error", description: "Please complete both Item Name and Quantity for all rows.", variant: "destructive" });
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

      // Fire-and-forget: notify the client + newly-assigned Alternate
      // Engineer over WhatsApp on a reschedule. A notification failure
      // should never block this submission, which has already succeeded.
      if (formData.videoCallServicesSolve === "rescheduled") {
        sendVideoCallRescheduledNotifications({
          clientPhoneNumber: selectedTicket.phoneNumber,
          clientName: selectedTicket.clientName,
          ticketId: selectedTicket.ticketId,
          issue: selectedTicket.mentionIssue,
          engineerName: formData.alternateEngineer,
          dateStr: formatDate(formData.rescheduledDateTime),
          timeStr: formatTime12hr(formData.rescheduledDateTime),
          otp: selectedTicket.otp,
        }).then(({ success, error, engineerNotified, engineerError }) => {
          if (!success) {
            toast({
              title: "Reschedule WhatsApp notification not sent",
              description: error || "Ticket was updated, but the client could not be notified over WhatsApp.",
              variant: "destructive",
            });
          }
          if (!engineerNotified) {
            toast({
              title: "Engineer not notified over WhatsApp",
              description: engineerError || `No WhatsApp number on file for ${formData.alternateEngineer}.`,
              variant: "destructive",
            });
          }
        });
      }
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

      // Fire-and-forget: re-send the same "video_call_has_been_scheduled"
      // template to the client with the freshly-regenerated OTP. A
      // WhatsApp failure here should never undo the OTP already saved above.
      sendVideoCallOtpResendNotification({
        clientPhoneNumber: selectedTicket.phoneNumber,
        clientName: selectedTicket.clientName,
        ticketId: selectedTicket.ticketId,
        issue: selectedTicket.mentionIssue,
        engineerName: selectedTicket.engineerAssign,
        dateStr: formatDate(selectedTicket.timeStemp),
        timeStr: formatTime12hrFromHHMM(selectedTicket.videoCallTime),
        otp: sixDigitNumber1,
      }).then(({ success, error }) => {
        if (!success) {
          toast({
            title: "WhatsApp notification not sent",
            description: error || "OTP was saved, but the WhatsApp message could not be sent. Please share it manually.",
            variant: "destructive",
          });
        }
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

  // "HH:MM" (24h, as stored in sss_tickets.video_call_time) -> "hh:mm AM/PM"
  // for the OTP-resend WhatsApp message
  const formatTime12hrFromHHMM = (timeStr) => {
    if (!timeStr || !timeStr.includes(":")) return timeStr || "";
    const [hStr, mStr] = timeStr.split(":");
    let h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    if (isNaN(h) || isNaN(m)) return timeStr;
    const period = h >= 12 ? "PM" : "AM";
    h = h % 12;
    if (h === 0) h = 12;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;
  };

  const columns = useMemo(() => COLUMNS.filter((c) => !c.adminOnly || isAdmin), [isAdmin]);

  const list = useClientList({
    key: "videoCallSolution",
    data: { pending: pendingData, history: historyData },
    loading: fetchLoading,
    error: loadError,
    onRetry: fetchData,
    searchKeys: ["ticketId", "clientName", "companyName", "phoneNumber"],
    filters: [
      { key: "category", label: "Category", allLabel: "All Categories", get: (r) => r.category },
      { key: "serviceLocation", label: "Service Location", allLabel: "All Locations", get: (r) => r.serviceLocation },
      { key: "sourceOfEnquiry", label: "Source of enquiry", allLabel: "All Sources", get: (r) => r.sourceOfEnquiry },
      ...(isAdmin ? [{ key: "engineer", label: "Engineer", allLabel: "All Engineers", get: (r) => r.engineerAssign }] : []),
      { key: "solved", label: "Solved", allLabel: "All Outcomes", get: solvedLabel, tabs: ["history"] },
      { key: "otp", label: "OTP", allLabel: "All OTP Statuses", get: otpLabel, tabs: ["history"] },
    ],
    columns,
  });

  return (
    <div className="space-y-3">
      <ListToolbar list={list} searchPlaceholder="Search by ticket ID, client, company or phone..." />
      <ListTable
        list={list}
        ctx={{ onSolution: handleSolutionClick }}
        rowKey={(r) => r.ticketId}
        cardTitle={(r) => r.ticketId}
        emptyTitle={{ pending: "No pending video call solutions found.", history: "No video call solution history found." }}
        ariaLabel="Video call solutions"
      />

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
                  className="h-4 w-4 text-red-600 focus:ring-red-500 border-input rounded"
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
                <Label htmlFor="vc-ticketId" className="text-muted-foreground font-medium">Ticket ID</Label>
                <Input id="vc-ticketId"
                  value={selectedTicket?.ticketId || ""}
                  disabled
                  className="bg-gray-50 border border-border text-gray-700 rounded-lg py-2 px-3 focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="vc-clientName" className="text-muted-foreground font-medium">Client Name</Label>
                <Input id="vc-clientName"
                  value={selectedTicket?.clientName || ""}
                  disabled
                  className="bg-gray-50 border border-border text-gray-700 rounded-lg py-2 px-3 focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="vc-phone" className="text-muted-foreground font-medium">
                  Phone Number
                </Label>
                <Input id="vc-phone"
                  value={selectedTicket?.phoneNumber || ""}
                  disabled
                  className="bg-gray-50 border border-border text-gray-700 rounded-lg py-2 px-3 focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="vc-machine" className="text-muted-foreground font-medium">
                  Machine Name
                </Label>
                <Input id="vc-machine"
                  value={selectedTicket?.machineName || ""}
                  disabled
                  className="bg-gray-50 border border-border text-gray-700 rounded-lg py-2 px-3 focus:outline-none"
                />
              </div>

              {!isCancelled && (
                <>
                  <div className="space-y-1">
                    <Label htmlFor="vc-receiver" className="text-muted-foreground font-medium">
                      Enquiry Receiver Name
                    </Label>
                    <Input id="vc-receiver"
                      value={selectedTicket?.enquiryReceiverName || ""}
                      disabled
                      className="bg-gray-50 border border-border text-gray-700 rounded-lg py-2 px-3 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="vc-site" className="text-muted-foreground font-medium">
                      Site Name
                    </Label>
                    <Input id="vc-site"
                      value={selectedTicket?.siteName || ""}
                      disabled
                      className="bg-gray-50 border border-border text-gray-700 rounded-lg py-2 px-3 focus:outline-none"
                    />
                  </div>

                  {/* Editable fields */}
                  <div className="space-y-1">
                    <Label htmlFor="vc-solve" className="text-muted-foreground font-medium font-sans">
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
                      <SelectTrigger id="vc-solve"
                        data-testid="select-video-solved"
                        className="border-input rounded-lg"
                      >
                        <SelectValue placeholder="Select option" />
                      </SelectTrigger>
                      <SelectContent className="bg-white rounded-lg border-border shadow-lg">
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
                        <Label htmlFor="vc-resched" className="text-muted-foreground font-medium font-sans">
                          Rescheduled Date & Time *
                        </Label>
                        <Input id="vc-resched"
                          type="datetime-local"
                          value={formData.rescheduledDateTime || ""}
                          onChange={(e) => handleInputChange("rescheduledDateTime", e.target.value)}
                          className="border-input rounded-lg"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="vc-altEngineer" className="text-muted-foreground font-medium font-sans">
                          Alternate Engineer *
                        </Label>
                        <Select
                          value={formData.alternateEngineer || ""}
                          onValueChange={(value) => handleInputChange("alternateEngineer", value)}
                        >
                          <SelectTrigger id="vc-altEngineer" className="border-input rounded-lg">
                            <SelectValue placeholder="Select Engineer" />
                          </SelectTrigger>
                          <SelectContent className="bg-white rounded-lg border-border shadow-lg max-h-60 overflow-y-auto">
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
                      <Label htmlFor="vc-audio" className="flex items-center gap-2 text-muted-foreground font-medium font-sans">
                        Audio Recording (max 10MB)
                      </Label>
                      {audioFile ? (
                        <div className="flex items-center justify-between border rounded-md p-2 bg-muted text-foreground text-sm">
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
                        <div className="flex items-center justify-between border border-success/25 rounded-md p-2 bg-success/10 text-success text-sm">
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
                        <Input id="vc-audio"
                          type="file"
                          accept="audio/*"
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              handleAudioFileSelect(e.target.files[0]);
                            }
                          }}
                          className="border-input rounded-lg"
                        />
                      )}
                    </div>
                  )}

                  {formData.videoCallServicesSolve === "no" && (
                    <div className="space-y-1">
                      <Label htmlFor="vc-serviceType" className="text-muted-foreground font-medium font-sans">
                        Service Type *
                      </Label>
                      <Select
                        value={formData.serviceType || ""}
                        onValueChange={(value) => {
                          handleInputChange("serviceType", value);
                        }}
                      >
                        <SelectTrigger id="vc-serviceType"
                          data-testid="select-service-type"
                          className="border-input rounded-lg"
                        >
                          <SelectValue placeholder="Select Service Type" />
                        </SelectTrigger>
                        <SelectContent className="bg-white rounded-lg border-border shadow-lg max-h-60 overflow-y-auto">
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
                        <Label htmlFor="vc-otp" className="text-muted-foreground font-medium">
                          OTP Verification *
                        </Label>
                        <Input id="vc-otp"
                          maxLength={6}
                          placeholder="Enter 6-digit OTP"
                          value={formData.otpVerification || ""}
                          onChange={(e) =>
                            handleInputChange("otpVerification", e.target.value)
                          }
                          data-testid="input-otp"
                          className="text-center text-lg tracking-widest border border-input rounded-lg py-2 px-3"
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
                              ? "bg-primary hover:bg-primary/90 cursor-pointer"
                              : "bg-muted-foreground/60 cursor-not-allowed"
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
                            <p className="text-xs text-muted-foreground mt-1">
                              Next OTP available tomorrow
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1 md:col-span-2">
                        <Label htmlFor="vc-remarks-solved" className="text-muted-foreground font-medium">Remarks</Label>
                        <Textarea id="vc-remarks-solved"
                          placeholder="Enter remarks..."
                          value={formData.remarks || ""}
                          onChange={(e) => handleInputChange("remarks", e.target.value)}
                          className="border border-input rounded-lg py-2 px-3"
                          rows={3}
                        />
                      </div>
                    </>
                  )}

                  {!isVideoCallSolved && formData.videoCallServicesSolve === "no" && (
                    <div className="space-y-4 md:col-span-2 border-t border-border pt-4 mt-2">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="text-sm font-semibold text-foreground">Item & Quantity Details *</h4>
                        <Button
                          type="button"
                          onClick={handleAddItemRow}
                          disabled={itemRows.length >= 15}
                          className="flex items-center space-x-1 px-3 py-1 rounded-md text-xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Row ({itemRows.length}/15)</span>
                        </Button>
                      </div>

                      <div className="border rounded-lg overflow-hidden border-border">
                        <table className="min-w-full divide-y divide-border">
                          <thead className="bg-muted">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Item Name *</th>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground w-24">Qty *</th>
                              <th className="px-4 py-2 text-center text-xs font-semibold text-muted-foreground w-16">Action</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-border">
                            {itemRows.map((row, index) => (
                              <tr key={index}>
                                <td className="px-4 py-2">
                                  <Input
                                    aria-label={`Item name, row ${index + 1}`}
                                    placeholder="Enter item name..."
                                    value={row.item}
                                    onChange={(e) => handleItemRowChange(index, "item", e.target.value)}
                                    className="w-full border-border rounded text-sm h-8"
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
                                    aria-label={`Quantity, row ${index + 1}`}
                                    placeholder="Qty"
                                    value={row.qty}
                                    onChange={(e) => handleItemRowChange(index, "qty", e.target.value)}
                                    className="w-full border-border rounded text-sm h-8"
                                    required={index === 0}
                                  />
                                </td>
                                <td className="px-4 py-2 text-center">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => handleDeleteItemRow(index)}
                                    aria-label={`Delete row ${index + 1}`}
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
                        <Label htmlFor="vc-remarks-no" className="text-muted-foreground font-medium">Remarks</Label>
                        <Textarea id="vc-remarks-no"
                          placeholder="Enter remarks..."
                          value={formData.remarks || ""}
                          onChange={(e) => handleInputChange("remarks", e.target.value)}
                          className="border border-input rounded-lg py-2 px-3"
                          rows={3}
                        />
                      </div>
                    </div>
                  )}

                  <div className="md:col-span-2 flex justify-end space-x-4 pt-6 border-t border-border">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowSolutionModal(false);
                        setIsVideoCallSolved(false);
                      }}
                      data-testid="button-cancel-solution"
                      className="px-6"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      data-testid="button-submit-solution"
                      disabled={isSubmitting}
                      className="px-6"
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
                    <Label htmlFor="vc-remarks-cancel">Remarks</Label>
                    <Textarea id="vc-remarks-cancel"
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
                      disabled={cancelSubmit}
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
