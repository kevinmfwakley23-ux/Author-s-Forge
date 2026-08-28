"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateText = generateText;
async function generateText(request) {
    const openAiKey = process.env.OPENAI_API_KEY?.trim();
    if (openAiKey)
        return generateOpenAi(openAiKey, request);
    const ollama = process.env.OLLAMA_BASE_URL?.trim();
    if (ollama)
        return generateOllama(ollama.replace(/\/$/, ""), request);
    throw new Error("No AI provider is configured. Set OPENAI_API_KEY + OPENAI_MODEL for OpenAI or OLLAMA_BASE_URL + OLLAMA_MODEL for local Ollama.");
}
async function generateOpenAi(apiKey, request) {
    const model = process.env.OPENAI_MODEL?.trim();
    if (!model)
        throw new Error("OPENAI_MODEL is required when OPENAI_API_KEY is configured.");
    const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({ model, input: [{ role: "system", content: request.system }, { role: "user", content: request.user }], temperature: request.temperature ?? 0.7, max_output_tokens: request.maxOutputTokens ?? 4000 })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok)
        throw new Error(typeof payload.error === "object" && payload.error ? String(payload.error.message ?? `OpenAI request failed (${response.status}).`) : `OpenAI request failed (${response.status}).`);
    const text = extractOpenAiText(payload);
    if (!text)
        throw new Error("OpenAI returned no generated text.");
    return { provider: "openai", model, text, requestId: typeof payload.id === "string" ? payload.id : undefined };
}
async function generateOllama(baseUrl, request) {
    const model = process.env.OLLAMA_MODEL?.trim();
    if (!model)
        throw new Error("OLLAMA_MODEL is required when OLLAMA_BASE_URL is configured.");
    const response = await fetch(`${baseUrl}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model, stream: false, messages: [{ role: "system", content: request.system }, { role: "user", content: request.user }], options: { temperature: request.temperature ?? 0.7 } }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok)
        throw new Error(`Ollama request failed (${response.status}).`);
    const message = payload.message;
    const text = typeof message?.content === "string" ? message.content.trim() : "";
    if (!text)
        throw new Error("Ollama returned no generated text.");
    return { provider: "ollama", model, text };
}
function extractOpenAiText(payload) {
    if (typeof payload.output_text === "string")
        return payload.output_text.trim();
    const output = Array.isArray(payload.output) ? payload.output : [];
    const parts = [];
    for (const item of output) {
        if (!item || typeof item !== "object")
            continue;
        const content = item.content;
        if (!Array.isArray(content))
            continue;
        for (const part of content) {
            if (part && typeof part === "object" && typeof part.text === "string")
                parts.push(String(part.text));
        }
    }
    return parts.join("\n").trim();
}
//# sourceMappingURL=ai-provider.js.map