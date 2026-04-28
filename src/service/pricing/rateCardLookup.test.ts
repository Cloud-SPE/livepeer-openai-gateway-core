import { describe, expect, it } from 'vitest';
import {
  resolveChatTier,
  resolveEmbeddingsRate,
  resolveImagesRate,
  resolveSpeechRate,
  resolveTranscriptionsRate,
} from './rateCardLookup.js';
import { testPricingConfig } from './testFixtures.js';
import type { PricingConfig } from '../../config/pricing.js';

function withPatterns(overrides: Partial<PricingConfig>): PricingConfig {
  return { ...testPricingConfig(), ...overrides };
}

describe('resolveChatTier', () => {
  it('exact match wins over a pattern', () => {
    const cfg = withPatterns({
      modelToTierPatterns: [{ pattern: '*', tier: 'premium', sortOrder: 100 }],
    });
    // model-small is in the exact map at starter
    expect(resolveChatTier(cfg, 'model-small')).toBe('starter');
  });

  it('falls through to the first matching pattern', () => {
    const cfg = withPatterns({
      modelToTierPatterns: [
        { pattern: 'Qwen3.*', tier: 'standard', sortOrder: 100 },
        { pattern: '*-27B', tier: 'pro', sortOrder: 200 },
      ],
    });
    // Both match, but Qwen3.* has lower sortOrder and should win.
    expect(resolveChatTier(cfg, 'Qwen3.6-27B')).toBe('standard');
  });

  it('returns null when nothing matches', () => {
    const cfg = withPatterns({});
    expect(resolveChatTier(cfg, 'unknown-model')).toBe(null);
  });
});

describe('resolveEmbeddingsRate', () => {
  it('exact match wins over a pattern', () => {
    const cfg = withPatterns({
      embeddingsPatterns: [
        {
          pattern: 'text-embedding-*',
          entry: { model: '*', usdPerMillionTokens: 0.999 },
          sortOrder: 100,
        },
      ],
    });
    const rate = resolveEmbeddingsRate(cfg, 'text-embedding-3-small');
    expect(rate?.usdPerMillionTokens).toBe(0.005); // exact value, not pattern
  });

  it('falls through to pattern when no exact entry', () => {
    const cfg = withPatterns({
      embeddingsPatterns: [
        {
          pattern: 'custom-emb-*',
          entry: { model: '*', usdPerMillionTokens: 0.123 },
          sortOrder: 100,
        },
      ],
    });
    const rate = resolveEmbeddingsRate(cfg, 'custom-emb-xl');
    expect(rate?.usdPerMillionTokens).toBe(0.123);
  });

  it('returns null when nothing matches', () => {
    expect(resolveEmbeddingsRate(testPricingConfig(), 'unknown')).toBe(null);
  });
});

describe('resolveImagesRate', () => {
  it('size + quality stay exact even when model is pattern-matched', () => {
    const cfg = withPatterns({
      imagesPatterns: [
        {
          pattern: 'sdxl-*',
          size: '1024x1024',
          quality: 'standard',
          entry: { model: '*', size: '1024x1024', quality: 'standard', usdPerImage: 0.01 },
          sortOrder: 100,
        },
      ],
    });
    expect(resolveImagesRate(cfg, 'sdxl-turbo', '1024x1024', 'standard')?.usdPerImage).toBe(0.01);
    // Same model but different (size, quality) → no match.
    expect(resolveImagesRate(cfg, 'sdxl-turbo', '1024x1024', 'hd')).toBe(null);
  });

  it('exact entry beats pattern', () => {
    const cfg = withPatterns({
      imagesPatterns: [
        {
          pattern: 'dall-*',
          size: '1024x1024',
          quality: 'standard',
          entry: { model: '*', size: '1024x1024', quality: 'standard', usdPerImage: 1.0 },
          sortOrder: 100,
        },
      ],
    });
    // dall-e-3 1024x1024 standard is in the exact rate card at $0.025
    expect(resolveImagesRate(cfg, 'dall-e-3', '1024x1024', 'standard')?.usdPerImage).toBe(0.025);
  });
});

describe('resolveSpeechRate / resolveTranscriptionsRate', () => {
  it('speech: exact > pattern > null', () => {
    const cfg = withPatterns({
      speechPatterns: [
        {
          pattern: 'kokoro-*',
          entry: { model: '*', usdPerMillionChars: 0.5 },
          sortOrder: 100,
        },
      ],
    });
    expect(resolveSpeechRate(cfg, 'tts-1')?.usdPerMillionChars).toBe(5.0); // exact
    expect(resolveSpeechRate(cfg, 'kokoro-en-v2')?.usdPerMillionChars).toBe(0.5); // pattern
    expect(resolveSpeechRate(cfg, 'unknown')).toBe(null);
  });

  it('transcriptions: exact > pattern > null', () => {
    const cfg = withPatterns({
      transcriptionsPatterns: [
        {
          pattern: 'whisper-*',
          entry: { model: '*', usdPerMinute: 0.005 },
          sortOrder: 100,
        },
      ],
    });
    expect(resolveTranscriptionsRate(cfg, 'whisper-1')?.usdPerMinute).toBe(0.003); // exact
    expect(resolveTranscriptionsRate(cfg, 'whisper-large')?.usdPerMinute).toBe(0.005); // pattern
    expect(resolveTranscriptionsRate(cfg, 'unknown')).toBe(null);
  });
});
