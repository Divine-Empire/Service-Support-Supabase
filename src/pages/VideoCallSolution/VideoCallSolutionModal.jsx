import { useState } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Modal } from "../../components/ui/modal";
import { Textarea } from "../../components/ui/textarea";
import { Loader2Icon, LoaderIcon } from "lucide-react";
import { useToast } from "../../hooks/use-toast";
import { supabase } from "../../lib/supabase/client";
import {
  sendVideoCallRescheduledNotifications,
  sendVideoCallOtpResendNotification,
} from "../../lib/notifications/whatsapp";
import { formatDate, formatTime12hr } from "../../lib/format";
import ItemQtyGrid from "./ItemQtyGrid";

// Last OTP time per ticket (localStorage). A missing, corrupt or non-object value reads as {}.
const readOtpGenerations = () => {
  try {
    const v = JSON.parse(localStorage.getItem("lastOtpGenerations") || "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
};

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

// Solution / reschedule / cancel form for one pending ticket. Render it only while a ticket is
// selected. onClose closes it; onSaved runs after a saved attempt (page reloads its lists);
// onCancelled(ticketId) runs after a cancellation (page drops the ticket from Pending).
export default function VideoCallSolutionModal({ ticket, masterData, alternateEngineerOptions, onClose, onSaved, onCancelled }) {
  const { toast } = useToast();
  // Local copy: Resend OTP stores the fresh OTP on it so the verify step uses it without a reload.
  const [selectedTicket, setSelectedTicket] = useState(ticket);
  const [lastOtpGenerations, setLastOtpGenerations] = useState(readOtpGenerations);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);
  const [cancelSubmit, setCancelSubmit] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isVideoCallSolved, setIsVideoCallSolved] = useState(false);
  const [itemRows, setItemRows] = useState([{ item: "", qty: "" }]);
  const [formData, setFormData] = useState(() => ({
    videoCallServicesSolve: "",
    otpVerification: "",
    remarks: "",
    cancelRemarks: "",
    serviceType: ticket.serviceType || "",
    audioUrl: ticket.audioUrl || "",
    rescheduledDateTime: "",
    alternateEngineer: "",
  }));

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

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
      onClose();
      onSaved();
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

      // Removes it from the page's own pending list only (see migration 0046's comment).
      onCancelled(selectedTicket.ticketId);
      onClose();
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
      const storedGenerations = readOtpGenerations();
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

  return (
      <Modal
        isOpen
        onClose={onClose}
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
                      <ItemQtyGrid
                        handleAddItemRow={handleAddItemRow}
                        itemRows={itemRows}
                        handleItemRowChange={handleItemRowChange}
                        masterData={masterData}
                        handleDeleteItemRow={handleDeleteItemRow}
                      />

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
                      onClick={onClose}
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
  );
}
