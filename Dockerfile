# syntax=docker/dockerfile:1
#
# The Roadmap Tracker.
#
# Two stages, so the image that ships does not carry a compiler. argon2 is a
# native module and needs python3, make and g++ to build, none of which have any
# business being in a running container.
#
# Build:
#   docker build -t roadmap-tracker .
# Run:
#   docker run --env-file .env -p 127.0.0.1:3000:3000 roadmap-tracker
#
# Or use docker-compose.yml, which brings MySQL 8 with it.

# ----------------------------------------------------------------- build stage

FROM node:24-bookworm-slim AS build

# argon2 compiles from source. mysqldump comes from the client package and is
# needed at run time, not here, but the build image is where apt lives cheaply.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Only the manifests first, so a code change does not invalidate the dependency
# layer. package-lock.json is committed, and npm ci installs exactly it.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

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
    TZ=Asia/Kolkata \
    HOST=0.0.0.0 \
    PORT=3000 \
    MYSQLDUMP_BIN=mysqldump \
    BACKUP_DIR=/app/backups

WORKDIR /app

COPY --from=build /app/node_modules ./node_modules

# Ownership is set on copy, so there is no recursive chown layer.
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node src         ./src
COPY --chown=node:node public      ./public
COPY --chown=node:node views       ./views
COPY --chown=node:node migrations  ./migrations
COPY --chown=node:node scripts     ./scripts
COPY --chown=node:node data        ./data
COPY --chown=node:node docs        ./docs
COPY --chown=node:node tests       ./tests
COPY --chown=node:node README.md   ./

RUN mkdir -p /app/backups && chown node:node /app/backups \
 && chmod +x /app/scripts/backup.sh

# Never root. The application writes to /app/backups and nowhere else.
USER node

EXPOSE 3000

# HOST is 0.0.0.0 inside the container because Docker's port mapping is the
# boundary. Publish it as 127.0.0.1:3000:3000 and put nginx in front. There is no
# authentication on the port itself.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Node 24 reaps zombies with --init from compose, so no tini here.
CMD ["node", "src/server.mjs"]
