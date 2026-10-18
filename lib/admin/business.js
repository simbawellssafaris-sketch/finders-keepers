// Company and bank details from Settings, for printed documents and emails.
export async function getBusiness(supabase) {
  const { data } = await supabase.from('business_settings').select('key,value');
  return Object.fromEntries((data || []).map((r) => [r.key, r.value]));
}

export const bankLines = (s) =>
  [['Account name', s.account_name], ['Bank', s.bank_name], ['Branch', s.bank_branch], ['Account type', s.account_type], ['Account number', s.account_number], ['SWIFT / BIC', s.swift_code]].filter(([, v]) => v);

export const companyLine = (s) => [s.address, s.phone, s.email].filter(Boolean).join(' · ') + (s.kra_pin ? ` · KRA PIN ${s.kra_pin}` : '');
