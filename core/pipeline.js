import { stage1_intent } from './stage1_intent.js';
import { stage2_design } from './stage2_design.js';
import { stage3_schema } from './stage3_schema.js';
import { stage4_refine } from './stage4_refine.js';
import { stage5_validate } from './stage5_validate.js';
import { runSimulation } from './stage6_runtime.js';
import { logMetrics } from './stage7_evaluate.js';

function ts() {
  return new Date().toLocaleTimeString();
}

function formatError(err) {
  const msg = err.message || String(err);

  if (err.name === 'ZodError' && err.issues) {
    return err.issues.map(issue => {
      const path = issue.path.join('.');
      return {
        reason: 'Schema validation error',
        cause: `${issue.message} at '${path}'`,
        details: issue
      };
    });
  }

  if (msg.startsWith('Groq API error:')) {
    const body = msg.replace('Groq API error: ', '');
    let detail = body;
    try {
      const parsed = JSON.parse(body);
      detail = parsed.error?.message || parsed.message || body;
    } catch {}
    const isRateLimit = detail.toLowerCase().includes('rate limit') || detail.toLowerCase().includes('rate_limit');
    return [{
      reason: isRateLimit ? 'API rate limit exceeded' : 'API error',
      cause: detail,
      details: { status: err.status || 'unknown', original: body.substring(0, 200) }
    }];
  }

  if (msg.startsWith('JSON parse error:')) {
    return [{
      reason: 'LLM response parse error',
      cause: msg,
      details: { stack: err.stack?.split('\n')[0] }
    }];
  }

  return [{
    reason: 'Unknown error',
    cause: msg,
    details: { stack: err.stack?.split('\n')[0] }
  }];
}

async function runWithRetry(fn, name, maxRetries, context) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      context.retries[name] = attempt;
      if (attempt > 0) console.log(`[${ts()}] ⚠ ${name} retry attempt ${attempt + 1}/${maxRetries}`);
      return await fn(context);
    } catch (err) {
      const formatted = formatError(err);
      console.log(`[${ts()}] ✗ Stage "${name}" - attempt ${attempt + 1}/${maxRetries} FAILED`);
      for (const f of formatted) {
        console.log(`  Reason: ${f.reason}`);
        console.log(`  Cause:  ${f.cause}`);
      }
      if (err.stack) console.log(`  Stack:  ${err.stack.split('\n').slice(0, 2).join('\n          ')}`);
      context.errors.push({ stage: name, attempt, error: formatted.map(f => `${f.reason}: ${f.cause}`).join('; '), stack: err.stack?.split('\n')[0] });
      if (attempt === maxRetries - 1) {
        console.log(`[${ts()}] ✗ ${name} exhausted all ${maxRetries} retries`);
        return null;
      }
    }
  }
  return null;
}

function failGracefully(context, failedStage) {
  console.log(`[${ts()}] ✗ PIPELINE FAILED at stage ${failedStage}`);
  context.errors.forEach(e => console.log(`[${ts()}]   [${e.stage}] ${e.error}`));
  return {
    success: false,
    failedStage,
    errors: context.errors,
    stagesCompleted: context.stagesCompleted || 0,
    partialData: {
      intent: context.intent || null,
      design: context.design || null,
      schema: context.schema || null
    },
    metrics: {
      stageTimes: context.metrics.stageTimes,
      totalTime: Date.now() - context.metrics.startTime
    }
  };
}

