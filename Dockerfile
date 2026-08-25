# Build context is the repo root; the image mirrors the repo layout
# (/app/backend + /app/frontend/dist) so the backend finds the built React
# dashboard at ../frontend/dist.

# ── Frontend build stage (React + Vite) ───────────────────────────────────────
FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ── Backend runtime (plain JavaScript — no build step) ────────────────────────
FROM node:22-alpine
WORKDIR /app/backend
ENV NODE_ENV=production
COPY backend/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY backend/src ./src
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist
# Railway injects PORT; EXPOSE is documentation only.
EXPOSE 3000
USER node
CMD ["node", "src/server.js"]
