#!/usr/bin/env node

import { chromium } from 'playwright'
import { config as loadDotenv } from 'dotenv'
import { existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve, relative } from 'node:path'

import {
  DEFAULT_AI_WAIT_MS,
  DEFAULT_SCENE_DURATION_MS,
  DEFAULT_VIEWPORT,
  buildSceneCues,
  buildSceneSteps,
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
    aiWaitMs: Number.parseInt(readEnv('DEMO_VIDEO_AI_WAIT_MS', String(DEFAULT_AI_WAIT_MS)), 10),
    skipAi: readEnv('DEMO_VIDEO_SKIP_AI', 'false') === 'true',
    overlayCaptions: readEnv('DEMO_VIDEO_OVERLAY_CAPTIONS', 'true') !== 'false',
    continueOnError: true,
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
    else if (arg === '--skip-ai') options.skipAi = true
    else if (arg === '--no-overlay-captions') options.overlayCaptions = false
    else if (arg === '--fail-fast') options.continueOnError = false
    else if (arg.startsWith('--app-url=')) options.appUrl = arg.slice('--app-url='.length).replace(/\/+$/, '')
    else if (arg.startsWith('--email=')) options.email = arg.slice('--email='.length)
    else if (arg.startsWith('--password=')) options.password = arg.slice('--password='.length)
    else if (arg.startsWith('--mode=')) options.mode = arg.slice('--mode='.length)
    else if (arg.startsWith('--scene=')) options.sceneIds.push(arg.slice('--scene='.length))
    else if (arg.startsWith('--limit=')) options.limit = Number.parseInt(arg.slice('--limit='.length), 10)
    else if (arg.startsWith('--output-dir=')) options.outputDir = resolve(ROOT, arg.slice('--output-dir='.length))
    else if (arg.startsWith('--duration-ms=')) options.durationMs = Number.parseInt(arg.slice('--duration-ms='.length), 10)
    else if (arg.startsWith('--ai-wait-ms=')) options.aiWaitMs = Number.parseInt(arg.slice('--ai-wait-ms='.length), 10)
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
  if (!Number.isFinite(options.aiWaitMs) || options.aiWaitMs < 1_000) {
    throw new Error('[record-demo-videos] --ai-wait-ms must be at least 1000')
  }
  return options
}

