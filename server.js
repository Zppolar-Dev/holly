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
app.get('/api/server/:guildId/stats', discordAuth.authenticateToken, (req, res) => {
    const { guildId } = req.params;
    // Reload data from file to ensure we have the latest
    dataStore.loadData();
    const stats = dataStore.getServerStats(guildId);
    res.json(stats);
});

// Get server configuration
app.get('/api/server/:guildId/config', discordAuth.authenticateToken, (req, res) => {
    const { guildId } = req.params;
    // Reload data from file to ensure we have the latest
    dataStore.loadData();
    const config = dataStore.getServerConfig(guildId);
    // Convert Set to array for JSON response
    const response = {
        ...config,
        stats: {
            ...config.stats,
            uniqueUsers: config.stats.uniqueUsers.size
        }
    };
    res.json(response);
});

// Update server prefix
app.post('/api/server/:guildId/prefix', discordAuth.authenticateToken, async (req, res) => {
    const { guildId } = req.params;
    const { prefix } = req.body;
    
    if (!prefix || prefix.length > 5) {
        return res.status(400).json({ error: 'Prefix inválido (máximo 5 caracteres)' });
    }
    
    const config = dataStore.setServerPrefix(guildId, prefix);
    
    // Notify bot if connected locally
    if (botClient && typeof botClient.updateServerPrefix === 'function') {
        botClient.updateServerPrefix(guildId, prefix);
    }
    
    // If running in production, try to sync with bot via API
    if (process.env.NODE_ENV === 'production' && process.env.BOT_API_URL) {
        try {
            const apiSync = require('./server/api-sync');
            await apiSync.syncToBot(guildId, { prefix });
        } catch (error) {
            console.warn('Erro ao sincronizar com bot:', error.message);
        }
    }
    
    res.json({ success: true, prefix: config.prefix });
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

// Rotas estáticas
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/dashboard.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));

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
