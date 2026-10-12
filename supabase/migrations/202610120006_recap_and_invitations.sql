begin;
create table public.moment_feedback(moment_id uuid references public.moments on delete cascade,user_id uuid references public.profiles on delete cascade,enjoyed boolean not null,created_at timestamptz not null default now(),primary key(moment_id,user_id));
alter table public.moment_feedback enable row level security;
revoke all on public.moment_feedback from anon,authenticated;
grant select on public.moment_feedback to authenticated;
create policy feedback_read on public.moment_feedback for select to authenticated using(user_id=(select auth.uid()));
create index on public.moment_feedback(user_id);
create function private.feedback(mid uuid,liked boolean)returns void language plpgsql security definer set search_path='' as $$begin
 if auth.uid() is null or not private.member(mid) or not exists(select 1 from public.moments where id=mid and status='completed')then raise exception 'Give feedback after a Moment you joined';end if;
 insert into public.moment_feedback(moment_id,user_id,enjoyed)values(mid,auth.uid(),liked)on conflict(moment_id,user_id)do update set enjoyed=liked;
end$$;
create function public.feedback(mid uuid,liked boolean)returns void language sql security invoker set search_path='' as $$select private.feedback(mid,liked)$$;
create function private.decline_invitation(mid uuid)returns void language plpgsql security definer set search_path='' as $$begin
 if auth.uid() is null then raise exception 'Sign in first';end if;
 update public.moment_invitations set status='declined' where moment_id=mid and user_id=auth.uid() and status='pending';
 if not found then raise exception 'No pending invitation';end if;
end$$;
create function public.decline_invitation(mid uuid)returns void language sql security invoker set search_path='' as $$select private.decline_invitation(mid)$$;
revoke all on function private.feedback(uuid,boolean),public.feedback(uuid,boolean),private.decline_invitation(uuid),public.decline_invitation(uuid)from public;
grant execute on function private.feedback(uuid,boolean),public.feedback(uuid,boolean),private.decline_invitation(uuid),public.decline_invitation(uuid)to authenticated;
commit;
