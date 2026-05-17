import { DEFAULT_SIMULATION_CONFIG } from './simulation.constants';
import {
  calculateCleanlinessLoss,
  calculateDurabilityLoss,
  calculateFuelUsed,
  calculateOfflinePendingRewards,
  calculateOfflineSpeed,
  checkForForcedStop,
} from './simulation.formulas';
import type {
  ForcedStopReason,
  LandmarkSimulationState,
  RewardCalculationResult,
  SegmentSimulationState,
  VehicleSimulationState,
  WeatherSimulationState,
} from './simulation.types';
import { selectSegmentForDistance } from './online-drive-tick';

export type OfflineProgressInput = {
  now: Date;
  lastSeenAt: Date;
  lastSimulatedAt: Date;
  currentDistanceKm: number;
  elapsedRealSeconds: number;
  previousOfflineTokenMeterKm: number;
  routeTotalDistanceKm: number;
  routeRewardMultiplier: number;
  vehicle: VehicleSimulationState;
  segments: SegmentSimulationState[];
  landmarks: LandmarkSimulationState[];
  weather?: WeatherSimulationState;
  maxOfflineHours?: number;
};

export type OfflineProgressResult = {
  offlineSeconds: number;
  rawDistanceKm: number;
  distanceTravelledKm: number;
  finalDistanceKm: number;
  forcedStopReason: ForcedStopReason;
  landmarkId?: string;
  fuelUsed: number;
  cleanlinessLoss: number;
  durabilityLoss: number;
  updatedFuel: number;
  updatedCleanliness: number;
  updatedDurability: number;
  updatedElapsedRealSeconds: number;
  updatedOfflineTokenMeterKm: number;
  updatedTripStatus: 'ACTIVE' | 'FORCED_STOP';
  rewards: RewardCalculationResult;
};

const CLEAR_WEATHER: WeatherSimulationState = {
  speedMultiplier: 1,
  fuelMultiplier: 1,
  cleanlinessMultiplier: 1,
  durabilityMultiplier: 1,
  photoMultiplier: 1,
};

function round(value: number): number {
  return Number(value.toFixed(6));
}

function clampStat(value: number): number {
  return round(Math.min(100, Math.max(0, value)));
}

function calculateOfflineSeconds(input: {
  now: Date;
  lastSeenAt: Date;
  lastSimulatedAt: Date;
  maxOfflineHours: number;
}): number {
  const offlineStartsAt = Math.max(input.lastSeenAt.getTime(), input.lastSimulatedAt.getTime());
  const rawSeconds = Math.floor((input.now.getTime() - offlineStartsAt) / 1000);
  return Math.min(input.maxOfflineHours * 3600, Math.max(0, rawSeconds));
}

export function simulateOfflineProgress(input: OfflineProgressInput): OfflineProgressResult {
  const config = DEFAULT_SIMULATION_CONFIG;
  const weather = input.weather ?? CLEAR_WEATHER;
  const segment = selectSegmentForDistance(input.segments, input.currentDistanceKm);
  const offlineSeconds = calculateOfflineSeconds({
    now: input.now,
    lastSeenAt: input.lastSeenAt,
    lastSimulatedAt: input.lastSimulatedAt,
    maxOfflineHours: input.maxOfflineHours ?? config.offline.maxOfflineHours,
  });
  const offlineSpeedKmph = calculateOfflineSpeed({
    vehicle: input.vehicle,
    segment,
    weather,
  });
  const rawDistanceKm = round(offlineSpeedKmph * (offlineSeconds / 3600));
  const effectiveFuelPerKm = calculateFuelUsed({
    distanceKm: 1,
    vehicle: input.vehicle,
    segment,
    weather,
    mode: 'OFFLINE',
  });
  const forcedStop = checkForForcedStop({
    currentDistanceKm: input.currentDistanceKm,
    proposedDistanceGainKm: rawDistanceKm,
    routeTotalDistanceKm: input.routeTotalDistanceKm,
    currentFuel: input.vehicle.currentFuel,
    effectiveFuelPerKm,
    landmarks: input.landmarks,
  });
  const fuelUsed = calculateFuelUsed({
    distanceKm: forcedStop.distanceGainKm,
    vehicle: input.vehicle,
    segment,
    weather,
    mode: 'OFFLINE',
  });
  const cleanlinessLoss = calculateCleanlinessLoss({
    distanceKm: forcedStop.distanceGainKm,
    vehicle: input.vehicle,
    segment,
    weather,
  });
  const durabilityLoss = calculateDurabilityLoss({
    distanceKm: forcedStop.distanceGainKm,
    vehicle: input.vehicle,
    segment,
    weather,
  });
  const rewards = calculateOfflinePendingRewards({
    distanceKm: forcedStop.distanceGainKm,
    routeRewardMultiplier: input.routeRewardMultiplier,
    previousTokenMeterKm: input.previousOfflineTokenMeterKm,
  });

  return {
    offlineSeconds,
    rawDistanceKm,
    distanceTravelledKm: forcedStop.distanceGainKm,
    finalDistanceKm: forcedStop.finalDistanceKm,
    forcedStopReason: forcedStop.forcedStopReason,
    ...(forcedStop.landmarkId ? { landmarkId: forcedStop.landmarkId } : {}),
    fuelUsed,
    cleanlinessLoss,
    durabilityLoss,
    updatedFuel: clampStat(input.vehicle.currentFuel - fuelUsed),
    updatedCleanliness: clampStat(input.vehicle.currentCleanliness - cleanlinessLoss),
    updatedDurability: clampStat(input.vehicle.currentDurability - durabilityLoss),
    updatedElapsedRealSeconds: input.elapsedRealSeconds + offlineSeconds,
    updatedOfflineTokenMeterKm: rewards.tokenMeterKm,
    updatedTripStatus: forcedStop.forcedStopReason ? 'FORCED_STOP' : 'ACTIVE',
    rewards,
  };
}

export const simulate_offline_progress = simulateOfflineProgress;
