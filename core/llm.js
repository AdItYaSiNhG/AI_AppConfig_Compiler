import Groq from 'groq-sdk';
import dotenv from 'dotenv';
dotenv.config();

function ts() {
  return new Date().toLocaleTimeString();
}

if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY === 'your_groq_api_key_here') {
  console.error(`[${ts()}] ✗ GROQ_API_KEY is missing or invalid in .env`);
}

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function callLLM({ prompt, systemPrompt, maxTokens = 1500, fast = false }) {
  const model = fast ? 'llama-3.1-8b-instant' : 'llama-3.3-70b-versatile';
  console.log(`[${ts()}] → LLM call: model=${model} maxTokens=${maxTokens} fast=${fast}`);

  let response;
  try {
    response = await groq.chat.completions.create({
      model,
      temperature: 0.1,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ]
    });
  } catch (err) {
    const msg = `Groq API error: ${err.message}`;
    console.error(`[${ts()}] ✗ ${msg}`);
    if (err.status) console.error(`[${ts()}]   HTTP ${err.status}`);
    throw new Error(msg);
  }

  const raw = response.choices[0].message.content;
  const usage = response.usage;

  console.log(`[${ts()}] ← LLM response: ${usage?.total_tokens || '?'} tokens used`);
  console.log(`[${ts()}]   raw preview: "${raw.substring(0, 120)}..."`);

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    const msg = `JSON parse error: ${e.message}`;
    console.error(`[${ts()}] ✗ ${msg}`);
    console.error(`[${ts()}]   raw: "${raw}"`);
    throw new Error(`${msg}\nRaw: ${raw.substring(0, 300)}`);
  }

  return { raw, parsed, usage, model };
}

export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
