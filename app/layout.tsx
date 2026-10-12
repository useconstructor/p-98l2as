import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
const inter=localFont({src:'../public/fonts/inter.ttf',variable:'--font-inter',display:'swap'});
const manrope=localFont({src:'../public/fonts/bodoni-moda.ttf',variable:'--font-display',display:'swap'});
export const metadata:Metadata={title:{default:'Arco Pilates | Encuentra tu equilibrio',template:'%s | Arco Pilates'},description:'Descubre Pilates suelo, Reformer y Movilidad. Consulta disponibilidad y confirma una reserva de prueba en este estudio de pilates de ejemplo.'};
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="es"><body className={`${inter.variable} ${manrope.variable} font-sans antialiased`}><a href="#contenido" className="skip-link">Ir al contenido</a>{children}</body></html>; }
