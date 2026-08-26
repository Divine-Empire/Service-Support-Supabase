import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
} from "../components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { useToast } from "../hooks/use-toast";
import { LoaderIcon } from "lucide-react";
import { supabase } from "../lib/supabase/client";

export default function Cancle() {
  const [activeTab, setActiveTab] = useState("pending");
  const [cancelledData, setCancelledData] = useState([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const { toast } = useToast();

  const fetchCancelledTickets = async () => {
    setFetchLoading(true);
    try {
      const { data: cancelRows, error: cancelError } = await supabase
        .from("cancelled_tickets")
        .select("*")
        .order("created_at", { ascending: false });

      if (cancelError) throw cancelError;

      if (!cancelRows || cancelRows.length === 0) {
        setCancelledData([]);
        return;
      }

      const ticketIds = [...new Set(cancelRows.map((c) => c.ticket_id))];

      const { data: ticketsData, error: ticketsError } = await supabase
        .from("tickets")
        .select("*")
        .in("ticket_id", ticketIds);

      if (ticketsError) throw ticketsError;

      const ticketByTicketId = new Map((ticketsData || []).map((t) => [t.ticket_id, t]));

      const formatted = cancelRows.map((c) => {
        const t = ticketByTicketId.get(c.ticket_id);
        return {
          id: c.id,
          timeStemp: c.created_at || "",
          ticketId: c.ticket_id,
          cancelledFromStage: c.cancelled_from_stage || "",
          remarks: c.remarks || "",
          clientName: t?.client_name || "",
          phoneNumber: t?.phone_number || "",
          companyName: t?.company_name || "",
          category: t?.category || "",
          mentionIssue: t?.mention_issue || "",
          CREName: t?.cre_name || "",
        };
      });

      setCancelledData(formatted);
    } catch (error) {
      console.error("Error fetching cancelled tickets:", error);
      toast({
        title: "Error",
        description: "Failed to load cancelled tickets",
        variant: "destructive",
      });
    } finally {
      setFetchLoading(false);
    }
  };

  useEffect(() => {
    fetchCancelledTickets();
  }, []);

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const userName = localStorage.getItem("currentUsername");

  const roleStorage = localStorage.getItem("o2d-auth-storage");
  const parsedData = roleStorage ? JSON.parse(roleStorage) : null;
  const role = parsedData?.state?.user?.role;

  const filteredData = role === "user"
    ? cancelledData.filter((item) => item.CREName === userName)
    : cancelledData;

  return (
    <div className="space-y-2">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardHeader className="bg-gradient-to-r from-blue-50/50 to-indigo-50/50 rounded-t-lg border-b border-blue-100 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <TabsList className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200">
                <TabsTrigger
                  value="pending"
                  data-testid="tab-pending"
                  className="data-[state=active]:bg-red-600 data-[state=active]:text-white"
                >
                  Cancelled ({filteredData.length})
                </TabsTrigger>
              </TabsList>
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
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                            Cancelled On
                          </th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[120px] sticky top-0">
                            Ticket ID
                          </th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                            Client Name
                          </th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                            Phone Number
                          </th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[180px] sticky top-0">
                            Company Name
                          </th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                            Category
                          </th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[250px] sticky top-0">
                            Mention Issue
                          </th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                            Cancelled From Stage
                          </th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[200px] sticky top-0">
                            Remarks
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-blue-100">
                        {filteredData.length === 0 ? (
                          <tr>
                            <td
                              colSpan={9}
                              className="text-center py-8 bg-white"
                              data-testid="text-no-pending"
                            >
                              {fetchLoading ? (
                                <div className="flex justify-center items-center text-blue-700">
                                  <LoaderIcon className="animate-spin w-8 h-8" />
                                </div>
                              ) : (
                                <h1 className="text-blue-700">
                                  No cancelled tickets found.
                                </h1>
                              )}
                            </td>
                          </tr>
                        ) : (
                          filteredData.map((ticket) => (
                            <tr
                              key={ticket.id}
                              className="bg-white even:bg-blue-50/50"
                            >
                              <td className="px-4 py-3 text-blue-900">
                                {formatDate(ticket.timeStemp)}
                              </td>
                              <td className="px-4 py-3 font-medium text-blue-800">
                                {ticket.ticketId}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.clientName}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.phoneNumber}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.companyName}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.category}
                              </td>
                              <td className="px-4 py-3 text-blue-900 truncate max-w-xs hover:whitespace-normal">
                                {ticket.mentionIssue}
                              </td>
                              <td className="px-4 py-3">
                                <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                                  {ticket.cancelledFromStage}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.remarks}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>

                    {/* Mobile Card View */}
                    <div className="sm:hidden space-y-4">
                      {filteredData.length === 0 ? (
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
                              No cancelled tickets found.
                            </h1>
                          )}
                        </div>
                      ) : (
                        filteredData.map((ticket) => (
                          <Card
                            key={ticket.id}
                            className="border-l-4 border-l-red-500 bg-white"
                          >
                            <CardContent className="p-4 space-y-3">
                              <div>
                                <h3 className="font-bold text-blue-800 text-lg">
                                  {ticket.ticketId}
                                </h3>
                                <p className="text-sm text-gray-600">
                                  {ticket.clientName}
                                </p>
                              </div>

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
                                    Category
                                  </p>
                                  <p className="text-blue-900">
                                    {ticket.category || "N/A"}
                                  </p>
                                </div>
                              </div>

                              <div>
                                <p className="text-gray-500 font-medium text-sm">
                                  Company
                                </p>
                                <p className="text-blue-900">
                                  {ticket.companyName || "N/A"}
                                </p>
                              </div>

                              <div>
                                <p className="text-gray-500 font-medium text-sm">
                                  Cancelled From Stage
                                </p>
                                <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                                  {ticket.cancelledFromStage}
                                </span>
                              </div>

                              <div>
                                <p className="text-gray-500 font-medium text-sm">
                                  Mention Issue
                                </p>
                                <p className="text-blue-900 line-clamp-2">
                                  {ticket.mentionIssue || "N/A"}
                                </p>
                              </div>

                              <div>
                                <p className="text-gray-500 font-medium text-sm">
                                  Remarks
                                </p>
                                <p className="text-blue-900 line-clamp-3">
                                  {ticket.remarks || "N/A"}
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
            </div>
          </CardContent>
        </Card>
      </Tabs>
    </div>
  );
}
