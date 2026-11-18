import { closest } from "fastest-levenshtein";
import type {
  Craft,
  HideoutStation,
  Mob,
  QuestItem,
  Task,
  TarkovItem,
  TarkovMap,
  TarkovTrader,
} from "./tarkov-types.js";

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
let tasksBundleCache: Promise<{
  tasks: Record<string, Task>;
  questItems: Record<string, QuestItem>;
}> | null = null;
let mapsBundleCache: Promise<{
  maps: Record<string, TarkovMap>;
  mobs: Record<string, Mob>;
}> | null = null;

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

interface TasksBundle {
  tasks: Record<string, Task>;
  questItems: Record<string, QuestItem>;
}

function loadTasksBundle(): Promise<TasksBundle> {
  // Same bundling as items: tasks/questItems/achievements/prestige share one payload,
  // and questItems need their own names resolved (e.g. for findQuestItem objectives).
  tasksBundleCache ??= (async () => {
    const path = `${GAME_MODE}/tasks`;
    const [base, locale] = await Promise.all([
      fetchJson<JsonApiEnvelope<{ tasks: Record<string, Task>; questItems: Record<string, QuestItem> }>>(
        path,
      ),
      fetchJson<JsonApiEnvelope<LocaleMap>>(`${path}_en`),
    ]);
    applyTranslations(base.data.tasks, locale.data, ["name"]);
    applyTranslations(base.data.questItems, locale.data, ["name"]);
    for (const task of Object.values(base.data.tasks)) {
      applyTranslations(
        Object.fromEntries(task.objectives.map((objective) => [objective.id, objective])),
        locale.data,
        ["description"],
      );
    }
    return base.data;
  })();
  return tasksBundleCache;
}

async function loadTasks(): Promise<Record<string, Task>> {
  return (await loadTasksBundle()).tasks;
}

async function loadQuestItems(): Promise<Record<string, QuestItem>> {
  return (await loadTasksBundle()).questItems;
}

function loadMapsBundle(): Promise<{ maps: Record<string, TarkovMap>; mobs: Record<string, Mob> }> {
  // Maps and mobs (boss/enemy definitions) share one payload; bosses[].mob on a
  // map entry is a key into mobs, so both need resolving from the same locale file.
  mapsBundleCache ??= (async () => {
    const path = `${GAME_MODE}/maps`;
    const [base, locale] = await Promise.all([
      fetchJson<JsonApiEnvelope<{ maps: Record<string, TarkovMap>; mobs: Record<string, Mob> }>>(
        path,
      ),
      fetchJson<JsonApiEnvelope<LocaleMap>>(`${path}_en`),
    ]);
    applyTranslations(base.data.maps, locale.data, ["name"]);
    applyTranslations(base.data.mobs, locale.data, ["name"]);
    return base.data;
  })();
  return mapsBundleCache;
}

async function loadMaps(): Promise<Record<string, TarkovMap>> {
  return (await loadMapsBundle()).maps;
}

async function loadMobs(): Promise<Record<string, Mob>> {
  return (await loadMapsBundle()).mobs;
}

export async function getStationName(stationId: string): Promise<string> {
  const stations = await loadHideoutStations();
  return stations[stationId]?.name ?? "Unknown station";
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

export async function findTaskByFuzzyName(query: string): Promise<Task | null> {
  const tasks = await loadTasks();
  const taskList = Object.values(tasks);
  if (taskList.length === 0) return null;

  const lowerNames = taskList.map((task) => task.name.toLowerCase());
  const bestMatch = closest(query.toLowerCase(), lowerNames);
  return taskList[lowerNames.indexOf(bestMatch)] ?? null;
}

export async function getMapName(mapId: string): Promise<string> {
  const maps = await loadMaps();
  return maps[mapId]?.name ?? "Unknown map";
}

export async function getQuestItemName(questItemId: string): Promise<string> {
  const questItems = await loadQuestItems();
  return questItems[questItemId]?.name ?? "Unknown quest item";
}

export async function findMapsByName(query: string): Promise<TarkovMap[]> {
  const maps = await loadMaps();
  const lowerQuery = query.toLowerCase();
  return Object.values(maps).filter(
    (map) =>
      map.name.toLowerCase().includes(lowerQuery) ||
      map.normalizedName.toLowerCase().includes(lowerQuery),
  );
}

export async function getMobName(mobId: string): Promise<string> {
  const mobs = await loadMobs();
  return mobs[mobId]?.name ?? mobId;
}

export async function searchTaskNames(query: string, limit = 25): Promise<string[]> {
  const tasks = await loadTasks();
  const lowerQuery = query.toLowerCase();
  return Object.values(tasks)
    .filter((task) => task.name.toLowerCase().includes(lowerQuery))
    .slice(0, limit)
    .map((task) => task.name);
}
