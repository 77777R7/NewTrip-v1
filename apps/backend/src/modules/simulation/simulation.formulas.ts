import { DEFAULT_SIMULATION_CONFIG } from './simulation.constants';
import type {
  DriveMode,
  ForcedStopReason,
  ForcedStopResult,
  LandmarkSimulationState,
  RewardCalculationResult,
  SegmentSimulationState,
  VehicleSimulationState,
  WeatherSimulationState,
} from './simulation.types';

type SimulationConfig = typeof DEFAULT_SIMULATION_CONFIG;

type DistanceGainInput = {
  vehicle: VehicleSimulationState;
  segment: Pick<SegmentSimulationState, 'speedMultiplier'>;
  weather: Pick<WeatherSimulationState, 'speedMultiplier'>;
  mode: DriveMode;
  durationSeconds: number;
  durabilitySpeedMultiplier?: number;
  fuelStateMultiplier?: number;
  config?: SimulationConfig;
};

type FuelUsedInput = {
  distanceKm: number;
  vehicle: Pick<VehicleSimulationState, 'fuelConsumptionPerKm'>;
  segment: Pick<SegmentSimulationState, 'fuelMultiplier'>;
  weather: Pick<WeatherSimulationState, 'fuelMultiplier'>;
  mode: DriveMode;
  durabilityFuelPenalty?: number;
  config?: SimulationConfig;
};

type CleanlinessLossInput = {
  distanceKm: number;
  vehicle: Pick<VehicleSimulationState, 'cleanlinessLossPerKm'>;
  segment: Pick<SegmentSimulationState, 'cleanlinessMultiplier'>;
  weather: Pick<WeatherSimulationState, 'cleanlinessMultiplier'>;
};

type DurabilityLossInput = {
  distanceKm: number;
  vehicle: Pick<VehicleSimulationState, 'durabilityLossPerKm' | 'weatherResistance'>;
  segment: Pick<SegmentSimulationState, 'durabilityMultiplier'>;
  weather: Pick<WeatherSimulationState, 'durabilityMultiplier'>;
};

type OfflineSpeedInput = {
  vehicle: Pick<VehicleSimulationState, 'baseSpeedKmph' | 'offlineEfficiency'>;
  segment: Pick<SegmentSimulationState, 'speedMultiplier'>;
  weather: Pick<WeatherSimulationState, 'speedMultiplier'>;
  durabilityOfflineMultiplier?: number;
  config?: SimulationConfig;
};

type ForcedStopInput = {
  currentDistanceKm: number;
  proposedDistanceGainKm: number;
  routeTotalDistanceKm: number;
  currentFuel: number;
  effectiveFuelPerKm: number;
  landmarks: LandmarkSimulationState[];
};

type RewardInput = {
  distanceKm: number;
  routeRewardMultiplier: number;
  previousTokenMeterKm?: number;
  activeEventMultiplier?: number;
  config?: SimulationConfig;
};

function roundDistance(value: number): number {
  return Number(value.toFixed(6));
}

function positiveOrZero(value: number): number {
  return Math.max(0, value);
}

export function calculateDistanceGain(input: DistanceGainInput): number {
  const config = input.config ?? DEFAULT_SIMULATION_CONFIG;
  const modeMultiplier = config.modeMultipliers[input.mode];
  const conditionMultiplier =
    (input.durabilitySpeedMultiplier ?? 1) *
    input.weather.speedMultiplier *
    (input.fuelStateMultiplier ?? 1);

  return roundDistance(
    input.vehicle.baseSpeedKmph *
      (positiveOrZero(input.durationSeconds) / 3600) *
      modeMultiplier *
      conditionMultiplier *
      input.segment.speedMultiplier,
  );
}

export function calculateFuelUsed(input: FuelUsedInput): number {
  const config = input.config ?? DEFAULT_SIMULATION_CONFIG;
  return roundDistance(
    positiveOrZero(input.distanceKm) *
      input.vehicle.fuelConsumptionPerKm *
      input.weather.fuelMultiplier *
      input.segment.fuelMultiplier *
      (input.durabilityFuelPenalty ?? 1) *
      config.modeFuelMultipliers[input.mode],
  );
}

export function calculateCleanlinessLoss(input: CleanlinessLossInput): number {
  return roundDistance(
    positiveOrZero(input.distanceKm) *
      input.vehicle.cleanlinessLossPerKm *
      input.weather.cleanlinessMultiplier *
      input.segment.cleanlinessMultiplier,
  );
}

export function calculateDurabilityLoss(input: DurabilityLossInput): number {
  const adjustedWeatherDurabilityMultiplier =
    1 + (input.weather.durabilityMultiplier - 1) * (1 - input.vehicle.weatherResistance);

  return roundDistance(
    positiveOrZero(input.distanceKm) *
      input.vehicle.durabilityLossPerKm *
      input.segment.durabilityMultiplier *
      adjustedWeatherDurabilityMultiplier,
  );
}

export function calculateOfflineSpeed(input: OfflineSpeedInput): number {
  const config = input.config ?? DEFAULT_SIMULATION_CONFIG;
  const vehicleOfflineSpeed = input.vehicle.baseSpeedKmph * input.vehicle.offlineEfficiency;
  const baseSpeed = Math.min(config.offline.baseOfflineSpeedKmph, vehicleOfflineSpeed);

  return roundDistance(
    baseSpeed *
      (input.durabilityOfflineMultiplier ?? 1) *
      input.weather.speedMultiplier *
      input.segment.speedMultiplier,
  );
}

