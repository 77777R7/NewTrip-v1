# Unity Car Anchor Test V1

Step 6 adds the player car only after the Step 5 procedural road stack is locked. This gate validates whether the car visually sits on the road without changing road geometry, background placement, or motion rules.

Step 6B is the car-road integration fix. It keeps the accepted road untouched and tunes only the car perspective fit, startup smoothing, distance-driven suspension bob, contact shadow, and wheel speed cues.

## Scope

Allowed:

- Step 5 Sky/Far/Road/HorizonHaze stack;
- one bottom-center rear car sprite;
- one subtle contact shadow under the car;
- debug guide overlays and review captures.

Not allowed:

- UI;
- bridge;
- guardrails;
- signs;
- roadside props;
- weather;
- dirt shoulder or vegetation;
- full-road image;
- road geometry changes.

## Locked Anchor Contract

```text
frame = 9:16 portrait
road_horizon_y = 0.60
car_anchor_x = 0.50
car_anchor_y = 0.105
```

The car is fixed to the viewport. The road, lane, edge, and later roadside spawners move underneath it through `RoadMotionState.visualDistanceMeters`.

## Car Import Contract

Use:

```text
Assets/NewTrip/Art/ExtractedSprites/car_rear_view_clean.png
```

Current review replacement:

```text
Assets/NewTrip/Art/ExtractedSprites/car_rear_view.png
Assets/NewTrip/Art/ExtractedSprites/soft_ground_shadow.png
```

Import rules:

- Texture Type: Sprite (2D and UI)
- Car pivot: manifest bottom-center, normalized `(0.5, 0.002685)`
- Shadow pivot: center, normalized `(0.5, 0.5)`
- Pixels Per Unit: 256
- Filter Mode: Point
- Mip Maps: Off
- Compression: None
- Alpha Is Transparency: On

The previous `car_beige_default.png` remains available for comparison, but Step 6 should use the cleaned no-white-edge `car_rear_view_clean.png` sprite.

If the car sprite changes, fix the sprite canvas, pivot, and scale first. Do not move `car_anchor_y` unless the full camera/road angle is re-approved.

## Runtime Hierarchy

```text
PlayerCarRoot
├── ContactShadow
└── CarBody
    ├── WheelCueLeft
    └── WheelCueRight
```

- `PlayerCarRoot` owns the locked viewport anchor and never receives bobbing motion.
- `ContactShadow.localPosition.y` is locked to `0`; it only shrinks and fades as the body bobs.
- `CarBody.localPosition.y` is the only transform value used for engine bob.
- `CarBody.localScale.y` may be slightly compressed to make the rear sprite fit the locked road angle without moving the tire baseline.
- `WheelCueLeft` and `WheelCueRight` are subtle pixel overlays. They are speed cues, not real 3D wheel rotation.

## Motion Contract

- Road, lane, edge, and car suspension must be driven from the same `RoadMotionState.visualDistanceMeters` source.
- `RoadMotionState` owns the smoothed visual speed. Road, lane, edge, car suspension, wheel cues, and later spawners must not each invent their own speed smoothing.
- Car bob should feel like suspension over road motion, not a high-frequency idle shake.
- Startup uses eased motion intensity for roughly the first two seconds so the car does not instantly vibrate at full strength.
- Contact shadow may stretch and gain slight opacity with speed, but it must remain a grounding cue rather than a dark blob.

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

This is intentionally slower and heavier than the earlier pass. The car body may move a little, but the tire contact baseline remains locked.

## Layer Order

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

The shadow is a contact aid, not a weather or scenery layer. It should be subtle enough that disabling it only makes the car feel less grounded.

## Unity Gate

Run:

```text
NewTrip/Road Prototype/Capture Step 6 CarAnchorTest
```

Required outputs:

- `apps/unity-client/Artifacts/CarAnchorTest/car_anchor_a_small.png`
- `apps/unity-client/Artifacts/CarAnchorTest/car_anchor_b_locked.png`
- `apps/unity-client/Artifacts/CarAnchorTest/car_anchor_c_large.png`
- `apps/unity-client/Artifacts/CarAnchorTest/car_anchor_10s_motion.png`
- `apps/unity-client/Artifacts/CarAnchorTest/car_anchor_speed_slow_10s.png`
- `apps/unity-client/Artifacts/CarAnchorTest/car_anchor_speed_cruise_10s.png`
- `apps/unity-client/Artifacts/CarAnchorTest/car_anchor_speed_boost_10s.png`
- `apps/unity-client/Artifacts/CarAnchorTest/car_anchor_startup_1s.png`
- `apps/unity-client/Artifacts/CarAnchorTest/car_anchor_contact_closeup.png`
- `apps/unity-client/Artifacts/CarAnchorTest/car_anchor_debug_guides.png`
- `apps/unity-client/Artifacts/CarAnchorTest/car_anchor_test_report.md`

## Pass Criteria

- Car tire baseline sits at `car_anchor_y = 0.105`.
- Car scale feels compatible with the accepted road angle.
- Car covers the lane correctly and does not float above it.
- Contact shadow makes the car feel grounded without becoming a dark blob.
- Road, lane, edge, and haze remain unchanged from Step 5.
- 10-second motion capture reads as road motion under a fixed car.
- Slow, cruise, and boost captures read as the same car-road system at three speeds, not three disconnected animation clocks.
- Startup capture does not show high-frequency vertical shaking.
- No UI, bridge, guardrail, sign, prop, weather, dirt shoulder, vegetation, or full-road image is introduced.
