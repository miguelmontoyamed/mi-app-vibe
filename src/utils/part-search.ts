export interface PartSearchResultItem {
  id: string;
  name: string;
  category?: string;
  stock: number;
  price: number;
}

/**
 * Normaliza un texto eliminando acentos/tildes y convirtiéndolo a minúsculas
 * para búsquedas tolerantes e insensibles.
 */
export function normalizeSearchText(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Busca piezas en el inventario que coincidan con la consulta ingresada en el nombre o categoría.
 * Prioriza coincidencias por prefijo y limita los resultados para optimizar la interfaz.
 */
export function searchInventoryParts<T extends PartSearchResultItem>(
  inventory: readonly T[],
  query: string,
  limit = 8
): T[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return [];
  }

  const matches: { item: T; score: number }[] = [];

  for (const item of inventory) {
    const normName = normalizeSearchText(item.name);
    const normCat = normalizeSearchText(item.category || '');

    let score = -1;

    if (normName === normalizedQuery) {
      score = 0; // Coincidencia exacta
    } else if (normName.startsWith(normalizedQuery)) {
      score = 1; // Comienza por el nombre
    } else if (normCat.startsWith(normalizedQuery)) {
      score = 2; // Comienza por la categoría
    } else if (normName.includes(normalizedQuery)) {
      score = 3; // Contiene en el nombre
    } else if (normCat.includes(normalizedQuery)) {
      score = 4; // Contiene en la categoría
    }

    if (score >= 0) {
      matches.push({ item, score });
    }
  }

  // Ordenar por score y luego alfabéticamente por nombre
  matches.sort((a, b) => {
    if (a.score !== b.score) {
      return a.score - b.score;
    }
    return a.item.name.localeCompare(b.item.name, 'es', { sensitivity: 'base' });
  });

  return matches.slice(0, limit).map((m) => m.item);
}

/**
 * Busca una coincidencia exacta de pieza por nombre (ignorando tildes y mayúsculas).
 */
export function matchInventoryPart<T extends PartSearchResultItem>(
  inventory: readonly T[],
  name: string
): T | undefined {
  const normTarget = normalizeSearchText(name);
  if (!normTarget) return undefined;
  return inventory.find((item) => normalizeSearchText(item.name) === normTarget);
}
