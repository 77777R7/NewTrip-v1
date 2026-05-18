# Unity Mobile Pixel Road Rendering Knowledge V1

This knowledge base translates high-ROI Unity/mobile/pixel-art rendering research into rules for NewTrip's phone-portrait pseudo-3D driving prototype.

It is scoped to:

- Unity client rendering.
- Mobile portrait performance.
- Pixel-art texture and sprite import.
- Code-generated pseudo-3D road projection.
- Roadside/sign/weather sprite spawning.

It is not a route design, backend simulation, real map, or real weather document.

## Top Sources

| Source | URL | Why it matters for NewTrip |
| --- | --- | --- |
| Unity Manual: Texture Import Settings | https://docs.unity.cn/2021.2/Documentation/Manual/class-TextureImporter.html | Defines alpha handling, wrap mode, mipmaps, read/write memory cost, and texture import behavior. |
| Unity 2D Pixel Perfect package docs | https://docs.unity.cn/Packages/com.unity.2d.pixel-perfect@1.0/manual/index.html | Official pixel-art guidance: same Pixels Per Unit, Point filtering, no compression, pixel snapping, and optional upscale render texture. |
| Unity Learn: Editing Texture Settings | https://learn.unity.com/tutorial/editing-texture-settings-8595 | Mobile-focused texture settings, ASTC/ETC guidance, GUI transparency caveats, wrap/filter/compression overview. |
| Unity Manual: Sprite Atlas | https://docs.unity.cn/Manual/sprite-atlas.html | Sprite atlases reduce texture switches and draw-call overhead by consolidating sprites. |
| Unity Learn: Introduction to Sprite Atlas | https://learn.unity.com/tutorial/introduction-to-the-sprite-atlas-2019-3 | Practical atlas packing guidance: variants, padding, tight packing, folder organization, atlas-owned import settings. |
| Unity Manual: Draw Call Batching | https://docs.unity3d.com/cn/2018.3/Manual/DrawCallBatching.html | Batching constraints: same renderer type and material; dynamic batching has CPU cost; SpriteRenderers and MeshRenderers batch only with their own type. |
| Unity Support: Draw calls and batches | https://support.unity.com/hc/en-us/articles/207061413-Why-are-my-batches-draw-calls-so-high-What-does-that-mean | Clear explanation that state changes from material/texture/shader differences are the core draw-call cost. |
| Unity Manual: SRP Batcher | https://docs.unity.cn/2021.3/Documentation/Manual/SRPBatcher.html | Important warning: MaterialPropertyBlock makes individual renderers incompatible with SRP Batcher. |
| Unity Manual: Mobile Optimization | https://docs.unity3d.com/es/2018.3/Manual/MobileOptimisation.html | Mobile fillrate rules: low material count, texture atlases, keep transparent screen coverage low, use simple shaders. |
| Unity Learn: Frame Debugger | https://learn.unity.com/tutorial/working-with-the-frame-debugger | Use to inspect individual draw calls and frame construction during road-scene profiling. |
| Lou's Pseudo 3D Page | https://www.extentofthejam.com/pseudo/ | Classic pseudo-3D road math and sprite scaling context. |
| Jake Gordon: JavaScript Racer straight roads | https://jakesgordon.com/writing/javascript-racer-v1-straight/ | Practical pseudo-3D road projection loop: project road segments and scale sprites by depth. |
| Code Like It's 198x: Pseudo-3D Road | https://code198x.com/vault/techniques/pseudo-3d-road/ | Concise explanation of fixed horizon, scaled road width, sprite scaling, parallax layers, and smooth frame-rate goals. |

## Core Synthesis

The current NewTrip road problem is not just an art-material problem. It is a combined projection, motion, texture-frequency, alpha, batching, and mobile fillrate problem.

For the live driving view, "natural" means:

- the player feels forward optical flow for 10 seconds, not just a nice still image;
- road, lane, shoulder, signs, and roadside sprites share one depth/motion model;
- far-road shimmer is controlled;
- alpha overlays do not stack over the whole screen;
- sprite pivots and scaling make objects feel attached to the road projection;
- the road surface is readable near the car and quiet near the horizon.

