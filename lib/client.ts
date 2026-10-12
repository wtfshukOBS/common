export type Session={access_token:string;refresh_token:string;expires_at?:number;expires_in?:number;user:{id:string;email?:string}};
export type Profile={id:string;username:string;display_name:string;bio:string;interests:string[];language:string;group_size:'small'|'medium'|'any';onboarded:boolean};
export type Person={id:string;display_name:string;username:string};
export type Moment={id:string;host_id:string;title:string;description:string;category:string;cover:string;tags:string[];start_at:string;duration_minutes:number;capacity:number;language:string;visibility:string;approval_required:boolean;voice:string;meeting_url:string;status:string;cover_url?:string;announcement:string;host:Person;participants:{user_id:string;profile?:Person}[]};
// JSON is validated server-side. This boundary handles several response shapes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function api<T = any>(path:string,token?:string,body?:unknown){const r=await fetch(path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json() as T & {error?:string};if(!r.ok)throw new Error(data.error||'Something went wrong.');return data;}
export function dateLabel(v:string){return new Date(v).toLocaleString(undefined,{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});}

export function coverSource(m:Pick<Moment,'cover'|'cover_url'>){return m.cover_url||(['gaming','movies','art'].includes(m.cover)?'/covers/'+m.cover+'.webp':'/covers/art.webp');}
