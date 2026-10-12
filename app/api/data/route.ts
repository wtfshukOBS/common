import {z} from 'zod';
import {sb,user,config} from '@/lib/backend';
import {momentSchema,profileSchema} from '@/lib/validation';
const json=(v:unknown)=>Response.json(v,{headers:{'Cache-Control':'no-store'}});
async function covers(items:Record<string,unknown>[],token:string){return Promise.all(items.map(async m=>{if(typeof m.cover==='string'&&m.cover.includes('/')){try{const signed=await sb('/storage/v1/object/sign/moment-covers/'+m.cover,token,{method:'POST',body:JSON.stringify({expiresIn:3600})});m.cover_url=config().url+'/storage/v1'+signed.signedURL;}catch{m.cover_url='/covers/art.webp';}}return m;}));}
export async function GET(req:Request){try{const q=new URL(req.url).searchParams,kind=q.get('kind');if(!config().url)return json({configured:false,items:[]});const {token,id}=await user(req);let path='';
 if(kind==='profile')path='/rest/v1/profiles?id=eq.'+id+'&select=*';
 else if(kind==='settings')path='/rest/v1/user_settings?user_id=eq.'+id+'&select=*';
 else if(kind==='moments'){const page=Math.max(0,Math.min(10000,Number(q.get('page'))||0));path='/rest/v1/moments?select=*,host:profiles!host_id(id,display_name,username),participants:moment_participants(user_id,joined_at)&order=start_at.asc&limit=24&offset='+page*24;}
 else if(kind==='room'){const mid=q.get('id');if(!mid||! /^[a-f0-9-]{36}$/.test(mid))throw new Error('Invalid Moment.');const [moments,messages,requests]=await Promise.all([sb('/rest/v1/moments?id=eq.'+mid+'&select=*,host:profiles!host_id(id,display_name,username),participants:moment_participants(user_id,joined_at,profile:profiles(id,display_name,username))',token),sb('/rest/v1/moment_messages?moment_id=eq.'+mid+'&select=*,author:profiles!author_id(display_name,username)&order=created_at.desc&limit=50',token),sb('/rest/v1/moment_join_requests?moment_id=eq.'+mid+'&status=eq.pending&select=*,profile:profiles!user_id(display_name,username)',token)]);const invites=await sb('/rest/v1/moment_invitations?moment_id=eq.'+mid+'&user_id=eq.'+id+'&status=eq.pending&select=*',token);return json({moment:(await covers(moments,token))[0],messages:messages.reverse(),requests,invited:invites.length>0});}
 else if(kind==='messages'){const mid=z.string().uuid().parse(q.get('id'));const before=z.string().datetime().parse(q.get('before'));path='/rest/v1/moment_messages?moment_id=eq.'+mid+'&created_at=lt.'+encodeURIComponent(before)+'&select=*,author:profiles!author_id(display_name,username)&order=created_at.desc&limit=50';}
 else if(kind==='saved')path='/rest/v1/moment_saves?user_id=eq.'+id+'&select=moment_id';
 else if(kind==='notifications')path='/rest/v1/notifications?user_id=eq.'+id+'&select=*&order=created_at.desc&limit=30';
 else if(kind==='connections')path='/rest/v1/connection_requests?select=*,sender:profiles!sender_id(id,display_name,username),recipient:profiles!recipient_id(id,display_name,username)&order=created_at.desc&limit=100';
 else throw new Error('Unknown resource.');const items=await sb(path,token);return json({items:kind==='moments'?await covers(items,token):items,configured:true});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Unable to load data.'},{status:400});}}
export async function POST(req:Request){try{const {token,id}=await user(req);const b=z.object({action:z.string(),profile:z.unknown().optional(),settings:z.record(z.union([z.boolean(),z.string()])).optional(),moment:z.unknown().optional(),moment_id:z.string().uuid().optional(),target_user:z.string().uuid().optional(),status:z.string().max(1000).optional(),content:z.string().max(2000).optional(),decision:z.string().optional(),reason:z.string().max(1000).optional(),enjoyed:z.boolean().optional()}).parse(await req.json());let result;const rpc=async(name:string,args:unknown)=>sb('/rest/v1/rpc/'+name,token,{method:'POST',body:JSON.stringify(args)});
 if(b.action==='profile'){const p=profileSchema.parse(b.profile);result=await sb('/rest/v1/profiles?id=eq.'+id,token,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(p)});}
 else if(b.action==='settings'){const allowed=['theme','personalization','read_receipts','notifications_enabled'];const values=Object.fromEntries(Object.entries(b.settings||{}).filter(([k,v])=>allowed.includes(k)&&(k==='theme'?['dark','light','system'].includes(String(v)):typeof v==='boolean')));result=await sb('/rest/v1/user_settings?user_id=eq.'+id,token,{method:'PATCH',body:JSON.stringify(values)});}
 else if(b.action==='create'){const p=momentSchema.parse(b.moment);result=await rpc('create_moment',{payload:p});}
 else if(['join','leave','approve','remove','status','save','pin','invite','accept_invite'].includes(b.action))result=await rpc('moment_action',{moment_uuid:b.moment_id,action_name:b.action,target_user:b.target_user||null,new_status:b.status||null});
 else if(b.action==='message'){if(typeof b.content!=='string'||!b.content.trim()||b.content.length>2000)throw new Error('Write a message of 1 to 2,000 characters.');result=await rpc('send_moment_message',{moment_uuid:b.moment_id,message_content:b.content.trim()});}
 else if(b.action==='decline_invite')result=await rpc('decline_invitation',{mid:b.moment_id});
 else if(b.action==='feedback'){if(typeof b.enjoyed!=='boolean')throw new Error('Choose your feedback.');result=await rpc('feedback',{mid:b.moment_id,liked:b.enjoyed});}
 else if(b.action==='connect')result=await rpc('connection_action',{target_user:b.target_user,action_name:b.decision||'request'});
 else if(b.action==='report')result=await rpc('report_content',{moment_uuid:b.moment_id||null,target_user:b.target_user||null,reason_text:String(b.reason||'').slice(0,1000)});
 else if(b.action==='block')result=await rpc('block_user',{target_user:b.target_user});
 else if(b.action==='read_notifications')result=await sb('/rest/v1/notifications?user_id=eq.'+id+'&read_at=is.null',token,{method:'PATCH',body:JSON.stringify({read_at:new Date().toISOString()})});
 else if(b.action==='export')return json(await rpc('export_account',{}));
 else if(b.action==='delete_account'){if(req.headers.get('x-confirm-delete')!=='DELETE')throw new Error('Account deletion requires confirmation.');result=await rpc('delete_account',{});}
 else throw new Error('Unsupported action.');return json({result});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Action failed.'},{status:400});}}
