// Pattern-aware lookup helpers for the operator-managed rate card.
// Resolution order:
//   1. exact match in the rate-card.entries / modelToTier
//   2. glob-pattern match in the corresponding patterns list
//      (sortOrder ascending; first hit wins)
//   3. null
//
// Caller's responsibility to map null → ModelNotFoundError. This
// module is pure data lookup; HTTP semantics live in the dispatch
// layer.

import type { PricingConfig } from '../../config/pricing.js';
import type {
  ChatRateCardEntry,
  EmbeddingsRateCardEntry,
  ImageQuality,
  ImageSize,
  ImagesRateCardEntry,
  PricingTier,
  SpeechRateCardEntry,
  TranscriptionsRateCardEntry,
} from '../../types/pricing.js';
import { globMatch } from './glob.js';

/** Tier → price entry (for chat). Tier names are fixed in v1; this is a
 * trivial lookup with no patterns. Throws if a registered tier name
 * has no price entry — that's a misconfigured rate card, not a runtime
 * caller error. */
export function rateForTier(
  rateCard: PricingConfig['rateCard'],
  tier: PricingTier,
): ChatRateCardEntry {
  const entry = rateCard.entries.find((e) => e.tier === tier);
  if (!entry) throw new Error(`rate card missing tier price entry: ${tier}`);
  return entry;
}

/** Resolve `model → tier` for chat. Exact map first, then patterns. */
export function resolveChatTier(config: PricingConfig, model: string): PricingTier | null {
  const exact = config.modelToTier.get(model);
  if (exact) return exact;
  for (const p of config.modelToTierPatterns) {
    if (globMatch(p.pattern, model)) return p.tier;
  }
  return null;
}

/** Resolve `model → embeddings rate`. Exact entries first, then patterns. */
export function resolveEmbeddingsRate(
  config: PricingConfig,
  model: string,
): EmbeddingsRateCardEntry | null {
  const exact = config.embeddingsRateCard.entries.find((e) => e.model === model);
  if (exact) return exact;
  for (const p of config.embeddingsPatterns) {
    if (globMatch(p.pattern, model)) return p.entry;
  }
  return null;
}

/** Resolve `(model, size, quality) → images rate`. Pattern matches model
 * only; size + quality stay exact match. */
export function resolveImagesRate(
  config: PricingConfig,
  model: string,
  size: ImageSize,
  quality: ImageQuality,
): ImagesRateCardEntry | null {
  const exact = config.imagesRateCard.entries.find(
    (e) => e.model === model && e.size === size && e.quality === quality,
  );
  if (exact) return exact;
  for (const p of config.imagesPatterns) {
    if (p.size !== size || p.quality !== quality) continue;
    if (globMatch(p.pattern, model)) return p.entry;
  }
  return null;
}

/** Resolve `model → speech rate`. */
export function resolveSpeechRate(
  config: PricingConfig,
  model: string,
): SpeechRateCardEntry | null {
  const exact = config.speechRateCard.entries.find((e) => e.model === model);
  if (exact) return exact;
  for (const p of config.speechPatterns) {
    if (globMatch(p.pattern, model)) return p.entry;
  }
  return null;
}

/** Resolve `model → transcriptions rate`. */
export function resolveTranscriptionsRate(
  config: PricingConfig,
  model: string,
): TranscriptionsRateCardEntry | null {
  const exact = config.transcriptionsRateCard.entries.find((e) => e.model === model);
  if (exact) return exact;
  for (const p of config.transcriptionsPatterns) {
    if (globMatch(p.pattern, model)) return p.entry;
  }
  return null;
}
