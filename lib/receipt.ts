import 'server-only';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { getDb } from './db';
import { ensureData } from './data';
import type { Confirmation } from './types';
export const COOKIE_NAME='pilates_receipt';
function secret() { const s=process.env.JWT_SECRET; if(!s) throw new Error('Receipt signing secret is missing'); return s; }
export function createReceipt(id:string) { const payload=Buffer.from(JSON.stringify({id,nonce:randomBytes(16).toString('hex'),exp:Date.now()+30*86400000})).toString('base64url');return payload+'.'+createHmac('sha256',secret()).update(payload).digest('base64url'); }
export async function readReceipt(token?:string):Promise<Confirmation|null> {
 if(!token) return null;
 try { const [payload,signature]=token.split('.');const expected=createHmac('sha256',secret()).update(payload).digest();const actual=Buffer.from(signature,'base64url');if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return null;
 const data=JSON.parse(Buffer.from(payload,'base64url').toString());if(data.exp<Date.now()||typeof data.id!=='string')return null;
 await ensureData();return await confirmationById(data.id);
 }catch {return null;}
}
export async function confirmationById(id:string):Promise<Confirmation|null> { const r=await getDb().execute({sql:`SELECT b.public_reference,b.name,c.name AS class_name,s.starts_at,s.ends_at,c.duration_minutes FROM bookings b JOIN sessions s ON s.id=b.session_id JOIN class_types c ON c.id=s.class_type_id WHERE b.id=?`,args:[id]}); return r.rows[0] ? {...r.rows[0]} as unknown as Confirmation : null; }
export function allowedOrigin(request:Request) {
 const allowed=(process.env.APP_ALLOWED_ORIGINS??'').split(',').map(s=>s.trim()).filter(Boolean);
 for(const url of [process.env.APP_URL,process.env.NEXT_PUBLIC_APP_URL,process.env.VERCEL_URL?`https://${process.env.VERCEL_URL}`:undefined,process.env.VERCEL_PROJECT_PRODUCTION_URL?`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`:undefined])if(url)allowed.push(url.replace(/\/$/,''));
 // Fixed loopback origins support local production QA without trusting Host.
 allowed.push('http://localhost:3000','http://127.0.0.1:3000','http://localhost:3100','http://127.0.0.1:3100');
 return !!request.headers.get('origin') && allowed.includes(request.headers.get('origin')!);
}

// HTTP loopback QA uses a host-only Lax cookie; deployed HTTPS stays partitioned.
export function receiptCookieOptions(request: Request) {
 const url = new URL(request.url);
 // Next may use its bind address internally; use the already validated browser Origin.
 const origin = request.headers.get('origin');
 const browserUrl = origin && allowedOrigin(request) ? new URL(origin) : url;
 const localHttp = browserUrl.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(browserUrl.hostname);
 const secure = process.env.NODE_ENV === 'production' && !localHttp;
 return { httpOnly: true, secure, sameSite: secure ? 'none' as const : 'lax' as const, partitioned: secure, path: '/', maxAge: 30 * 86400 };
}
