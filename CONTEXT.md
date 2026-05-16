# NewTrip V1 Context

NewTrip V1 is the working repo for **旅游模拟器 / Travel Simulator V1**.

## Stack

**Game Client**  
Unity + C#.

**Backend**  
Node.js + NestJS + TypeScript.

**Database**  
Supabase PostgreSQL.

**Auth**  
Supabase Auth or temporary anonymous auth during the playable-spine phase.

**Cache**  
Redis is allowed after Day 10. Before that, prefer database-backed idempotency so the P0 loop is not blocked on cache setup.

**Admin**  
Start with SQL seed/config files and config validation scripts. Retool or a full Admin UI belongs later.

**Analytics**  
Write `analytics_events` first. Firebase/PostHog can be integrated later.

## Domain Language

**Travel Simulator**  
The game. A pixel-style long-distance road trip simulator built around route progress, offline return, vehicle maintenance, landmarks, photos, and route unlocks.

**Curated Route Pack**  
A hand-authored route configuration. V1 routes are not real map navigation. They are config-controlled route definitions, route segments, landmarks, weather profiles, day-night profiles, backgrounds, rewards, and costs.

**Trip Simulation Engine**  
Backend-authoritative engine that advances distance, fuel, cleanliness, durability, forced stops, rewards, route end, and offline progress.

**Economy Ledger**  
Wallet balances plus immutable wallet transactions. Every Road Coins, Travel Tokens, Souvenir Stamps, Stamp Fragments, and Blueprints change belongs here.

**Travel Report**  
The offline return artifact. It shows offline distance, pending rewards, vehicle losses, weather summary, and forced stop reason. Rewards are not paid until claim.

**Forced Stop**  
A backend-imposed stop caused by low fuel, required landmark, route end, config error, vehicle breakage, or risk limitation.

**Road Coins**  
Base soft currency for maintenance, Trip Prep Fee, upgrades, and basic shop spending.

**Travel Tokens**  
Collection/gacha currency. Must not unlock routes.

**Souvenir Stamps**  
Permanent route unlock currency.

**Stamp Fragments**  
Weak progress currency. Ten fragments convert to one Souvenir Stamp.

**Blueprints**  
Duplicate gacha compensation and exchange material.

**Trip Prep Fee**  
Capped Road Coins cost paid each time a route starts. It is zero for Tutorial.

**Tutorial Route**  
The first-trip route. It must be 80-120 km, free, short, positive, and include first driving, Auto Driving, boost, first landmark, first photo, and route completion.

## V1 Non-Goals

- Real global map.
- Google Maps.
- GPS navigation.
- Open-world driving.
- Racing leaderboard.
- Complex PvP/MMO.
- Real car brand licensing.
- Real paid gacha.
- Blockchain/NFT.
- Complex traffic AI.
- Large physics simulation.
- Real weather API.
- Kubernetes as a required architecture.

## Core Product Truth

The player should want to:

1. Finish the first trip.
2. Return to claim the Travel Report.
3. Maintain the vehicle.
4. Continue the route or start the next one.
5. Take the next photo card.
6. Unlock the next route.

Everything in V1 should support that loop.
