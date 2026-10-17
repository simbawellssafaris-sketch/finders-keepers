import { requireAdmin } from '../../../lib/admin/auth';
import { getStaff } from '../../../lib/admin/staff';
import { fmtDate } from '../../../lib/admin/format';
import { updateStaff, removeStaff } from '../actions';
import ConfirmButton from '../_components/ConfirmButton';
import Shell from '../_components/Shell';

export const dynamic = 'force-dynamic';

// Who can use the dashboard. Everyone sees the list; only owners can change names and roles or remove people.
export default async function Team() {
  const ctx = await requireAdmin();
  const { staff } = await getStaff(ctx.supabase);

  return (
    <Shell ctx={ctx} current="team">
      <h1>Team</h1>
      <p className="ad-sub">The people who can sign in to this dashboard.</p>

      <div className="ad-panel">
        <h2>Who has access</h2>
        {staff.map((s) => {
          const self = s.user_id === ctx.user.id;
          return ctx.admin.isOwner ? (
            <div key={s.user_id} className="ad-teamrow">
              <form action={updateStaff.bind(null, s.user_id)} className="ad-form" style={{ display: 'contents' }}>
                <div>
                  <label htmlFor={`n${s.user_id}`}>Name shown on assignments and history{self ? ' (you)' : ''}</label>
                  <input id={`n${s.user_id}`} name="display_name" defaultValue={s.display_name || ''} maxLength={80} placeholder={s.name} />
                </div>
                <div>
                  <label htmlFor={`r${s.user_id}`}>Role</label>
                  <select id={`r${s.user_id}`} name="role" defaultValue={s.role}>
                    <option value="admin">Owner (everything)</option>
                    <option value="staff">Staff (cannot delete or manage the team)</option>
                  </select>
                </div>
                <div className="ad-actions" style={{ marginTop: 0 }}><button className="ad-btn" type="submit">Save</button></div>
              </form>
              {!self ? (
                <form action={removeStaff.bind(null, s.user_id)} style={{ gridColumn: '1 / -1' }}>
                  <ConfirmButton className="ad-btn danger" message={`Remove ${s.name}'s access to the dashboard? Their login stays in Supabase but they can no longer see anything.`}>Remove {s.name}</ConfirmButton>
                </form>
              ) : null}
            </div>
          ) : (
            <div key={s.user_id} className="ad-teamrow" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div><strong>{s.name}</strong>{self ? ' (you)' : ''}</div>
              <div>{s.role === 'admin' ? 'Owner' : 'Staff'} &middot; since {fmtDate(s.created_at)}</div>
            </div>
          );
        })}
      </div>

      {ctx.admin.isOwner ? (
        <div className="ad-panel">
          <h2>Add a person</h2>
          <ol style={{ lineHeight: 1.8, paddingLeft: 20, margin: 0 }}>
            <li>In Supabase: <strong>Authentication &rarr; Users &rarr; Add user &rarr; Create new user</strong>. Use their own email and a strong password, and tick <strong>Auto Confirm User</strong>.</li>
            <li>In the <strong>SQL Editor</strong>, run this (change the name and email):</li>
          </ol>
          <pre className="ad-secret" style={{ display: 'block', padding: 14, marginTop: 12, whiteSpace: 'pre-wrap' }}>{`insert into public.admins (user_id, role, display_name)
select id, 'staff', 'Their name' from auth.users where email = 'their-email@example.com';`}</pre>
          <p className="ad-sub" style={{ margin: '12px 0 0' }}>Then ask them to sign in and set up two-factor login under <strong>Security</strong>.</p>
        </div>
      ) : null}
    </Shell>
  );
}
