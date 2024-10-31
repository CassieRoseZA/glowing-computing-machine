const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./clips.db');

// Create tables if they don't exist
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS channel_configs (
        guild_id TEXT,
        twitch_channel TEXT,
        discord_channel TEXT,
        PRIMARY KEY (guild_id, twitch_channel)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS clips (
        id TEXT PRIMARY KEY,
        guild_id TEXT
    )`);
});

// Add a new Twitch channel to monitor
async function addChannel(guildId, twitchChannel, discordChannel) {
    return new Promise((resolve, reject) => {
        db.run(`INSERT INTO channel_configs (guild_id, twitch_channel, discord_channel) VALUES (?, ?, ?)`,
            [guildId, twitchChannel, discordChannel], function (err) {
                if (err) {
                    if (err.code === 'SQLITE_CONSTRAINT') {
                        reject(new Error('Channel already exists for this guild.'));
                    } else {
                        reject(err);
                    }
                } else {
                    resolve(this.lastID);
                }
            });
    });
}

// Get all channel configurations
async function getAllChannelConfigs() {
    return new Promise((resolve, reject) => {
        db.all(`SELECT * FROM channel_configs`, [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

// Add a clip to the database
async function addClip(guildId, clipId) {
    return new Promise((resolve, reject) => {
        db.run(`INSERT INTO clips (id, guild_id) VALUES (?, ?)`, [clipId, guildId], function (err) {
            if (err) {
                if (err.code === 'SQLITE_CONSTRAINT') {
                    reject(new Error('Clip already exists for this guild.'));
                } else {
                    reject(err);
                }
            } else {
                resolve(this.lastID);
            }
        });
    });
}

// Check if a clip exists
async function checkClip(guildId, clipId) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT id FROM clips WHERE guild_id = ? AND id = ?`, [guildId, clipId], (err, row) => {
            if (err) reject(err);
            else resolve(row ? true : false);
        });
    });
}

// Get the count of monitored channels
async function getMonitoredChannelsCount() {
    return new Promise((resolve, reject) => {
        db.get(`SELECT COUNT(*) as count FROM channel_configs`, [], (err, row) => {
            if (err) reject(err);
            else resolve(row.count);
        });
    });
}

module.exports = {
    addChannel,
    getAllChannelConfigs,
    addClip,
    checkClip,
    getMonitoredChannelsCount
};
