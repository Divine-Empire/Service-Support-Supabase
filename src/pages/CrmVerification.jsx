import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Modal } from "../components/ui/modal";
import { useToast } from "../hooks/use-toast";
import { Loader2Icon, LoaderIcon } from "lucide-react";
import { supabase } from "../lib/supabase/client";
import { computeStagePlanned } from "../lib/supabase/stagePlanning";

// CRM Verification — site-visit tickets after OTP Verification.
//   Pending: sss_otp_verification.crm_verification_planned set and no
//            sss_crm_verification row for the ticket yet.
//   History: a sss_crm_verification row exists.
// Submitting generates invoice_planned (Invoice TAT), except for FOC orders
// (follow-up 'Order Received' row payment_mode = 'FOC'), which stop here.
export default function CrmVerification() {
  const [activeTab, setActiveTab] = useState("pending");
  const [pendingData, setPendingData] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [searchItem, setSearchItem] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const fetchData = async () => {
    setFetchLoading(true);
    try {
      const { data: otpRows, error: otpError } = await supabase
        .from("sss_otp_verification")
        .select("*")
        .not("crm_verification_planned", "is", null)
        .order("crm_verification_planned", { ascending: true });

      if (otpError) throw otpError;

      const ticketIds = (otpRows || []).map((o) => o.ticket_id);
      if (ticketIds.length === 0) {
        setPendingData([]);
        setHistoryData([]);
        setSelectedIds([]);
        return;
      }

      const [
        { data: ticketsData, error: ticketsError },
        { data: crmRows, error: crmError },
        { data: orderRows, error: orderError },
      ] = await Promise.all([
        supabase
          .from("sss_tickets")
          .select("ticket_id, uuid, client_name, company_name, phone_number, engineer_assign")
          .in("ticket_id", ticketIds),
        supabase.from("sss_crm_verification").select("*").in("ticket_id", ticketIds),
        supabase
          .from("sss_follow_up")
          .select("ticket_id, payment_mode")
          .eq("stage", "Order Received")
          .in("ticket_id", ticketIds),
      ]);

      if (ticketsError) throw ticketsError;
      if (crmError) throw crmError;
      if (orderError) throw orderError;

      const ticketByTicket = new Map((ticketsData || []).map((t) => [t.ticket_id, t]));
      const crmByTicket = new Map((crmRows || []).map((c) => [c.ticket_id, c]));
      const paymentModeByTicket = new Map((orderRows || []).map((o) => [o.ticket_id, o.payment_mode]));

      const pending = [];
      const history = [];

      (otpRows || []).forEach((o) => {
        const t = ticketByTicket.get(o.ticket_id) || {};
        const row = {
          ticketId: o.ticket_id,
          ticketUuid: o.ticket_uuid,
          clientName: t.client_name || "",
          companyName: t.company_name || "",
          phoneNumber: t.phone_number || "",
          engineerAssign: t.engineer_assign || "",
          siteVisitDate: o.site_visit_date || "",
          serviceReportFile: o.service_report_file || "",
          quotationReceiveFile: o.quotation_receive_file || "",
          videoLink: o.video_link || "",
          locallyPurchasedSpares: o.locally_purchased_spares || "",
          remarks: o.remarks || "",
          planned: o.crm_verification_planned,
          paymentMode: paymentModeByTicket.get(o.ticket_id) || "",
        };

        const crm = crmByTicket.get(o.ticket_id);
        if (crm) {
          history.push({
            ...row,
            verifiedBy: crm.verified_by || "",
            verifiedAt: crm.created_at,
            invoicePlanned: crm.invoice_planned,
            delayMinutes: crm.delay_minutes,
          });
        } else {
          pending.push(row);
        }
      });

      setPendingData(pending);
      setHistoryData(history.reverse());
      setSelectedIds([]);
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

  const matchesSearch = (item) => {
    const q = searchItem.toLowerCase();
    return (
      String(item.ticketId || "").toLowerCase().includes(q) ||
      String(item.clientName || "").toLowerCase().includes(q) ||
      String(item.companyName || "").toLowerCase().includes(q) ||
      String(item.engineerAssign || "").toLowerCase().includes(q) ||
      String(item.phoneNumber || "").toLowerCase().includes(q)
    );
  };

  const filteredPendingData = pendingData.filter(matchesSearch);
  const filteredHistoryData = historyData.filter(matchesSearch);

  const allSelected =
    filteredPendingData.length > 0 &&
    filteredPendingData.every((p) => selectedIds.includes(p.ticketId));

  const toggleSelected = (id) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const toggleAll = () =>
    setSelectedIds(allSelected ? [] : filteredPendingData.map((p) => p.ticketId));

  const handleSubmit = async () => {
    const rows = pendingData.filter((p) => selectedIds.includes(p.ticketId));
    if (rows.length === 0) return;

    setIsSubmitting(true);
    try {
      const invoicePlanned = await computeStagePlanned("invoice", {
        orderReceivedSubmittedAt: new Date(),
      });
      const verifiedBy = localStorage.getItem("currentUsername") || null;

      const { error } = await supabase.from("sss_crm_verification").insert(
        rows.map((r) => ({
          ticket_id: r.ticketId,
          ticket_uuid: r.ticketUuid,
          verified_by: verifiedBy,
          // FOC orders end at CRM Verification — no invoice.
          invoice_planned: r.paymentMode === "FOC" ? null : invoicePlanned,
        }))
      );

      if (error) throw error;

      toast({
        title: "Success",
        description: `${rows.length} ticket(s) verified`,
      });
      setShowConfirm(false);
      fetchData();
    } catch (error) {
      console.error("Error submitting CRM verification:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit CRM verification",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (value) => {
    if (!value) return "";
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  };

  const formatDateTime = (value) => {
    if (!value) return "";
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return `${formatDate(value)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const fileLink = (url) =>
    url ? (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
      >
        View
      </a>
    ) : (
      <span className="text-gray-400">-</span>
    );

  const th = "text-white border-b border-blue-500 px-4 py-3 text-left whitespace-nowrap";
  const td = "px-4 py-3 text-blue-900";

  // Columns shared by both tabs.
  const commonHeaders = [
    "Ticket-ID",
    "Client Name",
    "Company Name",
    "Engineer Name",
    "Site Visit Date",
    "Service Report",
    "Quotation Receive",
    "Video",
    "Locally Purchased Spares",
    "Remarks",
  ];

  const commonCells = (r) => (
    <>
      <td className={`${td} font-medium text-blue-800`}>{r.ticketId}</td>
      <td className={td}>{r.clientName}</td>
      <td className={`${td} max-w-[200px] truncate`} title={r.companyName}>
        {r.companyName}
      </td>
      <td className={td}>{r.engineerAssign}</td>
      <td className={td}>{formatDate(r.siteVisitDate)}</td>
      <td className={td}>{fileLink(r.serviceReportFile)}</td>
      <td className={td}>{fileLink(r.quotationReceiveFile)}</td>
      <td className={td}>{fileLink(r.videoLink)}</td>
      <td className={td}>{r.locallyPurchasedSpares}</td>
      <td className={`${td} max-w-[200px] truncate`} title={r.remarks}>
        {r.remarks}
      </td>
    </>
  );

  const emptyRow = (colSpan, text) => (
    <tr>
      <td colSpan={colSpan} className="text-center py-8 bg-white">
        {fetchLoading ? (
          <div className="flex justify-center items-center text-blue-700">
            <LoaderIcon className="animate-spin w-8 h-8" />
          </div>
        ) : (
          <h1 className="text-blue-700">{text}</h1>
        )}
      </td>
    </tr>
  );

  const mobileCard = (r, ind, extra) => (
    <Card
      key={r.ticketId}
      className={`${ind % 2 === 0 ? "bg-blue-50/50" : "bg-white"} border-l-4 border-l-blue-500`}
    >
      <CardContent className="p-4 flex gap-3 items-start">
        {extra.checkbox}
        <div className="text-sm space-y-1 min-w-0">
          <h3 className="font-bold text-blue-800 text-base">{r.ticketId}</h3>
          <p className="text-gray-700">{r.clientName || "N/A"}</p>
          <p className="text-gray-600 truncate" title={r.companyName}>
            {r.companyName || "N/A"}
          </p>
          <p className="text-gray-600">Engineer: {r.engineerAssign || "N/A"}</p>
          <p className="text-gray-600">Site Visit: {formatDate(r.siteVisitDate) || "N/A"}</p>
          <p className="text-gray-600 flex gap-3">
            <span>Report: {fileLink(r.serviceReportFile)}</span>
            <span>Quotation: {fileLink(r.quotationReceiveFile)}</span>
            <span>Video: {fileLink(r.videoLink)}</span>
          </p>
          <p className="text-gray-600">Spares: {r.locallyPurchasedSpares || "N/A"}</p>
          {r.remarks && <p className="text-gray-600 line-clamp-2">Remarks: {r.remarks}</p>}
          {extra.footer}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-2">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardHeader className="bg-gradient-to-r from-blue-50/50 to-indigo-50/50 rounded-t-lg border-b border-blue-100 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
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

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
              <Input
                placeholder="Search by ticket ID, client, company, engineer or phone..."
                className="w-full sm:w-80 rounded-md border-blue-200 bg-white"
                value={searchItem}
                onChange={(e) => setSearchItem(e.target.value)}
                data-testid="input-search-filter"
              />
              {activeTab === "pending" && (
                <Button
                  type="button"
                  onClick={() => setShowConfirm(true)}
                  disabled={selectedIds.length === 0 || isSubmitting}
                  data-testid="button-submit-crm"
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white disabled:opacity-60"
                >
                  Submit ({selectedIds.length})
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent>
            <div className="mt-2">
              <TabsContent value="pending" className="mt-0">
                <div className="relative overflow-x-auto">
                  <div className="max-h-[calc(103vh-200px)] overflow-y-auto">
                    <table className="hidden sm:table w-full">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-gradient-to-r from-blue-600 to-indigo-600">
                          <th className={`${th} w-[60px]`}>
                            <input
                              type="checkbox"
                              checked={allSelected}
                              onChange={toggleAll}
                              className="h-4 w-4"
                              data-testid="checkbox-crm-all"
                            />
                          </th>
                          {commonHeaders.map((h) => (
                            <th key={h} className={th}>
                              {h}
                            </th>
                          ))}
                          <th className={th}>Planned</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-blue-100">
                        {filteredPendingData.length === 0
                          ? emptyRow(commonHeaders.length + 2, "No pending CRM verifications.")
                          : filteredPendingData.map((r, ind) => (
                              <tr key={r.ticketId} className={ind % 2 === 0 ? "bg-blue-50/50" : "bg-white"}>
                                <td className="px-4 py-3">
                                  <input
                                    type="checkbox"
                                    checked={selectedIds.includes(r.ticketId)}
                                    onChange={() => toggleSelected(r.ticketId)}
                                    className="h-4 w-4"
                                    data-testid={`checkbox-crm-${r.ticketId}`}
                                  />
                                </td>
                                {commonCells(r)}
                                <td className={`${td} whitespace-nowrap`}>{formatDateTime(r.planned)}</td>
                              </tr>
                            ))}
                      </tbody>
                    </table>

                    <div className="sm:hidden space-y-3">
                      {filteredPendingData.length === 0 ? (
                        <div className="text-center py-8 text-blue-700">
                          {fetchLoading ? (
                            <LoaderIcon className="animate-spin w-8 h-8 mx-auto" />
                          ) : (
                            "No pending CRM verifications."
                          )}
                        </div>
                      ) : (
                        filteredPendingData.map((r, ind) =>
                          mobileCard(r, ind, {
                            checkbox: (
                              <input
                                type="checkbox"
                                checked={selectedIds.includes(r.ticketId)}
                                onChange={() => toggleSelected(r.ticketId)}
                                className="h-4 w-4 mt-1"
                              />
                            ),
                            footer: <p className="text-gray-500">Planned: {formatDateTime(r.planned)}</p>,
                          })
                        )
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="history" className="mt-0">
                <div className="relative overflow-x-auto">
                  <div className="max-h-[calc(103vh-200px)] overflow-y-auto">
                    <table className="hidden sm:table w-full">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-gradient-to-r from-blue-600 to-indigo-600">
                          {commonHeaders.map((h) => (
                            <th key={h} className={th}>
                              {h}
                            </th>
                          ))}
                          <th className={th}>Verified By</th>
                          <th className={th}>Verified On</th>
                          <th className={th}>Invoice Planned</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-blue-100">
                        {filteredHistoryData.length === 0
                          ? emptyRow(commonHeaders.length + 3, "No CRM verification history found.")
                          : filteredHistoryData.map((r, ind) => (
                              <tr key={r.ticketId} className={ind % 2 === 0 ? "bg-blue-50/50" : "bg-white"}>
                                {commonCells(r)}
                                <td className={td}>{r.verifiedBy}</td>
                                <td className={`${td} whitespace-nowrap`}>{formatDateTime(r.verifiedAt)}</td>
                                <td className={`${td} whitespace-nowrap`}>
                                  {r.invoicePlanned ? (
                                    formatDateTime(r.invoicePlanned)
                                  ) : (
                                    <span className="text-amber-600">No invoice (FOC)</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                      </tbody>
                    </table>

                    <div className="sm:hidden space-y-3">
                      {filteredHistoryData.length === 0 ? (
                        <div className="text-center py-8 text-blue-700">
                          {fetchLoading ? (
                            <LoaderIcon className="animate-spin w-8 h-8 mx-auto" />
                          ) : (
                            "No CRM verification history found."
                          )}
                        </div>
                      ) : (
                        filteredHistoryData.map((r, ind) =>
                          mobileCard(r, ind, {
                            footer: (
                              <>
                                <p className="text-gray-500">
                                  Verified: {r.verifiedBy || "N/A"} · {formatDateTime(r.verifiedAt)}
                                </p>
                                <p className="text-gray-500">
                                  Invoice: {r.invoicePlanned ? formatDateTime(r.invoicePlanned) : "No invoice (FOC)"}
                                </p>
                              </>
                            ),
                          })
                        )
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>
            </div>
          </CardContent>
        </Card>
      </Tabs>

      <Modal
        isOpen={showConfirm}
        onClose={() => !isSubmitting && setShowConfirm(false)}
        title="Confirm CRM Verification"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            Verify <span className="font-semibold">{selectedIds.length}</span> ticket(s)? This moves
            them to History and generates their Invoice planned date (FOC orders get no invoice).
          </p>
          <p className="text-sm text-gray-500 break-words">{selectedIds.join(", ")}</p>
          <div className="flex space-x-4 pt-2">
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              data-testid="button-confirm-crm"
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
            >
              {isSubmitting && <Loader2Icon className="animate-spin w-4 h-4 mr-2" />}
              Confirm
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowConfirm(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
