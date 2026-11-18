import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
} from "discord.js";
import {
  findTaskByFuzzyName,
  getItemName,
  getMapName,
  getQuestItemName,
  getTraderName,
  searchTaskNames,
} from "../lib/tarkov-api.js";
import type { Task, TaskObjective } from "../lib/tarkov-types.js";

export const data = new SlashCommandBuilder()
  .setName("quest")
  .setDescription("Look up a quest's keys, map, and found-in-raid requirements")
  .addStringOption((option) =>
    option
      .setName("name")
      .setDescription("Quest name")
      .setRequired(true)
      .setAutocomplete(true),
  );

// Friendly section headers for the most common objective types; anything else
// falls back to a camelCase-split label (see labelFor) rather than needing an
// entry here for every type the API defines.
const TYPE_LABELS: Record<string, string> = {
  findItem: "Find Item",
  giveItem: "Turn In",
  findQuestItem: "Find Quest Item",
  giveQuestItem: "Turn In",
  plantItem: "Plant Item",
  plantQuestItem: "Plant Quest Item",
  visit: "Visit",
  mark: "Mark",
  shoot: "Eliminate",
  extract: "Extract",
};

function labelFor(type: string): string {
  if (TYPE_LABELS[type]) return TYPE_LABELS[type];
  return type
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}

function truncate(text: string, maxLength = 1024): string {
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

// Above this many acceptable alternatives, an item list is a "any X category"
// requirement (e.g. "any 52 medical items") rather than a specific pick - the
// prose description summarizes that far better than enumerating every option.
const MAX_ENUMERATED_ITEMS = 3;

async function buildObjectiveLine(objective: TaskObjective): Promise<string> {
  let base: string;

  if (objective.items?.length && objective.items.length <= MAX_ENUMERATED_ITEMS) {
    const names = await Promise.all(objective.items.map(getItemName));
    base = `**${objective.count ?? 1}x** ${names.join(" or ")}`;
  } else if (objective.items?.length) {
    base = `${objective.description || objective.type} (**${objective.count ?? 1}x**)`;
  } else if (objective.questItem) {
    base = `**${await getQuestItemName(objective.questItem)}**`;
  } else if (objective.type === "visit" && objective.maps?.length) {
    base = (await Promise.all(objective.maps.map(getMapName))).join("/");
  } else {
    base = objective.description || objective.type;
  }

  const tags: string[] = [];

  if (objective.requiredKeys?.length) {
    const keyGroups = await Promise.all(
      objective.requiredKeys.map(async (group) =>
        (await Promise.all(group.map(getItemName))).join(" or "),
      ),
    );
    tags.push(`Key: ${keyGroups.join("; ")}`);
  }

  if (objective.maps?.length && objective.type !== "visit") {
    tags.push((await Promise.all(objective.maps.map(getMapName))).join("/"));
  }

  if (objective.foundInRaid) {
    tags.push("FIR ☑️");
  }

  const line = tags.length > 0 ? `${base} - ${tags.join(" | ")}` : base;
  return objective.optional ? `_${line}_` : line;
}

async function buildEmbed(task: Task): Promise<EmbedBuilder> {
  const traderName = await getTraderName(task.trader);

  const groups = new Map<string, string[]>();
  for (const objective of task.objectives) {
    const label = labelFor(objective.type);
    const line = await buildObjectiveLine(objective);
    const lines = groups.get(label) ?? [];
    lines.push(`- ${line}`);
    groups.set(label, lines);
  }

  const levelText =
    task.minPlayerLevel === null ? "No level requirement" : `Lvl ${task.minPlayerLevel}+`;

  const embed = new EmbedBuilder()
    .setTitle(task.name)
    .setDescription(`${traderName} | ${levelText}`);

  for (const [label, lines] of groups) {
    embed.addFields({ name: label, value: truncate(lines.join("\n")) });
  }

  return embed;
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const query = interaction.options.getString("name", true);
  await interaction.deferReply();

  const task = await findTaskByFuzzyName(query);

  if (!task) {
    await interaction.editReply(`No quest found matching "${query}".`);
    return;
  }

  await interaction.editReply({ embeds: [await buildEmbed(task)] });
}

export async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const focused = interaction.options.getFocused();
  const names = await searchTaskNames(focused);
  await interaction.respond(names.map((name) => ({ name, value: name })));
}
