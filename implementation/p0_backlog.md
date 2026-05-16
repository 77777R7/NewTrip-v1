# P0/P1/P2 Backlog

## P0 Must Ship

1. Player account and save
   - Anonymous/basic account.
   - Player profile.
   - Tutorial state.
   - `last_seen_at`.

2. First-trip tutorial
   - 3 starts x 3 destinations.
   - 80-120 km free tutorial route.
   - Hold to Drive.
   - Auto Driving.
   - Hold to Boost.
   - First required landmark.
   - First photo.
   - Full system unlock.

3. Route pack system
   - `route_definitions`.
   - `route_segments`.
   - `landmarks`.
   - `config_version`.
   - Route segment continuity validation.

4. Trip Simulation Engine
   - Online tick.
   - Offline progress.
   - Forced stop logic.
   - Rewards.
   - Fuel, cleanliness, durability consumption.

5. Online driving
   - Hold to Drive = 1.00.
   - Auto Driving = 0.85.
   - Tick rate limit.
   - Idempotency.

6. Offline progress and Travel Report
   - `max_offline_hours=8`.
   - Pending report.
   - Claim writes wallet transactions.
   - Duplicate pending report prevention.

7. Wallet and economy ledger
   - Road Coins.
   - Travel Tokens.
   - Souvenir Stamps.
   - Stamp Fragments.
   - Blueprints.
   - All changes through `wallet_transactions`.

8. Vehicle maintenance
   - Fuel.
   - Cleanliness.
   - Durability.
   - Refuel, clean, repair.

9. Landmark and photo cards
   - Required stops.
   - Photo card.
   - First photo reward.
   - Repeat reward cap.

10. Route unlock
    - Souvenir Stamps permanently unlock routes.
    - Trip Prep Fee uses Road Coins and is capped.

11. Admin Config
    - Draft.
    - Validate.
    - Publish.
    - Rollback.

12. Core analytics and anti-cheat
    - Core events.
    - Tick limit.
    - Speed cap.
    - `suspicious_events`.

## P1 Can Ship After Core Loop

- Collection-only Gacha.
- Blueprints.
- Fuller album.
- Weekly quests.
- Cosmetic shop.
- Vehicle upgrades.
- Fuller Admin UI.
- Risk dashboard.

## P2 Later

- Real weather API.
- Real time zones.
- Multiplayer convoy.
- Complex random road events.
- Complex traffic AI.
- Global real routes.
- Event route packs.
- Social sharing.
- More photo variants.

## Suggested Development Phases

1. Base auth/player/vehicle/route visibility.
2. Online trip creation and drive tick.
3. Auto Driving and Hold to Boost.
4. Offline progress and Travel Report.
5. Wallet ledger hardening.
6. Maintenance loop.
7. Landmark/photo cards.
8. Route unlock.
9. Gacha and shop.
10. Daily login and quests.
11. Admin Config and analytics.
12. Full tests, tuning, and soft launch.

