import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  parseYamlFile,
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
        route_key: 'tutorial_coast_001',
        total_distance_km: 100,
      },
    });
  });
});
