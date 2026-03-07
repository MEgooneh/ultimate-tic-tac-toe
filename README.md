# Ultimate Tic-Tac-Toe

Online multiplayer Ultimate Tic-Tac-Toe. Create a game, share the code, play in real-time.

## Features

- Real-time multiplayer via WebSocket
- No accounts — just pick a name and play
- Share game code or link to invite opponent
- Rematch support
- Mobile-friendly
- Self-hostable, single container

## Run locally

Requires Node.js 22+ (24 recommended).

```sh
npm install
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

## License

MIT
