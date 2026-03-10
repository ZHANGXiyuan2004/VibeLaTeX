import type { AppConfig, LlmActionRequest, LlmActionResponse } from "@/shared/types";
import { buildActionPrompt } from "@/server/action-prompts";
import { logError } from "@/server/error-log";

interface ChatCompletionChoice {
  message?: {
    content?: string | Array<{ type?: string; text?: string }>;
  };
}

type ChatContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } | string };

interface ChatCompletionPayload {
  model: string;
  messages: Array<{
    role: "system" | "user";
    content: string | ChatContentPart[];
  }>;
  temperature: number;
  response_format: { type: "json_object" };
  stream?: boolean;
  extra_body?: Record<string, unknown>;
}

interface HttpCallResult {
  ok: boolean;
  status: number;
  body: unknown;
  attempt: number;
}

interface StreamCallResult {
  ok: boolean;
  status: number;
  body?: unknown;
  response?: Response;
  attempt: number;
}

const MAX_MINIMAX_IMAGE_BYTES = 5 * 1024 * 1024;

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

export function buildChatCompletionUrl(baseUrl: string): string {
  const normalized = normalizeBaseUrl(baseUrl);

  if (normalized.endsWith("/chat/completions")) {
    return normalized;
  }

  if (/\/v\d+$/.test(normalized)) {
    return `${normalized}/chat/completions`;
  }

  return `${normalized}/v1/chat/completions`;
}

function extractContentText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) =>
        typeof part === "object" && part !== null && "text" in part
          ? String((part as { text?: unknown }).text ?? "")
          : "",
      )
      .join("\n")
      .trim();
  }

  return "";
}

function extractCodeFence(text: string): string | null {
  const match = /```(?:json|latex|tex)?\s*([\s\S]*?)```/i.exec(text);
  return match?.[1]?.trim() ?? null;
}

function extractMathDelimited(text: string): string | null {
  const display = /\\\[([\s\S]*?)\\\]/.exec(text);
  if (display?.[1]) {
    return display[1].trim();
  }

  const dollars = /\$\$([\s\S]*?)\$\$/.exec(text);
  if (dollars?.[1]) {
    return dollars[1].trim();
  }

  const inline = /\$([\s\S]*?)\$/.exec(text);
  if (inline?.[1]) {
    return inline[1].trim();
  }

  return null;
}

function stripReasoningArtifacts(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, " ")
    .replace(/<think>[\s\S]*$/gi, " ")
    .replace(/<minimax:tool_call>[\s\S]*?<\/minimax:tool_call>/gi, " ")
    .replace(/<invoke[\s\S]*?<\/invoke>/gi, " ")
    .trim();
}

function stripLeadingJsonLabel(text: string): string {
  return text
    .replace(/^```(?:json|latex|tex)?\s*/i, "")
    .replace(/```$/i, "")
    .replace(/^\s*json\s*[:：]?\s*/i, "")
    .trim();
}

function latexLineScore(line: string): number {
  let score = 0;
  if (/\\[a-zA-Z]+/.test(line)) score += 4;
  if (/[{}_^]/.test(line)) score += 3;
  if (/[=+\-*/]/.test(line)) score += 1;
  if (/\d/.test(line)) score += 1;
  if (/^(?:[-*]|\d+\.)\s/.test(line)) score -= 2;
  if (!/\\/.test(line) && /[A-Za-z\u4e00-\u9fa5]{6,}/.test(line)) score -= 2;
  return score;
}

function extractLikelyLatexLines(text: string): string | null {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return null;
  }

  const beginIndex = lines.findIndex((line) => /\\begin\{/.test(line));
  if (beginIndex >= 0) {
    const endIndex = lines.findIndex((line, index) => index >= beginIndex && /\\end\{/.test(line));
    if (endIndex >= beginIndex) {
      return lines.slice(beginIndex, endIndex + 1).join("\n");
    }
  }

  let bestLine = "";
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const line of lines) {
    const score = latexLineScore(line);
    if (score > bestScore) {
      bestScore = score;
      bestLine = line;
    }
  }

  if (bestScore > 0) {
    return bestLine;
  }

  return null;
}

