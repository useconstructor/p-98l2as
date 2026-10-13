import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
const wordmark=localFont({src:'../public/fonts/arco-display.ttf',variable:'--font-wordmark',weight:'300',display:'swap'});
const inter=localFont({src:'../public/fonts/inter.ttf',variable:'--font-inter',display:'swap'});
const display=localFont({src:[{path:'../public/fonts/cormorant-light.ttf',weight:'300',style:'normal'},{path:'../public/fonts/cormorant-light-italic.ttf',weight:'300',style:'italic'}],variable:'--font-display',display:'swap'});
export const metadata:Metadata={title:{default:'Arco Pilates | Encuentra tu equilibrio',template:'%s | Arco Pilates'},description:'Descubre Pilates suelo, Reformer y Movilidad. Consulta disponibilidad y confirma una reserva de prueba en este estudio de pilates de ejemplo.'};
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="es"><body className={`${inter.variable} ${display.variable} ${wordmark.variable} font-sans antialiased`}><a href="#contenido" className="skip-link">Ir al contenido</a>{children}</body></html>; }
