# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
post-1.0.

## [Unreleased]

## [0.2.0] - 2026-04-28

### BREAKING

- **`V1_RATE_CARD` / `V1_MODEL_TO_TIER` removed.** The hardcoded rate
  cards and model→tier map that shipped in 0.1.x are gone. Consumers
  must inject a `RateCardResolver` adapter (parallel to `Wallet`,
  `AuthResolver`). See `src/interfaces/rateCardResolver.ts`.
- **Dispatcher `pricing` deps changed shape.** Every dispatcher and
  route-registration deps that previously took `pricing: PricingConfig`
  now takes `pricing: PricingConfigProvider` (`{ current(): PricingConfig }`).
  Wrap a static config with `{ current: () => config }` for
  same-as-before behavior; the provider shape lets shells swap in
  live-refreshing snapshots without restart.
- **`defaultPricingConfig()` / `loadPricingConfig()` removed.** Replaced
  by `loadPricingEnvConfig()` (non-rate-card env knobs only) +
  `createPricingConfig(snapshot, env)` builder. Operators combine a
  `RateCardSnapshot` from their resolver with env config to build a
  `PricingConfig`.

### Added

- `RateCardResolver` interface and `RateCardSnapshot` type covering
  all 5 capability rate cards plus pattern overlays per category.
- Pattern-aware lookup helpers (`resolveChatTier`, `resolveEmbeddingsRate`,
  `resolveImagesRate`, `resolveSpeechRate`, `resolveTranscriptionsRate`)
  in `service/pricing/rateCardLookup.ts`. Resolution order is
  exact-match → patterns by `sortOrder` ascending → null.
- Glob matcher (`service/pricing/glob.ts`) — `*` and `?` wildcards,
  no regex. Compiled patterns cached process-lifetime.
- `createPricingConfigProvider(resolver, env)` helper — composes a
  resolver + env config into a `PricingConfigProvider`.
- `service/pricing/testFixtures.ts` — engine test fixtures (the v2
  rate card data that was previously hardcoded). Shell consumers ship
  their own seed migration; engine ships these only as test fixtures.

### Changed

- All pricing-service helpers (`estimateReservation`,
  `computeActualCost`, `estimateEmbeddingsReservation`, etc.) now take
  `provider: PricingConfigProvider` instead of `config: PricingConfig`.
  Inside each helper the snapshot is fetched via `provider.current()`.

### Migration guide

Pre-0.2.0 shells:
```ts
import { loadPricingConfig } from '@cloudspe/livepeer-openai-gateway-core/config/pricing.js';
const pricing = loadPricingConfig();
registerChatCompletionsRoute(app, { ..., pricing });
```

0.2.0:
```ts
import {
  createPricingConfigProvider,
  loadPricingEnvConfig,
} from '@cloudspe/livepeer-openai-gateway-core/config/pricing.js';

// Operator-supplied resolver — DB-backed, file-backed, or in-memory.
const resolver: RateCardResolver = createMyRateCardResolver({ db });

const pricing = createPricingConfigProvider(resolver, loadPricingEnvConfig());
registerChatCompletionsRoute(app, { ..., pricing });
```

For tests / quick smoke deployments the engine ships
`TEST_RATE_CARD_SNAPSHOT` in `service/pricing/testFixtures.js`.

## [0.1.0] - 2026-04-27

### Added

- Initial extraction from the `openai-livepeer-bridge` monorepo (now
  `livepeer-openai-gateway`). The engine ships as
  `@cloudspe/livepeer-openai-gateway-core`.
- Adapter interfaces (operator-overridable):
  - `Wallet` (reserve / commit / refund; multi-unit cost via cents +
    wei + estimatedTokens).
  - `AuthResolver` (turns an HTTP `Authorization` header into a
    generic `Caller`).
  - `RateLimiter` (per-caller request gating with a Redis
    sliding-window default impl).
  - `Logger` (structured log sink; `createConsoleLogger` default).
  - `AdminAuthResolver` (admin-token / basic-auth backing for the
    optional operator dashboard).
- Provider interface (engine-internal, not operator-overridable):
  - `ServiceRegistryClient` — gRPC client for
    [`livepeer-modules-project/service-registry-daemon`](https://github.com/livepeer-modules-project/service-registry-daemon).
- Framework-free dispatchers under `@cloudspe/livepeer-openai-gateway-core/dispatch/`:
  chat completions (streaming + non-streaming), embeddings, image
  generations, audio speech, audio transcriptions.
- Fastify adapter at `@cloudspe/livepeer-openai-gateway-core/runtime/http/*`
  registering OpenAI-compatible routes (`/v1/chat/completions`, etc.),
  the auth + rate-limit middleware, the metrics hook, and the
  HTTP-error mapping layer.
- Optional read-only operator dashboard at
  `@cloudspe/livepeer-openai-gateway-core/dashboard` — vanilla server-rendered
  HTML, no client framework or build step.
- `InMemoryWallet` reference implementation for testing
  (`@cloudspe/livepeer-openai-gateway-core/service/billing/inMemoryWallet.js`).
- Hand-rolled migration runner with a `public.bridge_schema_migrations`
  tracker; engine schema in `migrations/0000_engine_init.sql`
  (`engine.node_health`, `engine.node_health_events`,
  `engine.usage_records` keyed by opaque `caller_id` text — no FK
  into shell schemas).
- Prometheus recorder with cardinality-cap protection on every label
  vec; engine metrics under the `livepeer_bridge_*` prefix; build-info
  gauge `livepeer_bridge_engine_build_info`.
- Shell-emitted metrics (Stripe API + webhooks, top-ups, reservations
  gauges) under the `cloudspe_*` prefix; `setShellBuildInfo()` emits
  `cloudspe_app_build_info`.
- `examples/wallets/{postpaid,prepaid-usd,free-quota}.ts` — three
  illustrative Wallet stubs adopters can copy and adapt.
- `examples/minimal-shell/` — runnable example using `InMemoryWallet`
  + a no-op AuthResolver so adopters can clone-and-run in 30 seconds.

[Unreleased]: https://github.com/Cloud-SPE/livepeer-openai-gateway-core/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Cloud-SPE/livepeer-openai-gateway-core/releases/tag/v0.1.0
