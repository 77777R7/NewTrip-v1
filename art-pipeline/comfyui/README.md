# NewTrip ComfyUI Asset Pipeline

This folder contains the later repeatable batch generation setup for NewTrip route art. The current V1 default is ChatGPT Image 2.0-first; ComfyUI comes later when scale, fixed-seed control, ControlNet, IPAdapter, or LoRA becomes worth the setup cost.

Mandatory contract: `../../docs/art/scene-pack-contract-v1.md`.

Do not approve any generated image, whether it came from ChatGPT Image 2.0 or ComfyUI, unless it has a scene-pack metadata entry, usage class, layer type, time preset, and contract-compliant filename.

## Current Generator Policy

```text
Now: ChatGPT Image 2.0-first
Later: ComfyUI / Leonardo production factory
Always: scene-pack-contract-v1
```

## First Test Batch

Use:

- Manifest: `manifests/tutorial_coast_v1.yaml`
- Prompts: `prompts/tutorial_coast_layer_prompts.yaml`
- Workflow template: `workflows/newtrip_pseudo3d_base_workflow.template.json`
- New scene-pack metadata template: `manifests/scene-pack-template.yaml`
- Style reference: `../../assets/art/reference/newtrip_style_reference_big_sur_pseudo3d_v1.png`

## How To Run Manually In ComfyUI

1. Open ComfyUI.
2. Load or recreate the workflow from `workflows/newtrip_pseudo3d_base_workflow.template.json`.
3. Replace placeholder model names with installed local models.
4. Add the style reference image from `assets/art/reference/`.
5. For road scenes, add a simple perspective guide image to ControlNet or the equivalent composition-control node.
6. Copy one prompt from `prompts/tutorial_coast_layer_prompts.yaml`.
7. Generate the asset.
8. Save approved outputs under `assets/art/source/tutorial_coast_v1/`.
9. Record the final seed, model, and status in `manifests/tutorial_coast_v1.yaml`.

## Recommended First Layer

Start with `tutorial_coast_road_base_001`.

If the road base is wrong, every later layer will fight the gameplay camera. Do not batch 30 assets before the road perspective is approved.

## Naming Contract

```text
{region}_{time}_{usage}_{layer_or_asset}_{variant}_{status}.png
```

Examples:

```text
bigsur_sunset_driving_road_projection_v01_draft.png
bigsur_sunset_driving_road_projection_v01_approved.png
santacruz_sunset_routecard_boardwalk_thumb_v01_approved.png
```

## Engine Handoff

Unity should receive only approved, optimized exports. Source generations and rejected drafts stay in `assets/art/source/` until we add a Unity project and import pipeline.
