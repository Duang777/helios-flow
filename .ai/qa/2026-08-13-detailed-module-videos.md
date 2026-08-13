# 2026-08-13 Detailed Module Videos

## Purpose

Record competition-ready walkthrough videos for the NavInfo operating advisor loop. The footage uses the real local Helios app, seeded business data, and a real AI provider/model path. It does not mock AI replies or business records.

## Final Artifact

- Preview: `.ai/qa/artifacts_2026-08-13/detailed-module-videos-final/index.html`
- Manifest: `.ai/qa/artifacts_2026-08-13/detailed-module-videos-final/manifest.json`
- Videos: `.ai/qa/artifacts_2026-08-13/detailed-module-videos-final/videos/*.webm`
- Captions: `.ai/qa/artifacts_2026-08-13/detailed-module-videos-final/captions/*.{srt,vtt}`

The artifact directory is intentionally ignored by Git because the final video bundle is large. Keep this note committed so future runs know where the local deliverable is and how it was verified.

## Coverage

The final manifest contains 15 successful scenes:

1. 登录首页与中文工作台
2. 今日经营摘要
3. 项目进度与延期风险
4. 合同与商业口径
5. 开票与逾期应收
6. 回款记录
7. 核销明细
8. KPI 完成看板
9. 治理检出与处置
10. 客户主数据
11. AI 助手验收 Playground
12. AI Agent 注册表
13. 产品与服务目录
14. WMS 库存作业
15. 集成管理

Every scene includes Chinese and English subtitle tracks. Every AI dialogue step in the final manifest has `status: "ok"`.

## Recording Notes

- Runtime model used for repaired scenes: `openai / gpt-5.4` through the configured relay.
- The recorder waits for real streamed AI output instead of sleeping a fixed duration.
- The wait logic reads only the visible AI chat root and accepts structured assistant output such as tool cards or mutation preview UI parts.
- The final bundle was assembled from successful source runs only; failed or incomplete source recordings were excluded from the final manifest.

## Verification

Commands run locally:

```bash
node --test scripts/__tests__/demo-video-scenes.test.mjs
yarn workspace @helios/ui test -- AiChat.test.tsx --runInBand
yarn workspace @helios/core test -- insights-tools.test.ts --runInBand
```

Artifact checks:

```bash
# All scenes in final manifest have AI status ok and all referenced files exist.
node - <<'NODE'
const fs = require('fs')
const path = require('path')
const dir = '.ai/qa/artifacts_2026-08-13/detailed-module-videos-final'
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'))
for (const scene of manifest.scenes) {
  const ai = (scene.steps || []).find((step) => step.id === 'ai-dialogue')
  const files = [scene.video, scene.captions.zhSrt, scene.captions.zhVtt, scene.captions.enSrt, scene.captions.enVtt]
  const missing = files.filter((file) => !fs.existsSync(path.join(dir, file)))
  if (scene.status !== 'ok' || ai?.status !== 'ok' || missing.length > 0) process.exit(1)
}
NODE

# Final bundle contains 15 videos and 60 subtitle files.
find .ai/qa/artifacts_2026-08-13/detailed-module-videos-final/videos -type f -name '*.webm' | wc -l
find .ai/qa/artifacts_2026-08-13/detailed-module-videos-final/captions -type f | wc -l
```
