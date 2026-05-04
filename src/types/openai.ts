import { z } from 'zod';
import { ModelIdSchema } from './pricing.js';

export const RoleSchema = z.enum(['system', 'user', 'assistant', 'tool', 'developer']);
export type Role = z.infer<typeof RoleSchema>;

export const ContentPartSchema = z
  .object({
    type: z.string().min(1),
  })
  .passthrough();
export type ContentPart = z.infer<typeof ContentPartSchema>;

export const ContentPartArraySchema = z.array(ContentPartSchema).min(1);
export type ContentPartArray = z.infer<typeof ContentPartArraySchema>;

export const MessageContentSchema = z.union([z.string(), ContentPartArraySchema]);
export type MessageContent = z.infer<typeof MessageContentSchema>;

const ToolFunctionSchema = z
  .object({
    name: z.string().min(1),
    arguments: z.string(),
  })
  .passthrough();

export const ToolCallSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal('function'),
    function: ToolFunctionSchema,
  })
  .passthrough();
export type ToolCall = z.infer<typeof ToolCallSchema>;

const ToolCallDeltaSchema = z
  .object({
    index: z.number().int().nonnegative().optional(),
    id: z.string().min(1).optional(),
    type: z.string().min(1).optional(),
    function: z
      .object({
        name: z.string().min(1).optional(),
        arguments: z.string().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();
export type ToolCallDelta = z.infer<typeof ToolCallDeltaSchema>;

const BaseMessageSchema = z
  .object({
    name: z.string().optional(),
  })
  .passthrough();

const SystemMessageSchema = BaseMessageSchema.extend({
  role: z.literal('system'),
  content: MessageContentSchema,
});

const DeveloperMessageSchema = BaseMessageSchema.extend({
  role: z.literal('developer'),
  content: MessageContentSchema,
});

const UserMessageSchema = BaseMessageSchema.extend({
  role: z.literal('user'),
  content: MessageContentSchema,
});

const AssistantMessageSchema = BaseMessageSchema.extend({
  role: z.literal('assistant'),
  content: MessageContentSchema.nullish(),
  refusal: z.string().nullable().optional(),
  tool_calls: z.array(ToolCallSchema).optional(),
}).superRefine((value, ctx) => {
  if (
    value.content == null &&
    (value.tool_calls == null || value.tool_calls.length === 0) &&
    value.refusal == null
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['content'],
      message: 'assistant message requires content, tool_calls, or refusal',
    });
  }
});

const ToolMessageSchema = BaseMessageSchema.extend({
  role: z.literal('tool'),
  content: MessageContentSchema,
  tool_call_id: z.string().min(1),
});

export const MessageSchema = z.union([
  SystemMessageSchema,
  DeveloperMessageSchema,
  UserMessageSchema,
  AssistantMessageSchema,
  ToolMessageSchema,
]);
export type Message = z.infer<typeof MessageSchema>;

export const UsageSchema = z.object({
  prompt_tokens: z.number().int().nonnegative(),
  completion_tokens: z.number().int().nonnegative(),
  total_tokens: z.number().int().nonnegative(),
});
export type Usage = z.infer<typeof UsageSchema>;

export const StreamOptionsSchema = z.object({
  include_usage: z.boolean().optional(),
});
export type StreamOptions = z.infer<typeof StreamOptionsSchema>;

export const ChatCompletionRequestSchema = z
  .object({
    model: ModelIdSchema,
    messages: z.array(MessageSchema).min(1),
    max_tokens: z.number().int().positive().optional(),
    temperature: z.number().min(0).max(2).optional(),
    top_p: z.number().min(0).max(1).optional(),
    n: z.number().int().positive().optional(),
    stream: z.boolean().optional(),
    stream_options: StreamOptionsSchema.optional(),
    stop: z.union([z.string(), z.array(z.string()).max(4)]).optional(),
    presence_penalty: z.number().min(-2).max(2).optional(),
    frequency_penalty: z.number().min(-2).max(2).optional(),
    user: z.string().optional(),
    tools: z.array(z.unknown()).optional(),
    tool_choice: z.unknown().optional(),
    parallel_tool_calls: z.boolean().optional(),
    response_format: z.unknown().optional(),
    logprobs: z.boolean().optional(),
    top_logprobs: z.number().int().min(0).max(20).optional(),
    seed: z.number().int().optional(),
  })
  .passthrough();
export type ChatCompletionRequest = z.infer<typeof ChatCompletionRequestSchema>;

export const FinishReasonSchema = z.enum(['stop', 'length', 'content_filter', 'tool_calls']);
export type FinishReason = z.infer<typeof FinishReasonSchema>;

export const AssistantResponseMessageSchema = AssistantMessageSchema;
export type AssistantResponseMessage = z.infer<typeof AssistantResponseMessageSchema>;

export const ChatCompletionChoiceSchema = z
  .object({
    index: z.number().int().nonnegative(),
    message: AssistantResponseMessageSchema,
    finish_reason: FinishReasonSchema.nullable(),
  })
  .passthrough();
export type ChatCompletionChoice = z.infer<typeof ChatCompletionChoiceSchema>;

export const ChatCompletionResponseSchema = z
  .object({
    id: z.string().min(1),
    object: z.literal('chat.completion'),
    created: z.number().int().nonnegative(),
    model: ModelIdSchema,
    choices: z.array(ChatCompletionChoiceSchema).min(1),
    usage: UsageSchema,
  })
  .passthrough();
export type ChatCompletionResponse = z.infer<typeof ChatCompletionResponseSchema>;

export const ChatCompletionChunkDeltaSchema = z
  .object({
    role: RoleSchema.optional(),
    content: z.string().nullable().optional(),
    refusal: z.string().nullable().optional(),
    tool_calls: z.array(ToolCallDeltaSchema).optional(),
  })
  .passthrough();
export type ChatCompletionChunkDelta = z.infer<typeof ChatCompletionChunkDeltaSchema>;

export const ChatCompletionChunkChoiceSchema = z
  .object({
    index: z.number().int().nonnegative(),
    delta: ChatCompletionChunkDeltaSchema,
    finish_reason: FinishReasonSchema.nullable(),
  })
  .passthrough();
export type ChatCompletionChunkChoice = z.infer<typeof ChatCompletionChunkChoiceSchema>;

export const ChatCompletionChunkSchema = z
  .object({
    id: z.string().min(1),
    object: z.literal('chat.completion.chunk'),
    created: z.number().int().nonnegative(),
    model: ModelIdSchema,
    choices: z.array(ChatCompletionChunkChoiceSchema),
    usage: UsageSchema.nullish(),
  })
  .passthrough();
export type ChatCompletionChunk = z.infer<typeof ChatCompletionChunkSchema>;

export function contentToAuditText(content: MessageContent | null | undefined): string {
  if (content == null) return '';
  if (typeof content === 'string') return content;
  return content
    .map((part) => {
      if (typeof part.text === 'string') return part.text;
      if (typeof part.refusal === 'string') return part.refusal;
      try {
        return JSON.stringify(part);
      } catch {
        return '';
      }
    })
    .filter((part) => part.length > 0)
    .join(' ');
}

export function toolCallsToAuditText(toolCalls: readonly ToolCall[] | undefined): string {
  if (!toolCalls || toolCalls.length === 0) return '';
  return toolCalls
    .map((toolCall) => {
      try {
        return JSON.stringify(toolCall);
      } catch {
        return '';
      }
    })
    .filter((entry) => entry.length > 0)
    .join(' ');
}

export function messageToAuditText(message: Message | AssistantResponseMessage): string {
  const parts = [contentToAuditText(message.content)];
  if ('tool_call_id' in message && typeof message.tool_call_id === 'string') {
    parts.push(message.tool_call_id);
  }
  if ('tool_calls' in message && Array.isArray(message.tool_calls)) {
    parts.push(toolCallsToAuditText(message.tool_calls));
  }
  return parts.filter((part) => part.length > 0).join(' ');
}

export function chunkDeltaToAuditText(delta: ChatCompletionChunkDelta): string {
  const parts: string[] = [];
  if (typeof delta.content === 'string' && delta.content.length > 0) {
    parts.push(delta.content);
  }
  if (typeof delta.refusal === 'string' && delta.refusal.length > 0) {
    parts.push(delta.refusal);
  }
  if (delta.tool_calls && delta.tool_calls.length > 0) {
    for (const toolCall of delta.tool_calls) {
      try {
        parts.push(JSON.stringify(toolCall));
      } catch {
        // ignore malformed tool-call delta payloads in audit text only
      }
    }
  }
  return parts.join(' ');
}
