# Pinned by digest for reproducible builds; Dependabot proposes updates monthly.
FROM node:25-slim@sha256:81db02c4b671288a03915da9534dbd54f96d0e7c24d80ccc54f5b36b2e684370 AS build
WORKDIR /app
COPY package.json package-lock.json ./
# better-sqlite3 ships prebuilt binaries: skip npm's implicit node-gyp step (needs Python).
RUN npm ci --ignore-scripts
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:25-slim@sha256:81db02c4b671288a03915da9534dbd54f96d0e7c24d80ccc54f5b36b2e684370
WORKDIR /app
ENV NODE_ENV=production
# Fly mounts the data volume as root: the process starts as root, hands the data folder to the
# image's unprivileged "node" user, then switches to it for good (src/privileges.ts).
ENV RUN_AS_UID=1000 RUN_AS_GID=1000
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY drizzle ./drizzle
CMD ["node", "dist/index.js"]
