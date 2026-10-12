import { createHash,randomUUID,randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { ensureData } from '@/lib/data';
import { allowedOrigin,confirmationById,createReceipt,COOKIE_NAME,receiptCookieOptions } from '@/lib/receipt';
export const dynamic='force-dynamic';
function error(status:number,code:string,message:string,fields?:Record<string,string>) { return NextResponse.json({code,message,fields},{status}); }
export async function POST(request:Request) {
 if(!allowedOrigin(request))return error(403,'ORIGIN_NOT_ALLOWED','El origen de esta solicitud no está permitido.');
 let body;try{body=await request.json();}catch{return error(422,'INVALID_FIELDS','Revisa los datos del formulario.');}
 if(!body||typeof body!=='object')return error(422,'INVALID_FIELDS','Revisa los datos del formulario.');
 const name=typeof body.name==='string'?body.name.trim():'',email=typeof body.email==='string'?body.email.trim().toLowerCase():'',sessionId=typeof body.session_id==='string'?body.session_id:'',key=request.headers.get('Idempotency-Key')??'';
 const fields:Record<string,string>={};
 if(name.length<2||name.length>100)fields.name='Escribe un nombre de entre 2 y 100 caracteres.';
 if(email.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fields.email='Escribe un correo válido.';
 if(!sessionId||sessionId.length>150)fields.session='Selecciona una clase.';
 if(!/^[a-zA-Z0-9-]{16,100}$/.test(key))fields.request='La solicitud no es válida. Vuelve a seleccionar la clase.';
 if(Object.keys(fields).length)return error(422,'INVALID_FIELDS','Revisa los campos indicados.',fields);
 const hash=createHash('sha256').update(JSON.stringify({name,email,sessionId})).digest('hex');
 try {
 // Check signing configuration before persisting a booking.
 createReceipt('configuration-check');
 await ensureData(); const tx=await getDb().transaction('write');let bookingId='';
 try {
 const previous=await tx.execute({sql:'SELECT * FROM booking_requests WHERE idempotency_key=?',args:[key]});
 if(previous.rows[0]) {if(previous.rows[0].payload_hash!==hash){await tx.rollback();return error(409,'IDEMPOTENCY_CONFLICT','Este intento ya se utilizó con otros datos. Vuelve a seleccionar la clase.');}bookingId=String(previous.rows[0].booking_id);}
 else {
 const r=await tx.execute({sql:'SELECT * FROM sessions WHERE id=?',args:[sessionId]});const s=r.rows[0];
 if(!s){await tx.rollback();return error(404,'SESSION_NOT_FOUND','Esta sesión ya no está disponible. Elige otra clase.');}
 if(String(s.starts_at)<=new Date().toISOString()){await tx.rollback();return error(409,'SESSION_PAST','La clase ya ha comenzado. Elige un nuevo horario.');}
 const duplicate=await tx.execute({sql:"SELECT id FROM bookings WHERE normalized_email=? AND session_id=? AND status='confirmed'",args:[email,sessionId]});
 if(duplicate.rows.length){await tx.rollback();return error(409,'DUPLICATE','Ya tienes una reserva de prueba para esta clase con ese correo.');}
 const overlap=await tx.execute({sql:"SELECT b.id FROM bookings b JOIN sessions s ON s.id=b.session_id WHERE b.normalized_email=? AND b.status='confirmed' AND s.starts_at < ? AND s.ends_at > ?",args:[email,s.ends_at,s.starts_at]});
 if(overlap.rows.length){await tx.rollback();return error(409,'OVERLAP','Esta clase coincide con otra que ya reservaste. Elige un horario diferente.');}
 const count=await tx.execute({sql:"SELECT COUNT(*) AS n FROM bookings WHERE session_id=? AND status='confirmed'",args:[sessionId]});
 if(Number(count.rows[0].n)>=Number(s.capacity)){await tx.rollback();return error(409,'NO_CAPACITY','Se ha reservado el último cupo. Elige otra clase.');}
 bookingId=randomUUID();
 await tx.execute({sql:"INSERT INTO bookings VALUES (?,?,?,?,'confirmed',?,?)",args:[bookingId,sessionId,name,email,randomBytes(6).toString('hex').toUpperCase(),new Date().toISOString()]});
 await tx.execute({sql:'INSERT INTO booking_requests VALUES (?,?,?)',args:[key,hash,bookingId]});
 }
 await tx.commit();
 }catch(e){await tx.rollback();throw e;}finally{tx.close();}
 const response=NextResponse.json({confirmation:await confirmationById(bookingId)},{status:201,headers:{'Cache-Control':'no-store'}});
 response.cookies.set(COOKIE_NAME,createReceipt(bookingId),receiptCookieOptions(request));return response;
 }catch(e){console.error('Booking failed',e instanceof Error?e.message:'Database error');return error(503,'UNAVAILABLE','No pudimos confirmar la reserva. Tus datos se conservan; vuelve a intentarlo.');}
}
