import test from 'node:test';
import assert from 'node:assert/strict';
import {momentSchema,profileSchema,isAdult,authRequestSchema} from '../lib/validation.ts';
const valid={title:'A shared game',description:'Join a few relaxed co-op rounds.',category:'Gaming',start_at:'2026-12-01T18:00:00Z',duration_minutes:60,capacity:6,language:'English',visibility:'public',approval_required:false,voice:'optional',meeting_url:'',tags:[],cover:'gaming',status:'scheduled'};
test('Moment validation rejects unsafe URLs and out-of-range capacity',()=>{assert.equal(momentSchema.safeParse(valid).success,true);assert.equal(momentSchema.safeParse({...valid,capacity:1}).success,false);assert.equal(momentSchema.safeParse({...valid,meeting_url:'javascript:alert(1)'}).success,false);assert.equal(momentSchema.safeParse({...valid,meeting_url:'http://example.com'}).success,false);assert.equal(momentSchema.safeParse({...valid,capacity:101}).success,false);});
test('Adult eligibility handles the birthday boundary and future dates',()=>{const date=new Date('2026-10-12T00:00:00Z');assert.equal(isAdult('2008-10-12',date),true);assert.equal(isAdult('2008-10-13',date),false);assert.equal(isAdult('2027-01-01',date),false);assert.equal(isAdult('invalid',date),false);});
test('Profile validation rejects executable or malformed usernames',()=>{const profile={username:'new_friend',display_name:'A Friend',bio:'',interests:['Gaming'],language:'English',group_size:'small',onboarded:true};assert.equal(profileSchema.safeParse(profile).success,true);assert.equal(profileSchema.safeParse({...profile,username:'<script>'}).success,false);});
test('Recurring series and upload paths are bounded',()=>{assert.equal(momentSchema.safeParse({...valid,occurrences:7}).success,false);assert.equal(momentSchema.safeParse({...valid,cover:'https://tracker.invalid/image'}).success,false);});

test('Sign-in accepts legacy null birthdate without requiring age details',()=>{
 const request=authRequestSchema.parse({action:'login',email:'friend@example.com',password:'existing-password',birthdate:null});
 assert.equal(request.action,'login');assert.equal('birthdate' in request,false);
});
test('Signup requires a birthdate and returns a readable missing-field error',()=>{
 for(const birthdate of [undefined,null,'']){
 const result=authRequestSchema.safeParse({action:'signup',email:'friend@example.com',password:'secure-password',birthdate});
 assert.equal(result.success,false);assert.match(result.error.issues[0].message,/date of birth/);
 }
 const result=authRequestSchema.parse({action:'signup',email:'friend@example.com',password:'secure-password',birthdate:'1990-01-01'});
 assert.equal(result.birthdate,'1990-01-01');
});
