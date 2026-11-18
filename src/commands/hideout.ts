import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from "discord.js";
import { findHideoutStationsByName, getItemName } from "../lib/tarkov-api.js";
import type { HideoutStation, ItemRequirement } from "../lib/tarkov-types.js";

export const data = new SlashCommandBuilder()
  .setName("hideout")
  .setDescription("List items needed to build a hideout station level")
  .addStringOption((option) =>
    option.setName("station").setDescription("Station name").setRequired(true),
  )
  .addIntegerOption((option) =>
    option
      .setName("level")
      .setDescription("Level you want to build")
      .setRequired(true)
      .setMinValue(1),
  );

function pickBestMatch(stations: HideoutStation[], query: string): HideoutStation {
  const lowerQuery = query.toLowerCase();
  const exact = stations.find(
    (station) =>
      station.name.toLowerCase() === lowerQuery ||
      station.normalizedName.toLowerCase() === lowerQuery,
  );
  return exact ?? stations[0];
}

async function formatRequirements(requirements: ItemRequirement[]): Promise<string> {
  if (requirements.length === 0) return "None";

  const lines = await Promise.all(
    requirements.map(async (req) => {
      const name = await getItemName(req.item);
      const fir = req.attributes.foundInRaid ? " (FIR)" : "";
      return `${req.count}x ${name}${fir}`;
    }),
  );
  return lines.join("\n");
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const query = interaction.options.getString("station", true);
  const level = interaction.options.getInteger("level", true);
  await interaction.deferReply();

  const stations = await findHideoutStationsByName(query);

  if (stations.length === 0) {
    await interaction.editReply(`No hideout station found matching "${query}".`);
    return;
  }

  const station = pickBestMatch(stations, query);
  const levelData = station.levels.find((l) => l.level === level);

  if (!levelData) {
    const available = station.levels.map((l) => l.level).join(", ");
    await interaction.editReply(
      `${station.name} doesn't have a level ${level}. Available levels: ${available}.`,
    );
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`${station.name} — Level ${level}`)
    .addFields({
      name: "Items needed",
      value: await formatRequirements(levelData.itemRequirements),
    });

  await interaction.editReply({ embeds: [embed] });
}
