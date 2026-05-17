# NewTrip Unity Client

This is the Unity client workspace for Travel Simulator V1.

## Unity Version

Target Unity line: `2022.3 LTS+`.

## Installed Packages

The project manifest includes:

- `com.besty.unity-skills` from `Besty0728/Unity-Skills`
- `com.coplaydev.unity-mcp` from `CoplayDev/unity-mcp`
- Unity UI, TextMeshPro, and Input System packages

## First Open

Open this folder in Unity Hub:

```text
apps/unity-client
```

After packages resolve:

1. Open `Window > MCP for Unity`, then start/connect the MCP server.
2. Open `Window > UnitySkills > Start Server` if using UnitySkills REST automation.
3. Use the Big Sur draft layers under `Assets/NewTrip/Art/ScenePacks/CaliforniaHwy1/BigSurSunset/`.

## Road Prototype

The first playable road view is a procedural pseudo-3D greybox. It does not use a full-screen driving image.

Create the prototype scene from the Unity menu:

```text
NewTrip > Road Prototype > Create Or Refresh Scene
```

Then press Play. `RoadPrototypeBootstrap` creates the runtime scene:

- `RoadMesh`: code-generated pseudo-3D road projection.
- `LaneMarkingMesh`: independently scrolling dashed lane strip.
- `PlayerCar`: fixed rear-view car sprite with subtle bob/sway.
- `SideObjectSpawner`: left/right sprite spawning with depth scaling.
- `LandmarkSignSpawner`: visual-only sign cue.
- `WeatherOverlay`: clear/haze/fog/rain overlay switch.
- `HudRoot`: empty placeholder for the later route board and controls.

Prototype controls:

- Up/Down arrows: adjust visual speed.
- Space: preview boost car animation.
- `S`: spawn a placeholder landmark/sign.
- `W`: cycle weather overlays.

These controls are local visual preview only. Backend responses must remain authoritative for real distance, forced stops, rewards, wallet changes, route unlocks, and config selection.

## V1 Client Rule

The Unity client renders animation and brief prediction only. Backend remains authoritative for distance, time, rewards, offline progress, wallet changes, route unlocks, and forced stops.
