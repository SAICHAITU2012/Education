# --- build stage: typecheck + vite build --------------------------------
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
# tsconfig type-checks src, tools and tests — keep them all in the context.
COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src
COPY public ./public
COPY tools ./tools
COPY tests ./tests
RUN npm run build

# --- runtime stage -------------------------------------------------------
# NOTE (TD-21): the server runs via tsx from TypeScript sources, so the
# runtime image currently carries devDependencies too. M2 precompiles the
# server (tsc outDir) to slim this image; not worth the churn at M1.
FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=8787 \
    DATA_FILE=/data/abhyas.json
WORKDIR /app
COPY package.json package-lock.json ./
# --include=dev: the server runs via tsx (a devDependency) from source; M2
# precompiles it and drops this (TD-21).
RUN npm ci --include=dev
COPY --from=build /app/dist ./dist
COPY src ./src
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://127.0.0.1:8787/api/health >/dev/null 2>&1 || exit 1
CMD ["npm", "start"]
