export interface AiGatewayRequest {
  readonly model: string;
  readonly system?: string;
  readonly user: string;
  readonly temperature?: number;
}

export interface AiGatewayResponse {
  readonly text: string;
  readonly provider: string;
  readonly model: string;
}

export interface AiGateway {
  readonly id: string;
  isConfigured(): boolean;
  generate(request: AiGatewayRequest): Promise<AiGatewayResponse>;
}

/**
 * Adapter boundary for any OpenAI-compatible local gateway.
 * Forge owns the request contract; gateway-specific authentication,
 * browser sessions, and provider quirks stay outside the domain layer.
 */
export function createOpenAiCompatibleGateway(options: {
  readonly id: string;
  readonly baseUrl: string;
  readonly apiKey?: string;
  readonly fetchImpl?: typeof fetch;
}): AiGateway {
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    id: options.id,
    isConfigured: () => options.baseUrl.trim().length > 0,
    async generate(request) {
      if (!options.baseUrl.trim()) {
        throw new Error("AI gateway is not configured.");
      }

      const response = await fetchImpl(`${options.baseUrl.replace(/\/$/, "")}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(options.apiKey ? { authorization: `Bearer ${options.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: request.model,
          messages: [
            ...(request.system ? [{ role: "system", content: request.system }] : []),
            { role: "user", content: request.user },
          ],
          ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
        }),
      });

      if (!response.ok) {
        throw new Error(`AI gateway request failed with HTTP ${response.status}.`);
      }

      const payload = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = payload.choices?.[0]?.message?.content;
      if (typeof text !== "string") {
        throw new Error("AI gateway returned no assistant text.");
      }

      return { text, provider: options.id, model: request.model };
    },
  };
}
