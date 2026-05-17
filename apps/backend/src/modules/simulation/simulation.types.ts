export type DriveMode = 'HOLD_TO_DRIVE' | 'AUTO_DRIVING' | 'HOLD_TO_BOOST' | 'OFFLINE';

export type ForcedStopReason = 'LANDMARK_REQUIRED' | 'ROUTE_END' | 'LOW_FUEL' | null;

export type VehicleSimulationState = {
  baseSpeedKmph: number;
  currentFuel: number;
  fuelConsumptionPerKm: number;
  currentDurability: number;
  durabilityLossPerKm: number;
  currentCleanliness: number;
  cleanlinessLossPerKm: number;
  offlineEfficiency: number;
  weatherResistance: number;
};

export type SegmentSimulationState = {
  startKm: number;
  endKm: number;
  speedMultiplier: number;
  fuelMultiplier: number;
  cleanlinessMultiplier: number;
  durabilityMultiplier: number;
};

export type WeatherSimulationState = {
  speedMultiplier: number;
  fuelMultiplier: number;
  cleanlinessMultiplier: number;
  durabilityMultiplier: number;
  photoMultiplier: number;
};

export type LandmarkSimulationState = {
  landmarkId: string;
  distanceKm: number;
  requiredStop: boolean;
  completed?: boolean;
};

export type RewardCalculationResult = {
  roadCoins: number;
  travelTokens: number;
  tokenMeterKm: number;
};

export type ForcedStopResult = {
  distanceGainKm: number;
  finalDistanceKm: number;
  forcedStopReason: ForcedStopReason;
  landmarkId?: string;
};
