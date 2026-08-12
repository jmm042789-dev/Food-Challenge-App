export type EquipmentInventory = {
  owned_gear: readonly string[];
  equipped_gear?: string | null;
  equipped_cosmetic?: string | null;
};

export type EquipmentStatus = "available" | "owned" | "equipped";

export function equipmentStatus(
  item: { id: string; type: string },
  inventory: EquipmentInventory,
): EquipmentStatus {
  const equippedId = item.type === "cosmetic"
    ? inventory.equipped_cosmetic
    : item.type === "gear" ? inventory.equipped_gear : null;
  if (equippedId === item.id) return "equipped";
  return inventory.owned_gear.includes(item.id) ? "owned" : "available";
}
