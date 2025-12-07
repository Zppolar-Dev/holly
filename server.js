const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const axios = require('axios');
require('dotenv').config();

const discordAuth = require('./server/auth');
const dataStore = require('./server/dataStore');

// Owner ID (same as in auth.js)
const OWNER_ID = '909204567042981978';

// Check if user is administrator (owner or added admin)
async function checkAdministrator(req, res, next) {
    const userId = req.user?.user_id;
    
    if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
    }
    
    // Owner is always admin
    if (userId === OWNER_ID) {
        req.isOwner = true;
        req.isAdmin = true;
        return next();
    }
    
    // Check if user is in administrators table
    let isAdmin = false;
    if (useDatabase && db && db.isAdministrator) {
        isAdmin = await db.isAdministrator(userId);
    } else if (dataStore.isAdministrator) {
        isAdmin = await dataStore.isAdministrator(userId);
    }
    
    if (!isAdmin) {
        return res.status(403).json({ error: 'Acesso negado. Apenas administradores podem acessar esta área.' });
    }
    
    req.isOwner = false;
    req.isAdmin = true;
    next();
}

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: FRONTEND_URL, credentials: true }));

// Servir arquivos estáticos ANTES de qualquer rota dinâmica
// Isso garante que CSS, JS, imagens sejam servidos corretamente
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '1d', // Cache por 1 dia
    etag: true,
    lastModified: true
}));
app.use(
    helmet({
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false
    })
);

// Rotas de autenticação
app.get('/auth/discord', discordAuth.login);
app.get('/auth/discord/callback', discordAuth.callback);
app.post('/auth/logout', discordAuth.authenticateToken, discordAuth.logout);

// Shared bot instance (will be set when bot starts)
let botClient = null;

// Rotas API
app.get('/api/user', discordAuth.authenticateToken, discordAuth.getUserData);
app.get('/api/user/guilds', discordAuth.authenticateToken, discordAuth.getUserGuilds);

// Get global stats
app.get('/api/stats', discordAuth.authenticateToken, (req, res) => {
    // Try to get real stats from bot, fallback to mock data
    if (botClient && typeof botClient.getStats === 'function') {
        try {
            const stats = botClient.getStats();
            return res.json(stats);
        } catch (error) {
            console.error('Erro ao obter estatísticas do bot:', error);
        }
    }
    
    // Fallback to mock data if bot not available
    const now = new Date();
    const hourly = Array.from({ length: 24 }, (_, index) => {
        const base = 200 + ((index * 37) % 150);
        return base + Math.floor(Math.random() * 50);
    });

    res.json({
        uptime: 99.9,
        commands_24h: hourly.reduce((acc, value) => acc + value, 0),
        unique_users: 1245,
        command_categories: {
            moderation: 42,
            fun: 21,
            utility: 18,
            music: 14,
            other: 5
        },
        commands_by_hour: hourly,
        generated_at: now.toISOString()
    });
});

// Get server-specific stats
app.get('/api/server/:guildId/stats', discordAuth.authenticateToken, async (req, res) => {
    const { guildId } = req.params;
    try {
        const stats = await dataStore.getServerStats(guildId);
        res.json(stats);
    } catch (error) {
        console.error('Erro ao buscar estatísticas:', error);
        res.status(500).json({ error: 'Erro ao buscar estatísticas' });
    }
});

// Check if bot is in server
app.get('/api/server/:guildId/bot-present', discordAuth.authenticateToken, async (req, res) => {
    const { guildId } = req.params;
    try {
        let present = false;
        
        // Method 1: Check via bot client cache (most reliable - real-time)
        if (botClient && botClient.guilds && botClient.guilds.cache) {
            const guild = botClient.guilds.cache.get(guildId);
            if (guild) {
                // Bot is definitely in the server - update dataStore to reflect this
                await dataStore.markBotPresent(guildId, true);
                return res.json({ present: true });
            }
        }
        
        // Method 2: Check dataStore botPresent flag (set by bot when joining/leaving)
        try {
            const config = await dataStore.getServerConfig(guildId);
            if (config) {
                // Check botPresent flag first (most reliable indicator)
                if (config.botPresent === true) {
                    // Check if lastSeen is recent (within last 5 minutes) to ensure it's current
                    if (config.lastSeen) {
                        const lastSeen = new Date(config.lastSeen);
                        const now = new Date();
                        const minutesSinceLastSeen = (now - lastSeen) / (1000 * 60);
                        
                        // If last seen more than 5 minutes ago, verify via bot client
                        if (minutesSinceLastSeen > 5 && botClient && botClient.guilds) {
                            // Double-check with bot client
                            const guild = botClient.guilds.cache.get(guildId);
                            present = !!guild;
                            // Update flag if different
                            if (present !== config.botPresent) {
                                await dataStore.markBotPresent(guildId, present);
                            }
                        } else {
                            present = true;
                        }
                    } else {
                        present = true; // No lastSeen timestamp, but marked as present
                    }
                } else {
                    present = false; // Explicitly marked as not present
                }
            }
        } catch (err) {
            // No config found - bot definitely not in server
            console.log(`Servidor ${guildId} não encontrado no dataStore:`, err.message);
            present = false;
        }
        
        res.json({ present });
    } catch (error) {
        console.error('Erro ao verificar presença do bot:', error);
        res.json({ present: false });
    }
});

