#!/usr/bin/env node
/**
 * Fast 7B Vanilla Flappy Bird Generator & Benchmark
 */
import fs from 'node:fs';
import path from 'node:path';

const OLLAMA_URL = 'http://localhost:11434/api/generate';
const MODEL = 'qwen2.5-coder:7b';

async function main() {
  const startTime = Date.now();
  console.log(`[Ollama] Generating 7B Vanilla Flappy Bird with ${MODEL}...`);

  const prompt = `Write a complete, single-file HTML5 Flappy Bird game index.html using Canvas and vanilla JavaScript.
Requirements:
1. Single self-contained HTML file (HTML + CSS + JS in <script>)
2. Canvas 400x600 centered on screen
3. Flapping yellow bird circle that jumps when pressing Space or clicking/tapping canvas
4. Gravity accelerates bird down; jump gives upward velocity
5. Green pipes with gaps moving leftwards; score increases when passing
6. Simple Web Audio API sound on jump and on collision
7. Game over screen showing final score and click to restart
Output ONLY the clean executable HTML code.`;

  const res = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      prompt: prompt,
      system: 'You output ONLY executable index.html code.',
      stream: false,
      options: {
        temperature: 0.3,
        top_p: 0.9,
        repeat_penalty: 1.15,
        num_predict: 1000
      }
    })
  });

  if (!res.ok) {
    throw new Error(`Ollama HTTP ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  const elapsedMs = Date.now() - startTime;

  let code = data.response.trim();
  if (code.startsWith('```html')) {
    code = code.replace(/^```html\s*\n?/, '').replace(/\n?```\s*$/, '');
  } else if (code.startsWith('```')) {
    code = code.replace(/^```\w*\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  code = code.trim();

  const outDir = path.resolve('brad-demos/g/flappy-7b-vanilla');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'index.html'), code, 'utf8');

  console.log(`[7B Vanilla] SUCCESS: ${data.eval_count} tokens in ${(elapsedMs / 1000).toFixed(2)}s (${(data.eval_count / (elapsedMs / 1000)).toFixed(1)} tok/s)`);

  const metrics = {
    model: MODEL,
    promptTokens: data.prompt_eval_count,
    completionTokens: data.eval_count,
    totalTokens: data.prompt_eval_count + data.eval_count,
    elapsedSeconds: +(elapsedMs / 1000).toFixed(2),
    codeBytes: Buffer.byteLength(code, 'utf8'),
    linesOfCode: code.split('\n').length
  };

  fs.mkdirSync('brad-demos/_qa', { recursive: true });
  fs.writeFileSync('brad-demos/_qa/flappy_7b_vanilla_metrics.json', JSON.stringify(metrics, null, 2), 'utf8');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
