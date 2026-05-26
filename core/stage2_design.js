import { callLLM } from './llm.js';
import { DesignSchema } from '../schemas/design.schema.js';
import { systemPrompt } from '../prompts/design_prompt.js';

export async function stage2_design(context) {
  const intentData = context.intent.data;
  const prompt = `Given this parsed intent, design the full app architecture. Every role and entity from the intent must appear in the output.

Intent:
${JSON.stringify(intentData, null, 2)}

Generate the system design following this schema:
{
  "pages": [{ "name": "...", "route": "/...", "access": ["role1", "role2"], "components": ["..."] }],
  "entities": [{ "name": "...", "description": "...", "relations": [{ "entity": "...", "type": "one-to-many|many-to-many|one-to-one|many-to-one" }] }],
  "auth_strategy": "jwt|session|oauth",
  "roles": [{ "name": "...", "permissions": ["..."] }],
  "flows": [{ "name": "...", "steps": ["..."] }]
}`;

  const { parsed, usage, model } = await callLLM({
    prompt,
    systemPrompt,
    maxTokens: 2000,
    fast: false
  });

  let validated = DesignSchema.parse(parsed);

  const intentRoles = intentData.roles || [];
  const intentEntities = intentData.entities || [];
  const designRoleNames = validated.roles.map(r => r.name);
  const designEntityNames = validated.entities.map(e => e.name);

  for (const role of intentRoles) {
    if (!designRoleNames.includes(role)) {
      validated.roles.push({ name: role, permissions: [] });
    }
  }

  for (const entity of intentEntities) {
    if (!designEntityNames.includes(entity)) {
      validated.entities.push({ name: entity, description: `Auto-added ${entity}`, relations: [] });
    }
  }

  return { data: validated, usage, model };
}
