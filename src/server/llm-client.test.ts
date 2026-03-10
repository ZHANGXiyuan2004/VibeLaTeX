import type { AppConfig } from "@/shared/types";
import { vi } from "vitest";
import { DEFAULT_APP_CONFIG } from "@/server/config-store";
import { callLlmAction, parseModelJsonContent } from "@/server/llm-client";

function buildConfig(baseUrl = "https://api.minimaxi.com/v1"): AppConfig {
  return {
    ...structuredClone(DEFAULT_APP_CONFIG),
    provider: {
      ...DEFAULT_APP_CONFIG.provider,
      base_url: baseUrl,
      api_key: "test-key",
      model: "MiniMax-M2.5",
    },
    capabilities: {
      ...DEFAULT_APP_CONFIG.capabilities,
      vision: true,
    },
    features_enabled: {
      ...DEFAULT_APP_CONFIG.features_enabled,
      image_to_latex: true,
    },
  };
}

describe("parseModelJsonContent", () => {
  it("strips think blocks and json fences while keeping latex pure", () => {
    const parsed = parseModelJsonContent(
      [
        "<think>internal reasoning</think>",
        "```json",
        "{\"latex\":\"\\\\frac{a+b}{c+d}\",\"changes\":[\"normalized spacing\"],\"explanation\":\"formatted\"}",
        "```",
      ].join("\n"),
    );

    expect(parsed.latex).toBe("\\frac{a+b}{c+d}");
    expect(parsed.changes).toEqual(["normalized spacing"]);
    expect(parsed.explanation).toBe("formatted");
  });

  it("keeps latex empty for prose-only output", () => {
    const parsed = parseModelJsonContent(
      "No image was provided in the request. Please upload an image containing a formula.",
    );

    expect(parsed.latex).toBe("");
    expect(parsed.explanation).toContain("No image was provided");
  });

  it("extracts minimax tool-call error message", () => {
    const parsed = parseModelJsonContent(
      "<minimax:tool_call><invoke name=\"Error\"><parameter name=\"error_message\">No image provided.</parameter></invoke></minimax:tool_call>",
    );

    expect(parsed.latex).toBe("");
    expect(parsed.explanation).toBe("No image provided.");
  });

  it("extracts latex from markdown code fences", () => {
    const parsed = parseModelJsonContent(
      [
        "Here is the normalized formula:",
        "```latex",
        "\\sum_{k=1}^{n} k = \\frac{n(n+1)}{2}",
        "```",
      ].join("\n"),
    );

    expect(parsed.latex).toBe(String.raw`\sum_{k=1}^{n} k = \frac{n(n+1)}{2}`);
  });

  it("extracts latex from nested json payload wrapper", () => {
    const parsed = parseModelJsonContent(
      JSON.stringify({
        data: {
          output: {
            latex: String.raw`\int_0^1 x^2\,dx`,
            explanation: "done",
          },
        },
      }),
    );

    expect(parsed.latex).toBe(String.raw`\int_0^1 x^2\,dx`);
    expect(parsed.explanation).toBe("done");
  });

  it("extracts display math delimiters", () => {
    const parsed = parseModelJsonContent(String.raw`$$\frac{1}{1+x}$$`);
    expect(parsed.latex).toBe(String.raw`\frac{1}{1+x}`);
  });

  it("extracts inline math delimiters", () => {
    const parsed = parseModelJsonContent(String.raw`Result: $x^2+y^2=z^2$ done.`);
    expect(parsed.latex).toBe(String.raw`x^2+y^2=z^2`);
  });

  it("extracts likely latex line from mixed prose", () => {
    const parsed = parseModelJsonContent(
      [
        "The user asks for a compact equation.",
        "Use this:",
        String.raw`\alpha + \beta = \gamma`,
      ].join("\n"),
    );
    expect(parsed.latex).toBe(String.raw`\alpha + \beta = \gamma`);
  });

  it("extracts reasoning and meta when provided", () => {
    const parsed = parseModelJsonContent(
      JSON.stringify({
        latex: String.raw`\frac{a}{b}`,
        reasoning: "Normalized spaces.",
        meta: {
          provider: "minimax",
        },
      }),
    );

    expect(parsed.latex).toBe(String.raw`\frac{a}{b}`);
    expect(parsed.reasoning).toBe("Normalized spaces.");
    expect(parsed.meta).toEqual({ provider: "minimax" });
  });

  it("decodes escaped latex from JSON string payload", () => {
    const parsed = parseModelJsonContent(
      "{\"latex\":\"\\\\\\\\begin{aligned}a&=b\\\\\\\\c&=d\\\\\\\\end{aligned}\"}",
    );
    expect(parsed.latex).toBe(String.raw`\begin{aligned}a&=b\\c&=d\end{aligned}`);
  });

  it("keeps non-latex json blocks from being mis-applied", () => {
    const parsed = parseModelJsonContent(
      JSON.stringify({
        message: "No valid formula",
        code: "bad_request",
      }),
    );
    expect(parsed.latex).toBe("");
    expect(parsed.explanation).toContain("No valid formula");
  });
});

