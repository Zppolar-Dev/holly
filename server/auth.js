const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const REDIRECT_URI = `${BASE_URL}/auth/discord/callback`;
const FRONTEND_URL = process.env.FRONTEND_URL || BASE_URL;
const JWT_SECRET = process.env.JWT_SECRET || 'uma_chave_bem_segura';

// TODO: trocar por Redis/DB quando disponível
const sessionStore = new Map();

function authenticateToken(req, res, next) {
    const token = req.cookies.holly_token;
    if (!token) return res.status(401).json({ error: 'Não autorizado' });

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = payload;
        return next();
    } catch (err) {
        return res.status(403).json({ error: 'Token inválido ou expirado' });
    }
}

function login(req, res) {
    const params = new URLSearchParams({
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        scope: 'identify guilds'
    });

    return res.redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`);
}

async function callback(req, res) {
    try {
        const { code } = req.query;
        if (!code) {
            return res.redirect(`${FRONTEND_URL}/dashboard.html?error=no_code`);
        }

        const tokenResponse = await axios.post(
            'https://discord.com/api/oauth2/token',
            new URLSearchParams({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                grant_type: 'authorization_code',
                code,
                redirect_uri: REDIRECT_URI
            }),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        const { access_token, refresh_token, expires_in } = tokenResponse.data;

        const userRes = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${access_token}` }
        });

        const userId = userRes.data.id;
        sessionStore.set(userId, {
            access_token,
            refresh_token,
            expires_at: Date.now() + expires_in * 1000
        });

        const jwtToken = jwt.sign({ user_id: userId }, JWT_SECRET, { expiresIn: '7d' });

        res.cookie('holly_token', jwtToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        return res.redirect(`${FRONTEND_URL}/dashboard.html`);
    } catch (err) {
        console.error('Erro no callback:', err.response?.data || err.message);
        return res.redirect(`${FRONTEND_URL}/dashboard.html?error=auth_failed`);
    }
}

async function refreshAccessToken(userId, session) {
    try {
        const tokenResponse = await axios.post(
            'https://discord.com/api/oauth2/token',
            new URLSearchParams({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                grant_type: 'refresh_token',
                refresh_token: session.refresh_token
            }),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        const { access_token, refresh_token, expires_in } = tokenResponse.data;

        sessionStore.set(userId, {
            access_token,
            refresh_token,
            expires_at: Date.now() + expires_in * 1000
        });

        console.log(`🔄 Token do Discord renovado para usuário ${userId}`);
        return access_token;
    } catch (err) {
        console.error('Erro ao renovar token do Discord:', err.response?.data || err.message);
        sessionStore.delete(userId);
        return null;
    }
}

async function getValidAccessToken(userId) {
    const session = sessionStore.get(userId);
    if (!session) return null;

    if (Date.now() >= session.expires_at) {
        return refreshAccessToken(userId, session);
    }

    return session.access_token;
}

function logout(req, res) {
    if (req.user?.user_id) {
        sessionStore.delete(req.user.user_id);
    }

    res.clearCookie('holly_token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/'
    });

    return res.status(200).json({ message: 'Logout realizado com sucesso' });
}

async function getUserData(req, res) {
    try {
        const token = await getValidAccessToken(req.user.user_id);
        if (!token) {
            return res.status(401).json({ error: 'Sessão expirada' });
        }

        const userRes = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${token}` }
        });

        return res.json({ ...userRes.data, plan: 'free' });
    } catch (err) {
        console.error('Erro ao buscar usuário:', err.message);
        return res.status(500).json({ error: 'Erro ao buscar usuário' });
    }
}

async function getUserGuilds(req, res) {
    try {
        const token = await getValidAccessToken(req.user.user_id);
        if (!token) {
            return res.status(401).json({ error: 'Sessão expirada' });
        }

        const guildsRes = await axios.get('https://discord.com/api/users/@me/guilds', {
            headers: { Authorization: `Bearer ${token}` }
        });

        return res.json(guildsRes.data);
    } catch (err) {
        console.error('Erro ao buscar servidores:', err.message);
        return res.status(500).json({ error: 'Erro ao buscar servidores' });
    }
}

module.exports = {
    authenticateToken,
    login,
    callback,
    logout,
    getUserData,
    getUserGuilds,
    getValidAccessToken
};

