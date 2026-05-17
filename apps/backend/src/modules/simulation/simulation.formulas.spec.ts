import {
  calculateCleanlinessLoss,
  calculateDistanceGain,
  calculateDurabilityLoss,
  calculateFuelUsed,
  calculateOfflinePendingRewards,
  calculateOfflineSpeed,
  calculateOnlineRewards,
  checkForForcedStop,
} from './simulation.formulas';
import { DEFAULT_SIMULATION_CONFIG } from './simulation.constants';
import type {
  LandmarkSimulationState,
  SegmentSimulationState,
  VehicleSimulationState,
  WeatherSimulationState,
} from './simulation.types';

const vehicle: VehicleSimulationState = {
  baseSpeedKmph: 72,
  currentFuel: 45,
  fuelConsumptionPerKm: 0.075,
  currentDurability: 100,
  durabilityLossPerKm: 0.018,
  currentCleanliness: 100,
  cleanlinessLossPerKm: 0.035,
  offlineEfficiency: 0.6,
  weatherResistance: 0.15,
};

const segment: SegmentSimulationState = {
  startKm: 0,
  endKm: 100,
  speedMultiplier: 1,
  fuelMultiplier: 1,
  cleanlinessMultiplier: 1,
  durabilityMultiplier: 1,
};

const weather: WeatherSimulationState = {
  speedMultiplier: 1,
  fuelMultiplier: 1,
  cleanlinessMultiplier: 1,
  durabilityMultiplier: 1,
  photoMultiplier: 1,
};

describe('Trip Simulation Engine pure formulas', () => {
  it('calculates different distance gains for Hold, Auto, and Boost modes', () => {
    const durationSeconds = 100;

    const hold = calculateDistanceGain({
      vehicle,
      segment,
      weather,
      mode: 'HOLD_TO_DRIVE',
      durationSeconds,
    });
    const auto = calculateDistanceGain({
      vehicle,
      segment,
      weather,
      mode: 'AUTO_DRIVING',
      durationSeconds,
    });
    const boost = calculateDistanceGain({
      vehicle,
      segment,
      weather,
      mode: 'HOLD_TO_BOOST',
      durationSeconds,
    });

    expect(hold).toBeCloseTo(2);
    expect(auto).toBeCloseTo(hold * 0.85);
    expect(boost).toBeCloseTo(hold * 1.1);
    expect(auto).toBeLessThan(hold);
    expect(boost).toBeGreaterThan(hold);
  });

  it('calculates fuel, cleanliness, and durability loss from distance and multipliers', () => {
    expect(
      calculateFuelUsed({
        distanceKm: 10,
        vehicle,
        segment: { ...segment, fuelMultiplier: 1.2 },
        weather: { ...weather, fuelMultiplier: 1.1 },
        mode: 'HOLD_TO_BOOST',
      }),
    ).toBeCloseTo(10 * 0.075 * 1.1 * 1.2 * 1.15);

    expect(
      calculateCleanlinessLoss({
        distanceKm: 10,
        vehicle,
        segment: { ...segment, cleanlinessMultiplier: 1.08 },
        weather: { ...weather, cleanlinessMultiplier: 1.4 },
      }),
    ).toBeCloseTo(10 * 0.035 * 1.4 * 1.08);

    expect(
      calculateDurabilityLoss({
        distanceKm: 10,
        vehicle,
        segment: { ...segment, durabilityMultiplier: 1.25 },
        weather: { ...weather, durabilityMultiplier: 1.18 },
      }),
    ).toBeCloseTo(10 * 0.018 * 1.25 * (1 + (1.18 - 1) * (1 - 0.15)));
  });

  it('clamps progress at the next required landmark', () => {
    const landmarks: LandmarkSimulationState[] = [
      {
        landmarkId: 'first_lighthouse',
        distanceKm: 40,
        requiredStop: true,
      },
    ];

    const result = checkForForcedStop({
      currentDistanceKm: 39.9,
      proposedDistanceGainKm: 1,
      routeTotalDistanceKm: 100,
      currentFuel: 45,
      effectiveFuelPerKm: 0.075,
      landmarks,
    });

    expect(result.distanceGainKm).toBeCloseTo(0.1);
    expect(result.finalDistanceKm).toBeCloseTo(40);
    expect(result.forcedStopReason).toBe('LANDMARK_REQUIRED');
    expect(result.landmarkId).toBe('first_lighthouse');
  });

  it('clamps progress at route end', () => {
    const result = checkForForcedStop({
      currentDistanceKm: 99.5,
      proposedDistanceGainKm: 2,
      routeTotalDistanceKm: 100,
      currentFuel: 45,
      effectiveFuelPerKm: 0.075,
      landmarks: [],
    });

    expect(result.distanceGainKm).toBeCloseTo(0.5);
    expect(result.finalDistanceKm).toBeCloseTo(100);
    expect(result.forcedStopReason).toBe('ROUTE_END');
  });

  it('clamps progress by fuel-limited distance', () => {
    const result = checkForForcedStop({
      currentDistanceKm: 10,
      proposedDistanceGainKm: 10,
      routeTotalDistanceKm: 100,
      currentFuel: 1,
      effectiveFuelPerKm: 0.5,
      landmarks: [],
    });

    expect(result.distanceGainKm).toBeCloseTo(2);
    expect(result.finalDistanceKm).toBeCloseTo(12);
    expect(result.forcedStopReason).toBe('LOW_FUEL');
  });

  it('clamps offline speed at the base offline speed before multipliers', () => {
    const speed = calculateOfflineSpeed({
      vehicle,
      segment,
      weather,
    });

    expect(speed).toBe(DEFAULT_SIMULATION_CONFIG.offline.baseOfflineSpeedKmph);
  });

  it('calculates online rewards with token meter rollover', () => {
    const rewards = calculateOnlineRewards({
      distanceKm: 12.5,
      routeRewardMultiplier: 1,
      previousTokenMeterKm: 0,
    });

    expect(rewards.roadCoins).toBe(125);
    expect(rewards.travelTokens).toBe(1);
    expect(rewards.tokenMeterKm).toBeCloseTo(2.5);
  });

  it('calculates offline pending rewards with token meter rollover', () => {
    const rewards = calculateOfflinePendingRewards({
      distanceKm: 45,
      routeRewardMultiplier: 1,
      previousTokenMeterKm: 0,
    });

    expect(rewards.roadCoins).toBe(180);
    expect(rewards.travelTokens).toBe(2);
    expect(rewards.tokenMeterKm).toBeCloseTo(5);
  });
});
