import { cookies } from 'next/headers';
import { COOKIE_NAME,readReceipt } from '@/lib/receipt';
export const dynamic='force-dynamic';
export async function GET() { return Response.json({confirmation:await readReceipt((await cookies()).get(COOKIE_NAME)?.value)},{headers:{'Cache-Control':'no-store'}}); }
