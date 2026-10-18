import { STATUS_LABELS, CHANNEL_LABELS } from './config';
import { BOOKING_STATUS_LABELS, PAYMENT_KIND_LABELS, PAYMENT_METHOD_LABELS, QUOTE_STATUS_LABELS, DOC_CATEGORY_LABELS } from './money';
import { fmtDay } from './format';

// Plain-English line for one history entry (enquiries, clients, bookings).
export function describeActivity(a) {
  const d = a.details || {};
  switch (a.action) {
    case 'status_changed': return `changed the status from ${STATUS_LABELS[d.from] || d.from} to ${STATUS_LABELS[d.to] || d.to}`;
    case 'note_edited': return d.excerpt ? `updated the private note: “${d.excerpt}”` : 'cleared the private note';
    case 'follow_up_set': return d.date ? `set a follow-up for ${fmtDay(d.date)}` : 'cleared the follow-up date';
    case 'assigned': return d.to ? `assigned this to ${d.to}` : 'removed the assignment';
    case 'created_manually': return `logged this by hand (${CHANNEL_LABELS[d.channel] || d.channel})`;
    case 'converted_to_booking': return `turned this into booking ${d.reference}`;
    case 'unsubscribed': return 'unsubscribed this address';
    case 'resubscribed': return 'resubscribed this address';
    case 'client_created': return d.from === 'enquiry' ? 'created this client from an enquiry' : 'added this client';
    case 'client_updated': return 'updated the client details';
    case 'booking_created': return d.from === 'enquiry' ? 'opened this booking from an enquiry' : 'created this booking';
    case 'booking_status_changed': return `changed the booking status from ${BOOKING_STATUS_LABELS[d.from] || d.from} to ${BOOKING_STATUS_LABELS[d.to] || d.to}`;
    case 'price_changed': return `changed the total price from ${d.from} to ${d.to}`;
    case 'departure_changed': return d.to ? `set the departure date to ${fmtDay(d.to)}` : 'cleared the departure date';
    case 'payment_recorded': return `recorded a ${PAYMENT_KIND_LABELS[d.kind] || d.kind} of ${d.amount} (${PAYMENT_METHOD_LABELS[d.method] || d.method}), ${d.status === 'confirmed' ? 'confirmed' : 'waiting for confirmation'}`;
    case 'payment_confirmed': return `confirmed that the payment of ${d.amount} was received`;
    case 'payment_failed': return `marked the payment of ${d.amount} as failed / entered by mistake`;
    case 'quotation_created': return d.from === 'enquiry' ? 'started this quotation from an enquiry' : 'created this quotation';
    case 'quotation_updated': return `saved the quotation${d.total ? ` (total ${d.total})` : ''}`;
    case 'quotation_status_changed': return `changed the quotation from ${QUOTE_STATUS_LABELS[d.from] || d.from} to ${QUOTE_STATUS_LABELS[d.to] || d.to}`;
    case 'quotation_emailed': return `emailed the quotation to ${d.to}`;
    case 'quotation_converted': return `created booking ${d.reference} from this quotation`;
    case 'quotation_started': return 'started a quotation for this enquiry';
    case 'invoice_created': return `drafted this invoice from booking ${d.booking}`;
    case 'invoice_drafted': return 'drafted an invoice for this booking';
    case 'invoice_updated': return `saved the invoice${d.total ? ` (total ${d.total})` : ''}`;
    case 'invoice_issued': return `issued the invoice${d.reference ? ` as ${d.reference}` : ''}`;
    case 'invoice_voided': return `voided the invoice: ${d.reason}`;
    case 'invoice_emailed': return `emailed the invoice to ${d.to}`;
    case 'document_added': return `uploaded “${d.name}” (${DOC_CATEGORY_LABELS[d.category] || d.category})`;
    case 'document_removed': return `deleted the file “${d.name}”`;
    case 'deleted': return `deleted ${d.name ? `“${d.name}”` : 'this record'}`;
    case 'signed_in': return 'signed in';
    case 'signed_out': return 'signed out';
    case 'session_timed_out': return 'was signed out after being idle';
    case 'two_factor_on': return 'switched on two-factor login';
    case 'two_factor_off': return 'switched off two-factor login';
    case 'password_changed': return `changed their password${d.via ? ` (${d.via})` : ''}`;
    case 'role_changed': return `changed ${d.name || 'a team member'} from ${d.from === 'admin' ? 'Owner' : 'Staff'} to ${d.to === 'admin' ? 'Owner' : 'Staff'}`;
    case 'team_renamed': return `renamed a team member${d.to ? ` to ${d.to}` : ''}`;
    case 'team_removed': return `removed ${d.name || 'a team member'}’s access`;
    case 'document_opened': return `opened the file “${d.name}”`;
    case 'exported': return `downloaded the ${d.what} spreadsheet${d.rows !== undefined ? ` (${d.rows} rows)` : ''}`;
    default: return String(a.action).replace(/_/g, ' ');
  }
}
