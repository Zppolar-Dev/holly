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
        
        // Method 1: Check via bot client (most reliable - check cache first)
        if (botClient && botClient.guilds && botClient.guilds.cache) {
            const guild = botClient.guilds.cache.get(guildId);
            if (guild) {
                // Bot is definitely in the server
                return res.json({ present: true });
            }
        }
        
        // Method 2: Check dataStore - if config exists with activity, bot is/was there
        try {
            const config = await dataStore.getServerConfig(guildId);
            if (config) {
                // Check for signs of bot activity
                const hasActivity = config.stats.commandsExecuted > 0 || 
                                  config.prefix !== '!' ||
                                  (config.stats.uniqueUsers && 
                                   ((config.stats.uniqueUsers instanceof Set && config.stats.uniqueUsers.size > 0) ||
                                    (Array.isArray(config.stats.uniqueUsers) && config.stats.uniqueUsers.length > 0)));
                
                // If bot client is not available, trust dataStore if has activity
                if (!botClient || !botClient.guilds) {
                    present = hasActivity; // Only trust if has activity
                } else {
                    // Bot client available but guild not in cache
                    // If has activity, bot was definitely there (might have left recently)
                    // If no activity, assume bot is not in server (config might be from old data)
                    present = hasActivity;
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
