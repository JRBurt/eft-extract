import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
} from "discord.js";
import { findMapsByName, getMobName } from "../lib/tarkov-api.js";
import type { TarkovMap } from "../lib/tarkov-types.js";

export const data = new SlashCommandBuilder()
  .setName("boss")
  .setDescription("List boss spawn chances for a map")
  .addStringOption((option) =>
    option.setName("map").setDescription("Map name").setRequired(true).setAutocomplete(true),
  );

// Event/variant forms of a classic boss (e.g. the "Shadow of Tagilla" reskin,
// or a Labs-only spawn of a boss that's also elsewhere) - excluded so the
// output only shows the regular, always-available version of each boss.
const VARIANT_BOSS_IDS = new Set(["bossBullyBlackDiv", "bossTagillaAgro", "bossWedgeLab"]);

// The API calls the Goons squad's leader mob "Knight," but the community (and
// in-raid chatter) knows the whole squad by the player-facing name "The Goons."
const BOSS_NAME_OVERRIDES: Record<string, string> = {
  bossKnight: "The Goons",
};

async function getDisplayName(mobId: string): Promise<string> {
  return BOSS_NAME_OVERRIDES[mobId] ?? (await getMobName(mobId));
}

function pickBestMatch(maps: TarkovMap[], query: string): TarkovMap {
  const lowerQuery = query.toLowerCase();
  const exact = maps.find(
    (map) =>
      map.name.toLowerCase() === lowerQuery || map.normalizedName.toLowerCase() === lowerQuery,
  );
  return exact ?? maps[0];
}

async function buildEmbed(map: TarkovMap): Promise<EmbedBuilder> {
  const classicBosses = map.bosses.filter(
    (boss) => boss.mob.startsWith("boss") && !VARIANT_BOSS_IDS.has(boss.mob),
  );

  const lines = await Promise.all(
    classicBosses
      .sort((a, b) => b.spawnChance - a.spawnChance)
      .map(
        async (boss) => `- ${await getDisplayName(boss.mob)}: ${Math.round(boss.spawnChance * 100)}%`,
      ),
  );

  return new EmbedBuilder()
    .setTitle(map.name)
    .setDescription(lines.length > 0 ? lines.join("\n") : "No bosses spawn on this map.");
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const query = interaction.options.getString("map", true);
  await interaction.deferReply();

  const maps = await findMapsByName(query);

  if (maps.length === 0) {
    await interaction.editReply(`No map found matching "${query}".`);
    return;
  }

  const map = pickBestMatch(maps, query);
  await interaction.editReply({ embeds: [await buildEmbed(map)] });
}

export async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const focused = interaction.options.getFocused();
  const maps = await findMapsByName(focused);
  await interaction.respond(
    maps.slice(0, 25).map((map) => ({ name: map.name, value: map.name })),
  );
}
