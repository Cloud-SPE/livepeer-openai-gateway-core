// Pricing configuration. Engine 0.2.0+: rate-card data flows through an
// operator-supplied `RateCardResolver` (see `interfaces/rateCardResolver.ts`).
// This module no longer ships hardcoded rate cards — operators wire their
// own data via the resolver. See examples/rateCards/ for fixtures.
//
// `PricingConfig` is the snapshot shape consumed by the dispatchers and
// pricing service. It's a superset of the rate-card data plus the
// non-rate-card env knobs (default max tokens). `PricingConfigProvider`
// wraps a getter so the snapshot can be live-refreshed without dispatcher
// signature churn.

import { z } from 'zod';
import type {
  ChatRateCard,
  EmbeddingsRateCard,
  ImagesRateCard,
  PricingTier,
  SpeechRateCard,
  TranscriptionsRateCard,
} from '../types/pricing.js';
import type {
  ChatModelTierPattern,
  EmbeddingsRatePattern,
  ImagesRatePattern,
  RateCardResolver,
  RateCardSnapshot,
  SpeechRatePattern,
  TranscriptionsRatePattern,
} from '../interfaces/rateCardResolver.js';

export type { RateCardResolver, RateCardSnapshot } from '../interfaces/rateCardResolver.js';

export interface PricingConfig {
  // Rate-card data (operator-managed; supplied by the resolver).
  rateCard: ChatRateCard;
  embeddingsRateCard: EmbeddingsRateCard;
  imagesRateCard: ImagesRateCard;
  speechRateCard: SpeechRateCard;
  transcriptionsRateCard: TranscriptionsRateCard;

  // Exact model→tier (chat) and per-category pattern overlays. Pattern
  // arrays are pre-sorted by sortOrder ascending.
  modelToTier: Map<string, PricingTier>;
  modelToTierPatterns: ReadonlyArray<ChatModelTierPattern>;
  embeddingsPatterns: ReadonlyArray<EmbeddingsRatePattern>;
  imagesPatterns: ReadonlyArray<ImagesRatePattern>;
  speechPatterns: ReadonlyArray<SpeechRatePattern>;
  transcriptionsPatterns: ReadonlyArray<TranscriptionsRatePattern>;

  // Non-rate-card env config.
  defaultMaxTokensPrepaid: number;
  defaultMaxTokensFree: number;
}

/** Provider returns the current PricingConfig. The shell may refresh the
 * underlying data via TTL or cache-bust on writes; the engine just calls
 * `current()` per request. */
export interface PricingConfigProvider {
  current(): PricingConfig;
}

const EnvSchema = z.object({
  PRICING_DEFAULT_MAX_TOKENS_PREPAID: z.coerce.number().int().positive().default(4096),
  PRICING_DEFAULT_MAX_TOKENS_FREE: z.coerce.number().int().positive().default(1024),
});

export interface PricingEnvConfig {
  defaultMaxTokensPrepaid: number;
  defaultMaxTokensFree: number;
}

/** Load the non-rate-card pricing knobs from env. Operators combine
 * this with a RateCardSnapshot (from their resolver) to build a full
 * PricingConfig. */
export function loadPricingEnvConfig(env: NodeJS.ProcessEnv = process.env): PricingEnvConfig {
  const parsed = EnvSchema.parse(env);
  return {
    defaultMaxTokensPrepaid: parsed.PRICING_DEFAULT_MAX_TOKENS_PREPAID,
    defaultMaxTokensFree: parsed.PRICING_DEFAULT_MAX_TOKENS_FREE,
  };
}

/** Combine a rate-card snapshot with env config into a PricingConfig. */
export function createPricingConfig(
  snapshot: RateCardSnapshot,
  env: PricingEnvConfig,
): PricingConfig {
  return {
    rateCard: snapshot.chatRateCard,
    embeddingsRateCard: snapshot.embeddingsRateCard,
    imagesRateCard: snapshot.imagesRateCard,
    speechRateCard: snapshot.speechRateCard,
    transcriptionsRateCard: snapshot.transcriptionsRateCard,
    modelToTier: new Map(snapshot.modelToTierExact),
    modelToTierPatterns: snapshot.modelToTierPatterns,
    embeddingsPatterns: snapshot.embeddingsPatterns,
    imagesPatterns: snapshot.imagesPatterns,
    speechPatterns: snapshot.speechPatterns,
    transcriptionsPatterns: snapshot.transcriptionsPatterns,
    defaultMaxTokensPrepaid: env.defaultMaxTokensPrepaid,
    defaultMaxTokensFree: env.defaultMaxTokensFree,
  };
}

/** Bridge a RateCardResolver + env config into a PricingConfigProvider.
 * The provider re-builds the PricingConfig on every `current()` call —
 * cheap (O(snapshot size)), and ensures dispatchers see live data
 * within the resolver's freshness window. */
export function createPricingConfigProvider(
  resolver: RateCardResolver,
  env: PricingEnvConfig,
): PricingConfigProvider {
  return {
    current(): PricingConfig {
      return createPricingConfig(resolver.current(), env);
    },
  };
}
