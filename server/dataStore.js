/**
 * Shared Data Store
 * Stores server configurations and statistics
 * Uses PostgreSQL database when available, falls back to JSON file
 */

const fs = require('fs');
const path = require('path');

// Try to use database, fallback to file
let useDatabase = false;
let db = null;

try {
    // Check if DATABASE_URL or DB variables are set
    if (process.env.DATABASE_URL || process.env.DB_HOST) {
        db = require('./database');
        useDatabase = true;
        console.log('📊 Módulo de banco de dados carregado');
        console.log('   Testando conexão...');
    } else {
        console.log('ℹ️  Variáveis de banco de dados não configuradas');
        console.log('   Usando arquivo JSON como armazenamento');
    }
} catch (error) {
    console.warn('⚠️  Erro ao carregar módulo de banco de dados:', error.message);
    console.warn('   Usando arquivo JSON como fallback');
}

// Get data file path from environment or use default
const getDataFilePath = () => {
    if (process.env.DATA_FILE_PATH) {
        return process.env.DATA_FILE_PATH;
    }
    return path.join(__dirname, 'data', 'servers.json');
};

const DATA_FILE = getDataFilePath();

// Ensure data directory exists
const dataDir = path.dirname(DATA_FILE);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Default server configuration
const defaultConfig = {
    prefix: '!',
    nickname: null, // Bot nickname in this server
    botPresent: false, // Track if bot is currently in server
    lastSeen: null, // Last time bot was seen in server
    notifications: {
        memberJoin: {
            enabled: false,
            channelId: null,
            message: 'Bem-vindo @nome ao servidor! Entrou em @hora',
            useEmbed: false,
            embed: null
        },
        memberLeave: {
            enabled: false,
            channelId: null,
            message: '@nome saiu do servidor em @hora',
            useEmbed: false,
            embed: null
        }
    },
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
let globalData = { _administrators: [] }; // Global data (admins, etc.)

// Load data from file
function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const rawData = fs.readFileSync(DATA_FILE, 'utf8');
            const parsed = JSON.parse(rawData);
            
            // Separate server data from global data
            const { _administrators, ...servers } = parsed;
            
            // Store global data
            globalData = {
                _administrators: _administrators || []
            };
            
            // Convert Set arrays back to Sets for server data
            Object.keys(servers).forEach(guildId => {
                if (servers[guildId] && typeof servers[guildId] === 'object' && servers[guildId].stats) {
                    if (servers[guildId].stats?.uniqueUsers) {
                        // Handle different formats: array, object, or already Set
                        const uniqueUsers = servers[guildId].stats.uniqueUsers;
                        if (Array.isArray(uniqueUsers)) {
                            servers[guildId].stats.uniqueUsers = new Set(uniqueUsers);
                        } else if (typeof uniqueUsers === 'object' && uniqueUsers !== null) {
                            // If it's an object (empty {} or with keys), convert to array first
                            const keys = Object.keys(uniqueUsers);
                            servers[guildId].stats.uniqueUsers = keys.length > 0 
                                ? new Set(keys) 
                                : new Set();
                        } else {
                            servers[guildId].stats.uniqueUsers = new Set();
                        }
                    } else {
                        // Initialize if missing
                        if (!servers[guildId].stats) {
                            servers[guildId].stats = { ...defaultConfig.stats, uniqueUsers: new Set() };
                        } else {
                            servers[guildId].stats.uniqueUsers = new Set();
                        }
                    }
                }
            });
            
            serverData = servers;
        } else {
            // Initialize empty structure
            globalData = { _administrators: [] };
            serverData = {};
        }
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        serverData = {};
        globalData = { _administrators: [] };
    }
    return { ...serverData, ...globalData }; // Return combined for compatibility
}

// Save data to file
function saveData() {
    try {
        const dataToSave = JSON.parse(JSON.stringify(serverData));
        
        // Add global data
        dataToSave._administrators = globalData._administrators || [];
        
        // Convert Sets to arrays for JSON
        Object.keys(dataToSave).forEach(guildId => {
            if (guildId !== '_administrators' && dataToSave[guildId] && dataToSave[guildId].stats?.uniqueUsers instanceof Set) {
                dataToSave[guildId].stats.uniqueUsers = Array.from(dataToSave[guildId].stats.uniqueUsers);
            }
        });
        
        fs.writeFileSync(DATA_FILE, JSON.stringify(dataToSave, null, 2));
        console.log(`💾 Dados salvos em ${DATA_FILE}`);
    } catch (error) {
        console.error('Erro ao salvar dados:', error);
    }
}

