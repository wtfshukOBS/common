-- Common foundation. Apply only to a dedicated Common project.
begin;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;
create table public.profiles(id uuid primary key references auth.users on delete cascade, username text unique check(username ~ '^[a-z0-9_]{3,24}$'),display_name text not null default 'New member' check(length(display_name) between 2 and 50),bio text not null default '' check(length(bio)<=500),interests text[] not null default '{}',language text not null default 'English',group_size text not null default 'small' check(group_size in ('small','medium','any')),onboarded boolean not null default false,created_at timestamptz not null default now());
create table public.user_settings(user_id uuid primary key references public.profiles on delete cascade,birthdate date not null check(birthdate<=current_date-interval '18 years'),theme text not null default 'system' check(theme in ('dark','light','system')),personalization boolean not null default true,read_receipts boolean not null default false,notifications_enabled boolean not null default true);
create table public.moments(id uuid primary key default gen_random_uuid(),host_id uuid not null references public.profiles on delete cascade,title text not null check(length(title) between 3 and 100),description text not null check(length(description) between 10 and 3000),category text not null check(category in ('Gaming','Movies','Music','Art','Study','Discussion','Books','Hangout')),tags text[] not null default '{}',cover text not null default 'gaming' check(cover in ('gaming','movies','art')),start_at timestamptz not null,duration_minutes integer not null check(duration_minutes between 15 and 720),capacity integer not null check(capacity between 2 and 100),language text not null default 'English',visibility text not null check(visibility in ('public','private')),approval_required boolean not null default false,voice text not null check(voice in ('optional','required','text')),meeting_url text not null default '' check(meeting_url='' or meeting_url ~ '^https://'),status text not null check(status in ('draft','scheduled','open','live','completed','cancelled')),announcement text not null default '',created_at timestamptz not null default now(),completed_at timestamptz);
create table public.moment_participants(moment_id uuid references public.moments on delete cascade,user_id uuid references public.profiles on delete cascade,joined_at timestamptz not null default now(),primary key(moment_id,user_id));
create table public.moment_join_requests(moment_id uuid references public.moments on delete cascade,user_id uuid references public.profiles on delete cascade,status text not null default 'pending' check(status in ('pending','approved','declined')),created_at timestamptz not null default now(),primary key(moment_id,user_id));
create table public.moment_invitations(moment_id uuid references public.moments on delete cascade,user_id uuid references public.profiles on delete cascade,invited_by uuid not null references public.profiles on delete cascade,status text not null default 'pending' check(status in ('pending','accepted','declined')),primary key(moment_id,user_id));
create table public.moment_messages(id uuid primary key default gen_random_uuid(),moment_id uuid not null references public.moments on delete cascade,author_id uuid not null references public.profiles on delete cascade,content text not null check(length(content) between 1 and 2000),created_at timestamptz not null default now());
create table public.moment_saves(moment_id uuid references public.moments on delete cascade,user_id uuid references public.profiles on delete cascade,created_at timestamptz not null default now(),primary key(moment_id,user_id));
create table public.notifications(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles on delete cascade,title text not null,moment_id uuid references public.moments on delete cascade,created_at timestamptz not null default now(),read_at timestamptz);
create table public.user_blocks(user_id uuid references public.profiles on delete cascade,blocked_id uuid references public.profiles on delete cascade,created_at timestamptz not null default now(),primary key(user_id,blocked_id),check(user_id<>blocked_id));
create table public.connection_requests(id uuid primary key default gen_random_uuid(),sender_id uuid not null references public.profiles on delete cascade,recipient_id uuid not null references public.profiles on delete cascade,status text not null default 'pending' check(status in ('pending','accepted','declined')),created_at timestamptz not null default now(),unique(sender_id,recipient_id),check(sender_id<>recipient_id));
create table public.reports(id uuid primary key default gen_random_uuid(),reporter_id uuid not null references public.profiles on delete cascade,moment_id uuid references public.moments on delete cascade,target_user uuid references public.profiles on delete cascade,reason text not null check(length(reason) between 10 and 1000),created_at timestamptz not null default now(),status text not null default 'open');
create index on public.moments(status,start_at);
create index on public.moments(host_id);
create index on public.moment_participants(user_id);
create index on public.moment_messages(moment_id,created_at);
create index on public.notifications(user_id,created_at desc);
create index on public.connection_requests(recipient_id);
create index on public.user_blocks(blocked_id);
create function private.signup_profile() returns trigger language plpgsql security definer set search_path='' as $$
declare birthday date;
begin
 if new.is_anonymous is true then raise exception 'Anonymous accounts are not supported';end if;
 begin birthday:=(new.raw_user_meta_data->>'birthdate')::date;exception when others then raise exception 'A valid birth date is required';end;
 if birthday is null or birthday>current_date-interval '18 years' then raise exception 'Common is for adults aged 18 and over';end if;
 insert into public.profiles(id) values(new.id);
 insert into public.user_settings(user_id,birthdate) values(new.id,birthday);return new;
