# NewTrip Pseudo-3D Driving Knowledge Base V1

Research date: 2026-05-18

Scope: Unity phone-portrait pseudo-3D driving view for NewTrip V1. This is the master entrypoint for road motion, camera/view, road material, lane cadence, background layering, roadside/sign spawning, pixel-art asset requirements, and mobile performance.

This document does not replace the detailed research docs. It tells agents and designers which rule to apply first when the Unity prototype looks wrong.

## Related Knowledge Base Files

- `docs/client/pseudo3d-road-renderer-v1.md`: original renderer contract and Unity object responsibilities.
- `docs/client/unity-portrait-coordinate-contract-v1.md`: phone-portrait coordinate rules.
- `docs/client/pseudo3d-motion-naturalness-kb-v1.md`: optical flow, shared motion state, lane cadence, car micro motion, 10-second review protocol.
- `docs/client/pseudo3d-art-background-asset-kb-v1.md`: Big Sur sunset art direction, background policy, road/lane art requirements, sprite anchors.
- `docs/client/unity-mobile-pixel-road-rendering-knowledge-v1.md`: Unity import settings, Sprite Atlas policy, batching, overdraw, mobile review gates.
- `docs/client/unity-asset-extraction-rules-v1.md`: manifest-driven sprite extraction and QA policy.

## High-ROI Sources

| Source | URL | NewTrip takeaway |
| --- | --- | --- |
| Jake Gordon, "How to build a racing game - straight roads" | https://jakesgordon.com/writing/javascript-racer-v1-straight/ | A convincing pseudo-3D road is built from projected road segments that share one camera/world position, not from one full driving image. |
| Jake Gordon, "How to build a racing game - curves" | https://jakesgordon.com/writing/javascript-racer-v2-curves/ | Curves/background parallax should be tied to road state, not independent image timers. |
| Jake Gordon, "How to build a racing game - hills" | https://jakesgordon.com/writing/javascript-racer-v3-hills/ | Hills and horizon shifts require eased segment projection, useful later for coastal climbs and bridge approaches. |
| Jake Gordon, "How to build a racing game - final" | https://jakesgordon.com/writing/javascript-racer-v4-final/ | Sprites attach to projected road segments and sort by depth. This maps directly to NewTrip's roadside and sign spawners. |
| Lou Gorenfeld, "Lou's Pseudo 3D Page" | https://www.extentofthejam.com/pseudo/ | Natural road motion depends on per-depth optical flow: near road moves fast, far road moves slowly, and sprites scale by inverse depth. |
| Kometbomb, "How does Pico Racer work?" | https://kometbomb.net/2016/04/03/how-does-pico-racer-work/ | Pixel roads can strobe at the horizon; distant road/lane texture must be simplified, faded, or dithered. |
| Code Like It's 198x, "Pseudo-3D Road" | https://code198x.com/vault/techniques/pseudo-3d-road/ | Reinforces fixed horizon, scaled road width, sprite scaling, and parallax as the core illusion. |
| Unity Texture Import Settings | https://docs.unity3d.com/Manual/class-TextureImporter.html | Import settings are part of the asset contract: filter, repeat, mipmaps, alpha, compression, and read/write must be explicit. |
| Unity Mipmaps | https://docs.unity3d.com/Manual/texture-mipmaps-introduction.html | Mipmaps can reduce distant texture artifacts, but can blur pixel art and increase memory. Treat as road-only experiment after low-noise art/fade. |
| Unity Optimizing Draw Calls | https://docs.unity3d.com/Manual/optimizing-draw-calls.html | Mobile performance depends on reducing render-state changes through batching, shared materials, and atlases. |
| Unity Sprite Atlas workflow | https://docs.unity.cn/Manual/SpriteAtlasWorkflow.html | Extracted roadside/sign sprites should be packed by route/segment; repeating road tiles should not go into atlases. |
| SLYNYRD Pixelblog: Texture | https://www.slynyrd.com/blog/2018/2/15/pixelblog-2-texture | Moving asphalt should use clustered, low-noise texture. Random single-pixel speckles become shimmer. |
| SLYNYRD Pixelblog: Light and Shadow | https://www.slynyrd.com/blog/2018/6/15/pixelblog-6-light-and-shadow | Big Sur sunset assets need one consistent light direction and value structure across road, cliffs, props, signs, and car. |

## Master Thesis

NewTrip's driving view should feel like a calm scenic corridor moving toward the player. It should not feel like a triangle texture sheet sliding under a parked car.

Naturalness comes from system agreement:

- road geometry, lane, shoulder, signs, roadside sprites, weather, and car secondary motion share one visual distance state;
- road width, lane width, and sprite scale are depth-relative;
- the horizon is visually quiet and partly absorbed by fade/fog/background;
- asphalt detail is readable near the car but simplified near the horizon;
- background layers provide place identity, not a second gameplay road;
- sprites have clean alpha, bottom-center pivots, and ground-contact anchors;
- mobile performance is protected by low material count, atlases, object pooling, and limited full-screen alpha.

