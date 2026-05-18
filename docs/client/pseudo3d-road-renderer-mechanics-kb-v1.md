# Pseudo-3D Road Renderer Mechanics Knowledge Base V1

Research date: 2026-05-18

Scope: NewTrip Unity phone-portrait pseudo-3D driving renderer. This document focuses only on OutRun-style road projection mechanics: scanline/segment math, lane rendering, sprite scaling, curves/hills, horizon handling, motion naturalness, and why simple UV-scrolled trapezoids look unnatural.

This is not a racing-game design document. NewTrip remains a curated travel simulator. The backend remains authoritative for distance, rewards, fuel, route state, and offline progress. The client owns visual prediction and must reconcile to backend state.

## Highest-ROI Sources

| Source | URL | Why it matters |
| --- | --- | --- |
| Lou Gorenfeld, "Lou's Pseudo 3D Page" | https://www.extentofthejam.com/pseudo/ | Classic theory for raster/scanline pseudo-3D roads, z-maps, curves, hills, sprite scaling, depth lookup, and the "oatmeal effect" warning. |
| Jake Gordon, JavaScript Racer: straight roads | https://jakesgordon.com/writing/javascript-racer-v1-straight/ | Practical segment projection architecture: road split into segments, camera position, screen projection, road polygons, sprites, player car, and loop timing. |
| Jake Gordon, JavaScript Racer: curves | https://jakesgordon.com/writing/javascript-racer-v2-curves/ | Curves are not just background movement; they are accumulated lateral offsets across segments, usually eased in and out. |
| Jake Gordon, JavaScript Racer: hills | https://jakesgordon.com/writing/javascript-racer-v3-hills/ | Hills are segment `world.y` changes projected through the same camera, not separate painted background tricks. |
| Jake Gordon, JavaScript Racer: final | https://jakesgordon.com/writing/javascript-racer-v4-final/ | Adds sprites, fog, clipping, cars, and the final painter's-order renderer needed for convincing roadside motion. |
| Jake Gordon source code, `common.js` | https://raw.githubusercontent.com/jakesgordon/javascript-racer/master/common.js | Direct implementation reference for `project`, `percentRemaining`, `increase`, `interpolate`, and `easeInOut` helpers. |
| Kometbomb, "How does Pico Racer work?" | https://kometbomb.net/2016/04/03/how-does-pico-racer-work/ | Very relevant low-res road renderer notes: per-line rendering, distant artifact control, dithering/tinting, and avoiding visual strobe. |
| Code Like It's 198x, "Pseudo-3D Road" | https://code198x.com/vault/techniques/pseudo-3d-road/ | Compact modern explanation of horizon, perspective road width, sprite scaling, parallax, and frame-rate expectations. |
| Cannonball OutRun engine | https://github.com/djyt/cannonball | Open-source OutRun engine lineage. Useful for validating that mature pseudo-3D road systems are segment/state machines, not static road images. |
| Unity Manual, Sprite Atlas | https://docs.unity3d.com/Manual/class-SpriteAtlas.html | Runtime roadside/sign sprites should be packed and material-disciplined once the renderer graduates from prototype. |
| Unity Manual, Texture Import Settings | https://docs.unity3d.com/Manual/class-TextureImporter.html | Road/lane texture repeat, filter, mipmap, alpha, and compression settings are renderer contract inputs, not ad hoc artist guesses. |

## Core Thesis

The natural pseudo-3D road is a moving projection system, not a scrolling picture.

The player believes the car is moving forward when these agree:

- road sample width narrows by depth;
- lane width and dash cadence narrow by the same depth;
- roadside objects are attached to road-space offsets and scale by depth;
- near-field road pixels move faster than far-field pixels;
- far horizon detail fades, tints, or becomes quieter;
- sky/far/midground parallax is slower than road motion;
- car stays heavy at the lower anchor with only subtle secondary motion.

A single trapezoid with a repeated texture and uniform UV scroll can look acceptable in a still frame, but in motion it reads as a flat conveyor belt because every depth band shares the same texture velocity.

## Segment/Scanline Mental Model

Classic pseudo-3D road renderers split the world road into ordered segments or screen scanlines.