function looksLikeLatex(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }

  if (/^[A-Za-z](?:_[A-Za-z0-9]+)?$/.test(trimmed) || /^\d+(?:\.\d+)?$/.test(trimmed)) {
    return true;
  }

  if (/\\(?:begin|end)\{/.test(trimmed)) {
    return true;
  }

  if (/\\[a-zA-Z]+/.test(trimmed)) {
    return true;
  }

  if (/[{}_^]/.test(trimmed) && /[A-Za-z0-9]/.test(trimmed)) {
    return true;
  }

  if (/[=+\-*/]/.test(trimmed)) {
    const tokenCount = trimmed.split(/\s+/).filter(Boolean).length;
    if (tokenCount <= 18 && !/[。！？!?]/.test(trimmed)) {
      return true;
    }
  }

  return false;
}

function extractJsonCandidates(text: string): string[] {
  const candidates: string[] = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{") {
      if (depth === 0) {
        start = index;
      }
      depth += 1;
      continue;
    }

    if (char === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        candidates.push(text.slice(start, index + 1).trim());
        start = -1;
      }
    }
  }

  return Array.from(new Set(candidates.filter(Boolean)));
}

function scoreStructuredPayload(input: {
  latex?: unknown;
  changes?: unknown;
  explanation?: unknown;
  reasoning?: unknown;
  meta?: unknown;
}): number {
  let score = 0;
  if (typeof input.latex === "string") {
    score += 2;
    if (input.latex.trim().length > 0) {
      score += 1;
    }
  }
  if (Array.isArray(input.changes)) {
    score += 1;
  }
  if (typeof input.explanation === "string") {
    score += 1;
  }
  if (typeof input.reasoning === "string") {
    score += 1;
  }
  if (input.meta && typeof input.meta === "object" && !Array.isArray(input.meta)) {
    score += 1;
  }
  return score;
}

interface StructuredPayloadCandidate {
  latex?: unknown;
  changes?: unknown;
  explanation?: unknown;
  reasoning?: unknown;
  meta?: unknown;
  raw: unknown;
  score: number;
}

function pickStructuredPayloadCandidate(input: unknown): StructuredPayloadCandidate | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return null;
  }

  const record = input as Record<string, unknown>;
  const direct: StructuredPayloadCandidate = {
    latex: record.latex,
    changes: record.changes,
    explanation: record.explanation,
    reasoning: record.reasoning,
    meta: record.meta,
    raw: input,
    score: scoreStructuredPayload({
      latex: record.latex,
      changes: record.changes,
      explanation: record.explanation,
      reasoning: record.reasoning,
      meta: record.meta,
    }),
  };

  let best = direct.score > 0 ? direct : null;
  for (const key of ["result", "data", "output", "response"]) {
    const nested = pickStructuredPayloadCandidate(record[key]);
    if (!nested) {
      continue;
    }
    if (!best || nested.score > best.score) {
      best = nested;
    }
  }

  return best;
}

function parseBestStructuredPayload(text: string): StructuredPayloadCandidate | null {
  const cleaned = stripLeadingJsonLabel(stripReasoningArtifacts(text));
  if (!cleaned) {
    return null;
  }

  const fenced = extractCodeFence(cleaned);
  const pool = new Set<string>([cleaned, ...extractJsonCandidates(cleaned)]);
  if (fenced) {
    pool.add(stripLeadingJsonLabel(fenced));
    for (const candidate of extractJsonCandidates(fenced)) {
      pool.add(candidate);
    }
  }

  let best: StructuredPayloadCandidate | null = null;
  for (const candidateText of pool) {
    if (!candidateText) {
      continue;
    }

    try {
      const parsed = JSON.parse(candidateText) as unknown;
      const structured = pickStructuredPayloadCandidate(parsed);
      if (!structured) {
        continue;
      }

      if (!best || structured.score > best.score) {
        best = structured;
      }
    } catch {
      // Ignore malformed candidate and continue.
    }
  }

  return best;
}