function printHelp() {
  console.log(`Usage:
  yarn demo:videos -- --mode=competition
  yarn demo:videos -- --mode=all-modules --limit=20
  yarn demo:videos -- --list-scenes
  yarn demo:videos -- --scene=02-today-digest --headed
  yarn demo:videos -- --scene=09-governance --ai-wait-ms=45000

Records real Helios backend pages with Playwright and writes:
  videos/<scene>.webm
  captions/<scene>.zh.srt, captions/<scene>.zh.vtt
  captions/<scene>.en.srt, captions/<scene>.en.vtt
  manifest.json and index.html

The recorder logs in through /api/auth/login and uses real app data. It does
not mock AI replies or business records. By default it opens the real AI
assistant for each scene, sends the scene prompt, and waits for streamed output.
Use --skip-ai only for camera/blocking checks, not final competition footage.`)
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
  const steps = buildSceneSteps(scene, {
    durationMs: options.durationMs,
    aiWaitMs: options.aiWaitMs,
    includeAi: !options.skipAi,
  })
  const stepResults = await runSceneAction(page, steps, options)
  const video = page.video()
  await context.close()
  const videoPath = await video?.path()
  if (!videoPath) throw new Error(`[record-demo-videos] No video path produced for ${scene.id}`)

  const finalVideoPath = join(options.outputDir, 'videos', `${scene.id}.webm`)
  mkdirSync(dirname(finalVideoPath), { recursive: true })
  renameSync(videoPath, finalVideoPath)

  const cueOptions = { aiWaitMs: options.aiWaitMs, includeAi: !options.skipAi }
  const zhCues = buildSceneCues(scene, options.durationMs, 'zh', cueOptions)
  const enCues = buildSceneCues(scene, options.durationMs, 'en', cueOptions)
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
    steps: stepResults,
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

async function runSceneAction(page, steps, options) {
  const results = []
  for (const step of steps) {
    await showStepOverlay(page, step, options)
    const startedAt = new Date().toISOString()
    try {
      if (step.kind === 'scroll') {
        await scrollPage(page, step.durationMs)
      } else if (step.kind === 'ai') {
        await performAiStep(page, step)
      } else {
        await page.waitForTimeout(step.durationMs)
      }
      results.push({ ...serializeStep(step), startedAt, status: 'ok' })
    } catch (error) {
      const message = error?.message || String(error)
      results.push({ ...serializeStep(step), startedAt, status: 'failed', error: message })
      if (!options.continueOnError) throw error
      await page.waitForTimeout(Math.max(1_000, Math.min(step.durationMs, 3_000)))
    }
  }
  await clearStepOverlay(page)
  return results
}

async function scrollPage(page, durationMs) {
  await page.waitForTimeout(600)
  await page.evaluate(async (targetDurationMs) => {
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
    const target = document.scrollingElement || document.documentElement
    const maxScroll = Math.max(0, target.scrollHeight - window.innerHeight)
    if (maxScroll === 0) {
      await delay(targetDurationMs)
      return
    }
    const iterations = 5
    const step = Math.max(120, Math.floor(maxScroll / iterations))
    const delayMs = Math.max(250, Math.floor(targetDurationMs / (iterations + 2)))
    for (let i = 0; i < iterations; i += 1) {
      window.scrollBy({ top: step, behavior: 'smooth' })
      await delay(delayMs)
    }
    await delay(delayMs)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, durationMs).catch(() => undefined)
}

async function performAiStep(page, step) {
  await openAiAssistant(page, step.agentId)
  await sendAiPrompt(page, step.promptZh)
  await page.waitForTimeout(step.durationMs)
}

async function openAiAssistant(page, agentId) {
  const dock = page.locator(`[data-ai-dock-agent="${cssEscape(agentId)}"]`)
  if (await isVisible(dock)) return

  const trigger = page.locator('[data-ai-launcher-trigger], [data-ai-launcher-trigger-mobile]').first()
  if (!(await isVisible(trigger))) {
    throw new Error('AI launcher trigger is not visible')
  }
  await trigger.click()

  const picker = page.locator('[data-ai-launcher-picker]')
  await picker.waitFor({ state: 'visible', timeout: 10_000 })
  const search = page.locator('[data-ai-launcher-search-input]')
  await search.fill(agentId)
  const option = page.locator(`[data-ai-launcher-agent-id="${cssEscape(agentId)}"]`).first()
  if (await isVisible(option, 8_000)) {
    await option.click()
  } else {
    await search.press('Enter')
  }

  const dockButton = page.locator('[data-ai-launcher-dock]').first()
  if (await isVisible(dockButton, 5_000)) {
    await dockButton.click()
    await dock.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => undefined)
    return
  }

  await page.locator('[aria-label="Message composer"], textarea#ai-chat-composer').first()
    .waitFor({ state: 'visible', timeout: 15_000 })
}

async function sendAiPrompt(page, prompt) {
  const composer = page.locator('[aria-label="Message composer"], textarea#ai-chat-composer').last()
  await composer.waitFor({ state: 'visible', timeout: 15_000 })
  await composer.fill(prompt)
  const sendButton = page.getByRole('button', { name: /发送消息|发送|Send message|Send/i }).last()
  if (await isVisible(sendButton, 2_000)) {
    await sendButton.click()
  } else {
    await composer.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter')
  }
}

async function showStepOverlay(page, step, options) {
  if (!options.overlayCaptions) return
  await page.evaluate((payload) => {
    const existing = document.querySelector('[data-demo-video-caption]')
    if (existing) existing.remove()
    const container = document.createElement('div')
    container.setAttribute('data-demo-video-caption', '')
    container.style.position = 'fixed'
    container.style.left = '28px'
    container.style.bottom = '28px'
    container.style.zIndex = '2147483647'
    container.style.maxWidth = '760px'
    container.style.padding = '18px 22px'
    container.style.borderRadius = '8px'
    container.style.background = 'rgba(23, 18, 14, 0.86)'
    container.style.color = '#fffaf3'
    container.style.boxShadow = '0 18px 48px rgba(0, 0, 0, 0.22)'
    container.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    container.style.pointerEvents = 'none'

    const title = document.createElement('div')
    title.textContent = payload.title
    title.style.fontSize = '24px'
    title.style.fontWeight = '700'
    title.style.lineHeight = '1.25'
    title.style.marginBottom = '8px'

    const subtitle = document.createElement('div')
    subtitle.textContent = payload.subtitle
    subtitle.style.fontSize = '17px'
    subtitle.style.lineHeight = '1.55'
    subtitle.style.opacity = '0.9'

    container.append(title, subtitle)
    document.body.append(container)
  }, {
    title: step.titleZh,
    subtitle: step.subtitleZh,
  }).catch(() => undefined)
}

async function clearStepOverlay(page) {
  await page.evaluate(() => {
    document.querySelector('[data-demo-video-caption]')?.remove()
  }).catch(() => undefined)
}

function serializeStep(step) {
  return {
    id: step.id,
    kind: step.kind,
    durationMs: step.durationMs,
    titleZh: step.titleZh,
    titleEn: step.titleEn,
    agentId: step.agentId,
    promptZh: step.promptZh,
  }
}

async function isVisible(locator, timeout = 0) {
  try {
    if (timeout > 0) await locator.waitFor({ state: 'visible', timeout })
    return await locator.isVisible()
  } catch {
    return false
  }
}

function cssEscape(value) {
  return String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"')
}

function writeManifest(options, scenes) {
  const manifest = {
    generatedAt: new Date().toISOString(),
    appUrl: options.appUrl,
    mode: options.mode,
    viewport: options.viewport,
    durationMs: options.durationMs,
    aiWaitMs: options.aiWaitMs,
    skipAi: options.skipAi,
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
      ${scene.status === 'failed'
        ? `<pre>${escapeHtml(scene.error)}</pre>`
        : `<video controls width="960">
          <source src="${escapeHtml(scene.video)}" type="video/webm" />
          <track default kind="subtitles" srclang="zh" label="中文" src="${escapeHtml(scene.captions.zhVtt)}" />
          <track kind="subtitles" srclang="en" label="English" src="${escapeHtml(scene.captions.enVtt)}" />
        </video>`}
      ${Array.isArray(scene.steps) && scene.steps.length > 0
        ? `<ol>${scene.steps.map((step) => `<li>${escapeHtml(step.titleZh)}：${escapeHtml(step.status)}${step.agentId ? ` · ${escapeHtml(step.agentId)}` : ''}</li>`).join('')}</ol>`
        : ''}
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
    pre { white-space: pre-wrap; border: 1px solid #d8cabe; border-radius: 8px; padding: 16px; background: #fffaf3; }
    li { margin: 4px 0; color: #5f554c; }
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
        steps: buildSceneSteps(scene, {
          durationMs: options.durationMs,
          aiWaitMs: options.aiWaitMs,
          includeAi: !options.skipAi,
        }).map((step) => ({ ...serializeStep(step), status: 'planned' })),
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
      try {
        recorded.push(await recordScene(browser, scene, options))
      } catch (error) {
        if (!options.continueOnError) throw error
        const message = error?.message || String(error)
        console.error(`[record-demo-videos] Scene failed: ${scene.id}: ${message}`)
        recorded.push({
          ...scene,
          status: 'failed',
          error: message,
          steps: buildSceneSteps(scene, {
            durationMs: options.durationMs,
            aiWaitMs: options.aiWaitMs,
            includeAi: !options.skipAi,
          }).map((step) => ({ ...serializeStep(step), status: 'not-recorded' })),
        })
      }
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