## Diagnosis Order

When the prototype looks bad, debug in this order.

### 1. Placeholder Motion Before Art

If placeholder road/camera/car feels wrong, real assets will not fix it.

Required pass:

```text
plain sky or no sky
solid/low-noise road
simple lane
simple block car
no far background
no bridge
no signs
no roadside props
no weather
```

Review for 10 seconds, not only a still frame.

Pass criteria:

- road does not feel like a flat triangular ramp;
- car tire baseline stays locked;
- lane cadence moves with road;
- horizon is quiet;
- bottom road gives speed without noisy shimmer.

### 2. Road Motion State

Current risk: separate timers make road/lane/spawner feel detached.

Target:

```text
RoadMotionState
  visualDistanceM
  visualSpeedMps
  visualSpeedNorm
  accelerationNorm
  driveMode
  stoppingEase
```

Every road-facing system derives from it:

```text
road UV / slice sampling
lane cadence
shoulder cadence
roadside object depth
sign approach depth
weather streak drift
car micro bob intensity
background parallax multiplier
```

Different layers may use different physical tile lengths or parallax multipliers. They must not use unrelated clocks.

### 3. Projection And Horizon

If the road looks like a needle or ramp, tune projection before changing art.

Big Sur portrait starting range:

```text
horizon_y: 0.49-0.53
bottom_y: -0.06 to -0.02
near_half_width: 0.80-0.90
horizon_half_width: 0.022-0.040
depth_curve: 1.75-1.95
slice_count: 64 review, 48 target, 32 low-end fallback
```

Avoid:

- horizon half-width below `0.018` without strong fade;
- lane lines fully opaque into the horizon;
- black/no-background RoadOnlyTest screenshots as final visual judgment;
- placing car lower/upper to hide bad projection.

### 4. Lane Cadence

Players read speed from lane and roadside cadence more than asphalt detail.

Rules:

- lane must use the same visual distance as road;
- lane width must be road-relative, not viewport-fixed;
- lane fade starts before horizon flicker;
- lane texture should be transparent or alpha-only, not baked into asphalt;
- dash/marking repeat must be reviewed in motion.

Target formula:

```text
lane_half_width = road_sample.half_width * lane_width_road_ratio
```

Use a small clamp only to keep near-horizon lines from disappearing abruptly, then fade them.

### 5. Road Material

If road looks weird, do not automatically make it sharper. Sharper often means more shimmer.

Good road material:

- low-noise warm dark asphalt;
- longitudinal grain aligned with driving direction;
- larger clusters, not random single-pixel glitter;
- subtle tire bands;
- no baked lane lines;
- no baked cracks for the first moving pass;
- no baked perspective;
- horizon-safe value contrast.

Test matrix:

```text
road_texture_id
texture_repeat: 5.5 / 7.0 / 8.5
horizon_fade_start: 0.58 / 0.65 / 0.72
horizon_alpha: 0.00 / 0.06 / 0.12
far_tint: lower contrast, warmer/paler
```

Only consider mipmaps or trilinear experiments after low-noise art, repeat tuning, and horizon fade have failed.

### 6. Roadside Motion

Road-only validates material, but real speed feel needs side objects.

Use placeholder roadside markers before real art:

```text
left far tree cluster every 18-28 m
left near cliff/rock every 10-16 m
right guardrail post every 6-9 m
right bush/rock every 14-22 m
sign every 120-180 m
```

Rules:

- spawn by deterministic distance spacing first;
- attach to `road.Sample(depth)`;
- scale from depth;
- pivot bottom-center;
- despawn below the car area;
- no object should fly above the horizon or float in the sky.

Random time-only spawning is allowed later as variation, not as the foundation.

### 7. Background Layer Policy

For the live driving view:

```text
sky: may be full portrait background
far background: transparent horizon band or tightly controlled lower band
midground: transparent/cutout or controlled silhouette band
bridge: disabled in 0-35 km coastal_cliffs
road: code-generated
car/signs/props: separate sprites
```

Do not use full scenic driving images as runtime background layers. Full scenic images are only for route cards, Travel Reports, scenic reveal cards, photo cards, and loading/travel summaries.

0-35 km Big Sur sunset should not show the bridge as a main runtime midground. The bridge belongs in the 35-70 km bridge segment unless explicitly approved as a tiny far silhouette.

### 8. Car Anchor

The car should feel heavy and fixed, not dead or floating.

Start after road motion passes:

```text
vertical bob: 0.006-0.012 viewport height
horizontal sway: 0.003-0.008 viewport width
rotation: max 0.4-0.8 degrees
boost pulse: 1.0-1.5% scale, 120-180 ms ease-out
normal screen shake: off
```

The tire baseline must remain visually locked to the road anchor. Car bob can move body mass, but not the perceived contact point.

### 9. Sprite Extraction And Alpha

