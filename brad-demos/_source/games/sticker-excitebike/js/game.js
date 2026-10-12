(function () {
  const pinch = (event) => {
    if (event.touches && event.touches.length > 1) event.preventDefault()
  }
  const block = (event) => event.preventDefault()
  const opts = { capture: true, passive: false }
  document.addEventListener('touchstart', pinch, opts)
  document.addEventListener('touchmove', pinch, opts)
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(type, block, opts)
  }

  const canvas = document.getElementById('game')
  const ctx = canvas.getContext('2d')
  const W = 1280
  const H = 720
  const BEST_KEY = 'excitebike-notebook-best'
  const MUTE_KEY = 'excitebike-notebook-mute'

  const keys = {
    gas: false,
    turbo: false,
    up: false,
    down: false,
    left: false,
    right: false,
  }
  let startEdge = false
  let paused = false
  let muted = localStorage.getItem(MUTE_KEY) === '1'

  const muteBtn = document.getElementById('mute')
  const setMuteUi = () => {
    if (muteBtn) muteBtn.textContent = muted ? '🔇' : '♪'
  }
  setMuteUi()
  muteBtn?.addEventListener('click', () => {
    muted = !muted
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0')
    setMuteUi()
  })

  const keymap = {
    KeyZ: 'turbo',
    KeyX: 'gas',
    Space: 'gas',
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
    KeyW: 'up',
    KeyS: 'down',
    KeyA: 'left',
    KeyD: 'right',
  }

  const kbHeld = {
    gas: false,
    turbo: false,
    up: false,
    down: false,
    left: false,
    right: false,
  }

  window.addEventListener('keydown', (event) => {
    if (event.code === 'Enter' || event.code === 'KeyP') {
      event.preventDefault()
      startEdge = true
      return
    }
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
      kbHeld.turbo = true
      event.preventDefault()
      return
    }
    const act = keymap[event.code]
    if (act) {
      kbHeld[act] = true
      event.preventDefault()
    }
  })
  window.addEventListener('keyup', (event) => {
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
      kbHeld.turbo = false
      return
    }
    const act = keymap[event.code]
    if (act) kbHeld[act] = false
  })

  const applyPad = () => {
    const nes = window.NesPad
    keys.gas = kbHeld.gas || !!(nes && nes.down('gas'))
    keys.turbo = kbHeld.turbo || !!(nes && nes.down('turbo'))
    keys.up = kbHeld.up || !!(nes && nes.down('up'))
    keys.down = kbHeld.down || !!(nes && nes.down('down'))
    keys.left = kbHeld.left || !!(nes && nes.down('left'))
    keys.right = kbHeld.right || !!(nes && nes.down('right'))
  }
  const syncHeldFromPad = () => {
    applyPad()
    const nes = window.NesPad
    if (!nes) return
    if (nes.just('start')) startEdge = true
    if (nes.just('select')) {
      muted = !muted
      localStorage.setItem(MUTE_KEY, muted ? '1' : '0')
      setMuteUi()
    }
    nes.endFrame()
  }

  const PTS = [
    [0, 168],
    [900, 168],
    [1180, 248],
    [1480, 168],
    [1760, 168],
    [1980, 300],
    [2360, 168],
    [2680, 168],
    [2860, 220],
    [3040, 168],
    [3220, 220],
    [3400, 168],
    [3720, 168],
    [4020, 360],
    [4580, 168],
    [5000, 168],
    [5280, 250],
    [5520, 250],
    [5800, 168],
    [6200, 168],
    [6480, 310],
    [6900, 168],
    [7300, 168],
    [7480, 210],
    [7660, 168],
    [7840, 210],
    [8020, 168],
    [8400, 168],
    [8800, 400],
    [9600, 168],
    [11000, 168],
  ]
  const FINISH = 10400

  function groundAt(x) {
    if (x <= PTS[0][0]) return { y: PTS[0][1], ang: 0 }
    if (x >= PTS[PTS.length - 1][0]) {
      return { y: PTS[PTS.length - 1][1], ang: 0 }
    }
    for (let i = 0; i < PTS.length - 1; i++) {
      const a = PTS[i]
      const b = PTS[i + 1]
      if (x >= a[0] && x <= b[0]) {
        const t = (x - a[0]) / (b[0] - a[0])
        const y = a[1] + (b[1] - a[1]) * t
        const ang = Math.atan2(b[1] - a[1], b[0] - a[0])
        return { y, ang }
      }
    }
    return { y: 168, ang: 0 }
  }

  function bestTime() {
    const n = Number(localStorage.getItem(BEST_KEY) ?? '0')
    return Number.isFinite(n) && n > 0 ? n : 0
  }
  function saveBest(t) {
    const prev = bestTime()
    if (!prev || t < prev) localStorage.setItem(BEST_KEY, String(t))
  }

  const bike = {
    x: 180,
    y: 168,
    vx: 0,
    vy: 0,
    pitch: 0,
    heat: 0,
    air: false,
    crash: 0,
    finished: false,
    time: 0,
    started: false,
    title: true,
  }

  function resetBike() {
    bike.x = 180
    bike.y = groundAt(180).y
    bike.vx = 0
    bike.vy = 0
    bike.pitch = 0
    bike.heat = 0
    bike.air = false
    bike.crash = 0
    bike.finished = false
    bike.time = 0
    bike.started = true
    bike.title = false
  }

  const cpus = [
    { x: 140, y: 168, vx: 0, color: '#8b1e1e', lag: 0.82 },
    { x: 100, y: 168, vx: 0, color: '#1e4a8b', lag: 0.74 },
  ]

  let audio
  function beep(freq, dur, vol = 0.04) {
    if (muted) return
    try {
      if (!audio) audio = new AudioContext()
      if (audio.state === 'suspended') audio.resume()
      const o = audio.createOscillator()
      const g = audio.createGain()
      o.frequency.value = freq
      o.type = 'square'
      g.gain.value = vol
      o.connect(g)
      g.connect(audio.destination)
      o.start()
      o.stop(audio.currentTime + dur)
    } catch {
      /* ignore */
    }
  }

  function step(dt) {
    syncHeldFromPad()
    if (startEdge) {
      startEdge = false
      if (bike.title || bike.finished || bike.crash > 1.1) resetBike()
      else if (bike.started) paused = !paused
    }
    if (bike.title || paused) return

    if (bike.crash > 0) {
      bike.crash += dt
      bike.x += bike.vx * dt
      bike.y += bike.vy * dt
      bike.vy -= 900 * dt
      bike.pitch += 6 * dt
      const g = groundAt(bike.x)
      if (bike.y < g.y) {
        bike.y = g.y
        bike.vy *= -0.2
        bike.vx *= 0.7
      }
      return
    }
    if (bike.finished) return

    bike.time += dt
    const g = groundAt(bike.x)
    const accel = keys.gas ? 520 : -140
    const turbo = keys.turbo && keys.gas
    bike.vx += accel * dt * (turbo ? 1.55 : 1)
    const vmax = turbo ? 620 : 430
    if (bike.vx > vmax) bike.vx = vmax
    if (bike.vx < 40 && keys.gas) bike.vx = 40
    if (bike.vx < 0) bike.vx = 0
    if (!keys.gas) bike.vx *= Math.pow(0.55, dt)

    if (turbo) bike.heat += 38 * dt
    else bike.heat = Math.max(0, bike.heat - 22 * dt)
    if (bike.heat >= 100) {
      bike.crash = 0.01
      bike.vx *= 0.3
      beep(90, 0.25, 0.06)
      return
    }

    if (!bike.air) {
      bike.x += bike.vx * dt
      const ng = groundAt(bike.x)
      bike.y = ng.y
      const want = ng.ang + (keys.up ? 0.42 : 0) + (keys.down ? -0.28 : 0)
      bike.pitch += (want - bike.pitch) * Math.min(1, 12 * dt)
      const next = groundAt(bike.x + 18)
      if (next.y > bike.y + 10 && bike.vx > 80) {
        bike.air = true
        bike.vy = bike.vx * Math.sin(ng.ang) + 80
        beep(520, 0.05)
      }
    } else {
      bike.x += bike.vx * dt
      bike.vy -= 980 * dt
      bike.y += bike.vy * dt
      let spin = 0
      if (keys.up || keys.left) spin += 2.4
      if (keys.down || keys.right) spin -= 2.4
      bike.pitch += spin * dt
      const ng = groundAt(bike.x)
      if (bike.y <= ng.y) {
        bike.y = ng.y
        bike.air = false
        const diff = Math.abs(bike.pitch - ng.ang)
        if (diff > 0.95) {
          bike.crash = 0.01
          beep(80, 0.3, 0.07)
        } else {
          bike.pitch = ng.ang
          bike.vy = 0
          beep(240, 0.04)
        }
      }
    }

    if (bike.x >= FINISH && !bike.finished) {
      bike.finished = true
      bike.vx = 0
      saveBest(bike.time)
      beep(660, 0.12)
      beep(880, 0.18)
    }

    for (const cpu of cpus) {
      cpu.vx += (360 * cpu.lag - cpu.vx) * 0.8 * dt
      cpu.x += cpu.vx * dt
      if (cpu.x > FINISH) cpu.x = FINISH
      cpu.y = groundAt(cpu.x).y
    }
  }

  function paper() {
    ctx.fillStyle = '#f4efe0'
    ctx.fillRect(0, 0, W, H)
    ctx.strokeStyle = '#5a8cbe55'
    ctx.lineWidth = 1
    for (let y = 36; y < H; y += 34) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(W, y)
      ctx.stroke()
    }
    ctx.strokeStyle = '#d24646aa'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(78, 0)
    ctx.lineTo(78, H)
    ctx.stroke()
  }

  function drawTrack(cam) {
    ctx.beginPath()
    ctx.moveTo(-20, H)
    for (let x = cam - 40; x < cam + W + 80; x += 12) {
      const g = groundAt(x)
      const sx = x - cam
      const sy = H - 70 - g.y
      ctx.lineTo(sx, sy)
    }
    ctx.lineTo(W + 20, H)
    ctx.closePath()
    ctx.fillStyle = '#e7d8b0'
    ctx.fill()
    ctx.strokeStyle = '#1b1b1b'
    ctx.lineWidth = 3
    ctx.stroke()

    ctx.strokeStyle = '#1b1b1b88'
    ctx.lineWidth = 1.4
    for (let x = Math.floor((cam - 40) / 70) * 70; x < cam + W; x += 70) {
      const g = groundAt(x)
      ctx.beginPath()
      ctx.moveTo(x - cam, H - 70 - g.y)
      ctx.lineTo(x - cam + 16, H - 52 - g.y)
      ctx.stroke()
    }

    const fx = FINISH - cam
    ctx.save()
    ctx.translate(fx, H - 70 - groundAt(FINISH).y)
    ctx.strokeStyle = '#1b1b1b'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(0, -120)
    ctx.stroke()
    ctx.fillStyle = '#1b1b1b'
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 3; c++) {
        if ((r + c) % 2 === 0) ctx.fillRect(4 + c * 14, -118 + r * 14, 14, 14)
      }
    }
    ctx.restore()
  }

  function drawBike(x, y, pitch, color = '#1b1b1b', wreck = false) {
    ctx.save()
    ctx.translate(x, H - 70 - y)
    ctx.rotate(-pitch)
    ctx.strokeStyle = color
    ctx.lineWidth = 3.2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.arc(-28, 8, 14, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(30, 8, 14, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(-28, 8)
    ctx.lineTo(8, -6)
    ctx.lineTo(30, 8)
    ctx.moveTo(8, -6)
    ctx.lineTo(22, -22)
    ctx.lineTo(34, -16)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(26, -32, 8, 0, Math.PI * 2)
    ctx.stroke()
    if (!wreck) {
      ctx.beginPath()
      ctx.moveTo(22, -22)
      ctx.lineTo(10, -2)
      ctx.moveTo(18, -14)
      ctx.lineTo(32, -10)
      ctx.stroke()
    }
    ctx.restore()
  }

  function hud() {
    ctx.fillStyle = '#1b1b1b'
    ctx.font = '700 28px "Patrick Hand", cursive'
    ctx.fillText('EXCITEBIKE', 96, 44)
    ctx.font = '22px "Patrick Hand", cursive'
    ctx.fillText('TRACK 1', 96, 72)
    const t = bike.time
    const clock = `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}.${String(Math.floor((t * 10) % 10))}`
    ctx.fillText(`TIME  ${clock}`, 360, 44)
    const best = bestTime()
    if (best) {
      const b = `${Math.floor(best / 60)}:${String(Math.floor(best % 60)).padStart(2, '0')}.${String(Math.floor((best * 10) % 10))}`
      ctx.fillText(`BEST  ${b}`, 360, 72)
    }
    ctx.fillText(`SPD  ${Math.round(bike.vx / 4)}`, 640, 44)
    ctx.fillText('TEMP', 820, 44)
    ctx.strokeStyle = '#1b1b1b'
    ctx.strokeRect(880, 26, 180, 20)
    ctx.fillStyle = bike.heat > 80 ? '#c0392b' : '#1b1b1b'
    ctx.fillRect(882, 28, 176 * Math.min(1, bike.heat / 100), 16)
  }

  function overlay(text, sub) {
    ctx.fillStyle = '#1b1b1bcc'
    ctx.fillRect(280, 210, 720, 220)
    ctx.strokeStyle = '#f4efe0'
    ctx.strokeRect(280, 210, 720, 220)
    ctx.fillStyle = '#f4efe0'
    ctx.font = '700 48px "Patrick Hand", cursive'
    ctx.textAlign = 'center'
    ctx.fillText(text, 640, 300)
    ctx.font = '26px "Patrick Hand", cursive'
    ctx.fillText(sub, 640, 350)
    ctx.textAlign = 'left'
  }

  let last = performance.now()
  function frame(now) {
    const dt = Math.min(0.033, (now - last) / 1000)
    last = now
    step(dt)
    paper()
    const cam = Math.max(0, bike.x - 340)
    drawTrack(cam)
    for (const cpu of cpus) {
      drawBike(cpu.x - cam, cpu.y, groundAt(cpu.x).ang, cpu.color)
    }
    drawBike(bike.x - cam, bike.y, bike.pitch, '#1b1b1b', bike.crash > 0)
    hud()
    if (bike.title) overlay('EXCITEBIKE', 'START or Enter — Track 1 dirt jumps')
    else if (paused) overlay('PAUSE', 'START to roll again')
    else if (bike.crash > 0) overlay('WIPE OUT', 'START to kick the dirt again')
    else if (bike.finished) overlay('STAGE CLEAR', 'START for another lap')
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
})()
