import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'

/* ------------------------------------------------------------------ */
/*  Procedural texture helpers                                         */
/* ------------------------------------------------------------------ */

function hash2(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 69069) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

function vnoise(x, y, seed) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = x - xi
  const yf = y - yi
  const u = xf * xf * (3 - 2 * xf)
  const v = yf * yf * (3 - 2 * yf)
  const a = hash2(xi, yi, seed)
  const b = hash2(xi + 1, yi, seed)
  const c = hash2(xi, yi + 1, seed)
  const d = hash2(xi + 1, yi + 1, seed)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

function fbm(x, y, seed, octaves = 5, lacunarity = 2, gain = 0.5) {
  let amp = 1
  let freq = 1
  let sum = 0
  let norm = 0
  for (let i = 0; i < octaves; i++) {
    sum += amp * vnoise(x * freq, y * freq, seed + i * 131)
    norm += amp
    amp *= gain
    freq *= lacunarity
  }
  return sum / norm
}

function applyLimb(mat, min = 0.3, power = 0.35) {
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `
        #include <opaque_fragment>
        float _limbDot = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
        gl_FragColor.rgb *= ${min} + ${(1 - min).toFixed(2)} * pow(_limbDot, ${power});
      `
    )
  }
}

const clamp01 = (v) => Math.max(0, Math.min(1, v))
const lerp = (a, b, t) => a + (b - a) * t

function makeImageData(w, h) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  return { canvas, ctx, img: ctx.createImageData(w, h) }
}

function commitTexture(img, ctx, canvas, srgb = true) {
  ctx.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(canvas)
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

/* ------------------------------------------------------------------ */
/*  Per-planet surface generators (equirectangular, v = latitude)      */
/* ------------------------------------------------------------------ */

function genSun() {
  const W = 1024, H = 512
  const { canvas, ctx, img } = makeImageData(W, H)
  const d = img.data
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = x / W
      const v = y / H
      const lon = u * Math.PI * 2
      const lat = (v - 0.5) * Math.PI
      const mu = Math.max(0, Math.cos(lat) * Math.abs(Math.cos(lon)))
      const limb = 0.12 + 0.88 * Math.pow(mu, 0.45)
      const gran = fbm(u * 44, v * 44, 7, 4)
      const gv = (gran - 0.5) * 0.85 + fbm(u * 9, v * 9, 2, 4)
      let r = (235 + gv * 150) * limb
      let g = (150 + gv * 150) * limb
      let b = (38 + gv * 70) * limb
      const sp = fbm(u * 26, v * 26, 23, 4)
      if (sp > 0.74) {
        const k = (sp - 0.74) / 0.26
        const pen = 1 - 0.35 * k
        const core = Math.max(0, k - 0.45) / 0.55
        r *= pen * (1 - 0.85 * core)
        g *= pen * (1 - 0.8 * core)
        b *= pen * (1 - 0.65 * core)
      }
      const i = (y * W + x) * 4
      d[i] = r * 0.87; d[i + 1] = g * 0.87; d[i + 2] = b * 0.87; d[i + 3] = 255
    }
  }
  return commitTexture(img, ctx, canvas)
}

function genMercury() {
  const W = 512, H = 256
  const { canvas, ctx, img } = makeImageData(W, H)
  const d = img.data
  const craters = []
  let seedV = 12
  for (let i = 0; i < 150; i++) {
    craters.push({
      u: hash2(i, 1, seedV),
      v: hash2(i, 2, seedV),
      r: 0.012 + hash2(i, 3, seedV) * 0.04,
      depth: 0.25 + hash2(i, 4, seedV) * 0.45
    })
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = x / W
      const v = y / H
      let n = fbm(u * 6, v * 6, 5, 5)
      let r = lerp(120, 165, n) + (fbm(u * 30, v * 30, 6, 3) - 0.5) * 30
      let g = lerp(110, 150, n) + (fbm(u * 30, v * 30, 7, 3) - 0.5) * 28
      let b = lerp(95, 135, n) + (fbm(u * 30, v * 30, 8, 3) - 0.5) * 26
      for (const c of craters) {
        let dx = (u - c.u) * 1.0
        let dy = (v - c.v) * 2.0
        dx -= Math.round(dx)
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < c.r) {
          const t = dist / c.r
          const sh = 1 - c.depth * (1 - t * t)
          r *= sh; g *= sh; b *= sh
        } else if (dist < c.r * 1.25) {
          const t = 1 - (dist - c.r) / (c.r * 0.25)
          const rim = 1 + 0.28 * t
          r *= rim; g *= rim; b *= rim
        }
      }
      const i = (y * W + x) * 4
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255
    }
  }
  return commitTexture(img, ctx, canvas)
}

