import * as THREE from 'three'

export function createScene(container) {
  const scene = new THREE.Scene()

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
  container.appendChild(renderer.domElement)

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
    metalness: 0.5,
    roughness: 0.25,
    emissive: 0x4520b0,
    emissiveIntensity: 1.2,
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
      metalness: 0.5,
      roughness: 0.3,
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

  /* ---- Starfield (two tones) ---- */
  function makeStars(count, size, color) {
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
      opacity: 0.9,
      sizeAttenuation: true
    })
    return new THREE.Points(geo, mat)
  }

  const starsPurple = makeStars(1800, 0.06, 0x8b6dff)
  const starsCyan = makeStars(1000, 0.045, 0x00d4ff)
  scene.add(starsPurple, starsCyan)

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
    camera.position.y = mouse.y * 0.35
    camera.lookAt(0, 0, 0)

    renderer.render(scene, camera)
  }

  function onResize() {
    const w = container.clientWidth
    const h = container.clientHeight
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)

    const small = w < 700
    group.scale.setScalar(small ? 0.62 : 1)
    group.position.y = small ? 0.6 : 0
  }

  window.addEventListener('resize', onResize)
  onResize()

  animate()

  return () => {
    window.removeEventListener('resize', onResize)
    renderer.dispose()
    if (renderer.domElement.parentNode === container) {
      container.removeChild(renderer.domElement)
    }
  }
}
