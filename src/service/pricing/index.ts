// Pricing-service helpers. Each takes a `PricingConfigProvider` so the
// snapshot is fetched per call — supports operator live-edits without
// dispatcher restart. The provider getter is sync and cheap (returns
// the cached snapshot); pattern matching happens in `rateCardLookup.ts`.

import type { PricingConfig, PricingConfigProvider } from '../../config/pricing.js';
import type { CustomerTier } from '../../types/tier.js';
import type { ChatCompletionRequest, Usage } from '../../types/openai.js';
import type { ImageQuality, ImageSize, PricingTier } from '../../types/pricing.js';
import {
  rateForTier,
  resolveChatTier,
  resolveEmbeddingsRate,
  resolveImagesRate,
  resolveSpeechRate,
  resolveTranscriptionsRate,
} from './rateCardLookup.js';
import { ModelNotFoundError } from '../routing/errors.js';
import type { TokenAuditService } from '../tokenAudit/index.js';

const MILLION = 1_000_000n;

/** Resolve `model → tier` for chat, throwing on miss. */
export function resolveTierForModel(
  provider: PricingConfigProvider,
  model: string,
): PricingTier {
  const tier = resolveChatTier(provider.current(), model);
  if (!tier) throw new ModelNotFoundError(model);
  return tier;
}

export interface ReservationEstimate {
  estCents: bigint;
  promptEstimateTokens: number;
  maxCompletionTokens: number;
  pricingTier: PricingTier;
}

export function estimateReservation(
  req: ChatCompletionRequest,
  customerTier: CustomerTier,
  provider: PricingConfigProvider,
  tokenAudit?: TokenAuditService,
): ReservationEstimate {
  const config = provider.current();
  const pricingTier = resolveTierOrThrow(config, req.model);
  const rate = rateForTier(config.rateCard, pricingTier);

  const auditedPrompt = tokenAudit?.countPromptTokens(req.model, req.messages) ?? null;
  const promptEstimateTokens =
    auditedPrompt !== null
      ? Math.max(1, auditedPrompt)
      : Math.max(1, Math.ceil(req.messages.reduce((sum, m) => sum + m.content.length, 0) / 3));

  const defaultMax =
    customerTier === 'free' ? config.defaultMaxTokensFree : config.defaultMaxTokensPrepaid;
  const maxCompletionTokens = req.max_tokens ?? defaultMax;

  const estCents = computeCostCents(
    BigInt(promptEstimateTokens),
    BigInt(maxCompletionTokens),
    rate.inputUsdPerMillion,
    rate.outputUsdPerMillion,
  );

  return { estCents, promptEstimateTokens, maxCompletionTokens, pricingTier };
}

export interface ActualCost {
  actualCents: bigint;
  pricingTier: PricingTier;
}

export function computeActualCost(
  usage: Usage,
  customerTier: CustomerTier,
  model: string,
  provider: PricingConfigProvider,
): ActualCost {
  void customerTier;
  const config = provider.current();
  const pricingTier = resolveTierOrThrow(config, model);
  const rate = rateForTier(config.rateCard, pricingTier);
  const actualCents = computeCostCents(
    BigInt(usage.prompt_tokens),
    BigInt(usage.completion_tokens),
    rate.inputUsdPerMillion,
    rate.outputUsdPerMillion,
  );
  return { actualCents, pricingTier };
}

function resolveTierOrThrow(config: PricingConfig, model: string): PricingTier {
  const tier = resolveChatTier(config, model);
  if (!tier) throw new ModelNotFoundError(model);
  return tier;
}

function computeCostCents(
  promptTokens: bigint,
  outputTokens: bigint,
  inputUsdPerMillion: number,
  outputUsdPerMillion: number,
): bigint {
  // micro = micro-cents = ¹⁄₁₀_₀₀₀ of a cent. Sum the micros first,
  // then divide+ceil exactly once — earlier divide-each-side path
  // truncated small amounts to 0 before the ceil could fire.
  const inputCentsPerMillion = BigInt(Math.round(inputUsdPerMillion * 100 * 10_000));
  const outputCentsPerMillion = BigInt(Math.round(outputUsdPerMillion * 100 * 10_000));

  const microPerMillion =
    promptTokens * inputCentsPerMillion + outputTokens * outputCentsPerMillion;

  const denom = MILLION * 10_000n;
  return (microPerMillion + denom - 1n) / denom;
}

export interface EmbeddingsReservationEstimate {
  estCents: bigint;
  promptEstimateTokens: number;
}

export function estimateEmbeddingsReservation(
  inputs: string[],
  model: string,
  provider: PricingConfigProvider,
): EmbeddingsReservationEstimate {
  const config = provider.current();
  const rate = resolveEmbeddingsRate(config, model);
  if (!rate) throw new ModelNotFoundError(model);
  const promptEstimateTokens = Math.max(
    1,
    Math.ceil(inputs.reduce((sum, s) => sum + s.length, 0) / 3),
  );
  const estCents = computeInputOnlyCostCents(
    BigInt(promptEstimateTokens),
    rate.usdPerMillionTokens,
  );
  return { estCents, promptEstimateTokens };
}

export function computeEmbeddingsActualCost(
  promptTokens: number,
  model: string,
  provider: PricingConfigProvider,
): { actualCents: bigint } {
  const config = provider.current();
  const rate = resolveEmbeddingsRate(config, model);
  if (!rate) throw new ModelNotFoundError(model);
  const actualCents = computeInputOnlyCostCents(BigInt(promptTokens), rate.usdPerMillionTokens);
  return { actualCents };
}

