import { callLLM } from './llm.js';
import { UISchema, APISchema, DBSchema, AuthSchema } from '../schemas/full_schema.schema.js';
import { checkConsistency } from './stage4_refine.js';

async function repair(context, errors) {
  for (const error of errors) {
    try {
      if (error.type === 'invalid_json') {
        const fixed = await callLLM({
          systemPrompt: 'You are a JSON repair tool. Fix the broken JSON below. Return ONLY valid JSON.',
          prompt: `Broken JSON:\n${error.raw}\n\nError: ${error.parseError}\n\nReturn the corrected JSON object only.`,
          fast: true
        });
        context.schema[error.layer] = fixed.parsed;
      } else if (error.type === 'missing_field') {
        const fixed = await callLLM({
          systemPrompt: 'You are a JSON patch tool. Add the missing field to the JSON object. Return the COMPLETE corrected object.',
          prompt: `Object: ${JSON.stringify(context.schema[error.layer])}\n\nMissing field: ${error.message}\n\nFix hint: ${error.fix_hint}\n\nReturn the complete corrected JSON object.`,
          fast: true
        });
        context.schema[error.layer] = fixed.parsed;
      } else if (error.type === 'cross_layer_mismatch') {
        const fixed = await callLLM({
          systemPrompt: `You are a ${error.layer} schema generator. Fix the consistency error described below.`,
          prompt: `Current ${error.layer} schema: ${JSON.stringify(context.schema[error.layer])}\n\nConsistency error: ${error.message}\n\nFix: ${error.fix_hint}\n\nReturn the corrected ${error.layer} schema JSON only.`,
          fast: true
        });
        context.schema[error.layer] = fixed.parsed;
      }
    } catch (e) {
      context.errors.push({ stage: 'stage5_repair', error: e.message, layer: error.layer });
    }
  }

  const remainingErrors = checkConsistency(context.schema);
  if (remainingErrors.length > 0 && context.repairAttempts < 3) {
    context.repairAttempts++;
    return repair(context, remainingErrors);
  }

  return context.schema;
}

function formatZodIssues(err) {
  if (err.issues) {
    return err.issues.map(issue => ({
      path: issue.path.join('.'),
      message: issue.message,
      received: issue.received,
      expected: issue.expected || issue.options?.join(' | ')
    }));
  }
  return [{ path: '', message: err.message, received: null, expected: null }];
}

function validateAllSchemas(schema) {
  const results = {};
  let allPassed = true;

  try {
    results.ui = UISchema.parse(schema.ui);
  } catch (e) {
    allPassed = false;
    results.ui = { error: true, issues: formatZodIssues(e), layer: 'ui', message: 'UI schema validation failed' };
  }
  try {
    results.api = APISchema.parse(schema.api);
  } catch (e) {
    allPassed = false;
    results.api = { error: true, issues: formatZodIssues(e), layer: 'api', message: 'API schema validation failed' };
  }
  try {
    results.db = DBSchema.parse(schema.db);
  } catch (e) {
    allPassed = false;
    results.db = { error: true, issues: formatZodIssues(e), layer: 'db', message: 'DB schema validation failed' };
  }
  try {
    results.auth = AuthSchema.parse(schema.auth);
  } catch (e) {
    allPassed = false;
    results.auth = { error: true, issues: formatZodIssues(e), layer: 'auth', message: 'Auth schema validation failed' };
  }

  return { passed: allPassed, results };
}

export async function stage5_validate(context) {
  const consistencyErrors = context.consistencyErrors || [];

  if (consistencyErrors.length > 0) {
    context.schema = await repair(context, consistencyErrors);
  }

  context.repairTriggered = consistencyErrors.length > 0;
  context.repairSuccess = context.errors.length === 0;

  if (context.stage3Failures && context.stage3Failures.length > 0) {
    for (const layer of context.stage3Failures) {
      context.errors.push({ stage: 'stage3', layer, error: `${layer} schema generation failed` });
    }
  }

  const validationResult = validateAllSchemas(context.schema);
  context.validationResult = validationResult;
  return validationResult;
}
