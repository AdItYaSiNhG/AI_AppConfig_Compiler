import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { runPipeline } from '../core/pipeline.js';
import { getAllMetrics } from '../core/stage7_evaluate.js';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

function ts() {
  return new Date().toLocaleTimeString();
}

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
  console.log(`[${ts()}] ${req.method} ${req.path}`);
  next();
});

app.get('/health', (req, res) => {
  const health = {
    status: 'ok',
    model: 'llama-3.3-70b-versatile',
    groq_key_configured: !!process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'your_groq_api_key_here',
    key_prefix: process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.substring(0, 8) + '...' : 'none',
    timestamp: new Date().toISOString()
  };
  console.log(`[${ts()}] Health check: ${JSON.stringify(health)}`);
  res.json(health);
});

app.post('/generate', async (req, res) => {
  const t0 = Date.now();
  try {
    const { prompt } = req.body;
    if (!prompt || prompt.trim().length < 3) {
      return res.status(400).json({ error: 'Prompt too short. Please provide a more detailed description.' });
    }
    console.log(`\n[${ts()}] ===== /generate request =====`);
    console.log(`[${ts()}] Prompt: "${prompt.substring(0, 100)}..."`);

    const result = await runPipeline(prompt.trim());

    const elapsed = Date.now() - t0;
    console.log(`[${ts()}] ===== /generate response (${elapsed}ms) =====`);
    console.log(`[${ts()}] success: ${result.success}, stages: ${result.stagesCompleted}, errors: ${result.errors?.length || 0}`);

    res.json(result);
  } catch (err) {
    console.error(`[${ts()}] ✗ /generate error:`, err.message);
    console.error(err.stack?.split('\n').slice(0, 5).join('\n'));
    res.status(500).json({ error: err.message, details: err.stack?.split('\n')[0] });
  }
});

app.post('/generate/stream', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt || prompt.trim().length < 3) {
    return res.status(400).json({ error: 'Prompt too short.' });
  }

  console.log(`\n[${ts()}] ===== /generate/stream request =====`);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const emitEvent = (type, data) => {
    if (res.writableEnded) return;
    try {
      res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch (e) {
      console.error(`[${ts()}] SSE write error:`, e.message);
    }
  };

  try {
    const result = await runPipeline(prompt.trim(), emitEvent);
    if (!res.writableEnded) {
      emitEvent('done', result);
      console.log(`[${ts()}] SSE stream complete`);
      res.end();
    }
  } catch (err) {
    console.error(`[${ts()}] ✗ SSE stream error:`, err.message);
    if (!res.writableEnded) {
      emitEvent('error', { message: err.message });
      res.end();
    }
  }
});

app.get('/metrics', async (req, res) => {
  try {
    const metrics = await getAllMetrics();
    res.json({ total_runs: metrics.length, runs: metrics });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const uiDistPath = path.join(__dirname, '..', 'ui', 'dist');
app.use(express.static(uiDistPath));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/health') || req.path.startsWith('/metrics') || req.path.startsWith('/generate')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(uiDistPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`[${ts()}] App Config Compiler server started`);
  console.log(`[${ts()}] Listening on http://localhost:${PORT}`);
  console.log(`[${ts()}] Health: http://localhost:${PORT}/health`);
  console.log(`[${ts()}] GROQ_API_KEY: ${process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.substring(0, 8) + '...' : 'NOT SET'}`);
});
