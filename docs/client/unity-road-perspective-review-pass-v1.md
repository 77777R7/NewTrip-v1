# Unity Road Perspective Review Pass V1

Status: accepted-candidate-b

This pass tested road projection parameters only. Candidate B, `RoadProjectionPreset.ReferenceGentleRoad`, is now the accepted active road contract because the user preferred its gentler, less ramp-like perspective.

Do not use this pass to tune material color, change the car, add roadside props, or reintroduce full-screen road art. Reopen it only if the road angle itself needs another A/B/C review.

## Locked Inputs

- 9:16 portrait capture, `1080x1920`.
- Code-generated road mesh only.
- Existing asphalt tile, RoadOnly B road-relative double-yellow lines, and projected white edge lines.
- Existing car sprite and contact shadow.
- Existing sky, far background, sun, and horizon haze.
- Shared `RoadMotionState.visualDistanceMeters` for still and 10-second motion review.

## Candidates

| Candidate | Preset | road_horizon_y | bottom_y | near_half_width | horizon_half_width | depth_curve | Purpose |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| A. Previous Gemini Baseline | `GeminiLowCamera` | `0.66` | `-0.08` | `0.94` | `0.038` | `2.45` | Historical control frame from before candidate B was accepted. |
| B. Reference Gentle Road | `ReferenceGentleRoad` | `0.60` | `-0.06` | `0.86` | `0.014` | `2.05` | Accepted active road contract. Less ramp-like, smaller far platform, still strong depth. |
| C. Long Coast Road | `LongCoastRoad` | `0.57` | `-0.05` | `0.80` | `0.010` | `1.85` | Flatter and longer-feeling, but may reduce speed pressure. |

## Unity Menu

```text
NewTrip/Road Prototype/Create RoadPerspectiveReview Scene
NewTrip/Road Prototype/Capture Road Perspective Review Pass
```

The create menu opens a separate review scene with the accepted candidate B previewed. It does not overwrite `RoadOnlyTest`, `SkyFarRoadTest`, or `CarAnchorTest`.

The capture menu writes:

```text
apps/unity-client/Artifacts/RoadPerspectiveReview/
```

Expected files:

- `road_perspective_a_current_baseline_still.png`
- `road_perspective_a_current_baseline_10s_motion.png`
- `road_perspective_a_current_baseline_horizon_closeup.png`
- `road_perspective_a_current_baseline_near_road_closeup.png`
- `road_perspective_b_reference_gentle_road_still.png`
- `road_perspective_b_reference_gentle_road_10s_motion.png`
- `road_perspective_b_reference_gentle_road_horizon_closeup.png`
- `road_perspective_b_reference_gentle_road_near_road_closeup.png`
- `road_perspective_c_long_coast_road_still.png`
- `road_perspective_c_long_coast_road_10s_motion.png`
- `road_perspective_c_long_coast_road_horizon_closeup.png`
- `road_perspective_c_long_coast_road_near_road_closeup.png`
- `road_perspective_review_report.md`

## Review Rules

Only judge the road projection:

- road top should not read as a flat platform;
- road should not feel like it is tilting upward into the sky;
- car tire baseline must still feel grounded at `car_anchor_y = 0.105`;
- double-yellow lines must remain near-wide and far-thin;
- white edge lines must stay attached to the road edge;
- 10-second motion should not shimmer, scatter, or look like a sticker sliding under the car;
- compared with the Big Sur reference, the road should feel like it continues into distance, not like a short slope.

The pass temporarily re-anchors the far background and horizon haze to each candidate road horizon during capture. That keeps the comparison focused on projection feel instead of punishing a candidate for inherited background mismatch.

## Selection Guidance

Candidate B has been selected and promoted into `RoadViewportContract`. Keep A and C only as historical comparison captures. Future work should continue from candidate B unless the user explicitly reopens road-angle review.
