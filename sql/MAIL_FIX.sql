-- Vá thư: nhìn thấy / nhận thư theo tên trong chars HOẶC saves.
-- Chạy 1 lần trong Supabase SQL Editor:
-- https://supabase.com/dashboard/project/khwkokiflhzwxuzoilux/sql
-- (cần để Admin cấp đồ / cấp hoạt động đúng)

-- Tên nhân vật thuộc tài khoản (chars + saves)
create or replace function public.my_mail_names()
returns table(name text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct n from (
    select c.name as n from public.chars c
      where c.owner = auth.uid() and coalesce(c.name, '') <> ''
    union
    select s.name as n from public.saves s
      where s.owner = auth.uid() and coalesce(s.name, '') <> ''
  ) x;
$$;

-- Liệt kê thư (bỏ qua RLS hẹp)
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
  order by m.id desc
  limit 50;
$$;

-- Nhận thư: khớp chars + saves
create or replace function public.claim_mail(mid bigint)
returns public.mail
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.mail;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  select * into m from public.mail
   where id = mid
     and to_name in (select name from public.my_mail_names())
   for update;
  if not found then raise exception 'Thư không tồn tại hoặc không phải của bạn'; end if;
  delete from public.mail where id = mid;
  return m;
end;
$$;

-- Admin gửi thư (chỉ email admin@…)
create or replace function public.admin_send_mail(
  p_to text,
  p_item jsonb default null,
  p_gold bigint default 0,
  p_note text default '',
  p_kind text default 'gift',
  p_from text default 'Admin'
)
returns public.mail
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.mail;
  em text;
  dest text := trim(coalesce(p_to, ''));
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  select u.email into em from auth.users u where u.id = auth.uid();
  if em is null or split_part(lower(em), '@', 1) <> 'admin' then
    raise exception 'Chỉ tài khoản admin';
  end if;
  if length(dest) < 1 then raise exception 'Thiếu người nhận'; end if;
  if not exists (
    select 1 from public.chars where name = dest
    union all
    select 1 from public.saves where name = dest
  ) then
    raise exception 'Không tìm thấy nhân vật %', dest;
  end if;
  insert into public.mail(to_name, from_name, from_owner, kind, item, gold, note)
  values (
    dest,
    coalesce(nullif(trim(coalesce(p_from, '')), ''), 'Admin'),
    auth.uid(),
    coalesce(nullif(trim(coalesce(p_kind, '')), ''), 'gift'),
    p_item,
    greatest(0, coalesce(p_gold, 0)),
    left(coalesce(p_note, ''), 100)
  )
  returning * into m;
  return m;
end;
$$;

-- Nới policy select (chars ∪ saves)
drop policy if exists mail_select on public.mail;
create policy mail_select on public.mail for select using (
  to_name in (
    select name from public.chars where owner = auth.uid()
    union
    select name from public.saves where owner = auth.uid() and coalesce(name, '') <> ''
  )
);

grant execute on function public.my_mail_names() to authenticated;
grant execute on function public.list_mail() to authenticated;
grant execute on function public.claim_mail(bigint) to authenticated;
grant execute on function public.admin_send_mail(text, jsonb, bigint, text, text, text) to authenticated;
