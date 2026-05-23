# Pseudo-3D Road Renderer V1

This document defines the Unity client prototype for NewTrip's forward road view.

The production driving screen must not rely on one full-screen driving illustration. Full-frame images are allowed for route cards, Travel Reports, loading cards, scenic landmark reveals, and photo cards. The live driving view is assembled from code-generated road geometry, repeatable textures, sprites, and background layers.

For the current research-backed implementation guidance, start with `docs/client/newtrip-pseudo3d-driving-knowledge-base-v1.md`. It is the master entrypoint for motion naturalness, road material review, lane cadence, background layering, sprite spawning, and mobile performance rules.

## Goal

Build a playable forward road view for the V1 tutorial route that supports:

- backend-authoritative route progress;
- a continuously moving road;
- a fixed rear-view player car;
- roadside sprite spawning and perspective scaling;
- landmark/sign approach moments;
- sky and far background layers;
- weather overlays;
- route segment visual swaps.

The first target segment is:

```text
route_key: tutorial_big_sur_hwy1_001
segment: 0-35 km
terrain: coastal_cliffs
time: sunset
visual pack: bigsur_sunset
```

Coordinate and aspect rules are defined in `docs/client/unity-portrait-coordinate-contract-v1.md`. The Unity prototype composite is phone-portrait first; Unity's wide `Free Aspect` editor view is not the layout source of truth.

## Non-Goals

- No full-screen generated driving image as the gameplay surface.
- No real map or GPS rendering.
- No free steering.
- No racing UI.
- No real vehicle physics.
- No runtime image generation.
- No live weather API.

## Runtime Layer Stack

Unity should render the driving view in this order:

```text
sky_horizon_background
far_background_silhouette
code_generated_road_projection
lane_marking_strip
side_object_sprites
landmark_sign_sprites
weather_overlay
car_rear_sprite
hud
```

The road is the technical center of the visual system. It is not a generated full image. It is a procedural projection that can consume small road and lane textures.

## Core Renderer Objects

### `RoadSceneController`

Owns current visual segment state.

Inputs:

- `route_key`
- `segment_index`
- `current_distance_km`
- `speed_kmph`
- `drive_mode`
- `forced_stop_reason`
- `weather_state`
- `day_night_phase`

Responsibilities:

- choose the active `RoadVisualPack`;
- pass movement speed to the road renderer;
- trigger landmark/sign spawn windows;
- crossfade background packs at segment transitions;
- never calculate authoritative distance or rewards.

### `Pseudo3DRoadRenderer`

Generates the road mesh or strip stack.

Prototype-only starting approach:

- Use an orthographic portrait camera.
- Generate a trapezoid road mesh from horizontal slices.
- Use UV scrolling only for the earliest RoadOnlyTest placeholder pass.
- Draw lane markings as a separate center strip layer so markings can be replaced without changing asphalt art.

Research update:

`docs/client/pseudo3d-road-renderer-mechanics-kb-v1.md` is now the renderer mechanics source of truth for the next road pass. The long-term road renderer should be driven by a shared visual distance state, road-relative lane width, depth-addressed road/lane sampling, and horizon fade/tint. Uniform UV scrolling is allowed only as a temporary prototype baseline because it can create a flat conveyor-belt effect in motion.

Projection model:

```text
horizon_y = 0.60 screen height
bottom_y = -0.06 screen height
near_half_width = 0.86 screen width
horizon_half_width = 0.014 screen width
depth_curve = 2.05
```

These values are the accepted Reference Gentle Road angle from `docs/client/unity-portrait-coordinate-contract-v1.md` and `RoadViewportContract`. Backgrounds, car placement, side-object spawning, and HUD layout should align to this horizon instead of retuning the road per layer.

For each road slice:

```text
t = slice_index / slice_count
perspective_t = pow(t, depth_curve)
y = lerp(bottom_y, horizon_y, perspective_t)
half_width = lerp(near_half_width, horizon_half_width, perspective_t)
left_x = center_x - half_width
right_x = center_x + half_width
```

The implementation can start with 32-48 slices. More slices give smoother perspective but are not necessary for the V1 prototype.

Motion:

```text
uv_scroll += visual_speed * delta_time
visual_speed = clamp(server_speed_kmph / 72, 0, 1.35)
```

