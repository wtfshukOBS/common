import assert from 'node:assert/strict';
import readline from 'node:readline';
console.log('Ready for hidden test configuration');
const rl=readline.createInterface({input:process.stdin});
const line=await new Promise(r=>rl.once('line',r));rl.close();const cfg=JSON.parse(line);
const tokens=[];
async function call(path,token,body){const r=await fetch(cfg.url+path,{method:body?'POST':'GET',headers:{apikey:cfg.key,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};}
try{
 for(const id of cfg.ids){const r=await call('/auth/v1/token?grant_type=password',null,{email:'common-check-'+id+'@example.invalid',password:cfg.password});assert.equal(r.status,200,JSON.stringify(r.data));tokens.push(r.data.access_token);}
 const authSettings=await call('/auth/v1/settings');console.log('Email/password enabled:',authSettings.data.external?.email);
 const created=await call('/rest/v1/rpc/create_moment',tokens[0],{payload:{title:'Temporary capacity check',description:'Temporary live integration check.',category:'Gaming',tags:[],cover:'gaming',start_at:new Date().toISOString(),duration_minutes:60,capacity:2,language:'English',visibility:'public',approval_required:false,voice:'text',meeting_url:'',status:'live'}});assert.equal(created.status,200,JSON.stringify(created.data));const mid=created.data;
 const race=await Promise.all([1,2].map(i=>call('/rest/v1/rpc/moment_action',tokens[i],{moment_uuid:mid,action_name:'join'})));assert.equal(race.filter(r=>r.status===200).length,1);assert.equal(race.filter(r=>r.status!==200).length,1);console.log('Simultaneous joins: exactly one claimed the last space.');
 const m=await call('/rest/v1/moments?select=*,host:profiles!host_id(id,display_name,username),participants:moment_participants(user_id,joined_at)',tokens[0]);assert.equal(m.status,200,JSON.stringify(m.data));assert.equal(m.data.find(m=>m.id===mid).participants.length,2);console.log('Moment query, profile joins, and participant count passed.');
 const guest=await call('/rest/v1/moments?select=*');assert.ok(guest.status>=400);console.log('Anonymous database access denied.');
 const message=await call('/rest/v1/rpc/send_moment_message',tokens[0],{moment_uuid:mid,message_content:'Test hello'});assert.equal(message.status,200);
 const msgs=await call('/rest/v1/moment_messages?moment_id=eq.'+mid+'&select=*,author:profiles!author_id(display_name,username)',tokens[0]);assert.equal(msgs.status,200,JSON.stringify(msgs.data));console.log('Authenticated room messaging passed.');
 const fake=await call('/rest/v1/user_settings?user_id=eq.'+cfg.ids[0]+'&select=*',tokens[1]);assert.deepEqual(fake.data,[]);console.log('Cross-user private data denied.');
}finally{for(const token of tokens){const r=await call('/rest/v1/rpc/delete_account',token,{});if(r.status!==200)console.log('Cleanup requires database fallback.');}console.log('Live checks finished.');}
