# Game And Product Spec

## V1 Positioning

Travel Simulator V1 is a curated, pixel-style long-distance travel simulator with light management and collection. It must feel like a road trip, not like a racing game or real navigation app.

V1 core promise:

- The player always feels the car is on a journey.
- Returning after time away produces a visible Travel Report.
- Vehicle maintenance adds texture, not punishment.
- Landmarks and photo cards create discovery.
- Route unlocks create the next goal.
- Gacha supports cosmetics and collection only.

## Core Loops

Main loop:

`choose route -> choose vehicle -> pay Trip Prep Fee -> drive online/offline -> consume fuel/cleanliness/durability -> stop at landmark -> take photo -> finish route -> receive rewards -> maintain vehicle -> unlock route -> start next trip`

Daily loop:

`login -> claim Daily Login fragments/coins -> view Travel Report -> claim pending rewards -> finish tasks -> maintain vehicle -> continue or start route`

Offline return loop:

`leave game -> backend tracks last_seen_at/last_simulated_at -> return -> backend calculates offline_seconds/final_offline_distance -> creates pending Travel Report -> player claims -> wallet transactions are written`

## Tutorial

Tutorial goal: finish a short, positive first trip in 5-10 minutes.

Required tutorial design:

- 3 starts x 3 destinations, 9 selectable first-trip combinations.
- Tutorial route is 80-120 km, recommended 100 km.
- First route is free: `Trip Prep Fee = 0`.
- Vehicle is free and has enough fuel to finish.
- First landmark appears at 30%-45% of route distance and is a required stop.
- Auto Driving unlocks after the first manual segment.
- Hold to Boost appears after Auto Driving and uses a 1.10 multiplier.
- Completing tutorial unlocks full route, garage, maintenance, tasks, gacha, and album systems.

Tutorial state machine:

```text
NOT_STARTED
  -> ROUTE_SELECTED
  -> HOLD_TO_DRIVE_REQUIRED
  -> AUTO_DRIVING_UNLOCKED
  -> FIRST_LANDMARK_REACHED
  -> PHOTO_TAKEN
  -> ROUTE_COMPLETED
  -> FULL_SYSTEM_UNLOCKED
```

## Client Presentation

The main screen must show a car continuously traveling. Route segments drive pixel background changes such as coast, city, forest, desert, snow mountain, plain, highway, night road, and mountain road.

Route Board must show:

- Next city.
- Next landmark.
- Remaining distance.
- Current weather.
- Day/night phase.
- Route progress.
- Fuel, cleanliness, durability.
- Forced Stop status.

Travel Report must show:

- Offline distance.
- Pending rewards.
- Fuel used.
- Cleanliness and durability loss.
- Weather summary.
- Landmark reached, if any.
- Forced stop reason: `LOW_FUEL`, `LANDMARK_REQUIRED`, `ROUTE_END`, or other.

## Vehicles And Maintenance

Vehicle attributes:

- `base_speed_kmph`
- `fuel_capacity`
- `fuel_consumption_per_km`
- `durability`
- `durability_loss_per_km`
- `cleanliness`
- `cleanliness_loss_per_km`
- `offline_efficiency`
- `weather_resistance`
- `rarity`
- `skin_id`
- `upgrade_level`

Maintenance rules:

- Fuel at zero stops progress.
- Cleanliness never blocks driving; it affects photo reward and visual quality.
- Durability should only mildly affect speed, fuel, and offline efficiency.
- Fuel must not regenerate on a wait timer and must not feel like stamina.
- Maintenance costs are paid with Road Coins that can be earned by normal play.

## Routes

Route types:

- Tutorial: 80-120 km, 1 required landmark, free.
- Short: 120-300 km, 1-2 landmarks.
- Medium: 300-800 km, 2-4 landmarks.
- Long: 800-1500 km, 4-6 landmarks.
- Epic: 1500-3000 km, 6-10 landmarks.

Routes are curated config packs, not real navigation. Each route has route definition, segments, landmarks, weather profile, day-night profile, background pack, reward multiplier, unlock cost, and trip prep fee.

## Economy

Currencies:

- Road Coins: maintenance, trip prep, upgrades, shop.
- Travel Tokens: collection/gacha currency.
- Souvenir Stamps: permanent route unlock currency.
- Stamp Fragments: 10 fragments convert to 1 Souvenir Stamp.
- Blueprints: duplicate gacha compensation and exchange material.

Default earning:

- Online: 10 Road Coins per km.
- Offline: 4 Road Coins per km.
- Online: 1 Travel Token per 10 km.
- Offline: 1 Travel Token per 20 km.

Rules:

- Travel Tokens never unlock routes.
- Souvenir Stamps unlock routes permanently.
- Unlocked routes do not charge Stamps again.
- Trip Prep Fee uses Road Coins and is capped.
- All currency changes go through `wallet_transactions`.

## Landmarks And Photos

Landmarks make route progress visible. Required landmarks force a stop before the player can continue. Photo quality is affected by cleanliness, weather, day phase, and rarity.

First photo reward is higher and grants photo card and album progress. Repeat photo rewards must be low or capped to prevent farming.

## Weather And Day/Night

V1 uses deterministic simulated weather, not real weather API. Weather is generated from player, route, trip, config version, and distance bucket. Online and offline simulation must produce consistent weather for the same route segment.

Day/night is simulated from route start game minutes and elapsed real seconds with `game_time_speed_multiplier=10`.

Phases:

- Dawn: 05:00-07:00.
- Day: 07:00-17:00.
- Sunset: 17:00-19:00.
- Night: 19:00-05:00.

## Gacha

Gacha is for vehicles, skins, and collection. It must not decide whether the player can progress routes.

Default rates:

- Common 70%.
- Rare 22%.
- Epic 7%.
- Legendary 1%.

Default pricing:

- Single pull: 20 Travel Tokens.
- Ten pull: 180 Travel Tokens.

Pity:

- 10 pulls: at least Rare.
- 30 pulls: at least Epic.
- 80 pulls: at least Legendary.