// Get server configuration
app.get('/api/server/:guildId/config', discordAuth.authenticateToken, checkServerPermission, async (req, res) => {
    const { guildId } = req.params;
    try {
        const config = await dataStore.getServerConfig(guildId);
        // Convert Set to array for JSON response
        const response = {
            ...config,
            stats: {
                ...config.stats,
                uniqueUsers: config.stats.uniqueUsers.size || (config.stats.uniqueUsers instanceof Set ? config.stats.uniqueUsers.size : 0)
            }
        };
        res.json(response);
    } catch (error) {
        console.error('Erro ao buscar configuração:', error);
        res.status(500).json({ error: 'Erro ao buscar configuração' });
    }
});

// Get server permissions
app.get('/api/server/:guildId/permissions', discordAuth.authenticateToken, checkServerPermission, async (req, res) => {
    const { guildId } = req.params;
    try {
        let permissions = [];
        if (useDatabase && db && db.getServerPermissions) {
            permissions = await db.getServerPermissions(guildId);
        } else if (dataStore.getServerPermissions) {
            permissions = await dataStore.getServerPermissions(guildId);
        }
        res.json(permissions);
    } catch (error) {
        console.error('Erro ao buscar permissões:', error);
        res.status(500).json({ error: 'Erro ao buscar permissões' });
    }
});

// Add permission
app.post('/api/server/:guildId/permissions', discordAuth.authenticateToken, checkServerPermission, async (req, res) => {
    const { guildId } = req.params;
    const { userId } = req.body;
    const addedBy = req.user.user_id;
    
    if (!userId) {
        return res.status(400).json({ error: 'ID do usuário é obrigatório' });
    }
    
    // Only owners can add permissions
    if (!req.isOwner) {
        return res.status(403).json({ error: 'Apenas o dono do servidor pode adicionar permissões' });
    }
    
    try {
        let success = false;
        if (useDatabase && db && db.addPermission) {
            success = await db.addPermission(guildId, userId, addedBy);
        } else if (dataStore.addPermission) {
            success = await dataStore.addPermission(guildId, userId, addedBy);
        }
        
        if (success) {
            res.json({ success: true, message: 'Permissão adicionada com sucesso' });
        } else {
            res.status(500).json({ error: 'Erro ao adicionar permissão' });
        }
    } catch (error) {
        console.error('Erro ao adicionar permissão:', error);
        res.status(500).json({ error: 'Erro ao adicionar permissão' });
    }
});

// Remove permission
app.delete('/api/server/:guildId/permissions/:userId', discordAuth.authenticateToken, checkServerPermission, async (req, res) => {
    const { guildId, userId } = req.params;
    
    // Only owners can remove permissions
    if (!req.isOwner) {
        return res.status(403).json({ error: 'Apenas o dono do servidor pode remover permissões' });
    }
    
    try {
        let success = false;
        if (useDatabase && db && db.removePermission) {
            success = await db.removePermission(guildId, userId);
        } else if (dataStore.removePermission) {
            success = await dataStore.removePermission(guildId, userId);
        }
        
        if (success) {
            res.json({ success: true, message: 'Permissão removida com sucesso' });
        } else {
            res.status(500).json({ error: 'Erro ao remover permissão' });
        }
    } catch (error) {
        console.error('Erro ao remover permissão:', error);
        res.status(500).json({ error: 'Erro ao remover permissão' });
    }
});

