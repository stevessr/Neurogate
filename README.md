# Neurogate

Neurogate can run as the original Node.js/Fastify service or as a native Cloudflare Worker.

## Cloudflare Workers

The Worker entry point is `src/worker.ts`. It keeps the existing public API routes:

- `POST /v1/get_token`
- `POST /v1/translations/:sourceLanguage/:targetLanguage`
- `GET /health`

### Workers AI

`wrangler.toml` binds Workers AI as `AI`. When deployed to your Cloudflare account, Neurogate calls `env.AI.run(...)` directly, so no Cloudflare account ID or API token is required inside the Worker.

The default model is:

```text
@cf/meta/llama-3.1-8b-instruct-fast
```

Override the fallback list with a semicolon-separated Worker variable:

```toml
[vars]
WORKERS_AI_MODELS = "@cf/meta/llama-3.1-8b-instruct-fast;another-model"
```

Translation order on Workers is:

1. Cloudflare Workers AI (`AI` binding)
2. OpenAI-compatible endpoint, if configured
3. Mozhi/Google instances, if configured

### PostgreSQL / Hyperdrive

For development you can provide `DATABASE_URL` as a Worker secret:

```bash
npx wrangler secret put DATABASE_URL
```

For production, Hyperdrive is recommended. Create the configuration:

```bash
npx wrangler hyperdrive create neurogate-db \
  --connection-string="postgresql://USER:PASSWORD@HOST:5432/DATABASE"
```

Then add the generated ID to `wrangler.toml`:

```toml
[[hyperdrive]]
binding = "HYPERDRIVE"
id = "YOUR_HYPERDRIVE_CONFIG_ID"
```

When `HYPERDRIVE` is present it takes precedence over `DATABASE_URL`.

### Database migration

Apply Prisma migrations before deploying a fresh database:

```bash
npx prisma migrate deploy
```

The repository includes the missing `user_consents` model used by the translation Terms-of-Use check.

### Local development and deployment

```bash
npm ci
npm run cf:dev
```

Dry-run the Worker bundle:

```bash
npm run cf:check
```

Deploy to the Cloudflare account authenticated by Wrangler:

```bash
npm run cf:deploy
```

After deployment, `/health` reports whether the Workers AI binding and database configuration are visible to the Worker without exposing secrets.

## Node.js

The existing Fastify entry point remains unchanged:

```bash
npm run build
npm start
```

The Node.js service can continue using the existing `.env` configuration.
