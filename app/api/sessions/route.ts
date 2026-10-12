import { getClasses,getSessions } from '@/lib/data';
export const dynamic='force-dynamic';
export async function GET(request:Request) {
 const p=new URL(request.url).searchParams, modality=p.get('modalidad')||undefined,date=p.get('fecha')||undefined;
 if(date&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date))return Response.json({code:'INVALID_DATE',message:'Elige una fecha válida.'},{status:422});
 try {if(modality&&!(await getClasses()).some(c=>c.id===modality))return Response.json({code:'INVALID_MODALITY',message:'Esta modalidad no existe. Elige una de las opciones disponibles.'},{status:422});return Response.json(await getSessions(modality,date),{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({code:'UNAVAILABLE',message:'No pudimos consultar los horarios. Inténtalo de nuevo.'},{status:503});}
}
