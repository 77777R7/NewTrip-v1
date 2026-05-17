import type { DriveMode } from './simulation.types';

export const DEFAULT_SIMULATION_CONFIG = {
  modeMultipliers: {
    HOLD_TO_DRIVE: 1.0,
    AUTO_DRIVING: 0.85,
    HOLD_TO_BOOST: 1.1,
    OFFLINE: 1.0,
  } satisfies Record<DriveMode, number>,
  modeFuelMultipliers: {
    HOLD_TO_DRIVE: 1.0,
    AUTO_DRIVING: 1.0,
    HOLD_TO_BOOST: 1.15,
    OFFLINE: 0.9,
  } satisfies Record<DriveMode, number>,
  economy: {
    onlineCoinPerKm: 10,
    offlineCoinPerKm: 4,
    onlineKmPerToken: 10,
    offlineKmPerToken: 20,
  },
  online: {
    maxOnlineTickSeconds: 15,
  },
  offline: {
    baseOfflineSpeedKmph: 30,
    maxOfflineHours: 8,
  },
} as const;