## Road Renderer Rules

### Projection

Use pseudo-3D slice projection, not a full-screen road image.

Recommended V1 slice budget:

```text
road slices: 48 default, 32 low-end fallback, 64 only if visually needed
lane slices: match road slices
shoulder slices: match road slices if enabled
```

Current code is already in the right family:

- `Pseudo3DRoadRenderer` generates a sliced mesh.
- `LaneMarkingRenderer` renders a separate lane mesh.
- `RoadShoulderRenderer` can hide road-edge harshness when re-enabled.

But the road should move from a shared distance source, not independent visual scrolls.

### Motion

Uniform texture scroll risks a conveyor-belt look. Natural motion needs depth-aware optical flow:

- near road moves fast;
- far road moves slowly and fades;
- lane, asphalt, shoulder, and spawn depth all use the same `distanceTravelled` source;
- roadside sprites move from horizon to bottom according to road depth, not arbitrary screen Y.

Action:

```text
Replace independent uvScroll timers with one RoadMotionState:
- distanceTravelledVisual
- normalizedSpeed
- metersPerTextureRepeat
- timeScale

Road, lane, and shoulder derive UV from that shared state.
```

Do not let lane markings scroll at a visually unrelated speed. A different tile scale is fine; a different physical speed is not.

### Lane Width

The lane strip should be road-relative, not viewport-fixed.

Current risk:

```text
LaneMarkingRenderer.laneHalfWidthViewport
```

This can make the lane feel like a screen-space overlay. It should derive from `sample.HalfWidth` so the lane narrows naturally at the horizon.

Action:

```text
laneHalfWidth = sample.HalfWidth * laneWidthRoadRatio
```

Keep a minimum horizon width only as a visual clamp, then fade near horizon.

### Horizon Fade

The far end of the road should be absorbed by environment, fog, color, or alpha.

Action:

```text
road horizon fade: enabled
lane horizon fade: enabled
shoulder horizon fade: enabled
far alpha near horizon: 0.00-0.12 depending on background
```

This is especially important because point-filtered textures with no mipmaps can shimmer when compressed into a small horizon area.

## Texture Import Rules

### Road Asphalt Tile

Use for `road_asphalt_tile_512_*`.

```text
Texture Type: Default
Filter Mode: Point
Wrap Mode: Repeat
Mip Maps: Off for current pixel-art review pass
Compression: None for review/prototype
Read/Write: Off
sRGB: On
Alpha Source: None unless needed
Alpha Is Transparency: Off
Max Size: 512 or 1024 depending source
```

Art requirement:

```text
512x512 seamless
low-noise warm dark asphalt
no single-pixel glitter field
longitudinal grain aligned with road direction
subtle tire bands allowed
no baked lane lines
no baked shoulder/vegetation
near readable, horizon quiet
```

Important nuance:

No mipmaps preserves crisp pixels, but moving a high-frequency road tile into a narrow horizon can shimmer. For NewTrip, solve this first through lower-frequency art, texture repeat tuning, horizon fade, and tint/fog. Only test mipmaps later if shimmer remains and the blur is acceptable.

### Lane Strip

Use for `lane_double_yellow_alpha_*`.

```text
Texture Type: Default if consumed by road mesh material
Filter Mode: Point
Wrap Mode: Repeat
Mip Maps: Off for review/prototype
Compression: None
Read/Write: Off
sRGB: On
Alpha Source: Input Texture Alpha
Alpha Is Transparency: On
```

Art requirement:

```text
alpha-only or transparent-background strip
slightly wider than current test if horizon looks needle-like
low speckle
paint edge wear in larger pixel clusters, not noise
must tile vertically
no asphalt baked behind it unless explicitly reviewed
```

### Roadside, Signs, Car, Weather Sprites

Use for sprite assets, not road materials.

