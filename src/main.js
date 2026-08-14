import './style.css'
import { createScene } from './scene.js'
import Lenis from 'lenis'

const canvasContainer = document.getElementById('bg-canvas')
const prefersReducedMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)'
).matches

if (prefersReducedMotion) {
  canvasContainer.style.display = 'none'
}

const destroyScene = createScene(canvasContainer)

window.addEventListener('beforeunload', () => {
  if (typeof destroyScene === 'function') destroyScene()
})

/* ---------- Lenis smooth scroll ---------- */
let lenis = null
if (!prefersReducedMotion) {
  lenis = new Lenis({ lerp: 0.1, smoothWheel: true })

  function raf(time) {
    lenis.raf(time)
    requestAnimationFrame(raf)
  }
  requestAnimationFrame(raf)
}

/* ---------- Loader ---------- */
const loader = document.getElementById('loader')
const loaderBar = document.getElementById('loader-bar')
let progress = 0

const loaderInterval = setInterval(() => {
  progress = Math.min(progress + Math.random() * 18, 100)
  loaderBar.style.width = progress + '%'
  if (progress >= 100) {
    clearInterval(loaderInterval)
    setTimeout(() => loader.classList.add('hidden'), 250)
  }
}, 110)

/* ---------- Nav scroll + active links ---------- */
const nav = document.getElementById('nav')
const sections = document.querySelectorAll('section[id]')
const navAnchor = document.querySelectorAll('.nav-links a')

function onScroll() {
  nav.classList.toggle('scrolled', window.scrollY > 40)

  const scrollProgress = document.getElementById('scrollProgress')
  const docHeight = document.documentElement.scrollHeight - window.innerHeight
  const pct = docHeight > 0 ? (window.scrollY / docHeight) * 100 : 0
  scrollProgress.style.width = pct + '%'

  const backToTop = document.getElementById('backToTop')
  backToTop.style.opacity = window.scrollY > 600 ? '1' : '0'
  backToTop.style.visibility = window.scrollY > 600 ? 'visible' : 'hidden'

  let current = 'home'
  sections.forEach((section) => {
    const top = section.offsetTop - 140
    if (window.scrollY >= top) {
      current = section.id
    }
  })
  navAnchor.forEach((link) => {
    link.classList.toggle('active', link.getAttribute('href') === '#' + current)
  })
}

window.addEventListener('scroll', onScroll, { passive: true })
onScroll()

/* ---------- Mobile menu ---------- */
const hamburger = document.getElementById('hamburger')
const navLinks = document.getElementById('navLinks')

hamburger.addEventListener('click', () => {
  hamburger.classList.toggle('open')
  navLinks.classList.toggle('open')
})

navLinks.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', (e) => {
    const href = link.getAttribute('href')
    if (href && href.startsWith('#')) {
      e.preventDefault()
      if (lenis) {
        lenis.scrollTo(href, { duration: 1.2 })
      } else {
        document.querySelector(href).scrollIntoView({ behavior: 'smooth' })
      }
    }
    hamburger.classList.remove('open')
    navLinks.classList.remove('open')
  })
})

/* ---------- Back to top ---------- */
document.getElementById('backToTop').addEventListener('click', () => {
  if (lenis) lenis.scrollTo(0, { duration: 1.2 })
  else window.scrollTo({ top: 0, behavior: 'smooth' })
})

/* ---------- Typewriter ---------- */
const roles = [
  'modern web applications',
  'scalable backends',
  'responsive user interfaces',
  'REST & GraphQL APIs',
  'clean, efficient solutions'
]
const typewriterEl = document.getElementById('typewriter')
let roleIndex = 0
let charIndex = 0
let deleting = false

if (typewriterEl && !prefersReducedMotion) {
  function type() {
    const current = roles[roleIndex]
    if (deleting) {
      charIndex--
      typewriterEl.textContent = current.substring(0, charIndex)
      if (charIndex === 0) {
        deleting = false
        roleIndex = (roleIndex + 1) % roles.length
        setTimeout(type, 400)
        return
      }
      setTimeout(type, 40)
    } else {
      charIndex++
      typewriterEl.textContent = current.substring(0, charIndex)
      if (charIndex === current.length) {
        deleting = true
        setTimeout(type, 2200)
        return
      }
      setTimeout(type, 70)
    }
  }
  setTimeout(type, 900)
} else if (typewriterEl) {
  typewriterEl.textContent = roles[0]
}

