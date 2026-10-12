export function PhotoCredit({kind}:{kind:'reformer'|'floor'|'practice'|'mobility'}) {
 const reformer=kind==='reformer';
 const author=reformer?'Payam.nazeri96':'Cristian.mirandapezo';
 const file=reformer?'Pilates reformer pic.jpg':kind==='floor'?'Instructora Pilates.jpg':kind==='practice'?'Ejercicio con Flex-band en Pilates.jpg':'Instructora de Pilates.jpg';
 return <figcaption className="photo-credit">Imagen ilustrativa · <a href={`https://commons.wikimedia.org/wiki/User:${author}`} target="_blank" rel="noreferrer">{author}</a> · <a href={`https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file.replaceAll(' ','_'))}`} target="_blank" rel="noreferrer">Wikimedia Commons</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a> · Recorte</figcaption>;
}
