require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { registerCommands } = require('./commands');
const db = require('./database');
const axios = require('axios');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
    console.log(`🚀 Logged in as ${client.user.tag}`);
    await registerCommands(client); // Register slash commands
    await startTwitchMonitor();     // Start monitoring Twitch clips
    await notifyBotOwner();         // Notify the bot owner of startup
});

// Notify bot owner of successful startup
async function notifyBotOwner() {
    try {
        const owner = await client.users.fetch(process.env.BOT_OWNER_ID);
        const monitoredChannelsCount = await db.getMonitoredChannelsCount();

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('✅ Bot Started')
            .setDescription(`The bot is online and monitoring **${monitoredChannelsCount}** Twitch channels.`)
            .setFooter({ text: 'Powered by CassieRoseZA' })
            .setTimestamp();

        await owner.send({ embeds: [embed] });
    } catch (error) {
        console.error('Error notifying bot owner:', error);
    }
}

// Periodically poll Twitch for new clips and post to Discord
async function startTwitchMonitor() {
    const twitchToken = await getTwitchToken();

    setInterval(async () => {
        const configs = await db.getAllChannelConfigs();
        for (const config of configs) {
            const { guild_id, twitch_channel, discord_channel } = config;

            // Fetch Twitch channel ID by name
            const broadcasterId = await getBroadcasterId(twitch_channel, twitchToken);
            if (!broadcasterId) {
                console.error(`Failed to get broadcaster ID for channel: ${twitch_channel}`);
                continue;
            }

            const clips = await fetchTwitchClips(broadcasterId, twitchToken);
            for (const clip of clips) {
                const isNewClip = await db.checkClip(guild_id, clip.id);
                if (!isNewClip) {
                    const discordChannel = client.channels.cache.get(discord_channel);
                    const embed = createClipEmbed(clip);
                    const button = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setLabel('🎬 Watch Clip')
                            .setStyle(ButtonStyle.Link)
                            .setURL(clip.url)
                    );

                    await discordChannel.send({ embeds: [embed], components: [button] });
                    await db.addClip(guild_id, clip.id);
                }
            }
        }
    }, 60000);
}

// Helper: Get broadcaster ID for a given channel name
async function getBroadcasterId(channelName, token) {
    try {
        const url = `https://api.twitch.tv/helix/users?login=${channelName}`;
        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Client-Id': process.env.TWITCH_CLIENT_ID
            }
        });
        return response.data.data[0]?.id || null;
    } catch (error) {
        console.error(`Error fetching broadcaster ID for ${channelName}:`, error.message);
        return null;
    }
}

// Get Twitch OAuth token
async function getTwitchToken() {
    try {
        const response = await axios.post('https://id.twitch.tv/oauth2/token', null, {
            params: {
                client_id: process.env.TWITCH_CLIENT_ID,
                client_secret: process.env.TWITCH_CLIENT_SECRET,
                grant_type: 'client_credentials'
            }
        });
        return response.data.access_token;
    } catch (error) {
        console.error('Error fetching Twitch token:', error);
    }
}

// Fetch clips from Twitch using the broadcaster ID
async function fetchTwitchClips(broadcasterId, token) {
    const url = `https://api.twitch.tv/helix/clips?broadcaster_id=${broadcasterId}&first=5`;
    try {
        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Client-Id': process.env.TWITCH_CLIENT_ID
            }
        });
        return response.data.data || [];
    } catch (error) {
        console.error(`Error fetching clips for broadcaster ID ${broadcasterId}:`, error.message);
        return [];
    }
}

// Helper: Create an embed for each clip with richer details
function createClipEmbed(clip) {
    return new EmbedBuilder()
        .setColor('#9146FF')
        .setTitle(clip.title || 'Untitled Clip')
        .setURL(clip.url)
        .setImage(clip.thumbnail_url)
        .addFields(
            { name: 'Channel', value: clip.broadcaster_name || 'Unknown', inline: true },
            { name: 'Clipped By', value: clip.creator_name || 'Anonymous', inline: true },
            { name: 'Date', value: clip.created_at ? new Date(clip.created_at).toLocaleString() : 'Unknown', inline: true }
        )
        .setFooter({ text: 'Powered by CassieRoseZA' });
}

client.login(process.env.BOT_TOKEN);
