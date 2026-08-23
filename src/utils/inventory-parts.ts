/**
 * Pure business logic for Inventory Parts management in TechRepair Master.
 *
 * This module is intentionally free of React / React Native imports so it can
 * be unit-tested directly with `node --test`.
 */

export interface InventoryItemLike {
  id: string;
  name: string;
  category: string;
  stock: number;
  price: number;
}

/**
 * Checks if an inventory item has sufficient stock for the requested quantity.
 */
export function hasAvailableStock(stock: number, quantityRequested: number): boolean {
  if (!Number.isFinite(stock) || !Number.isFinite(quantityRequested)) return false;
  if (quantityRequested <= 0) return false;
  return stock >= quantityRequested;
}

/**
 * Calculates stock remaining after deducting a quantity (never below 0).
 */
export function calculateRemainingStock(currentStock: number, quantityToDeduct: number): number {
  const safeStock = Number.isFinite(currentStock) ? Math.max(0, currentStock) : 0;
  const safeDeduct = Number.isFinite(quantityToDeduct) ? Math.max(0, quantityToDeduct) : 0;
  return Math.max(0, safeStock - safeDeduct);
}

/**
 * Calculates restored stock when a part is unlinked, replaced, or a job cancelled.
 */
export function calculateRestoredStock(currentStock: number, quantityToRestore: number): number {
  const safeStock = Number.isFinite(currentStock) ? Math.max(0, currentStock) : 0;
  const safeRestore = Number.isFinite(quantityToRestore) ? Math.max(0, quantityToRestore) : 0;
  return safeStock + safeRestore;
}

/**
 * Calculates the total cost for the used parts (quantity * unit price).
 */
export function calculatePartsCost(
  unitPrice: number,
  quantity: number,
  customUnitPrice?: number
): number {
  const price = Number.isFinite(customUnitPrice) && (customUnitPrice ?? 0) >= 0
    ? (customUnitPrice as number)
    : (Number.isFinite(unitPrice) ? Math.max(0, unitPrice) : 0);
  const qty = Number.isFinite(quantity) ? Math.max(1, quantity) : 1;
  return Math.round(price * qty);
}

/**
 * Filters inventory parts by a search query matching name or category (case-insensitive).
 */
export function filterInventoryParts<T extends InventoryItemLike>(
  items: readonly T[],
  query: string
): T[] {
  const cleanQuery = query.trim().toLowerCase();
  if (!cleanQuery) return [...items];
  return items.filter(
    (item) =>
      item.name.toLowerCase().includes(cleanQuery) ||
      (item.category && item.category.toLowerCase().includes(cleanQuery))
  );
}
