# ---------- deps stage ----------
FROM node:20-alpine AS deps
WORKDIR /app

# Evita prompts e reduz tamanho
ENV CI=true \
    NEXT_TELEMETRY_DISABLED=1

# Copia manifestos para cache de deps
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./

# Instala deps de forma inteligente (npm / yarn / pnpm)
RUN set -eux; \
  if [ -f pnpm-lock.yaml ]; then \
    corepack enable && corepack prepare pnpm@latest --activate && pnpm i --frozen-lockfile; \
  elif [ -f yarn.lock ]; then \
    corepack enable && yarn install --frozen-lockfile; \
  else \
    npm ci; \
  fi

# ---------- builder stage ----------
FROM node:20-alpine AS builder
WORKDIR /app
ENV CI=true NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Se usar Next 13/14, o build padrão já serve
RUN set -eux; \
  if [ -f pnpm-lock.yaml ]; then \
    corepack enable && pnpm run build; \
  elif [ -f yarn.lock ]; then \
    corepack enable && yarn build; \
  else \
    npm run build; \
  fi

# ---------- runner stage ----------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Copia apenas o necessário p/ execução
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./

# (Opcional) Se você usar output: "standalone", pode copiar .next/standalone e .next/static apenas.

EXPOSE 3000
CMD ["npm", "run", "start"]
