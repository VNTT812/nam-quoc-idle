-- Võ Lâm Idle — schema online (Supabase)
-- Chạy trong SQL Editor của project: https://supabase.com/dashboard/project/khwkokiflhzwxuzoilux/sql
-- Sau đó: Authentication > Providers > Email > tắt "Confirm email"

-- ========== BẢNG ==========
create table if not exists public.chars (
  owner uuid not null references auth.users(id) on delete cascade,
  slot int not null check (slot >= 0 and slot <= 2),
  name text not null,
  fac text,
  sex int not null default 0,
  lvl int not null default 1,
  reborn int not null default 0,
  power double precision not null default 0,
  tower int not null default 0,
  bosses int not null default 0,
  gear jsonb not null default '{}'::jsonb,
  updated timestamptz not null default now(),
  primary key (owner, slot),
  constraint chars_name unique (name)
);

create table if not exists public.saves (
  owner uuid not null references auth.users(id) on delete cascade,
  slot int not null check (slot >= 0 and slot <= 2),
  name text,
  lvl int,
  fac text,
  data text not null,
  updated timestamptz not null default now(),
  primary key (owner, slot)
);

create table if not exists public.mail (
  id bigserial primary key,
  to_name text not null,
  from_name text,
  from_owner uuid references auth.users(id) on delete set null,
  kind text,
  item jsonb,
  gold bigint not null default 0,
  note text,
  created timestamptz not null default now()
);
create index if not exists mail_to_name_idx on public.mail (to_name);

create table if not exists public.market (
  id bigserial primary key,
  seller uuid not null references auth.users(id) on delete cascade,
  seller_name text,
  item jsonb not null,
  iname text,
  price bigint not null check (price >= 1),
  created timestamptz not null default now()
);
create index if not exists market_seller_idx on public.market (seller);

create table if not exists public.chat (
  id bigserial primary key,
  cid text,
  name text,
  fac text,
  lvl int,
  msg text,
  item jsonb,
  ts timestamptz not null default now()
);

-- ========== RLS ==========
alter table public.chars enable row level security;
alter table public.saves enable row level security;
alter table public.mail enable row level security;
alter table public.market enable row level security;
alter table public.chat enable row level security;

-- chars: ai cũng xem xếp hạng / trang bị; chỉ chủ sửa được
drop policy if exists chars_select on public.chars;
create policy chars_select on public.chars for select using (true);
drop policy if exists chars_upsert on public.chars;
create policy chars_upsert on public.chars for insert with check (auth.uid() = owner);
drop policy if exists chars_update on public.chars;
create policy chars_update on public.chars for update using (auth.uid() = owner);
drop policy if exists chars_delete on public.chars;
create policy chars_delete on public.chars for delete using (auth.uid() = owner);

-- saves: chỉ chủ
drop policy if exists saves_all on public.saves;
create policy saves_select on public.saves for select using (auth.uid() = owner);
create policy saves_insert on public.saves for insert with check (auth.uid() = owner);
create policy saves_update on public.saves for update using (auth.uid() = owner);
create policy saves_delete on public.saves for delete using (auth.uid() = owner);

-- mail: nhận theo tên nhân vật thuộc tài khoản; gửi khi đã đăng nhập
drop policy if exists mail_select on public.mail;
create policy mail_select on public.mail for select using (
  to_name in (select name from public.chars where owner = auth.uid())
);
drop policy if exists mail_insert on public.mail;
create policy mail_insert on public.mail for insert with check (auth.uid() = from_owner);

-- market: ai cũng xem; chỉ chủ bày / gỡ (gỡ qua RPC)
drop policy if exists market_select on public.market;
create policy market_select on public.market for select using (true);
drop policy if exists market_insert on public.market;
create policy market_insert on public.market for insert with check (auth.uid() = seller);
drop policy if exists market_delete on public.market;
create policy market_delete on public.market for delete using (auth.uid() = seller);

-- chat: ai đọc / gửi khi đã đăng nhập
drop policy if exists chat_select on public.chat;
create policy chat_select on public.chat for select using (true);
drop policy if exists chat_insert on public.chat;
create policy chat_insert on public.chat for insert with check (auth.uid() is not null);

-- ========== RPC ==========
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
     and to_name in (select name from public.chars where owner = auth.uid())
   for update;
  if not found then raise exception 'Thư không tồn tại hoặc không phải của bạn'; end if;
  delete from public.mail where id = mid;
  return m;
end;
$$;

create or replace function public.market_buy(lid bigint, buyer text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  l public.market;
  tax numeric := 0.05;
  pay bigint;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  if buyer is null or length(trim(buyer)) < 2 then raise exception 'Thiếu tên người mua'; end if;
  if not exists (select 1 from public.chars where owner = auth.uid() and name = buyer) then
    raise exception 'Tên nhân vật không thuộc tài khoản';
  end if;
  select * into l from public.market where id = lid for update;
  if not found then raise exception 'Món đã bán hoặc đã gỡ'; end if;
  if l.seller = auth.uid() then raise exception 'Không mua món của chính mình'; end if;
  pay := greatest(0, floor(l.price * (1 - tax)));
  delete from public.market where id = lid;
  insert into public.mail(to_name, from_name, from_owner, kind, item, gold, note)
  values (buyer, l.seller_name, l.seller, 'buy', l.item, 0, 'Mua ở chợ');
  insert into public.mail(to_name, from_name, from_owner, kind, item, gold, note)
  values (l.seller_name, buyer, auth.uid(), 'sell', null, pay, 'Bán ở chợ (−5% thuế)');
end;
$$;

create or replace function public.market_cancel(lid bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  l public.market;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  select * into l from public.market where id = lid and seller = auth.uid() for update;
  if not found then raise exception 'Không tìm thấy hàng của bạn'; end if;
  delete from public.market where id = lid;
  insert into public.mail(to_name, from_name, from_owner, kind, item, gold, note)
  values (l.seller_name, l.seller_name, auth.uid(), 'cancel', l.item, 0, 'Gỡ bán — món về thư');
end;
$$;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.chars to authenticated;
grant select on public.chars to anon;
grant select, insert, update, delete on public.saves to authenticated;
grant select, insert on public.mail to authenticated;
grant select, insert, delete on public.market to authenticated;
grant select on public.market to anon;
grant select, insert on public.chat to authenticated;
grant select on public.chat to anon;
grant usage, select on all sequences in schema public to authenticated;
grant execute on function public.claim_mail(bigint) to authenticated;
grant execute on function public.market_buy(bigint, text) to authenticated;
grant execute on function public.market_cancel(bigint) to authenticated;

-- Realtime chat
alter publication supabase_realtime add table public.chat;
