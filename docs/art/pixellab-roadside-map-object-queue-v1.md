# PixelLab Roadside Map Object Queue V1

This queue is for PixelLab MCP `create_map_object` jobs that extend the current Big Sur Sunset roadside asset set.

## Status

- MCP config name: `pixellab`
- MCP URL: `https://api.pixellab.ai/mcp`
- Auth: `PIXELLAB_API_TOKEN`
- Current state: configured in Codex, waiting for a live token and tool refresh before jobs can be submitted.
- 2026-05-18 update: PixelLab MCP authenticated successfully over HTTP. Three trial jobs were submitted and downloaded into `apps/unity-client/Assets/NewTrip/Art/PixelLabDrafts/`.

## Source Style References

Use these reference sheets as the visual target:

- `/Users/howard07/Downloads/ChatGPT Image 2026年5月16日 下午09_46_41 (4).png`
- `/Users/howard07/Downloads/ChatGPT Image 2026年5月16日 下午09_16_34 (5).png`
- `/Users/howard07/Downloads/ChatGPT Image 2026年5月16日 下午09_46_40 (3).png`
- `/Users/howard07/Downloads/ChatGPT Image 2026年5月16日 下午09_45_09 (4).png`

## Generation Rules

Every job must produce one isolated object, not a contact sheet.

- Transparent background.
- Pixel art, Big Sur coastal road style, warm golden-hour palette.
- Three-quarter low top-down map-object view, matching the existing roadside sheets.
- Bottom-center gameplay anchor, object feet or ground contact at the lower edge.
- No full-screen scenic composition.
- No road surface unless the object is a guardrail, shoulder strip, or cliff-edge piece.
- No extra text unless the asset explicitly needs text.
- If text is requested, keep it large, blocky, and readable at mobile scale.
- Include a small dirt/grass/rock base only when it improves Unity placement.
- Output should be suitable for Unity import as a single PNG sprite.

## PixelLab MCP Pattern

Use `create_map_object` first. When available, pass one of the source sheets as `background_image` for style matching.

```python
create_map_object(
  description="single isolated pixel art California Highway 1 green route sign on a wooden post with small coastal grass, orange flowers, and rocks at the base; transparent background; Big Sur sunset roadside game asset; bottom-center ground contact anchor; no beige paper background; no contact sheet",
  width=256,
  height=384,
  view="low top-down",
  outline="single color outline",
  shading="medium shading",
  detail="medium detail",
  background_image="<base64 style reference sheet when tool supports it>"
)
```

After each job completes, download and save review outputs under:

```text
apps/unity-client/Assets/NewTrip/Art/PixelLabDrafts/
```

Do not move an output into runtime resources until it passes the extraction and Unity QA rules in `docs/client/unity-asset-extraction-rules-v1.md`.

## First Batch

| id | size | prompt |
| --- | --- | --- |
| `pixellab_sign_california_1_v1` | `256x384` | Single isolated pixel art California Highway 1 green route sign on one wooden post, cream trim, large number 1, small coastal grass, orange flowers, and rocks at the base; transparent background; Big Sur sunset roadside game asset; bottom-center ground contact anchor; no beige paper background; no contact sheet. |
| `pixellab_sign_big_sur_15_v1` | `256x384` | Single isolated pixel art green roadside distance sign reading BIG SUR 15 MILES, cream trim, wooden post, purple lupine, coastal grass, and rocks at the base; transparent background; Big Sur sunset roadside game asset; bottom-center ground contact anchor; no contact sheet. |
| `pixellab_sign_scenic_overlook_v1` | `512x256` | Single isolated pixel art scenic overlook billboard on two wooden posts, sunset coast thumbnail on the sign, readable text SCENIC OVERLOOK, small orange flowers, shrubs, and rocks at both post bases; transparent background; Big Sur coastal roadside game asset; bottom-center ground contact anchor. |
| `pixellab_sign_gas_v1` | `192x320` | Single isolated pixel art round red GAS sign on a dark metal pole, small coastal grass and stones at the base, retro roadside style; transparent background; bottom-center ground contact anchor; no contact sheet. |
| `pixellab_sign_rest_stop_arrow_v1` | `256x320` | Single isolated pixel art blue roadside REST STOP sign with cream right arrow, two wooden posts, grass and rocks at the base; transparent background; Big Sur roadside game asset; bottom-center ground contact anchor. |
| `pixellab_milestone_photo_marker_v1` | `192x256` | Single isolated pixel art stone route photo marker with tiny sunset road icon inset, orange flowers and coastal grass at the base, soft warm highlights; transparent background; bottom-center ground contact anchor. |
| `pixellab_white_reflector_post_v1` | `128x256` | Single isolated pixel art white roadside reflector post with amber reflector panel, small grass tufts and rocks at the base; transparent background; bottom-center ground contact anchor. |
| `pixellab_wood_arrow_sign_v1` | `256x224` | Single isolated pixel art wooden arrow sign pointing right on a short wooden post, small rocks and coastal grass at the base, warm sunset shading; transparent background; bottom-center ground contact anchor. |
| `pixellab_guardrail_segment_v1` | `512x160` | Single isolated pixel art low roadside metal guardrail segment with wooden-looking warm shadows, short posts, small grass and flowers around the feet; transparent background; bottom-center ground contact anchor; made for side spawning beside a pseudo-3D road. |
| `pixellab_wood_blank_board_v1` | `384x256` | Single isolated pixel art blank wooden roadside board with two posts, small bolts, grass and rocks at the base; transparent background; bottom-center ground contact anchor; no text. |
| `pixellab_roadside_bush_orange_v1` | `192x160` | Single isolated pixel art coastal roadside bush with dark green leaves, orange wildflowers, dry dirt base, and a few stones; transparent background; bottom-center ground contact anchor; no contact sheet. |
| `pixellab_roadside_lupine_purple_v1` | `192x192` | Single isolated pixel art purple lupine roadside plant cluster with grass blades, small stones, and dirt base; transparent background; bottom-center ground contact anchor. |
| `pixellab_roadside_rock_cluster_v1` | `256x160` | Single isolated pixel art warm brown coastal rock cluster with small gravel, grass tufts, and sunset highlights; transparent background; bottom-center ground contact anchor. |
| `pixellab_cliff_edge_patch_v1` | `384x192` | Single isolated pixel art low coastal cliff-edge dirt patch with warm brown rocks, scrub grass, and small orange flowers, suitable as a roadside side object near the road shoulder; transparent background; bottom-center ground contact anchor. |