This is a prototype baseline only. `visual_speed` affects animation only. Server state still determines actual progress. The Unity Road Lock Pass now requires a shared `RoadMotionState.visualDistanceMeters` consumed by road, lane, edge, and future spawners. Independent scroll clocks are not allowed for production prototypes.

Road visual tuning:

- The base asphalt road pass must be visually opaque. Do not fade the road mesh alpha to blend it into the horizon.
- Big Sur sunset composites should use warm brown/orange vertex tint presets on the road material, not black debug asphalt.
- Horizon softness should come from the dedicated low-alpha `HorizonHazeLayer`, not transparent road geometry. The current Step 4 review asset is `Assets/NewTrip/Art/ScenePacks/CaliforniaHwy1/BigSurSunset/Background/horizon_haze_warm_v01.png`.
- Current review presets are:

```text
A Warm Balanced: near (0.82, 0.67, 0.55, 1), far (0.70, 0.56, 0.50, 1)
B Sunset Warm:   near (0.95, 0.72, 0.52, 1), far (0.78, 0.58, 0.48, 1)
C Darker Natural:near (0.68, 0.56, 0.48, 1), far (0.58, 0.50, 0.46, 1)
```

The asphalt material should use the opaque road shader (`NewTrip/RoadOpaqueVertexColor`) so texture alpha cannot make the road transparent. Yellow lane and white edge markings may still use alpha materials.

Step 5 Road Lock Pass:

- Contract doc: `docs/client/unity-road-lock-pass-v1.md`.
- Unity menu: `NewTrip/Road Prototype/Capture Step 5 Road Lock Pass`.
- Road geometry stays code-generated from slices; do not use a full-road image.
- The active visual review uses `RoadProjectionPreset.ReferenceGentleRoad`, promoted from Road Perspective Review candidate B after the user accepted the less-steep road angle.
- Accepted lane preset is RoadOnly B: two road-relative projected yellow-line meshes.
- Road, yellow lines, white edge lines, and future side spawners must share `RoadMotionState.visualDistanceMeters`.
- Horizon softness comes from `HorizonHazeLayer`, not road alpha.

Road Perspective Review Pass:

- Contract doc: `docs/client/unity-road-perspective-review-pass-v1.md`.
- Unity menu: `NewTrip/Road Prototype/Capture Road Perspective Review Pass`.
- This is a projection-only A/B/C gate for judging whether the locked road reads too steep, too short, or too platform-like.
- Candidate B (`RoadProjectionPreset.ReferenceGentleRoad`) is now the accepted active road projection. Candidate C (`RoadProjectionPreset.LongCoastRoad`) remains only as an art-direction comparison.

Step 6 CarAnchorTest:

- Contract doc: `docs/client/unity-car-anchor-test-v1.md`.
- Unity menu: `NewTrip/Road Prototype/Capture Step 6 CarAnchorTest`.
- The car is fixed at `car_anchor_x = 0.50`, `car_anchor_y = 0.105`.
- The accepted starting car scale candidate is `0.56` for the cleaned `car_rear_view_clean` rear sprite.
- This gate validates the car tire baseline, scale, contact shadow, and 10-second road motion under a fixed car. It must not add UI, bridge, props, signs, guardrails, weather, shoulders, or a full-road image.

### `LaneMarkingRenderer`

Renders dashed center lines over the procedural road.

Recommended V1 approach:

- Use a narrow repeated lane marking strip.
- Project it with the same road slice math.
- Derive UV/dash cadence from the same visual distance as the asphalt.
- Scale lane width from projected road width instead of using fixed screen width.
- Keep the lane strip separate from the asphalt so boost, night, rain, and road variants can reuse the same geometry.

### `CarRearController`

Keeps the player car anchored near lower center.

Motion:

- subtle engine bob;
- small horizontal sway;
- boost glow overlay when `HOLD_TO_BOOST`;
- dirt overlay if cleanliness is low;
- damage hint overlay if durability is low.

The car does not steer. It gives life to the scene while the road and side objects create forward motion.

For prototype composite imports, the car sprite pivot is bottom-center so the tire baseline sits on the road anchor. Do not use center-pivot vehicle sprites for the driving view.

### `SideObjectSpawner`

Spawns sprite objects along virtual roadside lanes and projects them into screen space.

