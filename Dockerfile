FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
COPY server/package*.json server/
COPY web/package*.json web/
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends mpv pipx && rm -rf /var/lib/apt/lists/* \
 && PIPX_HOME=/opt/pipx PIPX_BIN_DIR=/usr/local/bin pipx install pyatv || true
WORKDIR /app
COPY --from=build /app/package*.json ./
COPY --from=build /app/server/package*.json server/
COPY --from=build /app/web/package*.json web/
RUN npm ci --omit=dev --workspaces --include-workspace-root
COPY --from=build /app/server/dist server/dist
COPY --from=build /app/web/dist web/dist
ENV DATA_DIR=/data WEB_DIR=/app/web/dist PORT=8080 NODE_ENV=production
VOLUME /data
CMD ["node", "server/dist/index.js"]