### Segment Data

For NewTrip, a road segment can be treated as:

```text
RoadSegment
  index
  world_z_start_m
  world_z_end_m
  world_y_start_m
  world_y_end_m
  curve_delta
  road_width_m
  lane_pattern_id
  fog_strength
  roadside_spawn_refs
```

Flat V1 can set `world_y_* = 0` and `curve_delta = 0`. Keeping the fields in the mental model prevents future hills/curves from becoming hacks.

### Camera State

```text
RoadMotionState
  visual_distance_m
  visual_speed_mps
  acceleration_norm
  route_segment_key
  camera_height_m
  camera_depth
  horizon_y
```

`visual_distance_m` is client-predicted for smooth motion, but periodically reconciles to backend distance. All road-facing motion consumes this one state.

### Projection

For each visible segment endpoint:

```text
camera_z = world_z - visual_distance_m
scale = camera_depth / camera_z
screen_x = center_x + scale * (world_x - camera_x)
screen_y = horizon_y - scale * (world_y - camera_y)
screen_half_width = scale * road_width_m
```

NewTrip's current orthographic mesh can approximate this with normalized depth samples, but the next renderer should still behave like this: every slice knows its depth, width, road-space position, and motion distance.

## Render Order

Use painter order from far to near:

```text
sky
far background
midground horizon band
far road slices
near road slices
roadside/sign sprites sorted by depth
weather overlay
car
hud
```

For hills later, a `clip_y` or max-screen-y rule is needed so far segments/sprites behind a crest do not draw through the road.

## Lane Rendering

Lane markings are optical-flow markers, not decoration.

Rules:

- Lane width must be road-relative: `lane_half_width = road_half_width * ratio`.
- Lane dash/gap cadence must come from `visual_distance_m`, not an unrelated timer.
- Lane visibility should fade before horizon flicker begins.
- Double yellow must stay readable near the car and become rhythm/shape in middle distance, not a needle at the vanishing point.

Recommended first ratios:

```text
center_double_yellow_total_width_ratio: 0.018-0.032 of road half-width
lane_horizon_fade_start_depth: 0.55-0.68
lane_horizon_alpha: 0.00-0.10
dash_world_length_m: 4-7
gap_world_length_m: 8-14
```

For a continuous double-yellow strip, use a repeated transparent strip but drive its vertical coordinate from world distance and slice depth. Do not use a fixed screen-space strip.

## Road Texture Motion

Road texture should be distance-addressed:

```text
world_v = (visual_distance_m + slice_world_z_m) / meters_per_texture_repeat
```

Then apply far-distance suppression:

```text
far_t = saturate((depth - fade_start) / (1 - fade_start))
alpha = lerp(1, horizon_alpha, far_t)
tint = lerp(near_tint, far_tint, depth)
```

This is different from uniform `_MainTex_ST` scrolling. A global texture offset moves the road as one flat material. Distance-addressed slices let far and near bands read as different depths.

## Sprite Scaling And Placement

Roadside sprites and signs should be spawned in road space:

```text
object_z_m = spawn_distance_m - visual_distance_m
object_segment = findSegment(object_z_m)
sample = road.Project(object_z_m)
base_x = sample.center_x +/- sample.road_half_width
screen_x = base_x + lateral_offset_ratio * sample.road_half_width
screen_y = sample.y
scale = sprite_world_height_m * sample.scale
```

Rules:

- Pivot is bottom-center ground contact.
- Scale is derived from projected depth, not hand-tuned screen Y.
- Despawn below the car area, not merely below screen.
- Sort sprites by depth; far before near.
- Use deterministic distance spacing first. Pure random time intervals create mushy cadence and are harder to debug.

## Curves And Hills

Do not add curves/hills until flat RoadOnlyTest motion passes. When added:

### Curves

- Store curve strength per segment.
- Accumulate lateral offset as segments advance.
- Ease in, hold, ease out.
- Move background parallax based on road curve, not an unrelated background timer.

### Hills

