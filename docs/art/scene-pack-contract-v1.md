# Scene Pack Contract V1

This contract is the mandatory production rule for NewTrip route art. All future ChatGPT, ComfyUI, Leonardo, or manual asset work must follow it before an image is treated as a usable game asset.

## Purpose

NewTrip uses curated route packs, not real maps. The art system must support the same product truth: a backend-authoritative travel simulator with a pseudo-3D forward road presentation.

This contract exists to:

- Keep generated assets consistent across scenes, tools, and contributors.
- Separate runtime driving assets from postcard-style scenic assets.
- Make route packs easy to assemble in Unity.
- Prevent beautiful but unusable moodboard images from entering production by accident.
- Keep V1 small while preserving a scalable asset library structure for later versions.

## Scope Rule

For V1, produce a small California Highway 1 asset set with complete metadata. Do not produce a global asset library yet.

Plan future regions through tags, naming, and metadata. Produce future content only when the playable spine needs it.

## Scene Pack Types

Every scene pack must declare one of these types:

- `core_biome_pack`: Main repeatable driving environment, such as Big Sur coast or forest highway.
- `transition_pack`: Visual bridge between two environments, such as wild coast to coastal town.
- `landmark_pack`: Forced-stop or photo-stop destination, such as lighthouse, bridge, boardwalk, overlook.
- `destination_pack`: Arrival or route-end environment, such as Santa Cruz city approach.
- `ui_card_pack`: Route card, travel report, loading card, or album presentation art.

## Usage Classes

Every asset must declare one or more usage classes.

### Driving Assets

Used in the main pseudo-3D driving screen.

Driving assets must prioritize:

- Layerability.
- Parallax or scroll compatibility.
- Clear road/camera perspective.
- Low visual conflict with HUD, car sprite, forced stops, and controls.
- Reuse across route segments.

Examples:

- Sky/horizon.
- Far silhouette.
- Road projection.
- Guardrail.
- Roadside vegetation.
- Subtle far landmark silhouette.
- Weather overlay.

### Scenic Assets

Used for stronger presentation moments.

Scenic assets may prioritize:

- Complete composition.
- Emotional impact.
- Landmark recognition.
- Photo-card framing.
- Route-card or Travel Report mood.

Examples:

- Photo stop art.
- Landmark reveal.
- Album card.
- Travel Report background.
- Route card thumbnail.
- Loading card.

### UI Assets

Used as interface elements or framed cards. UI assets must not be mixed into driving layers unless explicitly exported as `hud_mockup`.

Examples:

- HUD icons.
- Photo card frame.
- Route board thumbnail.
- Travel Report panel background.

## Seven-Layer Driving Structure

Every driving scene pack should use this layer model. Layers can be empty only when the scene pack metadata explains why.

| Layer | Required | Name | Definition | Examples |
| --- | --- | --- | --- | --- |
| 1 | Yes | `sky_horizon` | Sky, top gradient, far horizon light, HUD-safe calm area. | sunset sky, dawn haze, night sky |
| 2 | Yes | `far_background_silhouette` | Furthest readable biome silhouette. | ocean horizon, mountain ridge, skyline |
| 3 | Yes | `midground_landmark_mass` | Mid-distance mass that gives the segment identity without becoming a photo card. | bridge silhouette, cliffs, city edge, forest wall |
| 4 | Yes | `road_projection` | Pseudo-3D road plane, lane markings, perspective center, asphalt texture. | highway road, city road, mountain road |
| 5 | Yes | `roadside_terrain_vegetation` | Side elements that can scroll/parallax around the road. | grass, rocks, shrubs, curb, guardrail |
| 6 | Optional | `landmark_props_signs` | Discrete readable route objects, signs, or stop markers. | route sign, lighthouse far sprite, boardwalk arch |
| 7 | Optional | `weather_particles_overlay` | Additive or transparent overlays. | birds, light fog, rain streaks, dust, glow |

### Layer Ordering

Unity ordering should default to:

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

## Camera Lock

Driving assets must follow this camera unless a future contract explicitly creates a new camera family:

- Portrait-first, default `9:16`.
- Pseudo-3D forward-driving road view.
- Center vanishing point near the upper-middle.
- Camera slightly elevated behind the player car position.
- Lower center reserved for the player vehicle.
- Top 14% calm enough for HUD overlay.
- No side-scrolling composition.
- No free-steering or racing implication.

## Time-Of-Day Presets

V1 uses one primary production preset first. Add future presets only when the route needs them.

### Golden Hour / Sunset Preset A

Use this for V1 California Highway 1 sunset scenes.

```yaml
time_preset_id: golden_hour_sunset_a
sun_position: low_right_horizon
light_direction: right_to_left_warm_rim_light
shadow_direction: toward_lower_left_or_left_side
sky_gradient: violet_top_to_orange_middle_to_pale_yellow_horizon
cloud_style: sparse_horizontal_pixel_cloud_clusters
ocean_highlight: medium_width_golden_reflection_path
road_lighting: warm_center_highlights_with_cooler_purple_shadows
contrast: readable_not_harsh
color_temperature: warm_sunset_with_purple_shadow_balance
```

Do not mix different sunset color temperatures inside the same route segment unless the scene pack is explicitly a transition pack.

## Naming Convention

Use this filename pattern:

```text
{region}_{time}_{usage}_{layer_or_asset}_{variant}_{status}.png
```

Rules:

- Use lowercase ASCII.
- Use underscores.
- Do not use spaces.
- Use semantic region names, not random prompt labels.
- Use `v01`, `v02`, etc. for variants.
- Use `draft`, `review`, `approved`, or `rejected` as status.

