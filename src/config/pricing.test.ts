import { describe, expect, it } from 'vitest';
import { createPricingConfig, loadPricingEnvConfig } from './pricing.js';
import { rateForTier } from '../service/pricing/rateCardLookup.js';
import { TEST_RATE_CARD_SNAPSHOT, TEST_ENV_CONFIG } from '../service/pricing/testFixtures.js';

describe('pricing config', () => {
  it('createPricingConfig builds a complete snapshot from the rate-card snapshot + env', () => {
    const cfg = createPricingConfig(TEST_RATE_CARD_SNAPSHOT, TEST_ENV_CONFIG);
    expect(cfg.rateCard.entries).toHaveLength(4);
    const starter = rateForTier(cfg.rateCard, 'starter');
    expect(starter.inputUsdPerMillion).toBe(0.05);
    expect(starter.outputUsdPerMillion).toBe(0.1);
    const pro = rateForTier(cfg.rateCard, 'pro');
    expect(pro.outputUsdPerMillion).toBe(1.2);
    const premium = rateForTier(cfg.rateCard, 'premium');
    expect(premium.inputUsdPerMillion).toBe(2.5);
    expect(premium.outputUsdPerMillion).toBe(6.0);
  });

  it('exposes the exact model→tier map from the snapshot', () => {
    const cfg = createPricingConfig(TEST_RATE_CARD_SNAPSHOT, TEST_ENV_CONFIG);
    expect(cfg.modelToTier.get('model-small')).toBe('starter');
    expect(cfg.modelToTier.get('model-medium')).toBe('standard');
    expect(cfg.modelToTier.get('model-large')).toBe('pro');
    expect(cfg.modelToTier.get('model-premium')).toBe('premium');
  });

  it('loadPricingEnvConfig applies env overrides for default max tokens', () => {
    const env = loadPricingEnvConfig({
      PRICING_DEFAULT_MAX_TOKENS_FREE: '512',
      PRICING_DEFAULT_MAX_TOKENS_PREPAID: '2048',
    } as NodeJS.ProcessEnv);
    expect(env.defaultMaxTokensFree).toBe(512);
    expect(env.defaultMaxTokensPrepaid).toBe(2048);
  });

  it('falls back to defaults when env is empty', () => {
    const env = loadPricingEnvConfig({} as NodeJS.ProcessEnv);
    expect(env.defaultMaxTokensFree).toBe(1024);
    expect(env.defaultMaxTokensPrepaid).toBe(4096);
  });
});
