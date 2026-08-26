import { useState, useEffect, useMemo } from "react";
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
import { Loader2Icon, LoaderIcon, Calendar } from "lucide-react";
import { Textarea } from "../components/ui/textarea";
import VisitCalendarModal from "../components/VisitCalendarModal";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { supabase } from "../lib/supabase/client";
import { fetchDropdownRows } from "../lib/supabase/dropdown";

const PREMIUM_COLORS = [
  { bg: "bg-emerald-50 text-emerald-700 border-emerald-200", badge: "bg-emerald-100 text-emerald-800" },
  { bg: "bg-indigo-50 text-indigo-700 border-indigo-200", badge: "bg-indigo-100 text-indigo-800" },
  { bg: "bg-amber-50 text-amber-700 border-amber-200", badge: "bg-amber-100 text-amber-800" },
  { bg: "bg-rose-50 text-rose-700 border-rose-200", badge: "bg-rose-100 text-rose-800" },
  { bg: "bg-sky-50 text-sky-700 border-sky-200", badge: "bg-sky-100 text-sky-800" },
  { bg: "bg-violet-50 text-violet-700 border-violet-200", badge: "bg-violet-100 text-violet-800" },
  { bg: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200", badge: "bg-fuchsia-100 text-fuchsia-800" },
  { bg: "bg-cyan-50 text-cyan-700 border-cyan-200", badge: "bg-cyan-100 text-cyan-800" },
  { bg: "bg-teal-50 text-teal-700 border-teal-200", badge: "bg-teal-100 text-teal-800" },
  { bg: "bg-orange-50 text-orange-700 border-orange-200", badge: "bg-orange-100 text-orange-800" },
];

const getEngineerColor = (name) => {
  if (!name) return { bg: "bg-slate-50 text-slate-700 border-slate-200", badge: "bg-slate-100 text-slate-800" };
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PREMIUM_COLORS[Math.abs(hash) % PREMIUM_COLORS.length];
};

const IST_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

const getISTComponents = (date) => {
  const parts = {};
  IST_FORMATTER.formatToParts(date).forEach((p) => {
    if (p.type !== "literal") parts[p.type] = parseInt(p.value, 10);
  });
  return { year: parts.year, month: parts.month - 1, day: parts.day };
};

const parseIST = (dateStr) => {
  if (!dateStr || typeof dateStr !== "string") return null;

  if (dateStr.includes("T") || dateStr.endsWith("Z")) {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return getISTComponents(d);
    return null;
  }

  if (dateStr.includes("/")) {
    const datePart = dateStr.split(" ")[0];
    const parts = datePart.split("/");
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      let year = parseInt(parts[2], 10);
      if (year < 100) year += 2000;
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) return { day, month, year };
    }
  }

  if (dateStr.includes("-")) {
    const datePart = dateStr.split(" ")[0];
    const parts = datePart.split("-");
    if (parts.length === 3 && parts[0].length === 4) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) return { day, month, year };
    }
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) return { day, month, year };
    }
  }

  return null;
};

const formatMinutesToTime = (min) => {
  const totalMin = min + 9 * 60;
  let hrs = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  const ampm = hrs >= 12 ? "PM" : "AM";
  hrs = hrs % 12;
  if (hrs === 0) hrs = 12;
  const minStr = String(mins).padStart(2, "0");
  return `${hrs}:${minStr} ${ampm}`;
};

