// Simulação comparativa: fluxo antigo (/reservar) x novo (/reserva), sem enviar a reserva.
// Mede toques, caracteres digitados, telas, chamadas de rede e tempo com um modelo humano igual nos dois.
const { chromium } = require('playwright-core');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = 'http://localhost:3000';
const HUMAN = { tap: 700, char: 150, read: 1500 }; // ms por toque, por caractere, por tela/bloco novo

const KNOWN_PHONE = process.env.KNOWN_PHONE || '';
const SAT = (() => { const d = new Date(); const diff = (6 - d.getDay() + 7) % 7 || 7; d.setDate(d.getDate() + diff); return d; })();
const satDay = String(SAT.getDate());
const dayRe = new RegExp('^' + satDay + '$');

const personas = [
  { key: 'A', label: 'Aniversário, 12 pessoas, cliente novo, Águas Claras', unit: 'ac', people: 12, kids: 0, birthday: true, phone: '61900000123', name: 'Ana Ribeiro Teste', cpf: '52998224725', bday: '14/03/1990', email: 'ana.teste@example.com' },
  { key: 'B', label: 'Grupo de 8, cliente conhecido no CRM, Águas Claras', unit: 'ac', people: 8, kids: 0, birthday: false, phone: KNOWN_PHONE, name: 'Breno Moura', cpf: '52998224725', bday: '', email: 'breno.teste@example.com' },
  { key: 'C', label: 'Casal com 2 crianças (4 pessoas), Brasília', unit: 'bsb', people: 2, kids: 2, birthday: false, lunch: true, phone: '61981112233', name: 'Carlos Souza Teste', cpf: '52998224725', bday: '', email: 'carlos.teste@example.com' },
];

function meter(page) {
  const m = { taps: 0, chars: 0, screens: 0, requests: 0, human: 0, errors: [], t0: Date.now(), notes: [] };
  page.__m = m;
  return {
    m,
    tap: async (fn, label) => { m.taps++; m.human += HUMAN.tap; try { await fn(); } catch (e) { m.errors.push(label + ': ' + e.message.split('\n')[0]); throw e; } },
    type: async (loc, text, label) => { m.taps++; m.chars += text.length; m.human += HUMAN.tap + text.length * HUMAN.char; try { await loc.click(); await loc.fill(''); await loc.type(text, { delay: 5 }); } catch (e) { m.errors.push((label || 'digitar') + ': ' + e.message.split('\n')[0]); throw e; } },
    screen: (label) => { m.screens++; m.human += HUMAN.read; m.notes.push(label); },
  };
}

