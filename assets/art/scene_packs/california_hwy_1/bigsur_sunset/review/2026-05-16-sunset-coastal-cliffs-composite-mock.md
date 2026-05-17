# Sunset Coastal Cliffs Composite Mock

Status: visual mock created, not production-approved.

## Outputs

- `bigsur_sunset_driving_composite_mock_v01.png`
- `bigsur_sunset_driving_composite_mock_v01_guides.png`
- `bigsur_sunset_driving_composite_mock_v02.png`
- `bigsur_sunset_driving_composite_mock_v02_guides.png`

## Source Layers

- `../driving/layers/bigsur_sunset_driving_sky_horizon_v01_draft.png`
- `../driving/layers/bigsur_sunset_driving_far_background_silhouette_v01_draft.png`
- `../driving/layers/bigsur_sunset_driving_midground_landmark_mass_v01_draft.png`
- `../driving/layers/bigsur_sunset_driving_road_projection_v01_draft.png`
- `../driving/layers/bigsur_sunset_driving_roadside_terrain_vegetation_v01_draft.png`

## Review Notes

- `v02` is the preferred mock for visual review.
- The Big Sur sunset direction reads correctly: cliff wall left, ocean right, guardrail, straight road, warm golden-hour palette.
- The generated layers are RGB drafts, so checkerboard transparency had to be removed heuristically for the mock.
- The road layer is usable for static composition, but runtime animation should convert it into a cleaner scrollable road strip or shader-driven road projection.
- The top safe area needs cleanup in production exports because tall left-side trees compete with HUD placement.
- These files should remain review artifacts until alpha, canvas alignment, naming metadata, and Unity import settings are validated.