// Update server prefix
app.post('/api/server/:guildId/prefix', discordAuth.authenticateToken, checkServerPermission, async (req, res) => {
    const { guildId } = req.params;
    const { prefix } = req.body;
    
    if (!prefix || prefix.length > 5) {
        return res.status(400).json({ error: 'Prefix inválido (máximo 5 caracteres)' });
    }
    
    try {
        const config = await dataStore.setServerPrefix(guildId, prefix);
        
        // Notify bot if connected locally
        if (botClient && typeof botClient.updateServerPrefix === 'function') {
            await botClient.updateServerPrefix(guildId, prefix);
        }
        
        res.json({ success: true, prefix: config.prefix });
    } catch (error) {
        console.error('Erro ao atualizar prefixo:', error);
        res.status(500).json({ error: 'Erro ao atualizar prefixo' });
    }
});

// Update server nickname
app.post('/api/server/:guildId/nickname', discordAuth.authenticateToken, checkServerPermission, async (req, res) => {
    const { guildId } = req.params;
    const { nickname } = req.body;
    
    if (nickname && nickname.length > 32) {
        return res.status(400).json({ error: 'Nickname inválido (máximo 32 caracteres)' });
    }
    
    try {
        const config = await dataStore.setServerNickname(guildId, nickname || '');
        
        // Notify bot if connected locally
        if (botClient && typeof botClient.updateServerNickname === 'function') {
            try {
                await botClient.updateServerNickname(guildId, config.nickname);
            } catch (err) {
                console.error('Erro ao atualizar nickname no Discord:', err);
                // Continue anyway - nickname update might fail due to permissions
            }
        }
        
        res.json({ success: true, nickname: config.nickname });
    } catch (error) {
        console.error('Erro ao atualizar nickname:', error);
        res.status(500).json({ error: 'Erro ao atualizar nickname' });
    }
});

