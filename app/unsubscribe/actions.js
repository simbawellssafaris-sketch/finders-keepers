'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/server';
import { loginLimited } from '../../lib/admin/auth';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Unsubscribes the one subscriber who owns the link's private token (the database function checks it).
export async function confirmUnsubscribe(formData) {
  const ip = ((await headers()).get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  if (loginLimited(ip, 'unsub')) redirect('/unsubscribe?error=busy');
  const token = String(formData.get('t') || '');
  if (!UUID.test(token)) redirect('/unsubscribe?error=link');
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('unsubscribe_by_token', { t: token });
  if (error) redirect('/unsubscribe?error=failed');
  redirect(data ? '/unsubscribe?done=1' : '/unsubscribe?error=link');
}