Object types for Big Sur sunset:

- left cliff rocks;
- pine clusters;
- chaparral/flowers;
- right guardrail pieces;
- right coast rocks.

Each object has:

```text
sprite_id
side: left | right
spawn_depth
lane_offset
base_scale
parallax_speed
rarity_weight
segment_tags
```

Roadside sprites and sign sprites must use bottom-center pivots. The projected point is the object's ground contact point, not the object's center.

Projection:

```text
screen_y = road_y_at_depth(depthT)
road_half_width = road_width_at_depth(depthT)
side_anchor_x = center_x +/- road_half_width
screen_x = center_x +/- road_half_width * outside_shoulder_offset
perspective_t = pow(depthT, 2.45)
scale = base_scale * (1.0 - perspective_t)
sorting_order = round((1.0 - depthT) * 1000)
```

Implementation lock:

- `SideObjectSpawner` must call `Pseudo3DRoadRenderer.Sample(depthT)` for X/Y projection.
- Runtime side objects spawn at `depthT = 1.0` near the horizon and despawn at `depthT = 0.0` near the screen bottom.
- Side object X placement is road-space offset outside the road/shoulder, not direct screen coordinates.
- Runtime side objects compensate imported sprite pivots so the visible bottom-center sits on the projected ground point.
- First review asset: `Assets/NewTrip/Art/ExtractedSprites/roadside_guardrail_low_wooden_01.png`.
- First review scene/menu: `NewTrip > Road Prototype > Create SideObject Guardrail Review Scene`.
- First capture menu: `NewTrip > Road Prototype > Capture SideObject Guardrail Review`.

Lifecycle:

- spawn at `depthT = 1.0`;
- move toward bottom as `depthT` decreases;
- increase scale as the object approaches;
- despawn at `depthT = 0.0`.

### `LandmarkSignSpawner`

Spawns special approach markers for forced stops, landmarks, and destination moments.

For the first segment, this can stay mostly empty. For the 35-70 km bridge segment, it should support:

- Bixby Bridge approach marker;
- photo stop prompt sign;
- forced stop visual cue.

Rules:

- signs are visual prompts only;
- backend decides forced stop;
- no readable text unless specifically authored and QA-approved.

### `WeatherOverlayRenderer`

Renders lightweight additive or transparent overlays.

V1 examples:

- clear: none;
- light cloud: subtle haze;
- rain: diagonal rain streak sheet;
- fog: low alpha fog band.

Weather effects must match backend deterministic weather state, not a live weather API.

## Data Model

Create a Unity `ScriptableObject` for each visual pack:

```csharp
RoadVisualPack
{
    string packId;
    string routeKey;
    int segmentIndex;
    Sprite skyHorizon;
    Sprite farBackground;
    Texture2D roadTextureTile;
    Texture2D laneMarkingStrip;
    Sprite carRearSprite;
    Sprite[] roadsideSprites;
    Sprite[] signSprites;
    Sprite[] weatherOverlays;
    Color roadTint;
    Color laneTint;
    float horizonY;
    float nearHalfWidth;
    float horizonHalfWidth;
    float depthCurve;
}
```

Recommended first pack:

```text
packId: bigsur_sunset_coastal_cliffs_v1
routeKey: tutorial_big_sur_hwy1_001
segmentIndex: 0
```

## Backend Reconciliation

The client renders continuously, but reconciles to backend state.

Loop:

1. Player holds drive / auto drive / boost.
2. Client animates immediately using the last known speed and mode.
3. Client sends drive tick intent.
4. Backend returns authoritative distance, vehicle deltas, reward, and forced stop.
5. Client eases visual progress to backend distance.
6. If forced stop is returned, road motion slows to stop and the relevant visual cue appears.

The road renderer should expose:

```text
SetVisualSpeed(float normalizedSpeed)
SetSegmentVisualPack(RoadVisualPack pack)
SetForcedStopVisual(string reason)
SetWeatherVisual(string weatherKey)
```

It should not expose wallet, reward, or route unlock mutation APIs.

## Route Segment Visual Strategy

For the current planned route direction:

```text
0-35 km: coastal_cliffs, sunset
35-70 km: bridge_coast, night
65-95 km: boardwalk_approach, morning daylight
```