async function newFlow(page, p) {
  const k = meter(page); const { m } = k;
  page.on('request', (r) => { if (/api\.mane\.com\.vc|\/api\//.test(r.url())) m.requests++; });
  await page.goto(BASE + '/' + p.unit, { waitUntil: 'networkidle' });
  k.screen('tela 1: casa já marcada pelo link');
  await page.getByRole('heading', { name: 'Quem vem?' }).waitFor({ timeout: 20000 });
  const adultsQuick = page.getByRole('group', { name: /Atalhos de adultos/i }).getByRole('button', { name: String(p.people), exact: true });
  if (await adultsQuick.count()) await k.tap(() => adultsQuick.click(), 'chip adultos');
  else await k.type(page.locator('#reserva-adultos'), String(p.people), 'adultos');
  if (p.kids) await k.tap(() => page.getByRole('group', { name: /Atalhos de crianças/i }).getByRole('button', { name: String(p.kids), exact: true }).click(), 'chip crianças');
  await k.tap(() => page.getByRole('button', { name: /^Somos/ }).click(), 'confirmar pessoas');
  k.screen('pergunta: dia');
  await k.tap(() => page.getByRole('radio', { name: new RegExp('Sáb ' + satDay) }).click(), 'dia sábado');
  k.screen('pergunta: horário');
  const slotsGroup = page.getByRole('radiogroup', { name: /Que horas/ });
  await slotsGroup.waitFor({ timeout: 15000 });
  const enabled = slotsGroup.locator('button[role=radio]:not([disabled])');
  await enabled.first().waitFor({ timeout: 15000 });
  const names = await enabled.allInnerTexts();
  let wantIdx = -1;
  for (const t of (p.lunch ? ['12h30', '12h', '13h'] : ['20h', '19h30', '20h30', '19h', '18h30'])) { wantIdx = names.findIndex((n) => n.trim().startsWith(t) && !n.trim().startsWith(t + '3')); if (wantIdx >= 0) break; }
  await k.tap(() => enabled.nth(wantIdx >= 0 ? wantIdx : names.length - 1).click(), 'horário');
  k.screen('ocasião + ambiente (sugestão já marcada)');
  if (p.birthday) await k.tap(() => page.getByRole('radio', { name: 'Aniversário' }).click(), 'ocasião');
  await page.getByRole('radiogroup', { name: /Onde vocês querem ficar/ }).waitFor({ timeout: 15000 });
  await k.tap(() => page.getByRole('button', { name: 'Guardar esse horário' }).click(), 'continuar tela 1');
  await page.waitForURL(/\/reserva\/dados/, { timeout: 15000 });
  k.screen('tela 2: dados');
  await k.type(page.locator('#f-phone'), p.phone, 'whatsapp');
  const greet = page.getByRole('button', { name: /^Sou eu/ });
  const known = await greet.waitFor({ timeout: 6000 }).then(() => true).catch(() => false);
  if (known) { await k.tap(() => greet.click(), 'sou eu'); m.notes.push('reconhecido pelo CRM: nome preenchido'); }
  const nameVal = await page.locator('#f-name').inputValue();
  if (!nameVal) await k.type(page.locator('#f-name'), p.name, 'nome');
  if (p.birthday) {
    if (await page.locator('#f-cpf').count()) await k.type(page.locator('#f-cpf'), p.cpf, 'cpf');
    if (await page.locator('#f-birthday').count()) await k.type(page.locator('#f-birthday'), p.bday, 'nascimento');
  }
  const ready = await page.getByRole('button', { name: /Confirmar minha mesa/ }).isEnabled();
  m.notes.push(ready ? 'pronto para enviar (não enviado)' : 'botão ainda bloqueado');
  m.wall = Date.now() - m.t0;
  return m;
}

async function oldFlow(page, p) {
  const k = meter(page); const { m } = k;
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
    if (attempt) { await page.getByLabel('Horário').click(); }
    await page.waitForTimeout(600);
    for (const t of (p.lunch ? ['12:30', '12:00', '13:00'] : ['20:00', '19:30', '20:30', '19:00', '18:30'])) {
      const b = page.locator('.mantine-Popover-dropdown button:not([disabled]):not([data-disabled="true"])').filter({ hasText: new RegExp('^' + t + '$') });
      if (await b.count()) { slotBtn = b.first(); break; }
    }
  }
  if (!slotBtn) throw new Error('nenhum horário disponível no popover');
  await k.tap(() => slotBtn.click(), 'horário');
  await page.waitForTimeout(400);
  if (!(await page.getByLabel('Horário').first().inputValue())) {
    // o primeiro toque não pegou (popover fechou antes): reabre e clica de novo, como uma pessoa faria
    m.notes.push('horário não pegou no 1º toque, repetiu');
    await k.tap(() => page.getByLabel('Horário').click(), 'reabrir horário');
    await page.waitForTimeout(600);
    for (const t of (p.lunch ? ['12:30', '12:00', '13:00'] : ['20:00', '19:30', '20:30', '19:00', '18:30'])) {
      const b = page.locator('.mantine-Popover-dropdown button:not([disabled]):not([data-disabled="true"])').filter({ hasText: new RegExp('^' + t + '$') });
      if (await b.count()) { await k.tap(() => b.first().evaluate((el) => el.click()), 'horário (2ª)'); break; }
    }
  }
  await k.tap(() => page.getByRole('button', { name: /Ver áreas disponíveis/ }).click(), 'continuar step 1');
  k.screen('step 2: área');
  const nextBtn = page.getByRole('button', { name: /Quase lá/ });
  await nextBtn.waitFor({ timeout: 20000 });
  await page.waitForTimeout(1200);
  if (!(await nextBtn.isEnabled())) {
    // área pré-selecionada não cabe o grupo: tenta outra área que caiba
    const cards = page.locator('[class*="Card-root"]').filter({ hasNotText: /ESGOTADO/ });
    const n = await cards.count();
    for (let i = 0; i < n && !(await nextBtn.isEnabled()); i++) { await k.tap(() => cards.nth(i).click(), 'trocar área ' + i); await page.waitForTimeout(400); }
    if (!(await nextBtn.isEnabled())) { m.notes.push('BECO SEM SAÍDA: nenhuma área cabe o grupo nesse horário e a tela não explica'); throw new Error('botão Finalizar continua desabilitado'); }
  }
  await k.tap(() => nextBtn.click(), 'continuar step 2');
  k.screen('step 3: seus dados (5 campos)');
  await k.type(page.getByLabel('Nome completo'), p.name, 'nome');
  await k.type(page.getByLabel(/WhatsApp/), p.phone, 'whatsapp');
  await k.type(page.getByLabel('E-mail'), p.email, 'e-mail');
  await k.type(page.getByLabel('CPF'), p.cpf, 'cpf');
  await k.type(page.getByLabel('Nascimento'), p.bday || '10/10/1988', 'nascimento');
  const ready = await page.getByRole('button', { name: /Garantir minha mesa/ }).isEnabled().catch(() => false);
  m.notes.push(ready ? 'pronto para enviar (não enviado)' : 'botão ainda bloqueado');
  m.wall = Date.now() - m.t0;
  return m;
}

(async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const results = [];
  for (const p of personas) {
    if (!p.phone) { console.error('persona ' + p.key + ': sem telefone conhecido, pulando'); continue; }
    for (const [flow, fn] of [['antigo', oldFlow], ['novo', newFlow]]) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      let m;
      try { m = await fn(page, p); }
      catch (e) { m = page.__m || { taps: 0, chars: 0, screens: 0, requests: 0, human: 0, errors: [], notes: [], t0: Date.now() }; m.errors = [...m.errors, String(e.message).split('\n')[0]]; m.notes = [...m.notes, 'FALHOU']; m.wall = Date.now() - m.t0; }
      await page.screenshot({ path: 'shot-' + p.key + '-' + flow + '.png' }).catch(() => {});
      results.push({ persona: p.key, label: p.label, flow, ...m });
      await ctx.close();
    }
  }
  await browser.close();
  console.log(JSON.stringify(results));
})();
