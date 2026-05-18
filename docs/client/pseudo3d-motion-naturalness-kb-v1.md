# Pseudo-3D Motion Naturalness Knowledge Base V1

Research date: 2026-05-18

Scope: NewTrip Unity phone-portrait pseudo-3D driving prototype. This document is focused only on motion naturalness and game feel: optical flow, sense of speed, parallax, roadside object spawning/scaling, road texture motion, lane cadence, camera/car motion, and avoiding the "texture conveyor belt" effect.

This does not change backend authority. Backend still owns actual distance, rewards, fuel, and trip state. The Unity client owns short-term visual prediction and must reconcile to backend state.

## Research Method

The research was split into three sub-agent tracks:

1. Pseudo-3D road/projection sources.
2. Motion perception, game feel, and speed readability sources.
3. Unity/mobile/pixel performance sources.

`agent-browser` was used to inspect the Jake Gordon article structure directly. `scrapling-official` was checked as the preferred batch-scrape workflow, but this machine currently has Python 3.9.6 and no `scrapling` package installed; Scrapling requires Python 3.10+, so this pass used browser/web extraction instead.

## Top Sources

| Source | URL | High-ROI takeaway for NewTrip |
| --- | --- | --- |
| Lou Gorenfeld, "Lou's Pseudo 3D Page" | https://www.extentofthejam.com/pseudo/ | Classic pseudo-3D road rendering depends on per-depth road samples, road width projection, per-line/segment motion, sprite scaling, and depth-indexed lookup rather than one full road image. |
| Jake Gordon, "How to build a racing game - straight roads" | https://jakesgordon.com/writing/javascript-racer-v1-straight/ | Practical segment loop for pseudo-3D driving: road segments, camera position, projection, sprites, road, car, and game loop all share one world position. |
| Jake Gordon, "How to build a racing game - curves" | https://jakesgordon.com/writing/javascript-racer-v2-curves/ | Background parallax is tied to road curve and speed. NewTrip should tie sky/far/background offsets to visual road state, not free-floating timers. |
| Jake Gordon, "How to build a racing game - hills" | https://jakesgordon.com/writing/javascript-racer-v3-hills/ | Vertical motion and horizon changes need easing and segment-based projection; useful later for coastal climbs, bridge ramps, and hill crests. |
| Jake Gordon, "How to build a racing game - final" | https://jakesgordon.com/writing/javascript-racer-v4-final/ | Sprites and cars are projected by depth, not placed in screen coordinates. This directly maps to NewTrip's roadside/sign spawner contract. |
| Kometbomb, "How does Pico Racer work?" | https://kometbomb.net/2016/04/03/how-does-pico-racer-work/ | Very relevant warning for pixel road games: distant road/lane markings can strobe or flicker. Road depth lookup, road markings, and sprite placement need artifact control. |
| PLOS ONE, optic-flow/self-motion perception article | https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0055446 | Sense of movement comes from optic flow, not just object translation. Near-field motion and depth cues strongly affect perceived self-motion/speed. |
| Game Feel resources around Jan Willem Nijman's "The Art of Screenshake" | https://www.gamedesign.gg/knowledge-base/game-design/game-feel-feedback/the-art-of-screenshake-jan-willem-nijman-vlambeer/ | Micro feedback such as camera motion, particles, and timing can add feel, but for NewTrip it must be subtle to avoid motion sickness or road instability. |
| Unity Manual, Sprite Atlas | https://docs.unity3d.com/Manual/sprite-atlas.html | Route roadside/sign sprites should share atlases and materials to reduce draw calls. |
| Unity Manual, Optimizing Draw Calls | https://docs.unity3d.com/Manual/optimizing-draw-calls.html | Naturalness cannot cost unbounded draw calls; batching/material discipline matters once roadside objects and overlays return. |
| Unity 2D Pixel Perfect docs | https://docs.unity.cn/Packages/com.unity.2d.pixel-perfect@1.0/manual/index.html | Pixel motion must be stable in the phone frame. Point filtering and stable scaling are necessary, but high-frequency moving road textures still need shimmer control. |
| Unity Texture Import Settings | https://docs.unity3d.com/Manual/class-TextureImporter.html | Road/lane repeat, mipmap, alpha, compression, and filter settings are part of the renderer contract, not per-asset guesses. |

## Core Motion Thesis

Natural forward-driving feel is not created by a beautiful road still.

It is created when the player sees a coherent optic-flow system:

- near road pixels move fastest;
- far road pixels move slowly or fade into the horizon;
- lane, road, shoulder, signs, and roadside sprites share one virtual travel distance;
- side objects grow and descend according to projected depth;
- background layers drift less than road layers;
- the car stays visually anchored while receiving tiny secondary motion;
- camera effects support speed state without moving the whole world enough to break the road anchor.

If those systems disagree, the scene feels like stacked images sliding over each other.

## Principles For NewTrip

