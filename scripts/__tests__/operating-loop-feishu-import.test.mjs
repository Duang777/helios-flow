import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

test('operating-loop-feishu-import prints help without requiring credentials', () => {
  const result = spawnSync(process.execPath, ['scripts/operating-loop-feishu-import.mjs', '--help'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      FEISHU_APP_ID: '',
      FEISHU_APP_SECRET: '',
      FEISHU_SPREADSHEET_TOKEN: '',
      FEISHU_DATA_WIKI_TOKEN: '',
    },
  })

  assert.equal(result.status, 0)
  assert.match(result.stdout, /operating-loop:feishu:import/)
  assert.match(result.stdout, /--apply writes through Helios HTTP APIs/)
})

test('operating-loop-feishu-import fails fast when online read has no spreadsheet token', () => {
  const result = spawnSync(process.execPath, ['scripts/operating-loop-feishu-import.mjs'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      FEISHU_APP_ID: '',
      FEISHU_APP_SECRET: '',
      FEISHU_SPREADSHEET_TOKEN: '',
      FEISHU_DATA_WIKI_TOKEN: '',
    },
  })

  assert.equal(result.status, 1)
  assert.match(result.stderr, /FEISHU_SPREADSHEET_TOKEN/)
})

test('operating-loop-feishu-verify prints help without requiring credentials', () => {
  const result = spawnSync(process.execPath, ['scripts/operating-loop-feishu-verify.mjs', '--help'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      OPERATING_LOOP_SEED_EMAIL: '',
      OPERATING_LOOP_SEED_PASSWORD: '',
    },
  })

  assert.equal(result.status, 0)
  assert.match(result.stdout, /operating-loop:feishu:verify/)
  assert.match(result.stdout, /does not seed or mutate business records/)
})

test('operating-loop-feishu-brand prints help without requiring credentials', () => {
  const result = spawnSync(process.execPath, ['scripts/operating-loop-feishu-brand.mjs', '--help'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      OPERATING_LOOP_SEED_EMAIL: '',
      OPERATING_LOOP_SEED_PASSWORD: '',
    },
  })

  assert.equal(result.status, 0)
  assert.match(result.stdout, /operating-loop:feishu:brand/)
  assert.match(result.stdout, /company subject/)
})
