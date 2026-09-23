# Simulação da jornada de reservas (antigo x novo)

Robô de navegador que percorre `/reservar` (antigo) e `/reserva` (novo) como um cliente no celular,
medindo toques, caracteres digitados, telas e tempo. Nada é gravado de verdade: a gravação é interceptada.

```
npm i -D playwright-core        # uma vez
npx next dev -p 3000            # a API de produção só aceita CORS de localhost:3000
KNOWN1=61999999999 KNOWN2=61988888888 node scripts/sim-jornada/sim-completa.js
node scripts/sim-jornada/sim-esforco.js
```

`KNOWN1`/`KNOWN2` = WhatsApps (11 dígitos) de clientes que existem no CRM, para testar o reconhecimento.
Edge precisa estar instalado no caminho padrão (o script usa o executável dele).
