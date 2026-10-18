import Link from 'next/link';
import { requireAdmin } from '../../../../lib/admin/auth';
import { getBusiness } from '../../../../lib/admin/business';
import Shell from '../../_components/Shell';
import NewsletterEditor from '../../_components/NewsletterEditor';

export const dynamic = 'force-dynamic';

export default async function NewNewsletter() {
  const ctx = await requireAdmin();
  const business = await getBusiness(ctx.supabase);
  return (
    <Shell ctx={ctx} current="newsletters">
      <Link className="ad-back" href="/admin/newsletters">&larr; Back to newsletters</Link>
      <h1>New issue</h1>
      <p className="ad-sub">Write it on the left, see how it will look on the right. Nothing is sent until you press Send on the saved draft.</p>
      <NewsletterEditor business={{ legal_name: business.legal_name, address: business.address }} />
    </Shell>
  );
}
