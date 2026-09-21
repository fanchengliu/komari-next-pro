FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY apps/extension apps/extension
COPY packages packages
RUN mkdir -p /data && chown node:node /data
USER node
ENV DS_BIND=0.0.0.0 DS_PORT=5175 DS_DATA_DIR=/data DS_FFMPEG=/usr/bin/ffmpeg
EXPOSE 5175
CMD ["node", "--import", "tsx", "apps/extension/src/main.ts"]
