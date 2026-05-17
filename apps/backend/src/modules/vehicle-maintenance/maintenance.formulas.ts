import { DEFAULT_SIMULATION_CONFIG } from '../simulation/simulation.constants';
import type { PlayerVehicle, VehicleMaintenanceAction } from '../../database/game-data-store';

export type VehicleMaintenanceCalculation = {
  action: VehicleMaintenanceAction;
  costRoadCoins: number;
  restoredAmount: number;
  targetFuel: number;
  targetCleanliness: number;
  targetDurability: number;
};

function roundStat(value: number): number {
  return Number(value.toFixed(6));
}

export function calculateVehicleMaintenance(
  action: VehicleMaintenanceAction,
  vehicle: PlayerVehicle,
): VehicleMaintenanceCalculation {
  const config = DEFAULT_SIMULATION_CONFIG.maintenance;

  if (action === 'REFUEL') {
    const missingFuel = roundStat(vehicle.fuelCapacity - vehicle.currentFuel);
    if (missingFuel <= 0) {
      throw new Error('FULL_FUEL');
    }

    return {
      action,
      costRoadCoins: Math.ceil(missingFuel * config.fuelPricePerLiter * config.regionPriceMultiplier),
      restoredAmount: missingFuel,
      targetFuel: vehicle.fuelCapacity,
      targetCleanliness: vehicle.currentCleanliness,
      targetDurability: vehicle.currentDurability,
    };
  }

  if (action === 'CLEAN') {
    const cleanPoints = roundStat(100 - vehicle.currentCleanliness);
    if (cleanPoints <= 0) {
      throw new Error('FULL_CLEANLINESS');
    }

    return {
      action,
      costRoadCoins: Math.ceil(config.baseCleanCost + cleanPoints * config.cleanPricePerPoint * config.rarityMultiplier),
      restoredAmount: cleanPoints,
      targetFuel: vehicle.currentFuel,
      targetCleanliness: 100,
      targetDurability: vehicle.currentDurability,
    };
  }

  const repairPoints = roundStat(100 - vehicle.currentDurability);
  if (repairPoints <= 0) {
    throw new Error('FULL_DURABILITY');
  }

  return {
    action,
    costRoadCoins: Math.ceil(config.baseRepairCost + repairPoints * config.repairPricePerPoint * config.rarityMultiplier),
    restoredAmount: repairPoints,
    targetFuel: vehicle.currentFuel,
    targetCleanliness: vehicle.currentCleanliness,
    targetDurability: 100,
  };
}
