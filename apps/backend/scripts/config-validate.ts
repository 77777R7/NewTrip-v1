import { readdirSync, readFileSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';

const yaml = require('js-yaml') as {
  load: (input: string, options?: { filename?: string }) => unknown;
};

const workspaceRoot = resolve(__dirname, '../../..');

type YamlRecord = Record<string, unknown>;

export type ValidateWorkspaceOptions = {
  yamlOnly?: boolean;
};

function fail(message: string): never {
  throw new Error(`config:validate failed - ${message}`);
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    fail(message);
  }
}

function displayPath(filePath: string): string {
  return isAbsolute(filePath) ? relative(workspaceRoot, filePath) || filePath : filePath;
}

function resolveWorkspacePath(filePath: string): string {
  return isAbsolute(filePath) ? filePath : resolve(workspaceRoot, filePath);
}

function isRecord(value: unknown): value is YamlRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function record(value: unknown, label: string): YamlRecord {
  if (!isRecord(value)) {
    fail(`${label} must be a YAML object`);
  }
  return value;
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    fail(`${label} must be a YAML array`);
  }
  return value;
}

function child(parent: YamlRecord, key: string, label = key): YamlRecord {
  return record(parent[key], label);
}

function numberValue(parent: YamlRecord, key: string, label = key): number {
  const value = parent[key];
  if (typeof value !== 'number' || Number.isNaN(value)) {
    fail(`${label} must be a number`);
  }
  return value;
}

function booleanValue(parent: YamlRecord, key: string, label = key): boolean {
  const value = parent[key];
  if (typeof value !== 'boolean') {
    fail(`${label} must be a boolean`);
  }
  return value;
}

function stringValue(parent: YamlRecord, key: string, label = key): string {
  const value = parent[key];
  if (typeof value !== 'string' || value.length === 0) {
    fail(`${label} must be a non-empty string`);
  }
  return value;
}

function collectYamlFiles(relativeDir: string): string[] {
  const absoluteDir = resolve(workspaceRoot, relativeDir);
  const files: string[] = [];

  for (const entry of readdirSync(absoluteDir)) {
    const absoluteEntry = join(absoluteDir, entry);
    const relativeEntry = relative(workspaceRoot, absoluteEntry);
    const stat = statSync(absoluteEntry);

    if (stat.isDirectory()) {
      files.push(...collectYamlFiles(relativeEntry));
      continue;
    }

    if (entry.endsWith('.yaml') || entry.endsWith('.yml')) {
      files.push(relativeEntry);
    }
  }

  return files.sort();
}

export function parseYamlFile(filePath: string): unknown {
  const absolutePath = resolveWorkspacePath(filePath);
  const text = readFileSync(absolutePath, 'utf8');

  try {
    return yaml.load(text, { filename: absolutePath });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fail(`invalid YAML in ${displayPath(filePath)}: ${message}`);
  }
}

export function validateYamlFiles(filePaths: string[]): void {
  for (const filePath of filePaths) {
    parseYamlFile(filePath);
  }
}

export function validateDefaultParametersConfig(config: unknown): void {
  const root = record(config, 'config/default_parameters.v1.yaml');
  const simulation = child(root, 'simulation', 'simulation');
  const drivingModes = child(root, 'driving_modes', 'driving_modes');
  const economy = child(root, 'economy', 'economy');
  const tripPrepFee = child(economy, 'trip_prep_fee', 'economy.trip_prep_fee');
  const routes = child(root, 'routes', 'routes');
  const tutorial = child(routes, 'tutorial', 'routes.tutorial');

  assert(numberValue(simulation, 'max_offline_hours') === 8, 'max_offline_hours must stay at Day 2 default 8');
  assert(numberValue(simulation, 'base_offline_speed_kmph') === 30, 'base_offline_speed_kmph must stay at Day 2 default 30');
  assert(numberValue(simulation, 'max_online_tick_seconds') === 15, 'max_online_tick_seconds must stay at Day 2 default 15');
  assert(numberValue(drivingModes, 'hold_to_drive_multiplier') === 1, 'Hold to Drive multiplier must be 1.00');
  assert(numberValue(drivingModes, 'auto_driving_multiplier') === 0.85, 'Auto Driving multiplier must be 0.85');
  assert(numberValue(drivingModes, 'hold_to_boost_multiplier') === 1.1, 'Hold to Boost multiplier must be 1.10');
  const onlineCoinPerKm = numberValue(economy, 'online_coin_per_km');
  const offlineCoinPerKm = numberValue(economy, 'offline_coin_per_km');
  assert(offlineCoinPerKm < onlineCoinPerKm, 'offline_coin_per_km must be lower than online_coin_per_km');
  assert(onlineCoinPerKm === 10, 'online_coin_per_km must be 10');
  assert(offlineCoinPerKm === 4, 'offline_coin_per_km must be 4');
  assert(numberValue(economy, 'online_token_km') === 10, 'online_token_km must be 10');
  assert(numberValue(economy, 'offline_token_km') === 20, 'offline_token_km must be 20');
  assert(numberValue(tripPrepFee, 'max', 'economy.trip_prep_fee.max') <= 300, 'Trip Prep Fee max must not exceed 300');
  assert(numberValue(tutorial, 'distance_km_min') === 80, 'Tutorial Route min distance must be 80 km');
  assert(numberValue(tutorial, 'distance_km_max') === 120, 'Tutorial Route max distance must be 120 km');
  assert(numberValue(tutorial, 'unlock_cost_stamps') === 0, 'Tutorial Route must not cost Souvenir Stamps');
  assert(numberValue(tutorial, 'trip_prep_fee_coins') === 0, 'Tutorial Route must be free');

  if (root.gacha !== undefined) {
    const gacha = child(root, 'gacha', 'gacha');
    const rates = child(gacha, 'rates', 'gacha.rates');
    const rateValues = Object.keys(rates).map((key) => numberValue(rates, key, `gacha.rates.${key}`));
    assert(rateValues.length > 0, 'gacha rates must not be empty if present');
    assert(rateValues.every((value) => value >= 0), 'gacha rates must be non-negative');
    const totalRate = Number(rateValues.reduce((sum, value) => sum + value, 0).toFixed(6));
    assert(totalRate === 100, 'gacha rates must total 100');
  }
}