### 1. One Motion State

Use one visual distance source for all road-facing motion:

```text
visual_distance_m += visual_speed_mps * delta_time
visual_speed_norm = clamp(server_speed_kmph / 72, 0, 1.35)
```

Road UV, lane cadence, shoulder cadence, side-object depth, sign approach, weather streak drift, and optional background parallax should derive from this state. They can use different tile lengths or parallax multipliers, but they must not use unrelated clocks.

### 2. Depth-Aware Optical Flow

Uniform UV scroll looks like a conveyor belt because every road slice appears to move the same way. In a forward-driving illusion:

```text
near depth: fast, large motion
middle depth: readable motion
horizon depth: tiny motion, fade, or stable band
```

The horizon should be quiet. Put speed readability near the lower half and roadside foreground, not in a noisy far strip.

### 3. Lane Cadence Beats Asphalt Detail

Players read speed more from repeating lane/edge cadence and roadside objects than from random asphalt noise.

For NewTrip:

- asphalt should be low-noise and mostly longitudinal;
- double yellow should have clear repeated rhythm;
- edge lines/guardrails/roadside posts can add speed cadence later;
- lane cadence must compress toward horizon without strobing.

### 4. Roadside Objects Are The Strongest Speed Cue

The road-only pass can validate material and lane movement, but full speed feel needs side objects:

- near guardrail segments moving fast at screen edges;
- left cliff/trees moving slightly slower but still depth-projected;
- sparse signs with predictable approach windows;
- small foreground objects that pass below the screen.

These should spawn near horizon, attach to `road.Sample(depth)`, scale from far to near, and despawn below the car area.

### 5. Background Parallax Should Be Subtle

Sky should be nearly stable. Far coast/mountains should move barely. Midground may drift slightly during curves/segment transitions. If all background layers move with the road, the world feels like a flat poster.

Suggested multipliers:

```text
sky: 0.00-0.02
far mountains/ocean: 0.02-0.06
midground bridge/cliffs: 0.05-0.12
roadside far props: 0.35-0.55
near roadside/guardrail: 0.85-1.20
road/lane: 1.00 physical source, different tile length only
```

### 6. Car Anchor Must Feel Heavy

The rear car sprite is fixed in screen space, but should not be dead. Use small secondary motion:

```text
vertical engine bob: 0.006-0.012 viewport height
horizontal sway: 0.003-0.008 viewport width
rotation: max 0.4-0.8 degrees
boost kick: short easing pulse, not continuous shake
brake/forced stop: visualSpeed eases down, car settles lower by 0.003-0.006 viewport
```

Never let car bob change the tire baseline enough that the car appears to float above the road.

### 7. Pixel Motion Needs Shimmer Control

Point filtering plus a high-frequency repeating road texture can shimmer when compressed toward the horizon. Do not solve this by making the texture sharper.

Use:

- lower-frequency asphalt art;
- fewer single-pixel bright speckles;
- longitudinal grain instead of random glitter;
- horizon alpha/tint fade;
- lower texture repeat if cadence is too dense;
- optional far-road simplified material band if needed.

## Current NewTrip Implications

Current road code is in the correct family because it uses sliced meshes and road samples. The motion problems are likely these:

1. `Pseudo3DRoadRenderer` scrolls texture uniformly through `_MainTex_ST`.
2. `LaneMarkingRenderer` has its own UV timer and `scrollMultiplier`.
3. Lane width is viewport-based, not road-width-relative.
4. Side spawner moves depth with a simple linear timer instead of shared visual distance.
5. `BigSurPrototype` horizon is very narrow, which can create a needle/ramp effect.
6. RoadOnlyTest black background makes the road edge/horizon harsher, but the material shimmer problem exists independently.

Recommended architecture target:

```text
RoadMotionState
  visualDistance
  visualSpeedNorm
  accelerationNorm
  driveMode
  stoppingEase

RoadRenderer
  samples road geometry
  derives UV by depth and visualDistance

LaneRenderer
  uses same visualDistance
  road-relative width
  horizon fade

RoadsideSpawner
  converts visualDistance to object depth/lifecycle
  uses deterministic spacing, not pure time-only spawn

CarRearController
  consumes visualSpeedNorm/accelerationNorm only for small secondary motion
```

## Concrete Tuning Recommendations

### Road Projection Starting Range

For Big Sur phone portrait, test these before adding art layers:

```text
horizon_y: 0.49-0.53
bottom_y: -0.06 to -0.02
near_half_width: 0.80-0.90
horizon_half_width: 0.022-0.040
depth_curve: 1.75-1.95
slice_count: 64 for review, 48 target, 32 low-end fallback
```

Avoid `horizon_half_width` below `0.018` unless a strong horizon fade/occluder exists.

### Road Material

Use 2-3 asphalt candidates:

```text
road_asphalt_512_clean_low_noise
road_asphalt_512_longitudinal_worn
road_asphalt_512_horizon_safe_soft
```

