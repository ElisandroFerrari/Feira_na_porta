import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export const SUPABASE_URL = 'https://nhymrdfcrcrmwppdqsgo.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_c2p4AtY9gWQYyJ9PGNfr5w_CuIY4zU2';
export const WHATSAPP_NUMBER = '555197850439';
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function whatsappNumber() {
  const { data, error } = await supabase.rpc('public_contact_phone');
  if (error) throw error;
  const number = String(data || '').replace(/\D/g, '');
  if (!number) return WHATSAPP_NUMBER;
  if (number.length < 10 || number.length > 13) {
    throw new Error('O telefone de contato cadastrado precisa incluir DDD e, se necessário, o código do país.');
  }
  return number.length <= 11 ? `55${number}` : number;
}

export async function profileFor(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id,full_name,role')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export function formatMoney(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);
}

export function safeImageUrl(value) {
  if (!value) return '';
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}
