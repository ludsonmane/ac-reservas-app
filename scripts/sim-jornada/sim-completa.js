// Simulação COMPLETA: antigo x novo até a tela de confirmação, com a GRAVAÇÃO interceptada (nada é criado
// de verdade). Leituras (unidades, disponibilidade, CRM, reserva ativa) são reais. Depois, cenários de validação.
const { chromium } = require('playwright-core');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = 'http://localhost:3000';
const HUMAN = { tap: 700, char: 150, read: 1500 };
const KNOWN1 = process.env.KNOWN1 || ''; // 11 dígitos, cliente conhecido
const KNOWN2 = process.env.KNOWN2 || ''; // outro cliente conhecido
const SAT = (() => { const d = new Date(); const diff = (6 - d.getDay() + 7) % 7 || 7; d.setDate(d.getDate() + diff); return d; })();
const satDay = String(SAT.getDate());
const dayRe = new RegExp('^' + satDay + '$');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

const personas = [
  { key: 'A', label: 'Aniversário, 12 pessoas, cliente novo, Águas Claras', unit: 'ac', people: 12, kids: 0, birthday: true, phone: '61900000123', name: 'Ana Ribeiro Teste', cpf: '52998224725', bday: '14/03/1990', email: 'ana.teste@example.com' },
  { key: 'B', label: 'Grupo de 8, cliente conhecido no CRM, Águas Claras', unit: 'ac', people: 8, kids: 0, birthday: false, phone: KNOWN1, name: 'Cliente Conhecido', cpf: '52998224725', bday: '', email: 'b.teste@example.com' },
  { key: 'C', label: 'Família com 2 crianças (5 pessoas), Brasília, almoço', unit: 'bsb', people: 3, kids: 2, birthday: false, lunch: true, phone: '61981112233', name: 'Carlos Souza Teste', cpf: '52998224725', bday: '', email: 'carlos.teste@example.com' },
];

const fakeReservation = (p) => ({
  id: 'sim-0001', reservationCode: 'SIMUL8', status: 'AWAITING_CHECKIN', fullName: p.name, people: p.people + p.kids, kids: p.kids,
  reservationDate: new Date(SAT.getFullYear(), SAT.getMonth(), SAT.getDate(), p.lunch ? 12 : 20, p.lunch ? 30 : 0).toISOString(),
  unit: p.unit === 'ac' ? 'Mané Águas Claras, DF' : 'Mané Brasília, DF', unitRef: { name: p.unit === 'ac' ? 'Mané Águas Claras, DF' : 'Mané Brasília, DF' },
  areaName: 'Ala Sul - Varanda', areaRef: { name: 'Ala Sul - Varanda' }, reservationType: p.birthday ? 'ANIVERSARIO' : 'PARTICULAR', phone: p.phone,
});

function meter(page) {
  const m = { taps: 0, chars: 0, screens: 0, requests: 0, human: 0, errors: [], t0: Date.now(), notes: [], posted: null };
  page.__m = m;
  return {
    m,
    tap: async (fn, label) => { m.taps++; m.human += HUMAN.tap; try { await fn(); } catch (e) { m.errors.push(label + ': ' + e.message.split('\n')[0]); throw e; } },
    type: async (loc, text, label) => { m.taps++; m.chars += text.length; m.human += HUMAN.tap + text.length * HUMAN.char; try { await loc.click(); await loc.fill(''); await loc.type(text, { delay: 5 }); } catch (e) { m.errors.push((label || 'digitar') + ': ' + e.message.split('\n')[0]); throw e; } },
    screen: (label) => { m.screens++; m.human += HUMAN.read; m.notes.push(label); },
  };
}

