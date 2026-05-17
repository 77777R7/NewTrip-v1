# Tutorial Coast Layer Test Review

Status: art-direction test passed, production section not done.

## Draft Outputs

- `drafts/layers/tutorial_coast_sky_layer_001_draft.png`
- `drafts/layers/tutorial_coast_far_ocean_001_draft.png`
- `drafts/landmarks/tutorial_coast_lighthouse_silhouettes_001_draft.png`
- `drafts/props/tutorial_coast_roadside_grass_001_draft.png`
- `drafts/layers/tutorial_coast_road_foreground_001_draft.png`

## What Passed

- The warm Big Sur sunset palette is coherent.
- The sky and ocean layers share the same cinematic pixel-art mood.
- The lighthouse and grass props are close enough to the route style for first-pass landmark/prop direction.
- The road foreground proves the pseudo-3D straight-road camera can work for the Tutorial Coast section.

## Not Done Yet

- These are draft generation outputs, not Unity-ready sliced production assets.
- The layers have not been composited together in Unity.
- The transparent-looking outputs still need alpha validation before use as real sprites.
- The road foreground currently includes scenic context, so a cleaner road-only production layer may still be needed.
- Pixel density, canvas size, anchors, and safe-area fit still need a mobile composition pass.
- iOS texture import settings, Sprite Atlas grouping, and ASTC compression are not configured yet.

## Next Required Steps

1. Composite these five drafts into one static 9:16 mock scene.
2. Decide which drafts are approved, needs-regeneration, or rejected.
3. Regenerate any layer that does not composite cleanly.
4. Create production exports with consistent size, alpha, and naming.
5. Import into Unity once the client project exists.
6. Validate on iPhone portrait safe areas and memory budget.
