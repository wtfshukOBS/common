begin;
-- A single guarded mutation gateway. Clients never receive direct write grants.
create function private.social_action(operation text,payload jsonb default '{}')returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();pid uuid;wid uuid;cid uuid;tid uuid;mid uuid;rid uuid;item jsonb;w public.worlds;p public.posts;count_value integer;decision text;mix jsonb;begin
 if uid is null or not exists(select 1 from public.profiles where id=uid and onboarded)then raise exception 'Complete your profile to continue';end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,1));
 pid:=nullif(payload->>'post_id','')::uuid;wid:=nullif(payload->>'world_id','')::uuid;cid:=nullif(payload->>'community_id','')::uuid;tid:=nullif(payload->>'target_id','')::uuid;
 if operation in('create_world','update_world')then
 mix:=coalesce(payload->'content_mix','{"video":30,"image":25,"text":25,"community":20}');
 if jsonb_typeof(mix)<>'object'or coalesce((mix->>'video')::numeric,0)<0 or coalesce((mix->>'image')::numeric,0)<0 or coalesce((mix->>'text')::numeric,0)<0 or coalesce((mix->>'community')::numeric,0)<0 or coalesce((mix->>'video')::numeric,0)+coalesce((mix->>'image')::numeric,0)+coalesce((mix->>'text')::numeric,0)+coalesce((mix->>'community')::numeric,0)<=0 then raise exception 'Choose a content mix greater than zero';end if;
 if operation='create_world'then
 if(select count(*)from public.worlds where owner_id=uid)>=30 then raise exception 'World limit reached';end if;
 insert into public.worlds(owner_id,name,description,kind,visibility,category,topics,cover,icon,content_mix,contribution,rules)values(uid,payload->>'name',coalesce(payload->>'description',''),payload->>'kind',case when payload->>'kind'='personal'then 'private'else payload->>'visibility'end,payload->>'category',array(select jsonb_array_elements_text(coalesce(payload->'topics','[]'))),coalesce(payload->>'cover','world-gaming'),coalesce(payload->>'icon','gamepad'),mix,coalesce(payload->>'contribution','members'),coalesce(payload->>'rules',''))returning id into wid;
 insert into public.world_members(world_id,user_id,role)values(wid,uid,'owner');
 else
 if not exists(select 1 from public.worlds where id=wid and owner_id=uid)then raise exception 'Only the owner edits a World';end if;
 update public.worlds set name=payload->>'name',description=coalesce(payload->>'description',''),category=payload->>'category',topics=array(select jsonb_array_elements_text(coalesce(payload->'topics','[]'))),cover=coalesce(payload->>'cover',cover),icon=coalesce(payload->>'icon',icon),content_mix=mix,contribution=coalesce(payload->>'contribution',contribution),rules=coalesce(payload->>'rules','')where id=wid;
 end if;return jsonb_build_object('id',wid);
 elsif operation in('join_world','leave_world','world_role','world_announcement','approve_post','remove_world_post')then
 select * into w from public.worlds where id=wid for update;
 if not found or not private.world_visible(wid)then raise exception 'World unavailable';end if;
 if operation='join_world'then if w.kind<>'public'or w.visibility<>'public'then raise exception 'This World is invitation only';end if;insert into public.world_members(world_id,user_id)values(wid,uid)on conflict do nothing;
 elsif operation='leave_world'then if w.owner_id=uid then raise exception 'Owners retain membership';end if;delete from public.world_members where world_id=wid and user_id=uid;
 elsif operation='world_role'then if w.owner_id<>uid or tid=uid or private.blocked(uid,tid)then raise exception 'Only owners manage other members';end if;
 if payload->>'role' not in('member','moderator')then raise exception 'Invalid role';end if;
 insert into public.world_members(world_id,user_id,role)values(wid,tid,payload->>'role')on conflict(world_id,user_id)do update set role=excluded.role;
 elsif operation='world_announcement'then if not private.world_manager(wid)then raise exception 'Moderator required';end if;update public.worlds set announcement=left(payload->>'body',2000)where id=wid;
 else
 if not private.world_manager(wid)or not private.post_visible(pid)then raise exception 'Moderator access required';end if;
 update public.post_worlds set status=case when operation='approve_post'then 'published'else 'removed'end where world_id=wid and post_id=pid;
 insert into public.moderation_actions(actor_id,world_id,post_id,action)values(uid,wid,pid,operation);
 end if;return jsonb_build_object('ok',true);
 elsif operation='world_preferences'then
 if not private.world_visible(wid)then raise exception 'World unavailable';end if;
 insert into public.world_preferences(world_id,user_id,sort,small_creators,followed_communities,content_mix)values(wid,uid,coalesce(payload->>'sort','balanced'),coalesce((payload->>'small_creators')::boolean,true),coalesce((payload->>'followed_communities')::boolean,false),payload->'content_mix')on conflict(world_id,user_id)do update set sort=excluded.sort,small_creators=excluded.small_creators,followed_communities=excluded.followed_communities,content_mix=excluded.content_mix;return jsonb_build_object('ok',true);
 elsif operation='create_post'then
 if(select count(*)from public.posts where author_id=uid and created_at>now()-interval '1 hour')>=20 then raise exception 'Posting limit reached. Try again later';end if;
 if length(coalesce(payload->>'body',''))=0 and length(coalesce(payload->>'title',''))=0 and jsonb_array_length(coalesce(payload->'media','[]'))=0 then raise exception 'Add something to your post';end if;
 if cid is not null and not exists(select 1 from public.community_members where community_id=cid and user_id=uid and status='active')then raise exception 'Join the community before posting';end if;
 if nullif(payload->>'quoted_post_id','')is not null and not private.post_visible((payload->>'quoted_post_id')::uuid)then raise exception 'Quoted post unavailable';end if;
 if payload->>'type'='poll'and(jsonb_array_length(coalesce(payload->'poll_options','[]'))not between 2 and 6 or (payload->>'poll_closes_at')::timestamptz<=now())then raise exception 'Add 2 to 6 poll options and a future closing time';end if;
 insert into public.posts(author_id,type,title,body,topics,visibility,community_id,quoted_post_id,poll_options,poll_closes_at)values(uid,payload->>'type',coalesce(payload->>'title',''),coalesce(payload->>'body',''),array(select jsonb_array_elements_text(coalesce(payload->'topics','[]'))),coalesce(payload->>'visibility','public'),cid,nullif(payload->>'quoted_post_id','')::uuid,case when payload->>'type'='poll'then array(select jsonb_array_elements_text(payload->'poll_options'))else null end,case when payload->>'type'='poll'then (payload->>'poll_closes_at')::timestamptz else null end)returning id into pid;
 count_value:=0;
 for item in select value from jsonb_array_elements(coalesce(payload->'media','[]'))loop
 mid:=(item->>'id')::uuid;
 if not exists(select 1 from public.uploaded_media where id=mid and owner_id=uid and status='ready')then raise exception 'Finish uploading your media first';end if;
 if payload->>'type'='image'and not exists(select 1 from public.uploaded_media where id=mid and kind='image')then raise exception 'Image posts accept images';end if;
 insert into public.post_media(post_id,media_id,alt_text,position)values(pid,mid,left(coalesce(item->>'alt',''),500),count_value);count_value:=count_value+1;
 end loop;
 if count_value>8 then raise exception 'Use up to 8 attachments';end if;
 if payload->>'type'='image'and count_value=0 then raise exception 'Choose an image';end if;
 if payload->>'type'='video'and(count_value not between 1 and 2 or not exists(select 1 from public.post_media pm join public.uploaded_media m on m.id=pm.media_id where pm.post_id=pid and m.kind='video'))then raise exception 'Choose one video and an optional thumbnail';end if;
 for item in select value from jsonb_array_elements(coalesce(payload->'world_ids','[]'))loop
 wid:=(item#>>'{}')::uuid;select * into w from public.worlds where id=wid;
 if not found or w.kind<>'public'or not private.world_visible(wid)then raise exception 'Choose an accessible public World';end if;
 if payload->>'visibility'<>'public'then raise exception 'Only public posts are distributed to public Worlds';end if;
 if w.contribution='owner'and not private.world_manager(wid)then raise exception 'Only moderators contribute to this World';end if;
 if w.contribution='members'and not exists(select 1 from public.world_members where world_id=wid and user_id=uid)then raise exception 'Join the World before posting';end if;
 insert into public.post_worlds(post_id,world_id,submitted_by,status)values(pid,wid,uid,case when w.contribution='approval'and not private.world_manager(wid)then 'pending'else 'published'end);
 end loop;
 perform private.social_notify(p.author_id,'You were quoted',pid,null,null,uid)from public.posts p where p.id=nullif(payload->>'quoted_post_id','')::uuid and p.author_id<>uid;
 perform private.social_notify(pr.id,'You were mentioned in a post',pid,null,null,uid)from public.profiles pr where pr.id<>uid and not private.blocked(uid,pr.id)and pr.username=any(array(select substring(m[1] from 2)from regexp_matches(coalesce(payload->>'body',''),'(@[a-z0-9_]{3,24})','g')m limit 5));
 return jsonb_build_object('id',pid);
 elsif operation in('like','save_post','repost','share','impression','vote','comment','edit_post','delete_post','pin_post','delete_comment','distribute')then
 if not private.post_visible(pid)then raise exception 'Post unavailable';end if;select * into p from public.posts where id=pid;
 if operation='like'then if exists(select 1 from public.post_likes where post_id=pid and user_id=uid)then delete from public.post_likes where post_id=pid and user_id=uid;else insert into public.post_likes(post_id,user_id)values(pid,uid);if p.author_id<>uid then perform private.social_notify(p.author_id,'Someone liked your post',pid,null,null,uid);end if;end if;
 elsif operation='save_post'then if exists(select 1 from public.post_saves where post_id=pid and user_id=uid)then delete from public.post_saves where post_id=pid and user_id=uid;else insert into public.post_saves(post_id,user_id)values(pid,uid);end if;
 elsif operation='repost'then if p.visibility<>'public'then raise exception 'Only public posts support reposts';end if;if exists(select 1 from public.post_reposts where post_id=pid and user_id=uid)then delete from public.post_reposts where post_id=pid and user_id=uid;else insert into public.post_reposts(post_id,user_id)values(pid,uid);end if;
 elsif operation='share'then if not exists(select 1 from public.post_shares where post_id=pid and user_id=uid and created_at>now()-interval '1 day')then insert into public.post_shares(post_id,user_id)values(pid,uid);end if;
 elsif operation='impression'then if p.author_id<>uid then insert into public.post_impressions(post_id,user_id,watch_seconds)values(pid,uid,greatest(0,least(180,coalesce((payload->>'watch_seconds')::numeric,0))))on conflict(post_id,user_id,day)do update set watch_seconds=greatest(public.post_impressions.watch_seconds,excluded.watch_seconds);end if;
 elsif operation='vote'then count_value:=(payload->>'option_index')::integer;if p.type<>'poll'or p.poll_closes_at<=now()or count_value<0 or count_value>=cardinality(p.poll_options)then raise exception 'Poll unavailable';end if;insert into public.post_votes(post_id,user_id,option_index)values(pid,uid,count_value)on conflict(post_id,user_id)do update set option_index=excluded.option_index;
 elsif operation='comment'then
 if(select count(*)from public.post_comments where author_id=uid and created_at>now()-interval '1 minute')>=15 then raise exception 'Slow down before replying again';end if;
 rid:=nullif(payload->>'parent_id','')::uuid;if rid is not null and not exists(select 1 from public.post_comments where id=rid and post_id=pid and deleted_at is null and not private.blocked(uid,author_id))then raise exception 'Reply unavailable';end if;
 insert into public.post_comments(post_id,author_id,parent_id,body)values(pid,uid,rid,payload->>'body')returning id into mid;
 if p.author_id<>uid then perform private.social_notify(p.author_id,'New comment on your post',pid,null,null,uid);end if;return jsonb_build_object('id',mid);
 elsif operation in('edit_post','delete_post','pin_post')then
 if p.author_id<>uid then raise exception 'Only the author manages this post';end if;
 if operation='edit_post'then update public.posts set body=payload->>'body',title=coalesce(payload->>'title',title),updated_at=now()where id=pid;
 elsif operation='delete_post'then update public.posts set deleted_at=now()where id=pid;
 else update public.posts set pinned=not pinned where id=pid;end if;
 elsif operation='delete_comment'then update public.post_comments set deleted_at=now(),body='[deleted]'where id=(payload->>'comment_id')::uuid and post_id=pid and author_id=uid;if not found then raise exception 'Only the author deletes their comment';end if;
 elsif operation='distribute'then
 select * into w from public.worlds where id=wid;
 if w.kind<>'public'or not private.world_visible(wid)or p.visibility<>'public'then raise exception 'Public World and public post required';end if;
 if w.contribution='owner'and not private.world_manager(wid)then raise exception 'Only moderators contribute';end if;
 if w.contribution='members'and not exists(select 1 from public.world_members where world_id=wid and user_id=uid)then raise exception 'Join the World first';end if;
 insert into public.post_worlds(post_id,world_id,submitted_by,status)values(pid,wid,uid,case when p.author_id=uid and w.contribution<>'approval'or private.world_manager(wid)then 'published'else 'pending'end)on conflict(post_id,world_id)do nothing;
 end if;return jsonb_build_object('ok',true);
 elsif operation in('follow','accept_follow','decline_follow')then
 if tid is null or tid=uid or private.blocked(uid,tid)then raise exception 'Follow unavailable';end if;
 if operation='follow'then
 if exists(select 1 from public.user_follows where user_id=uid and target_id=tid)then delete from public.user_follows where user_id=uid and target_id=tid;
 else insert into public.user_follows(user_id,target_id,status)select uid,tid,case when visibility='private'then 'pending'else 'active'end from public.profiles where id=tid;perform private.social_notify(tid,'New follow or follow request',null,null,null,uid);end if;
 elsif operation='accept_follow'then update public.user_follows set status='active'where user_id=tid and target_id=uid;
 else delete from public.user_follows where user_id=tid and target_id=uid and status='pending';end if;return jsonb_build_object('ok',true);
 elsif operation='visit_profile'then if tid<>uid and not private.blocked(uid,tid)then insert into public.profile_visits(profile_id,user_id)values(tid,uid)on conflict do nothing;end if;return '{}'::jsonb;
 elsif operation='profile_customize'then
 if payload->>'accent'!~'^#[0-9a-fA-F]{6}$'or payload->>'layout'not in('grid','list')then raise exception 'Choose a valid accent and layout';end if;
 for item in select value from jsonb_each(coalesce(payload->'social_links','{}'))loop if item#>>'{}'!~'^https://'then raise exception 'Social links must use HTTPS';end if;end loop;
 update public.profiles set accent=payload->>'accent',layout=payload->>'layout',social_links=coalesce(payload->'social_links','{}'),visibility=coalesce(payload->>'visibility','public')where id=uid;return '{}'::jsonb;
 elsif operation in('create_community','join_community','leave_community','community_role','community_announcement','approve_member')then
 if operation='create_community'then
 if(select count(*)from public.communities where owner_id=uid)>=20 then raise exception 'Community limit reached';end if;
 insert into public.communities(owner_id,name,description,visibility,approval_required)values(uid,payload->>'name',coalesce(payload->>'description',''),coalesce(payload->>'visibility','public'),coalesce((payload->>'approval_required')::boolean,false))returning id into cid;
 insert into public.community_members(community_id,user_id,role)values(cid,uid,'owner');
 for item in select value from jsonb_array_elements(coalesce(payload->'world_ids','[]'))loop wid:=(item#>>'{}')::uuid;if not private.world_visible(wid)or not exists(select 1 from public.worlds where id=wid and kind='public')then raise exception 'Choose a public World';end if;insert into public.community_worlds(community_id,world_id)values(cid,wid);end loop;return jsonb_build_object('id',cid);
 end if;
 if not private.community_visible(cid)then raise exception 'Community unavailable';end if;
 if operation='join_community'then if not exists(select 1 from public.communities where id=cid and visibility='public')then raise exception 'Private membership requires an invitation';end if;insert into public.community_members(community_id,user_id,status)select cid,uid,case when approval_required then 'pending'else 'active'end from public.communities where id=cid on conflict do nothing;
 elsif operation='leave_community'then if exists(select 1 from public.communities where id=cid and owner_id=uid)then raise exception 'Owners retain membership';end if;delete from public.community_members where community_id=cid and user_id=uid;
 elsif operation='community_announcement'then if not private.community_manager(cid)then raise exception 'Moderator required';end if;update public.communities set announcement=left(payload->>'body',2000)where id=cid;
 else
 if not private.community_manager(cid)or tid=uid or private.blocked(uid,tid)then raise exception 'Moderator required';end if;
 if operation='community_role'and not exists(select 1 from public.communities where id=cid and owner_id=uid)then raise exception 'Only owners assign moderators';end if;
 if operation='community_role'and payload->>'role'not in('member','moderator')then raise exception 'Invalid role';end if;
 insert into public.community_members(community_id,user_id,role,status)values(cid,tid,case when operation='community_role'then payload->>'role'else 'member'end,'active')on conflict(community_id,user_id)do update set status='active',role=case when operation='community_role'then excluded.role else public.community_members.role end;
 insert into public.moderation_actions(actor_id,community_id,action)values(uid,cid,operation);
 end if;return jsonb_build_object('ok',true);
 elsif operation in('create_conversation','send_dm','edit_dm','delete_dm','read_conversation','mute_conversation')then
 if operation='create_conversation'then
 if jsonb_array_length(payload->'members')not between 1 and 11 then raise exception 'Choose 1 to 11 people';end if;
 for item in select value from jsonb_array_elements(payload->'members')loop
 tid:=(item#>>'{}')::uuid;
 if tid=uid or private.blocked(uid,tid)or not exists(select 1 from public.user_settings s where s.user_id=tid and(s.messages_from='anyone'or(s.messages_from='following'and exists(select 1 from public.user_follows where user_id=tid and target_id=uid and status='active'))or(s.messages_from='connections'and exists(select 1 from public.connection_requests where status='accepted'and((sender_id=uid and recipient_id=tid)or(sender_id=tid and recipient_id=uid))))))then raise exception 'This person is not accepting messages from you';end if;
 end loop;
 if jsonb_array_length(payload->'members')=1 then
 select c.id into rid from public.conversations c where(select count(*)from public.conversation_members cm where cm.conversation_id=c.id)=2 and exists(select 1 from public.conversation_members cm where cm.conversation_id=c.id and cm.user_id=uid)and exists(select 1 from public.conversation_members cm where cm.conversation_id=c.id and cm.user_id=(payload->'members'->>0)::uuid)limit 1;if found then return jsonb_build_object('id',rid);end if;
 end if;
 insert into public.conversations(creator_id,title)values(uid,left(coalesce(payload->>'title',''),80))returning id into rid;
 insert into public.conversation_members(conversation_id,user_id)values(rid,uid);
 insert into public.conversation_members(conversation_id,user_id)select rid,value::uuid from jsonb_array_elements_text(payload->'members');return jsonb_build_object('id',rid);
 end if;
 rid:=(payload->>'conversation_id')::uuid;if not private.conversation_member(rid)then raise exception 'Conversation unavailable';end if;
 if operation='send_dm'then
 if(select count(*)from public.direct_messages where author_id=uid and created_at>now()-interval '1 minute')>=20 then raise exception 'Messaging limit reached';end if;
 insert into public.direct_messages(conversation_id,author_id,body)values(rid,uid,payload->>'body')returning id into mid;
 perform private.social_notify(cm.user_id,'New message',null,null,rid,uid)from public.conversation_members cm where cm.conversation_id=rid and cm.user_id<>uid and not cm.muted;return jsonb_build_object('id',mid);
 elsif operation='edit_dm'then update public.direct_messages set body=payload->>'body',edited_at=now()where id=(payload->>'message_id')::uuid and conversation_id=rid and author_id=uid and deleted_at is null and created_at>now()-interval '15 minutes';if not found then raise exception 'Edit your own recent messages';end if;
 elsif operation='delete_dm'then update public.direct_messages set body='[deleted]',deleted_at=now()where id=(payload->>'message_id')::uuid and conversation_id=rid and author_id=uid;if not found then raise exception 'Only authors delete messages';end if;
 elsif operation='read_conversation'then update public.conversation_members set read_at=now()where conversation_id=rid and user_id=uid;
 else update public.conversation_members set muted=not muted where conversation_id=rid and user_id=uid;end if;return '{}'::jsonb;
 elsif operation='report_post'then
 if not private.post_visible(pid)then raise exception 'Post unavailable';end if;
 if(select count(*)from public.reports where reporter_id=uid and created_at>now()-interval '1 hour')>=10 then raise exception 'Reporting limit reached';end if;
 insert into public.reports(reporter_id,post_id,world_id,reason)values(uid,pid,wid,payload->>'reason');return '{}'::jsonb;
 end if;raise exception 'Unsupported action';
end$$;
create function private.social_notify(uid uuid,label text,pid uuid,wid uuid,cid uuid,actor uuid)returns void language plpgsql security definer set search_path='' as $$begin
 if not private.blocked(uid,actor)and exists(select 1 from public.user_settings where user_id=uid and notifications_enabled)and not exists(select 1 from public.notifications where user_id=uid and title=label and actor_id=actor and post_id is not distinct from pid and created_at>now()-interval '1 hour')then insert into public.notifications(user_id,title,post_id,world_id,conversation_id,actor_id)values(uid,label,pid,wid,cid,actor);end if;
end$$;
create function public.social_action(operation text,payload jsonb default '{}')returns jsonb language sql security invoker set search_path='' as $$select private.social_action(operation,payload)$$;
revoke all on function private.social_notify(uuid,text,uuid,uuid,uuid,uuid),private.social_action(text,jsonb),public.social_action(text,jsonb)from public;
grant execute on function private.social_action(text,jsonb),public.social_action(text,jsonb)to authenticated;
grant execute on function private.world_manager(uuid),private.community_manager(uuid)to anon;
commit;
