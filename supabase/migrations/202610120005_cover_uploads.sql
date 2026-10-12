begin;
alter table public.moments drop constraint moments_cover_check;
alter table public.moments add constraint moments_cover_check check(cover in ('gaming','movies','art') or cover ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}\.(png|jpg|webp)$');
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)values('moment-covers','moment-covers',false,5242880,array['image/png','image/jpeg','image/webp'])on conflict(id)do nothing;
create policy common_cover_upload on storage.objects for insert to authenticated with check(bucket_id='moment-covers' and(storage.foldername(name))[1]=(select auth.uid())::text);
create policy common_cover_read on storage.objects for select to authenticated using(bucket_id='moment-covers' and((storage.foldername(name))[1]=(select auth.uid())::text or exists(select 1 from public.moments m where m.cover=name and private.visible(m.id))));
create policy common_cover_delete on storage.objects for delete to authenticated using(bucket_id='moment-covers' and(storage.foldername(name))[1]=(select auth.uid())::text);
-- An uploaded cover must belong to the host. No arbitrary external image URLs.
create function private.check_cover()returns trigger language plpgsql security invoker set search_path='' as $$begin
 if new.cover not in ('gaming','movies','art') and split_part(new.cover,'/',1)<>new.host_id::text then raise exception 'Use your own uploaded cover';end if;return new;
end$$;
revoke all on function private.check_cover()from public;
create trigger check_moment_cover before insert or update of cover on public.moments for each row execute function private.check_cover();
commit;
