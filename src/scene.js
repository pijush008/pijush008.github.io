import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'

export function createScene(container) {
  // Guard: if the container is hidden (e.g. prefers-reduced-motion), skip the scene.
  if (!container || container.clientWidth === 0 || container.clientHeight === 0) {
    return () => {}
  }

  const scene = new THREE.Scene()
  scene.fog = new THREE.FogExp2(0x07070d, 0.04)

  const camera = new THREE.PerspectiveCamera(
    55,
    container.clientWidth / container.clientHeight,
    0.1,
    100
  )
  camera.position.set(0, 0, 9)

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
  })
  renderer.setSize(container.clientWidth, container.clientHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.15
  container.appendChild(renderer.domElement)

  /* ---- Studio environment lighting (realistic reflections) ---- */
  const pmrem = new THREE.PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture

  /* ---- Post-processing: bloom ---- */
  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(container.clientWidth, container.clientHeight),
    0.55,
    0.55,
    0.32
  )
  composer.addPass(bloomPass)
  composer.addPass(new OutputPass())

  const group = new THREE.Group()
  scene.add(group)

  /* ---- Halo glow behind the core ---- */
  const haloMat = new THREE.MeshBasicMaterial({
    color: 0x7c5cff,
    transparent: true,
    opacity: 0.1,
    side: THREE.BackSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  })
  const halo = new THREE.Mesh(new THREE.SphereGeometry(3.6, 32, 32), haloMat)
  group.add(halo)

  /* ---- Core shape (bright, flat-shaded purple) ---- */
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x8b6dff,
    metalness: 0.55,
    roughness: 0.22,
    emissive: 0x4520b0,
    emissiveIntensity: 1.35,
    flatShading: true
  })
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2, 1), coreMat)
  group.add(core)

  /* ---- Inner glowing orb ---- */
  const innerMat = new THREE.MeshBasicMaterial({
    color: 0x00d4ff,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending
  })
  const inner = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 0), innerMat)
  group.add(inner)

  /* ---- Wireframe shells ---- */
  const wireCyan = new THREE.MeshBasicMaterial({
    color: 0x00d4ff,
    wireframe: true,
    transparent: true,
    opacity: 0.55
  })
  const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2, 1), wireCyan)
  group.add(shell)

  const wirePink = new THREE.MeshBasicMaterial({
    color: 0xff5c8a,
    wireframe: true,
    transparent: true,
    opacity: 0.28
  })
  const shell2 = new THREE.Mesh(new THREE.DodecahedronGeometry(3.0, 0), wirePink)
  group.add(shell2)

  /* ---- Rings ---- */
  const ringMat = (color, opacity) =>
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      side: THREE.DoubleSide,
      depthWrite: false
    })

  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(4.4, 0.035, 16, 160), ringMat(0x00d4ff, 0.45))
  ring1.rotation.x = Math.PI / 2
  group.add(ring1)

  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(5.6, 0.03, 16, 160), ringMat(0x7c5cff, 0.28))
  ring2.rotation.x = Math.PI / 2.4
  group.add(ring2)

  const ring3 = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.025, 16, 160), ringMat(0xff5c8a, 0.25))
  ring3.rotation.y = Math.PI / 2.2
  group.add(ring3)

  /* ---- Floating geometric shards ---- */
  const floaters = []
  const floaterGeometries = [
    new THREE.OctahedronGeometry(0.18, 0),
    new THREE.TetrahedronGeometry(0.2, 0),
    new THREE.IcosahedronGeometry(0.14, 0),
    new THREE.BoxGeometry(0.18, 0.18, 0.18)
  ]
  const floaterColors = [0x8b6dff, 0x00d4ff, 0xff5c8a, 0xffb86b]
  for (let i = 0; i < 30; i++) {
    const mat = new THREE.MeshStandardMaterial({
      color: floaterColors[i % floaterColors.length],
      metalness: 0.6,
      roughness: 0.25,
      emissive: floaterColors[i % floaterColors.length],
      emissiveIntensity: 0.5,
      flatShading: true
    })
    const mesh = new THREE.Mesh(
      floaterGeometries[i % floaterGeometries.length],
      mat
    )
    const radius = 3.4 + Math.random() * 6
    const angle = Math.random() * Math.PI * 2
    const vert = (Math.random() - 0.5) * 7
    mesh.position.set(
      Math.cos(angle) * radius,
      vert,
      Math.sin(angle) * radius - 2
    )
    const speed = 0.3 + Math.random() * 0.7
    const offset = Math.random() * Math.PI * 2
    scene.add(mesh)
    floaters.push({ mesh, speed, offset, base: { x: mesh.position.x, y: mesh.position.y } })
  }

  /* ---- Holographic grid floor ---- */
  function createGridTexture(color, size = 512, cells = 8) {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const ctx = canvas.getContext('2d')
    const step = size / cells
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    for (let i = 0; i <= cells; i++) {
      const p = i * step
      ctx.beginPath()
      ctx.moveTo(p + 0.5, 0)
      ctx.lineTo(p + 0.5, size)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, p + 0.5)
      ctx.lineTo(size, p + 0.5)
      ctx.stroke()
    }
    const tex = new THREE.CanvasTexture(canvas)
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(16, 16)
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy()
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(90, 90),
    new THREE.MeshBasicMaterial({
      map: createGridTexture('rgba(124, 92, 255, 0.5)', 512, 8),
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    })
  )
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -3.2
  scene.add(floor)

  const floorCyan = new THREE.Mesh(
    new THREE.PlaneGeometry(90, 90),
    new THREE.MeshBasicMaterial({
      map: createGridTexture('rgba(0, 212, 255, 0.4)', 512, 16),
      transparent: true,
      opacity: 0.1,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    })
  )
  floorCyan.rotation.x = -Math.PI / 2
  floorCyan.position.y = -3.18
  scene.add(floorCyan)

  /* ---- Soft radial glow under the core ---- */
  function createGlowTexture() {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 256
    const ctx = canvas.getContext('2d')
    const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128)
    grad.addColorStop(0, 'rgba(124, 92, 255, 0.55)')
    grad.addColorStop(0.5, 'rgba(124, 92, 255, 0.18)')
    grad.addColorStop(1, 'rgba(124, 92, 255, 0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 256, 256)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }

  const glowDisc = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 24),
    new THREE.MeshBasicMaterial({
      map: createGlowTexture(),
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  )
  glowDisc.rotation.x = -Math.PI / 2
  glowDisc.position.y = -3.16
  scene.add(glowDisc)

  /* ---- Starfield (three tones) ---- */
  function makeStars(count, size, color, opacity = 0.9) {
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 40
      positions[i * 3 + 1] = (Math.random() - 0.5) * 26
      positions[i * 3 + 2] = (Math.random() - 0.5) * 20 - 4
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const mat = new THREE.PointsMaterial({
      color,
      size,
      transparent: true,
      opacity,
      sizeAttenuation: true
    })
    return new THREE.Points(geo, mat)
  }

  const starsPurple = makeStars(1800, 0.06, 0x8b6dff)
  const starsCyan = makeStars(1000, 0.045, 0x00d4ff)
  const starsWhite = makeStars(700, 0.03, 0xffffff, 0.7)
  scene.add(starsPurple, starsCyan, starsWhite)

  /* ---- Lights ---- */
  const pointLight = new THREE.PointLight(0xffffff, 60, 30)
  pointLight.position.set(5, 4, 5)
  scene.add(pointLight)

  const colorLights = []
  const lightColors = [0x8b6dff, 0x00d4ff, 0xff5c8a]
  lightColors.forEach((color, i) => {
    const light = new THREE.PointLight(color, 55, 24)
    light.position.set(
      Math.cos((i / lightColors.length) * Math.PI * 2) * 6,
      Math.sin((i / lightColors.length) * Math.PI * 2) * 3,
      4
    )
    scene.add(light)
    colorLights.push(light)
  })

  const mouse = { x: 0, y: 0 }
  const targetMouse = { x: 0, y: 0 }

  window.addEventListener('mousemove', (e) => {
    targetMouse.x = (e.clientX / window.innerWidth) * 2 - 1
    targetMouse.y = (e.clientY / window.innerHeight) * 2 - 1
  })

  let time = 0

  function animate() {
    requestAnimationFrame(animate)
    time += 0.005

    mouse.x += (targetMouse.x - mouse.x) * 0.06
    mouse.y += (targetMouse.y - mouse.y) * 0.06

    /* Scroll parallax — the scene drifts as you move down the page */
    const scrollY = window.scrollY || 0

    group.rotation.x = mouse.y * 0.5 + Math.sin(time * 0.6) * 0.15
    group.rotation.y = mouse.x * 0.7 + time * 0.8
    core.rotation.y = -time * 1.8
    core.rotation.x = time * 0.9
    inner.rotation.y = time * 2.4
    inner.rotation.z = time * 1.2
    shell.rotation.y = time * 0.5
    shell.rotation.z = time * 0.35
    shell2.rotation.y = -time * 0.35
    shell2.rotation.x = time * 0.25

    ring1.rotation.z = time * 0.9
    ring2.rotation.z = -time * 0.6
    ring3.rotation.x = time * 0.5

    starsPurple.rotation.y = time * 0.05
    starsCyan.rotation.y = -time * 0.04
    starsWhite.rotation.y = time * 0.03

    floaters.forEach((f) => {
      f.mesh.position.x = f.base.x + Math.sin(time * f.speed * 2 + f.offset) * 0.8
      f.mesh.position.y = f.base.y + Math.cos(time * f.speed * 1.5 + f.offset) * 0.8
      f.mesh.rotation.x += 0.012 * f.speed
      f.mesh.rotation.y += 0.018 * f.speed
    })

    colorLights.forEach((light, i) => {
      light.position.x = Math.cos(time * (1 + i * 0.4) + i * 2.1) * 6
      light.position.z = Math.sin(time * (1 + i * 0.4) + i * 2.1) * 6
      light.position.y = Math.sin(time * 0.8 + i * 1.7) * 3
    })

    camera.position.x = mouse.x * 0.5
    camera.position.y = mouse.y * 0.35 - scrollY * 0.0006
    camera.position.z = 9 - Math.min(scrollY * 0.0007, 2.2)
    camera.lookAt(0, 0, 0)

    composer.render()
  }

  function onResize() {
    const w = container.clientWidth
    const h = container.clientHeight
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
    composer.setSize(w, h)

    const small = w < 700
    group.scale.setScalar(small ? 0.62 : 1)
    group.position.y = small ? 0.6 : 0
  }

  window.addEventListener('resize', onResize)
  onResize()

  animate()

  return () => {
    window.removeEventListener('resize', onResize)
    scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose()
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
        mats.forEach((m) => {
          for (const key of Object.keys(m)) {
            const value = m[key]
            if (value && value.isTexture) value.dispose()
          }
          m.dispose()
        })
      }
    })
    pmrem.dispose()
    bloomPass.dispose()
    composer.dispose()
    renderer.dispose()
    if (renderer.domElement.parentNode === container) {
      container.removeChild(renderer.domElement)
    }
  }
}
