import { Button } from "../../components/ui/button";
import { StatusBadge } from "../../components/shared";
import { Eye } from "lucide-react";
import { formatDate, formatDelay, delayTone } from "../../lib/format";

// Strips a leading "Quotation"/"Quo" prefix so only the number shows.
const cleanQuotationNo = (no) =>
  no ? String(no).replace(/^(Quotation|Quo|QUO|Quo\.)[:\-\s.]*/i, "").trim() : "";

const quotationPdfCell = (r) =>
  r.quotationPdfLink ? (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 w-8 p-0 text-primary"
      onClick={() => window.open(r.quotationPdfLink, "_blank")}
      title="View Quotation PDF"
      aria-label={`View quotation PDF for ${r.ticketId}`}
    >
      <Eye className="h-4 w-4" />
    </Button>
  ) : null;

// Pending: Action + ticket/site-visit columns. History: what was booked + delay.
export const COLUMNS = [
  { key: "action", label: "Action", fixed: true, tabs: ["pending"], cell: (r, { onTada, onReschedule, canReschedule }) => (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="outline" onClick={() => onTada(r)} data-testid={`button-tada-${r.ticketId}`}>
        <Eye className="mr-1.5 h-4 w-4" />
        TADA
      </Button>
      {canReschedule && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => onReschedule(r)}
          data-testid={`button-reschedule-${r.ticketId}`}
          title="Send this ticket back to Site Visit Plan for re-assignment"
        >
          Reschedule
        </Button>
      )}
    </div>
  ) },
  { key: "date", label: "Date", defaultVisible: true, strong: true, text: (r) => formatDate(r.timeStemp) },
  { key: "ticketId", label: "Ticket ID", defaultVisible: true, strong: true, text: (r) => r.ticketId },
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
  { key: "quotationNo", label: "Quotation No.", defaultVisible: false, text: (r) => cleanQuotationNo(r.quotationNo) },
  { key: "warrantyCheck", label: "Warranty Check", defaultVisible: true, tabs: ["pending"], text: (r) => r.warrantyCheck },
  { key: "engineerAssign", label: "Engineer Assign", defaultVisible: true, text: (r) => r.engineerAssign },
  { key: "siteName", label: "Site Name", defaultVisible: false, tabs: ["pending"], text: (r) => r.siteName },
  { key: "dateOfVisit", label: "Date of Visit", defaultVisible: true, tabs: ["pending"], text: (r) => formatDate(r.dateOfVisit) },
  { key: "transportation", label: "Transportation", defaultVisible: true, tabs: ["pending"], cell: (r) =>
    r.transportation ? <StatusBadge tone="info">{r.transportation}</StatusBadge> : null },
  { key: "travelDate", label: "Travel Date", defaultVisible: true, tabs: ["history"], text: (r) => formatDate(r.travelDate) },
  { key: "returnDate", label: "Return Date", defaultVisible: true, tabs: ["history"], text: (r) => formatDate(r.returnDate) },
  { key: "destinationInput", label: "Destination", defaultVisible: true, tabs: ["history"], text: (r) => r.destinationInput },
  { key: "purposeOfTravel", label: "Purpose", defaultVisible: false, tabs: ["history"], wrap: true, width: 200, text: (r) => r.purposeOfTravel },
  { key: "amount", label: "Amount", defaultVisible: true, tabs: ["history"], text: (r) => `₹${r.amount || "0"}` },
  { key: "otpVerificationPlanned", label: "OTP Verification Planned", defaultVisible: true, tabs: ["history"], text: (r) =>
    r.otpVerificationPlanned ? new Date(r.otpVerificationPlanned).toLocaleString("en-IN") : "" },
  { key: "delay", label: "Delay", defaultVisible: true, tabs: ["history"], cell: (r) => (
    <StatusBadge tone={delayTone(r.delayMinutes, { lateOnly: true })}>{formatDelay(r.delayMinutes, { lateOnly: true })}</StatusBadge>
  ) },
  { key: "quotationPdf", label: "Quotation PDF", defaultVisible: true, cell: quotationPdfCell },
];
