import { STATUS_LABELS, CHANNEL_LABELS } from './config';
import { BOOKING_STATUS_LABELS, PAYMENT_KIND_LABELS, PAYMENT_METHOD_LABELS } from './money';
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
    default: return String(a.action).replace(/_/g, ' ');
  }
}
