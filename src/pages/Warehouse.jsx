import { useState, useEffect } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
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
import { useToast } from "../hooks/use-toast";
import { supabase } from "../lib/supabase/client";
import { fetchEngineerNames } from "../lib/supabase/engineers";
import { computeStagePlanned } from "../lib/supabase/stagePlanning";
import { formatDate, formatDelayLabel, delayTone } from "../lib/format";

const PRIORITY_TONE = { high: "danger", medium: "warning" };

// Pending: Action + ticket/enquiry columns. History: what was booked + delay.
const COLUMNS = [
  { key: "action", label: "Action", fixed: true, tabs: ["pending"], cell: (r, { onProcess }) => (
    <Button onClick={() => onProcess(r)} size="sm" className="font-semibold">PROCESS</Button>
  ) },
  { key: "date", label: "Date", defaultVisible: true, strong: true, text: (r) => formatDate(r.timeStemp) },
  { key: "ticketId", label: "Ticket-ID", defaultVisible: true, strong: true, text: (r) => r.ticketId },
  { key: "sourceOfEnquiry", label: "Source of enquiry", defaultVisible: true, tabs: ["pending"], text: (r) => r.sourceOfEnquiry },
  { key: "callType", label: "Call type", defaultVisible: true, tabs: ["pending"], text: (r) => r.callType },
  { key: "enquiryReceiverName", label: "Receiver Name", defaultVisible: true, tabs: ["pending"], text: (r) => r.enquiryReceiverName },
  { key: "companyName", label: "Company Name", defaultVisible: true, text: (r) => r.companyName },
  { key: "clientName", label: "Client Name", defaultVisible: true, text: (r) => r.clientName },
  { key: "machineName", label: "Machine Name", defaultVisible: true, text: (r) => r.machineName },
  { key: "assignedEngineer", label: "Assigned Engineer", defaultVisible: true, tabs: ["history"], text: (r) => r.assignedEngineer },
  { key: "priority", label: "Priority", defaultVisible: true, tabs: ["history"], cell: (r) => (
    <StatusBadge tone={PRIORITY_TONE[r.priority?.toLowerCase()] || "success"}>{r.priority || "Low"}</StatusBadge>
  ) },
  { key: "dateOfRepair", label: "Date of Repair", defaultVisible: true, tabs: ["history"], text: (r) => formatDate(r.dateOfRepair) },
  { key: "remarks", label: "Remarks", defaultVisible: true, tabs: ["history"], wrap: true, width: 200, text: (r) => r.remarks },
  { key: "actualDate", label: "Actual Date", defaultVisible: true, tabs: ["history"], text: (r) => formatDate(r.actual7) },
  { key: "delay", label: "Delay", defaultVisible: true, tabs: ["history"], cell: (r) => (
    <StatusBadge tone={delayTone(r.delayMinutes)}>{formatDelayLabel(r.delayMinutes)}</StatusBadge>
  ) },
];

const EMPTY_FORM = { assignedEngineer: "", priority: "", dateOfRepair: "", remarks: "" };

