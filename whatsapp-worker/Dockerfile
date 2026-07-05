# whatsapp-web.js needs a real Chrome. We previously used Debian's `chromium` apt package, but it's
# a ROLLING version — a rebuild silently picked up Chromium 150, which SIGTRAPs at launch in this
# container (reproduced with a fresh profile + all standard flags). Instead, let puppeteer install
# the Chrome-for-Testing build that EXACTLY matches its own version (pinned via package-lock), plus
# the system libraries it needs. No more rolling-browser breakage on rebuild.
FROM node:20-slim

WORKDIR /app

# Keep the browser inside the image (default cache is $HOME/.cache, which is ephemeral surprise-prone).
ENV PUPPETEER_CACHE_DIR=/app/.chrome

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Chrome-for-Testing matched to the installed puppeteer + its shared-lib deps (--install-deps runs
# apt-get install under the hood, so update the lists first). Fonts for WhatsApp Web rendering.
RUN apt-get update \
    && npx puppeteer browsers install chrome --install-deps \
    && apt-get install -y --no-install-recommends fonts-liberation ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY . .

ENV PORT=8080
EXPOSE 8080
CMD ["npm", "start"]
