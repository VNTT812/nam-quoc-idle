-- Chat log: tự xóa tin nhắn cũ hơn 24 giờ.
-- Chạy một lần trên Supabase SQL Editor (sau NET_SETUP.sql).
-- Client cũng lọc theo 24h khi đọc; RPC này dọn bảng thật trên máy chủ.

create index if not exists chat_ts_idx on public.chat (ts);

create or replace function public.chat_purge_old()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  delete from public.chat where ts < now() - interval '24 hours';
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.chat_purge_old() from public;
grant execute on function public.chat_purge_old() to anon, authenticated;

-- Nếu bật extension pg_cron trên project: dọn mỗi giờ (bỏ comment 2 dòng dưới).
-- create extension if not exists pg_cron with schema extensions;
-- select cron.schedule('chat-purge-24h', '20 * * * *', $$select public.chat_purge_old()$$);