end $$;
revoke all on function private.signup_profile() from public;
create trigger common_signup after insert on auth.users for each row execute function private.signup_profile();
create function private.blocked(a uuid,b uuid) returns boolean language sql stable security definer set search_path='' as $$select auth.uid() is not null and exists(select 1 from public.user_blocks where (user_id=a and blocked_id=b) or (user_id=b and blocked_id=a))$$;
create function private.member(mid uuid) returns boolean language sql stable security definer set search_path='' as $$select auth.uid() is not null and exists(select 1 from public.moment_participants where moment_id=mid and user_id=auth.uid())$$;
create function private.host(mid uuid) returns boolean language sql stable security definer set search_path='' as $$select auth.uid() is not null and exists(select 1 from public.moments where id=mid and host_id=auth.uid())$$;
create function private.visible(mid uuid) returns boolean language sql stable security definer set search_path='' as $$select auth.uid() is not null and exists(select 1 from public.moments m where m.id=mid and not private.blocked(auth.uid(),m.host_id) and (m.host_id=auth.uid() or (m.visibility='public' and m.status<>'draft') or private.member(mid) or exists(select 1 from public.moment_invitations i where i.moment_id=mid and i.user_id=auth.uid() and i.status in ('pending','accepted'))))$$;
revoke all on function private.blocked(uuid,uuid),private.member(uuid),private.host(uuid),private.visible(uuid) from public;
grant execute on function private.blocked(uuid,uuid),private.member(uuid),private.host(uuid),private.visible(uuid) to authenticated;
do $$ declare t text;begin foreach t in array array['profiles','user_settings','moments','moment_participants','moment_join_requests','moment_invitations','moment_messages','moment_saves','notifications','user_blocks','connection_requests','reports'] loop execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from anon,authenticated',t);execute format('grant select on public.%I to authenticated',t);end loop;end $$;
create policy profile_read on public.profiles for select to authenticated using(not private.blocked(auth.uid(),id));
create policy profile_write on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
grant update(username,display_name,bio,interests,language,group_size,onboarded) on public.profiles to authenticated;
create policy settings_read on public.user_settings for select to authenticated using(user_id=auth.uid());
create policy settings_write on public.user_settings for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
grant update(theme,personalization,read_receipts,notifications_enabled) on public.user_settings to authenticated;
create policy moment_read on public.moments for select to authenticated using(private.visible(id));
create policy participant_read on public.moment_participants for select to authenticated using(private.visible(moment_id) and not private.blocked(auth.uid(),user_id));
create policy request_read on public.moment_join_requests for select to authenticated using(user_id=auth.uid() or private.host(moment_id));
create policy invitation_read on public.moment_invitations for select to authenticated using(user_id=auth.uid() or private.host(moment_id));
create policy message_read on public.moment_messages for select to authenticated using(private.visible(moment_id) and private.member(moment_id) and not private.blocked(auth.uid(),author_id));
create policy save_read on public.moment_saves for select to authenticated using(user_id=auth.uid());
create policy notification_read on public.notifications for select to authenticated using(user_id=auth.uid());
create policy notification_write on public.notifications for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
grant update(read_at) on public.notifications to authenticated;
create policy block_read on public.user_blocks for select to authenticated using(user_id=auth.uid());
create policy connection_read on public.connection_requests for select to authenticated using((sender_id=auth.uid() or recipient_id=auth.uid()) and not private.blocked(sender_id,recipient_id));
create policy report_read on public.reports for select to authenticated using(reporter_id=auth.uid());
create function private.notify(uid uuid,label text,mid uuid default null) returns void language plpgsql security definer set search_path='' as $$begin insert into public.notifications(user_id,title,moment_id) select uid,label,mid where exists(select 1 from public.user_settings where user_id=uid and notifications_enabled);end$$;
revoke all on function private.notify(uuid,text,uuid) from public;
create function private.create_moment(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare mid uuid;uid uuid:=auth.uid();begin
 if uid is null or not exists(select 1 from public.profiles where id=uid and onboarded) then raise exception 'Complete your profile first';end if;
 if (select count(*) from public.moments where host_id=uid and created_at>now()-interval '1 hour')>=10 then raise exception 'Moment creation limit reached. Try again later';end if;
 if payload->>'status' not in ('draft','scheduled','live') then raise exception 'Invalid initial status';end if;
 insert into public.moments(host_id,title,description,category,tags,cover,start_at,duration_minutes,capacity,language,visibility,approval_required,voice,meeting_url,status)
 values(uid,payload->>'title',payload->>'description',payload->>'category',array(select jsonb_array_elements_text(payload->'tags')),payload->>'cover',(payload->>'start_at')::timestamptz,(payload->>'duration_minutes')::integer,(payload->>'capacity')::integer,payload->>'language',payload->>'visibility',(payload->>'approval_required')::boolean,payload->>'voice',payload->>'meeting_url',payload->>'status') returning id into mid;
 insert into public.moment_participants(moment_id,user_id)values(mid,uid);return mid;
end$$;
create function public.create_moment(payload jsonb) returns uuid language sql security invoker set search_path='' as $$select private.create_moment(payload)$$;
create function private.moment_action(moment_uuid uuid,action_name text,target_user uuid default null,new_status text default null) returns text language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();m public.moments;target uuid;begin
 if uid is null then raise exception 'Sign in to continue';end if;
 select * into m from public.moments where id=moment_uuid for update;
 if not found or not private.visible(moment_uuid) then raise exception 'Moment unavailable';end if;
 if action_name in ('join','approve','accept_invite') then
  if m.status not in ('scheduled','open','live') then raise exception 'This Moment is not accepting participants';end if;
  target:=case when action_name='approve' then target_user else uid end;
  if target is null then raise exception 'Member required';end if;
  if action_name='approve' and (m.host_id<>uid or not exists(select 1 from public.moment_join_requests where moment_id=moment_uuid and user_id=target and status='pending')) then raise exception 'Only the host approves pending requests';end if;
  if private.blocked(target,m.host_id) or exists(select 1 from public.moment_participants p where p.moment_id=moment_uuid and private.blocked(target,p.user_id)) then raise exception 'This group is unavailable';end if;
  if exists(select 1 from public.moment_participants where moment_id=moment_uuid and user_id=target) then return 'Already joined';end if;
  if m.visibility='private' and action_name<>'approve' and not exists(select 1 from public.moment_invitations where moment_id=moment_uuid and user_id=uid and status='pending') then raise exception 'Invitation required';end if;
  if action_name='accept_invite' and not exists(select 1 from public.moment_invitations where moment_id=moment_uuid and user_id=uid and status='pending') then raise exception 'No pending invitation';end if;
  if m.approval_required and action_name='join' and uid<>m.host_id then
   insert into public.moment_join_requests(moment_id,user_id)values(moment_uuid,uid)on conflict(moment_id,user_id)do update set status='pending';perform private.notify(m.host_id,'New join request: '||m.title,moment_uuid);return 'Join request sent';
  end if;
  if (select count(*) from public.moment_participants where moment_id=moment_uuid)>=m.capacity then raise exception 'This Moment is full';end if;
  insert into public.moment_participants(moment_id,user_id)values(moment_uuid,target);
  update public.moment_join_requests set status='approved' where moment_id=moment_uuid and user_id=target;
  update public.moment_invitations set status='accepted' where moment_id=moment_uuid and user_id=target;
  if action_name='approve' then perform private.notify(target,'You are in: '||m.title,moment_uuid);end if;return 'Joined';
 elsif action_name='leave' then
  if m.host_id=uid then raise exception 'Hosts should end or cancel their Moment';end if;
  delete from public.moment_participants where moment_id=moment_uuid and user_id=uid;return 'Left Moment';
 elsif action_name='remove' then
  if m.host_id<>uid or target_user=uid then raise exception 'Only hosts remove other participants';end if;
  delete from public.moment_participants where moment_id=moment_uuid and user_id=target_user;
  update public.moment_join_requests set status='declined' where moment_id=moment_uuid and user_id=target_user;
  update public.moment_invitations set status='declined' where moment_id=moment_uuid and user_id=target_user;return 'Removed';
 elsif action_name='status' then
  if m.host_id<>uid then raise exception 'Only the host changes status';end if;
  if m.status in ('completed','cancelled') then raise exception 'This Moment has ended';end if;
  if new_status not in ('scheduled','open','live','completed','cancelled') then raise exception 'Invalid status';end if;
  if new_status='completed' and m.status<>'live' then raise exception 'Start the Moment before completing it';end if;
  update public.moments set status=new_status,completed_at=case when new_status='completed' then now() else null end where id=moment_uuid;
  if new_status in ('cancelled','completed') then perform private.notify(p.user_id,case when new_status='completed' then 'Moment completed: ' else 'Moment cancelled: ' end||m.title,moment_uuid) from public.moment_participants p where p.moment_id=moment_uuid;end if;return 'Status updated';
 elsif action_name='save' then
  if exists(select 1 from public.moment_saves where moment_id=moment_uuid and user_id=uid)then delete from public.moment_saves where moment_id=moment_uuid and user_id=uid;return 'Removed from saved';end if;
  insert into public.moment_saves(moment_id,user_id)values(moment_uuid,uid);return 'Saved privately';
 elsif action_name='pin' then
  if m.host_id<>uid or length(new_status)>1000 then raise exception 'Only the host writes announcements, up to 1,000 characters';end if;
  update public.moments set announcement=coalesce(new_status,'') where id=moment_uuid;return 'Announcement updated';
 elsif action_name='invite' then
  if not private.member(moment_uuid) or target_user is null or private.blocked(uid,target_user) or private.blocked(m.host_id,target_user) then raise exception 'Invitation unavailable';end if;
  if m.visibility='private' and m.host_id<>uid then raise exception 'Only the host invites to private Moments';end if;
  if (select count(*) from public.moment_invitations where invited_by=uid)>=500 then raise exception 'Invitation limit reached';end if;
  insert into public.moment_invitations(moment_id,user_id,invited_by)values(moment_uuid,target_user,uid)on conflict(moment_id,user_id)do update set status='pending';perform private.notify(target_user,'You are invited: '||m.title,moment_uuid);return 'Invitation sent';
 end if;raise exception 'Unknown action';
end$$;
create function public.moment_action(moment_uuid uuid,action_name text,target_user uuid default null,new_status text default null) returns text language sql security invoker set search_path='' as $$select private.moment_action(moment_uuid,action_name,target_user,new_status)$$;
create function private.send_moment_message(moment_uuid uuid,message_content text) returns uuid language plpgsql security definer set search_path='' as $$declare mid uuid;begin
 if auth.uid() is null or not private.visible(moment_uuid) or not private.member(moment_uuid) or not exists(select 1 from public.moments where id=moment_uuid and status in ('scheduled','open','live')) then raise exception 'Join an active Moment to chat';end if;
 if (select count(*) from public.moment_messages where author_id=auth.uid() and created_at>now()-interval '1 minute')>=20 then raise exception 'Slow down. Try again in a minute';end if;
 insert into public.moment_messages(moment_id,author_id,content)values(moment_uuid,auth.uid(),message_content)returning id into mid;return mid;end$$;
create function public.send_moment_message(moment_uuid uuid,message_content text) returns uuid language sql security invoker set search_path='' as $$select private.send_moment_message(moment_uuid,message_content)$$;
create function private.connection_action(target_user uuid,action_name text) returns text language plpgsql security definer set search_path='' as $$declare uid uuid:=auth.uid();begin
 if uid is null or target_user=uid or private.blocked(uid,target_user) then raise exception 'Connection unavailable';end if;
 if action_name='request' then
 if not exists(select 1 from public.moment_participants a join public.moment_participants b on a.moment_id=b.moment_id join public.moments m on m.id=a.moment_id where a.user_id=uid and b.user_id=target_user and m.status='completed') then raise exception 'Share a completed Moment before connecting';end if;
 insert into public.connection_requests(sender_id,recipient_id)values(uid,target_user)on conflict(sender_id,recipient_id)do update set status='pending';perform private.notify(target_user,'New connection request');return 'Request sent';
 elsif action_name in ('accepted','declined') then update public.connection_requests set status=action_name where sender_id=target_user and recipient_id=uid and status='pending';if not found then raise exception 'Pending request not found';end if;return 'Request updated';
 elsif action_name='remove' then delete from public.connection_requests where(sender_id=uid and recipient_id=target_user)or(sender_id=target_user and recipient_id=uid);return 'Connection removed';end if;raise exception 'Unknown action';end$$;
create function public.connection_action(target_user uuid,action_name text) returns text language sql security invoker set search_path='' as $$select private.connection_action(target_user,action_name)$$;
create function private.report_content(moment_uuid uuid,target_user uuid,reason_text text) returns uuid language plpgsql security definer set search_path='' as $$declare rid uuid;begin
 if auth.uid() is null then raise exception 'Sign in to report';end if;
 if moment_uuid is not null and not private.visible(moment_uuid) then raise exception 'Moment unavailable';end if;
 if moment_uuid is null and target_user is null then raise exception 'Report a Moment or member';end if;
 if(select count(*)from public.reports where reporter_id=auth.uid() and created_at>now()-interval '1 hour')>=10 then raise exception 'Report limit reached';end if;
 insert into public.reports(reporter_id,moment_id,target_user,reason)values(auth.uid(),moment_uuid,target_user,reason_text)returning id into rid;return rid;end$$;
create function public.report_content(moment_uuid uuid,target_user uuid,reason_text text)returns uuid language sql security invoker set search_path='' as $$select private.report_content(moment_uuid,target_user,reason_text)$$;
create function private.block_user(target_user uuid) returns void language plpgsql security definer set search_path='' as $$begin
 if auth.uid() is null or target_user=auth.uid() then raise exception 'Invalid block';end if;
 insert into public.user_blocks(user_id,blocked_id)values(auth.uid(),target_user)on conflict do nothing;
 delete from public.connection_requests where(sender_id=auth.uid() and recipient_id=target_user)or(sender_id=target_user and recipient_id=auth.uid());
 delete from public.moment_invitations where (invited_by=auth.uid() and user_id=target_user)or(invited_by=target_user and user_id=auth.uid());
end$$;
create function public.block_user(target_user uuid)returns void language sql security invoker set search_path='' as $$select private.block_user(target_user)$$;
-- Privileged implementations are private. Public wrappers run with caller privileges.
revoke all on function public.create_moment(jsonb),public.moment_action(uuid,text,uuid,text),public.send_moment_message(uuid,text),public.connection_action(uuid,text),public.report_content(uuid,uuid,text),public.block_user(uuid) from public;
revoke all on function private.create_moment(jsonb),private.moment_action(uuid,text,uuid,text),private.send_moment_message(uuid,text),private.connection_action(uuid,text),private.report_content(uuid,uuid,text),private.block_user(uuid) from public;
grant execute on function public.create_moment(jsonb),public.moment_action(uuid,text,uuid,text),public.send_moment_message(uuid,text),public.connection_action(uuid,text),public.report_content(uuid,uuid,text),public.block_user(uuid) to authenticated;
grant execute on function private.create_moment(jsonb),private.moment_action(uuid,text,uuid,text),private.send_moment_message(uuid,text),private.connection_action(uuid,text),private.report_content(uuid,uuid,text),private.block_user(uuid) to authenticated;
alter publication supabase_realtime add table public.moments,public.moment_messages,public.moment_participants,public.notifications;
commit;
