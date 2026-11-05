import { useState, useEffect, useMemo } from "react";
import { ListToolbar, ListTable } from "../../components/shared";
import { useClientList } from "../../hooks/useClientList";
import useAuth from "../../hooks/useAuth";
import { useToast } from "../../hooks/use-toast";
import { supabase } from "../../lib/supabase/client";
import { fetchDropdownRows } from "../../lib/supabase/dropdown";
import { fetchEngineerNames } from "../../lib/supabase/engineers";
import { fetchItemNames } from "../../lib/supabase/items";
import { COLUMNS, otpLabel, solvedLabel } from "./columns";
import VideoCallSolutionModal from "./VideoCallSolutionModal";

export default function VideoCallSolution() {
  const { isAdmin } = useAuth();
  const [solutionTicket, setSolutionTicket] = useState(null);
  const [masterData, setMasterData] = useState({});

  const [pendingData, setPendingData] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const { toast } = useToast();

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

  const handleSolutionClick = (ticket) => setSolutionTicket(ticket);

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
      <ListToolbar list={list} searchPlaceholder="Search by ticket ID, client, company or phone..." filtersInDialog />
      <ListTable
        list={list}
        ctx={{ onSolution: handleSolutionClick }}
        rowKey={(r) => r.ticketId}
        cardTitle={(r) => r.ticketId}
        emptyTitle={{ pending: "No pending video call solutions found.", history: "No video call solution history found." }}
        ariaLabel="Video call solutions"
      />

      {solutionTicket && (
        <VideoCallSolutionModal
          key={solutionTicket.ticketId}
          ticket={solutionTicket}
          masterData={masterData}
          alternateEngineerOptions={alternateEngineerOptions}
          onClose={() => setSolutionTicket(null)}
          onSaved={fetchData}
          onCancelled={(ticketId) => setPendingData((prev) => prev.filter((t) => t.ticketId !== ticketId))}
        />
      )}
    </div>
  );
}
