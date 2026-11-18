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
