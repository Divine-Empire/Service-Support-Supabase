import { useState } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import TimePicker12 from "../../components/ui/time-picker-12";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Modal } from "../../components/ui/modal";
import { Textarea } from "../../components/ui/textarea";
import { Loader2Icon } from "lucide-react";
import { useToast } from "../../hooks/use-toast";
import { supabase } from "../../lib/supabase/client";
import { sendSiteVisitAssignedNotifications } from "../../lib/notifications/whatsapp";
import { formatDate } from "../../lib/format";

// Plan / cancel form for one pending ticket. Render it only while a ticket is selected.
// onClose closes it; onSaved runs after a saved plan (the page reloads its lists);
// onCancelled(ticketId) runs after a cancellation (the page drops the ticket from Pending).
export default function SiteVisitPlanForm({ ticket, masterData, onClose, onSaved, onCancelled }) {
  const selectedTicket = ticket;
  const { toast } = useToast();
  const [isCancelled, setIsCancelled] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cancelSubmit, setCancelSubmit] = useState(false);
  const [formData, setFormData] = useState(() => ({
      ticketId: ticket.ticketId,
      clientName: ticket.clientName,
      phoneNumber: ticket.phoneNumber,
      enquiryReceiverName: ticket.enquiryReceiverName || "",
      warrantyCheck: ticket.warrantyCheck || "",
      machineName: ticket.machineName || "",
      engineerAssign: ticket.engineerAssign || "",
      siteName: ticket.siteAddress || ticket.siteName || "",
      dateOfVisit: "",
      transportation: "",
      travelTime: "",
  }));

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from("sss_site_visit").insert({
        ticket_id: selectedTicket.ticketId,
        ticket_uuid: selectedTicket.ticketUuid,
        engineer_assign: formData.engineerAssign || selectedTicket.engineerAssign || null,
        date_of_visit: formData.dateOfVisit || null,
        travel_time: formData.travelTime || null,
        transportation: formData.transportation || null,
        // Readiness stamp for the next stage (not yet identified/migrated) —
        // placeholder until a real calculation rule is given.
        tada_planned: new Date().toISOString(),
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Ticket details saved successfully",
      });

      // Fire-and-forget: a WhatsApp failure should never block this
      // submission, which has already succeeded at this point.
      const assignedEngineer = formData.engineerAssign || selectedTicket.engineerAssign;
      if (assignedEngineer) {
        sendSiteVisitAssignedNotifications({
          clientPhoneNumber: selectedTicket.phoneNumber,
          clientName: selectedTicket.clientName,
          companyName: selectedTicket.companyName,
          ticketId: selectedTicket.ticketId,
          engineerName: assignedEngineer,
          visitDateStr: formatDate(formData.dateOfVisit),
          siteAddress: formData.siteName || selectedTicket.siteAddress,
        }).then(({ success, error, engineerNotified, engineerError }) => {
          if (!success) {
            toast({
              title: "WhatsApp notification not sent",
              description: error || "Ticket was updated, but the client could not be notified over WhatsApp.",
              variant: "destructive",
            });
          }
          if (!engineerNotified) {
            toast({
              title: "Engineer not notified over WhatsApp",
              description: engineerError || `No WhatsApp number on file for ${assignedEngineer}.`,
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
        cancelled_from_stage: "Site Visit Plan",
        remarks: formData.cancelRemarks || null,
      });

      if (error) throw error;

      // Removes it from the page's own pending list only; it is not excluded from any other
      // stage's pending query (see migration 0046's comment).
      onCancelled(selectedTicket.ticketId);

      toast({
        title: "Success",
        description: "Ticket cancelled successfully",
      });
      onClose();
    } catch (error) {
      console.error("Error cancelling ticket:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to cancel ticket",
        variant: "destructive",
      });
    } finally {
      setCancelSubmit(false);
    }
  };

  return (
      <Modal
        isOpen
        onClose={onClose}
        title="Site Visit Plan"
        size="2xl"
      >
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 gap-4 md:grid-cols-2"
        >
          <div className="mb-10 flex items-center space-x-2">
            <input
              type="checkbox"
              id="cancelTicket"
              checked={isCancelled}
              onChange={(e) => setIsCancelled(e.target.checked)}
              className="h-4 w-4 rounded border-input accent-destructive"
            />
            <Label htmlFor="cancelTicket" className="font-medium text-destructive">
              Cancel Ticket
            </Label>
          </div>

          <div></div>

          {/* Pre-filled fields */}
          <div>
            <Label htmlFor="svp-ticketId">Ticket ID</Label>
            <Input id="svp-ticketId" value={formData.ticketId || ""} disabled className="bg-muted" />
          </div>
          <div>
            <Label htmlFor="svp-clientName">Client Name</Label>
            <Input id="svp-clientName" value={formData.clientName || ""} disabled className="bg-muted" />
          </div>
          <div>
            <Label htmlFor="svp-phoneNumber">Phone Number</Label>
            <Input id="svp-phoneNumber" value={formData.phoneNumber || ""} disabled className="bg-muted" />
          </div>
          <div>
            <Label htmlFor="svp-machineName">Machine Name</Label>
            <Input id="svp-machineName" value={formData.machineName || ""} disabled className="bg-muted" />
          </div>

          {!isCancelled && (
            <>
              <div>
                <Label htmlFor="svp-engineerAssign">Engineer Assign</Label>
                <Select
                  value={formData.engineerAssign || undefined}
                  onValueChange={(value) =>
                    handleInputChange("engineerAssign", value)
                  }
                >
                  <SelectTrigger id="svp-engineerAssign" data-testid="select-person-name">
                    <SelectValue placeholder={formData.engineerAssign || "Select Engineer"} />
                  </SelectTrigger>
                  <SelectContent className="rounded-md border border-border bg-white shadow-lg">
                    {masterData.length > 0 &&
                      masterData[0]["Engineer Assign Name"] ? (
                      masterData[0]["Engineer Assign Name"].map((item, ind) => (
                        <SelectItem key={ind} value={item}>
                          {item}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="Loading" disabled>
                        Loading options...
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="svp-siteName">Site Name</Label>
                <Input id="svp-siteName" value={formData.siteName || ""} disabled className="bg-muted" />
              </div>

              {/* Editable fields */}
              <div>
                <Label htmlFor="svp-dateOfVisit">Travel Date *</Label>
                <Input
                  id="svp-dateOfVisit"
                  type="date"
                  value={formData.dateOfVisit || ""}
                  onChange={(e) =>
                    handleInputChange("dateOfVisit", e.target.value)
                  }
                  data-testid="input-visit-date"
                  required
                />
              </div>

              <div>
                <Label id="svp-travelTime-label">Travel-Time (AM/PM) *</Label>
                <div role="group" aria-labelledby="svp-travelTime-label">
                  <TimePicker12
                    value={formData.travelTime || ""}
                    onChange={(val) => handleInputChange("travelTime", val)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="svp-transportation">Transportation *</Label>
                <Select
                  value={formData.transportation || undefined}
                  onValueChange={(value) =>
                    handleInputChange("transportation", value)
                  }
                >
                  <SelectTrigger id="svp-transportation" data-testid="select-transportation">
                    <SelectValue placeholder="Select transportation" />
                  </SelectTrigger>
                  <SelectContent className="rounded-md border border-border bg-white shadow-lg">
                    {["By Bus", "By Train", "By Air", "By Personal Vehicle"].map(
                      (item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-3 pt-4 md:col-span-2">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  data-testid="button-submit-plan"
                >
                  {isSubmitting && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
                  Submit
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={isSubmitting}
                  data-testid="button-cancel-plan"
                >
                  Cancel
                </Button>
              </div>
            </>
          )}

          {isCancelled && (
            <>
              <div>
                <Label htmlFor="svp-cancelRemarks">Remarks</Label>
                <Textarea
                  id="svp-cancelRemarks"
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
                  variant="destructive"
                  onClick={handleSubmitCancel}
                  disabled={cancelSubmit}
                  className="px-8 py-3"
                >
                  {cancelSubmit && (
                    <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Confirm Cancellation
                </Button>
              </div>
            </>
          )}
        </form>
      </Modal>
  );
}
