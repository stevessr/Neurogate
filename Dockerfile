# syntax=docker/dockerfile:1.7

# ---- Builder stage ----
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies (including dev) for building
COPY package.json package-lock.json ./
RUN npm ci

# Copy sources needed for the build
COPY tsconfig.json prisma.config.ts ./
COPY src ./src

# Generate Prisma client and compile TypeScript
RUN npm run build

# Drop dev dependencies to slim down node_modules for the runtime image
RUN npm prune --omit=dev


# ---- Runtime stage ----
FROM node:22-alpine AS runtime

ENV NODE_ENV=production

WORKDIR /app

# Run as the unprivileged node user shipped with the base image
USER node

COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node entrypoint.sh /app/entrypoint.sh
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node --from=builder /app/src/prisma ./src/prisma

COPY --from=builder /app/src/prisma ./src/prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

EXPOSE 8000

CMD ["/bin/sh", "/app/entrypoint.sh"]
