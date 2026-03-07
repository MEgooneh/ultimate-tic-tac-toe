FROM node:24-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.client.json ./
COPY server/ ./server/
COPY client/ ./client/

RUN mkdir -p public/js && npx tsc && npx tsc -p tsconfig.client.json

FROM node:24-slim

RUN groupadd --system app && useradd --system --gid app app

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist/ ./dist/
COPY public/ ./public/
COPY --from=builder /app/public/js/ ./public/js/

RUN mkdir -p /app/data && chown -R app:app /app/data

USER app

ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/data/uttt.db

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s \
  CMD node -e "require('http').get('http://localhost:3000/api/health',r=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"

CMD ["node", "dist/index.js"]
