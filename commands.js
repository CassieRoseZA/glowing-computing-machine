const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('./database');

module.exports = {
    registerCommands: async (client) => {
        // Define slash commands
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

        const cliplistCommand = new SlashCommandBuilder()
            .setName('cliplist')
            .setDescription('List all monitored Twitch channels for this guild.');

        const unclipzCommand = new SlashCommandBuilder()
            .setName('unclipz')
            .setDescription('Stop monitoring a Twitch channel in this guild.')
            .addStringOption(option =>
                option.setName('twitch_channel')
                    .setDescription('The Twitch channel to stop monitoring')
                    .setRequired(true));

        // Register commands
        const commands = [clipzCommand.toJSON(), cliplistCommand.toJSON(), unclipzCommand.toJSON()];
        await client.application.commands.set(commands);

        // Handle interactions
        client.on('interactionCreate', async (interaction) => {
            if (!interaction.isChatInputCommand()) return;

            const guildId = interaction.guild.id;

            // Command: /clipz - Start monitoring a Twitch channel
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
                const existingConfig = await db.getChannelConfig(guildId, twitchChannel);
                if (existingConfig) {
                    return interaction.reply({
                        content: `❌ The Twitch channel **${twitchChannel}** is already being monitored in this guild.`,
                        ephemeral: true,
                    });
                }

                // Add new configuration if not already monitored
                await db.addChannelConfig(guildId, twitchChannel, discordChannel.id);

                const embed = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle('✅ Now Monitoring Clips')
                    .setDescription(`Monitoring **${twitchChannel}** for new clips in ${discordChannel}.`)
                    .setFooter({ text: 'Powered by CassieRoseZA' })
                    .setTimestamp();

                return interaction.reply({ embeds: [embed] });
            }

            // Command: /cliplist - List all monitored Twitch channels
            if (interaction.commandName === 'cliplist') {
                const configs = await db.getAllChannelConfigs();
                const guildConfigs = configs.filter(config => config.guild_id === guildId);

                if (guildConfigs.length === 0) {
                    return interaction.reply({
                        content: 'No Twitch channels are currently being monitored in this guild.',
                        ephemeral: true,
                    });
                }

                const channelList = guildConfigs
                    .map(config => `- **${config.twitch_channel}** in <#${config.discord_channel}>`)
                    .join('\n');

                const embed = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle('📃 Monitored Twitch Channels')
                    .setDescription(channelList)
                    .setFooter({ text: 'Powered by CassieRoseZA' })
                    .setTimestamp();

                return interaction.reply({ embeds: [embed] });
            }

            // Command: /unclipz - Stop monitoring a specific Twitch channel
            if (interaction.commandName === 'unclipz') {
                const twitchChannel = interaction.options.getString('twitch_channel').trim();

                // Check if the Twitch channel is being monitored in this guild
                const existingConfig = await db.getChannelConfig(guildId, twitchChannel);
                if (!existingConfig) {
                    return interaction.reply({
                        content: `❌ The Twitch channel **${twitchChannel}** is not currently being monitored in this guild.`,
                        ephemeral: true,
                    });
                }

                // Remove the monitoring configuration
                await db.removeChannelConfig(guildId, twitchChannel);

                const embed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('❌ Stopped Monitoring')
                    .setDescription(`Stopped monitoring **${twitchChannel}** in this guild.`)
                    .setFooter({ text: 'Powered by CassieRoseZA' })
                    .setTimestamp();

                return interaction.reply({ embeds: [embed] });
            }
        });
    }
};
