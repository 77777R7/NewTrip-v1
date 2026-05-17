import { simulateOnlineDriveTick } from './online-drive-tick';
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
  endKm: 100,
  speedMultiplier: 1,
  fuelMultiplier: 1,
  cleanlinessMultiplier: 1,
  durabilityMultiplier: 1,
};

describe('online drive tick simulation', () => {
  it('clamps a tick at route end', () => {
    const result = simulateOnlineDriveTick({
      mode: 'HOLD_TO_DRIVE',
      now: new Date('2026-05-16T00:01:40.000Z'),
      lastSimulatedAt: new Date('2026-05-16T00:00:00.000Z'),
      currentDistanceKm: 99.5,
      elapsedRealSeconds: 0,
      previousOnlineTokenMeterKm: 0,
      routeTotalDistanceKm: 100,
      routeRewardMultiplier: 1,
      vehicle,
      segments: [segment],
      landmarks: [],
      maxOnlineTickSeconds: 100,
    });

    expect(result.distanceGainKm).toBe(0.5);
    expect(result.finalDistanceKm).toBe(100);
    expect(result.forcedStopReason).toBe('ROUTE_END');
    expect(result.updatedTripStatus).toBe('FORCED_STOP');
  });

  it('clamps a tick by fuel-limited distance', () => {
    const result = simulateOnlineDriveTick({
      mode: 'HOLD_TO_DRIVE',
      now: new Date('2026-05-16T00:00:15.000Z'),
      lastSimulatedAt: new Date('2026-05-16T00:00:00.000Z'),
      currentDistanceKm: 10,
      elapsedRealSeconds: 0,
      previousOnlineTokenMeterKm: 0,
      routeTotalDistanceKm: 100,
      routeRewardMultiplier: 1,
      vehicle: {
        ...vehicle,
        currentFuel: 0.01,
      },
      segments: [segment],
      landmarks: [],
    });

    expect(result.distanceGainKm).toBeCloseTo(0.133333);
    expect(result.finalDistanceKm).toBeCloseTo(10.133333);
    expect(result.forcedStopReason).toBe('LOW_FUEL');
    expect(result.updatedFuel).toBe(0);
    expect(result.updatedTripStatus).toBe('FORCED_STOP');
  });

  it('does not advance when fuel is already empty', () => {
    const result = simulateOnlineDriveTick({
      mode: 'HOLD_TO_DRIVE',
      now: new Date('2026-05-16T00:00:15.000Z'),
      lastSimulatedAt: new Date('2026-05-16T00:00:00.000Z'),
      currentDistanceKm: 10,
      elapsedRealSeconds: 0,
      previousOnlineTokenMeterKm: 0,
      routeTotalDistanceKm: 100,
      routeRewardMultiplier: 1,
      vehicle: {
        ...vehicle,
        currentFuel: 0,
      },
      segments: [segment],
      landmarks: [],
    });

    expect(result.distanceGainKm).toBe(0);
    expect(result.finalDistanceKm).toBe(10);
    expect(result.forcedStopReason).toBe('LOW_FUEL');
    expect(result.updatedTripStatus).toBe('FORCED_STOP');
  });
});
