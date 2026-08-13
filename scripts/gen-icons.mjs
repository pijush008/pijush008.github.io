import * as si from 'simple-icons'
import { writeFileSync, mkdirSync } from 'node:fs'

const dir = '/workspace/src/assets/icons'
mkdirSync(dir, { recursive: true })

const wanted = {
  react: si.siReact,
  typescript: si.siTypescript,
  javascript: si.siJavascript,
  tailwindcss: si.siTailwindcss,
  redux: si.siRedux,
  nodedotjs: si.siNodedotjs,
  express: si.siExpress,
  graphql: si.siGraphql,
  jsonwebtokens: si.siJsonwebtokens,
  socketdotio: si.siSocketdotio,
  mongodb: si.siMongodb,
  postgresql: si.siPostgresql,
  firebase: si.siFirebase,
  docker: si.siDocker,
  vercel: si.siVercel,
  git: si.siGit,
  jest: si.siJest,
  eslint: si.siEslint,
  jira: si.siJira,
  webpack: si.siWebpack,
  python: si.siPython,
  redis: si.siRedis,
  linux: si.siLinux,
  postman: si.siPostman
}

for (const [name, icon] of Object.entries(wanted)) {
  if (!icon) { console.log('MISSING', name); continue }
  const svg = `<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="#${icon.hex}"><title>${icon.title}</title><path d="${icon.path}"/></svg>`
  writeFileSync(`${dir}/${name}.svg`, svg)
  console.log('wrote', name)
}
