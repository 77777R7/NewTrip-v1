# Pseudo-3D Art, Background, And Asset Pipeline Knowledge Base V1

Research date: 2026-05-18

Scope: NewTrip Unity pseudo-3D driving prototype, focused on pixel-art scenic driving assets for Big Sur sunset. This document covers art, background layering, road texture design for motion, lane strips, sprite anchors, horizon bands, color/value consistency, and QA. It does not change backend authority or V1 product scope.

## Research Tracks

This research was split into four practical tracks:

1. Pseudo-3D road motion and renderer structure.
2. Pixel-art texture, lighting, palette, and readability.
3. Unity 2D import, sprite atlas, and mobile performance.
4. Big Sur / Highway 1 scenic identity.

## Sources

### Pseudo-3D Road Rendering

- Jake Gordon, "How to build a racing game - straight roads"
  https://jakesgordon.com/writing/javascript-racer-v1-straight/
  - High ROI because it turns pseudo-3D road rendering into practical renderer parts: projection, road segments, background layers, sprites, road, car, and game loop.
  - NewTrip takeaway: road motion should be driven by world/projection depth and a continuous position value, not by treating a full-screen road image as the gameplay surface.

- Jake Gordon, "How to build a racing game - curves"
  https://jakesgordon.com/writing/javascript-racer-v2-curves/
  - High ROI for future segment transitions, subtle camera motion, and background scroll tied to road curvature.
  - NewTrip takeaway: even if V1 starts straight, background parallax and horizon response need to be controlled by road state, not free-floating screen animation.

- Lou Gorenfeld, "Lou's Pseudo 3D Page"
  https://www.extentofthejam.com/pseudo/
  - High ROI because it explains raster road illusion, per-line/per-depth texture speed, Z maps, sprite scale, and why old pseudo-3D roads feel fast.
  - NewTrip takeaway: dynamic naturalness comes from depth-aware optical flow. Near road pixels move fast; horizon pixels move slowly; lane/road/side objects must share the same virtual travel distance.

### Unity 2D Import, Filtering, And Performance

- Unity Manual, Texture Import Settings
  https://docs.unity3d.com/Manual/class-TextureImporter.html
  - NewTrip takeaway: texture behavior is an import contract, not a per-scene guess. Road and lane assets need repeatable import rules.

- Unity Manual, Sprite (2D and UI) Import Settings
  https://docs.unity3d.com/cn/2022.2/Manual/texture-type-sprite.html
  - NewTrip takeaway: sprite mode, PPU, mesh type, pivot, alpha source, Alpha is Transparency, wrap mode, and filter mode must be explicit per asset type.

- Unity Manual, Mipmaps
  https://docs.unity3d.com/Manual/texture-mipmaps-introduction.html
  - NewTrip takeaway: mipmaps can reduce artifacts when textures are sampled small or at distance, but they cost memory and can blur pixel art. For this project, keep authored pixel assets no-mip by default, and solve road shimmer with low-noise art plus custom horizon fade before trying standard mip/trilinear.

- Unity Scripting API, FilterMode
  https://docs.unity3d.com/es/530/ScriptReference/FilterMode.html
  - NewTrip takeaway: Point preserves crisp pixel blocks; Bilinear/Trilinear blend samples. Pixel-art gameplay assets default to Point unless a specific far-distance road experiment proves otherwise.

- Unity Scripting API, Texture.anisoLevel
  https://docs.unity3d.com/ja/2020.3/ScriptReference/Texture-anisoLevel.html
  - NewTrip takeaway: anisotropic filtering is relevant to shallow-angle ground/road textures but may cost GPU and can behave unpredictably with pixel-art stylization. Treat it as an experimental road-only setting, not the default.

- Unity Manual, 2D Pixel Perfect
  https://docs.unity3d.com/ja/2020.2/Manual/com.unity.2d.pixel-perfect.html
  - NewTrip takeaway: pixel art needs stable scaling and motion at different resolutions. The phone portrait frame must be the source of truth, not Unity Free Aspect.

