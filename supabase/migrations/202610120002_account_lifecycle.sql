begin;
create function private.delete_account() returns void language plpgsql security definer set search_path='' as $$declare uid uuid:=auth.uid();begin
 if uid is null or not exists(select 1 from public.profiles where id=uid) then raise exception 'Account not found';end if;
 delete from auth.sessions where user_id=uid;
 delete from auth.users where id=uid;
end$$;
create function public.delete_account() returns void language sql security invoker set search_path='' as $$select private.delete_account()$$;
revoke all on function private.delete_account(),public.delete_account() from public;
grant execute on function private.delete_account(),public.delete_account() to authenticated;
create function private.export_account() returns jsonb language plpgsql security definer set search_path='' as $$declare uid uuid:=auth.uid();result jsonb;begin
 if uid is null or not exists(select 1 from public.profiles where id=uid)then raise exception 'Account not found';end if;
 select jsonb_build_object('profile',(select to_jsonb(p)from public.profiles p where id=uid),'settings',(select to_jsonb(s)from public.user_settings s where user_id=uid),'hosted_moments',coalesce((select jsonb_agg(to_jsonb(m))from public.moments m where host_id=uid),'[]'),'participation',coalesce((select jsonb_agg(to_jsonb(p))from public.moment_participants p where user_id=uid),'[]'),'saved_moments',coalesce((select jsonb_agg(to_jsonb(s))from public.moment_saves s where user_id=uid),'[]'),'messages',coalesce((select jsonb_agg(to_jsonb(m))from public.moment_messages m where author_id=uid),'[]'),'connections',coalesce((select jsonb_agg(to_jsonb(c))from public.connection_requests c where sender_id=uid or recipient_id=uid),'[]'),'reports',coalesce((select jsonb_agg(to_jsonb(r))from public.reports r where reporter_id=uid),'[]'),'blocks',coalesce((select jsonb_agg(to_jsonb(b))from public.user_blocks b where user_id=uid),'[]'),'notifications',coalesce((select jsonb_agg(to_jsonb(n))from public.notifications n where user_id=uid),'[]'))into result;return result;
end$$;
create function public.export_account() returns jsonb language sql security invoker set search_path='' as $$select private.export_account()$$;
revoke all on function private.export_account(),public.export_account() from public;
grant execute on function private.export_account(),public.export_account() to authenticated;
-- Serializing creation and message rate checks closes concurrent rate-limit bypasses.
create function private.rate_lock() returns trigger language plpgsql security definer set search_path='' as $$begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 if TG_TABLE_NAME='moment_messages' and(select count(*)from public.moment_messages where author_id=auth.uid() and created_at>now()-interval '1 minute')>=20 then raise exception 'Message limit reached';end if;
 if TG_TABLE_NAME='moments' and(select count(*)from public.moments where host_id=auth.uid() and created_at>now()-interval '1 hour')>=10 then raise exception 'Moment creation limit reached';end if;
 return new;
end$$;
revoke all on function private.rate_lock() from public;
create trigger moment_rate before insert on public.moments for each row execute function private.rate_lock();
create trigger message_rate before insert on public.moment_messages for each row execute function private.rate_lock();
commit;