Review settings:

```text
texture_repeat: 5.5, 7.0, 8.5
horizon_fade_start_depth: 0.58, 0.65, 0.72
horizon_alpha: 0.00, 0.06, 0.12
near_tint: dark warm charcoal
far_tint: slightly lower contrast and warmer
```

Reject if the 10-second capture has glitter, crawling pixels, or carpet/noise feeling.

### Lane Material And Cadence

Test lane as road-relative width:

```text
lane_half_width_ratio: 0.010, 0.014, 0.018 of road half-width
lane_min_horizon_width_world: small clamp only
lane_texture_repeat: 8, 10, 12
lane_horizon_fade_start_depth: 0.55-0.65
```

The lane should be readable near the car, become rhythmic in mid-distance, and fade before it turns into horizon flicker.

### Roadside Spawner

For motion review, do not spawn all art. Use simple debug blocks or clean silhouettes:

```text
left_far_tree_cluster every 18-28 m, parallax 0.45
left_near_cliff/rock every 10-16 m, parallax 0.85
right_guardrail_post every 6-9 m, parallax 1.05
right_coast_rock/bush every 14-22 m, parallax 0.70
sign every 120-180 m, parallax 0.90
```

Use deterministic distance spacing first. Pure random time intervals make cadence feel mushy and harder to debug.

### Camera And Car Feel

Start with car-only micro motion, not whole-camera shake:

```text
idle/drive bob frequency: 1.4-2.2 Hz
boost bob frequency: 2.2-3.0 Hz
bob amplitude: 0.006-0.012 viewport height
horizontal sway amplitude: 0.003-0.008 viewport width
boost FOV/scale pulse: max 1.0-1.5%, 120-180 ms ease-out
screen shake: off by default for normal driving
```

If full-screen camera bob is added, keep it below the threshold where HUD and road horizon feel unstable.

## 10-Second Motion Review Protocol

Capture at phone portrait size, then review at real phone scale and desktop scale.

### Pass A: Road/Lane Only

Inputs:

```text
no sky
no car
no props
road + lane only
speed_norm: 1.0
duration: 10 seconds
```

Pass criteria:

- no visible texture glitter;
- lane does not crawl/flicker at horizon;
- road does not feel like one flat triangle sliding;
- still frame and motion frame differ coherently;
- near road has motion, horizon stays quiet.

### Pass B: Placeholder Car Anchor

Add a simple car block/sprite.

Pass criteria:

- tire baseline remains locked to road anchor;
- car micro bob adds life but never floats;
- road motion appears under car, not through car;
- boost/brake visual speed easing does not break anchor.

### Pass C: Roadside Optical Flow

Add only simple placeholder roadside markers.

Pass criteria:

- objects spawn near horizon and descend/grow on road projection;
- no objects fly above horizon;
- near roadside objects create stronger speed cue than asphalt;
- left/right cadence feels varied but not random soup;
- sorting order changes do not pop visibly near the car.

### Pass D: Background Parallax

Add sky and far horizon band.

Pass criteria:

- sky stable;
- far background nearly stable;
- road horizon is absorbed by environment;
- no rectangular seams;
- background does not make the road feel pasted on.

### Quantitative Review Checklist

For every 10-second review, record:

```text
speed_norm
projection preset
road texture id
road repeat
lane texture id
lane repeat
horizon fade start
horizon alpha
side object count by type
average active objects
draw calls / batches
lowest observed FPS
review verdict: pass / iterate / reject
```

## Anti-Patterns

- Full-screen driving illustration used as gameplay road.
- Uniform road UV scroll as the only speed cue.
- Lane strip moving at a different physical speed from asphalt.
- Viewport-fixed lane width.
- High-frequency asphalt speckles.
- Yellow lane continuing fully opaque into the horizon.
- Objects placed in screen coordinates instead of road depth coordinates.
- Pure random time-based roadside spawning with no distance cadence.
- Background scrolling at road speed.
- Camera shake during normal cruising.
- Car bob that changes tire baseline.
- Horizon half-width so small that road becomes a needle.
- Adding more beautiful art before placeholder motion passes.
- Judging still screenshots before watching 10-second clips.
- Measuring only FPS and ignoring shimmer, strobe, and optic-flow coherence.

## First Implementation Order

1. Add shared `RoadMotionState`.
2. Make road/lane/shoulder derive from shared visual distance.
3. Make lane width road-relative.
4. Add horizon fade/tint review controls.
5. Add a 10-second capture matrix for road/lane material candidates.
6. Replace time-random spawning with distance-spaced placeholder roadside markers.
7. Add car micro bob after road optical flow is stable.
8. Add sky/far background only after road/lane/car/spawner motion passes.

The practical rule is simple: NewTrip should feel like the player is moving through a quiet scenic corridor, not like a texture sheet is being pulled under a parked car.
