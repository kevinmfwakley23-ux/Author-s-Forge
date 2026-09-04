FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV NODE_ENV=development
COPY package.json package-lock.json .nvmrc tsconfig.json ./
COPY scripts/require-node24.js ./scripts/require-node24.js
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=10000 \
    FORGE_WEB_HOST=0.0.0.0 \
    FORGE_DATA_DIR=/data/authors-forge
COPY package.json package-lock.json .nvmrc ./
COPY scripts/require-node24.js ./scripts/require-node24.js
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public
COPY --from=build /app/scripts ./scripts
RUN mkdir -p /data/authors-forge
EXPOSE 10000
CMD ["node", "scripts/start-forge-web.js"]