// ---------- mocks de GRAVAÇÃO (nunca cria reserva de verdade) ----------
async function mockWrites(page, p, opts = {}) {
  const m = page.__m;
  // novo: POST interno /api/reserva
  await page.route('**/api/reserva', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    if (m) m.posted = JSON.parse(route.request().postData() || '{}');
    if (opts.postStatus && opts.postStatus !== 201) return route.fulfill({ status: opts.postStatus, contentType: 'application/json', body: JSON.stringify(opts.postBody || {}) });
    return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 'sim-0001', reservationCode: 'SIMUL8', status: 'AWAITING_CHECKIN', reservationType: p.birthday ? 'ANIVERSARIO' : 'PARTICULAR' }) });
  });
  // antigo: POST direto na API
  await page.route('**/v1/reservations/public', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    if (m) m.posted = JSON.parse(route.request().postData() || '{}');
    return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 'sim-0001', reservationCode: 'SIMUL8', status: 'AWAITING_CHECKIN' }) });
  });
  // leituras da reserva falsa (tela 3 nova, step 4 antigo) e QR
  await page.route('**/v1/reservations/public/by-code/SIMUL8', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fakeReservation(p)) }));
  await page.route('**/v1/reservations/public/active?id=sim-0001', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fakeReservation(p)) }));
  await page.route('**/v1/reservations/sim-0001/qrcode*', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
}

async function pickNewSlot(page, k, p) {
  const slotsGroup = page.getByRole('radiogroup', { name: /Que horas/ });
  await slotsGroup.waitFor({ timeout: 15000 });
  const enabled = slotsGroup.locator('button[role=radio]:not([disabled])');
  await enabled.first().waitFor({ timeout: 15000 });
  const names = await enabled.allInnerTexts();
  let idx = -1;
  for (const t of (p.lunch ? ['12h30', '12h', '13h'] : ['20h', '19h30', '20h30', '19h', '18h30'])) { idx = names.findIndex((n) => n.trim() === t || n.trim().startsWith(t + '\n')); if (idx >= 0) break; }
  await k.tap(() => enabled.nth(idx >= 0 ? idx : names.length - 1).click(), 'horário');
}

