// Validação e máscaras dos dados pessoais da tela 2.
export const onlyDigits = (v: string) => (v || '').replace(/\D+/g, '');

export function maskPhone(v: string) {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
export function isValidPhone(v: string) {
  const d = onlyDigits(v);
  return d.length === 10 || d.length === 11;
}

export function maskCPF(v: string) {
  const d = onlyDigits(v).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}
/** CPF com dígitos verificadores válidos (rejeita sequências repetidas). */
export function isValidCPF(v: string) {
  const d = onlyDigits(v);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += parseInt(d[i], 10) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === parseInt(d[9], 10) && calc(10) === parseInt(d[10], 10);
}

export function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((v || '').trim());
}

export function maskDateBR(v: string) {
  const d = onlyDigits(v).slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}
/** DD/MM/AAAA → YYYY-MM-DD (ou null se inválida, futura ou antes de 1900). */
export function parseDateBR(v: string): string | null {
  const m = (v || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [_, dd, mm, yyyy] = m;
  const d = new Date(Date.UTC(+yyyy, +mm - 1, +dd));
  if (d.getUTCFullYear() !== +yyyy || d.getUTCMonth() !== +mm - 1 || d.getUTCDate() !== +dd) return null;
  if (+yyyy < 1900 || d.getTime() > Date.now()) return null;
  return `${yyyy}-${mm}-${dd}`;
}

export function hasTwoWords(name: string) {
  return (name || '').trim().split(/\s+/).filter((w) => w.length >= 2).length >= 2;
}

/** Exibições mascaradas para dados que vêm do CRM (nunca mostrar o valor inteiro). */
export function displayMaskedEmail(email?: string | null) {
  if (!email) return '';
  const [user, domain] = email.split('@');
  if (!domain) return '***';
  return `${user.slice(0, 2)}${'*'.repeat(Math.max(2, user.length - 2))}@${domain}`;
}
export function displayMaskedCPF(cpf?: string | null) {
  const d = onlyDigits(cpf || '');
  if (d.length !== 11) return '';
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
}
export function displayMaskedBirthday(iso?: string | null) {
  if (!iso) return '';
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  return `**/${m[2]}/${m[1]}`;
}

/** Idade completa em anos numa data ISO (YYYY-MM-DD), hoje. */
export function ageFromISO(iso: string, today: Date = new Date()) {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = +m[1], mo = +m[2] - 1, d = +m[3];
  let age = today.getFullYear() - y;
  if (today.getMonth() < mo || (today.getMonth() === mo && today.getDate() < d)) age -= 1;
  return age;
}

export const MIN_AGE = 18;
export const MAX_AGE = 80;

/** Mensagem de erro da data de nascimento de quem reserva, ou null se está boa. */
export function birthdayError(v: string): string | null {
  if (!(v || '').trim()) return 'Digite dia, mês e ano, ex.: 14/03/1990.';
  const iso = parseDateBR(v);
  if (!iso) return 'Essa data não existe. Use dia, mês e ano, ex.: 14/03/1990.';
  const age = ageFromISO(iso);
  if (age === null) return 'Data inválida.';
  if (age < MIN_AGE) return `Para reservar é preciso ter ${MIN_AGE} anos ou mais.`;
  if (age > MAX_AGE) return 'Confira o ano: essa data passa de 80 anos.';
  return null;
}