- Store `world.y` per segment endpoint.
- Project hill height through the same camera math.
- Use clipping so hidden segments/sprites do not appear through crests.
- Keep V1 Big Sur hills subtle. The game is a travel simulator, and aggressive rollercoaster hills will read like racing.

## Horizon Handling

The horizon must absorb the road; it should not expose a mathematical needle.

Use:

- `horizon_half_width` wide enough to avoid a pin-prick road end;
- far road alpha/tint/fog;
- lane fade before the line becomes subpixel strobe;
- far background/midground mass that visually catches the road;
- optional road throat occluder band for cliffs/fog, not a full-screen scenic road image.

For phone portrait Big Sur tests:

```text
horizon_y: 0.49-0.53
bottom_y: -0.08 to -0.02
near_half_width: 0.80-0.90 viewport width
horizon_half_width: 0.022-0.040 viewport width
depth_curve: 1.75-2.05
slice_count: 48 runtime, 64 review, 32 low-end fallback
```

Avoid `horizon_half_width < 0.018` unless the road is strongly hidden by fog/midground.

## Why The Current Prototype Can Feel Unnatural

Current NewTrip prototype risks:

- `Pseudo3DRoadRenderer` scrolls material UV globally.
- `LaneMarkingRenderer` can run a separate scroll multiplier, making lane and asphalt disagree.
- Lane width can read as viewport-fixed rather than road-relative.
- Roadside spawner timing can behave like screen animation instead of world-distance motion.
- Horizon can become too narrow, producing a ramp/needle effect.
- Current asphalt candidate has too much high-frequency bright speckle, which shimmers under point-filtered motion.

This does not mean the art direction is wrong. It means RoadOnlyTest must graduate from image/material scrolling to segment-distance motion.

## Unity Portrait Implementation Target

Introduce a focused renderer layer:

```text
RoadMotionState
  visualDistanceM
  visualSpeedMps
  speedNorm
  accelerationNorm
  stoppingEase

RoadSegmentTable
  segmentLengthM
  roadWidthM
  curve
  elevation
  lanePattern
  fog

Pseudo3DRoadRendererV2
  samples visible segment endpoints
  builds road mesh rows from projected samples
  assigns UV from visualDistanceM + sample worldZ
  applies horizon tint/fade

LaneMarkingRendererV2
  shares projected samples
  uses road-relative width
  derives dash/strip phase from visualDistanceM
  fades at horizon

RoadsideSpawnerV2
  schedules objects by route distance
  projects object depth through the same road samples
  pools sprites

RoadDebugOverlay
  shows horizon, road bounds, depth marks, spawn anchors, car anchor
```

## Motion Review Gate

Road-only is not approved by still frame.

Required captures:

- still frame;
- 10-second motion test;
- lane horizon close-up;
- road bottom close-up;
- optional side-by-side candidate matrix.

Pass criteria:

- no conveyor-belt feeling;
- no horizon needle;
- no glitter/shimmer in far asphalt;
- lane and asphalt feel physically locked;
- near road has speed, far road is calm;
- road edge can later be hidden by shoulder/guardrail without changing projection.

## Pitfalls To Avoid

- One full-screen driving image as gameplay road.
- One trapezoid with uniform UV scroll as the whole motion model.
- Lane strip with fixed screen width.
- Separate timers for road, lane, shoulder, signs, and weather.
- High-frequency asphalt speckles.
- Far lane lines that strobe at the horizon.
- Screen-space roadside object placement.
- Center-pivot signs/trees/rocks.
- Overlapping full-rectangle backgrounds with mismatched horizons.
- Adding car/background/props before road-only motion passes.
- Adding curves/hills before flat optical flow is stable.
- Testing only in Unity Free Aspect instead of phone portrait.

## Next Implementation Recommendation

Do this before adding more art:

1. Add `RoadMotionState`.
2. Convert road/lane UV from timer scroll to distance-addressed slice UV.
3. Convert lane width to road-relative ratio.
4. Add horizon lane fade if not already present.
5. Capture RoadOnlyTest 10-second motion before re-enabling sky/car/props.

Only after those pass should NewTrip re-enable:

```text
sky -> far background -> edge/shoulder -> guardrail cadence -> car -> signs -> weather
```
