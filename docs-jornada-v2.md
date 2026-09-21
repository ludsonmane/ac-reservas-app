# Jornada de reservas v2 (branch feat/jornada-v2)

Rota nova `/reserva` (3 telas) convivendo com `/reservar` (antiga). Links curtos `/bsb /ac /sp /partage`.

- Tela 1 `/reserva`: casa, pessoas, dia, horário, ocasião, ambiente. Uma pergunta em foco por vez.
- Tela 2 `/reserva/dados`: WhatsApp identifica o cliente no CRM (proxy `/api/crm/lookup`), nome, CPF/nascimento só quando destrava algo, e-mail opcional.
- Tela 3 `/reserva/pronto/[code]`: código, QR, combinado de chegada, convite, agenda.
- Envio via `/api/reserva` (servidor completa dados do CRM e repassa para a API de reservas).
- Agente do Mané: `_components/AgenteMane.tsx` (passo 1, respostas locais).

## Rodar em outro PC
```
npm install
# criar .env.development.local (NÃO versionado):
#   ENGINE_API_BASE=https://engine.mane.com.vc/api
#   ENGINE_API_TOKEN=<token do engine>
npx next dev -p 3000    # a API de produção só aceita CORS de localhost:3000
```
Em produção: definir `ENGINE_API_BASE` e `ENGINE_API_TOKEN` nas variáveis do Railway.

Decisões pendentes: campo `people` (total ou só adultos), bloqueio de almoço em BSB nos fins de semana, etapa 3 (alterar/cancelar pelo cliente exige endpoint novo na mane-api).