export async function runPipeline(userPrompt, emitEvent) {
  const context = {
    prompt: userPrompt,
    retries: {},
    errors: [],
    repairAttempts: 0,
    repairTriggered: false,
    repairSuccess: true,
    stagesCompleted: 0,
    totalTokens: { input: 0, output: 0 },
    schema: { ui: null, api: null, db: null, auth: null },
    metrics: { startTime: Date.now(), stageTimes: {} }
  };

  const emit = (type, data) => {
    if (emitEvent) emitEvent(type, data);
  };

  console.log(`\n[${ts()}] ===== PIPELINE STARTED =====`);
  console.log(`[${ts()}] Prompt: "${userPrompt.substring(0, 100)}${userPrompt.length > 100 ? '...' : ''}"`);

  if (!userPrompt || userPrompt.length < 3) {
    console.log(`[${ts()}] ✗ Prompt too short`);
    return { success: false, error: 'Prompt too short. Please provide a more detailed description.' };
  }

  // ── Stage 1: Intent Extraction ──
  console.log(`\n[${ts()}] ── Stage 1: Intent Extraction ──`);
  emit('stage-start', { stage: 1, name: 'Intent Extraction', status: 'running' });
  const t1 = Date.now();
  context.intent = await runWithRetry(() => stage1_intent(context), 'stage1', 3, context);
  context.metrics.stageTimes.stage1 = Date.now() - t1;
  context.stagesCompleted = 1;
  if (!context.intent) {
    console.log(`[${ts()}] ✗ Stage 1 failed after retries`);
    emit('stage-fail', { stage: 1, name: 'Intent Extraction', errors: context.errors });
    const result = failGracefully(context, 'stage1');
    emit('done', result);
    return result;
  }
  context.totalTokens.input += context.intent.usage?.prompt_tokens || 0;
  context.totalTokens.output += context.intent.usage?.completion_tokens || 0;
  console.log(`[${ts()}] ✓ Stage 1 complete (${context.metrics.stageTimes.stage1}ms)`);
  console.log(`[${ts()}]   app_name: ${context.intent.data.app_name}, features: ${(context.intent.data.features || []).length}`);
  emit('stage-complete', { stage: 1, name: 'Intent Extraction', data: context.intent.data, latency: context.metrics.stageTimes.stage1 });

  // ── Stage 2: System Designer ──
  console.log(`\n[${ts()}] ── Stage 2: System Designer ──`);
  emit('stage-start', { stage: 2, name: 'System Designer', status: 'running' });
  const t2 = Date.now();
  context.design = await runWithRetry(() => stage2_design(context), 'stage2', 3, context);
  context.metrics.stageTimes.stage2 = Date.now() - t2;
  context.stagesCompleted = 2;
  if (!context.design) {
    console.log(`[${ts()}] ✗ Stage 2 failed after retries`);
    emit('stage-fail', { stage: 2, name: 'System Designer', errors: context.errors });
    const result = failGracefully(context, 'stage2');
    emit('done', result);
    return result;
  }
  context.totalTokens.input += context.design.usage?.prompt_tokens || 0;
  context.totalTokens.output += context.design.usage?.completion_tokens || 0;
  console.log(`[${ts()}] ✓ Stage 2 complete (${context.metrics.stageTimes.stage2}ms)`);
  console.log(`[${ts()}]   pages: ${context.design.data.pages.length}, entities: ${context.design.data.entities.length}, roles: ${context.design.data.roles.length}`);
  emit('stage-complete', { stage: 2, name: 'System Designer', data: context.design.data, latency: context.metrics.stageTimes.stage2 });

  // ── Stage 3: Schema Generator ──
  console.log(`\n[${ts()}] ── Stage 3: Schema Generator ──`);
  emit('stage-start', { stage: 3, name: 'Schema Generator (UI+API+DB+Auth)', status: 'running' });
  const t3 = Date.now();
  context.schema = await stage3_schema(context);
  context.metrics.stageTimes.stage3 = Date.now() - t3;
  context.stagesCompleted = 3;
  const failedLayers = Object.entries(context.schema).filter(([_, v]) => v === null).map(([k]) => k);
  if (failedLayers.length > 0) {
    console.log(`[${ts()}] ⚠ Stage 3: some layers failed: ${failedLayers.join(', ')}`);
    emit('stage-warn', { stage: 3, failedLayers, message: `Some schema layers failed: ${failedLayers.join(', ')}` });
  } else {
    console.log(`[${ts()}] ✓ Stage 3 complete (${context.metrics.stageTimes.stage3}ms) - all 4 layers generated`);
  }
  emit('stage-complete', { stage: 3, name: 'Schema Generator', data: context.schema, latency: context.metrics.stageTimes.stage3 });

  // ── Stage 4: Consistency Check ──
  console.log(`\n[${ts()}] ── Stage 4: Consistency Check ──`);
  emit('stage-start', { stage: 4, name: 'Consistency Check', status: 'running' });
  const t4 = Date.now();
  const consistencyErrors = stage4_refine(context);
  context.metrics.stageTimes.stage4 = Date.now() - t4;
  context.stagesCompleted = 4;
  if (consistencyErrors.length > 0) {
    console.log(`[${ts()}] ⚠ Stage 4: found ${consistencyErrors.length} consistency errors`);
    consistencyErrors.forEach(e => console.log(`  - [${e.layer}] ${e.message}`));
  } else {
    console.log(`[${ts()}] ✓ Stage 4: no consistency errors`);
  }
  emit('stage-complete', { stage: 4, name: 'Consistency Check', data: { errors: consistencyErrors, passed: consistencyErrors.length === 0, summary: consistencyErrors.length === 0 ? 'All schemas are consistent' : `Found ${consistencyErrors.length} consistency error(s)` }, latency: context.metrics.stageTimes.stage4 });

  // ── Stage 5: Validation + Repair ──
  console.log(`\n[${ts()}] ── Stage 5: Validation + Repair ──`);
  emit('stage-start', { stage: 5, name: 'Validation + Repair', status: 'running' });
  const t5 = Date.now();
  const validationResult = await stage5_validate(context);
  context.metrics.stageTimes.stage5 = Date.now() - t5;
  context.stagesCompleted = 5;
  if (!validationResult.passed) {
    console.log(`[${ts()}] ⚠ Stage 5: validation failed for some schemas`);
    Object.entries(validationResult.results || {}).forEach(([layer, res]) => {
      if (res.error && res.issues) {
        console.log(`  Layer: "${layer}" - ${res.message}`);
        res.issues.forEach(issue => {
          console.log(`    [${issue.path}] ${issue.message}${issue.received ? ` (received: ${issue.received})` : ''}${issue.expected ? `, expected: ${issue.expected}` : ''}`);
        });
      } else if (res.error) {
        console.log(`  Layer: "${layer}" - ${res.message || 'unknown error'}`);
      } else {
        console.log(`  Layer: "${layer}" - passed`);
      }
    });
    emit('stage-warn', { stage: 5, name: 'Validation + Repair', message: 'Some schemas failed validation', validationResult });
  } else {
    console.log(`[${ts()}] ✓ Stage 5: all schemas valid`);
  }
  if (context.repairTriggered) console.log(`[${ts()}]   repair triggered: ${context.repairSuccess ? 'successful' : 'failed'}`);
  emit('stage-complete', { stage: 5, name: 'Validation + Repair', validationResult, latency: context.metrics.stageTimes.stage5 });

  // ── Stage 6: Runtime Simulation ──
  console.log(`\n[${ts()}] ── Stage 6: Runtime Simulation ──`);
  emit('stage-start', { stage: 6, name: 'Runtime Simulation', status: 'running' });
  const t6 = Date.now();
  context.schema.intent = context.intent?.data;
  context.executionReport = runSimulation(context.schema);
  context.metrics.stageTimes.stage6 = Date.now() - t6;
  context.stagesCompleted = 6;
  console.log(`[${ts()}] ${context.executionReport.passed ? '✓' : '⚠'} Stage 6: ${context.executionReport.passed_checks}/${context.executionReport.total_checks} checks passed`);
  context.executionReport.checks?.forEach(c => console.log(`  ${c.status === 'pass' ? '✓' : '✗'} ${c.name}: ${c.status}`));
  emit('stage-complete', { stage: 6, name: 'Runtime Simulation', report: context.executionReport, latency: context.metrics.stageTimes.stage6 });

  // ── Stage 7: Evaluation Logger ──
  console.log(`\n[${ts()}] ── Stage 7: Evaluation Logger ──`);
  emit('stage-start', { stage: 7, name: 'Evaluation Logger', status: 'running' });
  context.metrics.totalTime = Date.now() - context.metrics.startTime;
  context.modelUsed = context.intent?.model || 'llama-3.3-70b-versatile';
  const metrics = await logMetrics(context);
  context.stagesCompleted = 7;
  console.log(`[${ts()}] ✓ Stage 7: metrics logged`);
  emit('stage-complete', { stage: 7, name: 'Evaluation Logger', metrics, latency: context.metrics.stageTimes.stage7 || 0 });

  const result = {
    success: context.errors.length === 0,
    intent: context.intent?.data || null,
    design: context.design?.data || null,
    schema: context.schema,
    executionReport: context.executionReport,
    metrics: {
      stageTimes: context.metrics.stageTimes,
      totalTime: context.metrics.totalTime,
      repairTriggered: context.repairTriggered,
      repairSuccess: context.repairSuccess,
      retries: context.retries,
      totalTokens: context.totalTokens
    },
    errors: context.errors
  };

  console.log(`\n[${ts()}] ===== PIPELINE FINISHED (${result.success ? 'SUCCESS' : 'FAILED'}) =====`);
  console.log(`[${ts()}] Total time: ${context.metrics.totalTime}ms`);
  if (context.errors.length > 0) {
    const seen = new Set();
    const unique = context.errors.filter(e => {
      const key = `${e.stage}|${e.error}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    console.log(`[${ts()}] Errors (${unique.length} unique):`);
    unique.forEach((e, i) => {
      console.log(`  ${i + 1}. [Stage: ${e.stage}] ${e.error}`);
    });
  }

  emit('done', result);
  return result;
}
