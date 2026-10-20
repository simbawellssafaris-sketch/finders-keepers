// Single place for the business details used by the shared menu, footer and popups.
// Change a value here and every page that uses a shared piece updates on the next build.
export const site = {
  brand: 'Finders & Keepers Safaris',
  brandShort: 'Finders & Keepers',
  tagline: 'A Life Of Making Memories',
  phone: '+254 183 437 943',
  phoneHref: '+254183437943',
  whatsapp: '254183437943',
  instagram: 'https://www.instagram.com/finderskeepers_safaris/',
  x: 'https://x.com/Findersk2b',
  hours:'Mon–Fri 8am–6pm EAT',
  email: 'info@finderskeeperssafaris.com',
  domain: 'finderskeeperssafaris.com',
  year: '2026',
};
// Same name, safe to put inside a web address (e.g. the pre-filled WhatsApp message)
site.brandUrl = encodeURIComponent(site.brand);
