#!/usr/bin/env node
/**
 * Flappy Bird 4-Way AI Bake-Off Runner
 * Runs Qwen 2.5 Coder 7B with proper sampling params to prevent repetition loops.
 */

import fs from 'node:fs';
import path from 'node:path';

const OLLAMA_URL = 'http://localhost:11434/api/generate';
const MODEL = 'qwen2.5-coder:7b';

async function queryOllama(prompt, systemPrompt = '') {
  const startTime = Date.now();
  console.log(`[Ollama] Querying ${MODEL}...`);
  const res = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      prompt: prompt,
      system: systemPrompt,
      stream: false,
      options: {
        temperature: 0.3,
        top_p: 0.9,
        repeat_penalty: 1.18,
        repeat_last_n: 128,
        num_predict: 1400,
      }
    })
  });

  if (!res.ok) {
    throw new Error(`Ollama error HTTP ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  const elapsedMs = Date.now() - startTime;

  return {
    response: data.response,
    promptTokens: data.prompt_eval_count || 0,
    completionTokens: data.eval_count || 0,
    totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
    evalDurationNs: data.eval_duration || 0,
    totalDurationNs: data.total_duration || 0,
    elapsedMs,
  };
}

function extractCode(raw) {
  let text = raw.trim();
  if (text.startsWith('```html')) {
    text = text.replace(/^```html\s*\n?/, '').replace(/\n?```\s*$/, '');
  } else if (text.startsWith('```')) {
    text = text.replace(/^```\w*\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  return text.trim();
}

async function main() {
  const baseDir = path.resolve('brad-demos/g');

  console.log('=== STEP 1: Driving 7B AI (Gamepress Flappy Bird) ===');
  const gamepressPrompt = `Write a complete, single-file HTML5 Flappy Bird replica index.html using the Gamepress engine.
Use this exact Gamepress API:
<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><title>FLAPPY 7B GP</title></head>
<body>
<script type="module">
import { createGame, sfx, comboPitch, clamp, rnd } from '../_vendor/gp2d.js';

const g = createGame({ id: 'flappy-7b-gp', title: 'FLAPPY 7B', sub: 'Tap to flap', hook: '7B Model Replica', bg: '#4ec0ca' });

let bird = { x: 120, y: 300, vy: 0 };
let pipes = [];
let groundX = 0;

function reset() {
  bird = { x: 120, y: 300, vy: 0 };
  pipes = [{ x: 500, gy: 200, scored: false }, { x: 760, gy: 320, scored: false }];
  g.score = 0;
}
g.onReset = reset;
reset();

function flap() {
  bird.vy = -380;
  sfx('jump');
}

function update(dt) {
  if (g.mode !== 'play') return;
  if (g.pressed.Space || g.taps.length > 0) flap();
  bird.vy += 1200 * dt;
  bird.y += bird.vy * dt;
  groundX = (groundX - 200 * dt) % 24;

  for (let p of pipes) {
    p.x -= 200 * dt;
    if (!p.scored && p.x + 80 < bird.x) {
      p.scored = true;
      g.score++;
      sfx('coin', { pitch: comboPitch(g.score) });
    }
  }
  if (pipes[0].x < -90) {
    pipes.shift();
    pipes.push({ x: pipes[pipes.length - 1].x + 260, gy: rnd(120, g.H - 280), scored: false });
  }

  // Collisions
  if (bird.y > g.H - 90 || bird.y < 0) {
    sfx('hit');
    g.end({ win: false, score: g.score });
  }
  for (let p of pipes) {
    if (bird.x + 18 > p.x && bird.x - 18 < p.x + 80) {
      if (bird.y - 18 < p.gy || bird.y + 18 > p.gy + 190) {
        sfx('hit');
        g.end({ win: false, score: g.score });
      }
    }
  }
}

function draw(c) {
  // Draw sky, green pipes with gap, ground at g.H - 90, yellow circle bird with eye and beak, and g.text for score.
}
g.run(update, draw);
</script></body></html>

Complete the draw(c) function and return the full, working index.html file.`;

  const qwenGamepress = await queryOllama(gamepressPrompt, 'You output ONLY executable index.html code.');
  const qwenGamepressCode = extractCode(qwenGamepress.response);

  const dir7bGamepress = path.join(baseDir, 'flappy-7b-gamepress');
  fs.mkdirSync(dir7bGamepress, { recursive: true });
  fs.writeFileSync(path.join(dir7bGamepress, 'index.html'), qwenGamepressCode, 'utf8');

  console.log(`[7B Gamepress] Done: ${qwenGamepress.completionTokens} tokens generated in ${(qwenGamepress.elapsedMs / 1000).toFixed(2)}s`);

  console.log('\n=== STEP 2: Driving 7B AI (Vanilla Canvas/JS Flappy Bird) ===');
  const vanillaPrompt = `Write a complete, single-file HTML5 Flappy Bird replica index.html using pure Canvas and JavaScript (NO external libraries).
Requirements:
- Single HTML file with inline CSS and <script>
- Canvas 400x600 centered on screen with blue sky background
- Yellow circular bird that jumps when spacebar or canvas clicked/touched
- Gravity pulling bird down, with tilt rotation
- Moving green pipe obstacles with top and bottom openings (gap 180px)
- Score increments when passing pipes
- Ground at bottom with green grass stripe
- Web Audio API for flap and hit sounds
- Game over screen displaying Score and High Score, with click to restart
Output ONLY the clean executable index.html code.`;

  const qwenVanilla = await queryOllama(vanillaPrompt, 'You output ONLY executable index.html code.');
  const qwenVanillaCode = extractCode(qwenVanilla.response);

  const dir7bVanilla = path.join(baseDir, 'flappy-7b-vanilla');
  fs.mkdirSync(dir7bVanilla, { recursive: true });
  fs.writeFileSync(path.join(dir7bVanilla, 'index.html'), qwenVanillaCode, 'utf8');

  console.log(`[7B Vanilla] Done: ${qwenVanilla.completionTokens} tokens generated in ${(qwenVanilla.elapsedMs / 1000).toFixed(2)}s`);

  // Write metrics JSON
  const metrics = {
    model_7b: {
      name: MODEL,
      gamepress: {
        promptTokens: qwenGamepress.promptTokens,
        completionTokens: qwenGamepress.completionTokens,
        totalTokens: qwenGamepress.totalTokens,
        elapsedSeconds: +(qwenGamepress.elapsedMs / 1000).toFixed(2),
        codeBytes: Buffer.byteLength(qwenGamepressCode, 'utf8'),
        linesOfCode: qwenGamepressCode.split('\n').length
      },
      vanilla: {
        promptTokens: qwenVanilla.promptTokens,
        completionTokens: qwenVanilla.completionTokens,
        totalTokens: qwenVanilla.totalTokens,
        elapsedSeconds: +(qwenVanilla.elapsedMs / 1000).toFixed(2),
        codeBytes: Buffer.byteLength(qwenVanillaCode, 'utf8'),
        linesOfCode: qwenVanillaCode.split('\n').length
      }
    }
  };

  fs.writeFileSync('brad-demos/_qa/flappy_7b_metrics.json', JSON.stringify(metrics, null, 2), 'utf8');
  console.log('\nSaved 7B metrics to brad-demos/_qa/flappy_7b_metrics.json');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
