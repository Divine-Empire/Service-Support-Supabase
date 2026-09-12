import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { useToast } from "../hooks/use-toast";
import { Loader2Icon, LoaderIcon, Mail } from "lucide-react";
import { supabase } from "../lib/supabase/client";
import { sendTadaApprovalEmail } from "../lib/notifications/email";

// Internal visibility for this page is entirely handled by the existing
// Page Access mechanism (Settings.jsx / Sidebar.jsx) — nothing special is
// done here. Assign "TADA Approval" to admin + whichever specific user
// should see it, from Settings.
export default function TadaApproval() {
  const [activeTab, setActiveTab] = useState("pending");
  const [pendingData, setPendingData] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [searchItem, setSearchItem] = useState("");
  const [resendingTicketId, setResendingTicketId] = useState(null);
  const { toast } = useToast();

  const fetchData = async () => {
    setFetchLoading(true);
    try {
      const { data: approvalRows, error: approvalError } = await supabase
        .from("sss_senior_approval")
        .select("*")
        .order("sent_at", { ascending: false });

      if (approvalError) throw approvalError;

      const ticketIds = [...new Set((approvalRows || []).map((a) => a.ticket_id))];

      if (ticketIds.length === 0) {
        setPendingData([]);
        setHistoryData([]);
        return;
      }

      const { data: ticketsData, error: ticketsError } = await supabase
        .from("sss_tickets")
        .select("*")
        .in("ticket_id", ticketIds);

      if (ticketsError) throw ticketsError;

      const ticketsByTicket = new Map((ticketsData || []).map((t) => [t.ticket_id, t]));

      const { data: tadaRows, error: tadaError } = await supabase
        .from("sss_tada")
        .select("*")
        .in("ticket_id", ticketIds);

      if (tadaError) throw tadaError;

      const tadaByTicket = new Map((tadaRows || []).map((t) => [t.ticket_id, t]));

      const pending = [];
      const history = [];

      (approvalRows || []).forEach((a) => {
        const t = ticketsByTicket.get(a.ticket_id) || {};
        const tada = tadaByTicket.get(a.ticket_id) || {};

        const row = {
          id: a.id,
          ticketId: a.ticket_id,
          ticketUuid: a.ticket_uuid,
          token: a.token,
          status: a.status,
          sentAt: a.sent_at,
          decidedAt: a.decided_at,
          rejectRemarks: a.reject_remarks,
          companyName: t.company_name || "",
          clientName: t.client_name || "",
          siteAddress: t.site_address || "",
          machineName: t.machine_name || "",
          engineerAssign: tada.engineer_assign || t.engineer_assign || "",
          travelDate: tada.travel_date || "",
          returnDate: tada.return_date || "",
          destination: tada.destination || "",
          purposeOfTravel: tada.purpose_of_travel || "",
          amount: tada.amount || "",
          previousAdvanceDate: tada.previous_advance_date || "",
          previousAdvanceSettlementDate: tada.previous_advance_settlement_date || "",
          previousAdvanceBalance: tada.previous_advance_balance || "",
          balanceAmount: tada.balance_amount || "",
        };

        if (a.status === "pending") {
          pending.push(row);
        } else {
          history.push(row);
        }
      });

      setPendingData(pending);
      setHistoryData(history);
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

  useEffect(() => {
    fetchData();
  }, []);

  const handleResendEmail = async (row) => {
    setResendingTicketId(row.ticketId);
    try {
      const { success, error } = await sendTadaApprovalEmail({
        token: row.token,
        ticketId: row.ticketId,
        companyName: row.companyName,
        siteAddress: row.siteAddress,
        machineName: row.machineName,
        travelDate: row.travelDate,
        returnDate: row.returnDate,
        amount: row.amount,
        purposeOfTravel: row.purposeOfTravel,
        previousAdvanceDate: row.previousAdvanceDate,
        previousAdvanceSettlementDate: row.previousAdvanceSettlementDate,
        previousAdvanceBalance: row.previousAdvanceBalance,
        balanceAmount: row.balanceAmount,
        engineerName: row.engineerAssign,
      });

      if (success) {
        // Bump sent_at so it's clear when the last resend happened.
        await supabase
          .from("sss_senior_approval")
          .update({ sent_at: new Date().toISOString() })
          .eq("id", row.id);
        toast({ title: "Success", description: `Approval email re-sent for ${row.ticketId}` });
        fetchData();
      } else {
        toast({
          title: "Error",
          description: error || "Failed to resend approval email",
          variant: "destructive",
        });
      }
    } finally {
      setResendingTicketId(null);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const filterFn = (item) => {
    const q = searchItem.toLowerCase();
    return (
      String(item.ticketId || "").toLowerCase().includes(q) ||
      String(item.clientName || "").toLowerCase().includes(q) ||
      String(item.companyName || "").toLowerCase().includes(q) ||
      String(item.engineerAssign || "").toLowerCase().includes(q)
    );
  };

  const filteredPending = pendingData.filter(filterFn);
  const filteredHistory = historyData.filter(filterFn);

  return (
    <div className="space-y-2">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardHeader className="bg-gradient-to-r from-blue-50/50 to-indigo-50/50 rounded-t-lg border-b border-blue-100 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
            <TabsList className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200">
              <TabsTrigger value="pending" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                Pending ({filteredPending.length})
              </TabsTrigger>
              <TabsTrigger value="history" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                History ({filteredHistory.length})
              </TabsTrigger>
            </TabsList>

            <div className="relative flex-1 max-w-md w-full">
              <Input
                placeholder="Search by ticket ID, client, company or engineer..."
                className="pl-3 py-2 w-full rounded-md border-blue-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white"
                value={searchItem}
                onChange={(e) => setSearchItem(e.target.value)}
              />
            </div>
          </CardHeader>

          <CardContent>
            <div className="mt-2">
              <TabsContent value="pending" className="mt-0">
                <div className="relative overflow-x-auto">
                  <div className="max-h-[calc(103vh-200px)] overflow-y-auto">
                    <table className="w-full">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-gradient-to-r from-blue-600 to-indigo-600">
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[130px] sticky top-0">Action</th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[120px] sticky top-0">Sent At</th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[120px] sticky top-0">Ticket ID</th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[200px] sticky top-0">Company Name</th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Engineer</th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Travel Date</th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Return Date</th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[120px] sticky top-0">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-blue-100">
                        {filteredPending.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="text-center py-8 bg-white">
                              {fetchLoading ? (
                                <div className="flex justify-center items-center text-blue-700">
                                  <LoaderIcon className="animate-spin w-8 h-8" />
                                </div>
                              ) : (
                                <h1 className="text-blue-700">No pending TADA approvals found.</h1>
                              )}
                            </td>
                          </tr>
                        ) : (
                          filteredPending.map((row, ind) => (
                            <tr key={row.id} className={ind % 2 === 0 ? "bg-blue-50/50" : "bg-white"}>
                              <td className="px-4 py-3">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleResendEmail(row)}
                                  disabled={resendingTicketId === row.ticketId}
                                  className="bg-gradient-to-br from-amber-50 to-orange-50 text-amber-700 hover:from-amber-100 hover:to-orange-100 border border-amber-200 rounded-lg px-3 py-1.5 shadow-sm"
                                >
                                  {resendingTicketId === row.ticketId ? (
                                    <Loader2Icon className="animate-spin w-4 h-4 mr-1" />
                                  ) : (
                                    <Mail className="w-4 h-4 mr-1" />
                                  )}
                                  Resend Email
                                </Button>
                              </td>
                              <td className="px-4 py-3 text-blue-900">{formatDate(row.sentAt)}</td>
                              <td className="px-4 py-3 font-medium text-blue-800">{row.ticketId}</td>
                              <td className="px-4 py-3 text-blue-900">{row.companyName || "-"}</td>
                              <td className="px-4 py-3 text-blue-900">{row.engineerAssign || "-"}</td>
                              <td className="px-4 py-3 text-blue-900">{formatDate(row.travelDate)}</td>
                              <td className="px-4 py-3 text-blue-900">{formatDate(row.returnDate)}</td>
                              <td className="px-4 py-3 text-blue-900">₹{row.amount || "0"}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="history" className="mt-0">
                <div className="relative overflow-x-auto">
                  <div className="max-h-[calc(103vh-200px)] overflow-y-auto">
                    <table className="w-full">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-gradient-to-r from-blue-600 to-indigo-600">
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[120px] sticky top-0">Ticket ID</th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[200px] sticky top-0">Company Name</th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Engineer</th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[120px] sticky top-0">Amount</th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[130px] sticky top-0">Status</th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Decided At</th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[250px] sticky top-0">Reject Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-blue-100">
                        {filteredHistory.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="text-center py-8 bg-white">
                              {fetchLoading ? (
                                <div className="flex justify-center items-center text-blue-700">
                                  <LoaderIcon className="animate-spin w-8 h-8" />
                                </div>
                              ) : (
                                <h1 className="text-blue-700">No TADA approval history found.</h1>
                              )}
                            </td>
                          </tr>
                        ) : (
                          filteredHistory.map((row, ind) => (
                            <tr key={row.id} className={ind % 2 === 0 ? "bg-blue-50/50" : "bg-white"}>
                              <td className="px-4 py-3 font-medium text-blue-800">{row.ticketId}</td>
                              <td className="px-4 py-3 text-blue-900">{row.companyName || "-"}</td>
                              <td className="px-4 py-3 text-blue-900">{row.engineerAssign || "-"}</td>
                              <td className="px-4 py-3 text-blue-900">₹{row.amount || "0"}</td>
                              <td className="px-4 py-3">
                                <span
                                  className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                    row.status === "approved"
                                      ? "bg-green-100 text-green-800"
                                      : "bg-red-100 text-red-800"
                                  }`}
                                >
                                  {row.status === "approved" ? "Approved" : "Rejected"}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-blue-900">{formatDate(row.decidedAt)}</td>
                              <td className="px-4 py-3 text-blue-900">{row.rejectRemarks || ""}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </TabsContent>
            </div>
          </CardContent>
        </Card>
      </Tabs>
    </div>
  );
}
