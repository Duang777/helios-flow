import test from 'node:test'
import assert from 'node:assert/strict'

import {
  compareMetrics,
  normalizeHardcodedMetrics,
  normalizeUsageMetrics,
  normalizeValueMetrics,
} from '../i18n-advisory-baseline.mjs'

test('normalizers keep only stable i18n advisory counts', () => {
  assert.deepEqual(
    normalizeUsageMetrics({
      totalKeys: 10,
      totalReferences: 20,
      usedKeys: 8,
      dynamicCount: 2,
      missingKeys: 0,
      unusedKeys: 2,
      unused: ['a.b', 'a.c'],
    }),
    {
      totalKeys: 10,
      totalReferences: 20,
      usedKeys: 8,
      dynamicCount: 2,
      missingKeys: 0,
      unusedKeys: 2,
    },
  )

  assert.deepEqual(
    normalizeHardcodedMetrics({
      totalFindings: 3,
      totalAllowlisted: 1,
      totalFiles: 2,
      modules: [
        { moduleKey: 'customers', findings: [{ value: 'Save changes' }] },
        { moduleKey: 'catalog', findings: [] },
      ],
    }),
    {
      totalFindings: 3,
      totalAllowlisted: 1,
      totalFiles: 2,
      modulesWithFindings: 1,
    },
  )

  assert.deepEqual(
    normalizeValueMetrics({
      modulesProcessed: 2,
      locales: [
        { locale: 'zh', total: 10, identical: 4, identicalSignificant: 3, missing: 0, translated: 6 },
      ],
    }),
    {
      modulesProcessed: 2,
      locales: {
        zh: { total: 10, identical: 4, identicalSignificant: 3, missing: 0, translated: 6 },
      },
    },
  )
})

test('compareMetrics fails only when current advisory counts exceed baseline', () => {
  const baseline = {
    version: 1,
    metrics: {
      usage: { unusedKeys: 5, missingKeys: 0 },
      hardcoded: { totalFindings: 4 },
      values: {
        locales: {
          zh: { identicalSignificant: 10, missing: 0 },
          de: { identicalSignificant: 7, missing: 0 },
        },
      },
    },
  }
  const current = {
    usage: { unusedKeys: 4, missingKeys: 0 },
    hardcoded: { totalFindings: 4 },
    values: {
      locales: {
        zh: { identicalSignificant: 11, missing: 0 },
        de: { identicalSignificant: 6, missing: 1 },
      },
    },
  }

  const result = compareMetrics(current, baseline)
  assert.deepEqual(result.regressions, [
    { metric: 'values.de.missing', current: 1, baseline: 0 },
    { metric: 'values.zh.identicalSignificant', current: 11, baseline: 10 },
  ])
  assert.deepEqual(result.improvements, [
    { metric: 'usage.unusedKeys', current: 4, baseline: 5 },
    { metric: 'values.de.identicalSignificant', current: 6, baseline: 7 },
  ])
})

test('compareMetrics treats unknown locale baselines as regressions', () => {
  const baseline = {
    version: 1,
    metrics: {
      usage: { unusedKeys: 0, missingKeys: 0 },
      hardcoded: { totalFindings: 0 },
      values: { locales: {} },
    },
  }
  const current = {
    usage: { unusedKeys: 0, missingKeys: 0 },
    hardcoded: { totalFindings: 0 },
    values: {
      locales: {
        es: { identicalSignificant: 1, missing: 0 },
      },
    },
  }

  assert.deepEqual(compareMetrics(current, baseline).regressions, [
    { metric: 'values.es', current: 'present', baseline: 'missing-baseline-locale' },
  ])
})
