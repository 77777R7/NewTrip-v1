import { simulateOfflineProgress } from './offline-progress';
import type { SegmentSimulationState, VehicleSimulationState } from './simulation.types';

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
  endKm: 1000,
  speedMultiplier: 1,
  fuelMultiplier: 1,
  cleanlinessMultiplier: 1,
  durabilityMultiplier: 1,
};

describe('offline progress simulation', () => {
  it('caps offline seconds at 8 hours', () => {
    const result = simulateOfflineProgress({
      now: new Date('2026-05-17T12:00:00.000Z'),
      lastSeenAt: new Date('2026-05-17T00:00:00.000Z'),
      lastSimulatedAt: new Date('2026-05-17T00:00:00.000Z'),
      currentDistanceKm: 0,
      elapsedRealSeconds: 0,
      previousOfflineTokenMeterKm: 0,
      routeTotalDistanceKm: 1000,
      routeRewardMultiplier: 1,
      vehicle,
      segments: [segment],
      landmarks: [],
    });

    expect(result.offlineSeconds).toBe(8 * 3600);
    expect(result.distanceTravelledKm).toBe(240);
    expect(result.rewards.roadCoins).toBe(960);
    expect(result.rewards.travelTokens).toBe(12);
  });

  it('stops at a required landmark before route end', () => {
    const result = simulateOfflineProgress({
      now: new Date('2026-05-17T02:00:00.000Z'),
      lastSeenAt: new Date('2026-05-17T00:00:00.000Z'),
      lastSimulatedAt: new Date('2026-05-17T00:00:00.000Z'),
      currentDistanceKm: 0,
      elapsedRealSeconds: 0,
      previousOfflineTokenMeterKm: 0,
      routeTotalDistanceKm: 100,
      routeRewardMultiplier: 1,
      vehicle,
      segments: [segment],
      landmarks: [
        {
          landmarkId: 'first_lighthouse',
          distanceKm: 40,
          requiredStop: true,
        },
      ],
    });

    expect(result.offlineSeconds).toBe(7200);
    expect(result.distanceTravelledKm).toBe(40);
    expect(result.finalDistanceKm).toBe(40);
    expect(result.forcedStopReason).toBe('LANDMARK_REQUIRED');
    expect(result.landmarkId).toBe('first_lighthouse');
  });

  it('stops at route end when no landmark comes first', () => {
    const result = simulateOfflineProgress({
      now: new Date('2026-05-17T02:00:00.000Z'),
      lastSeenAt: new Date('2026-05-17T00:00:00.000Z'),
      lastSimulatedAt: new Date('2026-05-17T00:00:00.000Z'),
      currentDistanceKm: 95,
      elapsedRealSeconds: 0,
      previousOfflineTokenMeterKm: 0,
      routeTotalDistanceKm: 100,
      routeRewardMultiplier: 1,
      vehicle,
      segments: [segment],
      landmarks: [],
    });

    expect(result.distanceTravelledKm).toBe(5);
    expect(result.finalDistanceKm).toBe(100);
    expect(result.forcedStopReason).toBe('ROUTE_END');
  });

  it('stops at low fuel before raw offline distance', () => {
    const result = simulateOfflineProgress({
      now: new Date('2026-05-17T02:00:00.000Z'),
      lastSeenAt: new Date('2026-05-17T00:00:00.000Z'),
      lastSimulatedAt: new Date('2026-05-17T00:00:00.000Z'),
      currentDistanceKm: 0,
      elapsedRealSeconds: 0,
      previousOfflineTokenMeterKm: 0,
      routeTotalDistanceKm: 1000,
      routeRewardMultiplier: 1,
      vehicle: {
        ...vehicle,
        currentFuel: 0.675,
      },
      segments: [segment],
      landmarks: [],
    });

    expect(result.distanceTravelledKm).toBe(10);
    expect(result.finalDistanceKm).toBe(10);
    expect(result.forcedStopReason).toBe('LOW_FUEL');
    expect(result.updatedFuel).toBe(0);
  });
});
