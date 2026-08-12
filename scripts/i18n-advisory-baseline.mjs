#!/usr/bin/env node

/**
 * i18n advisory baseline gate.
 *
 * The underlying i18n advisory scanners intentionally surface historical debt:
 * unused keys, hardcoded user-facing English, and locale values still identical
 * to English. This wrapper records the current advisory counts as a baseline
 * and fails only when a future change increases any tracked count.
 */

import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const ROOT = path.resolve(path.dirname(__filename), '..')
const BASELINE_PATH = path.join(ROOT, 'scripts', 'i18n-advisory-baseline.json')
const TSX_BIN = path.join(ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx')

const red = (s) => `\x1b[31m${s}\x1b[0m`
const yellow = (s) => `\x1b[33m${s}\x1b[0m`
const green = (s) => `\x1b[32m${s}\x1b[0m`
const dim = (s) => `\x1b[2m${s}\x1b[0m`
const cyan = (s) => `\x1b[36m${s}\x1b[0m`

function parseArgs(argv) {
  return {
    update: argv.includes('--update'),
    json: argv.includes('--json'),
  }
}

function runJsonCommand(label, command, args) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
    maxBuffer: 64 * 1024 * 1024,
  })
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim()
  if (result.status !== 0) {
    const suffix = output ? `\n${output}` : ''
    throw new Error(`${label} failed with exit code ${result.status}.${suffix}`)
  }
  try {
    return JSON.parse(result.stdout)
  } catch (err) {
    throw new Error(`${label} did not produce valid JSON: ${err.message}`)
  }
}

export function normalizeUsageMetrics(payload) {
  return {
    totalKeys: Number(payload.totalKeys ?? 0),
    totalReferences: Number(payload.totalReferences ?? 0),
    usedKeys: Number(payload.usedKeys ?? 0),
    dynamicCount: Number(payload.dynamicCount ?? 0),
    missingKeys: Number(payload.missingKeys ?? 0),
    unusedKeys: Number(payload.unusedKeys ?? 0),
  }
}

export function normalizeHardcodedMetrics(payload) {
  return {
    totalFindings: Number(payload.totalFindings ?? 0),
    totalAllowlisted: Number(payload.totalAllowlisted ?? 0),
    totalFiles: Number(payload.totalFiles ?? 0),
    modulesWithFindings: Array.isArray(payload.modules)
      ? payload.modules.filter((module) => {
        if (Number.isFinite(module.findingsCount)) return module.findingsCount > 0
        return Array.isArray(module.findings) && module.findings.length > 0
      }).length
      : 0,
  }
}

export function normalizeValueMetrics(payload) {
  const locales = {}
  for (const item of payload.locales ?? []) {
    if (!item?.locale) continue
    locales[item.locale] = {
      total: Number(item.total ?? 0),
      identical: Number(item.identical ?? 0),
      identicalSignificant: Number(item.identicalSignificant ?? 0),
      missing: Number(item.missing ?? 0),
      translated: Number(item.translated ?? 0),
    }
  }
  return {
    modulesProcessed: Number(payload.modulesProcessed ?? 0),
    locales,
  }
}

export function normalizeBaseline(raw) {
  if (!raw || raw.version !== 1 || !raw.metrics) {
    throw new Error('Unsupported or malformed i18n advisory baseline file.')
  }
  return raw
}

export function compareMetrics(current, baseline) {
  const baselineMetrics = baseline.metrics
  const regressions = []
  const improvements = []

  compareCount(regressions, improvements, 'usage.unusedKeys', current.usage.unusedKeys, baselineMetrics.usage.unusedKeys)
  compareCount(regressions, improvements, 'usage.missingKeys', current.usage.missingKeys, baselineMetrics.usage.missingKeys)
  compareCount(regressions, improvements, 'hardcoded.totalFindings', current.hardcoded.totalFindings, baselineMetrics.hardcoded.totalFindings)

  const localeNames = Array.from(new Set([
    ...Object.keys(current.values.locales),
    ...Object.keys(baselineMetrics.values.locales),
  ])).sort()
  for (const locale of localeNames) {
    const currentLocale = current.values.locales[locale]
    const baselineLocale = baselineMetrics.values.locales[locale]
    if (!currentLocale) {
      regressions.push({
        metric: `values.${locale}`,
        current: 'missing-current-locale',
        baseline: 'present',
      })
      continue
    }
    if (!baselineLocale) {
      regressions.push({
        metric: `values.${locale}`,
        current: 'present',
        baseline: 'missing-baseline-locale',
      })
      continue
    }
    compareCount(
      regressions,
      improvements,
      `values.${locale}.identicalSignificant`,
      currentLocale.identicalSignificant,
      baselineLocale.identicalSignificant,
    )
    compareCount(regressions, improvements, `values.${locale}.missing`, currentLocale.missing, baselineLocale.missing)
  }

  return { regressions, improvements }
}

