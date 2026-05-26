import { callLLM } from './llm.js';
import { IntentSchema } from '../schemas/intent.schema.js';
import { systemPrompt, fewShotExample } from '../prompts/intent_prompt.js';

export async function stage1_intent(context) {
  const prompt = `Parse the following app description into structured intent.

Few-shot example:
User: "${fewShotExample.user}"
Output: ${JSON.stringify(fewShotExample.output)}

Now parse this:
User: "${context.prompt}"

Output the intent JSON object following the schema exactly:
{
  "app_name": "...",
  "app_type": "crm|ecommerce|saas|dashboard|social|marketplace|other",
  "features": [...],
  "roles": [...],
  "entities": [...],
  "monetization": "free|freemium|paid|subscription|none",
  "integrations": [...],
  "ambiguities": [...],
  "assumptions": [...]
}`;

  const { parsed, usage, model } = await callLLM({
    prompt,
    systemPrompt,
    maxTokens: 1000,
    fast: true
  });

  const validated = IntentSchema.parse(parsed);
  context.retries.stage1 = 0;
  return { data: validated, usage, model };
}
