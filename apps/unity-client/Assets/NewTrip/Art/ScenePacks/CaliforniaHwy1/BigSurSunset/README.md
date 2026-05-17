# Big Sur Sunset Scene Pack

Route segment: `tutorial_big_sur_hwy1_001`, `0-35 km`, `coastal_cliffs`.

Layer order:

```text
sky_horizon
far_background_silhouette
midground_landmark_mass
road_projection
roadside_terrain_vegetation
landmark_props_signs
weather_particles_overlay
vehicle_sprite
hud
```

The current PNGs are draft outputs generated for visual composition. Use `Review/bigsur_sunset_driving_composite_mock_v02.png` as the current art direction reference.

Production driving must use the procedural pseudo-3D road renderer under `Assets/NewTrip/Scripts/Road/`. The old `road_projection` PNG is reference-only and must not become the live gameplay road surface.
