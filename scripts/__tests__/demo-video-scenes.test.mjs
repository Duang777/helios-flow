import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildAllModuleScenesFromRoutes,
  buildSceneCues,
  buildSceneSteps,
  buildSrt,
  buildVtt,
  formatSrtTimestamp,
  formatVttTimestamp,
  parseBackendRoutes,
  resolveScenes,
} from '../lib/demo-video-scenes.mjs'
import { spawnSync } from 'node:child_process'

test('formats SRT and VTT timestamps for caption files', () => {
  assert.equal(formatSrtTimestamp(3_723_045), '01:02:03,045')
  assert.equal(formatVttTimestamp(3_723_045), '01:02:03.045')
})

test('builds bilingual caption cues for a scene', () => {
  const cues = buildSceneCues({
    titleZh: '今日经营摘要',
    titleEn: 'Today Operating Digest',
    subtitleZh: '中文说明',
    subtitleEn: 'English explanation',
    featureZh: '功能说明',
    featureEn: 'Feature description',
    agentId: 'insights.operating_loop_assistant',
    aiPromptZh: '请分析今日风险。',
    aiPromptEn: 'Analyze today risks.',
    action: 'scroll',
  }, 8_000, 'zh', { aiWaitMs: 4_000 })

  assert.equal(cues.length, 3)
  const [cue] = cues
  assert.equal(cue.startMs, 0)
  assert.equal(cue.endMs, 2_000)
  assert.match(cue.text, /今日经营摘要/)
  assert.match(cues[2].text, /AI 对话与执行效果/)
  assert.match(buildSrt([cue]), /00:00:00,000 --> 00:00:02,000/)
  assert.match(buildVtt([cue]), /^WEBVTT/)
})

test('builds detailed scene steps with AI prompt metadata', () => {
  const steps = buildSceneSteps({
    titleZh: '治理检出',
    titleEn: 'Governance Findings',
    subtitleZh: '治理说明',
    subtitleEn: 'Governance description',
    featureZh: '批量处置',
    featureEn: 'Bulk disposition',
    action: 'scroll',
    agentId: 'governance.assistant',
    aiPromptZh: '请生成处置预览。',
    aiPromptEn: 'Create a disposition preview.',
  }, { durationMs: 9_000, aiWaitMs: 5_000 })

  assert.deepEqual(steps.map((step) => step.id), ['overview', 'module-tour', 'ai-dialogue'])
  assert.equal(steps[1].kind, 'scroll')
  assert.equal(steps[2].agentId, 'governance.assistant')
  assert.match(steps[2].subtitleZh, /confirm|处置|预览/)
})

test('parses backend route module ids and paths from generated route source', () => {
  const routes = parseBackendRoutes(`
    { moduleId: "projects", ...resolvePageRouteMetadata("/backend/projects", ({} as any)) },
    { moduleId: "projects", ...resolvePageRouteMetadata("/backend/projects/[id]", ({} as any)) },
    { moduleId: "commercial", ...resolvePageRouteMetadata("/backend/commercial/invoices", ({} as any)) },
  `)

  assert.deepEqual(routes, [
    { moduleId: 'projects', path: '/backend/projects' },
    { moduleId: 'projects', path: '/backend/projects/[id]' },
    { moduleId: 'commercial', path: '/backend/commercial/invoices' },
  ])
})

test('builds one static all-modules scene per module', () => {
  const scenes = buildAllModuleScenesFromRoutes([
    { moduleId: 'projects', path: '/backend/projects/[id]' },
    { moduleId: 'projects', path: '/backend/projects' },
    { moduleId: 'catalog', path: '/backend/catalog/products' },
    { moduleId: 'catalog', path: '/backend/catalog/products/create' },
  ])

  assert.equal(scenes.length, 2)
  assert.equal(scenes.find((scene) => scene.moduleId === 'projects')?.path, '/backend/projects')
  assert.equal(scenes.find((scene) => scene.moduleId === 'catalog')?.path, '/backend/catalog/products')
})

test('resolves competition scenes by id or module and limit', () => {
  const byId = resolveScenes({ sceneIds: ['02-today-digest'] })
  assert.equal(byId.length, 1)
  assert.equal(byId[0].path, '/backend/insights/operating-loop/today')

  const byModule = resolveScenes({ sceneIds: ['governance'], limit: 1 })
  assert.equal(byModule.length, 1)
  assert.equal(byModule[0].moduleId, 'governance')
})

test('record-demo-videos help tolerates yarn argument separator', () => {
  const result = spawnSync(process.execPath, ['scripts/record-demo-videos.mjs', '--', '--help'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      DEMO_VIDEO_EMAIL: '',
      DEMO_VIDEO_PASSWORD: '',
    },
  })

  assert.equal(result.status, 0)
  assert.match(result.stdout, /demo:videos/)
  assert.match(result.stdout, /does\s+not mock AI replies/)
})
