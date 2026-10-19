#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const OLLAMA_URL = 'http://localhost:11434/api/generate';
const MODEL = 'qwen2.5-coder:7b';

async function main() {
  const startTime = Date.now();
  console.log(`[Ollama] Generating 7B Gamepress Flappy Bird...`);

  const prompt = `Write a working Flappy Bird index.html using the Gamepress engine.
Import:
import { createGame, sfx, comboPitch, clamp, rnd } from '../_vendor/gp2d.js';

Gamepress API reference:
const g = createGame({ id: 'flappy-7b-gp', title: 'FLAPPY 7B', bg: '#4ec0ca' });
// g.run(update, draw)
// In update(dt): if (g.mode !== 'play') return;
// Input: if (g.pressed.Space || g.taps.length > 0) flap();
// Physics: bird.vy += 1300 * dt; bird.y += bird.vy * dt;
// Collisions: if (bird.y > g.H - 90 || hitPipe) { sfx('hit'); g.end({ win: false, score: g.score }); }
// In draw(c): draw sky, pipes with c.fillRect, bird with c.arc, and score with g.text(String(g.score), g.W/2, 120);

Output ONLY the complete index.html file.`;

  const res = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      prompt: prompt,
      system: 'You output ONLY executable HTML code.',
      stream: false,
      options: {
        temperature: 0.3,
        top_p: 0.9,
        repeat_penalty: 1.15,
        num_predict: 800
      }
    })
  });

  const data = await res.json();
  const elapsedMs = Date.now() - startTime;

  let code = data.response.trim();
  if (code.startsWith('```html')) {
    code = code.replace(/^```html\s*\n?/, '').replace(/\n?```\s*$/, '');
  } else if (code.startsWith('```')) {
    code = code.replace(/^```\w*\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  code = code.trim();

  const outDir = path.resolve('brad-demos/g/flappy-7b-gamepress');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'index.html'), code, 'utf8');

  console.log(`[7B Gamepress] SUCCESS: ${data.eval_count} tokens in ${(elapsedMs / 1000).toFixed(2)}s`);

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
  fs.writeFileSync('brad-demos/_qa/flappy_7b_gamepress_metrics.json', JSON.stringify(metrics, null, 2), 'utf8');
}

main().catch(err => { console.error(err); process.exit(1); });
