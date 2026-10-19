import { loadPage, pageName } from '../../lib/pages';
import SupabaseForms from './supabase-forms';
import WhatsAppButton from './whatsapp-button';

// Root layout: knows which page is being built, so each page keeps its own <head> tags
// (title, description, social tags, styles, fonts) exactly as before.
export default async function RootLayout({ children, params }) {
  const { page } = await params;
  const { headNodes } = loadPage(pageName(page));
  return (
    <html lang="en" suppressHydrationWarning>
      <head>{headNodes}</head>
      <body suppressHydrationWarning>
        {children}
        <SupabaseForms />
        <WhatsAppButton />
      </body>
    </html>
  );
}
