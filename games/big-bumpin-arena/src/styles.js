// Style packs: one game, four skins. A pack is data only: palette + material mode + outline pass + lighting rig +
// post FX + UI theme. The renderer reads the active pack every frame, so packs switch at runtime; the sim never
// sees any of this. CEL is the default (hero) look; trailers and thumbnails use the default.
//   mat      how a solid is shaded: 'cel' hard two-tone, 'gloss' smooth clearcoat gradient + specular, 'flat' one colour
//   outline  ink line width in world px (0 = no outline pass)
//   light    key-light direction on screen, drop shadow [dx, dy, alpha], specular strength
//   post     pixel: low-res render-target width in px (0 = off), bloom 0..1, vignette 0..1
//   deco     arena dressing: 'burst' impact stars, 'beams' sweeping light cones, 'bulbs' marquee chase lights
//   floor    per surface [a, b, line] : the asphalt / ice / dirt palette swap lives here
//   ui       theme variables for the HUD and the menus
//   fx       optional premium lighting passes (PRIME): soft shadows, raised walls, floodlight pools + edge occlusion,
//            headlight beams, a ball light, team under-glow, persistent skid marks, film grain
export const STYLE_ORDER = ['cel', 'glossy', 'pixel', 'fairground', 'prime'];
export const STYLES = {
  cel: {
    name: 'CEL', mat: 'cel', outline: 4.5, light: { dir: [-0.55, -0.83], shadow: [7, 9, 0.28], spec: 0.9 }, post: { pixel: 0, bloom: 0, vignette: 0.1 }, deco: 'pennants', groundMix: 0.35,
    pal: { bg: '#3a4fd0', wall: '#4664ee', wallDark: '#2c3fb4', trim: '#ffffff', skirt: '#2a2f4a', team: ['#ff3b4e', '#1e7bff'], teamDark: ['#b3142c', '#0f4bb8'], teamLite: ['#ff8a96', '#86bcff'],
      ball: '#ffd21f', ballDark: '#e08a00', ink: '#16132e', text: '#ffffff', turbo: '#3dffd0', accent: '#ffd21f', net: 'rgba(255,255,255,.35)', pad: '#3dffd0', glow: '#ff7a1a' },
    floor: { asphalt: ['#b4c2e6', '#bfcbec', 'rgba(40,60,160,.5)'], ice: ['#b9ecf2', '#caf3f7', 'rgba(30,110,170,.55)'], dirt: ['#e0b074', '#d6a468', 'rgba(110,60,20,.5)'] },
    ui: { font: '"Avenir Next", "Trebuchet MS", system-ui, sans-serif', weight: 900, panel: 'rgba(22,19,46,.9)', panelText: '#ffffff', radius: 14, stroke: '#16132e', title: '#ffd21f', sub: '#ffffff', button: '#2e9bff', buttonText: '#ffffff', page: 'rgba(26,24,56,.9)' },
  },
  glossy: {
    name: 'GLOSSY', mat: 'gloss', outline: 0, light: { dir: [-0.4, -0.92], shadow: [10, 14, 0.5], spec: 1 }, post: { pixel: 0, bloom: 0.42, vignette: 0.5 }, deco: 'beams', groundMix: 0.82,
    pal: { bg: '#04050c', wall: '#5d6880', wallDark: '#1a2030', team: ['#ff2e4d', '#1f8bff'], teamDark: ['#5e0716', '#06255e'], teamLite: ['#ffc2cc', '#cfe6ff'],
      ball: '#f4f7ff', ballDark: '#7f8aa8', ink: '#02030a', text: '#eaf2ff', turbo: '#34f5ff', accent: '#34f5ff', net: 'rgba(120,220,255,.4)', pad: '#34f5ff', glow: '#ff9d2e' },
    floor: { asphalt: ['#0d1326', '#111a33', 'rgba(52,245,255,.6)'], ice: ['#6fa6c9', '#86bbdb', 'rgba(255,255,255,.75)'], dirt: ['#4a3423', '#553d2a', 'rgba(255,200,130,.55)'] },
    ui: { font: '"Avenir Next Condensed", "Arial Narrow", system-ui, sans-serif', weight: 800, panel: 'rgba(6,10,24,.82)', panelText: '#eaf2ff', radius: 6, stroke: '#02030a', title: '#34f5ff', sub: '#eaf2ff', button: '#34f5ff', buttonText: '#04050c', page: 'rgba(4,5,12,.9)' },
  },
  pixel: {
    name: 'PIXEL', mat: 'flat', outline: 5, light: { dir: [-0.6, -0.8], shadow: [6, 8, 0.35], spec: 0 }, post: { pixel: 400, bloom: 0, vignette: 0 }, deco: 'none',
    pal: { bg: '#0f0f1b', wall: '#c2c3c7', wallDark: '#5f574f', team: ['#ff004d', '#29adff'], teamDark: ['#7e2553', '#1d2b53'], teamLite: ['#ff77a8', '#c2c3c7'],
      ball: '#ffec27', ballDark: '#ffa300', ink: '#000000', text: '#fff1e8', turbo: '#00e436', accent: '#ffec27', net: 'rgba(255,241,232,.45)', pad: '#00e436', glow: '#ffa300' },
    floor: { asphalt: ['#3a9a48', '#44a852', '#eaf7e6'], ice: ['#83c6e8', '#9fd8f2', '#1d2b53'], dirt: ['#ab5236', '#9c482e', '#ffccaa'] },
    ui: { font: '"Courier New", ui-monospace, monospace', weight: 900, panel: '#000000', panelText: '#fff1e8', radius: 0, stroke: '#000000', title: '#ffec27', sub: '#fff1e8', button: '#00e436', buttonText: '#000000', page: 'rgba(15,15,27,.94)' },
  },
  fairground: {
    name: 'FAIRGROUND', mat: 'gloss', outline: 2.5, light: { dir: [-0.5, -0.87], shadow: [8, 11, 0.32], spec: 0.8 }, post: { pixel: 0, bloom: 0.3, vignette: 0.45 }, deco: 'bulbs', groundMix: 0.7,
    pal: { bg: '#170a26', wall: '#d81b74', wallDark: '#6e0d3c', trim: '#ffc93c', skirt: '#241a38', team: ['#ff3d5a', '#22c3e6'], teamDark: ['#8f1028', '#0b6a86'], teamLite: ['#ffb0bb', '#b5f0ff'],
      ball: '#ffc93c', ballDark: '#c47a0a', ink: '#3a1408', text: '#fff6dd', turbo: '#ffe066', accent: '#ffc93c', net: 'rgba(255,246,221,.5)', pad: '#ffc93c', glow: '#ff6a2e', bulb: '#fff2a8' },
    floor: { asphalt: ['#3a1f55', '#432460', 'rgba(255,201,60,.6)'], ice: ['#5fb7c9', '#70c6d6', 'rgba(255,255,255,.7)'], dirt: ['#8a5a3a', '#96633f', 'rgba(255,201,60,.55)'] },
    ui: { font: 'Georgia, "Times New Roman", serif', weight: 900, panel: 'rgba(58,20,8,.9)', panelText: '#fff6dd', radius: 18, stroke: '#3a1408', title: '#ffc93c', sub: '#fff6dd', button: '#e3323f', buttonText: '#fff6dd', page: 'rgba(43,13,28,.92)' },
  },
};
// PRIME: the showpiece. Night stadium under floodlights, every lighting pass switched on.
STYLES.prime = {
  name: 'PRIME', mat: 'gloss', outline: 0, light: { dir: [-0.45, -0.89], shadow: [12, 18, 0.55], spec: 1 }, post: { pixel: 0, bloom: 0.5, vignette: 0.62 }, deco: 'led', groundMix: 0.86,
  fx: { soft: 9, depth: 11, pools: true, headlights: true, ballLight: true, underglow: true, skids: true, grain: 0.06 },
  pal: { bg: '#05070f', wall: '#7f8aa3', wallDark: '#232a3a', trim: '#7df9ff', skirt: '#1a1d29', team: ['#ff2f48', '#1c8dff'], teamDark: ['#6b0817', '#06306e'], teamLite: ['#ffd0d6', '#d3e8ff'],
    ball: '#fbfdff', ballDark: '#8a94ad', ink: '#03040a', text: '#f2f6ff', turbo: '#7df9ff', accent: '#ffd166', net: 'rgba(255,255,255,.45)', pad: '#7df9ff', glow: '#ff8a1f' },
  floor: { asphalt: ['#182036', '#1c2540', 'rgba(255,255,255,.5)'], ice: ['#8fc0e0', '#a2cfea', 'rgba(255,255,255,.85)'], dirt: ['#6a4930', '#735036', 'rgba(255,225,180,.55)'] },
  ui: { font: '"SF Pro Display", "Avenir Next", "Segoe UI", system-ui, sans-serif', weight: 800, panel: 'rgba(8,11,22,.78)', panelText: '#f2f6ff', radius: 10, stroke: '#03040a', title: '#ffd166', sub: '#f2f6ff', button: '#ffd166', buttonText: '#05070f', page: 'rgba(5,7,15,.88)' },
};
export const ITEM_ICON = { magnet: 'U', shock: '◎', cow: '▲', oil: '●' }; // drawn as shapes in render.js; these are the fallbacks
