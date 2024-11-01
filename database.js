const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.resolve(__dirname, 'clips.db'), (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        // Create tables if they don't exist
        db.run(`CREATE TABLE IF NOT EXISTS channel_configs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id TEXT,
            twitch_channel TEXT,
            discord_channel TEXT,
            UNIQUE(guild_id, twitch_channel)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS clips (
            id TEXT PRIMARY KEY,
            guild_id TEXT
        )`);
    }
});

// Method to add a new channel config
function addChannelConfig(guildId, twitchChannel, discordChannel) {
    return new Promise((resolve, reject) => {
        db.run("INSERT INTO channel_configs (guild_id, twitch_channel, discord_channel) VALUES (?, ?, ?)", [guildId, twitchChannel, discordChannel], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

// Method to get a specific channel config
function getChannelConfig(guildId, twitchChannel) {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM channel_configs WHERE guild_id = ? AND twitch_channel = ?", [guildId, twitchChannel], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

// Method to get all channel configs
function getAllChannelConfigs() {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM channel_configs", [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

// Method to check if a clip exists for a guild
function checkClip(guildId, clipId) {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM clips WHERE guild_id = ? AND id = ?", [guildId, clipId], (err, row) => {
            if (err) reject(err);
            else resolve(!!row);
        });
    });
}

// Method to add a new clip to the database
function addClip(guildId, clipId) {
    return new Promise((resolve, reject) => {
        db.run("INSERT INTO clips (id, guild_id) VALUES (?, ?)", [clipId, guildId], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

// Method to remove a specific channel config (for unclipz command)
function removeChannelConfig(guildId, twitchChannel) {
    return new Promise((resolve, reject) => {
        db.run("DELETE FROM channel_configs WHERE guild_id = ? AND twitch_channel = ?", [guildId, twitchChannel], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

// Method to get the number of monitored channels
function getMonitoredChannelsCount() {
    return new Promise((resolve, reject) => {
        db.get("SELECT COUNT(*) AS count FROM channel_configs", [], (err, row) => {
            if (err) reject(err);
            else resolve(row.count);
        });
    });
}

module.exports = {
    addChannelConfig,
    getChannelConfig,
    getAllChannelConfigs,
    checkClip,
    addClip,
    removeChannelConfig, // Export the removeChannelConfig method
    getMonitoredChannelsCount
};