/* ---------- Cursor glow ---------- */
const cursorGlow = document.getElementById('cursorGlow')

if (!window.matchMedia('(pointer: coarse)').matches) {
  window.addEventListener('mousemove', (e) => {
    cursorGlow.style.left = e.clientX + 'px'
    cursorGlow.style.top = e.clientY + 'px'
    cursorGlow.classList.add('visible')
  })
  window.addEventListener('mouseleave', () => {
    cursorGlow.classList.remove('visible')
  })
}

/* ---------- Reveal on scroll ---------- */
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible')
        revealObserver.unobserve(entry.target)
      }
    })
  },
  { threshold: 0.12 }
)

document.querySelectorAll('.reveal, .reveal-3d').forEach((el) => {
  revealObserver.observe(el)
})

/* ---------- Skill / stack progress bars ---------- */
const skillObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const bar = entry.target
        bar.style.width = bar.dataset.fill + '%'
        skillObserver.unobserve(bar)
      }
    })
  },
  { threshold: 0.5 }
)

document.querySelectorAll('.stack-progress span').forEach((bar) => {
  skillObserver.observe(bar)
})

/* ---------- Animated counters ---------- */
const statObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const stat = entry.target
        const target = parseInt(stat.dataset.count, 10)
        const duration = 1600
        const start = performance.now()
        const step = (now) => {
          const t = Math.min((now - start) / duration, 1)
          const eased = 1 - Math.pow(1 - t, 3)
          stat.textContent = Math.round(target * eased)
          if (t < 1) requestAnimationFrame(step)
        }
        requestAnimationFrame(step)
        statObserver.unobserve(stat)
      }
    })
  },
  { threshold: 0.6 }
)

document.querySelectorAll('.stat-num').forEach((stat) => {
  statObserver.observe(stat)
})

/* ---------- Marquee (duplicate for seamless loop) ---------- */
const marqueeTrack = document.getElementById('marqueeTrack')
if (marqueeTrack) {
  marqueeTrack.innerHTML += marqueeTrack.innerHTML
}

/* ---------- 3D tilt cards ---------- */
if (!window.matchMedia('(pointer: coarse)').matches) {
  document.querySelectorAll('[data-tilt3d]').forEach((card) => {
    let rafId = null

    const onMove = (e) => {
      const rect = card.getBoundingClientRect()
      const px = (e.clientX - rect.left) / rect.width
      const py = (e.clientY - rect.top) / rect.height
      const rx = (0.5 - py) * 9
      const ry = (px - 0.5) * 11
      if (rafId) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        card.style.transition =
          'transform 0.3s ease, box-shadow 0.4s, border-color 0.4s'
        card.style.transform =
          'perspective(1100px) rotateX(' + rx + 'deg) rotateY(' + ry + 'deg) translateZ(12px)'
      })
    }

    const onLeave = () => {
      if (rafId) cancelAnimationFrame(rafId)
      card.style.transition = ''
      card.style.transform =
        'perspective(1100px) rotateX(0deg) rotateY(0deg) translateZ(0)'
    }

    card.addEventListener('mousemove', onMove)
    card.addEventListener('mouseleave', onLeave)
  })
}

/* ---------- Hero photo tilt ---------- */
const photoTilt = document.querySelector('[data-photo-tilt]')
if (photoTilt && !window.matchMedia('(pointer: coarse)').matches) {
  const frame = photoTilt.querySelector('.photo-frame')
  let rafId = null

  photoTilt.addEventListener('mousemove', (e) => {
    const rect = photoTilt.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5
    if (rafId) cancelAnimationFrame(rafId)
    rafId = requestAnimationFrame(() => {
      frame.style.transition = 'transform 0.12s ease'
      frame.style.transform =
        'rotateY(' + x * 14 + 'deg) rotateX(' + -y * 14 + 'deg)'
    })
  })

  photoTilt.addEventListener('mouseleave', () => {
    if (rafId) cancelAnimationFrame(rafId)
    frame.style.transition = 'transform 0.7s cubic-bezier(0.16, 1, 0.3, 1)'
    frame.style.transform = 'rotateY(0deg) rotateX(0deg)'
  })
}

