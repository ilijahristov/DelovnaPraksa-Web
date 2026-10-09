# ---- 1. Build the React frontend ----
FROM node:22-alpine AS client-build
WORKDIR /client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ---- 2. Build the Express backend ----
FROM node:22-alpine AS server-build
RUN apk add --no-cache openssl
WORKDIR /server
COPY server/package.json server/package-lock.json ./
COPY server/prisma ./prisma
RUN npm ci
COPY server/ ./
RUN npx prisma generate && npm run build

# ---- 3. Slim runtime image ----
FROM node:22-alpine AS runtime
RUN apk add --no-cache openssl
ENV NODE_ENV=production \
    PORT=3000 \
    CHECKPOINT_DISABLE=1
WORKDIR /app

# Production deps only. The prisma CLI is a runtime dependency because the
# container runs `prisma migrate deploy` on every start.
COPY server/package.json server/package-lock.json ./
COPY server/prisma ./prisma
RUN npm ci --omit=dev && npx prisma generate && npm cache clean --force

COPY --from=server-build /server/dist ./dist
COPY --from=client-build /client/dist ./public

# Nothing in /app is written at runtime, so the app runs as the unprivileged
# `node` user from the base image.
USER node
EXPOSE 3000
CMD ["node", "dist/start.js"]
