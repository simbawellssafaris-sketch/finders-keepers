// What the admin dashboard shows for each kind of submission. Keys are the database table names.
export const STATUSES = ['new', 'contacted', 'quoted', 'won', 'lost', 'spam'];
export const STATUS_LABELS = { new: 'New', contacted: 'Contacted', quoted: 'Quoted', won: 'Won', lost: 'Lost', spam: 'Spam' };

const SERVICE_LABELS = {
  'private-jets': 'Private jet charter',
  'layover-safari': 'Layover safari',
  'flight-arrangements': 'Flight arrangements',
  'city-tour': 'City tour',
  'airport-fast-track': 'Airport fast-track',
};
export const serviceLabel = (s) => SERVICE_LABELS[s] || s;

export const TABLES = {
  enquiries: {
    path: 'enquiries',
    label: 'Enquiries',
    singular: 'Enquiry',
    hasNotes: true,
    filter: { column: 'status', values: STATUSES, labels: STATUS_LABELS },
    search: ['name', 'email', 'phone', 'package', 'interest', 'notes'],
    columns: [
      { label: 'Name', get: (r) => r.name, link: true },
      { label: 'Contact', get: (r) => [r.phone, r.email].filter(Boolean).join(' · ') },
      { label: 'About', get: (r) => r.package || r.interest || '' },
      { label: 'Status', status: true },
    ],
    fields: [
      ['Name', (r) => r.name], ['Phone / WhatsApp', (r) => r.phone], ['Email', (r) => r.email], ['Travellers', (r) => r.travellers],
      ['Preferred date', (r) => r.preferred_date], ['Interested in', (r) => r.interest], ['Journey enquired about', (r) => r.package],
      ['Their message', (r) => r.notes], ['Sent from page', (r) => r.source_page],
    ],
  },
  service_requests: {
    path: 'service-requests',
    label: 'Service requests',
    singular: 'Service request',
    hasNotes: true,
    filter: { column: 'status', values: STATUSES, labels: STATUS_LABELS },
    search: ['name', 'email', 'phone', 'service'],
    columns: [
      { label: 'Name', get: (r) => r.name, link: true },
      { label: 'Service', get: (r) => serviceLabel(r.service) },
      { label: 'Contact', get: (r) => [r.phone, r.email].filter(Boolean).join(' · ') },
      { label: 'Status', status: true },
    ],
    fields: [
      ['Service', (r) => serviceLabel(r.service)], ['Name', (r) => r.name], ['Email', (r) => r.email], ['Phone / WhatsApp', (r) => r.phone],
      ['Travellers', (r) => r.travellers], ['Sent from page', (r) => r.source_page],
    ],
  },
  newsletter_subscribers: {
    path: 'subscribers',
    label: 'Subscribers',
    singular: 'Subscriber',
    hasNotes: false,
    filter: { column: 'subscription', values: ['subscribed', 'unsubscribed'], labels: { subscribed: 'Subscribed', unsubscribed: 'Unsubscribed' } },
    search: ['email', 'first_name', 'last_name'],
    columns: [
      { label: 'Email', get: (r) => r.email },
      { label: 'Name', get: (r) => [r.first_name, r.last_name].filter(Boolean).join(' ') },
      { label: 'Signed up via', get: (r) => r.source || '' },
      { label: 'Status', get: (r) => (r.subscription === 'unsubscribed' ? 'Unsubscribed' : 'Subscribed'), plainStatus: (r) => r.subscription },
    ],
    fields: [],
  },
};

export const TABLE_NAMES = Object.keys(TABLES);
export const tableByPath = (p) => TABLE_NAMES.find((t) => TABLES[t].path === p);
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