- Unity Manual, Sprite Atlas
  https://docs.unity3d.com/cn/2017.4/Manual/SpriteAtlas.html
  - NewTrip takeaway: roadside sprites and signs should be packed into route/segment atlases, with shared import settings and predictable runtime access.

- Unity Support, "Why are my batches / draw calls so high?"
  https://support.unity.com/hc/en-us/articles/207061413-Why-are-my-batches-draw-calls-so-high-What-does-that-mean
  - NewTrip takeaway: many independent sprite objects can become expensive if they do not share material/texture/shader state. Atlas and batch by segment.

- Unity, "Optimize performance of 2D games with Unity Tilemap"
  https://unity.com/how-to/optimize-performance-2d-games-unity-tilemap
  - NewTrip takeaway: asset performance should be considered from the start, profile on low-end mobile, and pack sprites to reduce draw calls.

- Unity, "How to use 2D lights to set mood"
  https://unity.com/how-to/use-2d-lights-unity-set-mood
  - NewTrip takeaway: multi-layer 2D scenes gain depth through layer-specific color, z-depth ordering, horizon fade/fog, and selective atmosphere. For V1, bake most lighting into assets and use lightweight overlays.

### Pixel-Art Texture And Readability

- SLYNYRD Pixelblog 2, "Texture"
  https://www.slynyrd.com/blog/2018/2/15/pixelblog-2-texture
  - NewTrip takeaway: road texture must simplify detail into clusters, use repetition with variation, and avoid orphan-pixel noise. The current speckled asphalt problem is exactly the kind of noise this source warns against.

- SLYNYRD Pixelblog 6, "Light and Shadow"
  https://www.slynyrd.com/blog/2018/6/15/pixelblog-6-light-and-shadow
  - NewTrip takeaway: Big Sur sunset needs one consistent light direction and shadow logic across road, cliffs, vegetation, signs, and car.

- Pixel Joint, "The Pixel Art Tutorial"
  https://pixeljoint.com/forum/forum_posts.asp?TID=11299
  - NewTrip takeaway: independent single pixels and uncontrolled dithering create noise and grid exposure. Use this as a hard warning for asphalt, ocean sparkle, fog, and cloud particles.

- Lospec, "Pixel Art Outlines Part 2: Using Color"
  https://lospec.com/articles/pixel-art-outlines-part-2-using-color
  - NewTrip takeaway: sprites need enough edge contrast against the active background, but outlines should be palette-aware. Signs, guardrails, rocks, and car edges need tested readability over sunset road and ocean.

### Big Sur / Highway 1 Scenic Identity

- Recreation.gov, "Route 1 - Big Sur Coast Highway"
  https://www.recreation.gov/gateways/13824
  - NewTrip takeaway: visual identity should include coast-hugging road, windswept cypress, foggy cliffs, crashing Pacific surf, rugged canyons, and redwoods where appropriate.

- Big Sur Chamber of Commerce, National Scenic Byways Program
  https://www.bigsurcalifornia.org/national-scenic-byways-program/
  - NewTrip takeaway: Highway 1 is treated as a scenic byway with distinctive natural, recreational, and scenic qualities. Use it as scenic identity, not navigation simulation.

- See Monterey, Highway 1 / Big Sur travel guide
  https://www.seemonterey.com/plan-your-visit/how2hwy1/
  - NewTrip takeaway: Big Sur recognition cues include Bixby Bridge, Garrapata wildflowers, coastal cliffs, redwood hikes, McWay Falls, Point Sur Lightstation, and ocean vistas. For 0-35 km, avoid runtime bridge unless the segment config says it is active.

## Core Principles

### 1. Motion-First Naturalness

Static road screenshots are only a first filter. The actual gate is whether the scene feels natural during 10-30 seconds of motion.

Rules:

- Road, lane, shoulder, roadside props, signs, fog, and car bob must be driven by one visual distance state.
- Near road should move much faster than far road.
- Horizon area should move slowly or almost not at all.
- Side objects should grow and descend according to projected depth.
- Lane dashes must compress toward the horizon.
- Any texture that sparkles, shimmers, or vibrates in motion is rejected even if it looks good in a still image.

### 2. Road Is A Motion System, Not A Picture

The road projection must stay code-generated. Art provides:

- asphalt tile;
- center lane strip;
- optional road edge/shoulder strips;
- color tint;
- horizon fade/road fog parameters.

Do not use:

- full-screen road illustrations;
- road images with baked cliffs, car, sky, signs, or UI;
- scenic road screenshots as gameplay renderer input.

### 3. Depth Is Built From Layer Agreement

Depth becomes believable when every layer agrees on the same horizon and light:

```text
sky: stable, calm top, sunset gradient
far background: slow/static horizon silhouette
midground: low-detail mass, behind road
road: moving projection, fades into horizon
roadside: depth-spawned, bottom-center anchors
signs: depth-spawned, bottom-center anchors
weather: subtle overlay or layer-bound particles
car: fixed lower-center anchor
hud: calm top 14%
```

If one layer has a different horizon, scale, color temperature, or pivot logic, the composite feels fake.

### 4. Pixel Art Texture Must Be Low-Noise Under Motion

Pixel texture detail is not automatically quality. For road motion, too many single-pixel highlights become shimmer.

Good road texture:

- long vertical grain;
- broad warm/cool value bands;
- subtle tire-wear paths;
- few isolated bright pixels;
- limited contrast at horizon scale;
- clusters large enough to survive motion.

Bad road texture:

- random orange speckles everywhere;
- high-contrast single-pixel gravel;
- cracks for the first road-only pass;
- baked perspective;
- baked lane lines;
- strong edge shadow from a specific object.

### 5. Lane Lines Are Optical-Flow Markers

Lane markings are not decoration. They tell the player how fast the road is moving.

Rules:

- Lane strip should be transparent and separate from asphalt.
- Lane width should be road-relative, not fixed screen width.
- Dash/gap spacing should be distance-driven so near dashes move quickly and far dashes compress.
- Double-yellow line should be readable near car but should fade or simplify near horizon.
- Lane and asphalt must share the same visual distance source.

### 6. Background Is Not A Second Gameplay Road

Sky, far, and midground layers create place identity and depth. They should not contain the gameplay road, car, lane, guardrail, HUD, or signs.

Rules:

- Sky may be full portrait background.
- Far background should be a transparent horizon band or controlled lower-band image.
- Midground must be transparent/cutout or a controlled silhouette band.
- 0-35 km coastal_cliffs should disable bridge runtime layer unless used as a far micro-silhouette explicitly approved by segment config.
- Full scenic compositions are allowed for route cards, Travel Reports, scenic reveals, and photo cards only.

### 7. Sprite Anchors Must Represent Ground Contact

Roadside objects and signs must spawn from projection coordinates, not screen coordinates.

Rules:

- Car pivot: bottom-center tire baseline.
- Roadside pivot: bottom-center ground contact.
- Sign pivot: bottom-center post/base contact.
- Weather pivot: center overlay or layer-specific particle origin.
- Object scale should be derived from depth, not hand-positioned per screenshot.

### 8. Color And Value Consistency Beat More Detail

Big Sur sunset needs a locked value/color logic:

- light source: low right horizon;
- warm rim highlights on right-facing surfaces;
- cooler purple shadows toward lower-left/left side;
- road: warm brown/charcoal with purple shadow balance;
- ocean: blue-teal/purple base with golden reflection controlled by background layer;
- vegetation: dark green/cypress/chaparral, not neon;
- signs: readable but not over-bright.

Avoid mixing multiple sunset palettes in one segment.

### 9. Mobile Performance Is An Asset-Pipeline Constraint

The art pipeline must be performance-aware before runtime polish:

- Use route/segment Sprite Atlases for roadside/sign sprites.
- Pool side objects and signs.
- Keep overdraw low on full-screen alpha overlays.
- Prefer baked color/lighting and simple tints over many runtime lights.
- Profile on a lower-end phone target.
- Keep road mesh slice count practical and stable.

## NewTrip Big Sur Sunset Asset Requirements

### Target Segment

```yaml
route_key: tutorial_big_sur_hwy1_001
segment: 0-35 km
terrain: coastal_cliffs
time: sunset
visual_pack: bigsur_sunset_coastal_cliffs_v1
gameplay_frame: 9:16 portrait
bridge_runtime_layer: disabled
```

### A. Sky / Horizon Background

Purpose: stable mood layer behind all gameplay.

Requirements:

- 9:16 portrait-safe or wider source with safe crop.
- Calm top 14% for HUD.
- Violet top, orange/pink mid, pale yellow horizon.
- Low sun near right horizon is allowed, but there must not be a second sun in far/mid layers.
- Sparse horizontal pixel clouds.
- No road, car, guardrail, UI, signs, text, or bridge as main subject.
- Can include ocean horizon if it does not fight the far background band.
- Import as Sprite or background texture; no tiling required.

QA:

- HUD remains readable over top band.
- No hard seam with far band.
- Does not move faster than far/midground.

### B. Far Background Silhouette / Horizon Band

Purpose: distant coastline identity and depth.

Requirements:

- Transparent PNG or controlled horizon band.
- Lower 25-45% of gameplay frame only.
- Santa Lucia-style coastal mountains on left/mid.
- Ocean/right coastline haze.
- Lower detail and lower contrast than roadside sprites.
- No gameplay road, no car, no guardrail foreground, no UI.
- Must match sky sun/color direction.
- Bridge disabled for 0-35 km unless it is a tiny distant silhouette approved by config.

QA:

- No rectangular matte edge.
- Can sit behind procedural road without covering it.
- Far silhouettes do not visually attach to lane lines.

### C. Midground Landmark Mass

Purpose: segment identity without turning gameplay into a postcard.

0-35 km recommendation:

- Use cliff wall / coastal ridge / pine mass, not Bixby bridge.
- Place around horizon and sides.
- Keep center vanishing point clear enough for road/lane.
- Transparent/cutout preferred.

35-70 km exception:

- Bridge midground belongs to bridge_coast night segment.
- Runtime bridge art must be separate from scenic route-card bridge art.

QA:

- Midground never covers car anchor.
- Does not create a horizontal seam.
- Does not imply a full-screen scenic image is the gameplay layer.

### D. Road Asphalt Tile

Purpose: repeatable moving asphalt on code-generated road mesh.

Requirements:

```yaml
size: 512x512 preferred for review, 256x512 also valid
seam: seamless vertical and horizontal
filter_mode: Point
wrap_mode: Repeat
mip_maps: Off by default
compression: None for review
alpha: none
content: asphalt only
```

Art direction:

- Dark charcoal / warm brown base.
- Low-noise 16-bit pixel clusters.
- Longitudinal grain aligned with road travel direction.
- Subtle tire bands, not strong stripes.
- Sunset warmth but not orange glitter.
- No cracks in first road-only pass.
- No lane lines, no shoulder, no dirt, no vegetation.
- No strong single-pixel sparkle.

Motion requirements:

- Must pass 10-second motion without shimmer.
- Must remain quiet near horizon.
- Must not look like carpet, lava, gravel sparkle, or dirt field.

Candidate naming:

```text
bigsur_sunset_driving_road_asphalt_tile_clean_low_noise_v01_review.png
bigsur_sunset_driving_road_asphalt_tile_worn_soft_v01_review.png
bigsur_sunset_driving_road_asphalt_tile_horizon_safe_v01_review.png
```

### E. Lane Marking Strip

Purpose: transparent optical-flow marker above road.

Requirements:

```yaml
size: 128x512 or 128x1024
alpha: transparent background
filter_mode: Point
wrap_mode: Repeat
mip_maps: Off by default
compression: None for review
content: double yellow center strip only
```