function genVenus() {
  const W = 512, H = 256
  const { canvas, ctx, img } = makeImageData(W, H)
  const d = img.data
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = x / W
      const v = y / H
      const swirl = fbm(u * 5 + v * 6, v * 14, 4, 5)
      const cloud = fbm(u * 10 + v * 12, v * 34, 9, 5)
      const cv = swirl * 0.7 + cloud * 0.45
      let r = lerp(214, 236, cv) - (cloud - 0.5) * 26
      let g = lerp(196, 214, cv) - (cloud - 0.5) * 24
      let b = lerp(156, 178, cv) - (cloud - 0.5) * 22
      r = Math.min(250, Math.max(120, r))
      g = Math.min(240, Math.max(110, g))
      b = Math.min(210, Math.max(90, b))
      const i = (y * W + x) * 4
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255
    }
  }
  return commitTexture(img, ctx, canvas)
}

function genEarth() {
  const W = 1024, H = 512
  const { canvas, ctx, img } = makeImageData(W, H)
  const d = img.data
  for (let y = 0; y < H; y++) {
    const v = y / H
    for (let x = 0; x < W; x++) {
      const u = x / W
      const cont = fbm(u * 4 + 7, v * 4 + 7, 101, 6, 2.2, 0.52)
      const elev = fbm(u * 9, v * 9, 207, 5)
      const detail = fbm(u * 22, v * 22, 313, 4)
      let r, g, b
      const isLand = cont > 0.545
      const polar = v < 0.09 || v > 0.91
      if (isLand) {
        if (elev > 0.6) {
          r = lerp(120, 96, detail); g = lerp(96, 78, detail); b = lerp(72, 62, detail)
        } else if (detail > 0.52 && elev > 0.45) {
          r = lerp(110, 150, detail); g = lerp(86, 128, detail); b = lerp(52, 72, detail)
        } else {
          r = lerp(58, 118, detail); g = lerp(122, 168, detail); b = lerp(52, 82, detail)
        }
        if (polar) { r = 232; g = 238; b = 246 }
        else if (elev > 0.68) { r = lerp(r, 236, 0.55); g = lerp(g, 242, 0.55); b = lerp(b, 246, 0.55) }
      } else {
        const depth = fbm(u * 5, v * 5, 521, 4)
        const shallow = 1 - Math.min(1, Math.max(0, (cont - 0.545)) / 0.05)
        r = lerp(20, 56, depth) - shallow * 12
        g = lerp(74, 122, depth) - shallow * 8
        b = lerp(132, 172, depth) + shallow * 26
        if (polar) { r = 238; g = 242; b = 248 }
      }
      const i = (y * W + x) * 4
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255
    }
  }
  return commitTexture(img, ctx, canvas)
}

function genEarthClouds() {
  const W = 1024, H = 512
  const { canvas, ctx, img } = makeImageData(W, H)
  const d = img.data
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = x / W
      const v = y / H
      const c = fbm(u * 7 + 40, v * 7, 911, 6)
      const c2 = fbm(u * 14 + 60, v * 14, 913, 4)
      const cover = c * 0.75 + c2 * 0.35
      const a = cover > 0.56 ? clamp01((cover - 0.56) / 0.3) * 220 : 0
      const i = (y * W + x) * 4
      d[i] = 255; d[i + 1] = 255; d[i + 2] = 255; d[i + 3] = a
    }
  }
  return commitTexture(img, ctx, canvas, false)
}

