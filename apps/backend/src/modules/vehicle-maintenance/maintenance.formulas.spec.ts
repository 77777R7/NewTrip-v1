import { calculateVehicleMaintenance } from './maintenance.formulas';
import type { PlayerVehicle } from '../../database/game-data-store';

const vehicle: PlayerVehicle = {
  playerVehicleId: 'vehicle-1',
  vehicleDefId: 'vehicle-def-1',
  vehicleKey: 'van_common_001',
  displayName: 'Starter Van',
  baseSpeedKmph: 72,
  fuelCapacity: 45,
  fuelConsumptionPerKm: 0.075,
  durabilityLossPerKm: 0.018,
  cleanlinessLossPerKm: 0.035,
  offlineEfficiency: 0.6,
  weatherResistance: 0.2,
  currentFuel: 42.3,
  currentDurability: 99.28,
  currentCleanliness: 98.6,
  selectedSkinId: null,
  upgradeLevel: 1,
  isSelected: true,
};

describe('vehicle maintenance formulas', () => {
  it('calculates default Day 9 prices from missing vehicle stats', () => {
    expect(calculateVehicleMaintenance('REFUEL', vehicle)).toEqual(
      expect.objectContaining({
        costRoadCoins: 6,
        restoredAmount: 2.7,
        targetFuel: 45,
      }),
    );
    expect(calculateVehicleMaintenance('CLEAN', vehicle)).toEqual(
      expect.objectContaining({
        costRoadCoins: 17,
        restoredAmount: 1.4,
        targetCleanliness: 100,
      }),
    );
    expect(calculateVehicleMaintenance('REPAIR', vehicle)).toEqual(
      expect.objectContaining({
        costRoadCoins: 26,
        restoredAmount: 0.72,
        targetDurability: 100,
      }),
    );
  });

  it('rejects full-stat maintenance', () => {
    const fullVehicle = {
      ...vehicle,
      currentFuel: 45,
      currentCleanliness: 100,
      currentDurability: 100,
    };

    expect(() => calculateVehicleMaintenance('REFUEL', fullVehicle)).toThrow('FULL_FUEL');
    expect(() => calculateVehicleMaintenance('CLEAN', fullVehicle)).toThrow('FULL_CLEANLINESS');
    expect(() => calculateVehicleMaintenance('REPAIR', fullVehicle)).toThrow('FULL_DURABILITY');
  });
});
