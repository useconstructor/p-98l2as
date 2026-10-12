import { getClasses } from '@/lib/data';
export const dynamic='force-dynamic';
export async function GET() { try{return Response.json(await getClasses(),{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({code:'UNAVAILABLE',message:'No pudimos cargar las modalidades. Inténtalo de nuevo.'},{status:503});} }
