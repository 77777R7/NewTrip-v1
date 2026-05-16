# NewTrip Pseudo-3D Pixel Art Bible

This document locks the V1 art direction for AI-assisted batch asset generation. It is a production constraint file, not a marketing moodboard.

## Art Direction

NewTrip uses a warm, premium 16-bit pixel-art road-trip style with a pseudo-3D forward-driving camera.

The player should feel like the car is continuously moving toward a horizon, but the game is still a curated travel simulator. The image language should never imply free steering, racing, collision gameplay, or real GPS navigation.

## Camera Lock

- Portrait-first mobile frame, default `9:16`.
- Straight road perspective, not side-scrolling.
- Center vanishing point near the upper-middle of the frame.
- Camera slightly elevated behind the player vehicle position.
- Road begins wide at the bottom edge and narrows toward the horizon.
- Lower center stays clear for the player car sprite.
- Top 14% stays visually calm enough for HUD overlay.
- Bottom edge remains natural road, not UI.

## Style Lock

- Crisp 16-bit pixel art.
- Clean, readable silhouettes.
- Rich pixel shading without noisy micro-detail.
- Warm cinematic sunset palette for Tutorial Coast.
- Premium mobile game screenshot quality.
- Strong depth from road perspective, atmospheric mountains, and layered coast.
- UI and gameplay assets must share the same pixel density and outline weight.

## V1 Route Visual Themes

Tutorial Coast:

- Big Sur / California Highway 1 mood.
- Ocean on the right.
- Cliffs, pine trees, mountains, and flowers on the left.
- Guardrail following the road perspective.
- Distant arched coastal bridge.
- Warm sunset sky with orange, pink, and purple.

Short Forest:

- Evergreen forest highway.
- Cooler green/blue palette, still warm and cozy.
- Mountain shadows and roadside markers.
- Lighter fog is allowed, but no real weather API dependency.

Open Highway:

- Wide straight road.
- Distant town or service stop.
- Clear readability for route completion and unlock moments.

## Layer Strategy

Do not generate every screen as one flat image. Generate an approved master scene, then create layered assets that Unity can assemble:

- `sky_far`
- `far_landscape`
- `mid_landscape`
- `road_base`
- `roadside_left`
- `roadside_right`
- `landmark_billboard`
- `vehicle_sprite`
- `hud_mockup`
- `photo_card`

The gameplay scene should be built from layers so the client can animate distance, forced stops, and landmark approach without regenerating art.

## Negative Style Rules

- No real map UI.
- No GPS navigation language.
- No curved road for the tutorial base layer.
- No side-scrolling view.
- No racing UI.
- No steering wheel or brake/gas pedal controls in V1 screenshots.
- No extra cars unless a future route explicitly needs background traffic.
- No photorealism.
- No anime style.
- No messy low-resolution pixels.
- No unreadable text in production UI mockups.
- No road signs with text unless the asset task explicitly asks for text.

## Approval Rules

An asset can be marked approved only if:

- The perspective matches the camera lock.
- The route theme is recognizable within two seconds.
- It can be layered in Unity without fighting the HUD, car, or forced-stop states.
- It does not make the product look like a racing game.
- It has a tracked prompt, seed, model, workflow version, and source reference.