function extractToolCallParameter(text: string, names: string[]): string | null {
  for (const name of names) {
    const pattern = new RegExp(
      `<parameter\\s+name=["']${name}["']>([\\s\\S]*?)<\\/parameter>`,
      "i",
    );
    const match = pattern.exec(text);
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  return null;
}

function sanitizeLatexText(input: string, depth = 0): string {
  let text = stripLeadingJsonLabel(stripReasoningArtifacts(input));
  if (!text) {
    return "";
  }

  text = text.replace(/^\s*(?:latex|tex)\s*[:：]\s*/i, "").trim();

  if (depth < 2) {
    const structured = parseBestStructuredPayload(text);
    if (structured && typeof structured.latex === "string") {
      const nestedSource = structured.latex.trim();
      if (nestedSource && nestedSource !== text) {
        const nested = sanitizeLatexText(nestedSource, depth + 1);
        if (nested) {
          return nested;
        }
      }
    }
  }

  const fenced = extractCodeFence(text);
  if (fenced) {
    text = stripLeadingJsonLabel(fenced);
  } else {
    const delimited = extractMathDelimited(text);
    if (delimited) {
      text = delimited;
    } else {
      const likely = extractLikelyLatexLines(text);
      if (likely) {
        text = likely;
      }
    }
  }

  text = text
    .replace(/^```(?:latex|tex)?/i, "")
    .replace(/```$/i, "")
    .replace(/^json\s*[:：]?\s*/i, "")
    .replace(/^latex\s*[:：]\s*/i, "")
    .trim();

  if (
    (text.startsWith("\"") && text.endsWith("\"")) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    text = text.slice(1, -1).trim();
  }

  text = text
    .replace(/\\\\begin\{/g, "\\begin{")
    .replace(/\\\\end\{/g, "\\end{");

  if (/^\{[\s\S]*\}$/.test(text) && /"\w+"\s*:/.test(text)) {
    return "";
  }

  if (!looksLikeLatex(text)) {
    return "";
  }

  return text;
}

function sanitizeExplanationText(input: string): string {
  const toolMessage = extractToolCallParameter(input, ["error_message", "message", "explanation"]);
  if (toolMessage) {
    return toolMessage;
  }

  const text = stripLeadingJsonLabel(stripReasoningArtifacts(input));
  if (!text) {
    return "";
  }

  const fenced = extractCodeFence(text);
  if (fenced) {
    return stripLeadingJsonLabel(fenced);
  }

  return text;
}

function sanitizeMeta(input: unknown): Record<string, unknown> | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return undefined;
  }
  return input as Record<string, unknown>;
}

export interface ParsedModelContent {
  latex?: string;
  changes?: string[];
  explanation?: string;
  reasoning?: string;
  meta?: Record<string, unknown>;
  raw?: unknown;
}

export function parseModelJsonContent(rawContent: string): ParsedModelContent {
  const parsed = parseBestStructuredPayload(rawContent);
  if (parsed) {
    return {
      latex: typeof parsed.latex === "string" ? sanitizeLatexText(parsed.latex) : "",
      changes: Array.isArray(parsed.changes)
        ? parsed.changes.filter((item): item is string => typeof item === "string")
        : [],
      explanation: typeof parsed.explanation === "string"
        ? sanitizeExplanationText(parsed.explanation)
        : "",
      reasoning: typeof parsed.reasoning === "string"
        ? sanitizeExplanationText(parsed.reasoning)
        : "",
      meta: sanitizeMeta(parsed.meta),
      raw: parsed.raw,
    };
  }

  return {
    latex: sanitizeLatexText(rawContent),
    changes: [],
    explanation: sanitizeExplanationText(rawContent),
    reasoning: "",
    meta: undefined,
    raw: stripReasoningArtifacts(rawContent),
  };
}

function normalizeLatexForAction(
  request: LlmActionRequest,
  parsedLatex: string | undefined,
): string {
  if (request.action === "explain_latex") {
    return request.latex ?? "";
  }

  return parsedLatex?.trim() ?? "";
}

function buildContractedActionResponse(
  request: LlmActionRequest,
  parsed: ParsedModelContent,
): LlmActionResponse {
  const latex = normalizeLatexForAction(request, parsed.latex);
  const explanation = parsed.explanation?.trim() ?? "";
  const reasoning = parsed.reasoning?.trim() ?? "";

  if (request.action !== "explain_latex" && latex.length === 0) {
    return {
      ok: false,
      latex: request.latex ?? "",
      error: "Provider response violated contract: missing latex.",
      explanation,
      reasoning,
      meta: parsed.meta,
      raw: parsed.raw,
    };
  }

  return {
    ok: true,
    latex,
    changes: parsed.changes ?? [],
    explanation,
    reasoning,
    meta: parsed.meta,
    raw: parsed.raw,
  };
}

function maxAttempts(config: AppConfig): number {
  return Math.max(1, Math.min(2, Math.trunc(config.provider.retry_attempts) + 1));
}

function computeRetryDelay(config: AppConfig, attempt: number): number {
  const base = Math.max(100, config.provider.retry_backoff_ms);
  const multiplier = 2 ** Math.max(0, attempt - 1);
  return Math.min(base * multiplier, 30_000);
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await response.json().catch(() => ({}))) as unknown;
  }

  return (await response.text().catch(() => "")) as unknown;
}

