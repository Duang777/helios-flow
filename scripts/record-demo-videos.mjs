#!/usr/bin/env node

import { chromium } from 'playwright'
import { config as loadDotenv } from 'dotenv'
import { existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve, relative } from 'node:path'

import {
  DEFAULT_SCENE_DURATION_MS,
  DEFAULT_VIEWPORT,
  buildSceneCues,
  buildSrt,
  buildVtt,
  resolveScenes,
} from './lib/demo-video-scenes.mjs'

const ROOT = process.cwd()
const DEFAULT_ROUTES_PATH = resolve(ROOT, 'apps/helios/.helios/generated/backend-routes.generated.ts')

function loadLocalEnvFiles() {
  for (const envPath of ['.env', 'apps/helios/.env']) {
    const absolutePath = resolve(ROOT, envPath)
    if (existsSync(absolutePath)) loadDotenv({ path: absolutePath, override: false, quiet: true })
  }
}

function readEnv(name, fallback = null) {
  const value = process.env[name]
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback
}

function parseArgs(argv) {
  const options = {
    appUrl: readEnv('DEMO_VIDEO_APP_URL', readEnv('OPERATING_LOOP_SEED_APP_URL', 'http://localhost:3000')).replace(/\/+$/, ''),
    email: readEnv('DEMO_VIDEO_EMAIL', readEnv('OPERATING_LOOP_SEED_EMAIL', 'admin@acme.com')),
    password: readEnv('DEMO_VIDEO_PASSWORD', readEnv('OPERATING_LOOP_SEED_PASSWORD', 'secret')),
    mode: 'competition',
    sceneIds: [],
    limit: null,
    outputDir: readEnv('DEMO_VIDEO_OUTPUT_DIR', defaultOutputDir()),
    durationMs: DEFAULT_SCENE_DURATION_MS,
    generatedRoutesPath: DEFAULT_ROUTES_PATH,
    viewport: { ...DEFAULT_VIEWPORT },
    headed: false,
    slowMo: 60,
    dryRun: false,
    listScenes: false,
  }

  for (const arg of argv) {
    if (arg === '--') continue
    if (arg === '--help') {
      printHelp()
      process.exit(0)
    } else if (arg === '--dry-run') options.dryRun = true
    else if (arg === '--list-scenes') options.listScenes = true
    else if (arg === '--headed') options.headed = true
    else if (arg.startsWith('--app-url=')) options.appUrl = arg.slice('--app-url='.length).replace(/\/+$/, '')
    else if (arg.startsWith('--email=')) options.email = arg.slice('--email='.length)
    else if (arg.startsWith('--password=')) options.password = arg.slice('--password='.length)
    else if (arg.startsWith('--mode=')) options.mode = arg.slice('--mode='.length)
    else if (arg.startsWith('--scene=')) options.sceneIds.push(arg.slice('--scene='.length))
    else if (arg.startsWith('--limit=')) options.limit = Number.parseInt(arg.slice('--limit='.length), 10)
    else if (arg.startsWith('--output-dir=')) options.outputDir = resolve(ROOT, arg.slice('--output-dir='.length))
    else if (arg.startsWith('--duration-ms=')) options.durationMs = Number.parseInt(arg.slice('--duration-ms='.length), 10)
    else if (arg.startsWith('--routes=')) options.generatedRoutesPath = resolve(ROOT, arg.slice('--routes='.length))
    else if (arg.startsWith('--slow-mo=')) options.slowMo = Number.parseInt(arg.slice('--slow-mo='.length), 10)
    else if (arg.startsWith('--viewport=')) options.viewport = parseViewport(arg.slice('--viewport='.length))
    else throw new Error(`[record-demo-videos] Unknown argument: ${arg}`)
  }

  if (!['competition', 'all-modules'].includes(options.mode)) {
    throw new Error('[record-demo-videos] --mode must be competition or all-modules')
  }
  if (!Number.isFinite(options.durationMs) || options.durationMs < 2_000) {
    throw new Error('[record-demo-videos] --duration-ms must be at least 2000')
  }
  return options
}

function printHelp() {
  console.log(`Usage:
  yarn demo:videos -- --mode=competition
  yarn demo:videos -- --mode=all-modules --limit=20
  yarn demo:videos -- --list-scenes
  yarn demo:videos -- --scene=02-today-digest --headed

Records real Helios backend pages with Playwright and writes:
  videos/<scene>.webm
  captions/<scene>.zh.srt, captions/<scene>.zh.vtt
  captions/<scene>.en.srt, captions/<scene>.en.vtt
  manifest.json and index.html

The recorder logs in through /api/auth/login and uses real app data. It does
not mock AI replies or business records.`)
}

