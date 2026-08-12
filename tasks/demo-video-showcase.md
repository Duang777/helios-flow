# Demo Video Showcase

This pipeline records real Helios backend pages and writes video plus Chinese
and English subtitle sidecars. It is intended for competition walkthroughs and
module-by-module product demos.

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
yarn demo:videos -- --scene=02-today-digest --duration-ms=5000 --output-dir=.tmp/demo-video-smoke
```

Record one overview page per registered static backend module:

```bash
yarn demo:videos -- --mode=all-modules
```

## Inputs

The recorder logs in through the real `/api/auth/login` endpoint. It does not
mock AI replies or business data.

Environment variables:

- `DEMO_VIDEO_APP_URL`: defaults to `http://localhost:3000`.
- `DEMO_VIDEO_EMAIL`: defaults to `OPERATING_LOOP_SEED_EMAIL` or `admin@acme.com`.
- `DEMO_VIDEO_PASSWORD`: defaults to `OPERATING_LOOP_SEED_PASSWORD` or `secret`.
- `DEMO_VIDEO_OUTPUT_DIR`: defaults to an ignored `.ai/qa/artifacts_*/videos` folder.

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

## Editing Notes

Curated competition scenes live in `scripts/lib/demo-video-scenes.mjs`.

The first pass intentionally avoids a Remotion dependency. If a final composed
film is needed, consume `manifest.json` with Remotion or ffmpeg and either keep
the sidecar subtitles selectable or burn the chosen language into the final MP4.
