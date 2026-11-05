import { useState, useEffect } from "react";
import { Button } from "../../components/ui/button";
import { ListToolbar, ListTable } from "../../components/shared";
import { useClientList } from "../../hooks/useClientList";
import { useToast } from "../../hooks/use-toast";
import { Calendar } from "lucide-react";
import VisitCalendarModal from "../../components/VisitCalendarModal";
import { supabase } from "../../lib/supabase/client";
import { fetchDropdownRows } from "../../lib/supabase/dropdown";
import { fetchEngineerNames } from "../../lib/supabase/engineers";
import { COLUMNS } from "./columns";
import SiteVisitPlanForm from "./SiteVisitPlanForm";
import TodayAvailabilityModal from "./TodayAvailabilityModal";

export default function SiteVisitPlan() {
  const [planTicket, setPlanTicket] = useState(null);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [isTodayAvailabilityOpen, setIsTodayAvailabilityOpen] = useState(false);
  const { toast } = useToast();

  const [masterData, setMasterData] = useState({});

  const [pendingData, setPendingData] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [calendarHistoryData, setCalendarHistoryData] = useState([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

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

  const handlePlanClick = (ticket) => setPlanTicket(ticket);

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
        filtersInDialog
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
              Visit Calendar
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

      {planTicket && (
        <SiteVisitPlanForm
          key={planTicket.ticketId}
          ticket={planTicket}
          masterData={masterData}
          onClose={() => setPlanTicket(null)}
          onSaved={fetchData}
          onCancelled={(ticketId) => setPendingData((prev) => prev.filter((t) => t.ticketId !== ticketId))}
        />
      )}

      {/* Visit Calendar Modal */}
      <VisitCalendarModal
        isOpen={isCalendarModalOpen}
        onClose={() => setIsCalendarModalOpen(false)}
        allData={calendarHistoryData}
        masterData={masterData}
      />

      {isTodayAvailabilityOpen && (
        <TodayAvailabilityModal
          onClose={() => setIsTodayAvailabilityOpen(false)}
          masterData={masterData}
          calendarHistoryData={calendarHistoryData}
        />
      )}
    </div>
  );
}