/* ---------- Stack card 3D tilt ---------- */
if (!window.matchMedia('(pointer: coarse)').matches) {
  document.querySelectorAll('.stack-card').forEach((card) => {
    let rafId = null

    const onMove = (e) => {
      const rect = card.getBoundingClientRect()
      const px = (e.clientX - rect.left) / rect.width
      const py = (e.clientY - rect.top) / rect.height
      const rx = (0.5 - py) * 14
      const ry = (px - 0.5) * 16
      if (rafId) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        card.style.transition =
          'transform 0.25s ease, border-color 0.4s, box-shadow 0.4s'
        card.style.transform =
          'perspective(900px) rotateX(' + rx + 'deg) rotateY(' + ry + 'deg) translateY(-8px) scale(1.03)'
      })
    }

    const onLeave = () => {
      if (rafId) cancelAnimationFrame(rafId)
      card.style.transition = ''
      card.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg) translateY(0) scale(1)'
    }

    card.addEventListener('mousemove', onMove)
    card.addEventListener('mouseleave', onLeave)
  })
}

/* ---------- Testimonials slider ---------- */
const slides = document.getElementById('slides')
const dotsContainer = document.getElementById('sliderDots')
const prevBtn = document.getElementById('prevSlide')
const nextBtn = document.getElementById('nextSlide')
const totalSlides = slides.children.length
let slideIndex = 0

for (let i = 0; i < totalSlides; i++) {
  const dot = document.createElement('button')
  dot.setAttribute('aria-label', 'Go to slide ' + (i + 1))
  dot.addEventListener('click', () => goTo(i))
  dotsContainer.appendChild(dot)
}

const dots = dotsContainer.querySelectorAll('button')

function goTo(index) {
  slideIndex = (index + totalSlides) % totalSlides
  slides.style.transform = 'translateX(-' + slideIndex * 100 + '%)'
  dots.forEach((d, i) => d.classList.toggle('active', i === slideIndex))
}

prevBtn.addEventListener('click', () => goTo(slideIndex - 1))
nextBtn.addEventListener('click', () => goTo(slideIndex + 1))

let autoSlide = setInterval(() => goTo(slideIndex + 1), 6000)
const slider = document.getElementById('slider')
slider.addEventListener('mouseenter', () => clearInterval(autoSlide))
slider.addEventListener('mouseleave', () => {
  autoSlide = setInterval(() => goTo(slideIndex + 1), 6000)
})
goTo(0)

/* ---------- Contact form ---------- */
const form = document.getElementById('contact-form')
const submitBtn = form.querySelector('button[type="submit"]');

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    formData.append("access_key", "b2a201cc-5217-4caa-9417-ea8d0bfcdc90");

    const originalText = submitBtn.textContent;

    submitBtn.textContent = "Sending...";
    submitBtn.disabled = true;

    try {
        const response = await fetch("https://api.web3forms.com/submit", {
            method: "POST",
            body: formData
        });

        const data = await response.json();
        const success = form.querySelector('.form-success')

        if (response.ok) {
            success.textContent = "Message sent! I'll get back to you soon.";
            success.classList.add('show');
            setTimeout(() => success.classList.remove('show'), 4000);
            form.reset();
        } else {
            success.textContent = "Error: " + data.message;
            success.classList.add('show');
            setTimeout(() => success.classList.remove('show'), 4000);
        }

    } catch (error) {
        const success = form.querySelector('.form-success')
        success.textContent = "Something went wrong. Please try again.";
        success.classList.add('show');
        setTimeout(() => success.classList.remove('show'), 4000);
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
});