Art direction:

- Double yellow line, slightly worn.
- Fewer random dark breaks than current candidate.
- Edges can be pixel-worn but not noisy.
- Width tested as road-relative, not viewport-fixed.
- Should fade/simplify near horizon in renderer, not by baking perspective into the strip.

QA:

- Tiles vertically without pop.
- Does not needle into the horizon.
- Moves in sync with asphalt from same visual distance state.

### F. Road Shoulder / Edge Context

Purpose: hide hard road edges and improve naturalness after road-only pass.

Requirements:

- Separate from asphalt and lane for staged testing.
- Left edge: rocky cliff dirt, scrub, flowers.
- Right edge: guardrail, coast rocks, low vegetation.
- Use depth-projected strips or spawned segments, not full-screen image.
- No crack/weather variants until base road passes.

QA:

- Edge elements do not float.
- Edge does not cover lane.
- Side context makes road feel embedded in world, not a floating trapezoid.

### G. Roadside Sprite Sheet

Purpose: spawnable side objects.

Minimum first set:

- roadside_rock_01
- roadside_bush_01
- roadside_guardrail_01
- coastal_flower_01
- pine_cluster_01
- cliff_chunk_01

Requirements:

- Transparent PNG.
- Single object per sprite.
- Bottom-center pivot.
- Stable canvas and padding.
- No baked sky, road, car, sign text, or scenic background.
- Pixel density matches car/signs.
- Left/right variants for asymmetric perspective-sensitive props.

QA:

- The base point sits on projected road edge.
- Object grows smoothly from horizon to near field.
- Object never appears in sky unless it is a bird/cloud.
- No matte halo at mobile scale.

### H. Sign Sprite Sheet

Purpose: route identity, landmark cue, forced-stop cue.

Minimum first set:

- sign_california_1_blank_or_simple
- sign_photo_stop_blank
- sign_route_marker_blank
- sign_rest_stop_blank
- sign_wood_arrow_blank

Requirements:

- Transparent PNG.
- Bottom-center pivot at post/base.
- Prefer blank sign bodies with Unity pixel-font labels where text must be readable.
- Avoid long baked text in generated art.
- No GPS styling, racing checkpoints, or oversized UI signboards.

QA:

- Readability checked at spawn depths.
- Text, if any, is authored and QA-approved.
- Sign never drifts above horizon.

### I. Weather / Atmosphere Overlay

Purpose: subtle depth and mood, not a full-screen noise layer.

Requirements:

- Use only after road-only and background pass.
- Haze/fog band near horizon is higher priority than rain.
- Clouds can be sky layer or sparse overlay.
- Bird silhouettes are optional and very low frequency.
- Avoid dense particle speckles over road; they can amplify shimmer.

QA:

- Does not obscure lane visibility.
- Does not create full-screen alpha overdraw problem.
- Moves slowly or layer-bound; no random screen noise.

## Renderer Requirements Implied By Art Research

The asset work is not enough unless renderer behavior changes with it.

### Road Motion

Replace or supplement uniform UV scroll with visual-distance-driven UV:

```text
visual_distance += speed_normalized * delta_time
slice_uv_v = visual_distance + projected_depth_distance(slice)
```

Goal:

- near road flows quickly;
- far road flows slowly;
- lane and road share the same visual distance;
- horizon fade hides the compressed far texture.

### Lane Width

Lane strip width must be derived from projected road half-width:

```text
lane_half_width = road_half_width_at_depth * lane_width_ratio
```

Not:

```text
lane_half_width = fixed_screen_width
```

### Horizon Fade

Add road alpha or tint fade near the horizon:

```text
depth 1.00 far: alpha 0.00-0.10
depth 0.75: alpha 0.35-0.55
depth 0.50: alpha 0.80-1.00
depth 0.00 near: alpha 1.00
```

This is an art/renderer bridge. It prevents the road from becoming a hard triangle that stabs into the background.

### Side Object Projection

Every side object should have:

