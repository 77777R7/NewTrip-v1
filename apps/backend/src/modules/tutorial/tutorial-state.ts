import type { DriveMode, ForcedStopReason } from '../simulation/simulation.types';

export const TUTORIAL_AUTO_UNLOCK_DISTANCE_KM = 1;

const PHOTO_OR_LATER_STATES = new Set(['PHOTO_TAKEN', 'ROUTE_COMPLETED', 'FULL_SYSTEM_UNLOCKED']);

export function nextTutorialStateAfterDriveTick(input: {
  currentState: string;
  mode: Exclude<DriveMode, 'OFFLINE'>;
  distanceGainKm: number;
  finalDistanceKm: number;
  forcedStopReason: ForcedStopReason;
}): string {
  if (input.forcedStopReason === 'LANDMARK_REQUIRED' && !PHOTO_OR_LATER_STATES.has(input.currentState)) {
    return 'FIRST_LANDMARK_REACHED';
  }

  if (input.currentState === 'ROUTE_SELECTED' && input.mode === 'HOLD_TO_DRIVE' && input.distanceGainKm > 0) {
    return 'HOLD_TO_DRIVE_REQUIRED';
  }

  if (
    input.currentState === 'HOLD_TO_DRIVE_REQUIRED' &&
    input.mode === 'HOLD_TO_DRIVE' &&
    input.finalDistanceKm >= TUTORIAL_AUTO_UNLOCK_DISTANCE_KM
  ) {
    return 'AUTO_DRIVING_UNLOCKED';
  }

  return input.currentState;
}

export function nextTutorialStateAfterPhoto(currentState: string): string {
  return currentState === 'FIRST_LANDMARK_REACHED' ? 'PHOTO_TAKEN' : currentState;
}
