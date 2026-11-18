import "dotenv/config";
import {
  Client,
  Events,
  GatewayIntentBits,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
} from "discord.js";
import * as flea from "./commands/flea.js";
import * as hideout from "./commands/hideout.js";
import * as craft from "./commands/craft.js";
import * as quest from "./commands/quest.js";

const token = process.env.DISCORD_TOKEN;
if (!token) {
  throw new Error("Missing DISCORD_TOKEN in .env");
}

interface Command {
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
  autocomplete?(interaction: AutocompleteInteraction): Promise<void>;
}

const commands = new Map<string, Command>([
  [flea.data.name, flea],
  [hideout.data.name, hideout],
  [craft.data.name, craft],
  [quest.data.name, quest],
]);

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isAutocomplete()) {
    const command = commands.get(interaction.commandName);
    if (!command?.autocomplete) return;

    try {
      await command.autocomplete(interaction);
    } catch (error) {
      console.error(`Error in autocomplete for /${interaction.commandName}:`, error);
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Error executing /${interaction.commandName}:`, error);
    const errorMessage = "Something went wrong running that command.";
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(errorMessage);
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
});

client.login(token);
