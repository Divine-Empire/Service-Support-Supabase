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
import { useToast } from "../../hooks/use-toast";
import { Loader2Icon, LoaderIcon } from "lucide-react";
import { supabase } from "../../lib/supabase/client";
import { computeCrmVerificationPlanned } from "../../lib/supabase/stagePlanning";
import { sendSiteVisitOtpNotification } from "../../lib/notifications/whatsapp";
import { formatDate } from "./columns";

// Send-OTP + verification form for one pending ticket. Render it only while a ticket is
// selected; onClose closes it, onSaved runs after a successful save (page reloads its lists).
export default function SiteVisitOtpModal({ ticket, onClose, onSaved }) {
  const { toast } = useToast();
  // Local copy: Send OTP stores the new OTP on it so the verify field unlocks without a reload.
  const [selectedTicket, setSelectedTicket] = useState(ticket);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  // Files are only HELD on selection; the upload happens at submit time (in parallel), so closing
  // the form never leaves an orphaned upload behind.
  const [serviceReportFile, setServiceReportFile] = useState(null);
  const [quotationReceiveFile, setQuotationReceiveFile] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [formData, setFormData] = useState(() => ({
    ticketId: ticket.ticketId,
    clientName: ticket.clientName,
    phoneNumber: ticket.phoneNumber,
    machineName: ticket.machineName || "",
    travelDate: formatDate(ticket.travelDate) || "",
    returnDate: formatDate(ticket.returnDate) || "",
    siteVisitDate: "",
    otpVerification: "",
    locallyPurchasedSpares: "",
    remarks: "",
  }));

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const uploadToStorage = async (file, prefix) => {
    const path = `otp_verification/${prefix}_${selectedTicket?.ticketId}_${Date.now()}_${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("ticket_enquiry")
      .upload(path, file, { contentType: file.type });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from("ticket_enquiry").getPublicUrl(path);
    return data.publicUrl;
  };

  // These three just HOLD the picked file — no upload happens here. Actual
  // upload happens in handleSubmit, all three in parallel, only once Submit
  // is clicked.
  const handleServiceReportChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setServiceReportFile(file);
  };

  const handleQuotationChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setQuotationReceiveFile(file);
  };

  const handleVideoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const MAX_SIZE = 100 * 1024 * 1024; // 100MB
    if (file.size > MAX_SIZE) {
      toast({ title: "Validation Error", description: "Video file size exceeds the 100MB limit.", variant: "destructive" });
      e.target.value = null;
      return;
    }

    setVideoFile(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.siteVisitDate) {
      toast({ title: "Validation Error", description: "Please Select Site Visit Date", variant: "destructive" });
      return;
    }

    const enteredOtp = (formData.otpVerification || "").toString().trim();
    const liveOtp = (selectedTicket?.siteVisitOtp || "").toString().trim();

    if (!enteredOtp) {
      toast({ title: "Validation Error", description: "Please Enter the OTP", variant: "destructive" });
      return;
    }

    // Nothing to check the entered OTP against — no OTP has ever been sent
    // for this ticket yet. Without this guard, an empty enteredOtp would
    // never reach here (caught above), but a never-resent liveOtp being ""
    // could otherwise match an accidentally-empty comparison; this makes
    // "no OTP sent yet" its own explicit, unambiguous error instead.
    if (!liveOtp) {
      toast({ title: "Validation Error", description: "No OTP has been sent for this ticket yet. Please click Send OTP first.", variant: "destructive" });
      return;
    }

    if (enteredOtp !== liveOtp) {
      toast({ title: "Validation Error", description: "Wrong OTP, Please Enter Right OTP", variant: "destructive" });
      return;
    }

    if (!serviceReportFile) {
      toast({ title: "Validation Error", description: "Please select a Service Report file first", variant: "destructive" });
      return;
    }

    if (!formData.locallyPurchasedSpares) {
      toast({ title: "Validation Error", description: "Please select Locally purchased spares option", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);

    try {
      // Uploads happen here, in parallel, only now that every
      // validation has passed.
      const [serviceReportUrl, quotationReceiveUrl, videoUrl] = await Promise.all([
        uploadToStorage(serviceReportFile, "service_report"),
        quotationReceiveFile ? uploadToStorage(quotationReceiveFile, "quotation_receive") : Promise.resolve(null),
        videoFile ? uploadToStorage(videoFile, "video") : Promise.resolve(null),
      ]);

      const crmVerificationPlanned = await computeCrmVerificationPlanned(
        selectedTicket.ticketUuid,
        new Date()
      );

      const { error } = await supabase.from("sss_otp_verification").insert({
        ticket_id: selectedTicket.ticketId,
        ticket_uuid: selectedTicket.ticketUuid,
        crm_verification_planned: crmVerificationPlanned,
        site_visit_date: formData.siteVisitDate || null,
        otp_entered: enteredOtp,
        service_report_file: serviceReportUrl,
        quotation_receive_file: quotationReceiveUrl,
        video_link: videoUrl,
        locally_purchased_spares: formData.locallyPurchasedSpares || null,
        remarks: formData.remarks || null,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Ticket details saved successfully",
      });

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

  function generateSixDigitNumber() {
    let result = "";
    for (let i = 0; i < 6; i++) {
      const digit = Math.floor(Math.random() * 10).toString();
      result += digit.toString();
    }
    return result;
  }

  // Sent exactly once per ticket — no resend. Saves the OTP to
  // sss_tickets.site_visit_otp (the source of truth that both gates the
  // OTP Verification field and is checked against at Submit), then
  // notifies the client over WhatsApp. A WhatsApp failure is reported but
  // never rolled back — the OTP already exists in the DB, so the field
  // still unlocks; the coordinator can share it manually if needed.
  const handleSendOtp = async () => {
    setIsSendingOtp(true);
    const sixDigitNumber = generateSixDigitNumber();

    try {
      const { error } = await supabase
        .from("sss_tickets")
        .update({ site_visit_otp: sixDigitNumber })
        .eq("uuid", selectedTicket.ticketUuid);

      if (error) throw error;

      setSelectedTicket((prev) => ({
        ...prev,
        siteVisitOtp: sixDigitNumber,
      }));

      toast({
        title: "Success",
        description: "OTP saved. Sending WhatsApp notification...",
      });

      const { success, error: sendError } = await sendSiteVisitOtpNotification({
        clientPhoneNumber: selectedTicket.phoneNumber,
        clientName: selectedTicket.clientName,
        otp: sixDigitNumber,
      });

      if (!success) {
        toast({
          title: "WhatsApp notification not sent",
          description: sendError || "OTP was saved, but the WhatsApp message could not be sent. Please share it manually.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "OTP sent to the client over WhatsApp",
        });
      }
    } catch (error) {
      console.error("Error sending OTP:", error);
      toast({
        title: "Error",
        description: "Failed to save/send OTP",
        variant: "destructive",
      });
    } finally {
      setIsSendingOtp(false);
    }
  };

  return (
      <Modal
        isOpen
        onClose={onClose}
        title="Site Visit (Verification OTP)"
        size="2xl"
      >
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <div>
            <Label htmlFor="otp-ticketId">Ticket ID</Label>
            <Input
              id="otp-ticketId"
              value={formData.ticketId || ""}
              disabled
              className="bg-muted"
            />
          </div>
          <div>
            <Label htmlFor="otp-clientName">Client Name</Label>
            <Input
              id="otp-clientName"
              value={formData.clientName || ""}
              disabled
              className="bg-muted"
            />
          </div>
          <div>
            <Label htmlFor="otp-phoneNumber">Phone Number</Label>
            <Input
              id="otp-phoneNumber"
              value={formData.phoneNumber || ""}
              disabled
              className="bg-muted"
            />
          </div>
          <div>
            <Label htmlFor="otp-machineName">Machine Name</Label>
            <Input
              id="otp-machineName"
              value={formData.machineName || ""}
              disabled
              className="bg-muted"
            />
          </div>

          <div>
            <Label htmlFor="otp-travelDate">Travel Date</Label>
            <Input
              id="otp-travelDate"
              value={formData.travelDate || ""}
              disabled
              className="bg-muted"
            />
          </div>
          <div>
            <Label htmlFor="otp-returnDate">Return Date</Label>
            <Input
              id="otp-returnDate"
              value={formData.returnDate || ""}
              disabled
              className="bg-muted"
            />
          </div>

          {/* Editable fields */}
          <div>
            <Label htmlFor="otp-siteVisitDate">Site Visit Date *</Label>
            <Input
              id="otp-siteVisitDate"
              type="date"
              value={formData.siteVisitDate || ""}
              onChange={(e) =>
                handleInputChange("siteVisitDate", e.target.value)
              }
              data-testid="input-site-visit-date"
            />
          </div>
          <div>
            <Label htmlFor="otp-otpVerification">OTP Verification *</Label>
            <Input
              id="otp-otpVerification"
              required
              maxLength={6}
              placeholder={selectedTicket?.siteVisitOtp ? "Enter 6-digit OTP" : "Send OTP to the client first"}
              value={formData.otpVerification || ""}
              onChange={(e) =>
                handleInputChange("otpVerification", e.target.value)
              }
              disabled={!selectedTicket?.siteVisitOtp}
              data-testid="input-otp"
            />

            {!selectedTicket?.siteVisitOtp && (
              <div className="w-full flex justify-center items-center flex-col mt-2">
                <Button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={isSendingOtp}
                  data-testid="button-send-otp"
                  className="w-full"
                >
                  {isSendingOtp ? (
                    <span className="flex items-center">
                      <LoaderIcon className="animate-spin mr-2 w-4 h-4" />
                      Sending OTP...
                    </span>
                  ) : (
                    "Send OTP"
                  )}
                </Button>
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="otp-serviceReport">Service Report (upload file) *</Label>
            <Input
              id="otp-serviceReport"
              type="file"
              onChange={handleServiceReportChange}
              disabled={isSubmitting}
              data-testid="input-serviceReport-file"
            />
            {serviceReportFile && (
              <p className="text-xs text-success mt-1 truncate">Selected: {serviceReportFile.name}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="otp-quatationReceive">Quatation Receive</Label>
            <Input
              id="otp-quatationReceive"
              type="file"
              onChange={handleQuotationChange}
              disabled={isSubmitting}
              data-testid="input-quatation-receive"
            />
            {quotationReceiveFile && (
              <p className="text-xs text-success mt-1 truncate">Selected: {quotationReceiveFile.name}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="otp-video">Video (max 100MB)</Label>
            {videoFile ? (
              <div className="flex items-center justify-between border border-input rounded-md p-2 bg-muted text-foreground text-sm h-10">
                <span className="font-semibold truncate max-w-[200px]">{videoFile.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setVideoFile(null)}
                  disabled={isSubmitting}
                  className="text-destructive hover:text-destructive h-8 px-2 py-1 text-xs font-semibold"
                >
                  Remove
                </Button>
              </div>
            ) : (
              <Input
                id="otp-video"
                type="file"
                accept="video/*"
                onChange={handleVideoChange}
                disabled={isSubmitting}
              />
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="otp-spares">Locally purchased spares *</Label>
            <Select
              value={formData.locallyPurchasedSpares || ""}
              onValueChange={(value) => handleInputChange("locallyPurchasedSpares", value)}
            >
              <SelectTrigger id="otp-spares">
                <SelectValue placeholder="Select option" />
              </SelectTrigger>
              <SelectContent className="bg-white rounded-lg border-gray-200 shadow-lg">
                <SelectItem value="Yes" className="hover:bg-gray-50">Yes</SelectItem>
                <SelectItem value="No" className="hover:bg-gray-50">No</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="otp-remarks">Remarks</Label>
            <Input
              id="otp-remarks"
              type="text"
              placeholder="Enter Remarks"
              value={formData.remarks || ""}
              onChange={(e) => handleInputChange("remarks", e.target.value)}
              data-testid="input-remarks"
            />
          </div>

          <div className="md:col-span-2 flex space-x-4 pt-4">
            <Button
              type="submit"
              disabled={isSubmitting}
              data-testid="button-submit-approval"
              className="px-6"
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
              onClick={onClose}
              data-testid="button-cancel-approval"
            >
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
  );
}
