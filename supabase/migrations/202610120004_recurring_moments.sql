begin;
create table public.moment_series(id uuid primary key default gen_random_uuid(),host_id uuid not null references public.profiles on delete cascade,frequency text not null check(frequency='weekly'),created_at timestamptz not null default now());
alter table public.moment_series enable row level security;
revoke all on public.moment_series from anon,authenticated;
grant select on public.moment_series to authenticated;
create policy series_read on public.moment_series for select to authenticated using(host_id=(select auth.uid()));
create index on public.moment_series(host_id);
alter table public.moments add column series_id uuid references public.moment_series on delete set null;
create index on public.moments(series_id);
create function private.create_series(payload jsonb)returns uuid language plpgsql security definer set search_path='' as $$declare mid uuid;next_id uuid;sid uuid;occurrences integer:=coalesce((payload->>'occurrences')::integer,1);i integer;begin
 if auth.uid() is null then raise exception 'Sign in to create a Moment';end if;
 if occurrences not between 1 and 6 then raise exception 'Choose 1 to 6 weekly occurrences';end if;
 if occurrences>1 and payload->>'status'<>'scheduled' then raise exception 'Recurring Moments must be scheduled';end if;
 mid:=private.create_moment(payload);
 if occurrences>1 then
 insert into public.moment_series(host_id,frequency)values(auth.uid(),'weekly')returning id into sid;
 update public.moments set series_id=sid where id=mid;
 for i in 1..occurrences-1 loop
 next_id:=private.create_moment(jsonb_set(payload,'{start_at}',to_jsonb(((payload->>'start_at')::timestamptz+make_interval(days=>7*i))::text)));
 update public.moments set series_id=sid where id=next_id;
 end loop;
 end if;return mid;
end$$;
revoke all on function private.create_series(jsonb)from public;
grant execute on function private.create_series(jsonb)to authenticated;
create or replace function public.create_moment(payload jsonb) returns uuid language sql security invoker set search_path='' as $$select private.create_series(payload)$$;
commit;
