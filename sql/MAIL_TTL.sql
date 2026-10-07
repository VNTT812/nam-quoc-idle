-- Hộp thư: tự xóa thư cũ hơn 24 giờ (+ list_mail chỉ trả thư còn hạn).
-- Chạy 1 lần trên Supabase SQL Editor (sau MAIL_FIX.sql).
-- Client cũng lọc theo 24h khi đọc; RPC này dọn bảng thật trên máy chủ.

create index if not exists mail_created_idx on public.mail (created);

-- Xóa thư > 24h
create or replace function public.mail_purge_old()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  delete from public.mail where created < now() - interval '24 hours';
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.mail_purge_old() from public;
grant execute on function public.mail_purge_old() to anon, authenticated;

-- list_mail: chỉ thư trong 24h gần nhất
create or replace function public.list_mail()
returns setof public.mail
language sql
stable
security definer
set search_path = public
as $$
  select m.* from public.mail m
  where auth.uid() is not null
    and m.to_name in (select name from public.my_mail_names())
    and m.created >= now() - interval '24 hours'
  order by m.id desc
  limit 50;
$$;

grant execute on function public.list_mail() to authenticated;

-- Nếu bật pg_cron: dọn mỗi giờ (bỏ comment).
-- create extension if not exists pg_cron with schema extensions;
-- select cron.schedule('mail-purge-24h', '25 * * * *', $$select public.mail_purge_old()$$);
-- select cron.schedule('fchat-purge-24h', '30 * * * *', $$select public.fchat_purge_old()$$);