const formatCallTime = (timeStr) => {
  if (!timeStr) return "";
  const str = String(timeStr).trim();

  // If it's a full ISO format, e.g. "1899-12-30T14:30:00.000Z"
  if (str.includes("T")) {
    const timePart = str.split("T")[1];
    const parts = timePart.split(":");
    if (parts.length >= 2) {
      return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}`;
    }
  }

  // If it's in format "HH:MM:SS"
  const parts = str.split(":");
  if (parts.length >= 2) {
    const hh = parts[0].trim().padStart(2, "0");
    const mm = parts[1].trim().padStart(2, "0");
    if (!isNaN(hh) && !isNaN(mm)) {
      return `${hh}:${mm}`;
    }
  }

  // Regex match for HH:MM with optional AM/PM
  const match = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = match[2];
    const ampm = match[3];
    if (ampm) {
      if (ampm.toUpperCase() === "PM" && hours < 12) {
        hours += 12;
      } else if (ampm.toUpperCase() === "AM" && hours === 12) {
        hours = 0;
      }
    }
    return `${String(hours).padStart(2, "0")}:${minutes}`;
  }

  return str;
};

export default function SiteVisitPlan() {
  const [activeTab, setActiveTab] = useState("pending");
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [formData, setFormData] = useState({});
  const [searchItem, setSearchItem] = useState("");
  const [cancelRemarks, setCancelRemarks] = useState("");
  const [isCancelled, setIsCancelled] = useState(false);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [isTodayAvailabilityOpen, setIsTodayAvailabilityOpen] = useState(false);
  const { toast } = useToast();

  const [masterData, setMasterData] = useState({});

  // console.log("followUpData",followUpData);

  const [pendingData, setPendingData] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [calendarHistoryData, setCalendarHistoryData] = useState([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Still used for the "Cancel Ticket" flow only (writes to the separate
  // "Cancel" sheet) — not part of the ticket pipeline tables, not migrated yet.
  const sheet_url = import.meta.env.VITE_APPS_SCRIPT_API;

  const fetchData = async () => {
    setFetchLoading(true);
    try {
      // Tickets ready for Site Visit Plan (follow_up.site_visit_planned set).
      const { data: followUpRows, error: followUpError } = await supabase
        .from("follow_up")
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
        .from("tickets")
        .select("*")
        .in("ticket_id", ticketIds)
        .order("created_at", { ascending: true });

      if (ticketsError) throw ticketsError;

      const { data: siteVisitRows, error: siteVisitError } = await supabase
        .from("site_visit")
        .select("*")
        .in("ticket_id", ticketIds);

      if (siteVisitError) throw siteVisitError;

      const siteVisitByTicket = new Map(
        (siteVisitRows || []).map((s) => [s.ticket_id, s])
      );

      // Warranty Check is display-only here — joined from its owning stage.
      const { data: warrantyRows, error: warrantyError } = await supabase
        .from("warranty_check")
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
        };

        const sv = siteVisitByTicket.get(t.ticket_id);
        if (sv) {
          history.push({
            ...base,
            engineerAssign: sv.engineer_assign || base.engineerAssign,
            dateOfVisit: sv.date_of_visit || "",
            travelDate: sv.date_of_visit || "",
            travelTime: sv.travel_time || "",
            transportation: sv.transportation || "",
            expectedCompletionDate: sv.date_of_visit || "",
            type: "Site Visit",
          });
        } else {
          pending.push(base);
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
    engineer_assign_name: "Engineer Assign Name",
    transportation: "Transportation(drop-down)",
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
      const { error } = await supabase.from("site_visit").insert({
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

    const currentDateTime = formatDateTime(new Date());

    try {
      const rowData = [
        currentDateTime,
        selectedTicket.ticketId || "", // Call Type
        selectedTicket.clientName || "", // Enquiry Receiver Name
        selectedTicket.phoneNumber || "", // Warranty Check
        selectedTicket.emailAddress || "", // Bill Number Input
        selectedTicket.category || "", // Bill Number Input

        selectedTicket.title || "", // Machine Name
        selectedTicket.description || "", // Machine Name
        "Site Visit Plan", // Enquiry Type (second one)
        formData.cancelRemarks || "",
      ];

      // console.log("rowDAta", formData);

      const response = await fetch(sheet_url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          sheetName: "Cancel",
          action: "insert",
          rowData: JSON.stringify(rowData),
        }),
      });

      const result = await response.json();

      if (result.success) {
        // setTickets([...tickets, newTicket]);
        setPendingData((prevPending) =>
          prevPending.filter(
            (ticket) => ticket.ticketId !== selectedTicket.ticketId
          )
        );

        toast({
          title: "Success",
          description: "Ticket details Cancle successfully",
        });
        setShowPlanModal(false);
        setIsCancelled(false);
      } else {
        throw new Error(result.error || "Failed to save ticket");
      }
    } catch (error) {
      console.error("Error submitting ticket:", error);
      toast({
        title: "Error",
        description: "Failed to save ticket. Data stored locally.",
        variant: "destructive",
      });

      // setTickets([...tickets, newTicket]);
    } finally {
      setCancelSubmit(false);
      // setShowForm(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";

    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are 0-indexed
    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
  };

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
  ) : filteredPendingDataa;

  const filteredHistoryData = role === "user" ? filteredHistoryDataa.filter(
    (item) => item["CREName"] === userName
  ) : filteredHistoryDataa;

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
      const { segments, statusText, isPendingTADA } = getTodayAvailability(eng);
      
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
              <Button
                onClick={() => setIsCalendarModalOpen(true)}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md flex items-center gap-2"
                data-testid="btn-view-visit-calendar"
              >
                <Calendar className="h-4 w-4" />
                View Visit Calendar
              </Button>
              <Button
                onClick={() => setIsTodayAvailabilityOpen(true)}
                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md flex items-center gap-2"
                data-testid="btn-view-today-availability"
              >
                <Calendar className="h-4 w-4" />
                Today's Availability
              </Button>
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
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Client Type
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[200px] sticky top-0">
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
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Warranty Check
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Engineer Assign
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-blue-100">
                      {filteredPendingData.length === 0 ? (
                        <tr>
                          <td
                            colSpan={18}
                            className="text-center py-8 bg-white"
                            data-testid="text-no-pending"
                          >
                            {fetchLoading ? (
                              <div className="flex justify-center items-center text-blue-700">
                                <LoaderIcon className="animate-spin w-8 h-8" />
                              </div>
                            ) : (
                              <h1 className="text-blue-700">
                                No pending site visit plans found.
                              </h1>
                            )}
                          </td>
                        </tr>
                      ) : (
                        filteredPendingData.map((ticket, indx) => (
                          <tr
                            key={indx}
                            className={
                              indx % 2 === 0 ? "bg-blue-50/50" : "bg-white"
                            }
                          >
                            <td className="px-4 py-3">
                              <Button
                                size="sm"
                                onClick={() => handlePlanClick(ticket)}
                                variant="outline"
                                className="bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-600 hover:from-blue-100 hover:to-indigo-100 hover:text-blue-700 transition-all duration-300 border border-blue-200 hover:border-blue-300 rounded-lg px-3 py-1.5 shadow-sm hover:shadow-md group"
                                data-testid={`button-plan-${ticket.ticketId}`}
                              >
                                <span className="font-medium">PLAN</span>
                              </Button>
                            </td>
                            <td className="px-4 py-3 font-medium text-blue-800">
                              {formatDate(ticket.timeStemp)}
                            </td>
                            <td className="px-4 py-3 font-medium text-blue-800">
                              {ticket.ticketId}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.sourceOfEnquiry || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.callType || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.enquiryReceiverName || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.clientType || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.companyName || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.clientName || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.phoneNumber || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.siteAddress || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.gstNo || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.machineName || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.category || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.mentionIssue || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.serviceLocation || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.warrantyCheck || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.engineerAssign || ""}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>

                  {/* Mobile Card View */}
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
                            No pending site visit plans found.
                          </h1>
                        )}
                      </div>
                    ) : (
                      filteredPendingData.map((ticket, indx) => (
                        <Card
                          key={indx}
                          className={`${indx % 2 === 0 ? "bg-blue-50/50" : "bg-white"
                            } border-l-4 border-l-blue-500`}
                        >
                          <CardContent className="p-4 space-y-3">
                            {/* Header with Ticket ID and Action */}
                            <div className="flex justify-between items-start">
                              <div>
                                <h3 className="font-bold text-blue-800 text-lg">
                                  {ticket.ticketId}
                                </h3>
                                <p className="text-sm text-gray-600">
                                  {ticket.clientName}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                onClick={() => handlePlanClick(ticket)}
                                variant="outline"
                                className="bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-600 hover:from-blue-100 hover:to-indigo-100 border border-blue-200"
                              >
                                PLAN
                              </Button>
                            </div>

                            {/* Contact & Receiver Info */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Phone
                                </p>
                                <p className="text-blue-900">
                                  {ticket.phoneNumber}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Enquiry Receiver
                                </p>
                                <p className="text-blue-900">
                                  {ticket.enquiryReceiverName}
                                </p>
                              </div>
                            </div>

                            {/* Technical Details */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Warranty
                                </p>
                                <p className="text-blue-900">
                                  {ticket.warrantyCheck}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Machine
                                </p>
                                <p className="text-blue-900">
                                  {ticket.machineName || "N/A"}
                                </p>
                              </div>
                            </div>

                            {/* Engineer & Site */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Engineer
                                </p>
                                <p className="text-blue-900">
                                  {ticket.engineerAssign || "N/A"}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Site Name
                                </p>
                                <p className="text-blue-900">
                                  {ticket.siteName || "N/A"}
                                </p>
                              </div>
                            </div>

                            {/* Enquiry Type */}
                            <div>
                              <p className="text-gray-500 font-medium text-sm">
                                Enquiry Type
                              </p>
                              <p className="text-blue-900">
                                {ticket.enquiryType}
                              </p>
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
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Client Type
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[200px] sticky top-0">
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
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Engineer Assign
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Travel Date
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Transportation
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-blue-100">
                      {filteredHistoryData.length === 0 ? (
                        <tr>
                          <td
                            colSpan={18}
                            className="text-center py-8 bg-white"
                            data-testid="text-no-history"
                          >
                            {fetchLoading ? (
                              <div className="flex justify-center items-center text-blue-700">
                                <LoaderIcon className="animate-spin w-8 h-8" />
                              </div>
                            ) : (
                              <h1 className="text-blue-700">
                                No site visit plan history found.
                              </h1>
                            )}
                          </td>
                        </tr>
                      ) : (
                        filteredHistoryData.map((ticket, indx) => (
                          <tr
                            key={indx}
                            className={
                              indx % 2 === 0 ? "bg-blue-50/50" : "bg-white"
                            }
                          >
                            <td className="px-4 py-3 font-medium text-blue-800">
                              {formatDate(ticket.timeStemp)}
                            </td>
                            <td className="px-4 py-3 font-medium text-blue-800">
                              {ticket.ticketId}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.sourceOfEnquiry || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.callType || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.enquiryReceiverName || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.clientType || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.companyName || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.clientName || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.phoneNumber || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.siteAddress || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.gstNo || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.machineName || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.category || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.mentionIssue || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.serviceLocation || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.engineerAssign || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {formatDate(ticket.dateOfVisit) || ""}
                            </td>
                            <td className="px-4 py-3">
                              <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                                {ticket.transportation || ""}
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
                            No site visit plan history found.
                          </h1>
                        )}
                      </div>
                    ) : (
                      filteredHistoryData.map((ticket, indx) => (
                        <Card
                          key={indx}
                          className={`${indx % 2 === 0 ? "bg-blue-50/50" : "bg-white"
                            } border-l-4 border-l-blue-500`}
                        >
                          <CardContent className="p-4 space-y-3">
                            {/* Header */}
                            <div>
                              <h3 className="font-bold text-blue-800 text-lg">
                                {ticket.ticketId}
                              </h3>
                              <p className="text-sm text-gray-600">
                                {ticket.clientName}
                              </p>
                            </div>

                            {/* Contact & Machine Info */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Phone
                                </p>
                                <p className="text-blue-900">
                                  {ticket.phoneNumber}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Machine
                                </p>
                                <p className="text-blue-900">
                                  {ticket.machineName || "N/A"}
                                </p>
                              </div>
                            </div>

                            {/* Engineer & Site */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Engineer
                                </p>
                                <p className="text-blue-900">
                                  {ticket.engineerAssign || "N/A"}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Site Name
                                </p>
                                <p className="text-blue-900">
                                  {ticket.siteName || "N/A"}
                                </p>
                              </div>
                            </div>

                            {/* Visit Details */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Travel Date
                                </p>
                                <p className="text-blue-900">
                                  {formatDate(ticket.dateOfVisit) || "N/A"}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Transportation
                                </p>
                                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                  {ticket.transportation || "N/A"}
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

      {/* Site Visit Plan Modal */}
      <Modal
        isOpen={showPlanModal}
        onClose={() => setShowPlanModal(false)}
        title="Site Visit Plan"
        size="2xl"
      >
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <div className="flex items-center space-x-2 mb-10">
            <input
              type="checkbox"
              id="cancelTicket"
              checked={isCancelled}
              onChange={(e) => setIsCancelled(e.target.checked)}
              className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
            />
            <Label htmlFor="cancelTicket" className="text-red-600 font-medium">
              Cancel Ticket
            </Label>
          </div>

          <div></div>

          {/* Pre-filled fields */}
          <div>
            <Label>Ticket ID</Label>
            <Input
              value={formData.ticketId || ""}
              disabled
              className="bg-slate-50"
            />
          </div>
          <div>
            <Label>Client Name</Label>
            <Input
              value={formData.clientName || ""}
              disabled
              className="bg-slate-50"
            />
          </div>
          <div>
            <Label>Phone Number</Label>
            <Input
              value={formData.phoneNumber || ""}
              disabled
              className="bg-slate-50"
            />
          </div>
          <div>
            <Label>Machine Name</Label>
            <Input
              value={formData.machineName || ""}
              disabled
              className="bg-slate-50"
            />
          </div>

          {!isCancelled && (
            <>
              <div>
                <Label>Engineer Assign</Label>
                <Select
                  value={formData.engineerAssign || undefined}
                  onValueChange={(value) =>
                    handleInputChange("engineerAssign", value)
                  }
                >
                  <SelectTrigger
                    className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    data-testid="select-person-name"
                  >
                    <SelectValue placeholder={formData.engineerAssign || "Select Engineer"} />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-gray-300 rounded-md shadow-lg">
                    {masterData.length > 0 &&
                      masterData[0]["Engineer Assign Name"] ? (
                      masterData[0]["Engineer Assign Name"].map((item, ind) => (
                        <SelectItem
                          key={ind}
                          value={item}
                          className="hover:bg-blue-50 focus:bg-blue-50"
                        >
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
                <Label>Site Name</Label>
                <Input
                  value={formData.siteName || ""}
                  disabled
                  className="bg-slate-50"
                />
              </div>

              {/* Editable fields */}
              <div>
                <Label>Travel Date *</Label>
                <Input
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
                <Label>Travel-Time *</Label>
                <Input
                  type="time"
                  value={formData.travelTime || ""}
                  onChange={(e) =>
                    handleInputChange("travelTime", e.target.value)
                  }
                  required
                />
              </div>

              <div>
                <Label>Transportation *</Label>
                <Select
                  onValueChange={(value) =>
                    handleInputChange("transportation", value)
                  }
                >
                  <SelectTrigger
                    className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    data-testid="select-person-name"
                  >
                    <SelectValue placeholder="Select transportation" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-gray-300 rounded-md shadow-lg">
                    {masterData.length > 0 &&
                      masterData[0]["Transportation(drop-down)"] ? (
                      masterData[0]["Transportation(drop-down)"].map(
                        (item, ind) => (
                          <SelectItem
                            key={ind}
                            value={item}
                            className="hover:bg-blue-50 focus:bg-blue-50"
                          >
                            {item}
                          </SelectItem>
                        )
                      )
                    ) : (
                      <SelectItem value="Loading" disabled>
                        Loading options...
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-2 flex space-x-4 pt-4">
                <Button
                  type="submit"
                  data-testid="button-submit-plan"
                  className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-70 disabled:transform-none"
                >
                  {isSubmitting && <Loader2Icon className="animate-spin" />}
                  Submit
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowPlanModal(false)}
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
      </Modal>

      {/* Visit Calendar Modal */}
      <VisitCalendarModal
        isOpen={isCalendarModalOpen}
        onClose={() => setIsCalendarModalOpen(false)}
        allData={role === "user" ? calendarHistoryData.filter((item) => !item["CREName"] || item["CREName"] === userName) : calendarHistoryData}
        masterData={masterData}
      />

      {/* Today's Availability Dialog Modal */}
      <Modal
        isOpen={isTodayAvailabilityOpen}
        onClose={() => setIsTodayAvailabilityOpen(false)}
        title="Today's Engineer Availability (9 AM - 7 PM)"
        size="3xl"
      >
        <div className="bg-white rounded-lg p-6 max-h-[80vh] overflow-y-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="text-sm text-slate-500">
              Availability view for today: <strong>{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></span> Available</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-rose-500 rounded-full"></span> Busy</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-amber-500 rounded-full"></span> Times Pending</span>
            </div>
          </div>

          {/* Availability Stacked Bar Chart */}
          <div className="bg-slate-50/50 rounded-xl p-4 border border-slate-100 shadow-sm">
            <h4 className="text-xs font-bold text-slate-700 mb-2 px-1">Availability Breakdown (Hours)</h4>
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
