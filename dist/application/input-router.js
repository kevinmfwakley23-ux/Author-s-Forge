"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.classifyAuthorInput = classifyAuthorInput;
exports.routeAuthorInput = routeAuthorInput;
const COMMANDS = [
    [/^new chapter$/i, "new-chapter", () => undefined],
    [/^make this a scene break$/i, "scene-break", () => undefined],
    [/^save this as (?:a )?(?:character )?note$/i, "save-note", (match) => match[0]],
    [/^rewrite(?: this)?(?: as)?\s+(.+)$/i, "rewrite", (match) => match[1]],
    [/^expand(?: this)?(?: with)?\s+(.+)$/i, "expand", (match) => match[1]]
];
function classifyAuthorInput(input) {
    const text = input.text.trim();
    for (const [pattern, intent, commandText] of COMMANDS) {
        const match = text.match(pattern);
        if (match) {
            return {
                input,
                intent,
                ...(commandText(match) ? { commandText: commandText(match) } : {})
            };
        }
    }
    if (/^\/\S+/.test(text)) {
        return { input, intent: "unknown-command", commandText: text };
    }
    return { input, intent: "content" };
}
function routeAuthorInput(input) {
    return classifyAuthorInput(input);
}
//# sourceMappingURL=input-router.js.map