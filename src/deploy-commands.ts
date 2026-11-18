import "dotenv/config";
import { REST, Routes } from "discord.js";
import { data as fleaCommand } from "./commands/flea.js";
import { data as hideoutCommand } from "./commands/hideout.js";
import { data as craftCommand } from "./commands/craft.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name} in .env`);
  }
  return value;
}

const token = requireEnv("DISCORD_TOKEN");
const clientId = requireEnv("DISCORD_CLIENT_ID");
const guildId = requireEnv("DISCORD_GUILD_ID");

const commands = [fleaCommand, hideoutCommand, craftCommand].map((command) =>
  command.toJSON(),
);

const rest = new REST().setToken(token);

async function deploy(): Promise<void> {
  console.log(`Registering ${commands.length} command(s) to guild ${guildId}...`);
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
    body: commands,
  });
  console.log("Done.");
}

deploy().catch((error) => {
  console.error(error);
  process.exit(1);
});
