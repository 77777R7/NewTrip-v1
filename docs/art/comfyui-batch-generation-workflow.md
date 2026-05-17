# ComfyUI Batch Generation Workflow

This workflow turns the approved NewTrip style reference into repeatable route asset packs.

All ComfyUI batches must follow `docs/art/scene-pack-contract-v1.md`. Do not generate or approve route art from a freeform prompt without a scene-pack type, usage class, layer type, time preset, naming pattern, and metadata entry.

## What ComfyUI Owns

ComfyUI is the repeatable asset factory for:

- Same-style route background layers.
- Road perspective base layers.
- Transparent or chroma-key roadside props.
- Landmark billboard sprites.
- Photo card source art.
- Variants across coast, forest, highway, desert, night, and snow routes.

It does not run inside the game client. NewTrip ships exported image assets through Unity.

## Consistency Stack

Prompt consistency alone is not enough. Each batch must lock:

- Same checkpoint or base model.
- Same style LoRA or style adapter.
- Same approved style reference image.
- Same perspective guide or ControlNet input for road scenes.
- Same sampler, scheduler, steps, CFG, resolution, and denoise policy.
- Same shared style prompt and negative prompt.
- Tracked seed per asset.
- Saved workflow JSON per asset batch.

## Recommended Tool Setup

Use ComfyUI with:

- A pixel-art capable SDXL or Flux workflow.
- A NewTrip style reference image.
- ControlNet or equivalent composition control for the road perspective.
- IPAdapter or equivalent image-reference style conditioning for consistency.
- A LoRA later, after 20-40 approved assets exist.

If IPAdapter or ControlNet is not installed yet, start with the basic text-to-image template and use the style reference manually. Then upgrade the workflow when those nodes are installed.

## Directory Contract

```text
assets/art/reference/
  newtrip_style_reference_big_sur_pseudo3d_v1.png

art-pipeline/comfyui/
  README.md
  workflows/
    newtrip_pseudo3d_base_workflow.template.json
  manifests/
    scene-pack-template.yaml
    tutorial_coast_v1.yaml
  prompts/
    tutorial_coast_layer_prompts.yaml

assets/art/source/
  tutorial_coast_v1/
    master/
    control/
    layers/
    props/
    landmarks/
    rejected/
```

## Production Flow

1. Copy `art-pipeline/comfyui/manifests/scene-pack-template.yaml` for the new scene pack.
2. Declare scene-pack type, usage class, layer type, route segment, and time preset.
3. Generate or select one master reference for the route.
4. Create a perspective guide: road edges, center lines, horizon, HUD-safe top region, car-safe lower region.
5. Generate `road_projection` first. Reject it if the road curves or the vanishing point drifts.
6. Generate far and mid landscape layers using the same style reference and route context.
7. Generate props and landmarks separately on transparent or chroma-key backgrounds.
8. Save all draft outputs with contract-compliant names and metadata.
9. Import only approved assets into Unity and test on iPhone portrait safe areas.
10. Only then batch variants for time-of-day, weather, and later route packs.

## Quality Gate

Reject a generated layer when:

- The road bends in the base tutorial view.
- The camera becomes side-scrolling.
- The asset includes UI, car, or text when the layer task forbids it.
- The pixel density differs sharply from the reference.
- The route theme looks generic instead of Big Sur / Highway 1.
- Important prop silhouettes are too thin for mobile.
- It implies steering, racing, collision, traffic, or real navigation.

## Model Choice

For immediate speed:

- Use a hosted ComfyUI provider or local ComfyUI with an SDXL pixel-art model.

For long-term consistency:

- Train a small NewTrip LoRA after collecting 20-40 approved source images.

The LoRA should learn the NewTrip pixel-roadtrip style, not a single route or one exact car.
