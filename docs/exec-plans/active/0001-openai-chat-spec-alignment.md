---
id: 0001
slug: openai-chat-spec-alignment
title: Align chat request and response handling with OpenAI chat spec
status: active
owner: codex
opened: 2026-05-04
---

## Goal

Make the gateway core's `/v1/chat/completions` request, streaming, and response handling conform to the current OpenAI chat schema for content parts and tool-call flows instead of the current legacy string-only model.

## Non-goals

- Implementing every OpenAI endpoint beyond the existing chat surface.
- Full multimodal inference support for workers that do not already support it.
- Preserving silent acceptance of unsupported modern fields.

## Approach

- [ ] Replace the simplified message schema with role-specific OpenAI-shaped schemas that support content parts and tool-call fields.
- [ ] Add normalization helpers so text accounting paths can derive plain text from structured content without flattening the canonical request.
- [ ] Update chat dispatch and streaming logic to handle structured messages and tool-call response/delta shapes.
- [ ] Add explicit unsupported-modality errors for worker paths that cannot handle non-text content parts.
- [ ] Add regression and conformance tests for array-form content, tool-call messages, and streaming deltas.
- [ ] Wire the shell repo to the updated core package and add focused integration tests there.

## Decisions log

### 2026-05-04 — Fix the core package first

Reason: the current non-compliance originates in the shared core schema and dispatch logic. Patching only a shell consumer would leave the same bug in every engine consumer and create mismatched runtime contracts.

## Open questions

- Which non-text content part variants should be structurally accepted immediately beyond `image_url`?
- Whether unsupported modern request fields should be hard-rejected now or modeled and ignored only where the upstream worker lacks support.

## Artifacts produced

- Pending
