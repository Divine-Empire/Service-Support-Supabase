import { Button } from "../../components/ui/button";
import { StatusBadge } from "../../components/shared";
import { formatDelay, delayTone } from "../../lib/format";

// Kept local: passes dd/mm/yyyy strings through and shows unparseable values as-is,
// which lib/format.formatDate does not.
export const formatDate = (dateString) => {
  if (!dateString) return "";

  const dateStr = String(dateString).trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    return dateStr;
  }

  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateStr;

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
};

const fileLink = (url) =>
  url ? (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary hover:underline text-xs font-semibold"
    >
      View
    </a>
  ) : (
    ""
  );

// Pending: Verify action + ticket/trip columns. History: what was verified + delay.
export const COLUMNS = [
  { key: "action", label: "Action", fixed: true, tabs: ["pending"], cell: (r, { onVerify }) => (
    <Button size="sm" variant="outline" onClick={() => onVerify(r)} data-testid={`button-approval-${r.ticketId}`}>
      Verify
    </Button>
  ) },
  { key: "date", label: "Date", defaultVisible: true, strong: true, text: (r) => formatDate(r.timeStemp) },
  { key: "ticketId", label: "Ticket ID", defaultVisible: true, strong: true, text: (r) => r.ticketId },
  { key: "clientName", label: "Client Name", defaultVisible: true, text: (r) => r.clientName },
  { key: "companyName", label: "Company Name", defaultVisible: true, tabs: ["pending"], text: (r) => r.companyName },
  { key: "phoneNumber", label: "Phone Number", defaultVisible: true, text: (r) => r.phoneNumber },
  { key: "machineName", label: "Machine Name", defaultVisible: false, tabs: ["pending"], text: (r) => r.machineName },
  { key: "engineerAssign", label: "Engineer Assign", defaultVisible: true, tabs: ["pending"], text: (r) => r.engineerAssign },
  { key: "travelDate", label: "Travel Date", defaultVisible: true, tabs: ["pending"], text: (r) => formatDate(r.travelDate) },
  { key: "returnDate", label: "Return Date", defaultVisible: true, tabs: ["pending"], text: (r) => formatDate(r.returnDate) },
  { key: "siteVisitDate", label: "Site Visit Date", defaultVisible: true, tabs: ["history"], text: (r) => formatDate(r.siteVisitDate) },
  { key: "verificationStatus", label: "Verification Status", defaultVisible: true, tabs: ["history"], cell: () => (
    <StatusBadge tone="success">Verified</StatusBadge>
  ) },
  { key: "serviceReportFile", label: "Service Report", defaultVisible: true, tabs: ["history"], cell: (r) => fileLink(r.serviceReportFile) },
  { key: "remarks", label: "Remarks", defaultVisible: false, tabs: ["history"], wrap: true, width: 200, text: (r) => r.remarks },
  { key: "quatationReceive", label: "Quatation Receive", defaultVisible: true, tabs: ["history"], cell: (r) => fileLink(r.quatationReceive) },
  { key: "video", label: "Video", defaultVisible: true, tabs: ["history"], cell: (r) => fileLink(r.video) },
  { key: "locallyPurchasedSpares", label: "Locally Purchased Spares", defaultVisible: false, tabs: ["history"], text: (r) => r.locallyPurchasedSpares },
  // Minutes late, never negative (same convention as tada.delay_minutes).
  { key: "delay", label: "Delay", defaultVisible: true, tabs: ["history"], cell: (r) => (
    <StatusBadge tone={delayTone(r.delayMinutes, { lateOnly: true })}>{formatDelay(r.delayMinutes, { lateOnly: true })}</StatusBadge>
  ) },
];
