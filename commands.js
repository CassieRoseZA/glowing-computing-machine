const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('./database');

module.exports = {
    registerCommands: async (client) => {
        const clipzCommand = new SlashCommandBuilder()
            .setName('clipz')
            .setDescription('Enable Twitch clip monitoring for a Twitch channel.')
            .addStringOption(option =>
                option.setName('twitch_channel')
                    .setDescription('Twitch channel name to monitor')
                    .setRequired(true))
            .addChannelOption(option =>
                option.setName('discord_channel')
                    .setDescription('Discord channel to post clips')
                    .setRequired(true));

        const commands = [clipzCommand.toJSON()];

        client.application.commands.set(commands);

        client.on('interactionCreate', async (interaction) => {
            if (!interaction.isChatInputCommand()) return;

            if (interaction.commandName === 'clipz') {
                const twitchChannel = interaction.options.getString('twitch_channel').trim();
                const discordChannel = interaction.options.getChannel('discord_channel');

                // Prevent null or empty channel names
                if (!twitchChannel || twitchChannel.toLowerCase() === 'null') {
                    return interaction.reply({
                        content: '❌ Invalid Twitch channel name. Please provide a valid Twitch channel name.',
                        ephemeral: true,
                    });
                }

                // Check if Twitch channel is already monitored in this guild
                const existingConfig = await db.getChannelConfig(interaction.guild.id, twitchChannel);
                if (existingConfig) {
                    return interaction.reply({
                        content: `❌ The Twitch channel **${twitchChannel}** is already being monitored in this guild.`,
                        ephemeral: true,
                    });
                }

                // Add new configuration if not already monitored
                await db.addChannelConfig(interaction.guild.id, twitchChannel, discordChannel.id);

                const embed = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle('✅ Now Monitoring Clips')
                    .setDescription(`Monitoring **${twitchChannel}** for new clips in ${discordChannel}.`)
                    .setFooter({ text: 'Powered by CassieRoseZA' })
                    .setTimestamp();

                return interaction.reply({ embeds: [embed] });
            }

            // Additional command handlers can be added here
        });
    }
};
