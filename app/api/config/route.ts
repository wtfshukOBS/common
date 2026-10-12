import {config} from '@/lib/backend';
export async function GET(){const {url,key}=config();return Response.json({configured:!!(url&&key),url:url||null,key:key||null},{headers:{'Cache-Control':'no-store'}});}
