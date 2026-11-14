// Shared helpers for the WhatsApp (calibration reminder) stage.

// Reminders go out only when the due date is exactly this many days away (negative = overdue). 0 never sends.
export const REMINDER_DAYS = [30, 15, 7, 3, 1, -3, -7, -15];

// India's calendar date (YYYY-MM-DD) for an instant.
export const istDate = (value) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(value)
  );

// A usable mobile number once cleaned the same way the Edge Function cleans it.
export const hasWhatsappNumber = (raw) => {
  let digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10) digits = `91${digits}`;
  return /^91[6-9]\d{9}$/.test(digits);
};

const NUMBER_FIELD = { person: "contactNumber", client: "clientPhone" };

// Does this receiver (person | client) still need today's reminder? True when they have a number and
// have not already been sent a message successfully today.
export const receiverPending = (row, who) => {
  if (!hasWhatsappNumber(row[NUMBER_FIELD[who]])) return false;
  const sentAt = row[`${who}MsgSentAt`];
  const sentToday = row[`${who}MsgStatus`] === "sent" && sentAt && istDate(sentAt) === istDate(new Date());
  return !sentToday;
};

// Row is part of today's reminder run: due-days is one of the reminder days and someone still needs the message.
export const isReminderDue = (row) =>
  REMINDER_DAYS.includes(row.calibDueDays) && (receiverPending(row, "person") || receiverPending(row, "client"));

// DB row -> UI row.
export const fromDb = (r) => ({
  id: r.id,
  ticketUuid: r.ticket_uuid,
  ticketId: r.ticket_id || "",
  source: r.source,
  invoiceDate: r.invoice_date || "",
  companyName: r.company_name || "",
  personName: r.person_name || "",
  contactNumber: r.contact_number || "",
  clientName: r.client_name || "",
  clientPhone: r.client_phone || "",
  siteAddress: r.site_address || "",
  invoiceNumber: r.invoice_number || "",
  quotationNumber: r.quotation_number || "",
  calibrationDueDate: r.calibration_due_date || "",
  invoiceCopy: r.invoice_copy || "",
  engineerName: r.engineer_name || "",
  engineerPhone: r.engineer_phone || "",
  calibDueDays: r.calib_due_days,
  lastMessageAt: r.last_message_at || "",
  personMsgStatus: r.person_msg_status || "",
  personMsgError: r.person_msg_error || "",
  personMsgSentAt: r.person_msg_sent_at || "",
  clientMsgStatus: r.client_msg_status || "",
  clientMsgError: r.client_msg_error || "",
  clientMsgSentAt: r.client_msg_sent_at || "",
});
