import { useState, useEffect } from "react";
import { ListToolbar, ListTable } from "../../components/shared";
import { useClientList } from "../../hooks/useClientList";
import { useToast } from "../../hooks/use-toast";
import { supabase } from "../../lib/supabase/client";
import { COLUMNS } from "./columns";
import SiteVisitOtpModal from "./SiteVisitOtpModal";

export default function SiteVisitOTPVerification() {
  const [verifyTicket, setVerifyTicket] = useState(null);
  const { toast } = useToast();

  const [pendingData, setPendingData] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const fetchData = async () => {
    setFetchLoading(true);
    setLoadError(null);
    try {
      // Tickets ready for OTP Verification (tada.otp_verification_planned set).
      const { data: tadaRows, error: tadaError } = await supabase
        .from("sss_tada")
        .select("ticket_id, ticket_uuid, travel_date, return_date, otp_verification_planned")
        .not("otp_verification_planned", "is", null)
        .order("created_at", { ascending: false });

      if (tadaError) throw tadaError;

      const ticketIds = [...new Set((tadaRows || []).map((t) => t.ticket_id))];

      if (ticketIds.length === 0) {
        setPendingData([]);
        setHistoryData([]);
        return;
      }

      const tadaByTicket = new Map((tadaRows || []).map((t) => [t.ticket_id, t]));

      const { data: ticketsData, error: ticketsError } = await supabase
        .from("sss_tickets")
        .select("*")
        .in("ticket_id", ticketIds)
        .order("created_at", { ascending: true });

      if (ticketsError) throw ticketsError;

      const { data: otpRows, error: otpError } = await supabase
        .from("sss_otp_verification")
        .select("*")
        .in("ticket_id", ticketIds);

      if (otpError) throw otpError;

      const otpByTicket = new Map((otpRows || []).map((o) => [o.ticket_id, o]));

      const pending = [];
      const history = [];

      (ticketsData || []).forEach((t) => {
        const tada = tadaByTicket.get(t.ticket_id);

        const base = {
          ticketId: t.ticket_id,
          ticketUuid: t.uuid,
          timeStemp: t.created_at || "",
          clientName: t.client_name || "",
          companyName: t.company_name || "",
          phoneNumber: t.phone_number || "",
          machineName: t.machine_name || "",
          engineerAssign: t.engineer_assign || "",
          CREName: t.cre_name || "",
          travelDate: tada?.travel_date || "",
          returnDate: tada?.return_date || "",
          // Live/regeneratable OTP for this stage (tickets.site_visit_otp,
          // migration 0032) — separate from tickets.otp (Video-Call's own).
          siteVisitOtp: t.site_visit_otp || "",
        };

        const otp = otpByTicket.get(t.ticket_id);
        if (otp) {
          history.push({
            ...base,
            siteVisitDate: otp.site_visit_date || "",
            otpVerification: otp.otp_entered || "",
            serviceReportFile: otp.service_report_file || "",
            quatationReceive: otp.quotation_receive_file || "",
            video: otp.video_link || "",
            locallyPurchasedSpares: otp.locally_purchased_spares || "",
            remarks: otp.remarks || "",
            delayMinutes: otp.delay_minutes,
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
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApprovalClick = (ticket) => setVerifyTicket(ticket);

  const list = useClientList({
    key: "site-visit-otp",
    data: { pending: pendingData, history: historyData },
    loading: fetchLoading,
    error: loadError,
    onRetry: fetchData,
    searchKeys: ["ticketId", "clientName", "companyName", "phoneNumber"],
    filters: [
      { key: "engineer", label: "Engineer", allLabel: "All Engineers", get: (r) => r.engineerAssign, tabs: ["pending"] },
      { key: "spares", label: "Locally Purchased Spares", allLabel: "All Spares", get: (r) => r.locallyPurchasedSpares, tabs: ["history"] },
    ],
    columns: COLUMNS,
  });

  return (
    <div className="space-y-3">
      <ListToolbar list={list} searchPlaceholder="Search by ticket ID, client, company or phone..." />
      <ListTable
        list={list}
        ctx={{ onVerify: handleApprovalClick }}
        rowKey={(r) => r.ticketId}
        emptyTitle={{ pending: "No pending site visit verifications found.", history: "No site visit verification history found." }}
        ariaLabel="Site visit OTP verifications"
      />

      {verifyTicket && (
        <SiteVisitOtpModal
          key={verifyTicket.ticketId}
          ticket={verifyTicket}
          onClose={() => setVerifyTicket(null)}
          onSaved={fetchData}
        />
      )}
    </div>
  );
}
