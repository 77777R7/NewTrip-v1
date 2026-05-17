import { DEFAULT_SIMULATION_CONFIG } from './simulation.constants';
import {
  calculateCleanlinessLoss,
  calculateDistanceGain,
  calculateDurabilityLoss,
  calculateFuelUsed,
  calculateOnlineRewards,
  checkForForcedStop,
} from './simulation.formulas';
import type {
  DriveMode,
  ForcedStopReason,
  LandmarkSimulationState,
  RewardCalculationResult,
  SegmentSimulationState,
  VehicleSimulationState,
  WeatherSimulationState,
} from './simulation.types';

export type OnlineDriveMode = Exclude<DriveMode, 'OFFLINE'>;

export type OnlineDriveTickInput = {
  mode: OnlineDriveMode;
  now: Date;
  lastSimulatedAt: Date;
  currentDistanceKm: number;
  elapsedRealSeconds: number;
  previousOnlineTokenMeterKm: number;
  routeTotalDistanceKm: number;
  routeRewardMultiplier: number;
  vehicle: VehicleSimulationState;
  segments: SegmentSimulationState[];
  landmarks: LandmarkSimulationState[];
  weather?: WeatherSimulationState;
  maxOnlineTickSeconds?: number;
};

export type OnlineDriveTickSimulationResult = {
  durationSeconds: number;
  rawDistanceGainKm: number;
  distanceGainKm: number;
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
  updatedOnlineTokenMeterKm: number;
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

const AUTO_CAPABLE_TUTORIAL_STATES = new Set([
  'AUTO_DRIVING_UNLOCKED',
  'FIRST_LANDMARK_REACHED',
  'PHOTO_TAKEN',
  'ROUTE_COMPLETED',
  'FULL_SYSTEM_UNLOCKED',
]);

function round(value: number): number {
  return Number(value.toFixed(6));
}

function clampStat(value: number): number {
  return round(Math.min(100, Math.max(0, value)));
}

function elapsedSeconds(now: Date, lastSimulatedAt: Date, maxOnlineTickSeconds: number): number {
  const rawSeconds = Math.floor((now.getTime() - lastSimulatedAt.getTime()) / 1000);
  return Math.min(maxOnlineTickSeconds, Math.max(0, rawSeconds));
}

export function selectSegmentForDistance(
  segments: SegmentSimulationState[],
  currentDistanceKm: number,
): SegmentSimulationState {
  const segment = segments.find(
    (candidate) => currentDistanceKm >= candidate.startKm && currentDistanceKm < candidate.endKm,
  );

  if (segment) {
    return segment;
  }

  const sorted = [...segments].sort((a, b) => a.startKm - b.startKm);
  return sorted[sorted.length - 1] ?? {
    startKm: 0,
    endKm: Number.POSITIVE_INFINITY,
    speedMultiplier: 1,
    fuelMultiplier: 1,
    cleanlinessMultiplier: 1,
    durabilityMultiplier: 1,
  };
}

export function isOnlineDriveModeUnlocked(tutorialState: string, mode: OnlineDriveMode): boolean {
  return mode === 'HOLD_TO_DRIVE' || AUTO_CAPABLE_TUTORIAL_STATES.has(tutorialState);
}

export function simulateOnlineDriveTick(input: OnlineDriveTickInput): OnlineDriveTickSimulationResult {
  const config = DEFAULT_SIMULATION_CONFIG;
  const maxOnlineTickSeconds = input.maxOnlineTickSeconds ?? config.online.maxOnlineTickSeconds;
  const durationSeconds = elapsedSeconds(input.now, input.lastSimulatedAt, maxOnlineTickSeconds);
  const segment = selectSegmentForDistance(input.segments, input.currentDistanceKm);
  const weather = input.weather ?? CLEAR_WEATHER;

  const rawDistanceGainKm = calculateDistanceGain({
    vehicle: input.vehicle,
    segment,
    weather,
    mode: input.mode,
    durationSeconds,
  });
  const effectiveFuelPerKm = calculateFuelUsed({
    distanceKm: 1,
    vehicle: input.vehicle,
    segment,
    weather,
    mode: input.mode,
  });
  const forcedStop = checkForForcedStop({
    currentDistanceKm: input.currentDistanceKm,
    proposedDistanceGainKm: rawDistanceGainKm,
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
    mode: input.mode,
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
  const rewards = calculateOnlineRewards({
    distanceKm: forcedStop.distanceGainKm,
    routeRewardMultiplier: input.routeRewardMultiplier,
    previousTokenMeterKm: input.previousOnlineTokenMeterKm,
  });

  return {
    durationSeconds,
    rawDistanceGainKm,
    distanceGainKm: forcedStop.distanceGainKm,
    finalDistanceKm: forcedStop.finalDistanceKm,
    forcedStopReason: forcedStop.forcedStopReason,
    ...(forcedStop.landmarkId ? { landmarkId: forcedStop.landmarkId } : {}),
    fuelUsed,
    cleanlinessLoss,
    durabilityLoss,
    updatedFuel: clampStat(input.vehicle.currentFuel - fuelUsed),
    updatedCleanliness: clampStat(input.vehicle.currentCleanliness - cleanlinessLoss),
    updatedDurability: clampStat(input.vehicle.currentDurability - durabilityLoss),
    updatedElapsedRealSeconds: input.elapsedRealSeconds + durationSeconds,
    updatedOnlineTokenMeterKm: rewards.tokenMeterKm,
    updatedTripStatus: forcedStop.forcedStopReason ? 'FORCED_STOP' : 'ACTIVE',
    rewards,
  };
}