function computeInputOnlyCostCents(
  promptTokens: bigint,
  inputUsdPerMillion: number,
): bigint {
  const inputCentsPerMillion = BigInt(Math.round(inputUsdPerMillion * 100 * 10_000));
  const inputMicro = (promptTokens * inputCentsPerMillion) / MILLION;
  return (inputMicro + 9999n) / 10_000n;
}

export interface ImagesReservationEstimate {
  estCents: bigint;
  perImageCents: bigint;
  n: number;
}

export function estimateImagesReservation(
  n: number,
  model: string,
  size: ImageSize,
  quality: ImageQuality,
  provider: PricingConfigProvider,
): ImagesReservationEstimate {
  const config = provider.current();
  const rate = resolveImagesRate(config, model, size, quality);
  if (!rate) throw new ModelNotFoundError(model);
  const perImageCents = computePerImageCents(rate.usdPerImage);
  const estCents = perImageCents * BigInt(n);
  return { estCents, perImageCents, n };
}

export function computeImagesActualCost(
  returnedCount: number,
  model: string,
  size: ImageSize,
  quality: ImageQuality,
  provider: PricingConfigProvider,
): { actualCents: bigint; perImageCents: bigint } {
  const config = provider.current();
  const rate = resolveImagesRate(config, model, size, quality);
  if (!rate) throw new ModelNotFoundError(model);
  const perImageCents = computePerImageCents(rate.usdPerImage);
  const actualCents = perImageCents * BigInt(returnedCount);
  return { actualCents, perImageCents };
}

function computePerImageCents(usdPerImage: number): bigint {
  const micro = BigInt(Math.round(usdPerImage * 100 * 10_000));
  return (micro + 9999n) / 10_000n;
}

export interface SpeechReservationEstimate {
  estCents: bigint;
  charCount: number;
}

export function estimateSpeechReservation(
  inputCharCount: number,
  model: string,
  provider: PricingConfigProvider,
): SpeechReservationEstimate {
  const config = provider.current();
  const rate = resolveSpeechRate(config, model);
  if (!rate) throw new ModelNotFoundError(model);
  const charCount = Math.max(0, inputCharCount);
  const estCents = computePerCharCents(BigInt(charCount), rate.usdPerMillionChars);
  return { estCents, charCount };
}

export function computeSpeechActualCost(
  charsBilled: number,
  model: string,
  provider: PricingConfigProvider,
): { actualCents: bigint } {
  const config = provider.current();
  const rate = resolveSpeechRate(config, model);
  if (!rate) throw new ModelNotFoundError(model);
  const actualCents = computePerCharCents(
    BigInt(Math.max(0, charsBilled)),
    rate.usdPerMillionChars,
  );
  return { actualCents };
}

function computePerCharCents(chars: bigint, usdPerMillion: number): bigint {
  const centsPerMillion = BigInt(Math.round(usdPerMillion * 100 * 10_000));
  const micro = (chars * centsPerMillion) / MILLION;
  return (micro + 9999n) / 10_000n;
}

export interface TranscriptionsReservationEstimate {
  estCents: bigint;
  estimatedSeconds: number;
}

// Worst-case estimate: 64 kbps audio (8 KiB/s). Over-estimates duration
// for higher-bitrate uploads, costing the customer reserve (refunded on
// commit) rather than risking under-charge.
const TRANSCRIPTIONS_BITRATE_BYTES_PER_SEC = 8_000;
const TRANSCRIPTIONS_MAX_RESERVE_SECONDS = 60 * 60;

export function estimateTranscriptionsReservation(
  fileSizeBytes: number,
  model: string,
  provider: PricingConfigProvider,
): TranscriptionsReservationEstimate {
  const config = provider.current();
  const rate = resolveTranscriptionsRate(config, model);
  if (!rate) throw new ModelNotFoundError(model);
  const raw = Math.ceil(Math.max(0, fileSizeBytes) / TRANSCRIPTIONS_BITRATE_BYTES_PER_SEC);
  const estimatedSeconds = Math.max(1, Math.min(raw, TRANSCRIPTIONS_MAX_RESERVE_SECONDS));
  const estCents = computePerSecondCents(estimatedSeconds, rate.usdPerMinute);
  return { estCents, estimatedSeconds };
}

export function computeTranscriptionsActualCost(
  reportedSeconds: number,
  model: string,
  provider: PricingConfigProvider,
): { actualCents: bigint } {
  const config = provider.current();
  const rate = resolveTranscriptionsRate(config, model);
  if (!rate) throw new ModelNotFoundError(model);
  const seconds = Math.max(0, Math.ceil(reportedSeconds));
  const actualCents = computePerSecondCents(seconds, rate.usdPerMinute);
  return { actualCents };
}

function computePerSecondCents(seconds: number, usdPerMinute: number): bigint {
  // cents per minute / 60 = cents per second; ×10_000 keeps micro
  // precision before the round-up.
  const microCentsPerSecond = BigInt(Math.round((usdPerMinute * 100 * 10_000) / 60));
  const micro = BigInt(Math.max(0, seconds)) * microCentsPerSecond;
  return (micro + 9999n) / 10_000n;
}
