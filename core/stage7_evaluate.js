import fs from 'fs';
import path from 'path';

export async function logMetrics(context) {
  const metrics = {
    prompt_id: context.promptId || 'manual',
    prompt: context.prompt,
    success: context.errors.length === 0,
    stages_completed: context.stagesCompleted || 0,
    retries: context.retries || {},
    repair_triggered: context.repairTriggered || false,
    repair_success: context.repairSuccess !== false,
    failure_type: context.errors.length > 0 ? context.errors[0].error : null,
    latency_ms: context.metrics.stageTimes,
    total_time_ms: context.metrics.totalTime,
    groq_tokens: context.totalTokens || { input: 0, output: 0 },
    model_used: context.modelUsed || 'llama-3.3-70b-versatile',
    schema_validity: context.validationResult ? context.validationResult.passed : false,
    execution_passed: context.executionReport ? context.executionReport.passed : false,
    execution_checks_passed: context.executionReport ? context.executionReport.passed_checks : 0,
    execution_checks_failed: context.executionReport ? context.executionReport.failed_checks : 0,
    errors: context.errors
  };

  const logsDir = path.resolve('logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = path.join(logsDir, `run_${timestamp}.json`);
  fs.writeFileSync(filename, JSON.stringify(metrics, null, 2));
  return metrics;
}

export async function getAllMetrics() {
  const logsDir = path.resolve('logs');
  if (!fs.existsSync(logsDir)) return [];

  const files = fs.readdirSync(logsDir)
    .filter(f => f.startsWith('run_') && f.endsWith('.json'))
    .sort()
    .reverse();

  const metrics = [];
  for (const file of files.slice(0, 50)) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(logsDir, file), 'utf-8'));
      metrics.push(data);
    } catch { }
  }
  return metrics;
}
