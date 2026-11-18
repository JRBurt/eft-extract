import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from "discord.js";
import { findItemsByName, getTraderName } from "../lib/tarkov-api.js";
import type { TarkovItem } from "../lib/tarkov-types.js";

export const data = new SlashCommandBuilder()
  .setName("flea")
  .setDescription("Look up flea market price info for an item")
  .addStringOption((option) =>
    option
      .setName("item")
      .setDescription("Item name")
      .setRequired(true),
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

  const embed = new EmbedBuilder()
    .setTitle(item.name)
    .addFields(
      { name: "Avg 24h price", value: formatRUB(item.avg24hPrice), inline: true },
      { name: "Last low price", value: formatRUB(item.lastLowPrice), inline: true },
      { name: "24h range", value: `${formatRUB(item.low24hPrice)} - ${formatRUB(item.high24hPrice)}`, inline: true },
      { name: "48h change", value: formatChange(item.changeLast48h, item.changeLast48hPercent), inline: true },
    );

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

function formatRUB(value: number | null | undefined): string {
  return value == null ? "N/A" : `${value.toLocaleString()} RUB`;
}

function formatChange(absolute: number | null | undefined, percent: number | null | undefined): string {
  if (absolute == null || percent == null) return "N/A";
  const sign = absolute >= 0 ? "+" : "";
  return `${sign}${absolute.toLocaleString()} RUB (${sign}${percent.toFixed(1)}%)`;
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
