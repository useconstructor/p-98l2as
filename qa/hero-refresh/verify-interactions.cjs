/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS export required by the independent QA runner. */
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
exports.verify=async function({browser,baseUrl,evidenceDir}) {
 await fs.mkdir(evidenceDir,{recursive:true});const checks=[],images=[],resolutions=[];
 const pass=name=>{checks.push({name,passed:true});console.log(name)};
 for(const [device,width,height] of [['desktop',1440,900],['tablet',768,1024],['mobile',390,844]]) {
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:2});const page=await context.newPage();
  await page.goto(baseUrl);await page.evaluate(async()=>{await document.fonts.ready;for(const i of document.images)i.loading="eager";await Promise.all([...document.images].map(i=>i.decode()))});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  const hero=page.locator('img[src*="pilates-hero-reformer"]');assert.equal(await hero.count(),1);
  const measured=await hero.evaluate(i=>{const r=i.getBoundingClientRect();return {currentSrc:i.currentSrc,sizes:i.sizes,renderedWidth:r.width,renderedHeight:r.height,objectPosition:getComputedStyle(i).objectPosition,dpr:devicePixelRatio}});
  const response=await context.request.get(measured.currentSrc);assert(response.ok());const bytes=await response.body();const sharp=require('sharp');const metadata=await sharp(bytes).metadata();
  const effectiveScale=Math.min(metadata.width/measured.renderedWidth,metadata.height/measured.renderedHeight);assert(effectiveScale>=2,`${device} needs enough actual pixels for DPR2: ${effectiveScale}`);
  if(device==='tablet')assert.equal(measured.renderedHeight,360);
  resolutions.push({device,...measured,servedWidth:metadata.width,servedHeight:metadata.height,effectiveScale,bytes:bytes.length});
  await fs.writeFile(path.join(evidenceDir,`${device}-served-hero.${metadata.format}`),bytes);
  const file=path.join(evidenceDir,`${device}-dpr2.png`);await page.screenshot({path:file,fullPage:true});images.push({name:device+' DPR2',file});
  pass(`${device}: decoded sharp hero at >=2x rendered crop; no overflow${device==='tablet'?'; 360px frame':''}`);
  if(device==='mobile') {await page.getByRole('button',{name:'Abrir menú'}).click();await page.getByRole('navigation',{name:'Navegación móvil'}).getByRole('link',{name:'Clases'}).waitFor();assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Clases');await page.keyboard.press('Escape');assert.equal(await page.getByRole('button',{name:'Abrir menú'}).getAttribute('aria-expanded'),'false');pass('Mobile menu opens, focuses first link and Escape restores toggle');}
  await page.getByRole('link',{name:'Reservar cupo',exact:true}).filter({visible:true}).click();await page.waitForURL('**/reservar**');await page.getByRole('button',{name:/Seleccionar próximo cupo disponible/}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:path.join(evidenceDir,`journey-${device}-destination.png`),fullPage:true});
  pass(`${device}: homepage CTA reaches live booking availability`);
  await page.locator('#modality').selectOption('reformer');await page.waitForResponse(r=>r.url().includes('/api/sessions?')&&r.url().includes('modalidad=reformer'));
  await page.getByRole('button',{name:/Seleccionar próximo cupo disponible: Reformer/}).click();
  await page.getByRole('button',{name:'Confirmar reserva de prueba'}).click();await page.locator('#name-error').waitFor();assert.equal(await page.locator('#name').getAttribute('aria-invalid'),'true');assert.equal(await page.evaluate(()=>document.activeElement.id),'name');
  await page.locator('#name').fill('Verificación de prueba');await page.locator('#email').fill('invalid');await page.getByRole('button',{name:'Confirmar reserva de prueba'}).click();await page.locator('#email-error').waitFor();pass(`${device}: required name and invalid email rejected with focused field`);
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),true);assert(parseFloat(await page.locator('.feedback-entry').evaluate(e=>getComputedStyle(e).animationDuration))<=0.00001);pass(`${device}: reduced motion respected`);
  const email=`qa-hero-${device}-${Date.now()}@example.invalid`;await page.locator('#email').fill(email);
  const requestPromise=page.waitForRequest(r=>r.url().endsWith('/api/bookings')&&r.method()==='POST');const responsePromise=page.waitForResponse(r=>r.url().endsWith('/api/bookings')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Confirmar reserva de prueba'}).click();const request=await requestPromise,responseBooking=await responsePromise;assert.equal(responseBooking.status(),201);const confirmation=(await responseBooking.json()).confirmation;assert(confirmation.public_reference);
  await page.getByRole('heading',{name:'Reserva de prueba confirmada'}).waitFor();await page.screenshot({path:path.join(evidenceDir,`journey-${device}-success.png`),fullPage:true});
  const cookie=(await context.cookies()).find(c=>c.name==='pilates_receipt');assert(cookie?.httpOnly);assert.equal(cookie.sameSite,'Lax');
  await page.reload();await page.getByRole('heading',{name:'Reserva de prueba confirmada'}).waitFor();assert(await page.getByText(confirmation.public_reference,{exact:true}).isVisible());pass(`${device}: Turso booking confirmed, HttpOnly local receipt and same reference restored on reload`);
  const payload=request.postDataJSON();const headers={'Origin':new URL(baseUrl).origin,'Content-Type':'application/json','Idempotency-Key':request.headers()['idempotency-key']};
  const replay=await context.request.post(baseUrl+'/api/bookings',{headers,data:payload});assert.equal(replay.status(),201);assert.equal((await replay.json()).confirmation.public_reference,confirmation.public_reference);
  const duplicate=await context.request.post(baseUrl+'/api/bookings',{headers:{...headers,'Idempotency-Key':require('node:crypto').randomUUID()},data:payload});assert.equal(duplicate.status(),409);assert.equal((await duplicate.json()).code,'DUPLICATE');
  const bad=await context.request.post(baseUrl+'/api/bookings',{headers:{...headers,'Idempotency-Key':require('node:crypto').randomUUID()},data:{...payload,email:'invalid'}});assert.equal(bad.status(),422);
  const foreign=await context.request.post(baseUrl+'/api/bookings',{headers:{...headers,Origin:'https://untrusted.invalid'},data:payload});assert.equal(foreign.status(),403);
  pass(`${device}: server idempotency, duplicate protection, field validation and origin enforcement`);
  await page.getByRole('button',{name:'Volver a horarios'}).click();await page.getByRole('heading',{name:'Próximas sesiones'}).waitFor();
  await page.locator('#date').fill('2099-01-01');await page.getByRole('heading',{name:'No hay clases disponibles para esta fecha'}).waitFor();await page.getByRole('button',{name:'Ver todos los horarios'}).click();await page.getByRole('button',{name:/Seleccionar próximo cupo disponible/}).waitFor();pass(`${device}: empty date state and recovery work`);
  // Remove only the test booking created by this verifier, leaving business and earlier QA records intact.
  const {createClient}=require('@libsql/client');const db=createClient({url:process.env.TURSO_DATABASE_URL,authToken:process.env.TURSO_AUTH_TOKEN});
  const own=await db.execute({sql:'SELECT id FROM bookings WHERE normalized_email=? AND public_reference=?',args:[email,confirmation.public_reference]});assert.equal(own.rows.length,1);
  await db.batch([{sql:'DELETE FROM booking_requests WHERE booking_id=?',args:[own.rows[0].id]},{sql:'DELETE FROM bookings WHERE id=? AND normalized_email=?',args:[own.rows[0].id,email]}],'write');db.close();pass(`${device}: test booking cleanup scoped to unique QA email and confirmed reference`);
  await context.close();
 }
 await fs.writeFile(path.join(evidenceDir,'served-image-resolution.json'),JSON.stringify(resolutions,null,2));
 return {verified:true,checks,images,pending:[{name:'Production HTTPS direct and actual Constructor iframe submit/reload',reason:'Host publishes after independent acceptance; HTTPS and iframe are unavailable locally. Verify Secure, HttpOnly, SameSite=None and Partitioned receipt cookie in that environment.'}]};
};
if(require.main===module){if(require('node:fs').existsSync('.env.local'))process.loadEnvFile('.env.local');(async()=>{const {chromium}=require('@playwright/test');const browser=await chromium.launch({args:['--no-sandbox']});try{const r=await exports.verify({browser,baseUrl:'http://127.0.0.1:3100',evidenceDir:path.dirname(__filename)});await fs.writeFile(path.join(path.dirname(__filename),'interaction-evidence.json'),JSON.stringify(r,null,2));console.log(JSON.stringify(r.checks,null,2));}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});}