The `65-70 km` overlap is a visual transition window. Route config should decide which pack is active, when crossfade begins, and when the boardwalk pack becomes primary. The Unity client consumes the active visual pack from backend/config state instead of inferring it from local distance alone.

Segment transitions should be crossfades of visual packs, not hard cuts:

- background crossfade over 1.0-2.0 seconds;
- road tint crossfade;
- side object spawn table swap;
- weather overlay update;
- car remains stable.

## Unity Visual Fix Sprint

Before reviewing generated art, the Unity prototype must pass a placeholder-only composite:

```text
pure-color sky
procedural road mesh
road shoulder strips
simple lane strip
fixed block/rear car
no real background layers
no real roadside sprites
no auto-spawned signs
no weather overlay
debug overlay enabled
```

If this view looks wrong, do not solve it by generating new art. Fix projection, camera, car anchor, lane width, and road fade first.

`RoadDebugOverlay` should be available in the prototype scene and show:

- horizon line;
- car anchor;
- road bounds at `depth = 1.0, 0.75, 0.5, 0.25, 0.0`;
- roadside/sign spawn points;
- HUD safe area.

The first route segment must use this policy:

```text
0-35 km coastal_cliffs: sky allowed, far horizon band optional, bridge disabled
35-70 km bridge_coast: bridge runtime cutout allowed
65-95 km boardwalk_approach: boardwalk runtime pack allowed
```

Imported generated sheets must go through `docs/client/unity-asset-extraction-rules-v1.md` before being treated as Unity review sprites.

## Art Requirements

### Road Texture Tile

Purpose: small repeatable asphalt texture used by `Pseudo3DRoadRenderer`.

Requirements:

- seamless vertical tile;
- 16-bit pixel-art asphalt;
- no lane markings;
- no perspective baked into the image;
- warm sunset variant first;
- optional night/morning tints later;
- square or narrow vertical texture, recommended `256x256` or `256x512`;
- no sky, cliffs, cars, signs, text, UI, or shadows from specific objects.

Filename example:

```text
bigsur_sunset_driving_road_asphalt_tile_v01_draft.png
```

### Lane Marking Strip

Purpose: center dashed yellow line overlay.

Requirements:

- transparent background;
- vertical repeated strip;
- double yellow center marks;
- consistent dash length and gap;
- no asphalt outside a narrow center strip unless intentionally included;
- recommended `128x512` or `128x1024`;
- must tile vertically without a visible pop.

Filename example:

```text
bigsur_sunset_driving_lane_marking_strip_v01_draft.png
```

### Car Rear Sprite

Purpose: fixed lower-center player vehicle.

Requirements:

- rear-view compact road-trip car;
- no real licensed brand marks;
- transparent background;
- readable at mobile size;
- matches pseudo-3D road camera;
- separate overlays may be created for dirt, damage, and boost glow;
- recommended base export around `512x512`, then imported as sprite with tight mesh.

Filename example:

```text
starter_compact_rear_sprite_v01_draft.png
```

### Roadside Sprite Sheet

Purpose: spawnable roadside objects with perspective scaling.

Required first-sheet contents:

- cliff rock chunks;
- pine clusters;
- chaparral shrubs;
- coastal flowers;
- guardrail segment;
- coast-edge rocks.

Requirements:

- transparent background;
- no baked road;
- no sky;
- no text;
- consistent pixel density;
- each sprite has a stable bottom anchor;
- include left-side and right-side variants where perspective matters;
- recommended sheet `1024x1024` or individual sprites packed by Unity Sprite Atlas.

Filename example:

```text
bigsur_sunset_roadside_sprite_sheet_v01_draft.png
```

### Sign Sprite Sheet

Purpose: special visual cues for landmarks, forced stops, and photo moments.

Required first-sheet contents:

- simple route marker shape;
- photo stop icon sign;
- generic forced stop marker;
- bridge approach marker for the bridge segment.

Requirements:

- transparent background;
- no readable text by default;
- large enough silhouette for mobile;
- not styled like GPS navigation;
- not styled like racing checkpoints;
- should support spawn-and-scale animation.

Filename example:

```text
bigsur_sunset_sign_sprite_sheet_v01_draft.png
```

### Sky/Horizon Background

Purpose: static or slow-moving background layer.

Requirements:

- portrait 9:16 or wider source that can crop to 9:16;
- calm top 14 percent for HUD;
- sunset sky gradient and ocean horizon;
- no road;
- no vehicle;
- no UI;
- no route text;
- can be full background because it is not the full driving surface.

Filename example:

```text
bigsur_sunset_driving_sky_horizon_v01_draft.png
```

### Far Background Silhouette

Purpose: distant mountains/ocean silhouette layer.

Requirements:

- transparent or easy-to-mask lower layer;
- distant Santa Lucia mountain silhouettes;
- ocean horizon/right-side coastal mass;
- no road;
- no guardrail foreground;
- no car;
- no UI;
- subtle enough to sit behind procedural road and spawned side sprites.

Filename example:

```text
bigsur_sunset_driving_far_background_silhouette_v01_draft.png
```

## Implementation Plan

Prototype code lives under:

```text
apps/unity-client/Assets/NewTrip/Scripts/Road/
apps/unity-client/Assets/NewTrip/Scripts/Editor/RoadPrototypeSceneBuilder.cs
```

In Unity, create the scene with:

```text
NewTrip > Road Prototype > Create Or Refresh Scene
```

Then press Play. The current prototype uses code-generated placeholder textures and sprites only; it does not create or consume a full-screen driving image.

### Step 1: Unity Scene Skeleton

Create:

```text
Assets/NewTrip/Scenes/RoadPrototype.unity
Assets/NewTrip/Scripts/Road/
Assets/NewTrip/Art/ScenePacks/
```

Scene objects:

```text
RoadSceneRoot
SkyLayer
FarBackgroundLayer
RoadMesh
LaneMarkingMesh
SideObjectRoot
LandmarkSignRoot
WeatherOverlay
PlayerCar
HudRoot
```

### Step 2: Procedural Road Mesh

Implement:

```text
Pseudo3DRoadRenderer.cs
RoadProjectionSettings.cs
```

Acceptance:

- road renders without any full-screen road image;
- road width converges to horizon;
- road texture scrolls continuously;
- lane markings scroll without popping;
- renderer works at portrait aspect ratio.

### Step 3: Car Anchor

Implement:

```text
CarRearController.cs
```

Acceptance:

- car stays lower center;
- car does not steer;
- engine bob is subtle;
- boost state can enable a glow overlay later.

### Step 4: Side Object Spawning

Implement:

```text
SideObjectSpawner.cs
RoadsideSpawnProfile.cs
```

Acceptance:

- objects spawn near horizon and move toward bottom;
- objects scale up smoothly;
- left/right side spawn positions respect road width;
- object spawn rate can be tuned per segment.

### Step 5: Landmark/Sign Spawning

Implement:

```text
LandmarkSignSpawner.cs
```

Acceptance:

- visual sign can spawn at a target distance window;
- forced stop cue can be shown without determining the stop;
- sign sprites do not imply GPS or racing checkpoints.

### Step 6: Background and Weather

Implement:

```text
RoadBackgroundController.cs
WeatherOverlayRenderer.cs
```

Acceptance:

- sky/far background can crossfade at segment changes;
- weather overlay can switch by backend weather key;
- clear weather can render no overlay.

### Step 7: Backend Hook

Implement a thin client adapter:

```text
TripVisualStateAdapter.cs
```

Acceptance:

- consumes `/trip/current` and `/trip/drive-tick` result payloads;
- updates visual speed and segment pack;
- eases visual distance to backend distance;
- triggers forced stop visuals from backend response.

## Prototype Acceptance

The first prototype is done when:

- the scene opens in Unity;
- the road moves forward for 30 seconds without a full driving-screen image;
- the car stays anchored;
- at least three roadside sprite types spawn and scale convincingly;
- lane markings scroll cleanly;
- the sky and far background remain stable behind the road;
- a placeholder sign sprite can spawn on command;
- no runtime logic calculates rewards, wallet changes, route unlocks, or authoritative distance.

## Production Gate

Do not promote the prototype to production until:

- art assets have real alpha where needed;
- Unity import settings are specified;
- mobile portrait safe area is checked;
- frame rate is acceptable on target iPhone;
- backend reconciliation is exercised with real drive tick responses;
- visual state changes are covered by a simple play-mode smoke test or captured screen recording.