function genMars() {
  const W = 512, H = 256
  const { canvas, ctx, img } = makeImageData(W, H)
  const d = img.data
  for (let y = 0; y < H; y++) {
    const v = y / H
    for (let x = 0; x < W; x++) {
      const u = x / W
      const base = fbm(u * 5 + 30, v * 5, 601, 5)
      const dark = fbm(u * 12 + 40, v * 12, 603, 4)
      const fine = fbm(u * 40 + 50, v * 40, 605, 3)
      let r = lerp(150, 190, base) + (fine - 0.5) * 18
      let g = lerp(84, 108, base) + (fine - 0.5) * 12
      let b = lerp(52, 64, base) + (fine - 0.5) * 8
      if (dark > 0.62) {
        const k = clamp01((dark - 0.62) / 0.3)
        r *= 1 - 0.3 * k; g *= 1 - 0.24 * k; b *= 1 - 0.2 * k
      }
      const capEdge = fbm(u * 22, v * 22, 607, 4)
      const polar = (v < 0.05 + 0.03 * capEdge) || (v > 0.95 - 0.03 * capEdge)
      if (polar) { r = 244; g = 238; b = 228 }
      const i = (y * W + x) * 4
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255
    }
  }
  return commitTexture(img, ctx, canvas)
}

function bandPalette(stops) {
  return function (t) {
    t = clamp01(t)
    for (let i = 0; i < stops.length - 1; i++) {
      if (t <= stops[i + 1][0]) {
        const s = stops[i], e = stops[i + 1]
        const f = (t - s[0]) / (e[0] - s[0])
        return [
          lerp(s[1][0], e[1][0], f),
          lerp(s[1][1], e[1][1], f),
          lerp(s[1][2], e[1][2], f)
        ]
      }
    }
    return stops[stops.length - 1][1]
  }
}

function genJupiter() {
  const W = 1024, H = 512
  const { canvas, ctx, img } = makeImageData(W, H)
  const d = img.data
  const pal = bandPalette([
    [0.0, [198, 176, 148]],
    [0.08, [222, 204, 172]],
    [0.16, [188, 160, 132]],
    [0.24, [226, 208, 178]],
    [0.32, [196, 172, 140]],
    [0.40, [170, 138, 110]],
    [0.48, [228, 214, 188]],
    [0.56, [204, 182, 154]],
    [0.64, [180, 148, 118]],
    [0.72, [226, 210, 184]],
    [0.80, [200, 178, 150]],
    [0.88, [186, 160, 132]],
    [1.0, [214, 196, 168]]
  ])
  for (let y = 0; y < H; y++) {
    const v = y / H
    for (let x = 0; x < W; x++) {
      const u = x / W
      const distort = (fbm(u * 3 + 80, v * 14, 701, 5) - 0.5) * 0.045
      const bands = clamp01(v + distort)
      let [r, g, b] = pal(bands)
      const turb = fbm(u * 26, v * 60, 703, 4)
      const k = (turb - 0.5) * 30
      r = clamp01((r + k) / 255) * 255
      g = clamp01((g + k) / 255) * 255
      b = clamp01((b + k) / 255) * 255
      const spotU = 0.62
      const spotV = 0.285
      const du = (u - spotU)
      const dv = (v - spotV) * 0.42
      const sd = Math.sqrt(du * du + dv * dv)
      if (sd < 0.06) {
        const t = clamp01(sd / 0.06)
        const swirl = Math.sin(t * Math.PI * 4)
        const sr = lerp(176, 140, t) + swirl * 12
        const sg = lerp(84, 70, t) + swirl * 8
        const sb = lerp(52, 52, t)
        r = lerp(r, sr, 1 - t * t)
        g = lerp(g, sg, 1 - t * t)
        b = lerp(b, sb, 1 - t * t)
      }
      const i = (y * W + x) * 4
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255
    }
  }
  return commitTexture(img, ctx, canvas)
}

