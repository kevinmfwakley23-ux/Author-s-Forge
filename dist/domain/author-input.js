"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAuthorInput = createAuthorInput;
function createAuthorInput(input) {
    if (!input.id.trim())
        throw new Error("Author input id is required.");
    if (!input.text.trim())
        throw new Error("Author input text is required.");
    const text = input.text.trim();
    return {
        id: input.id,
        mode: input.mode,
        text,
        originalText: text,
        createdAt: input.createdAt ?? new Date().toISOString(),
        ...(input.provenance ? { provenance: { ...input.provenance } } : {})
    };
}
//# sourceMappingURL=author-input.js.map