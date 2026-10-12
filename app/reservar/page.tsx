import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { BookingFlow } from '@/components/booking-flow';
import { getClasses, getSessions } from '@/lib/data';
import { localDate } from '@/lib/types';
import { COOKIE_NAME,readReceipt } from '@/lib/receipt';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Reserva tu clase de prueba',description:'Consulta clases de ejemplo y cupos disponibles. Reserva Pilates suelo, Reformer o Movilidad y conserva tu confirmación de prueba.'};
export default async function BookingPage({searchParams}:{searchParams:Promise<{modalidad?:string;fecha?:string;vista?:string}>}) {
 const params=await searchParams;let classes: import('@/lib/types').ClassType[];let initialError='';try{classes=await getClasses();}catch{classes=[];initialError='No pudimos conectar con los horarios. Vuelve a intentarlo.';}
 let initialDate=params.fecha??'';
 if(!initialDate&&!initialError){try{const sessions=await getSessions(classes.some(c=>c.id===params.modalidad)?params.modalidad:undefined);const next=sessions.find(s=>s.remaining>0);initialDate=next?localDate(new Date(next.starts_at)):localDate();}catch{initialError='No pudimos consultar la disponibilidad. Vuelve a intentarlo.';}}
 const confirmation=params.vista==='horarios'||(params.modalidad&&params.vista!=='confirmacion')?null:await readReceipt((await cookies()).get(COOKIE_NAME)?.value);
 return <><Header/><main id="contenido" className="page-width py-4 sm:py-8 md:py-10"><BookingFlow classes={classes} initialModality={params.modalidad??''} initialDate={initialDate} initialConfirmation={confirmation} initialError={initialError}/></main><Footer/></>;
}
