import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
} from "discord.js";
import {
  findCraftsByProductName,
  findItemsByName,
  getItemName,
  getStationName,
} from "../lib/tarkov-api.js";
import type { Craft, ItemRequirement } from "../lib/tarkov-types.js";

export const data = new SlashCommandBuilder()
  .setName("craft")
  .setDescription("List items needed to craft an item")
  .addStringOption((option) =>
    option.setName("item").setDescription("Item to craft").setRequired(true).setAutocomplete(true),
  );

async function formatRequirements(requirements: ItemRequirement[]): Promise<string> {
  if (requirements.length === 0) return "None";

  const lines = await Promise.all(
    requirements.map(async (req) => {
      const name = await getItemName(req.item);
      const tool = req.attributes.tool ? " (tool, not consumed)" : "";
      return `- ${req.count}x ${name}${tool}`;
    }),
  );
  return lines.join("\n");
}

async function buildEmbed(craft: Craft): Promise<EmbedBuilder> {
  const [productName, stationName] = await Promise.all([
    getItemName(craft.productItem.item),
    getStationName(craft.station),
  ]);
  const hours = (craft.duration / 3600).toFixed(1);

  return new EmbedBuilder()
    .setTitle(`Craft: ${craft.productItem.count}x ${productName}`)
    .setDescription(`${stationName} Lvl ${craft.level}+ | ${hours}h`)
    .addFields({ name: "Required items", value: await formatRequirements(craft.requiredItems) });
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const query = interaction.options.getString("item", true);
  await interaction.deferReply();

  const crafts = await findCraftsByProductName(query);

  if (crafts.length === 0) {
    await interaction.editReply(`No craft found producing an item matching "${query}".`);
    return;
  }

  const embeds = await Promise.all(crafts.slice(0, 3).map(buildEmbed));
  await interaction.editReply({ embeds });
}

export async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const focused = interaction.options.getFocused();
  const items = await findItemsByName(focused);
  await interaction.respond(
    items.slice(0, 25).map((item) => ({ name: item.name, value: item.name })),
  );
}
