import { callLLM, sleep } from './llm.js';
import { UISchema, APISchema, DBSchema, AuthSchema } from '../schemas/full_schema.schema.js';
import { systemPrompt as uiSystemPrompt } from '../prompts/ui_prompt.js';
import { systemPrompt as apiSystemPrompt } from '../prompts/api_prompt.js';
import { systemPrompt as dbSystemPrompt } from '../prompts/db_prompt.js';
import { systemPrompt as authSystemPrompt } from '../prompts/auth_prompt.js';

export async function stage3_ui(context) {
  const prompt = `Generate UI configuration for this app.

Intent:
${JSON.stringify(context.intent.data, null, 2)}

System Design:
${JSON.stringify(context.design.data, null, 2)}

Generate the UI schema:
{
  "pages": [{
    "name": "...",
    "route": "/...",
    "layout": "dashboard|form|table|landing|detail",
    "components": [{
      "type": "table|form|chart|card|button|nav|modal",
      "label": "...",
      "data_source": "...",
      "fields": ["..."],
      "actions": ["..."]
    }]
  }]
}`;
  const { parsed, usage, model } = await callLLM({ prompt, systemPrompt: uiSystemPrompt, maxTokens: 1500, fast: true });
  return { data: UISchema.parse(parsed), usage, model };
}

export async function stage3_api(context) {
  const prompt = `Generate API configuration for this app.

Intent:
${JSON.stringify(context.intent.data, null, 2)}

System Design:
${JSON.stringify(context.design.data, null, 2)}

Generate the API schema:
{
  "endpoints": [{
    "name": "...",
    "path": "/api/...",
    "method": "GET|POST|PUT|DELETE|PATCH",
    "auth_required": true,
    "roles_allowed": ["..."],
    "request_body": { "field": "type" },
    "response_body": { "field": "type" },
    "db_entity": "..."
  }]
}`;
  const { parsed, usage, model } = await callLLM({ prompt, systemPrompt: apiSystemPrompt, maxTokens: 1500, fast: true });
  return { data: APISchema.parse(parsed), usage, model };
}

export async function stage3_db(context) {
  const prompt = `Generate database schema for this app.

Intent:
${JSON.stringify(context.intent.data, null, 2)}

System Design:
${JSON.stringify(context.design.data, null, 2)}

Generate the DB schema:
{
  "tables": [{
    "name": "...",
    "fields": [{
      "name": "...",
      "type": "string|integer|boolean|datetime|float|text|uuid",
      "required": true,
      "unique": false,
      "foreign_key": null
    }],
    "indexes": ["..."]
  }]
}`;
  const { parsed, usage, model } = await callLLM({ prompt, systemPrompt: dbSystemPrompt, maxTokens: 1500, fast: true });
  return { data: DBSchema.parse(parsed), usage, model };
}

export async function stage3_auth(context) {
  const prompt = `Generate auth rules for this app.

Intent:
${JSON.stringify(context.intent.data, null, 2)}

System Design:
${JSON.stringify(context.design.data, null, 2)}

Generate the auth schema:
{
  "auth_type": "jwt|session|oauth",
  "roles": ["..."],
  "rules": [{
    "route": "...",
    "method": "...",
    "allowed_roles": ["..."],
    "conditions": null
  }],
  "premium_gates": [{
    "feature": "...",
    "required_plan": "..."
  }]
}`;
  const { parsed, usage, model } = await callLLM({ prompt, systemPrompt: authSystemPrompt, maxTokens: 1500, fast: true });
  return { data: AuthSchema.parse(parsed), usage, model };
}

function extractErrorSummary(err, layer) {
  if (err.issues) {
    return err.issues.map(i => `[${layer}][${i.path.join('.')}] ${i.message}`).join('; ');
  }
  return `[${layer}] ${err.message || String(err)}`;
}

export async function stage3_schema(context) {
  const t3 = Date.now();
  const results = await Promise.allSettled([
    stage3_ui(context),
    sleep(500).then(() => stage3_api(context)),
    sleep(1000).then(() => stage3_db(context)),
    sleep(1500).then(() => stage3_auth(context)),
  ]);
  const layers = ['ui', 'api', 'db', 'auth'];
  const schema = {};
  const failedLayers = [];
  results.forEach((r, i) => {
    const layer = layers[i];
    if (r.status === 'fulfilled') {
      schema[layer] = r.value;
    } else {
      schema[layer] = null;
      failedLayers.push(layer);
      context.errors.push({ stage: 'stage3', layer, error: extractErrorSummary(r.reason, layer), stack: r.reason?.stack?.split('\n')[0] });
    }
  });
  context.stage3Failures = failedLayers;
  context.schema = schema;
  context.metrics.stageTimes.stage3 = Date.now() - t3;
  return schema;
}
