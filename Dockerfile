FROM node:24-alpine

RUN addgroup -S app && adduser -S app -G app

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server/ ./server/
COPY public/ ./public/

RUN mkdir -p /app/data && chown -R app:app /app/data

USER app

ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/data/uttt.db

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "server/index.js"]