Examples:

```text
bigsur_sunset_driving_sky_horizon_v01_approved.png
bigsur_sunset_driving_road_projection_v01_review.png
bigsur_sunset_scenic_lighthouse_photo_stop_v01_approved.png
santacruz_sunset_driving_far_background_skyline_v01_review.png
santacruz_sunset_routecard_boardwalk_thumb_v01_approved.png
```

## Metadata Contract

Every scene pack must have metadata. Use YAML.

```yaml
scene_pack_id: bigsur_sunset_v1
scene_pack_type: core_biome_pack
region: california_hwy_1
biome: coast
route_segment: big_sur_coast
time_preset: golden_hour_sunset_a
camera_perspective: pseudo_3d_forward_road
status: draft
primary_usage:
  - driving
compatible_usage:
  - route_card
  - travel_report
compatible_weather:
  - clear
  - light_cloud
  - light_fog
generation:
  tool: comfyui
  workflow: art-pipeline/comfyui/workflows/newtrip_pseudo3d_base_workflow.template.json
  style_reference: assets/art/reference/newtrip_style_reference_big_sur_pseudo3d_v1.png
  prompt_version: scene_pack_contract_v1
  model: replace_with_actual_model_name
  seed_policy: fixed_per_asset
layers:
  sky_horizon:
    asset_id: bigsur_sunset_driving_sky_horizon_v01
    status: draft
    path: assets/art/scene_packs/california_hwy_1/bigsur_sunset/driving/layers/bigsur_sunset_driving_sky_horizon_v01_draft.png
  far_background_silhouette:
    asset_id: bigsur_sunset_driving_far_ocean_mountains_v01
    status: draft
    path: assets/art/scene_packs/california_hwy_1/bigsur_sunset/driving/layers/bigsur_sunset_driving_far_ocean_mountains_v01_draft.png
  midground_landmark_mass:
    asset_id: bigsur_sunset_driving_bridge_mass_v01
    status: draft
    path: assets/art/scene_packs/california_hwy_1/bigsur_sunset/driving/layers/bigsur_sunset_driving_bridge_mass_v01_draft.png
  road_projection:
    asset_id: bigsur_sunset_driving_road_projection_v01
    status: draft
    path: assets/art/scene_packs/california_hwy_1/bigsur_sunset/driving/layers/bigsur_sunset_driving_road_projection_v01_draft.png
  roadside_terrain_vegetation:
    asset_id: bigsur_sunset_driving_roadside_vegetation_v01
    status: draft
    path: assets/art/scene_packs/california_hwy_1/bigsur_sunset/driving/layers/bigsur_sunset_driving_roadside_vegetation_v01_draft.png
  landmark_props_signs:
    asset_id: bigsur_sunset_driving_route_signs_v01
    status: draft
    path: assets/art/scene_packs/california_hwy_1/bigsur_sunset/driving/layers/bigsur_sunset_driving_route_signs_v01_draft.png
  weather_particles_overlay:
    asset_id: bigsur_sunset_driving_birds_overlay_v01
    status: draft
    path: assets/art/scene_packs/california_hwy_1/bigsur_sunset/driving/layers/bigsur_sunset_driving_birds_overlay_v01_draft.png
```

## Production Workflow

1. Declare the scene pack type.
2. Declare region, biome, route segment, time preset, and usage class.
3. Select the layer or scenic asset to generate.
4. Build the prompt from this contract, the art bible, and the route context.
5. Use the fixed style reference and saved workflow settings.
6. Generate only one layer or one asset class per prompt.
7. Save output as `draft`.
8. Review against the Definition of Done.
9. Promote to `approved` only after visual review and, for driving layers, a composite check.
10. Import approved assets into Unity only after the metadata is complete.

## Definition Of Done

An asset is not production done unless all checks pass:

- Matches NewTrip pixel-art style.
- Uses the declared time preset.
- Declares usage class.
- Declares layer or asset type.
- Uses the naming convention.
- Has metadata with generation tool, prompt version, model, and seed policy.
- Does not conflict with HUD, vehicle sprite, or forced-stop states.
- If transparent, alpha is validated and edges are clean.
- If driving asset, it works in the 7-layer scene structure.
- If scenic asset, it is not mistakenly used as a driving layer.
- Does not imply real navigation, racing, free steering, traffic AI, or open-world driving.

## Don'ts

- Do not put untagged images into production folders.
- Do not use a scenic/postcard composition as a driving layer.
- Do not place a large front-facing landmark in the main driving road layer.
- Do not change sun position inside one time preset without creating a new preset.
- Do not mix different sunset palettes in the same route segment.
- Do not add UI, HUD, buttons, car, or text to a layer prompt unless the asset class explicitly asks for it.
- Do not generate many assets before the road projection and camera are approved.
- Do not create global future route content before V1 needs it.
- Do not store prompt-only assets without metadata.
- Do not treat generated drafts as Unity-ready assets.

## V1 Asset Library Boundary

V1 should focus on:

- `california_hwy_1`.
- `golden_hour_sunset_a`.
- Pseudo-3D forward road.
- A small number of high-quality driving scene packs.
- A small number of scenic landmark/photo assets.

Recommended V1 scene packs:

- `bigsur_sunset`: core biome pack.
- `bixby_bridge_approach_sunset`: landmark/transition pack.
- `coast_to_town_sunset`: transition pack.
- `santacruz_sunset`: destination pack.

Future versions can add day, dawn, night, rain, desert, snow, international routes, and seasonal variants by extending this contract instead of replacing it.
