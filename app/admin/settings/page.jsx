import { redirect } from 'next/navigation';
import { requireAdmin } from '../../../lib/admin/auth';
import Shell from '../_components/Shell';
import SettingsForm from '../_components/SettingsForm';

export const dynamic = 'force-dynamic';

export default async function Settings() {
  const ctx = await requireAdmin();
  if (!ctx.admin.isOwner) redirect('/admin'); // staff only see these details on printed summaries; changing them is owner-only
  const { data } = await ctx.supabase.from('business_settings').select('key,value');
  const values = Object.fromEntries((data || []).map((r) => [r.key, r.value]));
  return (
    <Shell ctx={ctx} current="settings">
      <h1>Business settings</h1>
      <p className="ad-sub">These details appear on booking summaries. Only owners can change them.</p>
      <div style={{ maxWidth: 820 }}><SettingsForm values={values} /></div>
    </Shell>
  );
}
