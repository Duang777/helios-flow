# Demo Video Showcase

This pipeline records real Helios backend pages and writes video plus Chinese
and English subtitle sidecars. It is intended for competition walkthroughs and
module-by-module product demos.

The current recorder is detailed by default: every curated scene has an
overview, a module feature tour, and a real AI dialogue step. The AI step opens
the registered assistant, sends a Chinese prompt, waits for streamed model
output, and records whatever the app actually returns. It does not provide mock
answers.

## Commands

List the curated competition scenes:

```bash
yarn demo:videos -- --list-scenes
```

Record the operating-loop competition showcase:

```bash
yarn demo:videos -- --mode=competition
```

Record one scene while iterating:

```bash
yarn demo:videos -- --scene=02-today-digest --duration-ms=5000 --ai-wait-ms=30000 --output-dir=.tmp/demo-video-smoke
```

Record one overview page per registered static backend module:

```bash
yarn demo:videos -- --mode=all-modules
```

Check camera framing without calling the model:

```bash
yarn demo:videos -- --scene=02-today-digest --skip-ai --duration-ms=5000 --output-dir=.tmp/demo-video-camera-check
```

## Inputs

The recorder logs in through the real `/api/auth/login` endpoint. It does not
mock AI replies or business data.

Environment variables:

- `DEMO_VIDEO_APP_URL`: defaults to `http://localhost:3000`.
- `DEMO_VIDEO_EMAIL`: defaults to `OPERATING_LOOP_SEED_EMAIL` or `admin@acme.com`.
- `DEMO_VIDEO_PASSWORD`: defaults to `OPERATING_LOOP_SEED_PASSWORD` or `secret`.
- `DEMO_VIDEO_OUTPUT_DIR`: defaults to an ignored `.ai/qa/artifacts_*/videos` folder.
- `DEMO_VIDEO_AI_WAIT_MS`: defaults to `20000`; increase to `30000-60000` for final real-model footage.
- `DEMO_VIDEO_SKIP_AI`: set to `true` only for camera/blocking checks.
- `DEMO_VIDEO_OVERLAY_CAPTIONS`: set to `false` to hide the recorded on-screen narration overlay.

## Outputs

Each scene writes:

- `videos/<scene-id>.webm`
- `captions/<scene-id>.zh.srt`
- `captions/<scene-id>.zh.vtt`
- `captions/<scene-id>.en.srt`
- `captions/<scene-id>.en.vtt`

The output folder also contains:

- `manifest.json`: machine-readable scene and subtitle index.
- `index.html`: local preview page with selectable Chinese and English tracks.
- `manifest.json.scenes[].steps`: the exact executed step list, including agent
  id, prompt, duration, and per-step status.

## Detailed Scene Shape

Curated competition scenes live in `scripts/lib/demo-video-scenes.mjs`.

Each scene should answer four questions:

- What module is being shown?
- Which real business objects or KPIs does the operator inspect?
- Which assistant is opened?
- What Chinese prompt proves the AI can read, explain, suggest, or generate a
  confirm-required preview?

The recorder currently covers:

- 登录首页/通知入口
- 今日经营摘要
- 项目、合同、发票、回款、核销
- KPI 完成看板
- 治理检出与批量处置建议
- 客户主数据
- AI Playground 和 Agent 注册表
- 产品与服务目录
- WMS 库存作业
- 集成管理

## WebReel Positioning

WebReel (`vercel-labs/webreel`, docs at `webreel.dev`) is a good finishing
tool when the goal is polished cursor animation, key HUDs, MP4/GIF/WebM output,
and JSON-configured browser movements. For this project, Playwright remains the
source recorder because it can log in through Helios auth, select assistants by
runtime `agentId`, send real prompts, wait for real SSE output, and tolerate
per-scene failures in a batch report.

Recommended workflow:

1. Use `yarn demo:videos` for truthful business/AI footage and subtitle sidecars.
2. Use the generated `manifest.json` as the script source for narration and cuts.
3. If final polish is needed, translate the same scene actions into WebReel JSON
   or post-process the `.webm` files with ffmpeg/Remotion. Do not replace the
   real AI step with mocked WebReel text.

## Editing Notes

The first pass intentionally avoids a Remotion dependency. If a final composed
film is needed, consume `manifest.json` with Remotion or ffmpeg and either keep
the sidecar subtitles selectable or burn the chosen language into the final MP4.
