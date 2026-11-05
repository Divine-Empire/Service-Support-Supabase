import { Button } from "../../components/ui/button";
import { StatusBadge } from "../../components/shared";
import { formatDate } from "../../lib/format";

export const isOtpVerified = (r) => r.otpVarificationStatus === "Yes" || r.otpVarificationStatus === "Verified";
export const otpLabel = (r) => (isOtpVerified(r) ? "Verified" : r.otpVarificationStatus === "Skipped" ? "Skipped" : "Not Verified");
export const solvedLabel = (r) => (r.videoCallServicesSolve === "yes" ? "Yes" : "No");

// Pending: Action + ticket details. History: same details plus the video-call outcome.
export const COLUMNS = [
  { key: "action", label: "Action", fixed: true, tabs: ["pending"], cell: (r, { onSolution }) => (
    <Button size="sm" variant="outline" onClick={() => onSolution(r)} data-testid={`button-solution-${r.ticketId}`}>
      Solution
    </Button>
  ) },
  { key: "date", label: "Date", defaultVisible: true, text: (r) => formatDate(r.timeStemp) },
  { key: "plannedDate", label: "Planned Date", defaultVisible: true, text: (r) => formatDate(r.plannedDate) },
  { key: "ticketId", label: "Ticket-ID", defaultVisible: true, strong: true, text: (r) => r.ticketId },
  { key: "sourceOfEnquiry", label: "Source of enquiry", defaultVisible: false, text: (r) => r.sourceOfEnquiry },
  { key: "callType", label: "Call type", defaultVisible: false, text: (r) => r.callType },
  { key: "enquiryReceiverName", label: "Enquiry Receiver Name", defaultVisible: false, text: (r) => r.enquiryReceiverName },
  { key: "clientType", label: "Client Type", defaultVisible: false, text: (r) => r.clientType },
  { key: "companyName", label: "Company Name", defaultVisible: true, text: (r) => r.companyName },
  { key: "clientName", label: "Client Name", defaultVisible: true, text: (r) => r.clientName },
  { key: "phoneNumber", label: "Phone Number", defaultVisible: false, text: (r) => r.phoneNumber },
  { key: "siteAddress", label: "Site Address", defaultVisible: false, wrap: true, width: 200, text: (r) => r.siteAddress },
  { key: "gstNo", label: "GST No.", defaultVisible: false, text: (r) => r.gstNo },
  { key: "machineName", label: "Machine Name", defaultVisible: true, wrap: true, width: 180, text: (r) => r.machineName },
  { key: "category", label: "Category", defaultVisible: false, text: (r) => r.category },
  { key: "mentionIssue", label: "Mention Issue", defaultVisible: true, wrap: true, width: 200, text: (r) => r.mentionIssue },
  { key: "ticketRemarks", label: "Ticket Remarks", defaultVisible: false, wrap: true, width: 200, text: (r) => r.ticketRemarks },
  { key: "engineerAssign", label: "Engineer Assign", defaultVisible: false, adminOnly: true, text: (r) => r.engineerAssign },
  { key: "enquiryItemList", label: "Enquiry Item List", defaultVisible: false, cell: (r) =>
    r.enquiryItemList ? (
      <a href={r.enquiryItemList} target="_blank" rel="noreferrer" className="text-primary underline hover:no-underline">View</a>
    ) : null },
  { key: "serviceLocation", label: "Service Location", defaultVisible: true, text: (r) => r.serviceLocation },
  { key: "videoCallServicesSolve", label: "Video Call Services Solve", defaultVisible: true, tabs: ["history"], cell: (r) => (
    <StatusBadge tone={r.videoCallServicesSolve === "yes" ? "success" : "danger"}>{solvedLabel(r)}</StatusBadge>
  ) },
  { key: "otpVerifications", label: "OTP Verifications", defaultVisible: true, tabs: ["history"], cell: (r) => (
    <StatusBadge tone={isOtpVerified(r) ? "success" : r.otpVarificationStatus === "Skipped" ? "info" : "danger"}>{otpLabel(r)}</StatusBadge>
  ) },
  { key: "videoCallRemarks", label: "Video Call Remarks", defaultVisible: true, tabs: ["history"], wrap: true, width: 200, text: (r) => r.remarks },
];
