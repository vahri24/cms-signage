FROM node:20-alpine

# player/ is a Node/Express app (see player/server.js) - serves the public
# HTTP slideshow (unchanged behavior/URLs) plus a new authenticated
# /v1/content JSON endpoint for the future Android TV app. It is strictly
# read-only: media/ and devices/ are always mounted read-only here (see
# docker-compose.yml) - only admin/ ever writes to them.
#
# src/config.js resolves MEDIA_DIR/DEVICES_FILE two directories up from
# itself (player/src/config.js -> app root), same pattern as
# admin/src/config.js, so this container must keep media/ and devices/ as
# siblings of player/ under /var/www/html - same layout the old nginx image
# used, so the existing docker-compose.yml mount paths for media/ stay
# unchanged (devices/ is a new mount, see docker-compose.yml).
WORKDIR /var/www/html/player

COPY player/package.json player/package-lock.json* ./
RUN npm install --omit=dev

COPY player/ ./

# Default directories in case the container ever runs without the bind
# mounts (e.g. local testing) - when mounted, the host paths take over.
RUN mkdir -p /var/www/html/media /var/www/html/devices /var/www/html/heartbeats

EXPOSE 80

CMD ["node", "server.js"]