async function newFlow(page, p) {
  const k = meter(page); const { m } = k;
  await mockWrites(page, p);
  page.on('request', (r) => { if (/api\.mane\.com\.vc|\/api\//.test(r.url())) m.requests++; });
  await page.goto(BASE + '/' + p.unit, { waitUntil: 'networkidle' });
  k.screen('tela 1: casa já marcada pelo link');
  await page.getByRole('heading', { name: 'Quem vem?' }).waitFor({ timeout: 20000 });
  const adultsQuick = page.getByRole('group', { name: /Atalhos de adultos/i }).getByRole('button', { name: String(p.people), exact: true });
  if (await adultsQuick.count()) await k.tap(() => adultsQuick.click(), 'chip adultos'); else await k.type(page.locator('#reserva-adultos'), String(p.people), 'adultos');
  if (p.kids) await k.tap(() => page.getByRole('group', { name: /Atalhos de crianças/i }).getByRole('button', { name: String(p.kids), exact: true }).click(), 'chip crianças');
  await k.tap(() => page.getByRole('button', { name: /^Somos/ }).click(), 'confirmar pessoas');
  k.screen('pergunta: dia');
  await k.tap(() => page.getByRole('radio', { name: new RegExp('Sáb ' + satDay) }).click(), 'dia sábado');
  k.screen('pergunta: horário');
  await pickNewSlot(page, k, p);
  k.screen('ocasião + ambiente (sugestão já marcada)');
  if (p.birthday) await k.tap(() => page.getByRole('radio', { name: 'Aniversário' }).click(), 'ocasião');
  await page.getByRole('radiogroup', { name: /Onde vocês querem ficar/ }).waitFor({ timeout: 15000 });
  await k.tap(() => page.getByRole('button', { name: 'Guardar esse horário' }).click(), 'continuar tela 1');
  await page.waitForURL(/\/reserva\/dados/, { timeout: 15000 });
  k.screen('tela 2: dados');
  await k.type(page.locator('#f-phone'), p.phone, 'whatsapp');
  const greet = page.getByRole('button', { name: /^Sou eu/ });
  const known = await greet.waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
  if (known) { await k.tap(() => greet.click(), 'sou eu'); m.notes.push('reconhecido pelo CRM: nome preenchido'); }
  if (!(await page.locator('#f-name').inputValue())) await k.type(page.locator('#f-name'), p.name, 'nome');
  if (p.birthday) {
    if (await page.locator('#f-cpf').count()) await k.type(page.locator('#f-cpf'), p.cpf, 'cpf');
    if (await page.locator('#f-birthday').count()) await k.type(page.locator('#f-birthday'), p.bday, 'nascimento');
  }
  await k.tap(() => page.getByRole('button', { name: /Confirmar minha mesa/ }).click(), 'confirmar');
  await page.waitForURL(/\/reserva\/pronto\/SIMUL8/, { timeout: 20000 });
  k.screen('tela 3: confirmado');
  await page.getByText('SIMUL8').first().waitFor({ timeout: 15000 });
  m.notes.push('CONCLUÍDO: código na tela, QR, convite');
  m.checks = {
    codigo_visivel: await page.getByText('SIMUL8').first().isVisible(),
    qr_visivel: await page.locator('img[alt*="QR"]').first().isVisible().catch(() => false),
    convite_whatsapp: await page.getByRole('link', { name: /Enviar convite no WhatsApp/ }).isVisible().catch(() => false),
    tolerancia_visivel: await page.getByText(/15 minutos/).first().isVisible().catch(() => false),
    alterar_cancelar: await page.getByRole('link', { name: /Alterar ou cancelar/ }).isVisible().catch(() => false),
  };
  m.wall = Date.now() - m.t0;
  return m;
}

async function oldFlow(page, p) {
  const k = meter(page); const { m } = k;
  await mockWrites(page, p);
  page.on('request', (r) => { if (/api\.mane\.com\.vc/.test(r.url())) m.requests++; });
  await page.goto(BASE + '/reservar', { waitUntil: 'networkidle' });
  k.screen('step 0: tipo de reserva');
  if (!p.birthday) await k.tap(() => page.getByRole('button', { name: 'Particular' }).click(), 'tipo particular');
  await k.tap(() => page.getByRole('button', { name: /Garantir meus bônus|Escolher data e horário/ }).click(), 'continuar step 0');
  k.screen('step 1: unidade, pessoas, data, horário');
  const unitName = p.unit === 'ac' ? /Águas Claras/ : /Brasília/;
  await page.getByRole('button', { name: unitName }).first().waitFor({ timeout: 20000 });
  await k.tap(() => page.getByRole('button', { name: unitName }).first().click(), 'unidade');
  await k.type(page.getByLabel('Adultos'), String(p.people), 'adultos');
  if (p.kids) await k.type(page.getByLabel('Crianças'), String(p.kids), 'crianças');
  await k.tap(() => page.getByLabel('Data').click(), 'abrir data');
  await k.tap(() => page.locator('button[class*="Day-day"], button[class*="-day"]').filter({ hasText: dayRe }).first().click(), 'dia no calendário');
  await k.tap(() => page.getByLabel('Horário').click(), 'abrir horário');
  let slotBtn = null;
  for (let attempt = 0; attempt < 2 && !slotBtn; attempt++) {
    if (attempt) await page.getByLabel('Horário').click();
    await page.waitForTimeout(600);
    for (const t of (p.lunch ? ['12:30', '12:00', '13:00'] : ['20:00', '19:30', '20:30', '19:00', '18:30'])) {
      const b = page.locator('.mantine-Popover-dropdown button:not([disabled]):not([data-disabled="true"])').filter({ hasText: new RegExp('^' + t + '$') });
      if (await b.count()) { slotBtn = b.first(); break; }
    }
  }
  if (!slotBtn) throw new Error('nenhum horário disponível no popover');
  await k.tap(() => slotBtn.click(), 'horário');
  await k.tap(() => page.getByRole('button', { name: /Ver áreas disponíveis/ }).click(), 'continuar step 1');
  k.screen('step 2: área');
  const nextBtn = page.getByRole('button', { name: /Quase lá/ });
  await nextBtn.waitFor({ timeout: 20000 });
  await page.waitForTimeout(1200);
  if (!(await nextBtn.isEnabled())) {
    const cards = page.locator('[class*="Card-root"]').filter({ hasNotText: /ESGOTADO/ });
    const n = await cards.count();
    for (let i = 0; i < n && !(await nextBtn.isEnabled()); i++) { await k.tap(() => cards.nth(i).click(), 'trocar área ' + i); await page.waitForTimeout(400); }
    if (!(await nextBtn.isEnabled())) { m.notes.push('BECO SEM SAÍDA: nenhuma área cabe e a tela não explica'); throw new Error('Finalizar desabilitado'); }
  }
  await k.tap(() => nextBtn.click(), 'continuar step 2');
  k.screen('step 3: seus dados (5 campos)');
  await k.type(page.getByLabel('Nome completo'), p.name, 'nome');
  await k.type(page.getByLabel(/WhatsApp/), p.phone, 'whatsapp');
  await k.type(page.getByLabel('E-mail'), p.email, 'e-mail');
  await k.type(page.getByLabel('CPF'), p.cpf, 'cpf');
  await k.type(page.getByLabel('Nascimento'), p.bday || '10/10/1988', 'nascimento');
  await k.tap(() => page.getByRole('button', { name: /Garantir minha mesa/ }).click(), 'garantir');
  await page.getByText(/Reserva confirmada|Reserva concluída/).first().waitFor({ timeout: 25000 });
  k.screen('step 4: confirmação (pôster)');
  await page.waitForTimeout(1500);
  m.notes.push('CONCLUÍDO');
  const body = await page.locator('body').innerText();
  m.checks = {
    codigo_visivel: /SIMUL8/.test(body),
    qr_visivel: await page.locator('img[src*="qrcode"]').first().isVisible().catch(() => false),
    convite_whatsapp: await page.getByRole('button', { name: /Enviar convite/ }).isVisible().catch(() => false),
    tolerancia_visivel: /15 min/.test(body),
    alterar_cancelar: /alterar|cancelar/i.test(body),
  };
  m.wall = Date.now() - m.t0;
  return m;
}

// ---------- cenários de validação (só no novo) ----------
async function scenarios(browser) {
  const out = [];
  const run = async (name, fn) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    try { const r = await fn(page); out.push({ name, ok: true, ...r }); }
    catch (e) { out.push({ name, ok: false, error: String(e.message).split('\n')[0] }); await page.screenshot({ path: 'scen-' + name.replace(/\W+/g, '_') + '.png' }).catch(() => {}); }
    await ctx.close();
  };
  const p = personas[1];

  // leva até a tela 2 com um rascunho válido
  const toDados = async (page) => {
    const k = meter(page);
    await page.goto(BASE + '/ac', { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'Quem vem?' }).waitFor({ timeout: 20000 });
    await page.getByRole('group', { name: /Atalhos de adultos/i }).getByRole('button', { name: '8', exact: true }).click();
    await page.getByRole('button', { name: /^Somos/ }).click();
    await page.getByRole('radio', { name: new RegExp('Sáb ' + satDay) }).click();
    await pickNewSlot(page, k, p);
    await page.getByRole('radiogroup', { name: /Onde vocês querem ficar/ }).waitFor({ timeout: 15000 });
    await page.getByRole('button', { name: 'Guardar esse horário' }).click();
    await page.waitForURL(/\/reserva\/dados/, { timeout: 15000 });
  };

  await run('troca de cliente: nome acompanha quem disse "sou eu"', async (page) => {
    await toDados(page);
    await page.locator('#f-phone').fill(''); await page.locator('#f-phone').type(KNOWN1, { delay: 5 });
    await page.getByRole('button', { name: /^Sou eu/ }).click({ timeout: 10000 });
    const n1 = await page.locator('#f-name').inputValue();
    await page.locator('#f-phone').fill(''); await page.locator('#f-phone').type(KNOWN2, { delay: 5 });
    await page.getByRole('button', { name: /^Sou eu/ }).click({ timeout: 10000 });
    const n2 = await page.locator('#f-name').inputValue();
    if (!n1 || !n2 || n1 === n2) throw new Error('nome não trocou: ' + n1 + ' → ' + n2);
    return { detail: n1.split(' ')[0] + ' → ' + n2.split(' ')[0] };
  });

  await run('WhatsApp com reserva ativa: avisa e bloqueia o envio', async (page) => {
    await page.route('**/v1/reservations/public/active?phone=*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...fakeReservation(p), reservationCode: 'ATIVA1' }) }));
    await toDados(page);
    await page.locator('#f-phone').type('61988887777', { delay: 5 });
    await page.getByText(/já tem uma mesa guardada/).waitFor({ timeout: 8000 });
    const disabled = await page.getByRole('button', { name: /Confirmar minha mesa/ }).isDisabled();
    await page.getByRole('button', { name: 'Não é minha' }).click();
    const enabledAfter = !(await page.getByRole('button', { name: /Confirmar minha mesa/ }).isDisabled());
    if (!disabled) throw new Error('botão não bloqueou');
    return { detail: 'bloqueou; liberou após "não é minha": ' + enabledAfter };
  });

  await run('área lotou na conferência final: oferece troca em 1 toque', async (page) => {
    await toDados(page);
    // a partir daqui, a disponibilidade diz que a área escolhida lotou
    await page.route('**/v1/reservations/public/availability**', async (route) => {
      const res = await route.fetch(); const list = await res.json();
      const draft = JSON.parse(await page.evaluate(() => sessionStorage.getItem('mane:reserva:v2') || '{}'));
      const patched = list.map((a, i) => ({ ...a, available: String(a.id) === draft.areaId ? 0 : (i === 0 && String(a.id) === draft.areaId ? 0 : 30), remaining: String(a.id) === draft.areaId ? 0 : 30, isAvailable: String(a.id) !== draft.areaId }));
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(patched) });
    });
    await mockWrites(page, p);
    await page.locator('#f-phone').type('61900000123', { delay: 5 });
    await page.locator('#f-name').type('Teste Conferencia', { delay: 5 });
    await page.waitForTimeout(2500);
    await page.getByRole('button', { name: /Confirmar minha mesa/ }).click();
    await page.getByText(/acabou de lotar/).waitFor({ timeout: 10000 });
    const swapBtn = page.getByRole('button', { name: /^Confirmar na/ });
    await swapBtn.waitFor({ timeout: 5000 });
    const label = await swapBtn.innerText();
    await swapBtn.click();
    await page.waitForURL(/\/reserva\/pronto\/SIMUL8/, { timeout: 20000 });
    return { detail: label.trim() + ' → confirmou na área alternativa' };
  });

  await run('servidor recusa (409 lotou): mensagem clara + atalho para outro horário', async (page) => {
    await toDados(page);
    await mockWrites(page, p, { postStatus: 409, postBody: { error: { code: 'NO_CAPACITY', message: 'Capacidade da noite esgotada para esta área no horário selecionado.' } } });
    await page.locator('#f-phone').type('61900000123', { delay: 5 });
    await page.locator('#f-name').type('Teste Erro', { delay: 5 });
    await page.waitForTimeout(2500);
    await page.getByRole('button', { name: /Confirmar minha mesa/ }).click();
    await page.getByText('Esse horário acabou de lotar.').waitFor({ timeout: 10000 });
    const link = page.getByRole('link', { name: 'Escolher outro horário' });
    const href = await link.getAttribute('href');
    return { detail: 'título amigável + link ' + href };
  });

  await run('mínimo de pico: 3 pessoas sábado de dia em Brasília é barrado antes do botão', async (page) => {
    await page.goto(BASE + '/bsb', { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'Quem vem?' }).waitFor({ timeout: 20000 });
    await page.locator('#reserva-adultos').fill('3'); await page.locator('#reserva-adultos').blur();
    await page.getByRole('button', { name: /^Somos/ }).click();
    await page.getByRole('radio', { name: new RegExp('Sáb ' + satDay) }).click();
    const k = meter(page);
    await pickNewSlot(page, k, { lunch: true });
    await page.getByText(/reserva a partir de 5 pessoas/).waitFor({ timeout: 10000 });
    const hint = await page.getByText(/recebe reservas até/).first().innerText().catch(() => '');
    return { detail: 'aviso de pico exibido; ' + hint.slice(0, 60) };
  });

  return out;
}

(async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const results = [];
  for (const p of personas) {
    if (!p.phone) continue;
    for (const [flow, fn] of [['antigo', oldFlow], ['novo', newFlow]]) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      let m;
      try { m = await fn(page, p); }
      catch (e) { m = page.__m || { taps: 0, chars: 0, screens: 0, requests: 0, human: 0, errors: [], notes: [], t0: Date.now() }; m.errors = [...m.errors, String(e.message).split('\n')[0]]; m.notes = [...m.notes, 'FALHOU']; m.wall = Date.now() - m.t0; }
      await page.screenshot({ path: 'full-' + p.key + '-' + flow + '.png' }).catch(() => {});
      results.push({ persona: p.key, label: p.label, flow, ...m });
      await ctx.close();
    }
  }
  const scen = await scenarios(browser);
  await browser.close();
  console.log(JSON.stringify({ results, scen }));
})();