Dirty crops make good art look bad.

Production extraction must be manifest-driven:

```text
source_sheet
crop_box
padding
canvas_size
pivot
status
qa_result
runtime_name
notes
```

Do not treat flood-fill alpha from contact sheets as production-approved. It is a prototype bridge only.

First runtime extraction set:

```text
car_beige_default
car_beige_brake
car_beige_dirty
road_asphalt_tile
lane_center_yellow_strip
sign_california_1
sign_green_blank
sign_rest_stop
roadside_rock_01
roadside_bush_01
roadside_guardrail_01
weather_haze_clouds
```

### 10. Mobile Performance

Performance rules start during art pipeline, not after polish.

Material policy:

```text
road: 1 shared opaque material
lane: 1 shared alpha material
shoulder: 1 shared material if enabled
roadside sprites: 1 route atlas material
sign sprites: 1 route atlas material
weather: 1 overlay material
car: 1 material
hud: separate UI atlas/materials
```

Runtime rules:

- use shared materials;
- avoid per-object unique materials;
- pool roadside/sign objects;
- keep transparent full-screen overlays low-alpha and sparse;
- avoid many runtime lights in V1;
- profile draw calls, batches, overdraw, and FPS after each layer returns.

## Symptom-To-Fix Table

| Symptom | Likely cause | First fix |
| --- | --- | --- |
| Road looks like a huge triangle ramp | horizon too narrow, no fade, projection not tuned | Tune `horizon_y`, `horizon_half_width`, `depth_curve`; add horizon fade before new art. |
| Road looks like conveyor belt | uniform UV scroll and no depth-aware motion | Introduce shared `RoadMotionState`; derive road/lane/shoulder UV from depth and distance. |
| Road texture sparkles or crawls | asphalt has high-frequency pixel noise | Use low-noise tile, reduce repeat, add horizon tint/fade; test mipmaps only later. |
| Lane line flickers at horizon | lane too thin/opaque and not fading | Road-relative lane width plus horizon fade. |
| Lane feels pasted on screen | viewport-fixed lane width | Compute lane width from road half-width. |
| Car floats | pivot/anchor mismatch or bob moves tire baseline | Bottom-center pivot, tire baseline guide, separate body bob from contact anchor. |
| Trees/signs fly in sky | screen-coordinate placement or wrong pivot | Spawn from road depth sample and use bottom-center ground-contact pivot. |
| Background has hard horizontal seam | full rectangle far/bridge layers cover each other | Sky full-screen only; far/mid layers must be transparent bands/cutouts. |
| Bridge makes 0-35 km scene crowded | wrong segment layer policy | Disable bridge runtime layer until 35-70 km. |
| Scene feels static despite moving road | no near-side optical flow | Add placeholder guardrail/roadside depth markers before fancy props. |
| Frame rate drops when props return | too many objects/material switches/overdraw | Atlas sprites, pool objects, reduce full-screen alpha, use shared materials. |

## Road-Only Review Gate

Keep `RoadOnlyTest` isolated until it passes.

Inputs:

```text
road_asphalt_tile_512_seamless.png
lane_double_yellow_alpha_only.png
no sky
no far background
no car
no signs
no roadside props
no weather
```

Required captures:

```text
still frame
10-second motion
close-up of lane at horizon
close-up of road near bottom
```

Record:

```text
projection preset
speed_norm
road repeat
lane repeat
horizon fade start
horizon alpha
filter mode
mipmap state
compression
verdict: pass / iterate / reject
```

Pass means the road and lane are visually stable in motion, not merely pretty in stills.

Accepted lane result as of 2026-05-18:

```text
default_lane_preset: RoadOnly B
style: wide road-relative double yellow
use_for_future_runtime_composite: yes
keep_a_viewport_depth_variant: comparison only
```

## Next Implementation Pass

The next Unity sprint should be:

1. Add `RoadMotionState` as the one visual travel source.
2. Make road, lane, shoulder, and spawners consume that state.
3. Make lane width road-relative.
4. Add road/lane horizon fade and far tint controls.
5. Add a small preset matrix for projection and road material repeat.
6. Add placeholder roadside distance markers for speed feel.
7. Run 10-second motion captures before enabling real background/sprites.
8. Only then re-enable clean extracted assets in this order: sky, far horizon band, car, roadside placeholders, signs, weather.

## Decision On More Road Art

Do not remake all assets now.

First prove:

```text
clean extraction
shared motion state
road-relative lane
horizon fade
placeholder roadside flow
phone-portrait camera contract
```

Then decide.

Likely candidates for remake after the clean motion pass:

- far horizon band;
- bridge runtime cutout for 35-70 km;
- one lower-noise asphalt tile if the current tile still crawls;
- one alpha-only lane strip variant if current lane remains too thin or noisy.

The current issue is primarily integration and motion-system coherence. Art clarity matters, but it cannot compensate for mismatched projection, independent clocks, dirty alpha, or wrong pivots.