function buildChatHeaders(config: AppConfig): HeadersInit {
  return {
    "Content-Type": "application/json",
    ...(config.provider.api_key
      ? { Authorization: `Bearer ${config.provider.api_key}` }
      : {}),
    ...config.provider.headers,
  };
}

function isMiniMaxProvider(config: AppConfig): boolean {
  return normalizeBaseUrl(config.provider.base_url).toLowerCase().includes("minimaxi.com");
}

function isHttpImageUrl(input: string): boolean {
  try {
    const url = new URL(input);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function extractBase64FromDataUrl(input: string): string | null {
  const match = /^data:image\/[a-zA-Z0-9.+-]+;base64,([a-zA-Z0-9+/=\s]+)$/i.exec(input.trim());
  if (!match?.[1]) {
    return null;
  }
  return match[1].replace(/\s+/g, "");
}

function isBase64Payload(input: string): boolean {
  const normalized = input.replace(/\s+/g, "");
  return /^[A-Za-z0-9+/=]+$/.test(normalized) && normalized.length > 32;
}

async function resolveImageBase64ForMiniMax(image: string, timeoutMs: number): Promise<string> {
  const dataUrlBase64 = extractBase64FromDataUrl(image);
  if (dataUrlBase64) {
    return dataUrlBase64;
  }

  const trimmed = image.trim();
  if (isBase64Payload(trimmed)) {
    return trimmed.replace(/\s+/g, "");
  }

  if (!isHttpImageUrl(trimmed)) {
    throw new Error("Unsupported image payload. Use data URL, base64, or an HTTP(S) image URL.");
  }

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), Math.max(3_000, Math.min(timeoutMs, 20_000)));
  try {
    const response = await fetch(trimmed, {
      method: "GET",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Failed to download image (status ${response.status}).`);
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength === 0) {
      throw new Error("Image payload is empty.");
    }
    if (bytes.byteLength > MAX_MINIMAX_IMAGE_BYTES) {
      throw new Error(`Image is too large (${bytes.byteLength} bytes). Max allowed is ${MAX_MINIMAX_IMAGE_BYTES}.`);
    }

    return Buffer.from(bytes).toString("base64");
  } finally {
    clearTimeout(timeoutHandle);
  }
}

async function buildMessages(
  config: AppConfig,
  prompts: { system: string; user: string },
  request: LlmActionRequest,
): Promise<ChatCompletionPayload["messages"]> {
  if (request.action === "img_to_latex" && request.image) {
    if (isMiniMaxProvider(config)) {
      const imageBase64 = await resolveImageBase64ForMiniMax(request.image, config.provider.timeout);
      return [
        { role: "system", content: prompts.system },
        {
          role: "user",
          content: `${prompts.user}\n\n[图片base64:${imageBase64}]`,
        },
      ];
    }

    return [
      { role: "system", content: prompts.system },
      {
        role: "user",
        content: [
          { type: "text", text: prompts.user },
          { type: "image_url", image_url: { url: request.image } },
        ],
      },
    ];
  }

  return [
    { role: "system", content: prompts.system },
    { role: "user", content: prompts.user },
  ];
}

async function performChatRequest(config: AppConfig, payload: ChatCompletionPayload): Promise<HttpCallResult> {
  const attempts = maxAttempts(config);

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), config.provider.timeout);

    try {
      const response = await fetch(buildChatCompletionUrl(config.provider.base_url), {
        method: "POST",
        headers: buildChatHeaders(config),
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const body = await parseResponseBody(response);
      if (!response.ok && isRetryableStatus(response.status) && attempt < attempts) {
        const delay = computeRetryDelay(config, attempt);
        logError("llm-client", "Retrying LLM request after retryable response.", {
          status: response.status,
          attempt,
          attempts,
          delay,
        });
        await sleep(delay);
        continue;
      }

      return {
        ok: response.ok,
        status: response.status,
        body,
        attempt,
      };
    } catch (error) {
      if (attempt >= attempts) {
        throw error;
      }

      const delay = computeRetryDelay(config, attempt);
      logError("llm-client", "Retrying LLM request after transport failure.", {
        error: error instanceof Error ? error.message : String(error),
        attempt,
        attempts,
        delay,
      });
      await sleep(delay);
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  throw new Error("LLM request retries exhausted.");
}

async function performStreamRequest(config: AppConfig, payload: ChatCompletionPayload): Promise<StreamCallResult> {
  const attempts = maxAttempts(config);

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), config.provider.timeout);

    try {
      const response = await fetch(buildChatCompletionUrl(config.provider.base_url), {
        method: "POST",
        headers: buildChatHeaders(config),
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (response.ok) {
        return {
          ok: true,
          status: response.status,
          response,
          attempt,
        };
      }

      const body = await parseResponseBody(response);
      if (isRetryableStatus(response.status) && attempt < attempts) {
        const delay = computeRetryDelay(config, attempt);
        logError("llm-client", "Retrying LLM stream request after retryable response.", {
          status: response.status,
          attempt,
          attempts,
          delay,
        });
        await sleep(delay);
        continue;
      }

      return {
        ok: false,
        status: response.status,
        body,
        attempt,
      };
    } catch (error) {
      if (attempt >= attempts) {
        throw error;
      }

      const delay = computeRetryDelay(config, attempt);
      logError("llm-client", "Retrying LLM stream request after transport failure.", {
        error: error instanceof Error ? error.message : String(error),
        attempt,
        attempts,
        delay,
      });
      await sleep(delay);
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  throw new Error("LLM stream request retries exhausted.");
}

export async function callLlmAction(
  config: AppConfig,
  request: LlmActionRequest,
): Promise<LlmActionResponse> {
  const prompts = buildActionPrompt(config, request);
  const messages = await buildMessages(config, prompts, request);

  const payload: ChatCompletionPayload = {
    model: config.provider.model,
    messages,
    temperature: request.action === "format_latex" ? 0 : 0.2,
    response_format: { type: "json_object" },
  };

  try {
    const result = await performChatRequest(config, payload);

    if (!result.ok) {
      logError("llm-client", "Provider request failed.", {
        status: result.status,
        body: result.body,
        attempt: result.attempt,
      });
      return {
        ok: false,
        latex: request.latex ?? "",
        error: `Provider request failed with status ${result.status}.`,
        raw: result.body,
      };
    }

    const content = extractContentText(
      (result.body as { choices?: ChatCompletionChoice[] })?.choices?.[0]?.message?.content,
    );

    const parsed = parseModelJsonContent(content);
    const contracted = buildContractedActionResponse(request, parsed);
    if (!contracted.ok) {
      logError("llm-client", "Provider response failed schema contract.", {
        action: request.action,
        raw: parsed.raw,
      });
    }
    return contracted;
  } catch (error) {
    logError("llm-client", "Provider request threw an exception.", {
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      ok: false,
      latex: request.latex ?? "",
      error: error instanceof Error ? error.message : "Unknown provider error.",
    };
  }
}

interface StreamChunkPayload {
  choices?: Array<{
    delta?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
}

export async function callLlmActionStream(
  config: AppConfig,
  request: LlmActionRequest,
  onDelta: (text: string) => void,
): Promise<LlmActionResponse> {
  const prompts = buildActionPrompt(config, request);
  const messages = await buildMessages(config, prompts, request);
  const payload: ChatCompletionPayload = {
    model: config.provider.model,
    messages,
    temperature: request.action === "format_latex" ? 0 : 0.2,
    response_format: { type: "json_object" },
    stream: true,
  };

  try {
    const streamResult = await performStreamRequest(config, payload);

    if (!streamResult.ok) {
      logError("llm-client", "Provider stream request failed.", {
        status: streamResult.status,
        body: streamResult.body,
        attempt: streamResult.attempt,
      });
      return {
        ok: false,
        latex: request.latex ?? "",
        error: `Provider request failed with status ${streamResult.status}.`,
        raw: streamResult.body,
      };
    }

    const response = streamResult.response;
    if (!response) {
      return callLlmAction(config, request);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/event-stream")) {
      const body = await parseResponseBody(response);
      const content = extractContentText(
        (body as { choices?: ChatCompletionChoice[] })?.choices?.[0]?.message?.content,
      );
      const parsed = parseModelJsonContent(content);
      const contracted = buildContractedActionResponse(request, parsed);
      if (!contracted.ok) {
        logError("llm-client", "Provider response failed stream fallback contract.", {
          action: request.action,
          raw: parsed.raw,
        });
      }

      onDelta(contracted.explanation?.trim() || contracted.reasoning?.trim() || contracted.latex);
      return contracted;
    }

    if (!response.body) {
      return callLlmAction(config, request);
    }

    const decoder = new TextDecoder();
    const reader = response.body.getReader();
    let buffer = "";
    let rawContent = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) {
          continue;
        }

        const payloadText = trimmed.slice(5).trim();
        if (!payloadText || payloadText === "[DONE]") {
          continue;
        }

        try {
          const parsed = JSON.parse(payloadText) as StreamChunkPayload;
          const choice = parsed.choices?.[0];
          const deltaText = extractContentText(choice?.delta?.content);
          const messageText = extractContentText(choice?.message?.content);
          const text = deltaText || messageText;
          if (!text) {
            continue;
          }

          rawContent += text;
          onDelta(text);
        } catch {
          // Ignore malformed stream chunk and continue.
        }
      }
    }

    const trailing = buffer.trim();
    if (trailing.startsWith("data:")) {
      const payloadText = trailing.slice(5).trim();
      if (payloadText && payloadText !== "[DONE]") {
        try {
          const parsed = JSON.parse(payloadText) as StreamChunkPayload;
          const choice = parsed.choices?.[0];
          const deltaText = extractContentText(choice?.delta?.content);
          const messageText = extractContentText(choice?.message?.content);
          const text = deltaText || messageText;
          if (text) {
            rawContent += text;
            onDelta(text);
          }
        } catch {
          // Ignore malformed trailing chunk.
        }
      }
    }

    const parsed = parseModelJsonContent(rawContent);
    const contracted = buildContractedActionResponse(request, parsed);
    if (!contracted.ok) {
      logError("llm-client", "Provider stream response failed schema contract.", {
        action: request.action,
        raw: parsed.raw,
      });
    }
    return contracted;
  } catch (error) {
    logError("llm-client", "Provider stream request threw an exception.", {
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      ok: false,
      latex: request.latex ?? "",
      error: error instanceof Error ? error.message : "Unknown provider error.",
    };
  }
}

export async function testProviderConnection(config: AppConfig): Promise<{
  ok: boolean;
  message: string;
  raw?: unknown;
}> {
  const payload: ChatCompletionPayload = {
    model: config.provider.model,
    messages: [
      {
        role: "system",
        content: "Return strict JSON with key ok=true.",
      },
      {
        role: "user",
        content: "ping",
      },
    ],
    temperature: 0,
    response_format: { type: "json_object" },
  };

  try {
    const result = await performChatRequest(config, payload);
    if (!result.ok) {
      return {
        ok: false,
        message: `Connection failed (status ${result.status}).`,
        raw: result.body,
      };
    }

    return {
      ok: true,
      message: "Connection succeeded.",
      raw: result.body,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unknown connection error.",
    };
  }
}