function genSaturn() {
  const W = 1024, H = 512
  const { canvas, ctx, img } = makeImageData(W, H)
  const d = img.data
  const pal = bandPalette([
    [0.0, [198, 182, 150]],
    [0.14, [222, 208, 176]],
    [0.26, [204, 190, 158]],
    [0.40, [228, 214, 184]],
    [0.54, [196, 180, 148]],
    [0.66, [220, 206, 176]],
    [0.78, [200, 186, 154]],
    [0.90, [226, 212, 182]],
    [1.0, [206, 192, 160]]
  ])
  for (let y = 0; y < H; y++) {
    const v = y / H
    for (let x = 0; x < W; x++) {
      const u = x / W
      const distort = (fbm(u * 2 + 100, v * 10, 801, 4) - 0.5) * 0.03
      let [r, g, b] = pal(clamp01(v + distort))
      const soft = (fbm(u * 14, v * 30, 803, 4) - 0.5) * 14
      r = clamp01((r + soft) / 255) * 255
      g = clamp01((g + soft) / 255) * 255
      b = clamp01((b + soft) / 255) * 255
      const i = (y * W + x) * 4
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255
    }
  }
  return commitTexture(img, ctx, canvas)
}

function genUranus() {
  const W = 512, H = 256
  const { canvas, ctx, img } = makeImageData(W, H)
  const d = img.data
  for (let y = 0; y < H; y++) {
    const v = y / H
    for (let x = 0; x < W; x++) {
      const u = x / W
      const n = fbm(u * 4, v * 8, 901, 4)
      const r = 160 + n * 18
      const g = 208 + n * 12
      const b = 226 + n * 8
      const i = (y * W + x) * 4
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255
    }
  }
  return commitTexture(img, ctx, canvas)
}

function genNeptune() {
  const W = 512, H = 256
  const { canvas, ctx, img } = makeImageData(W, H)
  const d = img.data
  for (let y = 0; y < H; y++) {
    const v = y / H
    for (let x = 0; x < W; x++) {
      const u = x / W
      const n = fbm(u * 4, v * 12, 1001, 5)
      let r = lerp(32, 70, n)
      let g = lerp(74, 128, n)
      let b = lerp(196, 240, n)
      const du = u - 0.38
      const dv = (v - 0.34) * 0.6
      const sd = Math.sqrt(du * du + dv * dv)
      if (sd < 0.055) {
        const t = clamp01(sd / 0.055)
        r = lerp(r, 22, 1 - t * t)
        g = lerp(g, 48, 1 - t * t)
        b = lerp(b, 150, 1 - t * t)
      }
      const i = (y * W + x) * 4
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255
    }
  }
  return commitTexture(img, ctx, canvas)
}

function genSaturnRings() {
  const W = 1024, H = 4
  const { canvas, ctx, img } = makeImageData(W, H)
  const d = img.data
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const t = x / (W - 1)
      let alpha = 0
      let col = 220
      const grain = 0.85 + fbm(t * 60, y * 2, 33, 3) * 0.3
      if (t < 0.16) alpha = 0.22 * grain
      else if (t < 0.22) alpha = 0.08 * grain
      else if (t < 0.62) alpha = 0.95 * grain
      else if (t < 0.66) alpha = 0.06 * grain
      else if (t < 0.9) alpha = 0.72 * grain
      else alpha = 0.1 * grain
      if (t > 0.42 && t < 0.5) alpha *= 0.55
      col = lerp(224, 196, fbm(t * 26, y * 3, 44, 3)) * 0.9 + 20
      const i = (y * W + x) * 4
      d[i] = col; d[i + 1] = col * 0.92; d[i + 2] = col * 0.78; d[i + 3] = alpha * 255
    }
  }
  return commitTexture(img, ctx, canvas)
}

