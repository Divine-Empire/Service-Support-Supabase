import { useState, useEffect, useMemo } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import TimePicker12 from "../components/ui/time-picker-12";
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
import { Loader2Icon, Calendar } from "lucide-react";
import { Textarea } from "../components/ui/textarea";
import VisitCalendarModal from "../components/VisitCalendarModal";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { supabase } from "../lib/supabase/client";
import { fetchDropdownRows } from "../lib/supabase/dropdown";
import { fetchEngineerNames } from "../lib/supabase/engineers";
import { sendSiteVisitAssignedNotifications } from "../lib/notifications/whatsapp";
import { parseIST } from "../lib/dateIST";
import { formatDate } from "../lib/format";

// Engineer cell: current engineer, plus the "Rescheduled" log on pending rows (migration 0054).
const engineerCell = (r) => {
  if (!r.engineerAssign && !r.wasRescheduled) return null;
  return (
    <div>
      {r.engineerAssign}
      {r.wasRescheduled && (
        <div
          className="mt-1 flex flex-col items-start gap-0.5"
          title={r.rescheduleLog
            .map(
              (log) =>
                `${log.engineerAssign || "N/A"} — rescheduled ${formatDate(log.rescheduledAt)}${log.rescheduledBy ? ` by ${log.rescheduledBy}` : ""}${log.remarks ? `: ${log.remarks}` : ""}`
            )
            .join("\n")}
        >
          <StatusBadge tone="warning">Rescheduled</StatusBadge>
          <span className="text-[11px] text-muted-foreground">
            Previously: {r.lastAssignedEngineer || "N/A"}
            {r.rescheduledAt ? ` (${formatDate(r.rescheduledAt)})` : ""}
          </span>
          {r.rescheduleRemarks && (
            <span className="text-[11px] text-muted-foreground">Reason: {r.rescheduleRemarks}</span>
          )}
        </div>
      )}
    </div>
  );
};

// Pending: Action + ticket columns. History: the booked visit (travel date, transportation).
const COLUMNS = [
  { key: "action", label: "Action", fixed: true, tabs: ["pending"], cell: (r, { onPlan }) => (
    <Button size="sm" variant="outline" onClick={() => onPlan(r)} data-testid={`button-plan-${r.ticketId}`} className="font-semibold">
      PLAN
    </Button>
  ) },
  { key: "date", label: "Date", defaultVisible: true, strong: true, text: (r) => formatDate(r.timeStemp) },
  { key: "ticketId", label: "Ticket-ID", defaultVisible: true, strong: true, text: (r) => r.ticketId },
  { key: "enquiryType", label: "Enquiry Type", defaultVisible: true, text: (r) => r.enquiryType },
  { key: "sourceOfEnquiry", label: "Source of enquiry", defaultVisible: false, text: (r) => r.sourceOfEnquiry },
  { key: "callType", label: "Call type", defaultVisible: false, text: (r) => r.callType },
  { key: "enquiryReceiverName", label: "Enquiry Receiver Name", defaultVisible: false, text: (r) => r.enquiryReceiverName },
  { key: "clientType", label: "Client Type", defaultVisible: false, text: (r) => r.clientType },
  { key: "companyName", label: "Company Name", defaultVisible: true, text: (r) => r.companyName },
  { key: "clientName", label: "Client Name", defaultVisible: true, text: (r) => r.clientName },
  { key: "phoneNumber", label: "Phone Number", defaultVisible: true, text: (r) => r.phoneNumber },
  { key: "siteAddress", label: "Site Address", defaultVisible: false, wrap: true, width: 200, text: (r) => r.siteAddress },
  { key: "gstNo", label: "GST No.", defaultVisible: false, text: (r) => r.gstNo },
  { key: "machineName", label: "Machine Name", defaultVisible: true, text: (r) => r.machineName },
  { key: "category", label: "Category", defaultVisible: false, text: (r) => r.category },
  { key: "mentionIssue", label: "Mention Issue", defaultVisible: false, wrap: true, width: 200, text: (r) => r.mentionIssue },
  { key: "serviceLocation", label: "Service Location", defaultVisible: false, text: (r) => r.serviceLocation },
  { key: "warrantyCheck", label: "Warranty Check", defaultVisible: true, tabs: ["pending"], text: (r) => r.warrantyCheck },
  { key: "engineerAssign", label: "Engineer Assign", defaultVisible: true, cell: engineerCell },
  { key: "travelDate", label: "Travel Date", defaultVisible: true, tabs: ["history"], text: (r) => formatDate(r.dateOfVisit) },
  { key: "transportation", label: "Transportation", defaultVisible: true, tabs: ["history"], cell: (r) =>
    r.transportation ? <StatusBadge tone="info">{r.transportation}</StatusBadge> : null },
];

