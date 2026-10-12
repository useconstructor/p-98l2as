/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS export required by the independent QA runner. */
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const appRequire=require('node:module').createRequire('/tmp/app/package.json');
exports.verify=async function verify({browser,baseUrl,evidenceDir}) {
 if(!process.env.TURSO_DATABASE_URL||!process.env.TURSO_AUTH_TOKEN)process.loadEnvFile('/tmp/app/.env.local');
 assert(process.env.TURSO_DATABASE_URL?.startsWith('libsql://')&&process.env.TURSO_AUTH_TOKEN,'Provided Turso credentials are required for scoped cleanup');
 await fs.mkdir(evidenceDir,{recursive:true});const checks=[],images=[],resolutions=[];
 const {createClient}=appRequire('@libsql/client');const baselineDb=createClient({url:process.env.TURSO_DATABASE_URL,authToken:process.env.TURSO_AUTH_TOKEN});
 const baseline=(await baselineDb.execute('SELECT id,session_id,name,normalized_email,status,public_reference,created_at FROM bookings ORDER BY id')).rows;baselineDb.close();
 const pass=name=>{checks.push({name,passed:true});console.log(name)};
 for(const [device,width,height] of [['desktop',1440,900],['tablet',768,1024],['mobile',390,844]]) {
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:2});const page=await context.newPage();
  await page.goto(baseUrl);await page.evaluate(async()=>{await document.fonts.ready;for(const i of document.images)i.loading="eager";await Promise.all([...document.images].map(i=>i.decode()))});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  const hero=page.locator('img[src*="pilates-hero-reformer"]');assert.equal(await hero.count(),1);
  const measured=await hero.evaluate(i=>{const r=i.getBoundingClientRect();return {currentSrc:i.currentSrc,sizes:i.sizes,renderedWidth:r.width,renderedHeight:r.height,objectPosition:getComputedStyle(i).objectPosition,dpr:devicePixelRatio}});
  const response=await context.request.get(measured.currentSrc);assert(response.ok());const bytes=await response.body();const sharp=appRequire('sharp');const metadata=await sharp(bytes).metadata();
  const effectiveScale=Math.min(metadata.width/measured.renderedWidth,metadata.height/measured.renderedHeight);assert(effectiveScale>=2,`${device} needs enough actual pixels for DPR2: ${effectiveScale}`);
  if(device==='tablet')assert.equal(measured.renderedHeight,360);
  resolutions.push({device,...measured,servedWidth:metadata.width,servedHeight:metadata.height,effectiveScale,bytes:bytes.length});
  await fs.writeFile(path.join(evidenceDir,`${device}-served-hero.${metadata.format}`),bytes);
  const file=path.join(evidenceDir,`${device}-dpr2.png`);await page.screenshot({path:file,fullPage:true});images.push({name:device+' DPR2',file});
  pass(`${device}: decoded sharp hero at >=2x rendered crop; no overflow${device==='tablet'?'; 360px frame':''}`);
  if(device==='mobile') {await page.getByRole('button',{name:'Abrir menú'}).click();await page.getByRole('navigation',{name:'Navegación móvil'}).getByRole('link',{name:'Clases'}).waitFor();assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Clases');await page.keyboard.press('Escape');assert.equal(await page.getByRole('button',{name:'Abrir menú'}).getAttribute('aria-expanded'),'false');assert.equal(await page.locator('#menu-movil').evaluate(e=>e.inert),true);assert.equal(await page.getByRole('button',{name:'Abrir menú'}).evaluate(e=>e===document.activeElement),true);
   await page.getByRole('button',{name:'Abrir menú'}).focus();await page.keyboard.press('Enter');await page.getByRole('link',{name:'Cómo reservar',exact:true}).filter({visible:true}).focus();await page.keyboard.press('Tab');await page.keyboard.press('Tab');assert.equal(await page.getByRole('button',{name:'Cerrar menú'}).evaluate(e=>e===document.activeElement),true);await page.keyboard.press('Enter');
   pass('Mobile menu opens via pointer and keyboard, closes with Escape and Enter, closed panel is inert and focus returns');}
  await page.getByRole('link',{name:'Reservar cupo',exact:true}).filter({visible:true}).click();await page.waitForURL('**/reservar**');await page.getByRole('button',{name:/Seleccionar próximo cupo disponible/}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:path.join(evidenceDir,`journey-${device}-destination.png`),fullPage:true});
  pass(`${device}: homepage CTA reaches live booking availability`);
  const filtered=page.waitForResponse(r=>r.url().includes('/api/sessions?')&&r.url().includes('modalidad=reformer'));
  await page.locator('#modality').selectOption('reformer');assert.equal((await filtered).status(),200);assert.equal(await page.locator('#modality').inputValue(),'reformer');
  await page.getByRole('button',{name:/Seleccionar próximo cupo disponible: Reformer/}).focus();await page.keyboard.press('Enter');
  await page.getByRole('heading',{name:'Completa tu reserva'}).waitFor();assert.equal(await page.getByRole('heading',{name:'Completa tu reserva'}).evaluate(e=>e===document.activeElement),true);
  await page.getByRole('button',{name:'Volver a horarios'}).click();await page.getByRole('heading',{name:'Completa tu reserva'}).waitFor({state:'detached'});
  await page.getByRole('button',{name:/Seleccionar próximo cupo disponible: Reformer/}).click();pass(device+': keyboard selection opens focused form; back closes form and restores schedules');
  await page.getByRole('button',{name:'Confirmar reserva de prueba'}).click();await page.locator('#name-error').waitFor();assert.equal(await page.locator('#name').getAttribute('aria-invalid'),'true');assert.equal(await page.evaluate(()=>document.activeElement.id),'name');
  await page.locator('#name').fill('Verificación de prueba');await page.locator('#email').fill('invalid');await page.getByRole('button',{name:'Confirmar reserva de prueba'}).click();await page.locator('#email-error').waitFor();assert.equal(await page.evaluate(()=>document.activeElement.id),'email');pass(`${device}: required name and invalid email rejected with focused field`);
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),true);assert(parseFloat(await page.locator('.feedback-entry').evaluate(e=>getComputedStyle(e).animationDuration))<=0.00001);pass(`${device}: reduced motion respected`);
  const email=`qa-hero-${device}-${require('node:crypto').randomUUID()}@example.invalid`;await page.locator('#email').fill(email);
  await page.route('**/api/bookings',route=>route.abort('failed'));
  await page.getByRole('button',{name:'Confirmar reserva de prueba'}).click();await page.getByRole('alert').filter({hasText:'No pudimos conectar'}).waitFor();assert.equal(await page.locator('#email').inputValue(),email);assert.equal(await page.locator('#name').inputValue(),'Verificación de prueba');
  await page.unroute('**/api/bookings');pass(device+': interrupted submission preserves fictitious fields and permits retry');
  const requestPromise=page.waitForRequest(r=>r.url().endsWith('/api/bookings')&&r.method()==='POST');const responsePromise=page.waitForResponse(r=>r.url().endsWith('/api/bookings')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Confirmar reserva de prueba'}).click();const request=await requestPromise,responseBooking=await responsePromise;assert.equal(responseBooking.status(),201);const confirmation=(await responseBooking.json()).confirmation;assert(confirmation.public_reference);
  await page.getByRole('heading',{name:'Reserva de prueba confirmada'}).waitFor();await page.screenshot({path:path.join(evidenceDir,`journey-${device}-success.png`),fullPage:true});
  const cookie=(await context.cookies()).find(c=>c.name==='pilates_receipt');assert(cookie?.httpOnly);assert.equal(cookie.sameSite,'Lax');assert.equal(cookie.secure,false);assert.equal(await page.evaluate(()=>document.cookie.includes('pilates_receipt')),false);
  await page.reload();await page.getByRole('heading',{name:'Reserva de prueba confirmada'}).waitFor();assert(await page.getByText(confirmation.public_reference,{exact:true}).isVisible());pass(`${device}: Turso booking confirmed, HttpOnly local receipt and same reference restored on reload`);
  const payload=request.postDataJSON();const headers={'Origin':new URL(baseUrl).origin,'Content-Type':'application/json','Idempotency-Key':request.headers()['idempotency-key']};
  const replay=await context.request.post(baseUrl+'/api/bookings',{headers,data:payload});assert.equal(replay.status(),201);assert.equal((await replay.json()).confirmation.public_reference,confirmation.public_reference);
  const duplicate=await context.request.post(baseUrl+'/api/bookings',{headers:{...headers,'Idempotency-Key':require('node:crypto').randomUUID()},data:payload});assert.equal(duplicate.status(),409);assert.equal((await duplicate.json()).code,'DUPLICATE');
  const bad=await context.request.post(baseUrl+'/api/bookings',{headers:{...headers,'Idempotency-Key':require('node:crypto').randomUUID()},data:{...payload,email:'invalid'}});assert.equal(bad.status(),422);
  const foreign=await context.request.post(baseUrl+'/api/bookings',{headers:{...headers,Origin:'https://untrusted.invalid'},data:payload});assert.equal(foreign.status(),403);
  pass(`${device}: server idempotency, duplicate protection, field validation and origin enforcement`);
  await page.getByRole('button',{name:'Volver a horarios'}).click();await page.getByRole('heading',{name:'Próximas sesiones'}).waitFor();
  await page.route('**/api/sessions?**',route=>route.abort('failed'));await page.getByRole('button',{name:'Actualizar disponibilidad'}).click();await page.getByRole('button',{name:'Volver a intentar'}).waitFor();await page.unroute('**/api/sessions?**');await page.getByRole('button',{name:'Volver a intentar'}).click();await page.getByRole('button',{name:/Seleccionar próximo cupo disponible/}).waitFor();pass(device+': availability network error and retry recover live sessions');
  await page.locator('#date').fill('2099-01-01');await page.getByRole('heading',{name:'No hay clases disponibles para esta fecha'}).waitFor();await page.getByRole('button',{name:'Ver todos los horarios'}).click();await page.getByRole('button',{name:/Seleccionar próximo cupo disponible/}).waitFor();pass(`${device}: empty date state and recovery work`);
  // Remove only the test booking created by this verifier, leaving business and earlier QA records intact.
  const {createClient}=appRequire('@libsql/client');const db=createClient({url:process.env.TURSO_DATABASE_URL,authToken:process.env.TURSO_AUTH_TOKEN});
  const own=await db.execute({sql:'SELECT id FROM bookings WHERE normalized_email=? AND public_reference=?',args:[email,confirmation.public_reference]});assert.equal(own.rows.length,1);
  await db.batch([{sql:'DELETE FROM booking_requests WHERE booking_id=?',args:[own.rows[0].id]},{sql:'DELETE FROM bookings WHERE id=? AND normalized_email=?',args:[own.rows[0].id,email]}],'write');db.close();pass(`${device}: test booking cleanup scoped to unique QA email and confirmed reference`);
  await context.close();
 }
 const preservationDb=createClient({url:process.env.TURSO_DATABASE_URL,authToken:process.env.TURSO_AUTH_TOKEN});
 const finalRows=(await preservationDb.execute('SELECT id,session_id,name,normalized_email,status,public_reference,created_at FROM bookings ORDER BY id')).rows;preservationDb.close();
 const finalMap=new Map(finalRows.map(row=>[row.id,row]));for(const row of baseline)assert.deepEqual(finalMap.get(row.id),row,'Existing booking changed');pass('All pre-existing booking records retain every field after verification');
 await fs.writeFile(path.join(evidenceDir,'served-image-resolution.json'),JSON.stringify(resolutions,null,2));
 const result={verified:true,checks,pending:[{name:'Production HTTPS direct and actual Constructor iframe submit/reload',reason:'Host publishes after independent acceptance; HTTPS and iframe are unavailable locally. Verify Secure, HttpOnly, SameSite=None and Partitioned receipt cookie in that environment.'}]};
 await fs.writeFile(path.join(evidenceDir,'interaction-evidence.json'),JSON.stringify(result,null,2));return result;
};
if(require.main===module){if(require('node:fs').existsSync('.env.local'))process.loadEnvFile('.env.local');(async()=>{const {chromium}=require('/tmp/constructor-quality-tools/node_modules/playwright');const browser=await chromium.launch({args:['--no-sandbox']});try{const r=await exports.verify({browser,baseUrl:'http://127.0.0.1:3100',evidenceDir:path.dirname(__filename)});await fs.writeFile(path.join(path.dirname(__filename),'interaction-evidence.json'),JSON.stringify(r,null,2));console.log(JSON.stringify(r.checks,null,2));}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});}
