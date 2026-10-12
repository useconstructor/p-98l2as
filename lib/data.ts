import 'server-only';
import { getDb } from './db';
import { ClassType, Session, localDate } from './types';
let initialization: Promise<void> | undefined;
let initializedDay = '';
const schema = [
`CREATE TABLE IF NOT EXISTS class_types (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL, duration_minutes INTEGER NOT NULL CHECK(duration_minutes > 0))`,
`CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, class_type_id TEXT NOT NULL REFERENCES class_types(id), starts_at TEXT NOT NULL, ends_at TEXT NOT NULL CHECK(ends_at > starts_at), capacity INTEGER NOT NULL CHECK(capacity > 0), UNIQUE(class_type_id,starts_at))`,
`CREATE TABLE IF NOT EXISTS bookings (id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id), name TEXT NOT NULL, normalized_email TEXT NOT NULL, status TEXT NOT NULL CHECK(status = 'confirmed'), public_reference TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, UNIQUE(normalized_email,session_id))`,
`CREATE TABLE IF NOT EXISTS booking_requests (idempotency_key TEXT PRIMARY KEY, payload_hash TEXT NOT NULL, booking_id TEXT NOT NULL REFERENCES bookings(id))`,
`CREATE TABLE IF NOT EXISTS initialization (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
`CREATE INDEX IF NOT EXISTS sessions_date_type ON sessions(starts_at,class_type_id)`,
`CREATE INDEX IF NOT EXISTS bookings_session_email ON bookings(session_id,normalized_email)`,
`CREATE INDEX IF NOT EXISTS bookings_email ON bookings(normalized_email)`];
async function initialize() {
 await getDb().batch(schema, 'write');
 const tx = await getDb().transaction('write');
 try {
 const marker = await tx.execute("SELECT value FROM initialization WHERE key='horizon'");
 const today = localDate();
 if(marker.rows[0]?.value === today) { await tx.commit(); return; }
 const catalog = [ ['suelo','Pilates suelo','Respiración, control y fuerza sobre la colchoneta. Una forma de explorar el movimiento con el peso de tu cuerpo.',50], ['reformer','Reformer','Movimiento guiado por un equipo de muelles. Explora la resistencia y el control en cada ejercicio.',50], ['movilidad','Movilidad','Movimientos suaves para explorar el rango de tus articulaciones y dedicar un momento a la flexibilidad.',40] ];
 for(const c of catalog) await tx.execute({sql:'INSERT OR IGNORE INTO class_types VALUES (?,?,?,?)', args:c});
 // Store UTC instants. Fixed UTC example starts are always rendered in Europe/Madrid,
 // including daylight saving transitions. No fictitious operating hours are claimed.
 for(let day=0;day<14;day++) {
 const date=new Date(); date.setUTCDate(date.getUTCDate()+day); date.setUTCHours(0,0,0,0);
 for(const [i,c] of catalog.entries()) for(const hour of [8+i,16+i]) {
 const start=new Date(date); start.setUTCHours(hour);
 const end=new Date(start.getTime()+Number(c[3])*60000);
 await tx.execute({sql:'INSERT OR IGNORE INTO sessions VALUES (?,?,?,?,?)',args:[`${c[0]}-${start.toISOString()}`,c[0],start.toISOString(),end.toISOString(),i===1?6:10]});
 }
 }
 await tx.execute({sql:"INSERT INTO initialization VALUES ('horizon',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",args:[today]});
 await tx.commit();
 } catch(e) { await tx.rollback(); throw e; } finally { tx.close(); }
}
export async function ensureData() {
 const day=localDate();
 if(initializedDay!==day) { if(!initialization) initialization=initialize().then(()=>{initializedDay=day;}).finally(()=>{initialization=undefined;}); await initialization; }
}
export async function getClasses(): Promise<ClassType[]> { await ensureData(); const r=await getDb().execute('SELECT * FROM class_types ORDER BY CASE id WHEN \'suelo\' THEN 0 WHEN \'reformer\' THEN 1 ELSE 2 END');return r.rows.map(row=>({...row})) as unknown as ClassType[]; }
export async function getSessions(modality?:string,date?:string):Promise<Session[]> {
 await ensureData();
 const r=await getDb().execute({sql:`SELECT s.*, c.name,c.description,c.duration_minutes, s.capacity - COUNT(b.id) AS remaining FROM sessions s JOIN class_types c ON c.id=s.class_type_id LEFT JOIN bookings b ON b.session_id=s.id AND b.status='confirmed' WHERE s.starts_at > ? ${modality?'AND s.class_type_id=?':''} GROUP BY s.id ORDER BY s.starts_at`,args:[new Date().toISOString(),...(modality?[modality]:[])]});
 const sessions=r.rows.map(row=>({...row})) as unknown as Session[];
 if(sessions.some(s=>s.remaining<0)) throw new Error('Invalid availability');
 return date?sessions.filter(s=>localDate(new Date(s.starts_at))===date):sessions;
}
