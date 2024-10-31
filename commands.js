const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const { SlashCommandBuilder } = require('discord.js');
const db = require('./database');

const commands = [
    new SlashCommandBuilder()
        .setName('clipz')
        .setDescription('Start monitoring a Twitch channel for clips.')
        .addStringOption(option => 
            option.setName('twitch_channel')
                .setDescription('The Twitch channel to monitor.')
                .setRequired(true))
        .addChannelOption(option => 
            option.setName('discord_channel')
                .setDescription('The Discord channel to send clips to.')
                .setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('cliplist')
        .setDescription('List currently monitored Twitch clips.'),

    new SlashCommandBuilder()
        .setName('unclipz')
        .setDescription('Stop monitoring a Twitch channel for clips.')
        .addStringOption(option => 
            option.setName('twitch_channel')
                .setDescription('The Twitch channel to stop monitoring.')
                .setRequired(true))
];

module.exports.registerCommands = async (client) => {
    const commandData = commands.map(command => command.toJSON());
    const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);

    try {
        console.log('Started refreshing application (/) commands.');
        await rest.put(Routes.applicationCommands(process.env.BOT_CLIENT_ID), { body: commandData });
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
};
