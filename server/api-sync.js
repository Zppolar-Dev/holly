/**
 * API Sync Module
 * Handles synchronization between bot and website when running in different environments
 */

const axios = require('axios');
const dataStore = require('./dataStore');

const BOT_API_URL = process.env.BOT_API_URL || 'http://localhost:3001';
const WEBSITE_API_URL = process.env.WEBSITE_API_URL || process.env.BASE_URL || 'http://localhost:3000';

/**
 * Sync data to bot (when website updates data)
 */
async function syncToBot(guildId, data) {
    if (!process.env.BOT_API_URL) {
        // Running locally, bot should have direct file access
        return true;
    }
    
    try {
        await axios.post(`${BOT_API_URL}/api/sync/update`, {
            guildId,
            data
        }, {
            timeout: 5000
        });
        console.log(`✅ Dados sincronizados com bot para servidor ${guildId}`);
        return true;
    } catch (error) {
        console.warn(`⚠️  Erro ao sincronizar com bot: ${error.message}`);
        return false;
    }
}

/**
 * Sync data from bot (when bot updates data)
 */
async function syncFromBot(guildId) {
    if (!process.env.BOT_API_URL) {
        // Running locally, bot should have direct file access
        return null;
    }
    
    try {
        const response = await axios.get(`${BOT_API_URL}/api/sync/get/${guildId}`, {
            timeout: 5000
        });
        return response.data;
    } catch (error) {
        console.warn(`⚠️  Erro ao buscar dados do bot: ${error.message}`);
        return null;
    }
}

module.exports = {
    syncToBot,
    syncFromBot
};




