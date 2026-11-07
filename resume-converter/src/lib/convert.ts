import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { SYSTEM_PROMPT, buildUserMessage } from "./prompt";
import { ResumeResultSchema, type ResumeResult } from "./schema";

export const DEFAULT_MODEL = "claude-opus-5-5";

export function getModel(): string {
  return process.env.CLAUDE_MODEL || DEFAULT_MODEL;
}

export type ConvertOutput = { result: ResumeResult; inputTokens: number; outputTokens: number };

/** Minimal surface of the SDK that we use, so tests can inject a fake. */
export type MessagesParser = {
  messages: { parse: (params: any) => Promise<any> };
};

let cached: Anthropic | null = null;
function defaultClient(): MessagesParser {
  if (!cached) cached = new Anthropic({ maxRetries: 2 });
  return cached as unknown as MessagesParser;
}

export async function convertResume(
  resume: string,
  announcement: string,
  client: MessagesParser = defaultClient(),
): Promise<ConvertOutput> {
  const response = await client.messages.parse({
    model: getModel(),
    // Output is a few thousand tokens; this caps cost per job.
    max_tokens: 16000,
    // Static system prompt first so the prefix can be cached across requests.
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: buildUserMessage(resume, announcement) }],
    output_config: { effort: "medium", format: zodOutputFormat(ResumeResultSchema) },
  });

  if (response.stop_reason === "refusal") {
    throw new ConvertError("The model declined to process this input.");
  }
  if (response.stop_reason === "max_tokens") {
    throw new ConvertError("The result was too long to complete. Try a shorter resume.");
  }
  if (!response.parsed_output) {
    throw new ConvertError("The model returned an unreadable result.");
  }

  return {
    result: response.parsed_output as ResumeResult,
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
  };
}

export class ConvertError extends Error {}

/** Message safe to show to a user (never leaks API details). */
export function publicErrorMessage(err: unknown): string {
  if (err instanceof ConvertError) return err.message;
  return "Something went wrong generating your resume. Your credit has been refunded.";
}