// Initialize
if (useDatabase && db) {
    // Initialize database tables (async, but don't block)
    db.initializeDatabase().then(success => {
        if (success) {
            console.log('✅ Banco de dados PostgreSQL inicializado e pronto');
        } else {
            console.log('⚠️  Falha ao inicializar banco de dados');
            console.log('⚠️  Usando fallback para arquivo JSON');
            useDatabase = false;
            loadData();
        }
    }).catch(err => {
        console.error('❌ Erro ao inicializar banco de dados:', err.message);
        if (err.code) {
            console.error(`   Código do erro: ${err.code}`);
        }
        console.log('⚠️  Usando fallback para arquivo JSON');
        useDatabase = false;
        loadData();
    });
} else {
    loadData();
}

// Get server configuration
async function getServerConfig(guildId) {
    if (useDatabase && db) {
        return await db.getServerConfig(guildId);
    }
    
    // File-based fallback
    if (!serverData[guildId]) {
        // Deep clone default config and ensure Set is properly initialized
        serverData[guildId] = {
            prefix: defaultConfig.prefix,
            nickname: defaultConfig.nickname,
            botPresent: defaultConfig.botPresent,
            lastSeen: defaultConfig.lastSeen,
            permissions: [],
            notifications: { ...defaultConfig.notifications },
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
async function updateServerConfig(guildId, updates) {
    const config = await getServerConfig(guildId);
    Object.assign(config, updates);
    
    if (useDatabase && db) {
        // For database, save individual fields
        if (updates.prefix) await db.setServerPrefix(guildId, updates.prefix);
        if (updates.nickname !== undefined) await db.setServerNickname(guildId, updates.nickname);
        if (updates.notifications && db.updateServerConfig) {
            await db.updateServerConfig(guildId, { notifications: updates.notifications });
        }
    } else {
        saveData();
    }
    
    return config;
}

// Update server prefix
async function setServerPrefix(guildId, prefix) {
    if (useDatabase && db) {
        return await db.setServerPrefix(guildId, prefix);
    }
    
    // File-based fallback
    const config = await getServerConfig(guildId);
    config.prefix = prefix;
    saveData();
    return config;
}

// Update server nickname
async function setServerNickname(guildId, nickname) {
    if (useDatabase && db) {
        return await db.setServerNickname(guildId, nickname);
    }
    
    // File-based fallback
    const config = await getServerConfig(guildId);
    config.nickname = nickname && nickname.trim() ? nickname.trim() : null;
    saveData();
    return config;
}

// Mark bot as present in server
async function markBotPresent(guildId, present = true) {
    if (useDatabase && db) {
        // Update bot_present field in database
        try {
            // Access pool from database module
            const dbModule = require('./database');
            if (dbModule && dbModule.pool) {
                await dbModule.pool.query(
                    'UPDATE servers SET bot_present = $1, last_seen = NOW(), updated_at = CURRENT_TIMESTAMP WHERE guild_id = $2',
                    [present, guildId]
                );
            }
        } catch (err) {
            console.error('Erro ao marcar bot como presente no banco:', err);
            // Fallback to file-based
        }
    }
    
    // File-based fallback (always update for consistency)
    const config = await getServerConfig(guildId);
    config.botPresent = present;
    config.lastSeen = new Date().toISOString();
    saveData();
    
    console.log(`📌 Bot ${present ? 'marcado como presente' : 'marcado como ausente'} no servidor ${guildId}`);
}

// Track command execution
async function trackCommand(guildId, commandName, category, userId) {
    if (useDatabase && db) {
        return await db.trackCommand(guildId, commandName, category, userId);
    }
    
    // File-based fallback
    const config = await getServerConfig(guildId);
    config.stats.commandsExecuted++;
    config.stats.lastCommandTime = new Date().toISOString();
    
    // Also mark bot as present when command is executed
    config.botPresent = true;
    config.lastSeen = new Date().toISOString();
    
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
async function getServerStats(guildId) {
    if (useDatabase && db) {
        return await db.getServerStats(guildId);
    }
    
    // File-based fallback
    const config = await getServerConfig(guildId);
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
async function getAllServers() {
    if (useDatabase && db) {
        return await db.getAllServers();
    }
    
    // File-based fallback
    const guildIds = Object.keys(serverData);
    const servers = [];
    for (const guildId of guildIds) {
        const stats = await getServerStats(guildId);
        servers.push({ guildId, ...stats });
    }
    return servers;
}

// Update module status
async function setModuleStatus(guildId, moduleName, enabled) {
    if (useDatabase && db) {
        return await db.setModuleStatus(guildId, moduleName, enabled);
    }
    
    // File-based fallback
    const config = await getServerConfig(guildId);
    if (config.modules[moduleName] !== undefined) {
        config.modules[moduleName] = enabled;
        saveData();
    }
    return config;
}

// Export data file path getter (wrapper function)
function getDataFilePathExport() {
    return DATA_FILE;
}

// Permission management (for JSON fallback)
async function hasPermission(guildId, userId) {
    if (useDatabase && db && db.hasPermission) {
        return await db.hasPermission(guildId, userId);
    }
    const config = await getServerConfig(guildId);
    return (config.permissions || []).includes(userId);
}

async function addPermission(guildId, userId, addedBy) {
    if (useDatabase && db && db.addPermission) {
        return await db.addPermission(guildId, userId, addedBy);
    }
    const config = await getServerConfig(guildId);
    if (!config.permissions) {
        config.permissions = [];
    }
    if (!config.permissions.includes(userId)) {
        config.permissions.push(userId);
        saveData();
    }
    return true;
}

async function removePermission(guildId, userId) {
    if (useDatabase && db && db.removePermission) {
        return await db.removePermission(guildId, userId);
    }
    const config = await getServerConfig(guildId);
    if (config.permissions) {
        config.permissions = config.permissions.filter(id => id !== userId);
        saveData();
    }
    return true;
}

async function getServerPermissions(guildId) {
    if (useDatabase && db && db.getServerPermissions) {
        return await db.getServerPermissions(guildId);
    }
    const config = await getServerConfig(guildId);
    return (config.permissions || []).map(userId => ({ user_id: userId }));
}

// Administrator management (for JSON fallback)
async function isAdministrator(userId) {
    if (useDatabase && db && db.isAdministrator) {
        return await db.isAdministrator(userId);
    }
    // For JSON fallback, check in-memory or file
    try {
        const admins = globalData._administrators || [];
        return admins.includes(userId);
    } catch (error) {
        console.error('Erro ao verificar administrador (JSON):', error);
        return false;
    }
}

async function addAdministrator(userId, addedBy, role = 'admin') {
    if (useDatabase && db && db.addAdministrator) {
        return await db.addAdministrator(userId, addedBy, role);
    }
    // For JSON fallback
    try {
        if (!globalData._administrators) {
            globalData._administrators = [];
        }
        if (!globalData._administrators.includes(userId)) {
            globalData._administrators.push(userId);
            saveData();
        }
        return true;
    } catch (error) {
        console.error('Erro ao adicionar administrador (JSON):', error);
        return false;
    }
}

async function removeAdministrator(userId) {
    if (useDatabase && db && db.removeAdministrator) {
        return await db.removeAdministrator(userId);
    }
    // For JSON fallback
    try {
        if (globalData._administrators) {
            globalData._administrators = globalData._administrators.filter(id => id !== userId);
            saveData();
        }
        return true;
    } catch (error) {
        console.error('Erro ao remover administrador (JSON):', error);
        return false;
    }
}

async function getAllAdministrators() {
    if (useDatabase && db && db.getAllAdministrators) {
        return await db.getAllAdministrators();
    }
    // For JSON fallback
    try {
        const admins = globalData._administrators || [];
        return admins.map(userId => ({ user_id: userId, role: 'admin' }));
    } catch (error) {
        console.error('Erro ao buscar administradores (JSON):', error);
        return [];
    }
}

module.exports = {
    getServerConfig,
    updateServerConfig,
    setServerPrefix,
    setServerNickname,
    trackCommand,
    getServerStats,
    getAllServers,
    setModuleStatus,
    markBotPresent,
    loadData,
    saveData,
    getDataFilePath: getDataFilePathExport,
    hasPermission,
    addPermission,
    removePermission,
    getServerPermissions,
    isAdministrator,
    addAdministrator,
    removeAdministrator,
    getAllAdministrators
};