function genMoon() {
  const W = 256, H = 128
  const { canvas, ctx, img } = makeImageData(W, H)
  const d = img.data
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = x / W
      const v = y / H
      const n = fbm(u * 8, v * 8, 33, 5)
      const fine = (fbm(u * 30, v * 30, 37, 3) - 0.5) * 24
      let r = lerp(128, 168, n) + fine
      let g = lerp(124, 162, n) + fine
      let b = lerp(118, 156, n) + fine
      for (let c = 0; c < 60; c++) {
        const cu = hash2(c, 1, 99)
        const cv = hash2(c, 2, 99)
        const cr = 0.008 + hash2(c, 3, 99) * 0.035
        let dx = u - cu
        let dy = (v - cv) * 2
        dx -= Math.round(dx)
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < cr) {
          const k = 1 - (1 - dist / cr) * 0.6
          r *= k; g *= k; b *= k
        }
      }
      const i = (y * W + x) * 4
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255
    }
  }
  return commitTexture(img, ctx, canvas)
}

/* ------------------------------------------------------------------ */
/*  Scene                                                              */
/* ------------------------------------------------------------------ */

export function createScene(container, reducedMotion = false) {
  if (!container || container.clientWidth === 0 || container.clientHeight === 0) {
    return () => {}
  }

  const scene = new THREE.Scene()

  const camera = new THREE.PerspectiveCamera(
    55,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
  )
  camera.position.set(0, 6, 28)

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
  })
  const isSmall = container.clientWidth < 768
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isSmall ? 1.5 : 2))
  renderer.setSize(container.clientWidth, container.clientHeight)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  container.appendChild(renderer.domElement)

  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(container.clientWidth, container.clientHeight),
    reducedMotion ? 0.15 : 0.35,
    0.6,
    0.72
  )
  composer.addPass(bloomPass)
  composer.addPass(new OutputPass())

  const disposed = []
  const track = (tex) => disposed.push(tex)

  const sceneGroup = new THREE.Group()
  scene.add(sceneGroup)

  /* ---------- Sun ---------- */
  const sunRadius = 1.7
  const sunTex = genSun(); track(sunTex)
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(sunRadius, 64, 64),
    new THREE.MeshBasicMaterial({ map: sunTex })
  )
  sceneGroup.add(sun)

  /* ---------- Lights ---------- */
  const sunLight = new THREE.PointLight(0xfff1de, 5.2, 0, 0)
  scene.add(sunLight)

  const ambient = new THREE.AmbientLight(0x1a2440, 0.3)
  scene.add(ambient)

  const fill = new THREE.DirectionalLight(0x4a6a9e, 0.3)
  fill.position.set(-6, 2, -8)
  scene.add(fill)

  const rim = new THREE.DirectionalLight(0x8fa8d8, 0.6)
  rim.position.set(8, 4, 12)
  scene.add(rim)

  /* ---------- Planets ---------- */
  const DIST = 0.75
  const planetsData = [
    { name: 'Mercury', radius: 0.24, distance: 3.6 * DIST, tex: genMercury, tilt: 0.03, speed: 0.03, spin: 0.35, atmos: 0x8a7f72, atmosI: 0.05, inclination: 0.045 },
    { name: 'Venus', radius: 0.36, distance: 5.2 * DIST, tex: genVenus, tilt: 3.08, speed: 0.022, spin: -0.1, atmos: 0xe8cfa0, atmosI: 0.12, inclination: 0.035 },
    { name: 'Earth', radius: 0.38, distance: 6.9 * DIST, tex: genEarth, tilt: 0.41, speed: 0.018, spin: 1.0, atmos: 0x5fa8ff, atmosI: 0.32, inclination: 0, moon: true },
    { name: 'Mars', radius: 0.3, distance: 8.7 * DIST, tex: genMars, tilt: 0.44, speed: 0.014, spin: 0.95, atmos: 0xc96a4a, atmosI: 0.1, inclination: 0.032 },
    { name: 'Jupiter', radius: 0.64, distance: 12.0 * DIST, tex: genJupiter, tilt: 0.05, speed: 0.008, spin: 2.2, atmos: 0xb89b7a, atmosI: 0.08, inclination: 0.023 },
    { name: 'Saturn', radius: 0.56, distance: 15.5 * DIST, tex: genSaturn, tilt: 0.47, speed: 0.006, spin: 2.0, atmos: 0xcfb98d, atmosI: 0.12, inclination: 0.042, rings: true },
    { name: 'Uranus', radius: 0.48, distance: 18.6 * DIST, tex: genUranus, tilt: 1.71, speed: 0.004, spin: 1.4, atmos: 0x9fd4e6, atmosI: 0.14, inclination: 0.015, rings: true, ringTint: 0x9fc4d8 },
    { name: 'Neptune', radius: 0.46, distance: 21.4 * DIST, tex: genNeptune, tilt: 0.49, speed: 0.003, spin: 1.5, atmos: 0x4a78e8, atmosI: 0.22, inclination: 0.026 }
  ]

  const ringTex = genSaturnRings(); track(ringTex)
  const moonTex = genMoon(); track(moonTex)

  const planets = []

  planetsData.forEach((p) => {
    const pivot = new THREE.Group()
    pivot.rotation.z = p.inclination
    sceneGroup.add(pivot)

    const group = new THREE.Group()
    pivot.add(group)

    const tex = p.tex(); track(tex)
    const tilt = new THREE.Group()
    tilt.rotation.z = p.tilt
    group.add(tilt)

    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.78,
      metalness: 0.02
    })
    applyLimb(mat)
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(p.radius, 48, 48), mat)
    tilt.add(mesh)

    if (p.atmosI > 0) {
      const aMat = new THREE.MeshBasicMaterial({
        color: p.atmos,
        transparent: true,
        opacity: p.atmosI,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
      const atmo = new THREE.Mesh(new THREE.SphereGeometry(p.radius * 1.045, 48, 48), aMat)
      tilt.add(atmo)
    }

    if (p.rings) {
      const ringGeom = buildRingGeometry(p.radius * 1.35, p.radius * 2.6, 160)
      const tint = p.ringTint || 0xd8c496
      const ringMat = new THREE.MeshBasicMaterial({
        map: ringTex,
        color: tint,
        transparent: true,
        opacity: 0.92,
        side: THREE.DoubleSide,
        depthWrite: false
      })
      const ring = new THREE.Mesh(ringGeom, ringMat)
      ring.rotation.x = Math.PI / 2
      tilt.add(ring)
    }

    if (p.moon) {
      const moonMat = new THREE.MeshStandardMaterial({ map: moonTex, roughness: 1 })
      applyLimb(moonMat, 0.4, 0.5)
      const moonMesh = new THREE.Mesh(new THREE.SphereGeometry(0.085, 24, 24), moonMat)
      const moonPivot = new THREE.Group()
      tilt.add(moonPivot)
      moonPivot.add(moonMesh)
      moonMesh.position.x = p.radius * 1.8
      planets.push({
        pivot, group, tilt, mesh, data: p, angle: Math.random() * Math.PI * 2,
        moonPivot, moonMesh
      })
    } else {
      planets.push({ pivot, group, tilt, mesh, data: p, angle: Math.random() * Math.PI * 2 })
    }
  })

  /* Saturn ring geometry with correct radial UVs */
  function buildRingGeometry(innerR, outerR, segments) {
    const positions = []
    const uvs = []
    const indices = []
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2
      const c = Math.cos(theta)
      const s = Math.sin(theta)
      positions.push(c * innerR, 0, s * innerR)
      uvs.push(0, i / segments)
      positions.push(c * outerR, 0, s * outerR)
      uvs.push(1, i / segments)
    }
    for (let i = 0; i < segments; i++) {
      const a = i * 2, b = i * 2 + 1, cc = i * 2 + 2, dd = i * 2 + 3
      indices.push(a, b, cc, b, dd, cc)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    geo.setIndex(indices)
    geo.computeVertexNormals()
    return geo
  }

  /* Orbit lines */
  planetsData.forEach((p) => {
    const pts = []
    const seg = 160
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2
      pts.push(new THREE.Vector3(Math.cos(a) * p.distance, 0, Math.sin(a) * p.distance))
    }
    const orbit = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: 0x3c4a68, transparent: true, opacity: 0.16 })
    )
    const pivot = new THREE.Group()
    pivot.rotation.z = p.inclination
    pivot.add(orbit)
    sceneGroup.add(pivot)
  })

  /* ---------- Star field ---------- */
  function buildStars(count, maxSize, bright) {
    const pos = new Float32Array(count * 3)
    const col = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const r = 40 + Math.random() * 120
      const th = Math.random() * Math.PI * 2
      const ph = Math.acos(2 * Math.random() - 1)
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th)
      pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th)
      pos[i * 3 + 2] = r * Math.cos(ph)
      const t = Math.random()
      let cr = 0.9, cg = 0.9, cb = 0.95
      if (t < 0.2) { cr = 1; cg = 0.82; cb = 0.6 }
      else if (t > 0.85) { cr = 0.75; cg = 0.85; cb = 1 }
      const s = 0.6 + Math.random() * 0.4
      col[i * 3] = cr * s; col[i * 3 + 1] = cg * s; col[i * 3 + 2] = cb * s
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    const m = new THREE.PointsMaterial({
      size: bright ? 0.28 : 0.12,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      sizeAttenuation: true
    })
    return new THREE.Points(g, m)
  }
  const stars = buildStars(2600, 0.28, false)
  const starsBright = buildStars(140, 0.4, true)
  scene.add(stars)
  scene.add(starsBright)

  /* ---------- Interaction ---------- */
  const mouse = { x: 0, y: 0 }
  const targetMouse = { x: 0, y: 0 }
  window.addEventListener('mousemove', onMouseMove)
  function onMouseMove(e) {
    targetMouse.x = (e.clientX / window.innerWidth) * 2 - 1
    targetMouse.y = -(e.clientY / window.innerHeight) * 2 + 1
  }

  let time = 0
  let rafId = 0

  function animate() {
    rafId = requestAnimationFrame(animate)
    time += 0.005

    mouse.x += (targetMouse.x - mouse.x) * 0.045
    mouse.y += (targetMouse.y - mouse.y) * 0.045

    const scrollY = window.scrollY || 0

    sceneGroup.rotation.x = mouse.y * 0.05
    sceneGroup.rotation.y = mouse.x * 0.15 + time * 0.012

    planets.forEach((pl) => {
      pl.angle += pl.data.speed
      pl.group.position.set(Math.cos(pl.angle) * pl.data.distance, 0, Math.sin(pl.angle) * pl.data.distance)
      pl.tilt.rotation.y = time * pl.data.spin
      if (pl.moonPivot) {
        pl.moonPivot.rotation.y = time * 6
        pl.moonMesh.rotation.y = time * 2
      }
    })

    stars.rotation.y = time * 0.004
    starsBright.rotation.y = -time * 0.003

    camera.position.x = mouse.x * 2.2
    camera.position.y = 6 - scrollY * 0.0006 + mouse.y * 0.35
    camera.position.z = 28 - Math.min(scrollY * 0.0005, 6)
    camera.lookAt(0, -4.2, 0)

    composer.render()
  }

  function onResize() {
    const w = container.clientWidth
    const h = container.clientHeight
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, w < 768 ? 1.5 : 2))
    renderer.setSize(w, h)
    composer.setSize(w, h)

    const scale = w < 480 ? 0.95 : w < 768 ? 1.1 : 1
    sceneGroup.scale.setScalar(scale)

    if (reducedMotion) composer.render()
  }
  window.addEventListener('resize', onResize)
  onResize()

  if (reducedMotion) {
    composer.render()
  } else {
    animate()
  }

  const onVisibility = () => {
    if (reducedMotion) return
    if (document.hidden) {
      cancelAnimationFrame(rafId)
    } else {
      animate()
    }
  }
  document.addEventListener('visibilitychange', onVisibility)

  return () => {
    window.removeEventListener('resize', onResize)
    window.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('visibilitychange', onVisibility)
    scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose()
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
        mats.forEach((m) => m.dispose())
      }
    })
    disposed.forEach((t) => t.dispose())
    bloomPass.dispose()
    composer.dispose()
    renderer.dispose()
    if (renderer.domElement.parentNode === container) {
      container.removeChild(renderer.domElement)
    }
  }
}
