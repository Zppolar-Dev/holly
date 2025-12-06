const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const axios = require('axios');
require('dotenv').config();

const discordAuth = require('./server/auth');
const dataStore = require('./server/dataStore');

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors({ origin: FRONTEND_URL, credentials: true }));
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
app.get('/api/server/:guildId/config', discordAuth.authenticateToken, async (req, res) => {
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

// Update server prefix
app.post('/api/server/:guildId/prefix', discordAuth.authenticateToken, async (req, res) => {
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
app.post('/api/server/:guildId/nickname', discordAuth.authenticateToken, async (req, res) => {
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
app.get('/api/server/:guildId/channels', discordAuth.authenticateToken, async (req, res) => {
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
        const token = await discordAuth.getValidAccessToken(req.user.user_id);
        if (token) {
            const channelsRes = await axios.get(`https://discord.com/api/guilds/${guildId}/channels`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const textChannels = channelsRes.data.filter(ch => ch.type === 0);
            return res.json(textChannels);
        }

        res.json([]);
    } catch (error) {
        console.error('Erro ao buscar canais:', error);
        res.status(500).json({ error: 'Erro ao buscar canais' });
    }
});

// Update notification settings
app.post('/api/server/:guildId/notifications', discordAuth.authenticateToken, async (req, res) => {
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
app.post('/api/server/:guildId/module', discordAuth.authenticateToken, (req, res) => {
    const { guildId } = req.params;
    const { module, enabled } = req.body;
    
    if (!module || typeof enabled !== 'boolean') {
        return res.status(400).json({ error: 'Parâmetros inválidos' });
    }
    
    const config = dataStore.setModuleStatus(guildId, module, enabled);
    res.json({ success: true, modules: config.modules });
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
};

// Rotas estáticas (sem extensão .html)
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.get('/server/:guildId', (req, res) => res.sendFile(path.join(__dirname, 'public', 'server-config.html')));

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