// Get server channels
app.get('/api/server/:guildId/channels', discordAuth.authenticateToken, checkServerPermission, async (req, res) => {
    const { guildId } = req.params;
    try {
        // Try to get channels via bot client first (most reliable)
        if (botClient && botClient.guilds) {
            const guild = botClient.guilds.cache.get(guildId);
            if (guild) {
                const channels = guild.channels.cache
                    .filter(ch => ch.isTextBased())
                    .map(ch => ({ id: ch.id, name: ch.name, type: ch.type }));
                return res.json(channels);
            }
        }

        // Fallback: try with user token
        try {
            const token = await discordAuth.getValidAccessToken(req.user.user_id);
            if (token) {
                const channelsRes = await axios.get(`https://discord.com/api/guilds/${guildId}/channels`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const textChannels = channelsRes.data.filter(ch => ch.type === 0);
                return res.json(textChannels);
            }
        } catch (tokenError) {
            console.error('Erro ao buscar canais com token do usuário:', tokenError.message);
            // Continue to return empty array
        }

        // If bot is not in server or token failed, return empty array
        res.json([]);
    } catch (error) {
        console.error('Erro ao buscar canais:', error.message);
        // Return empty array instead of error to allow page to load
        res.json([]);
    }
});

// Update notification settings
app.post('/api/server/:guildId/notifications', discordAuth.authenticateToken, checkServerPermission, async (req, res) => {
    const { guildId } = req.params;
    const { type, enabled, channelId, message } = req.body;
    
    if (!type || (type !== 'memberJoin' && type !== 'memberLeave')) {
        return res.status(400).json({ error: 'Tipo de notificação inválido' });
    }
    
    try {
        const config = await dataStore.getServerConfig(guildId);
        if (!config.notifications) {
            config.notifications = {
                memberJoin: { enabled: false, channelId: null, message: '' },
                memberLeave: { enabled: false, channelId: null, message: '' }
            };
        }
        
        config.notifications[type] = {
            enabled: enabled || false,
            channelId: channelId || null,
            message: message || ''
        };
        
        await dataStore.updateServerConfig(guildId, { notifications: config.notifications });
        
        res.json({ success: true, notifications: config.notifications });
    } catch (error) {
        console.error('Erro ao atualizar notificações:', error);
        res.status(500).json({ error: 'Erro ao atualizar notificações' });
    }
});

// Update module status
app.post('/api/server/:guildId/module', discordAuth.authenticateToken, checkServerPermission, async (req, res) => {
    const { guildId } = req.params;
    const { module, enabled } = req.body;
    
    if (!module || typeof enabled !== 'boolean') {
        return res.status(400).json({ error: 'Parâmetros inválidos' });
    }
    
    try {
        const config = await dataStore.setModuleStatus(guildId, module, enabled);
        res.json({ success: true, modules: config.modules });
    } catch (error) {
        console.error('Erro ao atualizar módulo:', error);
        res.status(500).json({ error: 'Erro ao atualizar módulo' });
    }
});

// Get all user's servers with stats
app.get('/api/user/servers/stats', discordAuth.authenticateToken, async (req, res) => {
    try {
        const token = await discordAuth.getValidAccessToken(req.user.user_id);
        if (!token) {
            return res.status(401).json({ error: 'Sessão expirada' });
        }

        const guildsRes = await axios.get('https://discord.com/api/users/@me/guilds', {
            headers: { Authorization: `Bearer ${token}` }
        });

        const guilds = guildsRes.data.filter(guild => guild.permissions & 0x20); // Manage server permission
        
        const serversWithStats = guilds.map(guild => ({
            id: guild.id,
            name: guild.name,
            icon: guild.icon,
            ...dataStore.getServerStats(guild.id)
        }));

        res.json(serversWithStats);
    } catch (err) {
        console.error('Erro ao buscar servidores:', err.message);
        res.status(500).json({ error: 'Erro ao buscar servidores' });
    }
});

// Function to register bot instance
app.setBotClient = (client) => {
    botClient = client;
    console.log('✅ Bot client registrado no servidor web');
    
    // Start periodic data sync from bot to site
    if (client && typeof client.getStats === 'function') {
        setInterval(async () => {
            try {
                // Sync bot presence for all guilds
                if (client.guilds && client.guilds.cache) {
                    for (const [guildId, guild] of client.guilds.cache) {
                        await dataStore.markBotPresent(guildId, true);
                    }
                }
            } catch (error) {
                console.error('Erro na sincronização periódica:', error);
            }
        }, 60000); // Sync every minute
    }
};

// Endpoint for bot to sync data (protected with secret token)
app.post('/api/bot/sync', express.json(), async (req, res) => {
    const { secret, guilds, stats } = req.body;
    
    // Verify secret token
    if (secret !== process.env.BOT_SYNC_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
        // Sync bot presence for all guilds
        if (guilds && Array.isArray(guilds)) {
            for (const guildId of guilds) {
                await dataStore.markBotPresent(guildId, true);
            }
        }
        
        res.json({ success: true, message: 'Data synced successfully' });
    } catch (error) {
        console.error('Erro ao sincronizar dados do bot:', error);
        res.status(500).json({ error: 'Erro ao sincronizar dados' });
    }
});

// Endpoint for site to request bot data
app.get('/api/bot/data', discordAuth.authenticateToken, async (req, res) => {
    try {
        if (!botClient || typeof botClient.getStats !== 'function') {
            return res.json({ 
                available: false,
                message: 'Bot não está conectado'
            });
        }
        
        const stats = botClient.getStats();
        const guilds = botClient.guilds ? Array.from(botClient.guilds.cache.keys()) : [];
        
        // Sync bot presence
        for (const guildId of guilds) {
            await dataStore.markBotPresent(guildId, true);
        }
        
        res.json({
            available: true,
            stats,
            guilds,
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('Erro ao buscar dados do bot:', error);
        res.status(500).json({ error: 'Erro ao buscar dados do bot' });
    }
});

// Administrator routes
// Get all administrators
app.get('/api/admin/administrators', discordAuth.authenticateToken, checkAdministrator, async (req, res) => {
    try {
        let admins = [];
        if (useDatabase && db && db.getAllAdministrators) {
            admins = await db.getAllAdministrators();
        } else if (dataStore.getAllAdministrators) {
            admins = await dataStore.getAllAdministrators();
        }
        res.json(admins);
    } catch (error) {
        console.error('Erro ao buscar administradores:', error);
        res.status(500).json({ error: 'Erro ao buscar administradores' });
    }
});

// Add administrator (only owner can add)
app.post('/api/admin/administrators', discordAuth.authenticateToken, checkAdministrator, async (req, res) => {
    if (!req.isOwner) {
        return res.status(403).json({ error: 'Apenas o dono pode adicionar administradores' });
    }
    
    const { userId, role } = req.body;
    const addedBy = req.user.user_id;
    
    if (!userId) {
        return res.status(400).json({ error: 'ID do usuário é obrigatório' });
    }
    
    // Can't add owner as admin
    if (userId === OWNER_ID) {
        return res.status(400).json({ error: 'O dono já é administrador' });
    }
    
    try {
        let success = false;
        if (useDatabase && db && db.addAdministrator) {
            success = await db.addAdministrator(userId, addedBy, role || 'admin');
        } else if (dataStore.addAdministrator) {
            success = await dataStore.addAdministrator(userId, addedBy, role || 'admin');
        }
        
        if (success) {
            res.json({ success: true, message: 'Administrador adicionado com sucesso' });
        } else {
            res.status(500).json({ error: 'Erro ao adicionar administrador' });
        }
    } catch (error) {
        console.error('Erro ao adicionar administrador:', error);
        res.status(500).json({ error: 'Erro ao adicionar administrador' });
    }
});

// Remove administrator (only owner can remove)
app.delete('/api/admin/administrators/:userId', discordAuth.authenticateToken, checkAdministrator, async (req, res) => {
    if (!req.isOwner) {
        return res.status(403).json({ error: 'Apenas o dono pode remover administradores' });
    }
    
    const { userId } = req.params;
    
    // Can't remove owner
    if (userId === OWNER_ID) {
        return res.status(400).json({ error: 'Não é possível remover o dono' });
    }
    
    try {
        let success = false;
        if (useDatabase && db && db.removeAdministrator) {
            success = await db.removeAdministrator(userId);
        } else if (dataStore.removeAdministrator) {
            success = await dataStore.removeAdministrator(userId);
        }
        
        if (success) {
            res.json({ success: true, message: 'Administrador removido com sucesso' });
        } else {
            res.status(500).json({ error: 'Erro ao remover administrador' });
        }
    } catch (error) {
        console.error('Erro ao remover administrador:', error);
        res.status(500).json({ error: 'Erro ao remover administrador' });
    }
});

// Get all servers where bot is present
app.get('/api/admin/servers', discordAuth.authenticateToken, checkAdministrator, async (req, res) => {
    try {
        // Get all servers where bot is currently present
        const servers = [];
        
        if (botClient && botClient.guilds && botClient.guilds.cache) {
            // Iterate through all guilds where bot is present
            for (const [guildId, guild] of botClient.guilds.cache) {
                try {
                    // Get server config from database (if exists)
                    let serverConfig = null;
                    try {
                        serverConfig = await dataStore.getServerConfig(guildId);
                    } catch (err) {
                        // Server not in database yet, use defaults
                        serverConfig = null;
                    }
                    
                    // Format server data
                    servers.push({
                        guildId: guildId,
                        guildName: guild.name || 'Unknown',
                        guildIcon: guild.icon ? `https://cdn.discordapp.com/icons/${guildId}/${guild.icon}.png` : null,
                        memberCount: guild.memberCount || 0,
                        prefix: serverConfig?.prefix || '!',
                        botPresent: true, // Bot is definitely present
                        lastSeen: serverConfig?.lastSeen || new Date().toISOString(),
                        stats: {
                            commandsExecuted: serverConfig?.stats?.commandsExecuted || 0,
                            uniqueUsers: serverConfig?.stats?.uniqueUsers?.size || serverConfig?.stats?.uniqueUsers || 0
                        },
                        modules: serverConfig?.modules || {}
                    });
                } catch (err) {
                    console.error(`Erro ao processar servidor ${guildId}:`, err);
                    // Still add server with minimal info
                    servers.push({
                        guildId: guildId,
                        guildName: 'Error loading',
                        botPresent: true,
                        prefix: '!',
                        stats: { commandsExecuted: 0, uniqueUsers: 0 },
                        modules: {}
                    });
                }
            }
        } else {
            // Bot not connected, return empty array or servers from database
            const allServers = [];
            if (useDatabase && db && db.getAllServers) {
                const dbServers = await db.getAllServers();
                allServers.push(...dbServers);
            } else if (dataStore.getAllServers) {
                const dbServers = await dataStore.getAllServers();
                allServers.push(...dbServers);
            }
            
            // Format response
            for (const server of allServers) {
                servers.push({
                    guildId: server.guildId || server.guild_id,
                    guildName: 'Unknown',
                    prefix: server.prefix || '!',
                    botPresent: server.botPresent || false,
                    lastSeen: server.lastSeen || null,
                    stats: {
                        commandsExecuted: server.stats?.commandsExecuted || 0,
                        uniqueUsers: server.stats?.uniqueUsers || 0
                    },
                    modules: server.modules || {}
                });
            }
        }
        
        res.json(servers);
    } catch (error) {
        console.error('Erro ao buscar servidores:', error);
        res.status(500).json({ error: 'Erro ao buscar servidores' });
    }
});

// Rotas estáticas (sem extensão .html)
// IMPORTANTE: Estas rotas devem vir DEPOIS das rotas de API e ANTES do catch-all
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.get('/admin', discordAuth.authenticateToken, async (req, res) => {
    // Check if user is admin before serving page
    const userId = req.user?.user_id;
    
    if (!userId) {
        return res.redirect('/dashboard?error=unauthorized');
    }
    
    // Owner is always admin
    if (userId === OWNER_ID) {
        return res.sendFile(path.join(__dirname, 'public', 'admin.html'));
    }
    
    // Check if user is admin
    let isAdmin = false;
    if (useDatabase && db && db.isAdministrator) {
        isAdmin = await db.isAdministrator(userId);
    } else if (dataStore.isAdministrator) {
        isAdmin = await dataStore.isAdministrator(userId);
    }
    
    if (!isAdmin) {
        return res.redirect('/dashboard?error=access_denied');
    }
    
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Helper function to check if user is server owner or has permission
async function checkServerPermission(req, res, next) {
    const { guildId } = req.params;
    const userId = req.user?.user_id;
    
    if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
    }
    
    try {
        // Get user's guilds to check if they're owner
        const token = await discordAuth.getValidAccessToken(userId);
        if (!token) {
            return res.status(401).json({ error: 'Sessão expirada' });
        }
        
        const guildsRes = await axios.get('https://discord.com/api/users/@me/guilds', {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        const guild = guildsRes.data.find(g => g.id === guildId);
        if (!guild) {
            return res.status(404).json({ error: 'Servidor não encontrado' });
        }
        
        // Check if user is owner (owner field is true in Discord API)
        const isOwner = guild.owner === true;
        
        // Check if user has permission in database
        let hasPerm = false;
        if (useDatabase && db && db.hasPermission) {
            hasPerm = await db.hasPermission(guildId, userId);
        } else if (dataStore.hasPermission) {
            hasPerm = await dataStore.hasPermission(guildId, userId);
        }
        
        if (!isOwner && !hasPerm) {
            return res.status(403).json({ error: 'Você não tem permissão para configurar este servidor' });
        }
        
        req.isOwner = isOwner;
        req.guild = guild;
        next();
    } catch (error) {
        console.error('Erro ao verificar permissão:', error);
        return res.status(500).json({ error: 'Erro ao verificar permissão' });
    }
}

// Rota para página de configuração do servidor (deve vir depois das rotas de API)
app.get('/server/:guildId', discordAuth.authenticateToken, async (req, res) => {
    // Verificar se é uma requisição de arquivo estático (CSS, JS, etc)
    const requestedPath = req.path;
    if (requestedPath.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/i)) {
        // Se for um arquivo estático, não processar como rota dinâmica
        return res.status(404).send('Not found');
    }
    
    // Check permissions before serving page
    const { guildId } = req.params;
    const userId = req.user?.user_id;
    
    if (!userId) {
        return res.redirect('/dashboard?error=unauthorized');
    }
    
    try {
        const token = await discordAuth.getValidAccessToken(userId);
        if (!token) {
            return res.redirect('/dashboard?error=session_expired');
        }
        
        const guildsRes = await axios.get('https://discord.com/api/users/@me/guilds', {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        const guild = guildsRes.data.find(g => g.id === guildId);
        if (!guild) {
            return res.redirect('/dashboard?error=server_not_found');
        }
        
        const isOwner = guild.owner === true;
        let hasPerm = false;
        
        // Check database permissions
        if (useDatabase && db && db.hasPermission) {
            hasPerm = await db.hasPermission(guildId, userId);
        } else if (dataStore.hasPermission) {
            hasPerm = dataStore.hasPermission(guildId, userId);
        }
        
        if (!isOwner && !hasPerm) {
            return res.redirect('/dashboard?error=no_permission');
        }
        
        res.sendFile(path.join(__dirname, 'public', 'server-config.html'));
    } catch (error) {
        console.error('Erro ao verificar permissão:', error);
        return res.redirect('/dashboard?error=permission_check_failed');
    }
});

app.listen(PORT, () => {
    console.log(`🌐 Servidor web rodando na porta ${PORT}`);
    
    // Try to start bot if token is available
    if (process.env.DISCORD_BOT_TOKEN) {
        try {
            const bot = require('./bot/index');
            app.setBotClient(bot);
        } catch (error) {
            console.warn('⚠️  Bot não pôde ser iniciado:', error.message);
            console.log('💡 Para iniciar o bot separadamente, execute: cd bot && npm start');
        }
    } else {
        console.log('💡 Para iniciar o bot, configure DISCORD_BOT_TOKEN no .env');
    }
});
