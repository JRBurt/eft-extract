import type { Craft, HideoutStation, TarkovItem, TarkovTrader } from "./tarkov-types.js";

const JSON_API_URL = "https://json.tarkov.dev";
const GAME_MODE = "pve";

interface JsonApiEnvelope<T> {
  data: T;
}

type LocaleMap = Record<string, string>;

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${JSON_API_URL}/${path}`, {
    headers: { "User-Agent": "eft-extract-discord-bot" },
  });

  if (!response.ok) {
    throw new Error(`json.tarkov.dev returned ${response.status} for /${path}`);
  }

  return (await response.json()) as T;
}

function applyTranslations<T>(
  records: Record<string, T>,
  locale: LocaleMap,
  fields: (keyof T)[],
): void {
  for (const record of Object.values(records)) {
    const fieldRecord = record as Record<string, unknown>;
    for (const field of fields) {
      const stub = fieldRecord[field as string];
      if (typeof stub === "string" && stub in locale) {
        fieldRecord[field as string] = locale[stub];
      }
    }
  }
}

async function fetchTranslatedResource<T>(
  path: string,
  fields: (keyof T)[],
  extractRecords: (data: unknown) => Record<string, T>,
): Promise<Record<string, T>> {
  const [base, locale] = await Promise.all([
    fetchJson<JsonApiEnvelope<unknown>>(path),
    fetchJson<JsonApiEnvelope<LocaleMap>>(`${path}_en`),
  ]);
  const records = extractRecords(base.data);
  applyTranslations(records, locale.data, fields);
  return records;
}

let itemsCache: Promise<Record<string, TarkovItem>> | null = null;
let tradersCache: Promise<Record<string, TarkovTrader>> | null = null;
let hideoutCache: Promise<Record<string, HideoutStation>> | null = null;
let craftsCache: Promise<Craft[]> | null = null;

function loadItems(): Promise<Record<string, TarkovItem>> {
  // The items resource bundles several related collections (items, fleaMarket,
  // armorMaterial, etc.) under one payload; the actual items live at data.items.
  itemsCache ??= fetchTranslatedResource<TarkovItem>(
    `${GAME_MODE}/items`,
    ["name", "shortName"],
    (data) => (data as { items: Record<string, TarkovItem> }).items,
  );
  return itemsCache;
}

function loadTraders(): Promise<Record<string, TarkovTrader>> {
  tradersCache ??= fetchTranslatedResource<TarkovTrader>(
    `${GAME_MODE}/traders`,
    ["name"],
    (data) => data as Record<string, TarkovTrader>,
  );
  return tradersCache;
}

function loadHideoutStations(): Promise<Record<string, HideoutStation>> {
  hideoutCache ??= fetchTranslatedResource<HideoutStation>(
    `${GAME_MODE}/hideout`,
    ["name"],
    (data) => data as Record<string, HideoutStation>,
  );
  return hideoutCache;
}

function loadCrafts(): Promise<Craft[]> {
  craftsCache ??= fetchJson<JsonApiEnvelope<Craft[]>>(`${GAME_MODE}/crafts`).then(
    (envelope) => envelope.data,
  );
  return craftsCache;
}

export async function findItemsByName(query: string): Promise<TarkovItem[]> {
  const items = await loadItems();
  const lowerQuery = query.toLowerCase();
  return Object.values(items).filter(
    (item) =>
      item.name.toLowerCase().includes(lowerQuery) ||
      item.shortName.toLowerCase().includes(lowerQuery),
  );
}

export async function getTraderName(traderId: string): Promise<string> {
  const traders = await loadTraders();
  return traders[traderId]?.name ?? "Unknown trader";
}

export async function getItemName(itemId: string): Promise<string> {
  const items = await loadItems();
  return items[itemId]?.name ?? "Unknown item";
}

export async function findHideoutStationsByName(query: string): Promise<HideoutStation[]> {
  const stations = await loadHideoutStations();
  const lowerQuery = query.toLowerCase();
  return Object.values(stations).filter(
    (station) =>
      station.name.toLowerCase().includes(lowerQuery) ||
      station.normalizedName.toLowerCase().includes(lowerQuery),
  );
}

export async function findCraftsByProductName(query: string): Promise<Craft[]> {
  const [crafts, items] = await Promise.all([loadCrafts(), loadItems()]);
  const lowerQuery = query.toLowerCase();
  return crafts.filter((craft) => {
    const product = items[craft.productItem.item];
    return product && product.name.toLowerCase().includes(lowerQuery);
  });
}
