import type { Landmark, PlayerVehicle } from '../../database/game-data-store';

const RARITY_BONUS: Record<string, number> = {
  Common: 0,
  Rare: 4,
  Epic: 7,
  Legendary: 10,
};

function clampQuality(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function calculatePhotoQualityScore(input: {
  vehicle: Pick<PlayerVehicle, 'currentCleanliness'>;
  landmark: Pick<Landmark, 'rarity'>;
}): number {
  return clampQuality(55 + input.vehicle.currentCleanliness * 0.35 + (RARITY_BONUS[input.landmark.rarity] ?? 0));
}