export default function SiteVisitPlan() {
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [formData, setFormData] = useState({});
  const [isCancelled, setIsCancelled] = useState(false);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [isTodayAvailabilityOpen, setIsTodayAvailabilityOpen] = useState(false);
  const { toast } = useToast();

  const [masterData, setMasterData] = useState({});

  const [pendingData, setPendingData] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [calendarHistoryData, setCalendarHistoryData] = useState([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    setFetchLoading(true);
    setLoadError(null);
    try {
      // Tickets ready for Site Visit Plan (follow_up.site_visit_planned set).
      const { data: followUpRows, error: followUpError } = await supabase
        .from("sss_follow_up")
        .select("ticket_id, site_visit_planned")
        .not("site_visit_planned", "is", null)
        .order("created_at", { ascending: false });

      if (followUpError) throw followUpError;

      // Latest non-null site_visit_planned per ticket.
      const ticketIds = [...new Set((followUpRows || []).map((f) => f.ticket_id))];

      if (ticketIds.length === 0) {
        setPendingData([]);
        setHistoryData([]);
        setCalendarHistoryData([]);
        return;
      }

      const { data: ticketsData, error: ticketsError } = await supabase
        .from("sss_tickets")
        .select("*")
        .in("ticket_id", ticketIds)
        .order("created_at", { ascending: true });

      if (ticketsError) throw ticketsError;

      // Unfiltered — a ticket can now have more than one row (each a past
      // assignment attempt; see migration 0054's Reschedule flow). Group per
      // ticket below into the current active plan (if any) plus a log of
      // rescheduled ones.
      const { data: siteVisitRows, error: siteVisitError } = await supabase
        .from("sss_site_visit")
        .select("*")
        .in("ticket_id", ticketIds)
        .order("created_at", { ascending: true });

      if (siteVisitError) throw siteVisitError;

      const siteVisitRowsByTicket = new Map();
      (siteVisitRows || []).forEach((s) => {
        if (!siteVisitRowsByTicket.has(s.ticket_id)) siteVisitRowsByTicket.set(s.ticket_id, []);
        siteVisitRowsByTicket.get(s.ticket_id).push(s);
      });

      // Warranty Check is display-only here — joined from its owning stage.
      const { data: warrantyRows, error: warrantyError } = await supabase
        .from("sss_warranty_check")
        .select("ticket_id, warranty_check")
        .in("ticket_id", ticketIds);

      if (warrantyError) throw warrantyError;

      const warrantyByTicket = new Map(
        (warrantyRows || []).map((w) => [w.ticket_id, w.warranty_check])
      );

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
          gstNo: t.gst_no || "",
          machineName: t.machine_name || "",
          category: t.category || "",
          mentionIssue: t.mention_issue || "",
          serviceLocation: t.service_location || "",
          CREName: t.cre_name || "",
          engineerAssign: t.engineer_assign || "",
          siteName: t.site_address || "",
          warrantyCheck: warrantyByTicket.get(t.ticket_id) || "",
          enquiryType: t.enquiry_type || "",
        };

        const rows = siteVisitRowsByTicket.get(t.ticket_id) || [];
        const activeSv = rows.find((s) => !s.rescheduled_at);
        const rescheduledRows = rows.filter((s) => s.rescheduled_at);

        if (activeSv) {
          history.push({
            ...base,
            engineerAssign: activeSv.engineer_assign || base.engineerAssign,
            dateOfVisit: activeSv.date_of_visit || "",
            travelDate: activeSv.date_of_visit || "",
            travelTime: activeSv.travel_time || "",
            transportation: activeSv.transportation || "",
            expectedCompletionDate: activeSv.date_of_visit || "",
            type: "Site Visit",
          });
        } else {
          // No active plan — either never planned, or every past attempt was
          // rescheduled. In the latter case, surface a "Rescheduled" tag +
          // last-assigned-engineer log on the pending row (migration 0054).
          const lastReschedule = rescheduledRows[rescheduledRows.length - 1];
          pending.push({
            ...base,
            wasRescheduled: rescheduledRows.length > 0,
            lastAssignedEngineer: lastReschedule?.engineer_assign || "",
            rescheduledAt: lastReschedule?.rescheduled_at || "",
            rescheduledBy: lastReschedule?.rescheduled_by || "",
            rescheduleRemarks: lastReschedule?.reschedule_remarks || "",
            rescheduleLog: rescheduledRows.map((s) => ({
              engineerAssign: s.engineer_assign || "",
              dateOfVisit: s.date_of_visit || "",
              rescheduledAt: s.rescheduled_at || "",
              rescheduledBy: s.rescheduled_by || "",
              remarks: s.reschedule_remarks || "",
            })),
          });
        }
      });

      setPendingData(pending);
      setHistoryData(history);
      // Video-Call and "Repair Status" stage scheduling data aren't in
      // Supabase yet (Repair Status hasn't been migrated at all), so the
      // engineer-availability calendar/chart only reflects Site Visit
      // history for now — narrower than the old sheet-based version until
      // those stages are migrated too.
      setCalendarHistoryData(history);
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

  const DROPDOWN_CATEGORY_TO_KEY = {
    transportation: "Transportation(drop-down)",
  };

  const fetchMasterSheet = async () => {
    try {
      const [data, engineerNames] = await Promise.all([
        fetchDropdownRows(Object.keys(DROPDOWN_CATEGORY_TO_KEY)),
        fetchEngineerNames(),
      ]);

      const structuredData = {};
      (data || []).forEach(({ category, value }) => {
        const key = DROPDOWN_CATEGORY_TO_KEY[category];
        if (!key) return;
        if (!structuredData[key]) structuredData[key] = [];
        structuredData[key].push(value);
      });

      // Engineer names now come from Master > Engineer Contacts, not the
      // old 'engineer_assign_name' dropdown category — see engineers.js.
      structuredData["Engineer Assign Name"] = engineerNames;

      setMasterData([structuredData]);
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
    fetchMasterSheet();
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePlanClick = (ticket) => {
    setSelectedTicket(ticket);
    setFormData({
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
    });
    setShowPlanModal(true);
  };

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

      setShowPlanModal(false);
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
        cancelled_from_stage: "Site Visit Plan",
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

      toast({
        title: "Success",
        description: "Ticket cancelled successfully",
      });
      setShowPlanModal(false);
      setIsCancelled(false);
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

  const engineersList = useMemo(() => {
    const masterEngs = masterData[0]?.["Engineer Assign Name"] || [];
    if (masterEngs.length > 0) return [...new Set(masterEngs)].sort();
    return [...new Set(calendarHistoryData.map((t) => t.engineerAssign).filter(Boolean))].sort();
  }, [masterData, calendarHistoryData]);

  const getTodayAvailability = (engineer) => {
    const today = new Date();
    const cellDate = {
      day: today.getDate(),
      month: today.getMonth(),
      year: today.getFullYear(),
    };

    const busyMinutes = new Array(600).fill(false);
    let statusText = "Available all day (9 AM - 7 PM)";
    let isPendingTADA = false;

    // Filter tickets assigned to this engineer
    const engVisits = calendarHistoryData.filter(ticket => 
      ticket.engineerAssign && 
      String(ticket.engineerAssign).toLowerCase() === String(engineer).toLowerCase()
    );

    const cellVal = cellDate.year * 10000 + (cellDate.month + 1) * 100 + cellDate.day;

    for (const ticket of engVisits) {
      if (!ticket.dateOfVisit) continue;
      const parsedVisit = parseIST(ticket.dateOfVisit);
      if (!parsedVisit) continue;
      
      const parsedTravel = ticket.travelDate ? parseIST(ticket.travelDate) : null;
      const visitVal = parsedTravel ? (parsedTravel.year * 10000 + (parsedTravel.month + 1) * 100 + parsedTravel.day) : (parsedVisit.year * 10000 + (parsedVisit.month + 1) * 100 + parsedVisit.day);

      const rawCompDate = ticket.expectedCompletionDate || ticket.returnDate;
      const rawCompTime = ticket.expectedCompletionTime;

      let compVal = visitVal;

      if (rawCompDate) {
        const parsedComp = parseIST(rawCompDate);
        if (parsedComp) {
          compVal = parsedComp.year * 10000 + (parsedComp.month + 1) * 100 + parsedComp.day;
        }
      }

      // If selected date (today) is outside of [visitVal, compVal], ignore this ticket
      if (cellVal < visitVal || cellVal > compVal) {
        continue;
      }

      const formatDateLabel = (dateStr) => {
        if (!dateStr) return "";
        const parsed = parseIST(dateStr);
        if (!parsed) return dateStr;
        const monthsShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return `${parsed.day} ${monthsShort[parsed.month]}`;
      };

      const formatTime12h = (timeStr) => {
        if (!timeStr) return "";
        const parts = timeStr.split(":");
        if (parts.length < 2) return timeStr;
        let hrs = parseInt(parts[0], 10);
        const mins = parseInt(parts[1], 10);
        if (isNaN(hrs) || isNaN(mins)) return timeStr;
        const ampm = hrs >= 12 ? "PM" : "AM";
        hrs = hrs % 12;
        if (hrs === 0) hrs = 12;
        const minsStr = String(mins).padStart(2, "0");
        return `${hrs}:${minsStr} ${ampm}`;
      };

      const getRelativeMinutes = (timeStr) => {
        if (!timeStr) return 600;
        const parts = timeStr.split(":");
        if (parts.length < 2) return 600;
        const hours = parseInt(parts[0], 10);
        const minutes = parseInt(parts[1], 10);
        if (isNaN(hours) || isNaN(minutes)) return 600;
        const totalMinutes = hours * 60 + minutes;
        const nineAM = 9 * 60; // 540
        return Math.max(0, Math.min(600, totalMinutes - nineAM));
      };

      if (ticket.type === "Video Call") {
        const timeStr = rawCompTime || "10:00";
        const startMin = getRelativeMinutes(timeStr);
        const endMin = startMin + 30; // 30 mins slot
        for (let m = startMin; m < Math.min(600, endMin); m++) busyMinutes[m] = true;
        if (statusText === "Available all day (9 AM - 7 PM)") {
          statusText = `Video Call at ${formatTime12h(timeStr)}`;
        } else if (!statusText.includes("Video Call")) {
          statusText += `, Video Call`;
        }
        continue;
      }

      if (ticket.type === "Repair") {
        const startMin = 120; // 11:00 AM
        const endMin = 360;   // 3:00 PM
        for (let m = startMin; m < endMin; m++) busyMinutes[m] = true;
        if (statusText === "Available all day (9 AM - 7 PM)") {
          statusText = "Repair Stage";
        } else if (!statusText.includes("Repair")) {
          statusText += `, Repair`;
        }
        continue;
      }

      if (cellVal > visitVal && cellVal < compVal) {
        for (let m = 0; m < 600; m++) busyMinutes[m] = true;
        statusText = `Busy: expected completion on ${formatDateLabel(rawCompDate)}`;
      } else if (cellVal === visitVal && cellVal === compVal) {
        if (rawCompTime) {
          const relMins = getRelativeMinutes(rawCompTime);
          for (let m = 0; m < relMins; m++) busyMinutes[m] = true;
          statusText = `Busy until ${formatTime12h(rawCompTime)}`;
        } else {
          for (let m = 0; m < 600; m++) busyMinutes[m] = true;
          isPendingTADA = true;
          statusText = "Busy (Times Pending)";
        }
      } else if (cellVal === visitVal && cellVal < compVal) {
        for (let m = 0; m < 600; m++) busyMinutes[m] = true;
        statusText = `Busy: starts today, expected completion ${formatDateLabel(rawCompDate)}`;
      } else if (cellVal === compVal && cellVal > visitVal) {
        if (rawCompTime) {
          const relMins = getRelativeMinutes(rawCompTime);
          for (let m = 0; m < relMins; m++) busyMinutes[m] = true;
          statusText = `Busy until ${formatTime12h(rawCompTime)}`;
        } else {
          for (let m = 0; m < 600; m++) busyMinutes[m] = true;
          isPendingTADA = true;
          statusText = "Busy (Times Pending)";
        }
      }
    }

    const segments = [];
    let currentType = busyMinutes[0];
    let start = 0;
    for (let i = 1; i <= 600; i++) {
      if (i === 600 || busyMinutes[i] !== currentType) {
        segments.push({
          type: currentType ? "busy" : "free",
          start,
          end: i,
          widthPercent: ((i - start) / 600) * 100,
        });
        if (i < 600) {
          currentType = busyMinutes[i];
          start = i;
        }
      }
    }

    return { segments, statusText, isPendingTADA };
  };

  const chartData = useMemo(() => {
    return engineersList.map((eng) => {
      const { segments, isPendingTADA } = getTodayAvailability(eng);
      
      let busyHours = 0;
      let pendingHours = 0;
      let freeHours = 0;

      if (isPendingTADA) {
        pendingHours = 10;
      } else {
        segments.forEach((seg) => {
          const durationHrs = (seg.end - seg.start) / 60;
          if (seg.type === "busy") {
            busyHours += durationHrs;
          } else {
            freeHours += durationHrs;
          }
        });
      }

      return {
        name: eng,
        "Busy/Work Hours": parseFloat(busyHours.toFixed(1)),
        "Times Pending Hours": parseFloat(pendingHours.toFixed(1)),
        "Available Hours": parseFloat(freeHours.toFixed(1)),
      };
    });
  }, [engineersList, getTodayAvailability]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-slate-100 rounded-lg shadow-lg text-xs space-y-1">
          <p className="font-bold text-slate-800">{label}</p>
          {payload.map((p, idx) => (
            <p key={idx} style={{ color: p.color }} className="font-medium">
              {p.name}: {p.value} hrs
            </p>
          ))}
          <p className="text-[10px] text-slate-400 mt-1 border-t pt-1">
            Total Shift: 10 hrs (9 AM - 7 PM)
          </p>
        </div>
      );
    }
    return null;
  };

  const list = useClientList({
    key: "site-visit-plan",
    data: { pending: pendingData, history: historyData },
    loading: fetchLoading,
    error: loadError,
    onRetry: fetchData,
    searchKeys: ["ticketId", "clientName", "companyName", "phoneNumber"],
    filters: [
      { key: "engineer", label: "Engineer", allLabel: "All Engineers", get: (r) => r.engineerAssign },
      { key: "category", label: "Category", allLabel: "All Categories", get: (r) => r.category },
      { key: "enquiryType", label: "Enquiry Type", allLabel: "All Enquiry Types", get: (r) => r.enquiryType },
      { key: "transportation", label: "Transportation", allLabel: "All Transportation", get: (r) => r.transportation, tabs: ["history"] },
    ],
    columns: COLUMNS,
  });

  return (
    <div className="space-y-3">
      <ListToolbar
        list={list}
        searchPlaceholder="Search by ticket ID, client, company or phone..."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => setIsCalendarModalOpen(true)}
              data-testid="btn-view-visit-calendar"
              className="gap-2"
            >
              <Calendar className="h-4 w-4" />
              View Visit Calendar
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsTodayAvailabilityOpen(true)}
              data-testid="btn-view-today-availability"
              className="gap-2"
            >
              <Calendar className="h-4 w-4" />
              Today's Availability
            </Button>
          </>
        }
      />
      <ListTable
        list={list}
        ctx={{ onPlan: handlePlanClick }}
        rowKey={(r) => r.ticketId}
        emptyTitle={{ pending: "No pending site visit plans found.", history: "No site visit plan history found." }}
        ariaLabel="Site visit plans"
      />

      {/* Site Visit Plan Modal */}
      <Modal
        isOpen={showPlanModal}
        onClose={() => setShowPlanModal(false)}
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
                  onClick={() => setShowPlanModal(false)}
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

      {/* Visit Calendar Modal */}
      <VisitCalendarModal
        isOpen={isCalendarModalOpen}
        onClose={() => setIsCalendarModalOpen(false)}
        allData={calendarHistoryData}
        masterData={masterData}
      />

      {/* Today's Availability Dialog Modal */}
      <Modal
        isOpen={isTodayAvailabilityOpen}
        onClose={() => setIsTodayAvailabilityOpen(false)}
        title="Today's Engineer Availability (9 AM - 7 PM)"
        size="3xl"
      >
        <div className="rounded-lg bg-card p-6 max-h-[80vh] overflow-y-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
            <div className="text-sm text-muted-foreground">
              Availability view for today: <strong>{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></span> Available</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-rose-500 rounded-full"></span> Busy</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-amber-500 rounded-full"></span> Times Pending</span>
            </div>
          </div>

          {/* Availability Stacked Bar Chart */}
          <div className="bg-muted/40 rounded-xl p-4 border border-border shadow-sm">
            <h4 className="text-xs font-bold text-foreground mb-2 px-1">Availability Breakdown (Hours)</h4>
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fill: '#64748b', fontSize: 9, fontWeight: 600 }}
                    interval={0}
                    angle={-12}
                    textAnchor="end"
                    stroke="#cbd5e1"
                  />
                  <YAxis 
                    domain={[0, 10]} 
                    ticks={[0, 2, 4, 6, 8, 10]} 
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    stroke="#cbd5e1"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="Busy/Work Hours" stackId="availability" fill="#f43f5e" name="Busy/Work" />
                  <Bar dataKey="Times Pending Hours" stackId="availability" fill="#f59e0b" name="Times Pending" />
                  <Bar dataKey="Available Hours" stackId="availability" fill="#10b981" name="Available" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>


        </div>
      </Modal>
    </div>
  );
}