function compareCount(regressions, improvements, metric, current, baseline) {
  if (!Number.isFinite(current) || !Number.isFinite(baseline)) {
    regressions.push({ metric, current, baseline })
    return
  }
  if (current > baseline) regressions.push({ metric, current, baseline })
  else if (current < baseline) improvements.push({ metric, current, baseline })
}

function loadBaseline() {
  if (!fs.existsSync(BASELINE_PATH)) {
    throw new Error(`Missing i18n advisory baseline: ${path.relative(ROOT, BASELINE_PATH)}. Run yarn i18n:advisory-baseline:update.`)
  }
  return normalizeBaseline(JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')))
}

function collectCurrentMetrics() {
  const usage = normalizeUsageMetrics(runJsonCommand('i18n usage check', TSX_BIN, ['scripts/i18n-check-usage.ts', '--json']))
  const hardcoded = normalizeHardcodedMetrics(runJsonCommand('i18n hardcoded check', TSX_BIN, ['scripts/i18n-check-hardcoded.ts', '--json-summary']))
  const values = normalizeValueMetrics(runJsonCommand('i18n value coverage check', process.execPath, ['scripts/i18n-check-values.mjs', '--json-summary']))

  return {
    usage,
    hardcoded,
    values,
  }
}

function buildBaseline(metrics) {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    generatedBy: 'node scripts/i18n-advisory-baseline.mjs --update',
    metrics,
  }
}

function printSummary(current, baseline, comparison) {
  console.log(`${cyan('[check]')} i18n advisory baseline`)
  console.log(dim(`Baseline: ${path.relative(ROOT, BASELINE_PATH)} (${baseline.updatedAt ?? 'unknown date'})`))
  console.log('')
  console.log(`usage.unusedKeys: ${formatCurrent(current.usage.unusedKeys, baseline.metrics.usage.unusedKeys)}`)
  console.log(`usage.missingKeys: ${formatCurrent(current.usage.missingKeys, baseline.metrics.usage.missingKeys)}`)
  console.log(`hardcoded.totalFindings: ${formatCurrent(current.hardcoded.totalFindings, baseline.metrics.hardcoded.totalFindings)}`)
  for (const locale of Object.keys(current.values.locales).sort()) {
    const baselineLocale = baseline.metrics.values.locales[locale]
    const currentLocale = current.values.locales[locale]
    if (!baselineLocale) {
      console.log(`values.${locale}.identicalSignificant: ${red(`${currentLocale.identicalSignificant} / no baseline`)}`)
      continue
    }
    console.log(
      `values.${locale}.identicalSignificant: ${formatCurrent(currentLocale.identicalSignificant, baselineLocale.identicalSignificant)}; missing: ${formatCurrent(currentLocale.missing, baselineLocale.missing)}`,
    )
  }

  if (comparison.regressions.length > 0) {
    console.log('')
    console.log(red(`i18n advisory regressions: ${comparison.regressions.length}`))
    for (const item of comparison.regressions) {
      console.log(`  - ${item.metric}: current ${item.current}, baseline ${item.baseline}`)
    }
    console.log('')
    console.log(dim('Fix the new advisory issue or intentionally refresh the baseline with yarn i18n:advisory-baseline:update.'))
    return
  }

  console.log('')
  console.log(green('No new i18n advisory issues above baseline.'))
  if (comparison.improvements.length > 0) {
    console.log(dim(`${comparison.improvements.length} metric(s) improved; refresh the baseline after the cleanup is intentional.`))
  }
}

function formatCurrent(current, baseline) {
  if (current > baseline) return red(`${current} / ${baseline}`)
  if (current < baseline) return yellow(`${current} / ${baseline}`)
  return green(`${current} / ${baseline}`)
}

function main() {
  const opts = parseArgs(process.argv.slice(2))
  const current = collectCurrentMetrics()

  if (opts.update) {
    const next = buildBaseline(current)
    fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(next, null, 2)}\n`)
    if (opts.json) process.stdout.write(JSON.stringify(next, null, 2) + '\n')
    else console.log(`${green('[updated]')} ${path.relative(ROOT, BASELINE_PATH)}`)
    return
  }

  const baseline = loadBaseline()
  const comparison = compareMetrics(current, baseline)
  if (opts.json) {
    process.stdout.write(JSON.stringify({ current, baseline, comparison }, null, 2) + '\n')
  } else {
    printSummary(current, baseline, comparison)
  }
  if (comparison.regressions.length > 0) process.exit(1)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
