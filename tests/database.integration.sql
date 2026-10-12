-- Run against the dedicated Common database. All test data rolls back.
begin;
select set_config('common.test_a',gen_random_uuid()::text,true),set_config('common.test_b',gen_random_uuid()::text,true),set_config('common.test_c',gen_random_uuid()::text,true);
insert into auth.users(id,email,raw_user_meta_data)values
(current_setting('common.test_a')::uuid,'common-test-a@example.invalid','{"birthdate":"1990-01-01"}'),
(current_setting('common.test_b')::uuid,'common-test-b@example.invalid','{"birthdate":"1990-01-01"}'),
(current_setting('common.test_c')::uuid,'common-test-c@example.invalid','{"birthdate":"1990-01-01"}');
update public.profiles set onboarded=true where id in (current_setting('common.test_a')::uuid,current_setting('common.test_b')::uuid,current_setting('common.test_c')::uuid);
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('common.test_a'),true);
select set_config('common.test_m',public.create_moment('{"title":"Capacity test","description":"An integration test Moment","category":"Gaming","tags":[],"cover":"gaming","start_at":"2026-12-01T18:00:00Z","duration_minutes":60,"capacity":2,"language":"English","visibility":"public","approval_required":false,"voice":"text","meeting_url":"","status":"live"}')::text,true);
select set_config('common.test_private',public.create_moment('{"title":"Private test","description":"A private integration test Moment","category":"Art","tags":[],"cover":"art","start_at":"2026-12-01T18:00:00Z","duration_minutes":60,"capacity":3,"language":"English","visibility":"private","approval_required":false,"voice":"text","meeting_url":"","status":"live"}')::text,true);
select set_config('request.jwt.claim.sub',current_setting('common.test_b'),true);
do $$begin
 if exists(select 1 from public.moments where id=current_setting('common.test_private')::uuid)then raise exception 'FAIL: private Moment leaked';end if;
 if exists(select 1 from public.user_settings where user_id=current_setting('common.test_a')::uuid)then raise exception 'FAIL: another user settings leaked';end if;
 begin perform public.send_moment_message(current_setting('common.test_m')::uuid,'Unauthorized message');raise exception 'FAIL: nonparticipant posted';exception when others then if sqlerrm like 'FAIL:%'then raise;end if;end;
 begin perform public.moment_action(current_setting('common.test_m')::uuid,'status',null,'cancelled');raise exception 'FAIL: nonhost changed status';exception when others then if sqlerrm like 'FAIL:%'then raise;end if;end;
 perform public.moment_action(current_setting('common.test_m')::uuid,'join');
 perform public.moment_action(current_setting('common.test_m')::uuid,'join');
 if(select count(*)from public.moment_participants where moment_id=current_setting('common.test_m')::uuid)<>2 then raise exception 'FAIL: duplicate membership';end if;
 perform public.send_moment_message(current_setting('common.test_m')::uuid,'Authorized message');
end$$;
select set_config('request.jwt.claim.sub',current_setting('common.test_c'),true);
do $$begin
 begin perform public.moment_action(current_setting('common.test_m')::uuid,'join');raise exception 'FAIL: over capacity';exception when others then if sqlerrm like 'FAIL:%'then raise;end if;end;
 if exists(select 1 from public.moment_messages where moment_id=current_setting('common.test_m')::uuid)then raise exception 'FAIL: private room chat leaked';end if;
 begin perform public.connection_action(current_setting('common.test_a')::uuid,'request');raise exception 'FAIL: unshared connection';exception when others then if sqlerrm like 'FAIL:%'then raise;end if;end;
end$$;
select set_config('request.jwt.claim.sub',current_setting('common.test_a'),true);
select public.moment_action(current_setting('common.test_m')::uuid,'status',null,'completed');
select set_config('request.jwt.claim.sub',current_setting('common.test_b'),true);
select public.connection_action(current_setting('common.test_a')::uuid,'request');
select public.moment_action(current_setting('common.test_m')::uuid,'save');
select set_config('request.jwt.claim.sub',current_setting('common.test_a'),true);
do $$begin
 if exists(select 1 from public.moment_saves where user_id=current_setting('common.test_b')::uuid)then raise exception 'FAIL: private saves leaked';end if;
 perform public.connection_action(current_setting('common.test_b')::uuid,'accepted');
 perform public.block_user(current_setting('common.test_b')::uuid);
 if exists(select 1 from public.connection_requests where sender_id=current_setting('common.test_b')::uuid)then raise exception 'FAIL: block retained connection';end if;
 begin perform public.moment_action(current_setting('common.test_private')::uuid,'invite',current_setting('common.test_b')::uuid);raise exception 'FAIL: blocked invitation';exception when others then if sqlerrm like 'FAIL:%'then raise;end if;end;
 if public.export_account()->'profile'->>'id'<>current_setting('common.test_a')then raise exception 'FAIL: wrong export';end if;
end$$;
select set_config('request.jwt.claim.sub',current_setting('common.test_c'),true);
select public.delete_account();
do $$begin if exists(select 1 from public.profiles where id=current_setting('common.test_c')::uuid)then raise exception 'FAIL: account deletion';end if;end$$;
rollback;
select 'All database integration checks passed. Test data rolled back.' as result;
