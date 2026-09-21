// Eventos de funil da jornada v2. Vão para o dataLayer (GA4/GTM) e para o Meta Pixel como evento custom.
// Nomes fixos: reserve_start, step_view, slot_blocked_view, availability_empty, field_error,
// form_abandon, reservation_created, post_confirm_action.
export type FunnelEvent =
  | 'reserve_start' | 'step_view' | 'slot_blocked_view' | 'availability_empty'
  | 'field_error' | 'form_abandon' | 'reservation_created' | 'post_confirm_action'
  | 'agent_open' | 'agent_message' | 'agent_handoff';

export function track(event: FunnelEvent, props: Record<string, unknown> = {}) {
  if (typeof window === 'undefined') return;
  const payload = { event, journey: 'v2', ts: Date.now(), ...props };
  try {
    const w = window as any;
    (w.dataLayer = w.dataLayer || []).push(payload);
    if (typeof w.fbq === 'function') w.fbq('trackCustom', event, props);
    // O Agente do Mané escuta os eventos do funil pra oferecer ajuda no momento certo (lotou, erro, travou).
    w.dispatchEvent(new CustomEvent('mane:funil', { detail: payload }));
    if (process.env.NODE_ENV !== 'production') console.debug('[funil]', event, props);
  } catch {
    /* analytics nunca derruba a jornada */
  }
}
