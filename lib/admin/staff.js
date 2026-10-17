// The people who can use the dashboard, and an activity-history helper.

// All staff (id, name, role). Everyone on the admins list can read this list, so names can be shown on assignments and history.
export async function getStaff(supabase) {
  const { data } = await supabase.from('admins').select('user_id, role, display_name, created_at').order('created_at');
  const staff = (data || []).map((s) => ({ ...s, name: s.display_name || (s.role === 'admin' ? 'Owner' : `Staff ${s.user_id.slice(0, 4)}`) }));
  const names = Object.fromEntries(staff.map((s) => [s.user_id, s.name]));
  return { staff, names };
}

// Adds a line to the record's history. A failed history write is reported but never blocks the real change.
export async function logActivity(supabase, ctx, table, id, action, details = {}) {
  const { error } = await supabase.from('activity_log').insert({
    actor: ctx.user.id,
    actor_name: ctx.admin.name,
    entity_table: table,
    entity_id: id,
    action,
    details,
  });
  if (error) console.error('Activity not recorded:', error.message);
}
