# Ultimate Tic-Tac-Toe

Ultimate Tic-Tac-Toe — play online with friends or locally on the same device.

## Features

- **Local play** — two players, one device, pass and play
- **Online multiplayer** — real-time via WebSocket, share a code or link
- No accounts — just pick a name and play
- Rematch support (both modes)
- Mobile-friendly
- Self-hostable, single container
- All games (local and online) logged in the database

## Run locally

Requires Node.js 22+ (24 recommended).

```sh
npm install
npm run build
npm start
```

Open `http://localhost:3000`.

## Deploy with Docker

```sh
docker build -t uttt .
docker run -d -p 3000:3000 -v uttt-data:/app/data uttt
```

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Server port |
| `DB_PATH` | `./data/uttt.db` | SQLite database path |
| `DOMAIN` | `localhost` | Public domain |
| `RETENTION_HOURS` | `72` | Delete finished games older than this |
| `MAX_GAMES_PER_IP` | `10` | Rate limit: max game creates per minute per IP |
| `TRUST_PROXY` | `false` | Set to `true` behind a reverse proxy |

## Self-hosting notes

The server is designed to run unattended with minimal maintenance.

**Rate limiting** — In-memory per-IP rate limits protect against abuse. Game creation is capped at `MAX_GAMES_PER_IP` requests per minute per IP (default 10). API reads are limited to 30/min. WebSocket messages are capped at 10/sec per connection. Set `TRUST_PROXY=true` if behind a reverse proxy so the real client IP is used.

**Data retention** — Finished, expired, and abandoned games are automatically deleted after `RETENTION_HOURS` (default 72). The cleanup job runs once per hour and also on startup. Waiting games that receive no opponent expire after 10 minutes and are cleaned up every 60 seconds.

**Storage** — All data lives in a single SQLite file at `DB_PATH`. Mount a Docker volume at `/app/data` to persist it across container restarts. The database stays small thanks to automatic retention.

**Health check** — `GET /api/health` returns `200` with `{ status: "ok" }`. The Docker image includes a built-in `HEALTHCHECK` using this endpoint.

## License

MIT
