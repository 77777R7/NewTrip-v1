# Unity Asset Extraction Rules V1

This document defines how draft image sheets become Unity review sprites for the pseudo-3D road prototype.

The rule is simple: source sheets are not runtime assets. Runtime assets must be extracted, padded, alpha-cleaned, pivoted, and QA-recorded before they enter a Unity composite pass.

## Folder Policy

Use three lanes:

```text
Source sheets: local Downloads or future Assets/NewTrip/Art/SourceSheets/
Extracted sprites: apps/unity-client/Assets/NewTrip/Art/ExtractedSprites/
Runtime Resources: apps/unity-client/Assets/NewTrip/Art/PrototypeComposite/Resources/PrototypeComposite/
```

`scripts/build-unity-prototype-assets.py` stays as the old prototype importer. It is useful for quick tests only and must not be treated as the production extraction pipeline.

The manifest-driven path is:

```bash
python3 scripts/extract-unity-assets-from-manifest.py \
  --manifest docs/art/bigsur-unity-asset-extraction-manifest-v1.json
```

## Manifest Contract

Every extracted asset must declare:

```json
{
  "id": "roadside_rock_01",
  "source_key": "roadside",
  "crop": [490, 245, 655, 372],
  "output_file": "roadside_rock_01.png",
  "alpha_method": "flood",
  "trim": true,
  "padding": 10,
  "canvas_size": [256, 256],
  "pivot": [0.5, 0.0],
  "status": "review",
  "qa_result": "single_sprite_only"
}
```

`pivot` uses Unity intent:

```text
[0.5, 0.0] = bottom-center physical ground contact
[0.5, 0.5] = center overlay or tile
```

## First Extraction Set

Only extract the smallest set needed to test the Unity composite:

```text
car_beige_default
car_beige_brake
car_beige_dirty
road_asphalt_tile
lane_center_yellow_strip
sign_california_1
sign_green_blank
sign_blue_arrow_blank
roadside_rock_01
roadside_bush_01
roadside_guardrail_01
roadside_guardrail_low_wooden_01
weather_haze_clouds
```

Do not cut the full sheets yet. A small clean set is enough to validate road projection, car anchor, side spawner scale, and sign placement.

`roadside_guardrail_low_wooden_01` is review-only until the SideObject Guardrail Review pass is accepted. Import it as a transparent Sprite with Point filtering, no mipmaps, no compression, 256 PPU, and bottom-center pivot `(0.5, 0.0)`.

## QA Gates

An extracted sprite is not production-approved until:

- the PNG has an alpha channel when it is not a full background or road tile;
- there are no visible matte halos at mobile scale;
- physical props use bottom-center pivot;
- car tire baseline sits on the car anchor;
- signs and roadside sprites spawn from projected road points, not screen coordinates;
- lane strip tiles without popping;
- road texture does not overpower the background;
- far and bridge layers are transparent cutouts or horizon bands, not full rectangles;
- the Unity composite screenshot passes the portrait coordinate contract.

## Segment Policy

For the current route:

```text
0-35 km: coastal_cliffs, sunset, bridge disabled
35-70 km: bridge_coast, night, bridge pack enabled
65-95 km: boardwalk_approach, morning daylight, boardwalk pack enabled
```

Bridge source art can remain in the source pack, but it must not be enabled in the 0-35 km runtime composite.

## Art Remake Policy

Do not remake everything because one composite looks bad.

First fix:

- road/camera/car anchors;
- clean alpha extraction;
- pivot and canvas rules;
- sky/far/midground layer policy;
- road fade and shoulder treatment.

Only remake art after a clean placeholder and clean extraction pass proves a specific asset still does not fit. The first remake candidates are:

- `far_background_silhouette` as a true horizon band;
- `bridge_midground` as a runtime cutout separate from scenic/photo-card art.
