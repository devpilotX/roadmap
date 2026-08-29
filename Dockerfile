# syntax=docker/dockerfile:1
#
# The Roadmap Tracker. Next.js, MySQL, no third party service.
#
# Three stages, so the image that ships carries neither a compiler nor a
# development dependency. argon2 is a native module and needs python3, make and
# g++ to build, none of which have any business being in a running container.
#
# Build:
#   docker build -t roadmap-tracker .
# Run:
#   docker run --env-file .env -p 127.0.0.1:3000:3000 roadmap-tracker
#
# Or use docker-compose.yml, which brings MySQL 8 with it.

# ------------------------------------------------------------ dependency stage

FROM node:24-bookworm-slim AS deps

# argon2 compiles from source.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Only the manifests first, so a code change does not invalidate this layer.
# package-lock.json is committed, and npm ci installs exactly it.
COPY package.json package-lock.json ./
RUN npm ci

# ----------------------------------------------------------------- build stage

FROM node:24-bookworm-slim AS build

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.json next.config.ts postcss.config.mjs eslint.config.mjs middleware.ts ./
COPY app        ./app
COPY components ./components
COPY lib        ./lib
COPY public     ./public
COPY data       ./data

# The build must not need a database. lib/config.ts validates lazily for exactly
# this reason, so `next build` succeeds with no .env present.
RUN npm run build

# ------------------------------------------------------------------- run stage

FROM node:24-bookworm-slim AS run

# default-mysql-client gives mysqldump and mysql, which scripts/backup.sh needs.
# tzdata is explicit: every date in this application is Asia/Kolkata and the
# offset is read from the system timezone database, not assumed.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      default-mysql-client tzdata ca-certificates zip \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    TZ=Asia/Kolkata \
    HOSTNAME=0.0.0.0 \
    HOST=0.0.0.0 \
    PORT=3000 \
    MYSQLDUMP_BIN=mysqldump \
    BACKUP_DIR=/app/backups

WORKDIR /app

# The standalone output carries its own minimal node_modules, so the full
# dependency tree is not shipped. Static assets and public/ sit beside it.
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static     ./.next/static
COPY --from=build --chown=node:node /app/public           ./public

# The CLI scripts are not part of the server, but the runbook needs them: the
# migration, the seed verification, the backup and the digest all run in here.
# They import the TypeScript modules under lib/, so tsx and the full dependency
# tree are needed for those commands and those commands only.
COPY --from=deps  --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node lib         ./lib
COPY --chown=node:node scripts     ./scripts
COPY --chown=node:node migrations  ./migrations
COPY --chown=node:node data        ./data
COPY --chown=node:node docs        ./docs
COPY --chown=node:node tests       ./tests
COPY --chown=node:node package.json package-lock.json tsconfig.json README.md ./

RUN mkdir -p /app/backups && chown node:node /app/backups \
 && chmod +x /app/scripts/backup.sh

# Never root. The application writes to /app/backups and nowhere else.
USER node

EXPOSE 3000

# HOST is 0.0.0.0 inside the container because Docker's port mapping is the
# boundary. Publish it as 127.0.0.1:3000:3000 and put nginx in front. There is no
# authentication on the port itself.
#
# The health check asks the application whether it can reach MySQL, which is the
# question that actually matters. It answers 503 when it cannot.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# The standalone build emits its own server. Node 24 reaps zombies with --init
# from compose, so no tini here.
CMD ["node", "server.js"]
