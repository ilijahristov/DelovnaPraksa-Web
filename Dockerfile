# ---- 1. Build the React frontend ----
FROM node:22-alpine AS client-build
WORKDIR /client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ---- 2. Build the Express backend ----
FROM node:22-alpine AS server-build
WORKDIR /server
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY server/ ./
RUN npm run build

# ---- 3. Slim runtime image ----
FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app

# Production dependencies only.
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# SQL migrations are applied by the app on every start.
COPY server/migrations ./migrations
COPY --from=server-build /server/dist ./dist
COPY --from=client-build /client/dist ./public

# Nothing in /app is written at runtime, so the app runs as the unprivileged
# `node` user from the base image.
USER node
EXPOSE 3000
CMD ["node", "dist/start.js"]
