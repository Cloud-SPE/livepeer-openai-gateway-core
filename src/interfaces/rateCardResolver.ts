// Operator-supplied rate-card snapshot. Engine ships the interface; the
// shell consumer (or tests) supplies a backing implementation — DB, env,
// in-memory fixture, etc. See examples/rateCards/inMemoryRateCardResolver.ts
// for the test fixture and the minimal-shell wiring.
//
// Why a snapshot rather than per-method async lookups: the dispatch hot
// path resolves pricing several times per request (estimate → reserve →
// commit). Sync getter-from-snapshot keeps that path microsecond-fast.
// The shell refreshes the snapshot in the background (TTL) and on every
// admin write (cache-bust). Operators who don't need refresh-without-
// restart can return a static snapshot and never invalidate.

import type {
  ChatRateCard,
  EmbeddingsRateCard,
  EmbeddingsRateCardEntry,
  ImageQuality,
  ImageSize,
  ImagesRateCard,
  ImagesRateCardEntry,
  PricingTier,
  SpeechRateCard,
  SpeechRateCardEntry,
  TranscriptionsRateCard,
  TranscriptionsRateCardEntry,
} from '../types/pricing.js';

/** Rule-shaped pattern entries for each capability. Patterns use glob
 * syntax with `*` and `?` wildcards (no regex). Resolution order is
 * exact → patterns by `sortOrder` ascending → null. First hit wins. */
export interface ChatModelTierPattern {
  pattern: string;
  tier: PricingTier;
  sortOrder: number;
}

export interface EmbeddingsRatePattern {
  pattern: string;
  entry: EmbeddingsRateCardEntry;
  sortOrder: number;
}

export interface ImagesRatePattern {
  /** Glob applied to the model field. Size + quality stay exact match. */
  pattern: string;
  size: ImageSize;
  quality: ImageQuality;
  entry: ImagesRateCardEntry;
  sortOrder: number;
}

export interface SpeechRatePattern {
  pattern: string;
  entry: SpeechRateCardEntry;
  sortOrder: number;
}

export interface TranscriptionsRatePattern {
  pattern: string;
  entry: TranscriptionsRateCardEntry;
  sortOrder: number;
}

/** Full rate-card snapshot. Stable POJO — safe to share across the
 * engine without risk of mutation during a request. */
export interface RateCardSnapshot {
  chatRateCard: ChatRateCard;
  embeddingsRateCard: EmbeddingsRateCard;
  imagesRateCard: ImagesRateCard;
  speechRateCard: SpeechRateCard;
  transcriptionsRateCard: TranscriptionsRateCard;

  modelToTierExact: ReadonlyMap<string, PricingTier>;
  modelToTierPatterns: ReadonlyArray<ChatModelTierPattern>;
  embeddingsPatterns: ReadonlyArray<EmbeddingsRatePattern>;
  imagesPatterns: ReadonlyArray<ImagesRatePattern>;
  speechPatterns: ReadonlyArray<SpeechRatePattern>;
  transcriptionsPatterns: ReadonlyArray<TranscriptionsRatePattern>;
}

/** Operator-injected resolver. Hot-path sync; refresh is the operator's
 * concern (TTL, cache-bust, no-op for static deployments). */
export interface RateCardResolver {
  current(): RateCardSnapshot;
}
