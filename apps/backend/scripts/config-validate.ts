import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workspaceRoot = resolve(__dirname, '../../..');

function fail(message: string): never {
  throw new Error(`config:validate failed - ${message}`);
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    fail(message);
  }
}

function readConfig(relativePath: string): string {
  return readFileSync(resolve(workspaceRoot, relativePath), 'utf8');
}

function yamlNumber(text: string, key: string): number {
  const match = text.match(new RegExp(`\\b${key}:\\s*([0-9]+(?:\\.[0-9]+)?)`));
  if (!match) {
    fail(`missing numeric key: ${key}`);
  }
  return Number(match[1]);
}

const routeYaml = readConfig('config/tutorial_route.v1.yaml');
const vehicleYaml = readConfig('config/default_vehicle.v1.yaml');

const totalDistanceKm = yamlNumber(routeYaml, 'total_distance_km');
assert(totalDistanceKm >= 80 && totalDistanceKm <= 120, 'Tutorial Route must stay between 80 and 120 km');
assert(yamlNumber(routeYaml, 'trip_prep_fee_coins') === 0, 'Tutorial Route must be free');
assert(yamlNumber(routeYaml, 'unlock_cost_stamps') === 0, 'Tutorial Route must not cost Souvenir Stamps');

const segmentMatches = [...routeYaml.matchAll(/index:\s*(\d+)[\s\S]*?start_km:\s*([0-9.]+)[\s\S]*?end_km:\s*([0-9.]+)/g)]
  .map((match) => ({
    index: Number(match[1]),
    startKm: Number(match[2]),
    endKm: Number(match[3]),
  }))
  .sort((a, b) => a.index - b.index);

assert(segmentMatches.length === 3, 'Tutorial Route must have exactly three seed segments for Day 2');
assert(segmentMatches[0]?.startKm === 0, 'Tutorial Route segments must start at 0 km');

for (let i = 0; i < segmentMatches.length; i += 1) {
  const segment = segmentMatches[i];
  assert(segment.index === i, `Tutorial segment index ${i} is missing or out of order`);
  assert(segment.endKm > segment.startKm, `Tutorial segment ${i} must have positive distance`);
  if (i > 0) {
    assert(segment.startKm === segmentMatches[i - 1].endKm, `Tutorial segment ${i} must start where previous segment ends`);
  }
}

assert(segmentMatches.at(-1)?.endKm === totalDistanceKm, 'Tutorial Route segments must end at total distance');

const landmarkDistanceKm = yamlNumber(routeYaml, 'distance_km');
assert(landmarkDistanceKm > 0 && landmarkDistanceKm < totalDistanceKm, 'Tutorial landmark must be inside route range');
assert(landmarkDistanceKm >= totalDistanceKm * 0.3 && landmarkDistanceKm <= totalDistanceKm * 0.45, 'first landmark must be 30%-45% into Tutorial Route');

assert(yamlNumber(vehicleYaml, 'base_speed_kmph') === 72, 'default vehicle base speed must match Day 2 plan');
assert(yamlNumber(vehicleYaml, 'fuel_capacity') === 45, 'default vehicle fuel capacity must match Day 2 plan');
assert(yamlNumber(vehicleYaml, 'fuel_consumption_per_km') === 0.075, 'default vehicle fuel usage must match Day 2 plan');
assert(yamlNumber(vehicleYaml, 'cleanliness_loss_per_km') === 0.035, 'default cleanliness loss must match Day 2 plan');
assert(yamlNumber(vehicleYaml, 'durability_loss_per_km') === 0.018, 'default durability loss must match Day 2 plan');
assert(yamlNumber(vehicleYaml, 'offline_efficiency') === 0.6, 'default offline efficiency must match Day 2 plan');

console.log('config:validate ok - Tutorial route and default vehicle configs satisfy Day 2 constraints.');