```yaml
sprite_id:
side: left | right
depth: 1.0 far to 0.0 near
lane_offset: road-relative
pivot: [0.5, 0.0]
base_scale:
parallax_speed:
rarity_weight:
segment_tags:
```

## QA Checklist

### Road-Only Motion Gate

Run before any real background, car, signs, props, weather, cracks, or dirt shoulder.

- [ ] Road mesh renders in 9:16 portrait frame.
- [ ] Lane mesh renders above road.
- [ ] Asphalt and lane textures are present, not magenta/missing.
- [ ] Asphalt uses Point, Repeat, no mipmaps, no compression for review.
- [ ] Lane uses Point, Repeat, no mipmaps, no compression, Alpha is Transparency.
- [ ] Still frame has no obvious seam.
- [ ] 10-second motion test has no shimmer, sparkle, or strobe.
- [ ] Lane and asphalt move coherently from same speed source.
- [ ] Near road feels faster than far road.
- [ ] Horizon is not a hard needle.
- [ ] Bottom close-up reads as road, not carpet/gravel/lava/dirt.
- [ ] Horizon close-up remains visually quiet.

### Background Layer Gate

- [ ] Sky is the only full-screen background layer.
- [ ] Top 14% remains HUD-safe.
- [ ] Far background is horizon band or transparent cutout.
- [ ] Midground is transparent/cutout or controlled band.
- [ ] No hard rectangular seam between sky/far/midground.
- [ ] 0-35 km bridge runtime layer is disabled.
- [ ] Color temperature matches golden_hour_sunset_a.
- [ ] Background does not contain gameplay road/car/signs/UI.

### Sprite Extraction Gate

- [ ] Source sheet is preserved separately.
- [ ] Runtime sprite is extracted PNG, not a raw sheet crop preview.
- [ ] Single sprite only; no neighboring object.
- [ ] Transparent background is clean.
- [ ] No matte halo at mobile scale.
- [ ] Canvas size and padding are stable.
- [ ] Pivot is bottom-center for physical objects.
- [ ] Pivot is center only for overlays/non-physical layers.
- [ ] QA status is `review`, not `approved`, until Unity composite passes.

### Composite Motion Gate

Run after road-only passes.

- [ ] Car tire baseline sits on car anchor.
- [ ] Road remains visible below and behind car.
- [ ] Side sprites spawn near horizon and move downward.
- [ ] Side sprites scale smoothly with depth.
- [ ] Signs never float in sky.
- [ ] Guardrail/rocks/vegetation hide hard road edges.
- [ ] Background moves slower than side objects.
- [ ] Weather overlay does not add road shimmer.
- [ ] 10-second and 30-second clips still feel like forward travel, not texture sliding.
- [ ] No layer visually detaches from the road projection.

### Performance Gate

- [ ] Road mesh slice count is stable and not excessive.
- [ ] Side/sign sprites are pooled.
- [ ] Route/segment sprites are packed into Sprite Atlas.
- [ ] Avoid many unique materials for small props.
- [ ] Full-screen transparent overlays are limited.
- [ ] Profile on target or lower-end mobile device.
- [ ] Frame budget target remains 60 fps / 16 ms where feasible for prototype.

## Immediate Recommendation For Current NewTrip Road Problem

Do not make the current asphalt "clearer." Make it quieter.

Next highest-ROI pass:

1. Keep current road pack as baseline.
2. Create 2-3 low-noise asphalt candidates.
3. Create 1-2 wider, cleaner lane strip candidates.
4. Tune road repeat lower from the current high-frequency look.
5. Implement road-relative lane width.
6. Add horizon fade before adding backgrounds.
7. Run RoadOnlyTest still, 10-second motion, horizon close-up, and near-bottom close-up for each candidate.

Acceptance for moving on to background/car/props:

```text
Road-only motion reads as calm forward driving for 10 seconds.
No shimmer.
No needle horizon.
No carpet/gravel/lava read.
Lane and asphalt share motion.
```
