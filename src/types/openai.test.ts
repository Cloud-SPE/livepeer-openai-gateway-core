import { describe, expect, it } from 'vitest';
import {
  ChatCompletionChunkSchema,
  ChatCompletionRequestSchema,
  ChatCompletionResponseSchema,
  chunkDeltaToAuditText,
  contentToAuditText,
  messageToAuditText,
} from './openai.js';

describe('ChatCompletionRequestSchema', () => {
  it('accepts array-form message content and preserves modern request fields', () => {
    const parsed = ChatCompletionRequestSchema.parse({
      model: 'model-small',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'hello' },
            { type: 'image_url', image_url: { url: 'https://example.com/cat.png' } },
          ],
        },
        {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'call_123',
              type: 'function',
              function: { name: 'lookup_weather', arguments: '{"city":"Boston"}' },
            },
          ],
        },
        {
          role: 'tool',
          tool_call_id: 'call_123',
          content: [{ type: 'text', text: '72 and sunny' }],
        },
      ],
      tools: [{ type: 'function', function: { name: 'lookup_weather' } }],
      tool_choice: 'auto',
      response_format: { type: 'json_schema', json_schema: { name: 'reply' } },
    });

    expect(Array.isArray(parsed.messages[0]?.content)).toBe(true);
    expect(parsed.tools).toEqual([{ type: 'function', function: { name: 'lookup_weather' } }]);
    expect(parsed.tool_choice).toBe('auto');
    expect(parsed.response_format).toEqual({ type: 'json_schema', json_schema: { name: 'reply' } });
  });
});

describe('ChatCompletionResponseSchema', () => {
  it('accepts assistant tool calls with null content', () => {
    const parsed = ChatCompletionResponseSchema.parse({
      id: 'chatcmpl-1',
      object: 'chat.completion',
      created: 1,
      model: 'model-small',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: 'call_123',
                type: 'function',
                function: { name: 'lookup_weather', arguments: '{"city":"Boston"}' },
              },
            ],
          },
          finish_reason: 'tool_calls',
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    });

    expect(parsed.choices[0]?.message.tool_calls?.[0]?.function.name).toBe('lookup_weather');
  });
});

describe('ChatCompletionChunkSchema', () => {
  it('accepts tool-call deltas in streaming chunks', () => {
    const parsed = ChatCompletionChunkSchema.parse({
      id: 'chatcmpl-1',
      object: 'chat.completion.chunk',
      created: 1,
      model: 'model-small',
      choices: [
        {
          index: 0,
          delta: {
            role: 'assistant',
            tool_calls: [
              {
                index: 0,
                id: 'call_123',
                type: 'function',
                function: { name: 'lookup_weather', arguments: '{"city":"' },
              },
            ],
          },
          finish_reason: null,
        },
      ],
    });

    expect(parsed.choices[0]?.delta.tool_calls?.[0]?.function?.name).toBe('lookup_weather');
  });
});

describe('OpenAI audit helpers', () => {
  it('derives conservative text from structured content and tool metadata', () => {
    expect(
      contentToAuditText([
        { type: 'text', text: 'hello' },
        { type: 'image_url', image_url: { url: 'https://example.com/cat.png' } },
      ]),
    ).toContain('hello');

    expect(
      messageToAuditText({
        role: 'tool',
        tool_call_id: 'call_123',
        content: [{ type: 'text', text: '72 and sunny' }],
      }),
    ).toContain('call_123');

    expect(
      chunkDeltaToAuditText({
        tool_calls: [
          {
            index: 0,
            function: { name: 'lookup_weather', arguments: '{"city":"Boston"}' },
          },
        ],
      }),
    ).toContain('lookup_weather');
  });
});
