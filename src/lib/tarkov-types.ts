export interface TraderOffer {
  trader: string;
  price: number;
  priceRUB: number;
  currency: string;
}

export interface TarkovItem {
  id: string;
  name: string;
  shortName: string;
  normalizedName: string;
  avg24hPrice?: number | null;
  lastLowPrice?: number | null;
  low24hPrice?: number | null;
  high24hPrice?: number | null;
  changeLast48h?: number | null;
  changeLast48hPercent?: number | null;
  sellToTrader: TraderOffer[];
}

export interface TarkovTrader {
  id: string;
  name: string;
  normalizedName: string;
}

export interface ItemRequirement {
  item: string;
  count: number;
  attributes: { foundInRaid?: boolean; tool?: boolean };
}

export interface HideoutLevel {
  id: string;
  level: number;
  constructionTime: number;
  itemRequirements: ItemRequirement[];
}

export interface HideoutStation {
  id: string;
  name: string;
  normalizedName: string;
  levels: HideoutLevel[];
}

export interface Craft {
  id: string;
  station: string;
  level: number;
  duration: number;
  requiredItems: ItemRequirement[];
  productItem: ItemRequirement;
}

export interface TaskObjective {
  id: string;
  type: string;
  description: string;
  optional: boolean;
  count?: number;
  items?: string[];
  questItem?: string;
  maps?: string[];
  requiredKeys?: string[][];
  foundInRaid?: boolean;
}

export interface Task {
  id: string;
  name: string;
  trader: string;
  minPlayerLevel: number | null;
  objectives: TaskObjective[];
}

export interface BossSpawn {
  spawnChance: number;
  mob: string;
}

export interface TarkovMap {
  id: string;
  name: string;
  normalizedName: string;
  bosses: BossSpawn[];
}

export interface Mob {
  id: string;
  name: string;
  normalizedName: string;
}

export interface QuestItem {
  id: string;
  name: string;
}
