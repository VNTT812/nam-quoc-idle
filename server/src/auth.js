/**
 * Xac thuc access_token Supabase (JWT).
 * Local/dev: neu MP_DEV_OPEN=1 thi chap nhan { cid, name } khong token (CHI de test).
 */
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL || 'https://khwkokiflhzwxuzoilux.supabase.co';
const KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || '';
const DEV_OPEN = process.env.MP_DEV_OPEN === '1';

let sb = null;
function client() {
  if (!KEY) return null;
  if (!sb) sb = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  return sb;
}

export async function authPlayer(msg) {
  if (DEV_OPEN && msg && msg.devCid) {
    return {
      cid: String(msg.devCid).slice(0, 64),
      email: 'dev@local'
    };
  }
  const token = msg && msg.token;
  if (!token || typeof token !== 'string') {
    throw new Error('Thiếu token đăng nhập');
  }
  const c = client();
  if (!c) throw new Error('Server chưa cấu hình SUPABASE_ANON_KEY');
  const { data, error } = await c.auth.getUser(token);
  if (error || !data?.user) throw new Error('Token không hợp lệ / hết hạn');
  return { cid: data.user.id, email: data.user.email || '' };
}
