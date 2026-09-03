import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
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
import { LoaderIcon } from "lucide-react";
import { supabase } from "../lib/supabase/client";
import { fetchDropdownRows } from "../lib/supabase/dropdown";
<<<<<<< HEAD
import { computeStagePlanned } from "../lib/supabase/stagePlanning";
=======
>>>>>>> 2fb6fc02d3513c41c6187e88e88fa6fb9cdd9a7c

export default function Warehouse() {
  const [activeTab, setActiveTab] = useState("pending");
  const [showModal, setShowModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [formData, setFormData] = useState({
    assignedEngineer: "",
    priority: "",
    dateOfRepair: "",
    remarks: "",
  });

  const [pendingData, setPendingData] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchItem, setSearchItem] = useState("");
  const [engineers, setEngineers] = useState([]);
  const { toast } = useToast();

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Minutes late (negative) or early (positive) — the ORIGINAL delay
  // convention, matching predecessor Warranty-Check. See
  // warehouse.delay_minutes / migration 0035.
  const formatDelay = (minutes) => {
    if (minutes === null || minutes === undefined) return "N/A";
    if (minutes < 0) return `${Math.abs(minutes)} min late`;
    return `${minutes} min early`;
  };

  const fetchEngineers = async () => {
    try {
      const data = await fetchDropdownRows(["engineer_assign_name"]);
      setEngineers([...new Set((data || []).map((r) => r.value))].filter(Boolean).sort());
    } catch (e) {
      console.error("Error fetching engineers:", e);
    }
  };

  const fetchData = async () => {
    setFetchLoading(true);
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
  }, []);

  const handleProcessClick = (ticket) => {
    setSelectedTicket(ticket);
    setFormData({
      assignedEngineer: "",
      priority: "",
      dateOfRepair: "",
      remarks: "",
    });
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
<<<<<<< HEAD
      const submittedAt = new Date();
      // Readiness stamp for the Engineer-Dashboard's own "Repair Status"
      // stage (engg_dsb_repair_status, migration 0055) — sss_warehouse has
      // no separate actual/completion column, so this insert IS the
      // completion event.
      const enggDsbRepairStatusPlanned = await computeStagePlanned("enggDsbRepairStatus", {
        warehouseSubmittedAt: submittedAt,
      });

=======
>>>>>>> 2fb6fc02d3513c41c6187e88e88fa6fb9cdd9a7c
      const { error } = await supabase.from("sss_warehouse").insert({
        ticket_id: selectedTicket.ticketId,
        ticket_uuid: selectedTicket.ticketUuid,
        assigned_engineer: formData.assignedEngineer,
        priority: formData.priority || null,
        date_of_repair: formData.dateOfRepair || null,
        remarks: formData.remarks || null,
<<<<<<< HEAD
        engg_dsb_repair_status_planned: enggDsbRepairStatusPlanned,
=======
>>>>>>> 2fb6fc02d3513c41c6187e88e88fa6fb9cdd9a7c
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

  const userName = localStorage.getItem("currentUsername");
  const roleStorage = localStorage.getItem("o2d-auth-storage");
  let role = "admin";
  try {
    if (roleStorage) {
      const parsedData = JSON.parse(roleStorage);
      role = parsedData.state.user.role;
    }
  } catch (e) {
    console.error("Error parsing role storage", e);
  }

  const filteredPendingDataa = pendingData
    .filter((item) => {
      const q = searchItem.toLowerCase();
      return (
        String(item.ticketId || "").toLowerCase().includes(q) ||
        String(item.clientName || "").toLowerCase().includes(q) ||
        String(item.companyName || "").toLowerCase().includes(q) ||
        String(item.phoneNumber || "").toLowerCase().includes(q)
      );
    })
    .reverse();

  const filteredHistoryDataa = historyData
    .filter((item) => {
      const q = searchItem.toLowerCase();
      return (
        String(item.ticketId || "").toLowerCase().includes(q) ||
        String(item.clientName || "").toLowerCase().includes(q) ||
        String(item.companyName || "").toLowerCase().includes(q) ||
        String(item.phoneNumber || "").toLowerCase().includes(q)
      );
    })
    .reverse();

  const filteredPendingData =
    role === "user"
      ? filteredPendingDataa.filter((item) => item.CREName === userName)
      : role === "engineer"
      ? filteredPendingDataa.filter((item) => item.engineerAssign === userName)
      : filteredPendingDataa;

  const filteredHistoryData =
    role === "user"
      ? filteredHistoryDataa.filter((item) => item.CREName === userName)
      : role === "engineer"
      ? filteredHistoryDataa.filter((item) => item.engineerAssign === userName)
      : filteredHistoryDataa;

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardHeader className="bg-gradient-to-r from-blue-50/50 to-indigo-50/50 rounded-t-lg border-b border-blue-100 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <TabsList className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200">
                <TabsTrigger
                  value="pending"
                  className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                >
                  Pending ({filteredPendingData.length})
                </TabsTrigger>
                <TabsTrigger
                  value="history"
                  className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                >
                  History ({filteredHistoryData.length})
                </TabsTrigger>
              </TabsList>
              <CardTitle className="text-xl font-bold bg-gradient-to-r from-blue-800 to-indigo-800 bg-clip-text text-transparent">
                Warehouse stage
              </CardTitle>
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Input
                placeholder="Search by Ticket, Client, Company..."
                value={searchItem}
                onChange={(e) => setSearchItem(e.target.value)}
                className="bg-white border-blue-200 focus:border-blue-500 focus:ring-blue-500 rounded-lg shadow-sm"
              />
            </div>
          </CardHeader>

          <CardContent className="p-6">
            <TabsContent value="pending" className="mt-0">
              <div className="overflow-x-auto rounded-xl border border-blue-100 shadow-sm bg-white">
                <Table>
                  <TableHeader className="bg-gradient-to-r from-blue-600 to-indigo-600">
                    <TableRow>
                      <TableHead className="text-white font-bold w-[100px]">Actions</TableHead>
                      <TableHead className="text-white font-bold">Date</TableHead>
                      <TableHead className="text-white font-bold">Ticket-ID</TableHead>
                      <TableHead className="text-white font-bold">Source of enquiry</TableHead>
                      <TableHead className="text-white font-bold">Call type</TableHead>
                      <TableHead className="text-white font-bold">Receiver Name</TableHead>
                      <TableHead className="text-white font-bold">Company Name</TableHead>
                      <TableHead className="text-white font-bold">Client Name</TableHead>
                      <TableHead className="text-white font-bold">Machine Name</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fetchLoading ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8">
                          <LoaderIcon className="animate-spin w-8 h-8 text-blue-600 mx-auto" />
                        </TableCell>
                      </TableRow>
                    ) : filteredPendingData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-blue-800 font-medium">
                          No pending warehouse repair bookings found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredPendingData.map((ticket) => (
                        <TableRow key={ticket.ticketId} className="hover:bg-blue-50/50 transition-colors">
                          <TableCell className="py-2">
                            <Button
                              onClick={() => handleProcessClick(ticket)}
                              size="sm"
                              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm"
                            >
                              PROCESS
                            </Button>
                          </TableCell>
                          <TableCell className="font-semibold text-blue-900">{formatDate(ticket.timeStemp)}</TableCell>
                          <TableCell className="font-bold text-indigo-700">{ticket.ticketId}</TableCell>
                          <TableCell>{ticket.sourceOfEnquiry}</TableCell>
                          <TableCell>{ticket.callType}</TableCell>
                          <TableCell>{ticket.enquiryReceiverName}</TableCell>
                          <TableCell className="font-medium text-slate-800">{ticket.companyName}</TableCell>
                          <TableCell>{ticket.clientName}</TableCell>
                          <TableCell className="font-medium text-slate-800">{ticket.machineName}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="history" className="mt-0">
              <div className="overflow-x-auto rounded-xl border border-blue-100 shadow-sm bg-white">
                <Table>
                  <TableHeader className="bg-gradient-to-r from-blue-600 to-indigo-600">
                    <TableRow>
                      <TableHead className="text-white font-bold">Date</TableHead>
                      <TableHead className="text-white font-bold">Ticket-ID</TableHead>
                      <TableHead className="text-white font-bold">Company Name</TableHead>
                      <TableHead className="text-white font-bold">Client Name</TableHead>
                      <TableHead className="text-white font-bold">Machine Name</TableHead>
                      <TableHead className="text-white font-bold">Assigned Engineer</TableHead>
                      <TableHead className="text-white font-bold">Priority</TableHead>
                      <TableHead className="text-white font-bold">Date of Repair</TableHead>
                      <TableHead className="text-white font-bold">Remarks</TableHead>
                      <TableHead className="text-white font-bold">Actual Date</TableHead>
                      <TableHead className="text-white font-bold">Delay</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fetchLoading ? (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center py-8">
                          <LoaderIcon className="animate-spin w-8 h-8 text-blue-600 mx-auto" />
                        </TableCell>
                      </TableRow>
                    ) : filteredHistoryData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center py-8 text-blue-800 font-medium">
                          No warehouse history entries found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredHistoryData.map((ticket, ind) => (
                        <TableRow key={ind} className="hover:bg-blue-50/50 transition-colors">
                          <TableCell className="font-semibold text-blue-900">{formatDate(ticket.timeStemp)}</TableCell>
                          <TableCell className="font-bold text-indigo-700">{ticket.ticketId}</TableCell>
                          <TableCell className="font-medium text-slate-800">{ticket.companyName}</TableCell>
                          <TableCell>{ticket.clientName}</TableCell>
                          <TableCell className="font-medium text-slate-800">{ticket.machineName}</TableCell>
                          <TableCell className="font-semibold text-indigo-900">{ticket.assignedEngineer}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              ticket.priority?.toLowerCase() === "high"
                                ? "bg-red-100 text-red-800"
                                : ticket.priority?.toLowerCase() === "medium"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-green-100 text-green-800"
                            }`}>
                              {ticket.priority || "Low"}
                            </span>
                          </TableCell>
                          <TableCell className="font-semibold text-slate-700">{formatDate(ticket.dateOfRepair)}</TableCell>
                          <TableCell className="max-w-[200px] truncate" title={ticket.remarks}>{ticket.remarks}</TableCell>
                          <TableCell className="font-semibold text-emerald-800">{formatDate(ticket.actual7)}</TableCell>
                          <TableCell>
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                ticket.delayMinutes < 0
                                  ? "bg-red-100 text-red-800"
                                  : "bg-emerald-100 text-emerald-800"
                              }`}
                            >
                              {formatDelay(ticket.delayMinutes)}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </CardContent>
        </Card>
      </Tabs>

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
              <SelectTrigger className="w-full">
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
              <SelectTrigger className="w-full">
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
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSubmitting ? "Submitting..." : "Submit"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
