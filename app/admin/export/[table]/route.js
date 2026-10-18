import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/admin/auth';
import { TABLES, tableByPath } from '../../../../lib/admin/config';
import { csvCell } from '../../../../lib/admin/format';

export const dynamic = 'force-dynamic';

// CSV download of one kind of submission (admins only). /admin/export/enquiries, /service-requests or /subscribers.
export async function GET(request, { params }) {
  const { supabase } = await requireAdmin();
  const { table: path } = await params;
  // Clients, bookings and payments (fixed allow-list; the enquiry tables below keep their own).
  const MONEY = { clients: 'clients', bookings: 'booking_summary', payments: 'payments', quotations: 'quotation_summary', invoices: 'invoice_summary' };
  const isMoney = Object.prototype.hasOwnProperty.call(MONEY, path);
  const table = isMoney ? MONEY[path] : tableByPath(path);
  if (!table) return new NextResponse('Not found', { status: 404 });
  const cfg = isMoney ? { path } : TABLES[table];

  let query = supabase.from(table).select('*').order('created_at', { ascending: false }).limit(10000);
  if (!isMoney) {
    const filter = new URL(request.url).searchParams.get('filter') || '';
    if (cfg.filter.values.includes(filter)) query = query.eq(cfg.filter.column, filter);
  }
  const { data, error } = await query;
  if (error) return new NextResponse('Could not export', { status: 500 });

  const header = ['id', 'created_at', ...Object.keys((data[0] || {})).filter((k) => !['id', 'created_at'].includes(k))];
  const lines = [header.join(',')];
  for (const row of data) lines.push(header.map((k) => csvCell(row[k])).join(','));

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse('﻿' + lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${cfg.path}-${stamp}.csv"`,
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
