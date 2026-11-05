import { useState } from "react";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { Modal } from "../../components/ui/modal";
import { Textarea } from "../../components/ui/textarea";
import { Loader2Icon } from "lucide-react";
import useAuth from "../../hooks/useAuth";
import { useToast } from "../../hooks/use-toast";
import { supabase } from "../../lib/supabase/client";

// Confirmation to send a ticket back to Site Visit Plan. Render it only while a ticket is
// selected; `onClose` closes it, `onDone` runs after the reschedule succeeded.
export default function RescheduleModal({ ticket: rescheduleTicket, onClose, onDone }) {
  const { toast } = useToast();
  const { userName } = useAuth();
  const [rescheduleRemarks, setRescheduleRemarks] = useState("");
  const [isRescheduling, setIsRescheduling] = useState(false);

  // Marks the ticket's current (active) sss_site_visit row as rescheduled —
  // an UPDATE, not a delete, so it stays as a log/audit entry. This both
  // drops the ticket out of TADA's own pending query (tada_planned no
  // longer counts once rescheduled_at is set) and makes it pending again in
  // SiteVisitPlan.jsx (its "already planned" check only counts the active
  // row) for the admin to re-assign a different engineer. See migration 0054.
  const handleRescheduleSubmit = async (e) => {
    e.preventDefault();
    if (!rescheduleTicket) return;

    setIsRescheduling(true);
    try {
      const { error: siteVisitError } = await supabase
        .from("sss_site_visit")
        .update({
          rescheduled_at: new Date().toISOString(),
          rescheduled_by: userName || null,
          reschedule_remarks: rescheduleRemarks || null,
        })
        .eq("ticket_id", rescheduleTicket.ticketId)
        .is("rescheduled_at", null);

      if (siteVisitError) throw siteVisitError;

      // Cosmetic — keeps tickets.current_stage in sync with where the
      // ticket actually is now (back at Site Visit Plan).
      await supabase
        .from("sss_tickets")
        .update({ current_stage: "Site Visit Plan" })
        .eq("uuid", rescheduleTicket.ticketUuid);

      toast({
        title: "Rescheduled",
        description: `${rescheduleTicket.ticketId} sent back to Site Visit Plan for re-assignment.`,
      });
      onClose();
      onDone();
    } catch (error) {
      console.error("Error rescheduling ticket:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to reschedule ticket",
        variant: "destructive",
      });
    } finally {
      setIsRescheduling(false);
    }
  };

  return (
      <Modal
        isOpen
        onClose={onClose}
        title="Reschedule Site Visit"
        size="md"
      >
        <form onSubmit={handleRescheduleSubmit} className="space-y-4 p-1">
          <p className="text-sm text-muted-foreground">
            Ticket <span className="font-semibold text-foreground">{rescheduleTicket?.ticketId}</span> will be sent
            back to <span className="font-semibold text-foreground">Site Visit Plan</span>'s Pending tab for
            re-assignment to a different engineer. The current assignment (
            <span className="font-semibold text-foreground">{rescheduleTicket?.engineerAssign || "N/A"}</span>) will
            be kept as a log and tagged "Rescheduled" there.
          </p>

          <div className="space-y-1">
            <Label htmlFor="tada-rescheduleRemarks" className="text-muted-foreground">Reason (optional)</Label>
            <Textarea
              id="tada-rescheduleRemarks"
              rows={3}
              value={rescheduleRemarks}
              onChange={(e) => setRescheduleRemarks(e.target.value)}
              placeholder="Why is this being rescheduled?"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isRescheduling}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isRescheduling}>
              {isRescheduling && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Reschedule
            </Button>
          </div>
        </form>
      </Modal>
  );
}
