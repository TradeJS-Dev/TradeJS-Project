# TradeJS-Project

The personal TradeJS project and production runtime image for `app.tradejs.dev`.
It is the explicit layer between the published TradeJS engine/packages and
`TradeJS-Deploy`.

This repository was created with the real public generator:

```bash
npx create-tradejs@latest TradeJS-Project --no-install
```

The generated project was then extended with production ownership; it was not
recreated as a monorepo clone.

## Ownership

- `tradejs.config.ts` — installed presets and private/public strategy packages.
- `package.json` and `yarn.lock` — exact TradeJS package composition.
- `deploy/runtime.env` — secret-free production application settings.
- `Dockerfile`, `entrypoint.sh`, and `cronjob` — runtime app image and process
  supervision.
- `.github/workflows/publish.yml` — image publication and immutable dispatch to
  `TradeJS-Deploy`.

`TradeJS` owns the framework packages and ML inference implementation.
`TradeJS-Deploy` owns Compose, SSH, TLS, persistent volumes, and server
lifecycle. Backtest/research artifacts live under this project's ignored
`data/` directory, not in the engine repository.

`deploy/runtime.env` contains only secret-free application defaults. Deploy
injects `PG_PASSWORD`, authentication secrets, exchange/API credentials, and
other production-only secrets when it writes the container environment file.

## Local setup

```bash
cp .env.example .env
yarn install --immutable
yarn infra-up
yarn dev
```

Open <http://localhost:3000/routes/dashboard>. The checked-in `.env.example`
contains names and safe local defaults only; replace all secret placeholders in
the ignored `.env`.

## Verification

```bash
yarn checks
docker build --check .
```

## Production handoff

A successful push to `main` publishes
`ghcr.io/tradejs-dev/tradejs-project-app:<commit-sha>` and dispatches that exact
SHA to `TradeJS-Deploy`. The project workflow needs only the cross-repository
`DEPLOY_REPOSITORY_TOKEN`; application and server secrets remain in Deploy.
