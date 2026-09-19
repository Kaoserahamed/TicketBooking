# Ticket Booking web app — build once, serve statically (docs/12-deployment.md).
# Stage 1 compiles the Vite bundle; stage 2 ships only dist/ behind nginx,
# which also reverse-proxies /api to the backend service (same origin, so the
# httpOnly refresh cookie and CORS behave exactly like dev).

# ---- build: compile the production bundle ----------------------------------
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# tsc -b && vite build — a type error fails the image build, which is exactly
# what the CI pipeline relies on.
RUN npm run build

# ---- runtime: static files + API reverse proxy ------------------------------
FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
