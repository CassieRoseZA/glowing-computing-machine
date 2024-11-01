require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { registerCommands } = require('./commands');
const db = require('./database');
const axios = require('axios');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
    console.log(`🚀 Logged in as ${client.user.tag}`);
    await registerCommands(client);
    await startTwitchMonitor();  
    await notifyBotOwner();  
});

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

const fetchingLocks = new Map();

async function startTwitchMonitor() {
    const twitchToken = await getTwitchToken();

    setInterval(async () => {
        const configs = await db.getAllChannelConfigs();
        for (const config of configs) {
            const { guild_id, twitch_channel, discord_channel } = config;
            const key = `${guild_id}_${twitch_channel}`;

            if (fetchingLocks.get(key)) {
                console.log(`Fetch already in progress for ${twitch_channel} in guild ${guild_id}. Skipping.`);
                continue; 
            }

            fetchingLocks.set(key, true);

            try {
                const broadcasterId = await getBroadcasterId(twitch_channel, twitchToken);
                if (!broadcasterId) {
                    console.error(`Failed to get broadcaster ID for channel: ${twitch_channel}`);
                    continue;
                }

                await fetchTwitchClipsRecursively(guild_id, discord_channel, broadcasterId, twitchToken, twitch_channel);
            } catch (error) {
                console.error(`Error during fetching for ${twitch_channel} in guild ${guild_id}:`, error);
            } finally {
                fetchingLocks.delete(key);
            }
        }
    }, 60000);
}

async function fetchTwitchClipsRecursively(guild_id, discord_channel, broadcasterId, twitchToken, twitch_channel, cursor) {
    const { data: clips, pagination } = await fetchTwitchClips(broadcasterId, twitchToken, cursor);

    for (const clip of clips) {
        if (await db.checkClip(guild_id, clip.id)) {
            continue; 
        }

        const discordChannel = client.channels.cache.get(discord_channel);
        const embed = createClipEmbed(clip);
        const button = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('🎬 Watch Clip')
                .setStyle(ButtonStyle.Link)
                .setURL(clip.url)
        );

        await db.addClip(guild_id, clip.id);
        await discordChannel.send({ embeds: [embed], components: [button] });
    }

    if (pagination?.cursor) {
        setTimeout(async () => {
            await fetchTwitchClipsRecursively(guild_id, discord_channel, broadcasterId, twitchToken, twitch_channel, pagination.cursor);
        }, 1000);
    }
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

async function fetchTwitchClips(broadcasterId, token, cursor) {
    const params = {
        broadcaster_id: broadcasterId,
        after: cursor,
        first: 50,
    };

    const url = `https://api.twitch.tv/helix/clips?${objectToSearchParams(params)}`;

    try {
        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Client-Id': process.env.TWITCH_CLIENT_ID
            }
        });

        return response.data;
    } catch (error) {
        console.error(`Error fetching clips for broadcaster ID ${broadcasterId}:`, error.message);
        return { data: [], pagination: null }; // Return empty data and null pagination to avoid errors
    }
}

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

function objectToSearchParams(obj) {
    return new URLSearchParams(
        Object.entries(obj).filter(([_, value]) => value !== undefined)
    ).toString();
}

client.login(process.env.BOT_TOKEN);