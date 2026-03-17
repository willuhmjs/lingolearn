/**
 * Strips characters that are commonly used to escape prompt context in LLM system prompts.
 * Applied to any user-controlled string before it is embedded in a system prompt.
 */
export function sanitizeForPrompt(value: string, maxLength = 500): string {
  return (
    value
      .slice(0, maxLength)
      // Remove null bytes
      .replace(/\0/g, '')
      // Collapse any sequence that looks like a role header injection
      // e.g. "\n\nSystem:", "\n\nUser:", "\n\nAssistant:"
      .replace(/(\r?\n){2,}\s*(system|user|assistant)\s*:/gi, ' ')
      .trim()
  );
}
