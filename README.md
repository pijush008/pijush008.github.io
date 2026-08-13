# Pijush Patra — Full-Stack Developer Portfolio

A professional 3D portfolio website for **Pijush Patra**, built with **Vite + Three.js**.

## Quick Start

```bash
npm install
npm run dev      # development server
npm run build    # production build
```

## Where to edit your content

All content lives in **`index.html`**. Search for the section tags to find each part:

| What you want to change | Where in `index.html` |
| --- | --- |
| **Your name** | Search `Pijush Patra` (hero title, about, facts, logo, footer) |
| **Your photo** | In the hero, find the comment block `To use your own photo:` |
| **Roles / typewriter text** | `src/main.js` → the `roles` array (top of file) |
| **Social links** | Hero socials (GitHub / LinkedIn / X / Email SVG links) |
| **Stats / counters** | Stats strip section → `data-count` attributes |
| **About bio + facts** | Section `01 / ABOUT ME` |
| **Tech stacks** | Section `02 / TECH STACK` (4 cards + badge cloud) |
| **Work experience** | Section `03 / EXPERIENCE` (timeline) |
| **Projects** | Section `04 / PROJECTS` (featured + 6 cards) |
| **Testimonials** | Section `05 / TESTIMONIALS` (slider) |
| **Contact info + form** | Section `06 / CONTACT` |
| **Email / phone / location** | Search `hello@pijushpatra.dev`, `+91 00000 00000` |

## Note about placeholder content

The **experience timeline**, **projects**, and **testimonials** sections currently contain
example content to show how each entry looks. Replace them with your real work history,
projects, and references before publishing.

## Adding your photo

1. Drop your image at `src/assets/photo.jpg`
2. In `index.html`, inside the hero photo card, uncomment:
   ```html
   <!-- <img src="/src/assets/photo.jpg" alt="Pijush Patra" /> -->
   ```
   and delete the `photo-placeholder` div above it.

## Editing the 3D scene

The 3D background (shape, colors, particles, floating objects) is in **`src/scene.js`**.

Colors are defined as CSS variables in **`src/style.css`** under `:root` (e.g. `--accent`, `--accent-2`, `--gradient`).
