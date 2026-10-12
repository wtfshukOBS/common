begin;
create table private.media_validation_secret(id boolean primary key default true check(id),secret text not null);
alter table private.media_validation_secret enable row level security;
revoke all on private.media_validation_secret from public,anon,authenticated;
create function private.register_media(file_path text,mime_type text,file_size integer,media_kind text)returns uuid language plpgsql security definer set search_path='' as $$declare uid uuid:=auth.uid();mid uuid;begin
 if uid is null or not exists(select 1 from public.profiles where id=uid and onboarded)then raise exception 'Complete your profile before uploading';end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,1));
 if file_path!~('^'||uid::text||'/[a-f0-9-]{36}\.(png|jpg|webp|mp4)$')or mime_type not in('image/png','image/jpeg','image/webp','video/mp4')or(media_kind='video')<>(mime_type='video/mp4')then raise exception 'Invalid media type or path';end if;
 if file_size>(case when media_kind='video'then 104857600 else 10485760 end)then raise exception 'File exceeds upload limit';end if;
 if(select coalesce(sum(size_bytes),0)from public.uploaded_media where owner_id=uid)>524288000-file_size then raise exception 'Your 500 MB media allowance is full';end if;
 if(select count(*)from public.uploaded_media where owner_id=uid and created_at>now()-interval '1 hour')>=30 then raise exception 'Upload limit reached. Try again later';end if;
 insert into public.uploaded_media(owner_id,path,mime,size_bytes,kind)values(uid,file_path,mime_type,file_size,media_kind)returning id into mid;return mid;
end$$;
create function public.register_media(file_path text,mime_type text,file_size integer,media_kind text)returns uuid language sql security invoker set search_path='' as $$select private.register_media(file_path,mime_type,file_size,media_kind)$$;
create function private.finalize_media(media_uuid uuid,duration numeric,signature text)returns void language plpgsql security definer set search_path='' as $$declare m public.uploaded_media;k text;expected text;begin
 if auth.uid()is null then raise exception 'Sign in to validate media';end if;
 select * into m from public.uploaded_media where id=media_uuid and owner_id=auth.uid()and status='pending'for update;if not found then raise exception 'Upload unavailable';end if;
 select secret into k from private.media_validation_secret where id;
 expected:=encode(extensions.hmac(media_uuid::text||':'||m.size_bytes::text||':'||duration::text,k,'sha256'),'hex');
 if k is null or signature is null or signature<>expected then raise exception 'Media validation signature required';end if;
 if(m.kind='video'and(duration<=0 or duration>180))or(m.kind='image'and duration<>0)then raise exception 'Invalid media duration';end if;
 update public.uploaded_media set status='ready',duration_seconds=case when m.kind='video'then duration else null end where id=media_uuid;
end$$;
create function public.finalize_media(media_uuid uuid,duration numeric,signature text)returns void language sql security invoker set search_path='' as $$select private.finalize_media(media_uuid,duration,signature)$$;
revoke all on function private.register_media(text,text,integer,text),public.register_media(text,text,integer,text),private.finalize_media(uuid,numeric,text),public.finalize_media(uuid,numeric,text)from public;
grant execute on function private.register_media(text,text,integer,text),public.register_media(text,text,integer,text),private.finalize_media(uuid,numeric,text),public.finalize_media(uuid,numeric,text)to authenticated;
create or replace function private.media_visible(mid uuid)returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.uploaded_media m where id=mid and(m.owner_id=auth.uid()or(m.status='ready'and(exists(select 1 from public.post_media pm where pm.media_id=mid and private.post_visible(pm.post_id))or exists(select 1 from public.worlds w where w.cover=m.path and private.world_visible(w.id))or exists(select 1 from public.profiles p where(p.avatar_path=m.path or p.banner_path=m.path)and private.profile_visible(p.id))))))$$;
create or replace function public.create_moment(payload jsonb)returns uuid language plpgsql security invoker set search_path='' as $$declare mid uuid;begin mid:=private.create_event(payload);return mid;end$$;
create function private.create_event(payload jsonb)returns uuid language plpgsql security definer set search_path='' as $$declare mid uuid;sid uuid;cid uuid:=nullif(payload->>'community_id','')::uuid;wid uuid:=nullif(payload->>'world_id','')::uuid;begin
 if auth.uid()is null then raise exception 'Sign in to create an Event';end if;
 if cid is not null and not exists(select 1 from public.community_members where community_id=cid and user_id=auth.uid()and status='active')then raise exception 'Join the community before hosting an Event';end if;
 if wid is not null and not private.world_visible(wid)then raise exception 'World unavailable';end if;
 mid:=private.create_series(payload);select series_id into sid from public.moments where id=mid;
 update public.moments set community_id=cid,world_id=wid where id=mid or(sid is not null and series_id=sid);return mid;
end$$;
revoke all on function private.create_event(jsonb)from public;
grant execute on function private.create_event(jsonb)to authenticated;
-- Extend account export without replacing any existing exported records.
alter function private.export_account()rename to export_account_v1;
create function private.export_account()returns jsonb language plpgsql security definer set search_path='' as $$declare uid uuid:=auth.uid();result jsonb;begin
 result:=private.export_account_v1();return result||jsonb_build_object('posts',coalesce((select jsonb_agg(to_jsonb(p))from public.posts p where author_id=uid),'[]'),'worlds',coalesce((select jsonb_agg(to_jsonb(w))from public.worlds w where owner_id=uid),'[]'),'world_preferences',coalesce((select jsonb_agg(to_jsonb(p))from public.world_preferences p where user_id=uid),'[]'),'follows',coalesce((select jsonb_agg(to_jsonb(f))from public.user_follows f where user_id=uid),'[]'),'direct_messages',coalesce((select jsonb_agg(to_jsonb(m))from public.direct_messages m where author_id=uid),'[]'),'comments',coalesce((select jsonb_agg(to_jsonb(c))from public.post_comments c where author_id=uid),'[]'),'uploads',coalesce((select jsonb_agg(to_jsonb(m))from public.uploaded_media m where owner_id=uid),'[]'));
end$$;
create or replace function public.export_account()returns jsonb language sql security invoker set search_path='' as $$select private.export_account()$$;
revoke all on function private.export_account()from public;
grant execute on function private.export_account()to authenticated;
commit;
