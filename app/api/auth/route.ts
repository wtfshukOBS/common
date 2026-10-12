import {z} from 'zod';
import {sb,user} from '@/lib/backend';
import {signupSchema,isAdult} from '@/lib/validation';
export async function POST(req:Request){try{const b=z.object({action:z.enum(['signup','login','refresh','logout']),email:z.string().email().optional(),password:z.string().max(128).optional(),birthdate:z.string().optional(),refresh_token:z.string().max(3000).optional()}).parse(await req.json());let result;
 if(b.action==='signup'){const p=signupSchema.parse(b);if(!isAdult(p.birthdate))return Response.json({error:'Common is currently for adults aged 18 and over.'},{status:400});result=await sb('/auth/v1/signup',undefined,{method:'POST',body:JSON.stringify({email:p.email,password:p.password,data:{birthdate:p.birthdate}})});}
 else if(b.action==='login')result=await sb('/auth/v1/token?grant_type=password',undefined,{method:'POST',body:JSON.stringify({email:b.email,password:b.password})});
 else if(b.action==='refresh')result=await sb('/auth/v1/token?grant_type=refresh_token',undefined,{method:'POST',body:JSON.stringify({refresh_token:b.refresh_token})});
 else if(b.action==='logout'){const {token}=await user(req);await sb('/auth/v1/logout',token,{method:'POST'});result={ok:true};}
 else return Response.json({error:'Unsupported authentication action.'},{status:400});
 return Response.json(result,{headers:{'Cache-Control':'no-store'}});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Authentication failed.'},{status:400});}}