export default function Warehouse() {
  const [showModal, setShowModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const [pendingData, setPendingData] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [engineers, setEngineers] = useState([]);
  const { toast } = useToast();

  // Engineer names now come from Master > Engineer Contacts, not the old
  // 'engineer_assign_name' dropdown category — see engineers.js.
  const fetchEngineers = async () => {
    try {
      const names = await fetchEngineerNames();
      setEngineers(names);
    } catch (e) {
      console.error("Error fetching engineers:", e);
    }
  };

  const fetchData = async () => {
    setFetchLoading(true);
    setLoadError(null);
    try {
      // Tickets ready for Warehouse (warranty_check.warehouse_planned set —
      // only true when tickets.video_call != 'Yes').
      const { data: warrantyRows, error: warrantyError } = await supabase
        .from("sss_warranty_check")
        .select("ticket_id, warehouse_planned")
        .not("warehouse_planned", "is", null);

      if (warrantyError) throw warrantyError;

      const ticketIds = [...new Set((warrantyRows || []).map((w) => w.ticket_id))];

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

      const { data: warehouseRows, error: warehouseError } = await supabase
        .from("sss_warehouse")
        .select("*")
        .in("ticket_id", ticketIds);

      if (warehouseError) throw warehouseError;

      const warehouseByTicket = new Map((warehouseRows || []).map((w) => [w.ticket_id, w]));

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
          companyName: t.company_name || "",
          clientName: t.client_name || "",
          phoneNumber: t.phone_number || "",
          machineName: t.machine_name || "",
          CREName: t.cre_name || "",
          engineerAssign: t.engineer_assign || "",
        };

        const w = warehouseByTicket.get(t.ticket_id);
        if (w) {
          history.push({
            ...base,
            assignedEngineer: w.assigned_engineer || "",
            priority: w.priority || "",
            dateOfRepair: w.date_of_repair || "",
            remarks: w.remarks || "",
            actual7: w.created_at || "",
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

  useEffect(() => {
    fetchEngineers();
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const list = useClientList({
    key: "warehouse",
    data: { pending: pendingData, history: historyData },
    loading: fetchLoading,
    error: loadError,
    onRetry: fetchData,
    searchKeys: ["ticketId", "clientName", "companyName", "phoneNumber"],
    filters: [
      { key: "priority", label: "Priority", allLabel: "All Priorities", get: (r) => r.priority, tabs: ["history"] },
      { key: "engineer", label: "Engineer", allLabel: "All Engineers", get: (r) => r.assignedEngineer, tabs: ["history"] },
    ],
    columns: COLUMNS,
  });

  const handleProcessClick = (ticket) => {
    setSelectedTicket(ticket);
    setFormData(EMPTY_FORM);
    setShowModal(true);
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.assignedEngineer) {
      toast({
        title: "Validation Error",
        description: "Please assign an engineer.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const submittedAt = new Date();
      // Readiness stamp for the Engineer-Dashboard's own "Repair Status"
      // stage (engg_dsb_repair_status, migration 0055) — sss_warehouse has
      // no separate actual/completion column, so this insert IS the
      // completion event.
      const enggDsbRepairStatusPlanned = await computeStagePlanned("enggDsbRepairStatus", {
        warehouseSubmittedAt: submittedAt,
      });

      const { error } = await supabase.from("sss_warehouse").insert({
        ticket_id: selectedTicket.ticketId,
        ticket_uuid: selectedTicket.ticketUuid,
        assigned_engineer: formData.assignedEngineer,
        priority: formData.priority || null,
        date_of_repair: formData.dateOfRepair || null,
        remarks: formData.remarks || null,
        engg_dsb_repair_status_planned: enggDsbRepairStatusPlanned,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Warehouse process details saved successfully",
      });
      setShowModal(false);
      fetchData();
    } catch (error) {
      console.error("Error submitting form:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit details",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <ListToolbar list={list} searchPlaceholder="Search by ticket, client, company or phone..." />
      <ListTable
        list={list}
        ctx={{ onProcess: handleProcessClick }}
        rowKey={(r) => r.ticketId}
        emptyTitle={{ pending: "No pending warehouse repair bookings.", history: "No warehouse history entries." }}
        ariaLabel="Warehouse tickets"
      />

      {/* Warehouse processing modal form */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={`Process Warehouse Booking (${selectedTicket?.ticketId})`}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-white rounded-lg">
          <div className="space-y-2">
            <Label htmlFor="assignedEngineer">Assigned Engineer</Label>
            <Select
              value={formData.assignedEngineer || undefined}
              onValueChange={(val) => handleInputChange("assignedEngineer", val)}
            >
              <SelectTrigger id="assignedEngineer" className="w-full">
                <SelectValue placeholder="Select Engineer" />
              </SelectTrigger>
              <SelectContent className="bg-white border border-slate-200 shadow-md">
                {engineers.map((eng) => (
                  <SelectItem key={eng} value={eng}>
                    {eng}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select
              value={formData.priority}
              onValueChange={(val) => handleInputChange("priority", val)}
            >
              <SelectTrigger id="priority" className="w-full">
                <SelectValue placeholder="Select Priority" />
              </SelectTrigger>
              <SelectContent className="bg-white border border-slate-200 shadow-md">
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="Low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dateOfRepair">Date of Repair</Label>
            <Input
              id="dateOfRepair"
              type="date"
              value={formData.dateOfRepair}
              onChange={(e) => handleInputChange("dateOfRepair", e.target.value)}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="remarks">Remarks</Label>
            <Textarea
              id="remarks"
              value={formData.remarks}
              onChange={(e) => handleInputChange("remarks", e.target.value)}
              className="w-full min-h-[80px]"
              placeholder="Enter remarks..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowModal(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Submit"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
