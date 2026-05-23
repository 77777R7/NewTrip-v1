# Windows Codex Handoff: Unity Visual QA

Date: 2026-05-22

This handoff is for continuing the NewTrip Unity visual QA work on another machine. It records the current Unity driving prototype state, what has been accepted, what is still review-only, and the exact next step. Do not treat this as a general art wishlist; it is a gate-by-gate production prototype contract.

## Start Here

Read these files first:

- `AGENTS.md`
- `CONTEXT.md`
- `README.md`
- `ROADMAP_14_DAY_CHECKLIST.md`
- `docs/agents/long-running-codex-threads.md`
- `docs/client/newtrip-pseudo3d-driving-knowledge-base-v1.md`
- `docs/client/pseudo3d-road-renderer-v1.md`
- `docs/client/unity-portrait-coordinate-contract-v1.md`
- `docs/client/unity-road-lock-pass-v1.md`
- `docs/client/unity-car-anchor-test-v1.md`

Use the `newtrip-visual-gate` skill for Unity visual QA work.

## Unity Setup

- Unity project path: `apps/unity-client`
- Unity editor version: `6000.4.7f1`
- Open the folder above as the Unity project root, not the repo root.
- Packages in `apps/unity-client/Packages/manifest.json` include:
  - `com.besty.unity-skills`
  - `com.coplaydev.unity-mcp`
  - `com.unity.ai.assistant`
  - `com.unity.ai.inference`

On a new machine, let Unity restore packages after opening the project. If using Codex with Unity MCP, open Project Settings > AI > Unity MCP Server and accept the Codex client connection if Unity asks for authorization.

## Current Visual Progress

The current playable visual spine is a staged Unity prototype, not final art.

Completed and accepted for now:

- Step 1: portrait coordinate contract
- Step 2: sky-only background gate
- Step 3: far background + road alignment gate
- Step 4: horizon haze gate
- Step 5: Road Lock Pass
- Step 6B: car-road grounding and speed-match review

Do not add UI, bridge, guardrails, signs, roadside props, weather, vegetation, or shoulders until the active gate explicitly allows them.

## Current Road Contract

The live driving road must remain procedural. Do not use a full road image.

Current source of truth:

- `apps/unity-client/Assets/NewTrip/Scripts/Road/RoadProjectionSettings.cs`
- `docs/client/unity-portrait-coordinate-contract-v1.md`
- `docs/client/unity-road-lock-pass-v1.md`

Current values:

```text
frame = 9:16 portrait
world_width = 5.625
world_height = 10.0
center_x = 0.50
road_horizon_y = 0.60
road_bottom_y = -0.06
road_near_half_width = 0.86
road_horizon_half_width = 0.014
road_depth_curve = 2.05
car_anchor_x = 0.50
car_anchor_y = 0.105
hud_safe_top_y = 0.86+
```

Road stack:

- procedural road mesh slices
- opaque runtime asphalt tile
- accepted RoadOnly B road-relative double-yellow line meshes
- projected white edge lines
- `HorizonHazeLayer` softens the road tip
- road, lane, edge, car motion, and future spawners consume `RoadMotionState.visualDistanceMeters`

The road material must stay opaque. Horizon softness belongs to haze/color wash, not road alpha transparency.

## Current Layer Order

```text
SkyLayer = 0
SunLayer = 3
FarBackgroundLayer = 5
RoadMesh = 10
HorizonHazeLayer = 12
ContactShadow = 18
WhiteEdgeLineMesh = 19
YellowLaneMesh = 20
CarBody = 50
Future UI = 100+
Debug guides = 220
```

## Current Scenes And Menus

Important scenes:

- `apps/unity-client/Assets/NewTrip/Scenes/RoadOnlyTest.unity`
- `apps/unity-client/Assets/NewTrip/Scenes/SkyOnlyTest.unity`
- `apps/unity-client/Assets/NewTrip/Scenes/SkyFarRoadTest.unity`
- `apps/unity-client/Assets/NewTrip/Scenes/CarAnchorTest.unity`
- `apps/unity-client/Assets/NewTrip/Scenes/RoadPrototype.unity`

Useful Unity menu paths:

- `NewTrip > Road Prototype > Create Or Refresh Scene`
- `NewTrip > Road Prototype > Create RoadOnlyTest Scene`
- `NewTrip > Road Prototype > Create SkyOnlyTest Scene`
- `NewTrip > Road Prototype > Create SkyFarRoadTest Scene`
- `NewTrip > Road Prototype > Create CarAnchorTest Scene`
- `NewTrip > Road Prototype > Capture Step 5 Road Lock Pass`
- `NewTrip > Road Prototype > Capture Step 6 CarAnchorTest`
- `NewTrip > Road Prototype > Capture Horizon Haze Review Screenshots`

Use 9:16 / 1080x1920 captures for review. Do not judge final composition in Unity Free Aspect.

## Current Core Assets

Sky and far background:

- `apps/unity-client/Assets/NewTrip/Art/PrototypeComposite/Resources/PrototypeComposite/sky_step2_soft_orange_background.png`
- `apps/unity-client/Assets/NewTrip/Art/PrototypeComposite/Resources/PrototypeComposite/far_coastal_mountains_01.png`
- `apps/unity-client/Assets/NewTrip/Art/ScenePacks/CaliforniaHwy1/BigSurSunset/Background/orange_orb_01.png`
- `apps/unity-client/Assets/NewTrip/Art/ScenePacks/CaliforniaHwy1/BigSurSunset/Background/horizon_haze_warm_v01.png`

Road and lane:

- `apps/unity-client/Assets/NewTrip/Art/PrototypeComposite/Resources/PrototypeComposite/road_asphalt_runtime_tile_512.png`
- `apps/unity-client/Assets/NewTrip/Art/PrototypeComposite/Resources/PrototypeComposite/lane_yellow_single_runtime_strip.png`

Car:

- `apps/unity-client/Assets/NewTrip/Art/ExtractedSprites/car_rear_view.png`
- `apps/unity-client/Assets/NewTrip/Art/ExtractedSprites/car_rear_view_clean.png`
- `apps/unity-client/Assets/NewTrip/Art/ExtractedSprites/soft_ground_shadow.png`
- `apps/unity-client/Assets/NewTrip/Art/PrototypePlaceholders/car_wheel_speed_cue.png`

Pixel-art import rules:

- Sprite PPU: 256 unless a gate documents an exception
- Filter Mode: Point
- Mip Maps: Off
- Compression: None
- Sprite layers use the shared unlit transparent material path
- Road base uses the opaque road shader path

## Current Car Gate State

Step 6B is the latest accepted car-road integration pass.

Source files:

- `apps/unity-client/Assets/NewTrip/Scripts/Road/CarRearController.cs`
- `docs/client/unity-car-anchor-test-v1.md`

Current tuning:

```text
accepted_car_scale = 0.51
car_body_perspective_scale_y = 0.88
road_motion_speed_smoothing_seconds = 1.45
startup_ease_seconds = 2.8
drive_meters_per_bounce = 22
idle_amplitude = 0.0035 world units
drive_amplitude = 0.017 world units
```

The runtime hierarchy should stay:

```text
PlayerCarRoot
├── ContactShadow
└── CarBody
    ├── WheelCueLeft
    └── WheelCueRight
```

`PlayerCarRoot` stays fixed at the anchor. Only `CarBody.localPosition.y` should bob. Do not move the root to hide car/road mismatch.

## Local Artifacts

Generated capture artifacts are local review outputs and are ignored:

- `apps/unity-client/Artifacts/`
- `apps/unity-client/Assets/Screenshots/`
- `apps/unity-client/Assets/_Recovery/`

Regenerate captures with the Unity menu paths above. Do not assume these folders exist after a fresh clone.

## Road Perspective Selection

Road Perspective Review Pass has been run and candidate B was selected by the user as the active road angle.

Contract doc: `docs/client/unity-road-perspective-review-pass-v1.md`.

Accepted active projection:

```text
B Reference Gentle Road
horizon_y = 0.60
bottom_y = -0.06
near_half_width = 0.86
horizon_half_width = 0.014
depth_curve = 2.05
```

Historical comparison projections:

```text
A Previous Gemini Baseline
horizon_y = 0.66
bottom_y = -0.08
near_half_width = 0.94
horizon_half_width = 0.038
depth_curve = 2.45

C Long Coast Road
horizon_y = 0.57
bottom_y = -0.05
near_half_width = 0.80
horizon_half_width = 0.010
depth_curve = 1.85
```

Do not switch back to A or C unless the user explicitly reopens road-angle review. Future car, background, and spawner work should align to candidate B.

Road angle acceptance:

- road feels flatter and longer than current baseline;
- car still sits on the road at `car_anchor_y = 0.105`;
- double-yellow lines still converge naturally;
- white edge lines still align to the road edge;
- horizon haze still softens the apex;
- no full-road image is introduced;
- no new props, UI, weather, bridge, signs, trees, or guardrails are added.

Review capture outputs:

- `apps/unity-client/Artifacts/RoadPerspectiveReview/road_perspective_a_current_baseline_*.png`
- `apps/unity-client/Artifacts/RoadPerspectiveReview/road_perspective_b_reference_gentle_road_*.png`
- `apps/unity-client/Artifacts/RoadPerspectiveReview/road_perspective_c_long_coast_road_*.png`
- `apps/unity-client/Artifacts/RoadPerspectiveReview/road_perspective_review_report.md`

`RoadViewportContract` and the docs have been updated together so code and contract remain in sync.

## Product Scope Reminder

NewTrip V1 is a curated-route travel simulator. Unity is presentation only. Backend remains authoritative for distance, time, rewards, wallet, route unlock, and offline progress. Do not introduce real maps, real navigation, real weather APIs, MMO/PvP, blockchain/NFT, or Kubernetes as required V1 dependencies.