## Acceptance Gate

Before a PixelLab output is accepted:

- It is a single object PNG with transparency.
- It has no beige sheet background or neighboring object fragments.
- It is readable at 50 percent scale.
- It can be placed with pivot `[0.5, 0.0]`.
- It does not imply real navigation or a global map.
- It has a matching manifest entry before Unity import.
- It is tested in `RoadOnlyTest` or `RoadPrototypeImportedPreview` before becoming runtime art.

## Trial Results

| id | PixelLab object id | output | result |
| --- | --- | --- | --- |
| `pixellab_sign_california_1_v1` | `78643215-335b-45c6-a36a-e76eff360196` | `apps/unity-client/Assets/NewTrip/Art/PixelLabDrafts/pixellab_sign_california_1_v1.png` | Review. Transparent RGBA and good single-object silhouette, but it reads more like a generic US Route 1 shield and omits the California text. Prefer blank/low-text signs plus Unity text overlay for final. |
| `pixellab_sign_big_sur_15_v1` | `89cbd131-fcc4-4099-bbb8-0c09f5a846d0` | `apps/unity-client/Assets/NewTrip/Art/PixelLabDrafts/pixellab_sign_big_sur_15_v1.png` | Reject for baked text. Transparent RGBA and good post/base, but generated text contains extra unreadable letters. Regenerate as blank green distance sign and add text in Unity. |
| `pixellab_roadside_bush_orange_v1` | `d94f2edd-7ca8-4fbc-9bf1-dd9a8392b1b1` | `apps/unity-client/Assets/NewTrip/Art/PixelLabDrafts/pixellab_roadside_bush_orange_v1.png` | Good draft. Transparent RGBA, single object, readable base, suitable for manifest/pivot review. |
| `pixellab_sign_green_blank_v1` | `1a5c73c5-1e41-4a41-af4e-fd85af28d8bd` | `apps/unity-client/Assets/NewTrip/Art/PixelLabDrafts/pixellab_sign_green_blank_v1.png` | Good draft. Blank face avoids PixelLab text errors and is suitable for Unity text overlay. |
| `pixellab_roadside_rock_cluster_v1` | `922faa94-b5de-4b36-ae08-6af850db1cf8` | `apps/unity-client/Assets/NewTrip/Art/PixelLabDrafts/pixellab_roadside_rock_cluster_v1.png` | Good draft. Clean single rock cluster with bottom contact. |
| `pixellab_guardrail_segment_v1` | `6a866ff6-8c12-4a9a-beae-ac25a91e4c99` | `apps/unity-client/Assets/NewTrip/Art/PixelLabDrafts/pixellab_guardrail_segment_v1.png` | Reject. Includes a sun/background band and reads as a scenic strip, not an isolated transparent roadside object. |
| `pixellab_white_reflector_post_v1` | `14344383-84c2-443d-acc5-a56142557e4b` | `apps/unity-client/Assets/NewTrip/Art/PixelLabDrafts/pixellab_white_reflector_post_v1.png` | Review. Transparent and readable, but the angle is more isometric than the current roadside pack. |
| `pixellab_wood_arrow_sign_v1` | `40c5379e-703e-444f-9534-744109e14986` | `apps/unity-client/Assets/NewTrip/Art/PixelLabDrafts/pixellab_wood_arrow_sign_v1.png` | Good draft. Blank wooden arrow shape is usable for side-object review. |

### Trial Lesson

PixelLab is useful for object silhouettes, vegetation, rocks, posts, and blank sign bodies. Do not rely on it for final readable text on small signs. Final sign text should use Unity pixel text or a controlled overlay pass. Long horizontal props need stricter prompts: no horizon, no sun, no scenic background, and no terrain band unless the asset is explicitly a shoulder/cliff patch.
