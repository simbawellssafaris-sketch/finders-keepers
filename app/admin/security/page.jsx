import { redirect } from 'next/navigation';
import { requireAdmin } from '../../../lib/admin/auth';
import Shell from '../_components/Shell';
import SecurityPanel from '../_components/SecurityPanel';

export const dynamic = 'force-dynamic';

export default async function Security() {
  const ctx = await requireAdmin({ partial: true });
  if (ctx.twoFactorOn && ctx.aal !== 'aal2') redirect('/admin/verify');
  return (
    <Shell ctx={ctx} current="security">
      <h1>Security</h1>
      <p className="ad-sub">Signed in as {ctx.user.email}.</p>
      <SecurityPanel enabled={ctx.twoFactorOn} verified={ctx.aal === 'aal2'} />
    </Shell>
  );
}
