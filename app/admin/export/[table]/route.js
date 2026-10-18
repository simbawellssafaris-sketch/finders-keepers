import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/admin/auth';
import { TABLES, tableByPath, DATE } from '../../../../lib/admin/config';
import { csvCell } from '../../../../lib/admin/format';
import { logActivity } from '../../../../lib/admin/staff';
import { describeActivity } from '../../../../lib/admin/activity';
import { ACTIVITY_TYPES, readFilters, applyFilters } from '../../../../lib/admin/audit';

export const dynamic = 'force-dynamic';

const csv = (name, header, rows) => {
  const lines = [header.join(',')];
  for (const row of rows) lines.push(header.map((k) => csvCell(row[k])).join(','));
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse('﻿' + lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}-${stamp}.csv"`,
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
};

// CSV download of one kind of record (admins only). Every download is written to the Activity history.
// /admin/export/enquiries, /service-requests, /subscribers, /clients, /bookings, /payments, /quotations, /invoices, or (owners) /activity.
export async function GET(request, { params }) {
  const ctx = await requireAdmin();
  const { supabase } = ctx;
  const { table: path } = await params;
  const url = new URL(request.url);

  if (path === 'activity') {
    if (!ctx.admin.isOwner) return new NextResponse('Not found', { status: 404 });
    let query = supabase.from('activity_log').select('*').order('created_at', { ascending: false }).order('id', { ascending: false }).limit(20000);
    query = applyFilters(query, readFilters(Object.fromEntries(url.searchParams)));
    const { data, error } = await query;
    if (error) return new NextResponse('Could not export', { status: 500 });
    const rows = data.map((a) => ({ when: a.created_at, who: a.actor_name || '', area: ACTIVITY_TYPES[a.entity_table] || a.entity_table, what: describeActivity(a), action: a.action, record_id: a.entity_id, details: JSON.stringify(a.details || {}) }));
    await logActivity(supabase, ctx, 'admins', ctx.user.id, 'exported', { what: 'activity history', rows: rows.length });
    return csv('activity', ['when', 'who', 'area', 'what', 'action', 'record_id', 'details'], rows);
  }

  // Clients, bookings, payments, quotations and invoices (fixed allow-list; the enquiry tables below keep their own).
  const MONEY = { clients: 'clients', bookings: 'booking_summary', payments: 'payments', quotations: 'quotation_summary', invoices: 'invoice_summary' };
  const isMoney = Object.prototype.hasOwnProperty.call(MONEY, path);
  const table = isMoney ? MONEY[path] : tableByPath(path);
  if (!table) return new NextResponse('Not found', { status: 404 });
  const cfg = isMoney ? { path } : TABLES[table];

  let query = supabase.from(table).select('*').order('created_at', { ascending: false }).limit(10000);
  if (!isMoney) {
    const filter = url.searchParams.get('filter') || '';
    if (cfg.filter.values.includes(filter)) query = query.eq(cfg.filter.column, filter);
  } else if (path === 'payments') {
    // optional date range on the day the money was paid (used by the Reports page)
    const from = url.searchParams.get('from'), to = url.searchParams.get('to');
    if (DATE.test(String(from))) query = query.gte('paid_on', from);
    if (DATE.test(String(to))) query = query.lte('paid_on', to);
  }
  const { data, error } = await query;
  if (error) return new NextResponse('Could not export', { status: 500 });

  const header = ['id', 'created_at', ...Object.keys((data[0] || {})).filter((k) => !['id', 'created_at'].includes(k))];
  await logActivity(supabase, ctx, 'admins', ctx.user.id, 'exported', { what: cfg.path, rows: data.length });
  return csv(cfg.path, header, data);
}
