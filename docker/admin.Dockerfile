FROM node:20-alpine

# admin/ is a Node/Express app (see admin/server.js). src/config.js resolves
# MEDIA_DIR/DATA_DIR as two levels up from itself (admin/src/config.js -> repo
# root), same as the source tree - so the container keeps media/ and data/ as
# siblings of admin/, at the exact same /var/www/html/media and
# /var/www/html/data paths the old PHP image used. This means the existing
# docker-compose.yml (local and production) needs no volume-path changes.
WORKDIR /var/www/html/admin

COPY admin/package.json admin/package-lock.json* ./
RUN npm install --omit=dev

COPY admin/ ./

# Default directories in case the container ever runs without the bind
# mounts (e.g. local testing) - when mounted, the host paths take over.
RUN mkdir -p /var/www/html/media /var/www/html/data /var/www/html/devices /var/www/html/heartbeats

EXPOSE 80

CMD ["node", "server.js"]
