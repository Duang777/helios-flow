/**
 * TC-UMES-011: CLI Commands + Conflict Detection (SPEC-041k)
 *
 * Validates the UMES CLI commands (umes:list, umes:inspect, umes:check)
 * and build-time conflict detection during `yarn generate`.
 *
 * Spec reference: SPEC-041k — DevTools + Conflict Detection (TC-UMES-DT02)
 */
import { test, expect } from '@playwright/test'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import {
  detectConflicts,
  detectComponentOverrideConflicts,
  detectInterceptorConflicts,
  detectCircularWidgetDependencies,
  detectMissingFeatureDeclarations,
} from '@helios/shared/lib/umes/conflict-detection'

function findProjectRoot(): string {
  let dir = process.cwd()
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, 'turbo.json'))) return dir
    dir = path.dirname(dir)
  }
  return process.cwd()
}

const ROOT = findProjectRoot()

function resolveHeliosBin(): string {
  const candidates = [
    path.join(ROOT, 'node_modules/.bin/helios'),
    path.join(ROOT, 'node_modules/@helios/cli/bin/helios'),
    path.join(ROOT, 'packages/cli/bin/helios'),
  ]

  const match = candidates.find((candidate) => fs.existsSync(candidate))
  if (!match) {
    throw new Error(`Could not find helios bin. Checked: ${candidates.join(', ')}`)
  }

  return match
}

const HELIOS_BIN = resolveHeliosBin()

function runHelios(args: string[]): { stdout: string; stderr: string; exitCode: number } {
  const result = spawnSync(HELIOS_BIN, args, {
    cwd: ROOT,
    encoding: 'utf-8',
    timeout: 60_000,
    env: { ...process.env, FORCE_COLOR: '0', NODE_NO_WARNINGS: '1' },
  })

  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    exitCode: result.status ?? 1,
  }
}

test.describe('TC-UMES-011: CLI commands', () => {
  test('umes:list shows registered extensions from example module', () => {
    const { stdout, exitCode } = runHelios(['umes:list'])
    expect(exitCode).toBe(0)

    // Should list example module extensions in the output
    expect(stdout).toContain('example')

    // Should show injection-widget or component-override entries
    expect(stdout.toLowerCase()).toMatch(/injection-widget|component-override|enricher/i)
  })

  test('umes:inspect shows extension tree for example module', () => {
    const { stdout, exitCode } = runHelios(['umes:inspect', '--module', 'example'])
    expect(exitCode).toBe(0)

    // Should show the example module header
    expect(stdout).toContain('example')

    // Should list extension type sections (title-case headers in tree output)
    expect(stdout).toMatch(/Injection Widgets|Component Overrides|Declared Features/)
  })

  test('umes:inspect reports missing modules on stderr and exits non-zero', () => {
    const { stderr, exitCode } = runHelios(['umes:inspect', '--module', 'missing-module'])
    expect(exitCode).toBe(1)
    expect(stderr).toContain('Module "missing-module" not found.')
    expect(stderr).toContain('Available modules:')
    expect(stderr).toContain('example')
  })

  test('umes:check exits 0 with no conflicts', () => {
    const { stdout, exitCode } = runHelios(['umes:check'])
    expect(exitCode).toBe(0)

    // Should indicate no errors found
    expect(stdout.toLowerCase()).toMatch(/no (conflict|error)|0 error/i)
  })
})

test.describe('TC-UMES-011: Conflict detection logic', () => {
  test('detects duplicate component overrides at same priority', () => {
    const conflicts = detectComponentOverrideConflicts([
      { moduleId: 'module-a', componentId: 'page:dashboard', priority: 100 },
      { moduleId: 'module-b', componentId: 'page:dashboard', priority: 100 },
    ])

    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].severity).toBe('error')
    expect(conflicts[0].type).toBe('duplicate-component-override')
    expect(conflicts[0].moduleIds).toContain('module-a')
    expect(conflicts[0].moduleIds).toContain('module-b')
  })

  test('allows same component at different priorities without conflict', () => {
    const conflicts = detectComponentOverrideConflicts([
      { moduleId: 'module-a', componentId: 'page:dashboard', priority: 100 },
      { moduleId: 'module-b', componentId: 'page:dashboard', priority: 200 },
    ])

    expect(conflicts).toHaveLength(0)
  })

  test('warns on duplicate interceptor route+method+priority', () => {
    const conflicts = detectInterceptorConflicts([
      { moduleId: 'mod-a', id: 'a.int', targetRoute: 'customers/people', methods: ['GET'], priority: 100 },
      { moduleId: 'mod-b', id: 'b.int', targetRoute: 'customers/people', methods: ['GET'], priority: 100 },
    ])

    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].severity).toBe('warning')
    expect(conflicts[0].type).toBe('duplicate-interceptor-priority')
  })

  test('detects circular widget dependencies', () => {
    const conflicts = detectCircularWidgetDependencies([
      { moduleId: 'a', spotId: 's1', widgetId: 'w1', dependsOn: ['w2'] },
      { moduleId: 'a', spotId: 's2', widgetId: 'w2', dependsOn: ['w1'] },
    ])

    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].severity).toBe('error')
    expect(conflicts[0].type).toBe('circular-widget-dependency')
  })

  test('warns on undeclared feature references', () => {
    const conflicts = detectMissingFeatureDeclarations(
      [{ moduleId: 'test', extensionId: 'test.widget', features: ['test.nonexistent'] }],
      new Set(['test.view']),
    )

    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].severity).toBe('warning')
    expect(conflicts[0].type).toBe('missing-feature-declaration')
  })

  test('aggregates errors and warnings in detectConflicts', () => {
    const result = detectConflicts({
      componentOverrides: [
        { moduleId: 'a', componentId: 'page:home', priority: 50 },
        { moduleId: 'b', componentId: 'page:home', priority: 50 },
      ],
      interceptors: [
        { moduleId: 'x', id: 'x.int', targetRoute: 'api/test', methods: ['POST'], priority: 0 },
        { moduleId: 'y', id: 'y.int', targetRoute: 'api/test', methods: ['POST'], priority: 0 },
      ],
      gatedExtensions: [
        { moduleId: 'z', extensionId: 'z.widget', features: ['z.missing'] },
      ],
      declaredFeatures: new Set(['z.other']),
    })

    expect(result.errors).toHaveLength(1) // component override conflict
    expect(result.warnings).toHaveLength(2) // interceptor + missing feature
  })
})