```text
Texture Type: Sprite (2D and UI)
Sprite Mode: Single or Multiple as needed
Filter Mode: Point
Compression: None for review/prototype
Mip Maps: Off
Read/Write: Off after extraction QA
Pixels Per Unit: one shared value per scene pack
Pivot: bottom-center for car, signs, rocks, vegetation, guardrails
Alpha Is Transparency: On
```

## Sprite Atlas Rules

Use Sprite Atlas once extraction is clean. Do not atlas dirty full contact sheets.

Recommended atlases:

```text
bigsur_sunset_roadside_atlas_v1
bigsur_sunset_signs_atlas_v1
bigsur_sunset_weather_atlas_v1
car_rear_atlas_v1
hud_icons_atlas_v1
```

Atlas settings:

```text
Filter Mode: Point
Compression: None for review, ASTC/ETC2 candidates later only after visual QA
Padding: 2-4 px minimum
Tight Packing: allowed for irregular roadside sprites if no visual artifacts
Allow Rotation: off for easier QA/debugging unless build profiling proves a need
Variants: later for low-memory devices
```

Do not place repeating road tiles in a sprite atlas. Road and lane textures need Repeat wrap mode and independent UV control.

## Batching And Materials

Target material policy:

```text
road: 1 shared opaque material
lane: 1 shared alpha material
shoulder: 1 shared opaque or alpha-light material
roadside sprites: 1 shared atlas material
sign sprites: 1 shared atlas material
weather overlay: 1 shared material
car: 1 shared material
hud: separate UI atlas/materials
```

Rules:

- Use `sharedMaterial`, not `material`, unless a unique instance is intentionally needed.
- Keep material count low; material/texture/shader state changes are the batch killer.
- SpriteRenderers batch with SpriteRenderers, MeshRenderers with MeshRenderers; do not expect them to combine across renderer types.
- MaterialPropertyBlock is acceptable for the few road/lane meshes, but avoid per-object MaterialPropertyBlocks on many roadside sprites if targeting URP SRP Batcher.
- Do not tint every spawned object through unique materials. Prefer sprite color only if batching remains acceptable in Frame Debugger, or group by tint/material.

## Sprite Spawner Rules

Current `SideObjectSpawner` creates and destroys GameObjects. That is fine for early review, but not a mobile-ready runtime pattern.

Action:

```text
Add object pooling before production composite:
- prewarm N SpriteRenderers per spawn profile
- deactivate/reactivate instead of Destroy/Instantiate
- keep active roadside object budget
- sort/scale by depth
```

Suggested first budget:

```text
active roadside sprites: 20-40
active sign sprites: 0-4
weather full-screen overlays: 0-1 normal, 2 max for special moments
road/lane/shoulder meshes: 2-3
```

Projection rule:

```text
x = sample.CenterX +/- sample.HalfWidth * (1 + laneOffset)
y = sample.Y
scale = depthScaleCurve(depth)
pivot = bottom-center
```

Every roadside object must be attached to road depth. No direct screen-coordinate placement for trees, signs, rocks, or guardrails.

## Overdraw And Alpha Rules

Mobile is often fillrate-bound. The biggest visual traps for NewTrip are:

- full-screen haze plus rain plus glow plus UI;
- large transparent sprite rectangles from dirty crops;
- scenic background rectangles layered over each other;
- alpha-blended vegetation/contact-sheet leftovers;
- too many overlapping roadside sprites near the bottom of the portrait frame.

Actions:

```text
Use opaque materials for asphalt and most background bands.
Use alpha only where the shape truly needs transparency.
Crop and trim sprites; remove huge transparent margins.
Prefer tight sprite meshes for irregular large sprites if visual QA passes.
Limit weather overlay to one active full-screen layer in normal gameplay.
Profile with Frame Debugger and Overdraw view.
```

## Pixel-Art Stability Rules

Pixel art should be crisp and stable, not just crisp in stills.

Actions:

```text
Use phone portrait reference resolution.
Use one Pixels Per Unit convention per scene pack.
Use Point filtering and no compression for review assets.
Use Pixel Perfect Camera or an equivalent locked orthographic portrait camera.
Consider Upscale Render Texture only after testing mobile cost.
Snap static sprite anchors to pixel units when possible.
Do not snap road UV motion to whole pixels; road movement needs smooth optical flow.
```

Important exception:

The road mesh is a pseudo-perspective surface, not a normal static sprite. It can need smoother time-based UV motion than object sprites. If the road is forced to pixel-step too hard, it will judder.

## Render Texture Guidance

Pixel Perfect Camera's Upscale Render Texture can improve stable pixel output by rendering near the reference resolution then upscaling. It is a visual tool, not free performance.

Use it only if:

- phone portrait frame is locked;
- screenshot/video capture proves fewer pixel crawl artifacts;
- mobile profiling shows acceptable memory and GPU cost.

Avoid stacking additional full-screen RenderTextures for weather, post-processing, bloom, or fake blur in V1. Use simple SpriteRenderer overlays instead, then profile overdraw.

## Concrete NewTrip Actions

### Immediate Road-Only Fixes

1. Keep `RoadOnlyTest` isolated until it passes motion-first review.
2. Add 2-3 asphalt candidates:
   - `road_asphalt_tile_512_clean_low_noise`
   - `road_asphalt_tile_512_worn_longitudinal`
   - `road_asphalt_tile_512_horizon_safe`
3. Add 1-2 lane candidates:
   - `lane_double_yellow_alpha_clean_wider`
   - `lane_double_yellow_alpha_worn_soft`
4. Test `textureRepeat`:
   - road: `5`, `6`, `7`, `8`
   - lane: `10`, `12`, `14`
5. Make lane mesh road-relative.
6. Keep horizon fade on for road and lane.
7. Capture:
   - still frame
   - 10-second motion
   - horizon close-up
   - near-road close-up
   - overdraw view
   - Frame Debugger draw-call count

### Next Renderer Fixes

1. Replace independent road/lane/shoulder scroll timers with shared `RoadMotionState`.
2. Add object pooling to `SideObjectSpawner`.
3. Add frame-budget debug overlay or editor capture:
   - batch count
   - active sprite count
   - material count
   - overdraw review notes
4. Create Sprite Atlases only after extraction QA.
5. Keep 0-35 km bridge layer disabled; bridge belongs to 35-70 km pack.

## Risks

### Pixel-Art Scrolling Texture Risks

- Point filtering + no mipmaps + high-frequency asphalt = shimmer at horizon.
- Too much orange speckle reads like glitter when moving.
- Uniform UV scroll reads like a conveyor belt.
- Lane strip can look detached if it scrolls at a different physical speed from asphalt.
- Fixed viewport lane width looks like UI overlay rather than paint on road.

### Alpha Overlay Risks

- Full-screen haze/rain/fog layers can dominate mobile fillrate.
- Dirty crop alpha margins silently render invisible pixels.
- Multiple transparent scenic rectangles create seams and overdraw.
- Alpha sorting can be visually wrong if sprites overlap heavily near the road edge.

### Atlas Risks

- Atlasing dirty contact sheets bakes bad crops into runtime.
- Too little padding causes color bleeding.
- A single giant atlas can waste memory; route-segment atlases are safer.
- Repeating road textures should not be atlased because they need Repeat wrap and UV scroll.

### Material/Batching Risks

- Unique material instances from `Renderer.material` break batching.
- Too many shader variants/materials increase state changes.
- MaterialPropertyBlock can remove SRP Batcher compatibility for those renderers.
- Dynamic batching is not always free; profile before assuming it helps.

## Acceptance Gate

Road-only is not approved until:

- 10-second motion does not shimmer or flicker.
- Near road reads as asphalt, not noisy carpet.
- Horizon does not become a needle or sparkle field.
- Lane paint feels attached to the road surface.
- Frame Debugger shows a small, understandable draw-call stack.
- Overdraw view shows no unnecessary full-screen alpha stack.
- Texture import settings match this document.
