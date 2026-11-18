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
