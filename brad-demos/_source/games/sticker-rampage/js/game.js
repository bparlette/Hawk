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
  const GROUND = 640
  const MUTE_KEY = 'rampage-notebook-mute'
  const BEST_KEY = 'rampage-notebook-best'

  const keys = {
    left: false,
    right: false,
    up: false,
    down: false,
    punch: false,
    jump: false,
  }
  let startEdge = false
  let selectEdge = false
  let punchEdge = false
  let jumpEdge = false
  let muted = localStorage.getItem(MUTE_KEY) === '1'

  const audio = {
    ctx: null,
    unlock() {
      if (!this.ctx) this.ctx = new AudioContext()
      if (this.ctx.state === 'suspended') this.ctx.resume()
    },
    beep(freq, dur, type = 'square', gain = 0.08) {
      if (muted || !this.ctx) return
      const t = this.ctx.currentTime
      const o = this.ctx.createOscillator()
      const g = this.ctx.createGain()
      o.type = type
      o.frequency.setValueAtTime(freq, t)
      g.gain.setValueAtTime(gain, t)
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
      o.connect(g)
      g.connect(this.ctx.destination)
      o.start(t)
      o.stop(t + dur)
    },
  }

  function rumble(kind) {
    if (kind === 'punch') audio.beep(140, 0.08, 'square', 0.1)
    if (kind === 'smash') audio.beep(90, 0.12, 'sawtooth', 0.09)
    if (kind === 'eat') audio.beep(420, 0.1, 'triangle', 0.07)
    if (kind === 'hurt') audio.beep(70, 0.18, 'square', 0.12)
    if (kind === 'jump') audio.beep(240, 0.08, 'triangle', 0.06)
    if (kind === 'bell') {
      audio.beep(520, 0.12, 'square', 0.08)
      setTimeout(() => audio.beep(390, 0.16, 'square', 0.08), 90)
    }
    if (kind === 'collapse') audio.beep(55, 0.35, 'sawtooth', 0.14)
  }

  const CITIES = [
    {
      id: 'sanjose',
      name: 'SAN JOSE',
      region: 'CALIFORNIA',
      state: 'CA',
      blurb: 'First city. Climb the bank, smash the windows, eat the toast, bail the dust.',
    },
    {
      id: 'peoria',
      name: 'PEORIA',
      region: 'ILLINOIS',
      state: 'IL',
      blurb: 'Midwest brick. Helicopters get mean. Punch, eat, jump before the slump.',
    },
    {
      id: 'nyc',
      name: 'NEW YORK',
      region: 'NEW YORK',
      state: 'NY',
      blurb: 'Last stop on this notebook. Flatten the skyline and punch the map.',
    },
  ]

  function cellLoot(col, row, cityIndex) {
    const n = (col * 17 + row * 9 + cityIndex * 3) % 11
    if (n === 0) return 'food'
    if (n === 1) return 'person'
    if (n === 2) return 'poison'
    if (n === 3) return 'toast'
    return null
  }

  function makeBuilding(x, floors, cols, cityIndex) {
    const cellW = 36
    const cellH = 32
    const w = cols * cellW + 16
    const h = floors * cellH + 28
    const y = GROUND - h
    const cells = []
    for (let row = 0; row < floors; row++) {
      for (let col = 0; col < cols; col++) {
        cells.push({
          col,
          row,
          hp: 2,
          loot: cellLoot(col, row, cityIndex),
          eaten: false,
        })
      }
    }
    return {
      x,
      y,
      w,
      h,
      cols,
      floors,
      cellW,
      cellH,
      cells,
      smoke: 0,
      collapsing: 0,
      rubble: false,
    }
  }

  function cityBuildings(index) {
    if (index === 0) {
      return [
        makeBuilding(180, 8, 4, 0),
        makeBuilding(520, 11, 3, 0),
        makeBuilding(860, 7, 5, 0),
      ]
    }
    if (index === 1) {
      return [
        makeBuilding(160, 9, 3, 1),
        makeBuilding(470, 6, 5, 1),
        makeBuilding(840, 12, 4, 1),
      ]
    }
    return [
      makeBuilding(140, 10, 4, 2),
      makeBuilding(500, 13, 3, 2),
      makeBuilding(820, 8, 5, 2),
    ]
  }

  const state = {
    mode: 'title',
    monster: 'george',
    city: 0,
    punched: {},
    score: 0,
    best: Number(localStorage.getItem(BEST_KEY) || 0) || 0,
    player: null,
    buildings: [],
    copter: null,
    soldiers: [],
    floaters: [],
    tell: '',
    tellT: 0,
    shake: 0,
    mapHold: 0,
  }

  function monsterStats() {
    return state.monster === 'lizzie'
      ? { speed: 3.4, climb: 3.2, jump: 13.2, name: 'LIZZIE' }
      : { speed: 2.8, climb: 3.8, jump: 12.2, name: 'GEORGE' }
  }

  function spawnCity() {
    const stats = monsterStats()
    state.buildings = cityBuildings(state.city)
    state.player = {
      x: 90,
      y: -80,
      vx: 0,
      vy: 4,
      facing: 1,
      climbing: false,
      wall: null,
      side: 1,
      health: 100,
      punchT: 0,
      invuln: 40,
      onGround: false,
    }
    state.copter = {
      x: -80,
      y: 120,
      vx: 2.4 + state.city * 0.5,
      shot: 90,
    }
    state.soldiers = [
      { x: 400, facing: 1, t: 0 },
      { x: 980, facing: -1, t: 40 },
    ]
    state.floaters = []
    state.tell = 'GO'
    state.tellT = 50
    rumble('bell')
    void stats
  }

  function buildingIntact(b) {
    if (b.rubble) return 0
    const live = b.cells.filter((c) => c.hp > 0).length
    return live / b.cells.length
  }

  function cellRect(b, cell) {
    const padX = 8
    const padY = 18
    return {
      x: b.x + padX + cell.col * b.cellW,
      y: b.y + padY + cell.row * b.cellH,
      w: b.cellW - 6,
      h: b.cellH - 6,
    }
  }

  function hurt(amount) {
    const p = state.player
    if (!p || p.invuln > 0) return
    p.health = Math.max(0, p.health - amount)
    p.invuln = 28
    state.shake = 8
    rumble('hurt')
    if (p.health <= 0) {
      state.mode = 'dead'
      state.tell = 'DOWN'
      state.tellT = 80
    }
  }

  function addFloater(x, y, text, good) {
    state.floaters.push({ x, y, text, good, t: 48 })
  }

  function eatLoot(cell, x, y) {
    if (!cell.loot || cell.eaten) return
    cell.eaten = true
    const p = state.player
    if (cell.loot === 'poison') {
      hurt(18)
      addFloater(x, y, 'POISON', false)
    } else {
      p.health = Math.min(100, p.health + (cell.loot === 'person' ? 16 : 10))
      state.score += cell.loot === 'person' ? 250 : 100
      addFloater(x, y, cell.loot === 'person' ? 'EAT' : 'YUM', true)
      rumble('eat')
    }
  }

  function tryPunch() {
    const p = state.player
    if (!p || p.punchT > 0) return
    p.punchT = 16
    rumble('punch')
    const reach = 58
    const fistX = p.x + p.facing * (keys.up || keys.down ? 8 : reach)
    const fistY = p.y - (keys.up ? 70 : keys.down ? 10 : 38)
    let hit = false
    for (const b of state.buildings) {
      if (b.rubble) continue
      for (const cell of b.cells) {
        if (cell.hp <= 0) continue
        const r = cellRect(b, cell)
        if (fistX > r.x - 8 && fistX < r.x + r.w + 8 && fistY > r.y - 8 && fistY < r.y + r.h + 8) {
          cell.hp -= 1
          hit = true
          state.score += 25
          rumble('smash')
          if (cell.hp <= 0) {
            state.score += 50
            eatLoot(cell, r.x + r.w / 2, r.y)
          }
          break
        }
      }
      if (hit) {
        const left = buildingIntact(b)
        if (left <= 0.62 && b.smoke === 0) b.smoke = 1
        if (left <= 0.34 && b.collapsing === 0) {
          b.collapsing = 90
          state.tell = 'BAIL'
          state.tellT = 50
        }
        if (left <= 0) flatten(b)
        break
      }
    }
    if (state.copter) {
      const c = state.copter
      if (Math.abs(fistX - c.x) < 40 && Math.abs(fistY - c.y) < 28) {
        state.score += 500
        addFloater(c.x, c.y, 'CHOPPER', true)
        rumble('smash')
        state.copter = {
          x: -120,
          y: 90 + Math.random() * 80,
          vx: (2.2 + state.city * 0.6) * (Math.random() > 0.5 ? 1 : 1),
          shot: 70,
        }
      }
    }
    for (const s of state.soldiers) {
      if (Math.abs(fistX - s.x) < 28 && Math.abs(fistY - (GROUND - 28)) < 40) {
        state.score += 200
        addFloater(s.x, GROUND - 50, 'SOLDIER', true)
        rumble('eat')
        state.player.health = Math.min(100, state.player.health + 8)
        s.x = 80 + Math.random() * 1100
      }
    }
  }

  function flatten(b) {
    b.rubble = true
    b.collapsing = 0
    rumble('collapse')
    state.shake = 14
    state.score += 1000
    const p = state.player
    if (p && p.climbing && p.wall === b) {
      p.climbing = false
      p.wall = null
      p.vy = 2
      hurt(22)
    }
  }

  function attachWall() {
    const p = state.player
    for (const b of state.buildings) {
      if (b.rubble) continue
      const left = Math.abs(p.x - b.x) < 22
      const right = Math.abs(p.x - (b.x + b.w)) < 22
      if ((left || right) && p.y < GROUND - 8 && p.y > b.y - 10) {
        p.climbing = true
        p.wall = b
        p.side = left ? -1 : 1
        p.x = left ? b.x : b.x + b.w
        p.vx = 0
        p.vy = 0
        p.onGround = false
        return true
      }
    }
    return false
  }

  function updateCity() {
    const p = state.player
    const stats = monsterStats()
    if (!p) return
    if (p.punchT > 0) p.punchT -= 1
    if (p.invuln > 0) p.invuln -= 1
    if (state.tellT > 0) state.tellT -= 1
    if (state.shake > 0) state.shake -= 1

    if (punchEdge) tryPunch()
    if (jumpEdge) {
      rumble('jump')
      if (p.climbing) {
        p.climbing = false
        p.wall = null
        p.vx = -p.side * 4.5
        p.vy = -stats.jump
      } else if (p.onGround) {
        p.vy = -stats.jump
        p.onGround = false
      }
    }

    if (p.climbing && p.wall && !p.wall.rubble) {
      if (keys.up) p.y -= stats.climb
      else if (keys.down) p.y += stats.climb
      if (keys.left) p.facing = -1
      if (keys.right) p.facing = 1
      p.y = Math.max(p.wall.y - 8, Math.min(GROUND - 20, p.y))
      if (p.y >= GROUND - 22) {
        p.climbing = false
        p.wall = null
        p.onGround = true
      }
      if (p.wall && p.wall.collapsing > 0 && p.wall.collapsing < 28) {
        p.climbing = false
        p.wall = null
        p.vy = 3
        hurt(16)
      }
    } else {
      if (keys.left) {
        p.vx = -stats.speed
        p.facing = -1
      } else if (keys.right) {
        p.vx = stats.speed
        p.facing = 1
      } else {
        p.vx *= 0.7
      }
      p.x += p.vx
      p.vy += 0.55
      p.y += p.vy
      p.onGround = false
      if (p.y >= GROUND) {
        p.y = GROUND
        p.vy = 0
        p.onGround = true
      }
      if (keys.up) attachWall()
    }

    p.x = Math.max(40, Math.min(W - 40, p.x))

    for (const b of state.buildings) {
      if (b.rubble) continue
      if (b.collapsing > 0) {
        b.collapsing -= 1
        if (b.collapsing === 0) flatten(b)
      }
    }

    if (state.copter) {
      const c = state.copter
      c.x += c.vx
      c.y += Math.sin(c.x / 40) * 0.4
      if (c.x > W + 80) {
        c.x = -80
        c.y = 90 + Math.random() * 90
      }
      c.shot -= 1
      if (c.shot <= 0) {
        c.shot = 70 - state.city * 8
        if (Math.abs(c.x - p.x) < 220 && Math.abs(c.y - (p.y - 40)) < 160) {
          if (Math.random() < 0.55) hurt(8)
        }
      }
    }

    for (const s of state.soldiers) {
      s.t += 1
      s.x += s.facing * 1.1
      if (s.x < 60 || s.x > W - 60) s.facing *= -1
      if (p.onGround && Math.abs(s.x - p.x) < 28 && Math.abs(p.y - GROUND) < 8) {
        hurt(6)
        s.facing = p.x < s.x ? 1 : -1
      }
    }

    state.floaters = state.floaters.filter((f) => {
      f.t -= 1
      f.y -= 0.8
      return f.t > 0
    })

    if (state.buildings.every((b) => b.rubble)) {
      state.punched[CITIES[state.city].state] = true
      state.mode = 'map'
      state.mapHold = 40
      rumble('bell')
      if (state.score > state.best) {
        state.best = state.score
        localStorage.setItem(BEST_KEY, String(state.best))
      }
    }
  }

  function paper(g) {
    g.fillStyle = '#f4efe0'
    g.fillRect(0, 0, W, H)
    g.fillStyle = '#d45a5a'
    g.fillRect(54, 0, 3, H)
    g.strokeStyle = '#7aa3c7'
    g.lineWidth = 1
    for (let y = 28; y < H; y += 28) {
      g.beginPath()
      g.moveTo(0, y)
      g.lineTo(W, y)
      g.stroke()
    }
    g.fillStyle = '#c9b48a'
    for (let y = 46; y < H; y += 108) {
      g.beginPath()
      g.arc(28, y, 9, 0, Math.PI * 2)
      g.fill()
      g.strokeStyle = '#1a1a1a'
      g.lineWidth = 1.6
      g.stroke()
    }
  }

  function strokeSet(g) {
    g.strokeStyle = '#1a1a1a'
    g.fillStyle = '#1a1a1a'
    g.lineWidth = 2.4
    g.lineCap = 'round'
    g.lineJoin = 'round'
  }

  function drawBuilding(g, b) {
    strokeSet(g)
    if (b.rubble) {
      g.beginPath()
      g.moveTo(b.x - 8, GROUND)
      g.lineTo(b.x + b.w * 0.3, GROUND - 18)
      g.lineTo(b.x + b.w * 0.55, GROUND - 8)
      g.lineTo(b.x + b.w + 6, GROUND)
      g.stroke()
      return
    }
    const jitter = b.collapsing > 0 ? (Math.random() - 0.5) * 4 : 0
    g.save()
    g.translate(jitter, b.collapsing > 0 ? 6 : 0)
    g.strokeRect(b.x, b.y, b.w, b.h)
    for (const cell of b.cells) {
      const r = cellRect(b, cell)
      if (cell.hp <= 0) {
        g.beginPath()
        g.moveTo(r.x, r.y)
        g.lineTo(r.x + r.w, r.y + r.h)
        g.moveTo(r.x + r.w, r.y)
        g.lineTo(r.x, r.y + r.h)
        g.stroke()
        if (cell.loot && !cell.eaten) {
          g.font = '18px Patrick Hand, cursive'
          g.textAlign = 'center'
          const mark =
            cell.loot === 'poison' ? '☠' : cell.loot === 'person' ? '☺' : '🍞'
          g.fillText(mark, r.x + r.w / 2, r.y + r.h / 2 + 6)
        }
      } else {
        g.strokeRect(r.x, r.y, r.w, r.h)
        if (cell.hp === 1) {
          g.beginPath()
          g.moveTo(r.x + 4, r.y + 6)
          g.lineTo(r.x + r.w - 6, r.y + r.h - 5)
          g.stroke()
        }
      }
    }
    if (b.smoke || b.collapsing) {
      g.globalAlpha = 0.55
      for (let i = 0; i < 5; i++) {
        g.beginPath()
        g.arc(b.x + 20 + i * (b.w / 6), GROUND - 12 - (i % 2) * 8, 10, 0, Math.PI * 2)
        g.stroke()
      }
      g.globalAlpha = 1
    }
    g.restore()
  }

  function drawMonster(g, p) {
    if (!p) return
    strokeSet(g)
    if (p.invuln > 0 && p.invuln % 6 < 3) g.globalAlpha = 0.35
    const x = p.x
    const y = p.y
    const lizzie = state.monster === 'lizzie'
    g.beginPath()
    if (lizzie) g.ellipse(x, y - 78, 16, 12, 0, 0, Math.PI * 2)
    else g.arc(x, y - 78, 14, 0, Math.PI * 2)
    g.stroke()
    g.beginPath()
    g.moveTo(x - 6, y - 80)
    g.lineTo(x - 2, y - 78)
    g.moveTo(x + 6, y - 80)
    g.lineTo(x + 2, y - 78)
    g.stroke()
    g.beginPath()
    g.moveTo(x, y - 64)
    g.lineTo(x, y - 28)
    g.stroke()
    const punch = p.punchT > 8
    const arm = punch ? 54 : 22
    g.beginPath()
    g.moveTo(x, y - 52)
    g.lineTo(x + p.facing * arm, y - (punch ? 40 : 48))
    g.moveTo(x, y - 50)
    g.lineTo(x - p.facing * 18, y - 44)
    g.stroke()
    if (p.climbing) {
      g.beginPath()
      g.moveTo(x, y - 28)
      g.lineTo(x - 10, y)
      g.moveTo(x, y - 28)
      g.lineTo(x + 8, y - 4)
      g.stroke()
    } else {
      g.beginPath()
      g.moveTo(x, y - 28)
      g.lineTo(x - 14, y)
      g.moveTo(x, y - 28)
      g.lineTo(x + 16, y)
      g.stroke()
    }
    if (lizzie) {
      g.beginPath()
      g.moveTo(x - p.facing * 6, y - 36)
      g.quadraticCurveTo(x - p.facing * 40, y - 20, x - p.facing * 28, y)
      g.stroke()
    }
    g.globalAlpha = 1
  }

  function drawHud(g) {
    const p = state.player
    g.fillStyle = '#f4efe0'
    g.fillRect(0, 0, W, 26)
    g.strokeStyle = '#1a1a1a'
    g.lineWidth = 1.6
    g.beginPath()
    g.moveTo(0, 26)
    g.lineTo(W, 26)
    g.stroke()
    g.font = '20px Patrick Hand, cursive'
    g.textAlign = 'left'
    g.fillStyle = '#1a1a1a'
    const city = CITIES[state.city]
    const name = monsterStats().name
    const hp = p ? p.health : 100
    g.fillText('← ARCADE', 70, 19)
    g.fillText(name, 200, 19)
    g.fillRect(268, 9, Math.max(1, hp * 0.9), 8)
    g.strokeRect(268, 9, 90, 8)
    g.fillText(city.name, 380, 19)
    g.fillText('PTS ' + state.score, 640, 19)
    g.fillText('HI ' + state.best, 820, 19)
    if (state.tellT > 0) {
      g.fillStyle = '#1a1a1a'
      g.font = '22px Patrick Hand, cursive'
      g.fillText(state.tell, 980, 19)
    }
  }

  function drawTitle(g) {
    paper(g)
    strokeSet(g)
    g.font = '72px Caveat, Patrick Hand, cursive'
    g.textAlign = 'center'
    g.fillText('RAMPAGE', W / 2, 150)
    g.font = '28px Patrick Hand, cursive'
    g.fillText('NES on lined paper. Climb, smash, eat, bail.', W / 2, 200)
    g.fillText('Punch the USA map.', W / 2, 236)

    const pick = (mx, label, who) => {
      const on = state.monster === who
      g.strokeRect(mx - 90, 300, 180, 210)
      if (on) g.strokeRect(mx - 96, 294, 192, 222)
      drawMonster(g, {
        x: mx,
        y: 470,
        facing: 1,
        punchT: 0,
        invuln: 0,
        climbing: false,
      })
      g.font = '24px Patrick Hand, cursive'
      g.fillText(label, mx, 520)
    }
    pick(430, 'GEORGE the ape', 'george')
    pick(850, 'LIZZIE the lizard', 'lizzie')

    g.font = '22px Patrick Hand, cursive'
    g.fillText('SELECT switches · START drops the blimp', W / 2, 580)
    g.fillText('A punch  ·  B jump / bail  ·  ↑ climb the wall', W / 2, 616)
  }

  function drawMap(g) {
    paper(g)
    strokeSet(g)
    g.font = '48px Caveat, cursive'
    g.textAlign = 'center'
    g.fillText('USA MAP', W / 2, 90)
    g.font = '24px Patrick Hand, cursive'
    const last = CITIES[state.city]
    g.fillText(last.region + ' punched.', W / 2, 128)

    const blobs = [
      { id: 'CA', x: 280, y: 340, rx: 70, ry: 110, label: 'CA' },
      { id: 'IL', x: 640, y: 300, rx: 50, ry: 70, label: 'IL' },
      { id: 'NY', x: 940, y: 260, rx: 55, ry: 48, label: 'NY' },
    ]
    g.beginPath()
    g.moveTo(210, 220)
    g.lineTo(1080, 200)
    g.lineTo(1100, 430)
    g.lineTo(900, 500)
    g.lineTo(240, 510)
    g.closePath()
    g.stroke()
    for (const b of blobs) {
      g.beginPath()
      g.ellipse(b.x, b.y, b.rx, b.ry, 0, 0, Math.PI * 2)
      if (state.punched[b.id]) {
        g.fillStyle = '#1a1a1a'
        g.fill()
        g.fillStyle = '#f4efe0'
        g.font = '22px Patrick Hand, cursive'
        g.fillText(b.label, b.x, b.y + 6)
        g.fillStyle = '#1a1a1a'
      } else {
        g.stroke()
        g.fillText(b.label, b.x, b.y + 6)
      }
    }
    g.font = '26px Patrick Hand, cursive'
    g.fillStyle = '#1a1a1a'
    if (state.city >= CITIES.length - 1) {
      g.fillText('Coast to coast. START to smash the states again.', W / 2, 600)
    } else {
      g.fillText('START — next city: ' + CITIES[state.city + 1].name, W / 2, 600)
    }
  }

  function drawDead(g) {
    paper(g)
    for (const b of state.buildings) drawBuilding(g, b)
    drawMonster(g, state.player)
    g.fillStyle = '#f4efe0cc'
    g.fillRect(340, 240, 600, 220)
    g.strokeStyle = '#1a1a1a'
    g.strokeRect(340, 240, 600, 220)
    g.font = '48px Caveat, cursive'
    g.textAlign = 'center'
    g.fillStyle = '#1a1a1a'
    g.fillText('DOWN', W / 2, 320)
    g.font = '24px Patrick Hand, cursive'
    g.fillText('NES continues are free. START to get up.', W / 2, 370)
    g.fillText('SELECT back to the title.', W / 2, 410)
  }

  function drawCity(g) {
    paper(g)
    g.save()
    if (state.shake) g.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 4)
    strokeSet(g)
    g.beginPath()
    g.moveTo(70, GROUND)
    g.lineTo(W - 20, GROUND)
    g.stroke()
    for (const b of state.buildings) drawBuilding(g, b)
    if (state.copter) {
      const c = state.copter
      g.beginPath()
      g.ellipse(c.x, c.y, 28, 10, 0, 0, Math.PI * 2)
      g.moveTo(c.x - 36, c.y)
      g.lineTo(c.x + 36, c.y)
      g.moveTo(c.x, c.y)
      g.lineTo(c.x, c.y + 14)
      g.stroke()
    }
    for (const s of state.soldiers) {
      g.beginPath()
      g.arc(s.x, GROUND - 28, 7, 0, Math.PI * 2)
      g.moveTo(s.x, GROUND - 21)
      g.lineTo(s.x, GROUND - 6)
      g.moveTo(s.x, GROUND - 16)
      g.lineTo(s.x + s.facing * 10, GROUND - 12)
      g.stroke()
    }
    drawMonster(g, state.player)
    for (const f of state.floaters) {
      g.globalAlpha = Math.min(1, f.t / 20)
      g.font = '22px Patrick Hand, cursive'
      g.textAlign = 'center'
      g.fillStyle = '#1a1a1a'
      g.fillText(f.text, f.x, f.y)
      g.globalAlpha = 1
    }
    g.restore()
    drawHud(g)
    // arcade back hit
    g.font = '20px Patrick Hand, cursive'
  }

  const kbHeld = {
    left: false,
    right: false,
    up: false,
    down: false,
    punch: false,
    jump: false,
  }

  function syncFromPad() {
    const nes = window.NesPad
    keys.left = kbHeld.left || !!(nes && nes.down('left'))
    keys.right = kbHeld.right || !!(nes && nes.down('right'))
    keys.up = kbHeld.up || !!(nes && nes.down('up'))
    keys.down = kbHeld.down || !!(nes && nes.down('down'))
    keys.punch = kbHeld.punch || !!(nes && (nes.down('punch') || nes.down('a')))
    keys.jump = kbHeld.jump || !!(nes && (nes.down('jump') || nes.down('b')))
    if (!nes) return
    if (nes.just('start')) startEdge = true
    if (nes.just('select')) selectEdge = true
    if (nes.just('punch') || nes.just('a')) punchEdge = true
    if (nes.just('jump') || nes.just('b')) jumpEdge = true
    nes.endFrame()
  }

  function bindPad() {
    const map = {
      ArrowLeft: 'left',
      ArrowRight: 'right',
      ArrowUp: 'up',
      ArrowDown: 'down',
      KeyZ: 'punch',
      KeyX: 'punch',
      KeyA: 'punch',
      KeyN: 'punch',
      KeyM: 'punch',
      KeyB: 'jump',
      Space: 'jump',
      KeyC: 'jump',
    }
    document.getElementById('nes-pad')?.addEventListener('nespad', () => {
      audio.unlock()
    })
    window.addEventListener('keydown', (event) => {
      audio.unlock()
      if (event.code === 'Enter' || event.code === 'KeyS') {
        if (!event.repeat) startEdge = true
        event.preventDefault()
        return
      }
      if (event.code === 'ShiftRight' || event.code === 'KeyQ') {
        if (!event.repeat) selectEdge = true
        event.preventDefault()
        return
      }
      const act = map[event.code]
      if (!act) return
      if (act === 'punch' && !event.repeat) punchEdge = true
      if (act === 'jump' && !event.repeat) jumpEdge = true
      kbHeld[act] = true
      event.preventDefault()
    })
    window.addEventListener('keyup', (event) => {
      const act = map[event.code]
      if (act) kbHeld[act] = false
    })
    document.getElementById('mute').addEventListener('click', () => {
      muted = !muted
      localStorage.setItem(MUTE_KEY, muted ? '1' : '0')
      syncMute()
    })
    canvas.addEventListener('pointerdown', (event) => {
      audio.unlock()
      const r = canvas.getBoundingClientRect()
      const x = ((event.clientX - r.left) / r.width) * W
      const y = ((event.clientY - r.top) / r.height) * H
      if (y < 30 && x < 180) {
        location.href = 'https://notebook-arcade.surge.sh/'
      }
    })
  }

  function syncMute() {
    const btn = document.getElementById('mute')
    btn.textContent = muted ? '✕' : '♪'
    btn.setAttribute('aria-pressed', muted ? 'true' : 'false')
  }

  function handleMenu() {
    if (selectEdge) {
      if (state.mode === 'title') {
        state.monster = state.monster === 'george' ? 'lizzie' : 'george'
        rumble('jump')
      } else if (state.mode === 'dead') {
        state.mode = 'title'
      } else {
        muted = !muted
        localStorage.setItem(MUTE_KEY, muted ? '1' : '0')
        syncMute()
      }
    }
    if (startEdge) {
      if (state.mode === 'title') {
        state.city = 0
        state.score = 0
        state.punched = {}
        state.mode = 'city'
        spawnCity()
      } else if (state.mode === 'map') {
        if (state.mapHold > 0) return
        if (state.city >= CITIES.length - 1) {
          state.city = 0
          state.punched = {}
          state.mode = 'title'
        } else {
          state.city += 1
          state.mode = 'city'
          spawnCity()
        }
      } else if (state.mode === 'dead') {
        state.mode = 'city'
        spawnCity()
      }
    }
  }

  function tick() {
    syncFromPad()
    if (state.mode === 'title' || state.mode === 'map' || state.mode === 'dead') {
      handleMenu()
    } else if (state.mode === 'city') {
      handleMenu()
      updateCity()
    }
    if (state.mode === 'map' && state.mapHold > 0) state.mapHold -= 1

    if (state.mode === 'title') drawTitle(ctx)
    else if (state.mode === 'map') drawMap(ctx)
    else if (state.mode === 'dead') drawDead(ctx)
    else drawCity(ctx)

    startEdge = false
    selectEdge = false
    punchEdge = false
    jumpEdge = false
    requestAnimationFrame(tick)
  }

  bindPad()
  syncMute()
  tick()
})()
