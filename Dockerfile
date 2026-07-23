# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./

# --- dependencies for building (includes devDependencies: typescript, tsc-alias) ---
FROM base AS build-deps
RUN npm ci

# --- compile TypeScript -> dist/, with @/ aliases rewritten to relative paths ---
FROM build-deps AS build
COPY . .
RUN npm run build

# --- production-only dependencies ---
FROM base AS prod-deps
RUN npm ci --omit=dev

# --- final runtime image: no compilers, no source, just dist + prod deps ---
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

# Overridden by docker-compose per service; falls back to the checkout service.
CMD ["node", "dist/services/checkout/bootstrap.js"]
