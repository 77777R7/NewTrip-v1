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

When the Unity Game view is not portrait, the camera should letterbox or pillarbox to show the phone frame. Wide editor side bars are acceptable in test screenshots. They are not part of the gameplay image.

## Road Projection

Road depth uses this convention:

```text
depth = 1.0 far horizon
depth = 0.0 near bottom / player car area
```

Default V1 prototype values:

```text
center_x = 0.50
horizon_y = 0.56
bottom_y = 0.02
near_half_width = 0.64
horizon_half_width = 0.025
depth_curve = 1.65
```

This means:

- the road vanishing point is upper-middle, not the top of the screen;
- the road reaches below the car anchor, so the car never floats;
- roadside objects that start at `depth = 1.0` appear near the horizon and move downward as they approach.

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
