# Unity Portrait Road Coordinate Contract V1

This contract defines the coordinate system for the Unity prototype composite driving view.

The target gameplay frame is phone portrait. Do not tune the road renderer against Unity's wide `Free Aspect` editor view.

## Target Frame

```text
design_aspect: 9:16 portrait
world_width: 5.625
world_height: 10.0
viewport_origin: bottom_left
viewport_x: 0.0 left, 1.0 right
viewport_y: 0.0 bottom, 1.0 top
```

Code source of truth:

```text
RoadViewportContract.WorldWidth = 5.625
RoadViewportContract.WorldHeight = 10.0
```

When the Unity Game view is not portrait, the camera should letterbox or pillarbox to show the phone frame. Wide editor side bars are acceptable in test screenshots. They are not part of the gameplay image.

## Step 1 Angle Contract

This is the locked V1 driving angle. Do not tune background, car, road, or HUD against a different horizon.

```text
car_anchor_x = 0.50
car_anchor_y = 0.105
road_horizon_y = 0.60
HUD_safe_top_y = 0.86+
```

Interpretation:

- the rear car tire baseline sits near the lower-center anchor at `y = 0.105`;
- the accepted road vanishing point/horizon sits at `y = 0.60`, selected from Road Perspective Review candidate B to reduce the ramp-like pitch while keeping forward depth;
- the lower camera feel comes from exponential projection depth rather than a real 3D camera tilt;
- the top 14% of the portrait frame is reserved for HUD readability;
- every future sky, far mountain, cliff, ocean, bridge, sign, tree, and weather layer must align around this same road horizon instead of inventing its own perspective.

## Step 2 Sky-Only Pass

Before adding far mountains, cliffs, bridge, road, car, signs, weather, or UI, validate a single full-screen sky layer by itself.

```text
scene: SkyOnlyTest
object: SkyLayer
sortingOrder: 0
position: center
scale: cover 9:16
movement: 0
opacity: opaque
```

Acceptance:

- no road, car, foreground cliff, bridge, UI, signs, or weather;
- top band remains visually calm for future HUD;
- sun/ocean horizon sits close to `road_horizon_y = 0.60`;
- sky color is comfortable before any gameplay objects are layered on top.

## Step 3 Far Background Pass

After the sky-only pass is approved, validate one transparent far horizon band against the accepted RoadOnly B road.

```text
scene: SkyFarRoadTest
objects:
  SkyLayer sortingOrder = 0
  SunLayer sortingOrder = 3
  FarBackgroundLayer sortingOrder = 5
  RoadOnly B road/lane/edge meshes sortingOrder >= 10
sun_asset: orange_orb_01, only because the current sky asset has no baked sun
far_asset: far_coastal_mountains_01
far_pivot: bottom-center
far_base_y: road_horizon_y
movement: 0 for the still gate, 0.02 maximum for later slow parallax
```

Acceptance:

- the far layer is a transparent PNG/horizon band, not a full matte rectangle;
- no white, gray, or checkerboard box is visible;
- no second sun is introduced; `SunLayer` is disabled/replaced if the active sky already includes a sun;
- the far mountains stay low-contrast enough that the road remains the visual anchor;
- the far mountain base/shoreline lands around the road vanishing point, slightly above `road_horizon_y = 0.60`;
- the road does not look like it floats in the sky, and the far layer does not block the road apex;
- no car, bridge, foreground cliff, trees, signs, UI, or weather are added in this gate.

## Step 4 Horizon Haze Pass

After Sky + Far + Road alignment works, add a dedicated horizon haze layer to soften the road tip without making the road transparent.

```text
scene: SkyFarRoadTest
menu: NewTrip/Road Prototype/Capture Horizon Haze Review Screenshots
objects:
  SkyLayer sortingOrder = 0
  SunLayer sortingOrder = 3
  FarBackgroundLayer sortingOrder = 5
  RoadMesh sortingOrder = 10
  HorizonHazeLayer sortingOrder = 12
  RoadEdgeLeftLine sortingOrder = 19
  LaneYellowLeftMesh sortingOrder = 20
  LaneYellowRightMesh sortingOrder = 20
haze_asset: horizon_haze_warm_v01
haze_position_y: road_horizon_y + 0.020
haze_default_alpha: 0.30
road_visual_tuning: BigSurSunsetAtmosphericBlend
road_horizon_color_wash: enabled, opaque vertex-color blend only
```

Rules:

- do not add car, bridge, UI, signs, roadside props, weather, dirt shoulder, or vegetation;
- do not change road geometry during this pass;
- keep the base road visually opaque;
- warm the far road through road tint and opaque horizon color wash only; do not lower rendered road alpha;
- use a separate low-alpha `HorizonHazeLayer` to soften the far road tip instead of lowering road alpha;
- lane and edge markings may keep their alpha fade toward the horizon.

Acceptance:

- road tip is visibly softer than the no-haze/weak-haze composite;
- road remains opaque from near field to horizon;
- yellow lines stay readable but not neon;
- white edge lines are not washed out;
- no haze rectangle or hard edge is visible;
- haze reads as sunset atmosphere, not smoke or white fog;
- far mountain and sun remain clean.

## Step 5 Road Lock Pass

Step 5 freezes the road system as a production prototype contract before car, roadside, UI, or weather layers return.

```text
scene: RoadOnlyTest / SkyFarRoadTest
menu: NewTrip/Road Prototype/Capture Step 5 Road Lock Pass
contract: docs/client/unity-road-lock-pass-v1.md
```

Locked rules:

- road remains code-generated from mesh slices;
- no full-road image is allowed;
- base asphalt is opaque and uses width-based tile repeat;
- pixel textures are imported with Point filtering, no mipmaps, no compression, and Sprite assets use 256 PPU unless a reviewed exception is documented;
- road and sprite materials stay Unlit so Unity lighting does not add plastic smoothing or color shifts;
- accepted yellow-lane preset is RoadOnly B, using two road-relative projected meshes;
- white edge lines are projected from the same road sample math;
- road, lane, edge, and future spawners consume one `RoadMotionState.visualDistanceMeters` source;
- `HorizonHazeLayer` softens the apex; the road mesh itself does not fade alpha to blend into the background.

## Step 6 Car Anchor Test

```text
menu: NewTrip/Road Prototype/Capture Step 6 CarAnchorTest
scene: Assets/NewTrip/Scenes/CarAnchorTest.unity
contract: docs/client/unity-car-anchor-test-v1.md
report: apps/unity-client/Artifacts/CarAnchorTest/car_anchor_test_report.md
```

Locked values:

```text
car_anchor_x = 0.50
car_anchor_y = 0.105
accepted_car_scale_candidate = 0.56
```

Rules:

- build on the Step 5 Sky/Far/Road/HorizonHaze stack;
- import the cleaned car as a manifest bottom-center sprite, 256 PPU, point filter, no mipmaps, no compression;
- keep the car fixed while the road, lane, and edge meshes move through `RoadMotionState.visualDistanceMeters`;
- use a subtle `CarGroundShadow` below road lines and above the road mesh only to prove contact;
- do not change road geometry, road horizon, background, haze, or lane/edge presets in this gate.

## Road Projection

Road depth uses this convention:

```text
depth = 1.0 far horizon
depth = 0.0 near bottom / player car area
```

Current V1 prototype values:

```text
center_x = 0.50
horizon_y = 0.60
bottom_y = -0.06
near_half_width = 0.86
horizon_half_width = 0.014
depth_curve = 2.05
```

This means:

- the road vanishing point sits slightly above center, giving a gentler long-road pseudo-3D feel;
- the road reaches below the car anchor, so the car never floats;
- far slices still compress while near slices stretch, matching the classic pseudo-3D road model without making the road read as a short ramp;
- roadside objects that start at `depth = 1.0` appear near the horizon and move downward as they approach.

### Accepted Reference Gentle Road Projection

`RoadProjectionPreset.ReferenceGentleRoad` is now the active road contract after the Road Perspective Review Pass. It was selected because it keeps the accepted RoadOnly B lane/edge system, but makes the road feel less pitched upward and more like a coast road continuing into the distance.

`RoadProjectionPreset.GeminiLowCamera` remains only as the historical review A baseline. Do not switch back to it unless a new review explicitly reopens the road angle.

## Layer Anchors

Runtime layer order:

```text
sky_horizon
far_background_silhouette
midground_landmark_mass
road_projection
lane_marking_strip
roadside_terrain_vegetation
landmark_props_signs
weather_particles_overlay
car_rear_sprite
hud
```

Anchor rules:

| Asset type | Pivot | Position rule |
| --- | --- | --- |
| sky/horizon | center | cover the 9:16 frame |
| far background | center | horizon band behind midground |
| midground landmark | center or bottom-center | sits below/around horizon, behind road |
| road mesh | generated | bottom-to-horizon projection |
| lane strip | generated | same road projection, above asphalt |
| roadside sprite | bottom-center | foot/base sits on projected roadside point |
| sign sprite | bottom-center | post/base sits on projected roadside point |
| car rear sprite | bottom-center | tire baseline sits at car anchor |
| weather overlay | center | covers the 9:16 frame |

## Car And Spawn Anchors

The car is fixed. Road and objects create motion.

```text
car_anchor_x = 0.50
car_anchor_y = 0.105
```

This anchor is part of the locked angle contract. If the car sprite changes, adjust sprite canvas/pivot/scale first; do not move `car_anchor_y` unless the whole road angle is intentionally re-approved.

Roadside and sign projection must use the road sample at each depth:

```text
sample = road.Sample(depth)
side_x = sample.center_x +/- sample.half_width * (1 + lane_offset)
y = sample.y
scale = lerp(near_scale, far_scale, depth)
```

Do not place trees, rocks, or signs directly in screen coordinates. They must attach to the road projection so they cannot fly in the sky when the projection changes.

## Asset Readiness Rule

Driving layers are not scenic full images.

Accepted:

- pure portrait sky/horizon background;
- transparent or horizon-band far background;
- transparent midground landmark mass;
- small asphalt tile;
- narrow lane marking strip;
- bottom-center roadside sprites;
- bottom-center sign sprites;
- transparent weather overlay.

Review-only / not production-ready:

- full scenic driving screenshots used as the live driving screen;
- far backgrounds with hard rectangular edges that cover the sky;
- side objects with center pivots;
- road or lane assets baked into a full-screen illustration.

## Prototype QA Gate

Before a Unity composite is treated as reviewable:

- Placeholder-only mode passes first: pure sky, procedural road, simple lane, simple car, no real sprites.
- `RoadDebugOverlay` is visible or has been checked in the same scene.
- Game view is tested in a portrait phone frame.
- Road is visible from car area to horizon.
- Car sits on the road, not on the background image.
- Roadside objects move from horizon toward bottom.
- Signs and trees never spawn above the horizon unless they are explicitly birds/clouds.
- Background has no unintended side gaps inside the phone frame.
- Full-screen scenic images remain limited to route cards, Travel Reports, scenic reveals, or photo cards.
