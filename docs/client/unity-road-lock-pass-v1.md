# Unity Road Lock Pass V1

Step 5 freezes the procedural road as the production prototype contract. This gate is not an art-expansion pass and must not introduce car, UI, bridge, guardrails, roadside props, signs, weather, dirt shoulder, vegetation, or a full-road image.

## Locked Road Contract

- Frame: 9:16 portrait.
- World size: `RoadViewportContract.WorldWidth = 5.625`, `RoadViewportContract.WorldHeight = 10.0`.
- Horizon: `road_horizon_y = 0.60`.
- Future car anchor: `car_anchor_y = 0.105`.
- Depth convention: `depth = 1.0` is the far horizon, `depth = 0.0` is the near bottom.
- Geometry source: procedural road mesh slices, aligned with the Jake Gordon pseudo-3D road idea of projecting each segment's near/far points to screen and drawing road/lane polygons.

## Renderer Rules

- `RoadMesh` remains code-generated from road slices.
- Asphalt uses the runtime tile, width-based UV repeat, and an opaque road material.
- The base road must not use alpha to blend into the horizon.
- The Big Sur sunset composite may use opaque horizon color wash in the road shader; this is color blending only and must still output alpha 1.
- Runtime pixel-art textures use Point filtering, no mipmaps, no compression, and a shared 256 PPU for Sprite assets.
- Sprite layers use the `NewTrip/PixelUnlitTransparent` path instead of Standard/Lit materials so authored pixel colors are not relit by Unity.
- The accepted lane style is RoadOnly B: two independent road-relative projected yellow-line meshes.
- White edge lines stay projected with the same road sample math.
- Horizon softness comes from `HorizonHazeLayer`, not from transparent road geometry.

## Motion Rules

- Road, yellow lines, white edge lines, and future spawners must all consume the same `RoadMotionState.visualDistanceMeters`.
- Independent scroll clocks are not allowed for production prototypes because they make the scene feel disconnected in motion.
- Visual speed is only presentation. Backend state remains authoritative for trip distance and rewards.

## Layer Order

```text
SkyLayer = 0
FarBackgroundLayer = 5
RoadMesh = 10
HorizonHazeLayer = 12
WhiteEdgeLineMesh = 19
YellowLaneMesh = 20
Future car / foreground / UI = 20+
```

## Acceptance Captures

Run:

```text
NewTrip/Road Prototype/Capture Step 5 Road Lock Pass
```

Required outputs:

- `apps/unity-client/Artifacts/RoadOnlyTest/road_only_still.png`
- `apps/unity-client/Artifacts/RoadOnlyTest/road_only_10s_motion.png`
- `apps/unity-client/Artifacts/RoadOnlyTest/road_only_lane_horizon_closeup.png`
- `apps/unity-client/Artifacts/RoadOnlyTest/road_only_road_bottom_closeup.png`
- `apps/unity-client/Artifacts/HorizonHaze/background_haze_b_030.png`
- `apps/unity-client/Artifacts/HorizonHaze/background_haze_horizon_closeup.png`
- `apps/unity-client/Artifacts/RoadLockPass/road_lock_pass_report.md`

## Pass Criteria

- The road does not read as a black triangle.
- Asphalt is opaque, warm, and tiled rather than stretched.
- Double yellow lines are road-relative, near-wide and far-thin.
- White edge lines align to the projected road edge.
- Lane and edge markings remain readable but fade gently near the horizon.
- The road apex is softened by haze without making the road transparent.
- Motion uses a shared visual distance source.
- No full-road image is used.

## Accepted Road Projection

`RoadProjectionPreset.ReferenceGentleRoad` is now the active road projection after the user selected Road Perspective Review candidate B. It keeps the same procedural mesh and RoadOnly B lane contract, but reduces the ramp-like pitch and road-tip platform while preserving a long forward road feel.

RoadOnly capture writes the legacy accepted B filenames with this projection so Unity review judges the current contract directly.
