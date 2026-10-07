-- Chat ban be (tin rieng 1-1). Chay trong Supabase SQL Editor.
-- Project: https://supabase.com/dashboard/project/khwkokiflhzwxuzoilux/sql
-- Sau khi chay: Database > Replication > bat bang public.fchat (Realtime)

create table if not exists public.fchat (
  id bigserial primary key,
  from_name text not null,
  to_name text not null,
  cid text,
  fac text,
  lvl int,
  msg text not null,
  item jsonb,
  ts timestamptz not null default now()
);

create index if not exists fchat_to_ts_idx on public.fchat (to_name, ts desc);
create index if not exists fchat_from_ts_idx on public.fchat (from_name, ts desc);
create index if not exists fchat_pair_ts_idx on public.fchat (from_name, to_name, ts desc);

alter table public.fchat enable row level security;

drop policy if exists fchat_select on public.fchat;
create policy fchat_select on public.fchat for select using (
  from_name in (select name from public.chars where owner = auth.uid())
  or to_name in (select name from public.chars where owner = auth.uid())
);

drop policy if exists fchat_insert on public.fchat;
create policy fchat_insert on public.fchat for insert with check (
  auth.uid() is not null
  and from_name in (select name from public.chars where owner = auth.uid())
);

-- Xoa tin > 24h (goi kem chat_purge_old neu muon)
create or replace function public.fchat_purge_old()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare n int;
begin
  delete from public.fchat where ts < now() - interval '24 hours';
  get diagnostics n = row_count;
  return n;
end;
$$;

grant execute on function public.fchat_purge_old() to anon, authenticated;
grant select, insert on public.fchat to authenticated;
grant usage, select on sequence public.fchat_id_seq to authenticated;