describe("callLlmAction img_to_latex", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses MiniMax [图片base64:...] protocol for data URLs", async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        messages?: Array<{ content?: unknown }>;
      };

      const userContent = String(body.messages?.[1]?.content ?? "");
      expect(userContent).toContain("[图片base64:QUJDREVGRw==]");
      expect(userContent).not.toContain("image_url");

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: "{\"latex\":\"\\\\frac{1}{2}\",\"changes\":[],\"explanation\":\"ok\"}",
              },
            },
          ],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await callLlmAction(buildConfig(), {
      action: "img_to_latex",
      image: "data:image/png;base64,QUJDREVGRw==",
    });

    expect(result.ok).toBe(true);
    expect(result.latex).toBe("\\frac{1}{2}");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("downloads http image and forwards as base64 for MiniMax", async () => {
    const imageUrl = "https://example.com/formula.png";
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);

      if (url === imageUrl) {
        return new Response(Uint8Array.from([1, 2, 3]), {
          status: 200,
          headers: { "content-type": "image/png" },
        });
      }

      const body = JSON.parse(String(init?.body ?? "{}")) as {
        messages?: Array<{ content?: unknown }>;
      };
      const userContent = String(body.messages?.[1]?.content ?? "");
      expect(userContent).toContain("[图片base64:AQID]");

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: "{\"latex\":\"x^2\",\"changes\":[],\"explanation\":\"ok\"}",
              },
            },
          ],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await callLlmAction(buildConfig(), {
      action: "img_to_latex",
      image: imageUrl,
    });

    expect(result.ok).toBe(true);
    expect(result.latex).toBe("x^2");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fails when provider response violates latex contract", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  explanation: "unable to detect formula",
                }),
              },
            },
          ],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await callLlmAction(buildConfig(), {
      action: "img_to_latex",
      image: "data:image/png;base64,QUJDREVGRw==",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("missing latex");
  });
});

describe("callLlmAction retry policy", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("retries once for retryable status when retry_attempts=1", async () => {
    const config = buildConfig("https://api.openai.com/v1");
    config.provider.retry_attempts = 1;

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "temporary" }), {
          status: 500,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({ latex: "x + y" }),
                },
              },
            ],
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      );

    vi.stubGlobal("fetch", fetchMock);

    const result = await callLlmAction(config, {
      action: "format_latex",
      latex: "x+y",
    });

    expect(result.ok).toBe(true);
    expect(result.latex).toBe("x + y");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("never exceeds one retry even if config is unexpectedly large", async () => {
    const config = buildConfig("https://api.openai.com/v1");
    config.provider.retry_attempts = 9;

    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ error: "still failing" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await callLlmAction(config, {
      action: "fix_latex",
      latex: "\\frac{1}{",
      error_message: "Parse error",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("status 500");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
