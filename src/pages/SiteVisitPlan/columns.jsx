import { Button } from "../../components/ui/button";
import { StatusBadge } from "../../components/shared";
import { formatDate } from "../../lib/format";

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
export const COLUMNS = [
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
