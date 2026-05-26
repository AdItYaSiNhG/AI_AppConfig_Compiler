export async function generateFromPrompt(prompt) {
  console.log('[API] POST /generate', { prompt: prompt.substring(0, 80) + '...' });
  const res = await fetch('/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    console.error('[API] /generate error:', err);
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export async function checkHealth() {
  const res = await fetch('/health');
  return res.json();
}

export function createEventStream(prompt, onEvent) {
  console.log('[SSE] Connecting to /generate/stream...');
  fetch('/generate/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt })
  }).then(async (response) => {
    if (!response.ok) {
      console.error('[SSE] Connection failed:', response.status, response.statusText);
      onEvent('error', { message: `HTTP ${response.status}: ${response.statusText}` });
      return;
    }
    console.log('[SSE] Connected, reading stream...');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        console.log('[SSE] Stream closed');
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      let eventType = '';
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          eventType = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (eventType === 'stage-start') console.log(`[SSE] ▶ ${data.name}`);
            else if (eventType === 'stage-complete') console.log(`[SSE] ✓ Stage ${data.stage}: ${data.name} (${data.latency || '?'}ms)`);
            else if (eventType === 'stage-fail') {
              const errMsgs = (data.errors || []).map(e =>
                `[Stage: ${e.stage || '?'}] Reason: ${e.error || 'unknown'}` +
                (e.attempt !== undefined ? ` (attempt ${e.attempt + 1})` : '')
              ).join('\n           ');
              console.error(`[SSE] ✗ Stage ${data.stage}: ${data.name} FAILED\n           ${errMsgs}`);
            }
            else if (eventType === 'stage-warn') console.warn(`[SSE] ⚠ Stage ${data.stage}: ${data.message || data.name}`);
            else if (eventType === 'done') console.log('[SSE] ✓ Pipeline done:', data.success ? 'SUCCESS' : 'FAILED');
            else if (eventType === 'error') console.error('[SSE] ✗ Error:', data.message);
            onEvent(eventType, data);
          } catch (e) {
            console.warn('[SSE] Parse error:', e.message, line.substring(0, 100));
          }
          eventType = '';
        }
      }
    }
  }).catch(err => {
    console.error('[SSE] Connection error:', err);
    onEvent('error', { message: err.message });
  });
}
