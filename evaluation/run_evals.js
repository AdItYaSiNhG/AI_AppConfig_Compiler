import dotenv from 'dotenv';
import { runPipeline } from '../core/pipeline.js';
import { sleep } from '../core/llm.js';
import fs from 'fs';
import path from 'path';

dotenv.config();

const datasets = {
  real: JSON.parse(fs.readFileSync(new URL('./dataset_real.json', import.meta.url), 'utf-8')),
  edge: JSON.parse(fs.readFileSync(new URL('./dataset_edge.json', import.meta.url), 'utf-8'))
};

async function runEvaluation() {
  const allResults = [];
  let passed = 0;
  let total = 0;

  for (const [category, prompts] of Object.entries(datasets)) {
    console.log(`\n===== Running ${category} dataset (${prompts.length} prompts) =====\n`);

    for (const item of prompts) {
      total++;
      console.log(`[${item.id}] "${item.prompt.substring(0, 60)}..."`);

      try {
        const start = Date.now();
        const result = await runPipeline(item.prompt);
        const elapsed = Date.now() - start;

        const success = result.success && result.executionReport?.passed;
        if (success) passed++;

        const entry = {
          prompt_id: item.id,
          prompt: item.prompt,
          category: item.category || category,
          success,
          stages_completed: result.stagesCompleted || 0,
          latency_ms: elapsed,
          execution_passed: result.executionReport?.passed || false,
          execution_checks_passed: result.executionReport?.passed_checks || 0,
          errors: result.errors || []
        };

        allResults.push(entry);
        console.log(`  → ${success ? 'PASS' : 'FAIL'} (${elapsed}ms) stages: ${entry.stages_completed}`);
      } catch (err) {
        console.log(`  → ERROR: ${err.message}`);
        allResults.push({
          prompt_id: item.id,
          prompt: item.prompt,
          success: false,
          error: err.message
        });
      }

      await sleep(2000);
    }
  }

  console.log(`\n===== Evaluation Complete =====`);
  console.log(`Passed: ${passed}/${total} (${Math.round(passed / total * 100)}%)`);

  const report = {
    timestamp: new Date().toISOString(),
    summary: { total, passed, failed: total - passed, pass_rate: `${Math.round(passed / total * 100)}%` },
    results: allResults
  };

  const evalDir = path.resolve('logs');
  if (!fs.existsSync(evalDir)) fs.mkdirSync(evalDir, { recursive: true });
  const filename = path.join(evalDir, `eval_report_${Date.now()}.json`);
  fs.writeFileSync(filename, JSON.stringify(report, null, 2));
  console.log(`Report saved: ${filename}`);
}

runEvaluation().catch(console.error);