async function loginContext(context, options) {
  const form = new URLSearchParams()
  form.set('email', options.email)
  form.set('password', options.password)
  const response = await context.request.post(`${options.appUrl}/api/auth/login`, {
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    data: form.toString(),
  })
  const raw = await response.text()
  let body = null
  try {
    body = raw ? JSON.parse(raw) : null
  } catch {
    throw new Error(`[record-demo-videos] Login expected JSON, got: ${raw.slice(0, 300)}`)
  }
  if (!response.ok() || typeof body?.token !== 'string') {
    throw new Error(`[record-demo-videos] Login failed (${response.status()}): ${JSON.stringify(body).slice(0, 500)}`)
  }
  const claims = decodeJwt(body.token)
  const cookies = [
    { name: 'auth_token', value: body.token, url: options.appUrl, sameSite: 'Lax', httpOnly: true },
    { name: 'locale', value: 'zh', url: options.appUrl, sameSite: 'Lax' },
    { name: 'om_demo_notice_ack', value: 'ack', url: options.appUrl, sameSite: 'Lax' },
    { name: 'om_cookie_notice_ack', value: 'ack', url: options.appUrl, sameSite: 'Lax' },
    { name: 'om_feedback_suppress', value: '1', url: options.appUrl, sameSite: 'Lax' },
  ]
  if (typeof body.refreshToken === 'string') {
    cookies.push({ name: 'session_token', value: body.refreshToken, url: options.appUrl, sameSite: 'Lax', httpOnly: true })
  }
  if (claims.tenantId) cookies.push({ name: 'om_selected_tenant', value: claims.tenantId, url: options.appUrl, sameSite: 'Lax' })
  if (claims.orgId) cookies.push({ name: 'om_selected_org', value: claims.orgId, url: options.appUrl, sameSite: 'Lax' })
  await context.addCookies(cookies)
  return claims
}

async function recordScene(browser, scene, options) {
  const tempVideoDir = join(options.outputDir, '.tmp-recordings')
  mkdirSync(tempVideoDir, { recursive: true })
  const context = await browser.newContext({
    viewport: options.viewport,
    locale: 'zh-CN',
    recordVideo: {
      dir: tempVideoDir,
      size: options.viewport,
    },
  })
  await loginContext(context, options)
  const page = await context.newPage()
  await page.goto(`${options.appUrl}${scene.path}`, { waitUntil: 'domcontentloaded', timeout: 45_000 })
  await page.waitForLoadState('load', { timeout: 20_000 }).catch(() => null)
  await stabilizePage(page)
  await runSceneAction(page, scene, options.durationMs)
  const video = page.video()
  await context.close()
  const videoPath = await video?.path()
  if (!videoPath) throw new Error(`[record-demo-videos] No video path produced for ${scene.id}`)

  const finalVideoPath = join(options.outputDir, 'videos', `${scene.id}.webm`)
  mkdirSync(dirname(finalVideoPath), { recursive: true })
  renameSync(videoPath, finalVideoPath)

  const zhCues = buildSceneCues(scene, options.durationMs, 'zh')
  const enCues = buildSceneCues(scene, options.durationMs, 'en')
  const captionDir = join(options.outputDir, 'captions')
  mkdirSync(captionDir, { recursive: true })
  writeFileSync(join(captionDir, `${scene.id}.zh.srt`), buildSrt(zhCues))
  writeFileSync(join(captionDir, `${scene.id}.zh.vtt`), buildVtt(zhCues))
  writeFileSync(join(captionDir, `${scene.id}.en.srt`), buildSrt(enCues))
  writeFileSync(join(captionDir, `${scene.id}.en.vtt`), buildVtt(enCues))

  return {
    ...scene,
    video: relative(options.outputDir, finalVideoPath),
    captions: {
      zhSrt: `captions/${scene.id}.zh.srt`,
      zhVtt: `captions/${scene.id}.zh.vtt`,
      enSrt: `captions/${scene.id}.en.srt`,
      enVtt: `captions/${scene.id}.en.vtt`,
    },
  }
}

