import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
const inter=localFont({src:'../public/fonts/inter.ttf',variable:'--font-inter',display:'swap'});
const manrope=localFont({src:'../public/fonts/manrope.ttf',variable:'--font-manrope',display:'swap'});
export const metadata:Metadata={title:{default:'Estudio de pilates | Reservas Pilates',template:'%s | Reservas Pilates'},description:'Descubre Pilates suelo, Reformer y Movilidad. Consulta disponibilidad y confirma una reserva de prueba en este estudio de pilates de ejemplo.'};
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="es"><body className={`${inter.variable} ${manrope.variable} font-sans antialiased`}><a href="#contenido" className="fixed left-4 top-4 z-[100] -translate-y-[150%] rounded-lg bg-accent p-4 font-medium focus:translate-y-0 focus:outline-2 focus:outline-offset-4 focus:outline-primary">Ir al contenido</a>{children}</body></html>; }
