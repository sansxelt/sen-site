# Vraelis Preflight worker (Railway). Long-running claim loop; drives an isolated Browserbase browser over
# CDP, so NO local Chromium binary is needed (Browserbase hosts the browser) — only playwright-core to
# connect + the Browserbase SDK. Runs from the repo root so it can import lib/ + worker/.
FROM node:24-slim

WORKDIR /app
# Install the app deps (the worker imports shared lib/ + @supabase/supabase-js) plus the two worker-only
# runtime deps that the web app deliberately doesn't carry.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev || npm install --omit=dev
RUN npm install --no-save playwright-core @browserbasehq/sdk tsx

COPY . .

ENV NODE_ENV=production
# PORT is provided by Railway for the /health endpoint.
CMD ["npx", "tsx", "worker/preflight/index.ts"]