function nextRequiredLandmarkDistance(
  currentDistanceKm: number,
  proposedFinalDistanceKm: number,
  landmarks: LandmarkSimulationState[],
): { distanceKm: number; landmarkId: string } | null {
  return (
    landmarks
      .filter((landmark) => landmark.requiredStop && !landmark.completed)
      .filter((landmark) => landmark.distanceKm > currentDistanceKm && landmark.distanceKm <= proposedFinalDistanceKm)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .map((landmark) => ({
        distanceKm: landmark.distanceKm,
        landmarkId: landmark.landmarkId,
      }))[0] ?? null
  );
}

export function checkForForcedStop(input: ForcedStopInput): ForcedStopResult {
  const currentDistanceKm = positiveOrZero(input.currentDistanceKm);
  const proposedDistanceGainKm = positiveOrZero(input.proposedDistanceGainKm);
  const routeTotalDistanceKm = positiveOrZero(input.routeTotalDistanceKm);
  const proposedFinalDistanceKm = currentDistanceKm + proposedDistanceGainKm;

  const candidates: Array<{
    distanceGainKm: number;
    reason: ForcedStopReason;
    priority: number;
    landmarkId?: string;
  }> = [
    {
      distanceGainKm: proposedDistanceGainKm,
      reason: null,
      priority: 99,
    },
  ];

  if (routeTotalDistanceKm <= currentDistanceKm) {
    candidates.push({ distanceGainKm: 0, reason: 'ROUTE_END', priority: 1 });
  } else if (proposedFinalDistanceKm >= routeTotalDistanceKm) {
    candidates.push({
      distanceGainKm: routeTotalDistanceKm - currentDistanceKm,
      reason: 'ROUTE_END',
      priority: 1,
    });
  }

  if (input.currentFuel <= 0) {
    candidates.push({ distanceGainKm: 0, reason: 'LOW_FUEL', priority: 2 });
  } else if (input.effectiveFuelPerKm > 0) {
    const fuelLimitedDistanceKm = input.currentFuel / input.effectiveFuelPerKm;
    if (fuelLimitedDistanceKm < proposedDistanceGainKm) {
      candidates.push({
        distanceGainKm: fuelLimitedDistanceKm,
        reason: 'LOW_FUEL',
        priority: 2,
      });
    }
  }

  const landmarkStop = nextRequiredLandmarkDistance(currentDistanceKm, proposedFinalDistanceKm, input.landmarks);
  if (landmarkStop) {
    candidates.push({
      distanceGainKm: landmarkStop.distanceKm - currentDistanceKm,
      reason: 'LANDMARK_REQUIRED',
      priority: 0,
      landmarkId: landmarkStop.landmarkId,
    });
  }

  const selected = candidates
    .map((candidate) => ({
      ...candidate,
      distanceGainKm: roundDistance(candidate.distanceGainKm),
    }))
    .sort((a, b) => a.distanceGainKm - b.distanceGainKm || a.priority - b.priority)[0];

  return {
    distanceGainKm: selected.distanceGainKm,
    finalDistanceKm: roundDistance(currentDistanceKm + selected.distanceGainKm),
    forcedStopReason: selected.reason,
    ...(selected.landmarkId ? { landmarkId: selected.landmarkId } : {}),
  };
}

function calculateRewards(
  input: RewardInput,
  coinPerKm: number,
  kmPerToken: number,
  includeEventMultiplier: boolean,
): RewardCalculationResult {
  const totalMeterKm = positiveOrZero(input.previousTokenMeterKm ?? 0) + positiveOrZero(input.distanceKm);
  const activeEventMultiplier = includeEventMultiplier ? input.activeEventMultiplier ?? 1 : 1;
  const travelTokens = Math.floor(totalMeterKm / kmPerToken);

  return {
    roadCoins: Math.floor(positiveOrZero(input.distanceKm) * coinPerKm * input.routeRewardMultiplier * activeEventMultiplier),
    travelTokens,
    tokenMeterKm: roundDistance(totalMeterKm - travelTokens * kmPerToken),
  };
}

export function calculateOnlineRewards(input: RewardInput): RewardCalculationResult {
  const config = input.config ?? DEFAULT_SIMULATION_CONFIG;
  return calculateRewards(input, config.economy.onlineCoinPerKm, config.economy.onlineKmPerToken, true);
}

export function calculateOfflinePendingRewards(input: RewardInput): RewardCalculationResult {
  const config = input.config ?? DEFAULT_SIMULATION_CONFIG;
  return calculateRewards(input, config.economy.offlineCoinPerKm, config.economy.offlineKmPerToken, false);
}

export const calculate_distance_gain = calculateDistanceGain;
export const calculate_fuel_used = calculateFuelUsed;
export const calculate_cleanliness_loss = calculateCleanlinessLoss;
export const calculate_durability_loss = calculateDurabilityLoss;
export const calculate_offline_speed = calculateOfflineSpeed;
export const check_for_forced_stop = checkForForcedStop;
export const calculate_online_rewards = calculateOnlineRewards;
export const calculate_offline_pending_rewards = calculateOfflinePendingRewards;
