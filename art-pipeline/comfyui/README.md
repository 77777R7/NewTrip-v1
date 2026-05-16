# NewTrip ComfyUI Asset Pipeline

This folder contains the repeatable batch generation setup for NewTrip route art.

## First Test Batch

Use:

- Manifest: `manifests/tutorial_coast_v1.yaml`
- Prompts: `prompts/tutorial_coast_layer_prompts.yaml`
- Workflow template: `workflows/newtrip_pseudo3d_base_workflow.template.json`
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
{route_id}_{layer_type}_{index}_{status}.png
```

Examples:

```text
tutorial_coast_road_base_001_draft.png
tutorial_coast_road_base_001_approved.png
tutorial_coast_guardrail_right_001_approved.png
```

## Engine Handoff

Unity should receive only approved, optimized exports. Source generations and rejected drafts stay in `assets/art/source/` until we add a Unity project and import pipeline.
