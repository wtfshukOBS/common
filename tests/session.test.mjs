import test,{beforeEach,after} from 'node:test';
import assert from 'node:assert/strict';
import {saveSession,storedSession,refreshSession,freshToken,clearSession,authenticatedFetch,sessionExpiry,subscribeSession} from '../lib/session.ts';
import {api} from '../lib/client.ts';
const originalFetch=globalThis.fetch;
const originalWindow=globalThis.window;
const originalStorage=globalThis.localStorage;
const values=new Map();
globalThis.window=new EventTarget();
globalThis.localStorage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
const token=(id,exp,tag='')=>'e30.'+Buffer.from(JSON.stringify({sub:id,exp,tag})).toString('base64url')+'.signature';
const now=()=>Math.floor(Date.now()/1000);
function session(exp=now()+3600,id='member',tag='initial'){return {access_token:token(id,exp,tag),refresh_token:tag+'-refresh',user:{id},expires_at:exp};}
const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
beforeEach(()=>{values.clear();globalThis.fetch=()=>{throw new Error('Unexpected fetch');};});
after(()=>{globalThis.fetch=originalFetch;globalThis.window=originalWindow;if(originalStorage===undefined)delete globalThis.localStorage;else globalThis.localStorage=originalStorage;});

test('Expired restored credentials refresh before the first protected request',async()=>{
 const expired=session(now()-100);saveSession(expired);const renewed=session(now()+3600,'member','renewed');const order=[];
 globalThis.fetch=async(path,init)=>{order.push(path);if(path==='/api/auth'){assert.equal(JSON.parse(init.body).refresh_token,expired.refresh_token);return response(renewed);}assert.equal(new Headers(init.headers).get('Authorization'),'Bearer '+renewed.access_token);return response({items:['profile']});};
 assert.deepEqual(await api('/api/data?kind=profile',expired.access_token),{items:['profile']});assert.deepEqual(order,['/api/auth','/api/data?kind=profile']);assert.equal(storedSession().access_token,renewed.access_token);
});
test('Parallel protected requests share a single rotating refresh',async()=>{
 const expired=session(now()-1);saveSession(expired);let refreshes=0;const renewed=session(now()+3600,'member','parallel');
 globalThis.fetch=async(path)=>{assert.equal(path,'/api/auth');refreshes++;await new Promise(r=>setTimeout(r,5));return response(renewed);};
 const tokens=await Promise.all(Array.from({length:8},()=>freshToken(expired.access_token)));assert.equal(refreshes,1);assert.ok(tokens.every(t=>t===renewed.access_token));
});
test('Old component token uses the already refreshed credentials',async()=>{
 const old=session(now()-1);const current=session(now()+3600,'member','current');saveSession(current);assert.equal(await freshToken(old.access_token),current.access_token);
});
test('Actual JWT expiry overrides incorrect legacy saved expiry',()=>{
 const expired=session(now()-1);expired.expires_at=now()+50000;assert.equal(sessionExpiry(expired),now()-1);assert.equal(sessionExpiry({...expired,expires_at:undefined}),now()-1);
});
test('Server JWT-expired error renews and retries the action once',async()=>{
 const old=session();saveSession(old);const renewed=session(now()+3600,'member','retry');let actions=0,refreshes=0;
 globalThis.fetch=async(path,init)=>{if(path==='/api/auth'){refreshes++;return response(renewed);}actions++;if(actions===1)return response({error:'JWT expired'},400);assert.equal(new Headers(init.headers).get('Authorization'),'Bearer '+renewed.access_token);assert.equal(init.body,'{"action":"like"}');return response({ok:true});};
 assert.deepEqual(await api('/api/social',old.access_token,{action:'like'}),{ok:true});assert.equal(actions,2);assert.equal(refreshes,1);
});
test('Invalid refresh clears the session and never sends the protected action',async()=>{
 const old=session(now()-1);saveSession(old);let calls=0,updates=0;const unsubscribe=subscribeSession(()=>updates++);
 globalThis.fetch=async(path)=>{calls++;assert.equal(path,'/api/auth');return response({error:'Invalid refresh token'},400);};
 await assert.rejects(api('/api/social',old.access_token,{action:'like'}),/Sign in again/);assert.equal(storedSession(),null);assert.equal(calls,1);assert.equal(updates,1);unsubscribe();
});
test('Network failure retains credentials for a later retry',async()=>{
 const old=session(now()-1);saveSession(old);globalThis.fetch=async()=>{throw new TypeError('Network unavailable');};await assert.rejects(refreshSession(),/Network unavailable/);assert.equal(storedSession().refresh_token,old.refresh_token);
});
test('Sign out during refresh cannot resurrect the account',async()=>{
 saveSession(session(now()-1));let release;globalThis.fetch=()=>new Promise(r=>release=r);const pending=refreshSession();clearSession();release(response(session(now()+3600,'member','late')));assert.equal(await pending,null);assert.equal(storedSession(),null);
});
test('A late refresh cannot overwrite another account login',async()=>{
 saveSession(session(now()-1));let release;globalThis.fetch=()=>new Promise(r=>release=r);const pending=refreshSession();const other=session(now()+3600,'other','other');saveSession(other);release(response(session(now()+3600,'member','late')));assert.equal((await pending).user.id,'other');await assert.rejects(freshToken(session().access_token),/Sign in again/);assert.equal(storedSession().user.id,'other');
});
test('Uploads refresh authentication while preserving binary request bodies',async()=>{
 const old=session(now()-1);saveSession(old);const renewed=session(now()+3600,'member','upload'),bytes=new Uint8Array([1,2,3]);
 globalThis.fetch=async(path,init)=>{if(path==='/api/auth')return response(renewed);assert.equal(init.body,bytes);assert.equal(new Headers(init.headers).get('Content-Type'),'image/png');assert.equal(new Headers(init.headers).get('Authorization'),'Bearer '+renewed.access_token);return response({path:'uploaded'});};
 const r=await authenticatedFetch('/api/upload',old.access_token,{method:'POST',headers:{'Content-Type':'image/png'},body:bytes});assert.equal(r.status,200);
});
test('An expired-token response is retried at most once',async()=>{
 const old=session();saveSession(old);let refreshes=0,actions=0;globalThis.fetch=async(path)=>{if(path==='/api/auth'){refreshes++;return response(session(now()+3600,'member','retry'));}actions++;return response({error:'JWT expired'},400);};
 await assert.rejects(api('/api/social',old.access_token,{action:'like'}),/Sign in again/);assert.equal(actions,2);assert.equal(refreshes,1);
});
test('Temporary Auth server failure retains the refresh token',async()=>{
 const old=session(now()-1);saveSession(old);globalThis.fetch=async()=>response({error:'Auth temporarily unavailable'},503);await assert.rejects(refreshSession(),/Could not renew/);assert.equal(storedSession().refresh_token,old.refresh_token);
});