async function stabilizePage(page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        scroll-behavior: auto !important;
      }
    `,
  }).catch(() => undefined)
  await page.waitForTimeout(1_200)
}

async function runSceneAction(page, scene, durationMs) {
  const half = Math.max(1_000, Math.floor(durationMs / 2))
  if (scene.action === 'scroll') {
    await page.waitForTimeout(1_000)
    await page.evaluate(async () => {
      const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
      const target = document.scrollingElement || document.documentElement
      const maxScroll = Math.max(0, target.scrollHeight - window.innerHeight)
      const step = Math.max(120, Math.floor(maxScroll / 5))
      for (let i = 0; i < 5; i += 1) {
        window.scrollBy({ top: step, behavior: 'smooth' })
        await delay(450)
      }
      await delay(500)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }).catch(() => undefined)
    await page.waitForTimeout(Math.max(1_000, durationMs - half))
    return
  }
  await page.waitForTimeout(durationMs)
}

function writeManifest(options, scenes) {
  const manifest = {
    generatedAt: new Date().toISOString(),
    appUrl: options.appUrl,
    mode: options.mode,
    viewport: options.viewport,
    durationMs: options.durationMs,
    scenes,
  }
  mkdirSync(options.outputDir, { recursive: true })
  writeFileSync(join(options.outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  writeFileSync(join(options.outputDir, 'index.html'), buildPreviewHtml(manifest))
}

function buildPreviewHtml(manifest) {
  const cards = manifest.scenes.map((scene) => `
    <section>
      <h2>${escapeHtml(scene.titleZh)} <small>${escapeHtml(scene.moduleId)}</small></h2>
      <p>${escapeHtml(scene.subtitleZh)}</p>
      <video controls width="960">
        <source src="${escapeHtml(scene.video)}" type="video/webm" />
        <track default kind="subtitles" srclang="zh" label="中文" src="${escapeHtml(scene.captions.zhVtt)}" />
        <track kind="subtitles" srclang="en" label="English" src="${escapeHtml(scene.captions.enVtt)}" />
      </video>
    </section>`).join('\n')
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>Helios 模块视频展示</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 32px; background: #f7f3ec; color: #30251f; }
    section { margin: 0 0 40px; padding-bottom: 32px; border-bottom: 1px solid #ddd4c8; }
    small { color: #7a6f65; font-size: 14px; font-weight: 500; }
    video { display: block; max-width: 100%; border: 1px solid #ddd4c8; border-radius: 8px; background: #000; }
  </style>
</head>
<body>
  <h1>Helios 模块视频展示</h1>
  <p>模式：${escapeHtml(manifest.mode)}；生成时间：${escapeHtml(manifest.generatedAt)}</p>
  ${cards}
</body>
</html>
`
}

function listScenes(scenes) {
  for (const scene of scenes) {
    console.log(`${scene.id}\t${scene.moduleId}\t${scene.path}\t${scene.titleZh}`)
  }
}

function defaultOutputDir() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  return resolve(ROOT, `.ai/qa/artifacts_${stamp}/videos`)
}

function parseViewport(value) {
  const match = String(value).match(/^(\d+)x(\d+)$/)
  if (!match) throw new Error('[record-demo-videos] --viewport must be WIDTHxHEIGHT, for example 1920x1080')
  return { width: Number.parseInt(match[1], 10), height: Number.parseInt(match[2], 10) }
}

function decodeJwt(token) {
  const parts = String(token).split('.')
  if (parts.length < 2) return {}
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
  } catch {
    return {}
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

async function main() {
  loadLocalEnvFiles()
  const options = parseArgs(process.argv.slice(2))
  const scenes = resolveScenes(options)
  if (scenes.length === 0) throw new Error('[record-demo-videos] No scenes matched the requested filters.')

  if (options.listScenes || options.dryRun) {
    listScenes(scenes)
    if (options.dryRun) {
      writeManifest(options, scenes.map((scene) => ({
        ...scene,
        video: `videos/${scene.id}.webm`,
        captions: {
          zhSrt: `captions/${scene.id}.zh.srt`,
          zhVtt: `captions/${scene.id}.zh.vtt`,
          enSrt: `captions/${scene.id}.en.srt`,
          enVtt: `captions/${scene.id}.en.vtt`,
        },
      })))
      console.log(`[record-demo-videos] Dry-run manifest written to ${join(options.outputDir, 'manifest.json')}`)
    }
    return
  }

  mkdirSync(options.outputDir, { recursive: true })
  const browser = await chromium.launch({ headless: !options.headed, slowMo: options.slowMo })
  const recorded = []
  try {
    for (const scene of scenes) {
      console.log(`[record-demo-videos] Recording ${scene.id}: ${scene.titleZh} (${scene.path})`)
      recorded.push(await recordScene(browser, scene, options))
    }
  } finally {
    await browser.close()
  }
  writeManifest(options, recorded)
  console.log(`[record-demo-videos] Wrote ${recorded.length} video scene(s) to ${options.outputDir}`)
  console.log(`[record-demo-videos] Preview: ${join(options.outputDir, 'index.html')}`)
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error))
  process.exitCode = 1
})
