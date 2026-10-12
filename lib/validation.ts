import { z } from 'zod';
export const categories = ['Gaming','Movies','Music','Art','Study','Discussion','Books','Hangout'] as const;
export const momentSchema = z.object({
 title:z.string().trim().min(3).max(100),description:z.string().trim().min(10).max(3000),category:z.enum(categories),
 start_at:z.string().datetime(),duration_minutes:z.number().int().min(15).max(720),capacity:z.number().int().min(2).max(100),
 language:z.string().trim().min(2).max(40),visibility:z.enum(['public','private']),approval_required:z.boolean(),voice:z.enum(['optional','required','text']),
 meeting_url:z.string().url().max(500).refine(v=>v.startsWith('https://'),'Use an HTTPS link').or(z.literal('')),tags:z.array(z.string().trim().min(1).max(24)).max(5),cover:z.union([z.enum(['gaming','movies','art']),z.string().regex(/^[a-f0-9-]{36}\/[a-f0-9-]{36}\.(png|jpg|webp)$/)]),
 occurrences:z.number().int().min(1).max(6).default(1),status:z.enum(['draft','scheduled','live'])
});
export const profileSchema = z.object({username:z.string().trim().regex(/^[a-z0-9_]{3,24}$/),display_name:z.string().trim().min(2).max(50),bio:z.string().trim().max(500),interests:z.array(z.enum(categories)).max(8),language:z.string().min(2).max(40),group_size:z.enum(['small','medium','any']),onboarded:z.boolean()});
export const signupSchema=z.object({email:z.string().email(),password:z.string().min(10).max(128),birthdate:z.string({required_error:'Enter your date of birth.',invalid_type_error:'Enter your date of birth.'}).regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date of birth.')});
export function isAdult(date:string,now=new Date()){const d=new Date(date+'T00:00:00Z');if(!Number.isFinite(d.getTime())||d>now)return false;const cutoff=new Date(now);cutoff.setUTCFullYear(now.getUTCFullYear()-18);return d<=cutoff;}

export const authRequestSchema=z.discriminatedUnion('action',[
 signupSchema.extend({action:z.literal('signup')}),
 z.object({action:z.literal('login'),email:z.string().email('Enter a valid email address.'),password:z.string().min(1,'Enter your password.').max(128)}),
 z.object({action:z.literal('refresh'),refresh_token:z.string().min(1).max(3000)}),
 z.object({action:z.literal('logout')})
]);
