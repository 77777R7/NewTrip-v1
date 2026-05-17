import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  parseYamlFile,
  validateDefaultParametersConfig,
  validateTutorialRouteConfig,
  validateWorkspaceConfigs,
  validateYamlFiles,
} from './config-validate';

describe('config validation', () => {
  it('parses every workspace YAML file used by V1 config and art pipeline', () => {
    expect(() => validateWorkspaceConfigs({ yamlOnly: true })).not.toThrow();
  });

  it('validates Tutorial Route, default vehicle, and default simulation parameters structurally', () => {
    expect(() => validateWorkspaceConfigs()).not.toThrow();
  });

  it('fails when a YAML file cannot be parsed', () => {
    const dir = mkdtempSync(join(tmpdir(), 'newtrip-yaml-'));
    const invalidPath = join(dir, 'broken.yaml');
    writeFileSync(invalidPath, 'route:\n  - broken: [\n', 'utf8');

    expect(() => validateYamlFiles([invalidPath])).toThrow(/invalid YAML/);
  });

  it('returns structured YAML objects instead of raw text matching', () => {
    const route = parseYamlFile('config/tutorial_route.v1.yaml');

    expect(route).toMatchObject({
      route: {
        route_key: 'tutorial_big_sur_hwy1_001',
        total_distance_km: 100,
      },
    });
  });

  it('fails when route segments are not continuous or landmarks leave the route range', () => {
    const route = parseYamlFile('config/tutorial_route.v1.yaml') as {
      segments: Array<{ start_km: number }>;
      landmarks: Array<{ distance_km: number }>;
    };

    route.segments[1].start_km = 36;
    expect(() => validateTutorialRouteConfig(route)).toThrow(/must start where previous segment ends/);

    const routeWithBadLandmark = parseYamlFile('config/tutorial_route.v1.yaml') as {
      landmarks: Array<{ distance_km: number }>;
    };
    routeWithBadLandmark.landmarks[0].distance_km = 120;
    expect(() => validateTutorialRouteConfig(routeWithBadLandmark)).toThrow(/landmarks\[0\].distance_km must be inside route range/);
  });

  it('fails when economy or gacha config violates Day 12 rules', () => {
    const config = parseYamlFile('config/default_parameters.v1.yaml') as {
      economy: { online_coin_per_km: number };
      gacha: { rates: { legendary: number } };
    };

    config.economy.online_coin_per_km = 4;
    expect(() => validateDefaultParametersConfig(config)).toThrow(/offline_coin_per_km must be lower/);

    const configWithBadGacha = parseYamlFile('config/default_parameters.v1.yaml') as {
      gacha: { rates: { legendary: number } };
    };
    configWithBadGacha.gacha.rates.legendary = 2;
    expect(() => validateDefaultParametersConfig(configWithBadGacha)).toThrow(/gacha rates must total 100/);
  });
});
