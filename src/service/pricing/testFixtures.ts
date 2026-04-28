// Test fixtures for the pricing layer. Pre-engine-0.2.0 these values
// were the engine's hardcoded defaults; now they live here as test-only
// data and as the seed source for the operator-managed rate card on the
// shell side. Production deployments inject their own RateCardResolver.

import type { PricingConfig, PricingConfigProvider } from '../../config/pricing.js';
import { createPricingConfig } from '../../config/pricing.js';
import type { RateCardSnapshot } from '../../interfaces/rateCardResolver.js';

/** V2 (2026-04-25) tier prices used for engine tests + as the shell's
 * seed-migration values. Operators edit these via the admin SPA in
 * production. */
export const TEST_RATE_CARD_SNAPSHOT: RateCardSnapshot = {
  chatRateCard: {
    version: 'v2-2026-04-25',
    effectiveAt: new Date('2026-04-25T00:00:00Z'),
    entries: [
      { tier: 'starter', inputUsdPerMillion: 0.05, outputUsdPerMillion: 0.1 },
      { tier: 'standard', inputUsdPerMillion: 0.15, outputUsdPerMillion: 0.4 },
      { tier: 'pro', inputUsdPerMillion: 0.4, outputUsdPerMillion: 1.2 },
      { tier: 'premium', inputUsdPerMillion: 2.5, outputUsdPerMillion: 6.0 },
    ],
  },
  embeddingsRateCard: {
    version: 'v2-2026-04-25',
    effectiveAt: new Date('2026-04-25T00:00:00Z'),
    entries: [
      { model: 'text-embedding-3-small', usdPerMillionTokens: 0.005 },
      { model: 'text-embedding-3-large', usdPerMillionTokens: 0.05 },
      { model: 'text-embedding-bge-m3', usdPerMillionTokens: 0.005 },
    ],
  },
  imagesRateCard: {
    version: 'v2-2026-04-25',
    effectiveAt: new Date('2026-04-25T00:00:00Z'),
    entries: [
      { model: 'dall-e-3', size: '1024x1024', quality: 'standard', usdPerImage: 0.025 },
      { model: 'dall-e-3', size: '1024x1024', quality: 'hd', usdPerImage: 0.05 },
      { model: 'dall-e-3', size: '1024x1792', quality: 'standard', usdPerImage: 0.04 },
      { model: 'dall-e-3', size: '1024x1792', quality: 'hd', usdPerImage: 0.075 },
      { model: 'dall-e-3', size: '1792x1024', quality: 'standard', usdPerImage: 0.04 },
      { model: 'dall-e-3', size: '1792x1024', quality: 'hd', usdPerImage: 0.075 },
      { model: 'sdxl', size: '1024x1024', quality: 'standard', usdPerImage: 0.002 },
    ],
  },
  speechRateCard: {
    version: 'v2-2026-04-25',
    effectiveAt: new Date('2026-04-25T00:00:00Z'),
    entries: [
      { model: 'tts-1', usdPerMillionChars: 5.0 },
      { model: 'tts-1-hd', usdPerMillionChars: 12.0 },
      { model: 'kokoro', usdPerMillionChars: 1.0 },
    ],
  },
  transcriptionsRateCard: {
    version: 'v2-2026-04-25',
    effectiveAt: new Date('2026-04-25T00:00:00Z'),
    entries: [{ model: 'whisper-1', usdPerMinute: 0.003 }],
  },
  modelToTierExact: new Map<string, 'starter' | 'standard' | 'pro' | 'premium'>([
    ['model-small', 'starter'],
    ['model-medium', 'standard'],
    ['model-large', 'pro'],
    ['model-premium', 'premium'],
    ['gemma4:26b', 'starter'],
  ]),
  modelToTierPatterns: [],
  embeddingsPatterns: [],
  imagesPatterns: [],
  speechPatterns: [],
  transcriptionsPatterns: [],
};

export const TEST_ENV_CONFIG = {
  defaultMaxTokensPrepaid: 4096,
  defaultMaxTokensFree: 1024,
};

/** Build a PricingConfig from the test snapshot. */
export function testPricingConfig(): PricingConfig {
  return createPricingConfig(TEST_RATE_CARD_SNAPSHOT, TEST_ENV_CONFIG);
}

/** Wrap a static PricingConfig as a provider for tests. */
export function staticProvider(config: PricingConfig): PricingConfigProvider {
  return { current: () => config };
}

/** One-shot: get a PricingConfigProvider seeded with the test snapshot. */
export function testPricingProvider(): PricingConfigProvider {
  return staticProvider(testPricingConfig());
}
