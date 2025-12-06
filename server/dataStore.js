/**
 * Shared Data Store
 * Stores server configurations and statistics
 * Can be replaced with a database later
 */

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data', 'servers.json');

// Ensure data directory exists
const dataDir = path.dirname(DATA_FILE);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Default server configuration
const defaultConfig = {
    prefix: '!',
    modules: {
        moderation: true,
        fun: true,
        utility: true,
        music: false
    },
    stats: {
        commandsExecuted: 0,
        commandsByCategory: {
            moderation: 0,
            fun: 0,
            utility: 0,
            music: 0,
            other: 0
        },
        lastCommandTime: null,
        uniqueUsers: new Set()
    }
};

// In-memory store (loaded from file)
let serverData = {};

// Load data from file
function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const rawData = fs.readFileSync(DATA_FILE, 'utf8');
            const parsed = JSON.parse(rawData);
            
            // Convert Set arrays back to Sets
            Object.keys(parsed).forEach(guildId => {
                if (parsed[guildId].stats?.uniqueUsers) {
                    // Handle different formats: array, object, or already Set
                    const uniqueUsers = parsed[guildId].stats.uniqueUsers;
                    if (Array.isArray(uniqueUsers)) {
                        parsed[guildId].stats.uniqueUsers = new Set(uniqueUsers);
                    } else if (typeof uniqueUsers === 'object' && uniqueUsers !== null) {
                        // If it's an object (empty {} or with keys), convert to array first
                        const keys = Object.keys(uniqueUsers);
                        parsed[guildId].stats.uniqueUsers = keys.length > 0 
                            ? new Set(keys) 
                            : new Set();
                    } else {
                        parsed[guildId].stats.uniqueUsers = new Set();
                    }
                } else {
                    // Initialize if missing
                    if (!parsed[guildId].stats) {
                        parsed[guildId].stats = { ...defaultConfig.stats, uniqueUsers: new Set() };
                    } else {
                        parsed[guildId].stats.uniqueUsers = new Set();
                    }
                }
            });
            
            serverData = parsed;
        }
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        serverData = {};
    }
}

// Save data to file
function saveData() {
    try {
        const dataToSave = JSON.parse(JSON.stringify(serverData));
        
        // Convert Sets to arrays for JSON
        Object.keys(dataToSave).forEach(guildId => {
            if (dataToSave[guildId].stats?.uniqueUsers instanceof Set) {
                dataToSave[guildId].stats.uniqueUsers = Array.from(dataToSave[guildId].stats.uniqueUsers);
            }
        });
        
        fs.writeFileSync(DATA_FILE, JSON.stringify(dataToSave, null, 2));
    } catch (error) {
        console.error('Erro ao salvar dados:', error);
    }
}

// Initialize
loadData();

// Get server configuration
function getServerConfig(guildId) {
    if (!serverData[guildId]) {
        // Deep clone default config and ensure Set is properly initialized
        serverData[guildId] = {
            prefix: defaultConfig.prefix,
            modules: { ...defaultConfig.modules },
            stats: {
                ...defaultConfig.stats,
                uniqueUsers: new Set()
            }
        };
        saveData();
    } else {
        // Ensure uniqueUsers is a Set (fix for existing data loaded from JSON)
        if (!(serverData[guildId].stats?.uniqueUsers instanceof Set)) {
            if (Array.isArray(serverData[guildId].stats.uniqueUsers)) {
                serverData[guildId].stats.uniqueUsers = new Set(serverData[guildId].stats.uniqueUsers);
            } else {
                serverData[guildId].stats.uniqueUsers = new Set();
            }
        }
    }
    return serverData[guildId];
}

// Update server configuration
function updateServerConfig(guildId, updates) {
    const config = getServerConfig(guildId);
    Object.assign(config, updates);
    saveData();
    return config;
}

// Update server prefix
function setServerPrefix(guildId, prefix) {
    const config = getServerConfig(guildId);
    config.prefix = prefix;
    saveData();
    return config;
}

// Track command execution
function trackCommand(guildId, commandName, category, userId) {
    const config = getServerConfig(guildId);
    config.stats.commandsExecuted++;
    config.stats.lastCommandTime = new Date().toISOString();
    
    if (category && config.stats.commandsByCategory[category] !== undefined) {
        config.stats.commandsByCategory[category]++;
    } else {
        config.stats.commandsByCategory.other++;
    }
    
    if (userId) {
        config.stats.uniqueUsers.add(userId);
    }
    
    saveData();
}

// Get server statistics
function getServerStats(guildId) {
    const config = getServerConfig(guildId);
    return {
        prefix: config.prefix,
        commandsExecuted: config.stats.commandsExecuted,
        commandsByCategory: { ...config.stats.commandsByCategory },
        uniqueUsers: config.stats.uniqueUsers.size,
        lastCommandTime: config.stats.lastCommandTime,
        modules: { ...config.modules }
    };
}

// Get all servers data
function getAllServers() {
    return Object.keys(serverData).map(guildId => ({
        guildId,
        ...getServerStats(guildId)
    }));
}

// Update module status
function setModuleStatus(guildId, moduleName, enabled) {
    const config = getServerConfig(guildId);
    if (config.modules[moduleName] !== undefined) {
        config.modules[moduleName] = enabled;
        saveData();
    }
    return config;
}

module.exports = {
    getServerConfig,
    updateServerConfig,
    setServerPrefix,
    trackCommand,
    getServerStats,
    getAllServers,
    setModuleStatus,
    loadData,
    saveData
};

