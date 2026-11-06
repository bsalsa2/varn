// Neuron estimates for @cf/google/gemma-4-26b-a4b-it, from Cloudflare's pricing page:
// 9,091 Neurons per million input tokens, 27,273 per million output tokens. The Free plan gives 10,000 Neurons a day;
// this Worker refuses to start a question that could take the day's total past NEURON_BUDGET (default 8,000).
export const MODEL = '@cf/google/gemma-4-26b-a4b-it';
export const IN_PER_TOKEN = 9091 / 1e6;
export const OUT_PER_TOKEN = 27273 / 1e6;
export const MAX_OUTPUT_TOKENS = 600;               // thinking is switched off (see model.js), so this is all answer
export const MAX_MODEL_CALLS = 5;                      // up to 4 tool steps, then the final answer
export const tokensOf = (text) => Math.ceil(String(text).length / 3);          // deliberately pessimistic

export const cost = (inputTokens, outputTokens) => inputTokens * IN_PER_TOKEN + outputTokens * OUT_PER_TOKEN;

/** Worst case for one question, reserved before the model runs. */
export function estimateQuestion(promptText) {
  const base = tokensOf(promptText);
  let total = 0;
  for (let call = 0; call < MAX_MODEL_CALLS; call++) total += cost(base + call * 600, MAX_OUTPUT_TOKENS);
  return Math.ceil(total);
}

/** What one model call really cost, from the usage the model reports, or from text lengths when it reports none. */
export function actualCost({ usage, messages, output }) {
  const i = usage?.prompt_tokens ?? usage?.input_tokens ?? tokensOf(JSON.stringify(messages));
  const o = usage?.completion_tokens ?? usage?.output_tokens ?? tokensOf(output || '');
  return cost(i, o);
}