export function validateTutorialRouteConfig(config: unknown): void {
  const root = record(config, 'config/tutorial_route.v1.yaml');
  const route = child(root, 'route', 'route');
  const segments = array(root.segments, 'segments').map((value, index) => record(value, `segments[${index}]`));
  const landmarks = array(root.landmarks, 'landmarks').map((value, index) => record(value, `landmarks[${index}]`));

  assert(stringValue(route, 'route_type') === 'Tutorial', 'route_type must be Tutorial');
  const totalDistanceKm = numberValue(route, 'total_distance_km', 'route.total_distance_km');
  assert(totalDistanceKm >= 80 && totalDistanceKm <= 120, 'Tutorial Route must stay between 80 and 120 km');
  assert(numberValue(route, 'trip_prep_fee_coins', 'route.trip_prep_fee_coins') === 0, 'Tutorial Route must be free');
  assert(numberValue(route, 'trip_prep_fee_coins', 'route.trip_prep_fee_coins') <= 300, 'Trip Prep Fee must not exceed 300');
  assert(numberValue(route, 'unlock_cost_stamps', 'route.unlock_cost_stamps') === 0, 'Tutorial Route must not cost Souvenir Stamps');
  assert(segments.length === 3, 'Tutorial Route must have exactly three seed segments for Day 2');
  assert(numberValue(segments[0], 'start_km', 'segments[0].start_km') === 0, 'Tutorial Route segments must start at 0 km');

  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i];
    const segmentIndex = numberValue(segment, 'index', `segments[${i}].index`);
    const startKm = numberValue(segment, 'start_km', `segments[${i}].start_km`);
    const endKm = numberValue(segment, 'end_km', `segments[${i}].end_km`);

    assert(segmentIndex === i, `Tutorial segment index ${i} is missing or out of order`);
    assert(endKm > startKm, `Tutorial segment ${i} must have positive distance`);
    if (i > 0) {
      const previousEndKm = numberValue(segments[i - 1], 'end_km', `segments[${i - 1}].end_km`);
      assert(startKm === previousEndKm, `Tutorial segment ${i} must start where previous segment ends`);
    }
  }

  const lastSegment = segments[segments.length - 1];
  assert(numberValue(lastSegment, 'end_km', 'last segment end_km') === totalDistanceKm, 'Tutorial Route segments must end at total distance');
  assert(landmarks.length >= 1, 'Tutorial Route must have at least one landmark');

  const firstLandmark = landmarks[0];
  const landmarkDistanceKm = numberValue(firstLandmark, 'distance_km', 'landmarks[0].distance_km');
  assert(booleanValue(firstLandmark, 'required_stop', 'landmarks[0].required_stop'), 'first Tutorial landmark must be required');
  for (let i = 0; i < landmarks.length; i += 1) {
    const distanceKm = numberValue(landmarks[i], 'distance_km', `landmarks[${i}].distance_km`);
    assert(distanceKm > 0 && distanceKm < totalDistanceKm, `landmarks[${i}].distance_km must be inside route range`);
  }
  assert(landmarkDistanceKm >= totalDistanceKm * 0.3 && landmarkDistanceKm <= totalDistanceKm * 0.45, 'first landmark must be 30%-45% into Tutorial Route');
}

function validateDefaultVehicle(config: unknown): void {
  const root = record(config, 'config/default_vehicle.v1.yaml');
  const vehicle = child(root, 'vehicle', 'vehicle');

  assert(numberValue(vehicle, 'base_speed_kmph') === 72, 'default vehicle base speed must match Day 2 plan');
  assert(numberValue(vehicle, 'fuel_capacity') === 45, 'default vehicle fuel capacity must match Day 2 plan');
  assert(numberValue(vehicle, 'fuel_consumption_per_km') === 0.075, 'default vehicle fuel usage must match Day 2 plan');
  assert(numberValue(vehicle, 'cleanliness_loss_per_km') === 0.035, 'default cleanliness loss must match Day 2 plan');
  assert(numberValue(vehicle, 'durability_loss_per_km') === 0.018, 'default durability loss must match Day 2 plan');
  assert(numberValue(vehicle, 'offline_efficiency') === 0.6, 'default offline efficiency must match Day 2 plan');
}

export function validateWorkspaceConfigs(options: ValidateWorkspaceOptions = {}): void {
  const yamlFiles = [
    ...collectYamlFiles('config'),
    ...collectYamlFiles('art-pipeline/comfyui'),
  ];

  validateYamlFiles(yamlFiles);

  if (options.yamlOnly) {
    return;
  }

  validateDefaultParametersConfig(parseYamlFile('config/default_parameters.v1.yaml'));
  validateTutorialRouteConfig(parseYamlFile('config/tutorial_route.v1.yaml'));
  validateDefaultVehicle(parseYamlFile('config/default_vehicle.v1.yaml'));
}

if (require.main === module) {
  const yamlOnly = process.argv.includes('--yaml-only');
  validateWorkspaceConfigs({ yamlOnly });
  console.log(
    yamlOnly
      ? 'config:validate-yaml ok - all V1 config and art pipeline YAML files parse structurally.'
      : 'config:validate ok - V1 YAML configs parse structurally and satisfy Day 2 constraints.',
  );
}
