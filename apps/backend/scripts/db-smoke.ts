import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workspaceRoot = resolve(__dirname, '../../..');
const migrationsDir = resolve(workspaceRoot, 'supabase/migrations');
const seedPath = resolve(workspaceRoot, 'supabase/seed.sql');
const vehiclePath = resolve(workspaceRoot, 'config/default_vehicle.v1.yaml');
const routePath = resolve(workspaceRoot, 'config/tutorial_route.v1.yaml');

function fail(message: string): never {
  throw new Error(`db:smoke failed - ${message}`);
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    fail(message);
  }
}

function assertIncludes(text: string, needle: string, message: string): void {
  assert(text.includes(needle), message);
}

function readRequired(path: string): string {
  return readFileSync(path, 'utf8');
}

function yamlNumber(text: string, key: string): number {
  const match = text.match(new RegExp(`\\b${key}:\\s*([0-9]+(?:\\.[0-9]+)?)`));
  if (!match) {
    fail(`missing YAML number: ${key}`);
  }
  return Number(match[1]);
}

const migrationFile = readdirSync(migrationsDir)
  .filter((fileName) => fileName.endsWith('_day02_base_schema.sql'))
  .sort()
  .at(-1);

assert(Boolean(migrationFile), 'missing Day 2 base schema migration');

const migrationSql = readRequired(resolve(migrationsDir, migrationFile as string)).toLowerCase();
const allMigrationSql = readdirSync(migrationsDir)
  .filter((fileName) => fileName.endsWith('.sql'))
  .sort()
  .map((fileName) => readRequired(resolve(migrationsDir, fileName)).toLowerCase())
  .join('\n');
const seedSql = readRequired(seedPath);
const seedSqlLower = seedSql.toLowerCase();
const vehicleYaml = readRequired(vehiclePath);
const routeYaml = readRequired(routePath);

const requiredTables = [
  'config_versions',
  'players',
  'wallet_balances',
  'wallet_transactions',
  'vehicle_definitions',
  'player_vehicles',
  'weather_profiles',
  'route_definitions',
  'route_segments',
  'landmarks',
  'player_unlocked_routes',
  'player_trips',
  'analytics_events',
  'daily_login_claims',
  'quest_definitions',
  'player_quest_progress',
  'quest_claims',
  'suspicious_events',
];

for (const tableName of requiredTables) {
  assert(new RegExp(`create table (if not exists )?public\\.${tableName}\\b`).test(allMigrationSql), `missing table ${tableName}`);
  assertIncludes(allMigrationSql, `alter table public.${tableName} enable row level security`, `missing RLS for ${tableName}`);
}

assertIncludes(migrationSql, 'unique (player_id, idempotency_key)', 'wallet transaction idempotency key is required');
assertIncludes(migrationSql, 'uq_one_running_trip_per_player', 'active trip uniqueness guard is required');
assertIncludes(migrationSql, 'uq_selected_vehicle_per_player', 'selected vehicle uniqueness guard is required');
assertIncludes(migrationSql, "where status = 'LIVE'".toLowerCase(), 'single LIVE config guard is required');

assertIncludes(seedSqlLower, "'live'", 'seed must create a LIVE config version');
assertIncludes(seedSql, "'van_common_001'", 'seed must include default vehicle');
assertIncludes(seedSql, "'tutorial_big_sur_hwy1_001'", 'seed must include Tutorial Route');
assertIncludes(seedSql, "'short_coast_to_town_001'", 'seed must include Short Route');
assertIncludes(seedSql, "'coast_easy'", 'seed must include weather profile');
assertIncludes(seedSql, "'bixby_bridge_lookout'", 'seed must include first required landmark');
assertIncludes(seedSql, "'drive_online_distance'", 'seed must include drive online daily quest');
assertIncludes(seedSql, "'claim_offline_report'", 'seed must include offline report daily quest');
assertIncludes(seedSql, "'refuel_vehicle'", 'seed must include refuel daily quest');
assertIncludes(seedSql, "'take_photo'", 'seed must include photo daily quest');
assertIncludes(seedSql, "'complete_route'", 'seed must include route completion daily quest');

const tutorialSegments = [
  [0, 0, 35],
  [1, 35, 70],
  [2, 70, 100],
] as const;

for (const [index, startKm, endKm] of tutorialSegments) {
  const segmentPattern = new RegExp(
    `'00000000-0000-4000-8000-000000000301'\\s*,\\s*'00000000-0000-4000-8000-00000000040${index + 1}'\\s*,\\s*${index}\\s*,\\s*${startKm}\\s*,\\s*${endKm}`,
  );
  assert(segmentPattern.test(seedSql), `Tutorial segment ${index} must cover ${startKm}-${endKm} km`);
}

assert(yamlNumber(routeYaml, 'total_distance_km') === 100, 'Tutorial Route YAML total distance must be 100 km');
assert(yamlNumber(routeYaml, 'trip_prep_fee_coins') === 0, 'Tutorial Route YAML must be free');
assert(yamlNumber(routeYaml, 'unlock_cost_stamps') === 0, 'Tutorial Route YAML must have zero Stamp unlock cost');
assert(yamlNumber(vehicleYaml, 'base_speed_kmph') === 72, 'default vehicle speed must be 72 km/h');
assert(yamlNumber(vehicleYaml, 'fuel_capacity') === 45, 'default vehicle fuel capacity must be 45');
assert(yamlNumber(vehicleYaml, 'fuel_consumption_per_km') === 0.075, 'default vehicle fuel consumption must be 0.075/km');
assert(yamlNumber(vehicleYaml, 'cleanliness_loss_per_km') === 0.035, 'default vehicle cleanliness loss must be 0.035/km');
assert(yamlNumber(vehicleYaml, 'durability_loss_per_km') === 0.018, 'default vehicle durability loss must be 0.018/km');
assert(yamlNumber(vehicleYaml, 'offline_efficiency') === 0.6, 'default vehicle offline efficiency must be 0.60');

const shortUnlockMatch = seedSql.match(/'short_coast_to_town_001'[\s\S]*?'Short'[\s\S]*?95[\s\S]*?2[\s\S]*?1[\s\S]*?70/);
assert(Boolean(shortUnlockMatch), 'Short Route must cost 1-2 Souvenir Stamps and have a Road Coins prep fee');

const firstLandmarkMatch = seedSql.match(/'bixby_bridge_lookout'[\s\S]*?'Bixby Bridge Lookout'[\s\S]*?40[\s\S]*?'Common'[\s\S]*?true/);
assert(Boolean(firstLandmarkMatch), 'first Tutorial landmark must be required and inside the 0-100 km route');

console.log(`db:smoke ok - ${migrationFile} and Day 2 seed data satisfy the base acceptance checks.`);
