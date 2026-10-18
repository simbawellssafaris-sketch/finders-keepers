import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/admin/auth';
import { UUID } from '../../../../lib/admin/config';
import { logActivity } from '../../../../lib/admin/staff';

export const dynamic = 'force-dynamic';

// Opens one private document: checks the sign-in, then sends the browser to a link that works for 60 seconds.
export async function GET(request, { params }) {
  const ctx = await requireAdmin();
  const { supabase } = ctx;
  const { id } = await params;
  if (!UUID.test(String(id))) return new NextResponse('Not found', { status: 404 });
  const { data: doc } = await supabase.from('documents').select('storage_path, name').eq('id', id).maybeSingle();
  if (!doc) return new NextResponse('Not found', { status: 404 });
  const { data, error } = await supabase.storage.from('client-documents').createSignedUrl(doc.storage_path, 60, { download: doc.name });
  if (error || !data) return new NextResponse('Could not open the file', { status: 500 });
  await logActivity(supabase, ctx, 'documents', id, 'document_opened', { name: doc.name }); // who looked at a passport scan, and when
  return NextResponse.redirect(data.signedUrl, { status: 303, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } });
}
