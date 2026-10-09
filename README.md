# wordle-client

Next.js frontend application for real-time multiplayer Wordle.

The application talks to [wordle-server](https://github.com/agravlin/wordle-server), so you need to run the server locally or use another compatible backend to play.

## Running it locally

You need Node and [pnpm](https://pnpm.io).

First, start the server (in another terminal):

```bash
git clone https://github.com/agravlin/wordle-server.git
cd wordle-server
go run ./cmd/server
```

That gives you the server on `:8080`. Then start the client:

```bash
git clone https://github.com/agravlin/wordle-client.git
cd wordle-client
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and you're set.

## Deploying

Build and run it with:

```bash
pnpm build
pnpm start
```

Some things to know:

- `/api/*` requests get proxied to `http://localhost:8080` (see `next.config.ts`). If your backend runs elsewhere or you use a different deployment, update the proxy target accordingly.
- The WebSocket connects to `<current host>:8080` by default. If the server lives somewhere else, set `NEXT_PUBLIC_SERVER_URL` at build time, like `NEXT_PUBLIC_SERVER_URL=https://wordle-api.example.com`.

## Contributing

The core game works, but there are still some improvements I want to make. If you have ideas or want to help out, feel free to open an issue or PR :)