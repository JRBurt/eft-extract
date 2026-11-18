import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
} from "discord.js";
import { findItemsByName, getTraderName } from "../lib/tarkov-api.js";
import type { TarkovItem } from "../lib/tarkov-types.js";

export const data = new SlashCommandBuilder()
  .setName("flea")
  .setDescription("Look up flea market price info for an item")
  .addStringOption((option) =>
    option
      .setName("item")
      .setDescription("Item name")
      .setRequired(true)
      .setAutocomplete(true),
  );

function pickBestMatch(items: TarkovItem[], query: string): TarkovItem {
  const lowerQuery = query.toLowerCase();
  const exact = items.find(
    (item) =>
      item.name.toLowerCase() === lowerQuery ||
      item.shortName.toLowerCase() === lowerQuery,
  );
  return exact ?? items[0];
}

async function buildEmbed(item: TarkovItem): Promise<EmbedBuilder> {
  const bestOffer = [...item.sellToTrader].sort((a, b) => b.priceRUB - a.priceRUB)[0];

  const priceLine =
    `${formatNum(item.avg24hPrice)} avg | ` +
    `Range ${formatNum(item.low24hPrice)}-${formatNum(item.high24hPrice)} | ` +
    `Last low ${formatNum(item.lastLowPrice)} RUB`;

  const embed = new EmbedBuilder().setTitle(item.name).setDescription(priceLine).addFields({
    name: "48h change",
    value: formatChange(item.changeLast48h, item.changeLast48hPercent),
    inline: true,
  });

  if (bestOffer) {
    const traderName = await getTraderName(bestOffer.trader);
    embed.addFields({
      name: "Best trader offer",
      value: `${traderName}: ${bestOffer.price} ${bestOffer.currency}`,
      inline: true,
    });
  }

  return embed;
}

function formatNum(value: number | null | undefined): string {
  return value == null ? "N/A" : value.toLocaleString();
}

function formatChange(absolute: number | null | undefined, percent: number | null | undefined): string {
  if (absolute == null || percent == null) return "N/A";
  const sign = absolute >= 0 ? "+" : "";
  return `${sign}${absolute.toLocaleString()} (${sign}${percent.toFixed(1)}%)`;
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const query = interaction.options.getString("item", true);
  await interaction.deferReply();

  const items = await findItemsByName(query);

  if (items.length === 0) {
    await interaction.editReply(`No item found matching "${query}".`);
    return;
  }

  const match = pickBestMatch(items, query);
  await interaction.editReply({ embeds: [await buildEmbed(match)] });
}

export async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const focused = interaction.options.getFocused();
  const items = await findItemsByName(focused);
  await interaction.respond(
    items.slice(0, 25).map((item) => ({ name: item.name, value: item.name })),
  );
}
