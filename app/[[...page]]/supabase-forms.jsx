'use client';

import { useEffect } from 'react';
import { getSupabase } from '../../lib/supabase/client';
import { buildSubmission, saveSubmission, flushPending } from '../../lib/forms';

// Saves every website form (enquiries, service requests, newsletter sign-ups) to Supabase as it is submitted.
// Renders nothing. The pages' own scripts still show the thank-you message and the WhatsApp / email options.
export default function SupabaseForms() {
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      console.warn('Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY): forms will not be saved.');
      return;
    }
    flushPending(supabase);
    const retry = () => flushPending(supabase);
    // Capture phase: runs before the page's own handler, which may reset the form after a successful submit.
    const onSubmit = (e) => {
      const form = e.target;
      if (!(form instanceof HTMLFormElement)) return;
      const submission = buildSubmission(form);
      if (submission) saveSubmission(supabase, submission);
    };
    document.addEventListener('submit', onSubmit, true);
    window.addEventListener('online', retry);
    return () => {
      document.removeEventListener('submit', onSubmit, true);
      window.removeEventListener('online', retry);
    };
  }, []);
  return null;
}
