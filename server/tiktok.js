/**
 * TikTok Integration Module (Alternative Method)
 * Uses web scraping to get TikTok user info and videos
 * ⚠️ Note: This method may violate TikTok's Terms of Service. Use at your own risk.
 */

const axios = require('axios');
const cheerio = require('cheerio');

// Polling interval (5 minutes)
const POLLING_INTERVAL = 5 * 60 * 1000;

// Store for tracking last checked videos/lives
let pollingInterval = null;
let db = null;
let botClient = null;

// User agent para evitar bloqueios
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Initialize TikTok polling system
 */
function initTikTokPolling(database, bot) {
    db = database;
    botClient = bot;
    
    if (!db || !botClient) {
        console.warn('⚠️ TikTok polling não iniciado: banco de dados ou bot não disponível');
        return;
    }
    
    console.log('🎵 Sistema de polling TikTok inicializado (método alternativo)');
    
    // Start polling immediately, then every 5 minutes
    checkTikTokUpdates();
    pollingInterval = setInterval(checkTikTokUpdates, POLLING_INTERVAL);
}

/**
 * Check for TikTok updates for all enabled servers
 */
async function checkTikTokUpdates() {
    try {
        if (!db || !db.getTikTokEnabledServers) {
            return;
        }
        
        const servers = await db.getTikTokEnabledServers();
        
        if (servers.length === 0) {
            return;
        }
        
        console.log(`🔍 Verificando ${servers.length} perfil(is) TikTok...`);
        
        for (const server of servers) {
            try {
                await checkServerTikTok(server);
                // Pequeno delay entre requisições para evitar rate limit
                await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (error) {
                console.error(`❌ Erro ao verificar TikTok para servidor ${server.guildId}:`, error.message);
            }
        }
    } catch (error) {
        console.error('❌ Erro ao verificar atualizações do TikTok:', error.message);
    }
}

/**
 * Check TikTok updates for a specific server
 */
async function checkServerTikTok(server) {
    const { guildId, tiktok } = server;
    const username = tiktok.username;
    
    if (!username) {
        return;
    }
    
    try {
        const userInfo = await getTikTokUserInfo(username);
        
        if (!userInfo) {
            return;
        }
        
        // Check for new videos
        if (tiktok.notifyVideo && userInfo.latestVideo) {
            const latestVideoId = userInfo.latestVideo.id;
            
            if (latestVideoId && latestVideoId !== tiktok.lastVideoId) {
                // New video detected!
                console.log(`🎥 Novo vídeo detectado para @${username}: ${latestVideoId}`);
                await sendTikTokNotification(guildId, tiktok, 'video', userInfo.latestVideo);
                
                // Update last video ID
                await db.updateTikTokConfig(guildId, {
                    ...tiktok,
                    lastVideoId: latestVideoId
                });
            }
        }
        
        // Check for live status
        if (tiktok.notifyLive) {
            const isLive = userInfo.isLive || false;
            
            if (isLive && !tiktok.lastLiveStatus) {
                // Live started!
                console.log(`🔴 Live detectada para @${username}`);
                await sendTikTokNotification(guildId, tiktok, 'live', {
                    username: username,
                    title: userInfo.liveTitle || 'Live em andamento'
                });
                
                // Update live status
                await db.updateTikTokConfig(guildId, {
                    ...tiktok,
                    lastLiveStatus: true
                });
            } else if (!isLive && tiktok.lastLiveStatus) {
                // Live ended (update status but don't notify)
                await db.updateTikTokConfig(guildId, {
                    ...tiktok,
                    lastLiveStatus: false
                });
            }
        }
    } catch (error) {
        console.error(`❌ Erro ao verificar TikTok para ${username}:`, error.message);
    }
}

/**
 * Get TikTok user info using web scraping
 * This method scrapes the TikTok profile page to get user info and latest videos
 */
async function getTikTokUserInfo(username) {
    const cleanUsername = username.replace('@', '').trim();
    
    if (!cleanUsername) {
        return null;
    }
    
    try {
        console.log(`🔍 Buscando informações do TikTok para @${cleanUsername}...`);
        
        // URL do perfil do TikTok
        const profileUrl = `https://www.tiktok.com/@${cleanUsername}`;
        
        // Fazer requisição com headers para parecer um navegador
        const response = await axios.get(profileUrl, {
            headers: {
                'User-Agent': USER_AGENT,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Referer': 'https://www.tiktok.com/',
                'Origin': 'https://www.tiktok.com'
            },
            timeout: 10000,
            validateStatus: function (status) {
                return status < 500; // Aceitar qualquer status < 500
            }
        });
        
        if (response.status === 404) {
            console.error(`❌ Usuário @${cleanUsername} não encontrado`);
            return null;
        }
        
        if (response.status !== 200) {
            console.error(`❌ Erro ao acessar perfil: Status ${response.status}`);
            return null;
        }
        
        // Parse HTML com cheerio
        const $ = cheerio.load(response.data);
        
        // Tentar extrair dados do JSON embutido na página
        let userData = null;
        let latestVideo = null;
        let isLive = false;
        
        // TikTok geralmente coloca dados em um script tag com id="__UNIVERSAL_DATA_FOR_REHYDRATION__"
        const scriptTags = $('script#__UNIVERSAL_DATA_FOR_REHYDRATION__');
        
        if (scriptTags.length > 0) {
            try {
                const jsonData = JSON.parse(scriptTags.html());
                
                // Navegar pela estrutura de dados do TikTok
                if (jsonData['__DEFAULT_SCOPE__'] && 
                    jsonData['__DEFAULT_SCOPE__']['webapp.user-detail'] &&
                    jsonData['__DEFAULT_SCOPE__']['webapp.user-detail']['userInfo']) {
                    
                    const userInfo = jsonData['__DEFAULT_SCOPE__']['webapp.user-detail']['userInfo'];
                    userData = {
                        username: userInfo.user?.uniqueId || cleanUsername,
                        displayName: userInfo.user?.nickname || cleanUsername,
                        avatar: userInfo.user?.avatarMedium || '',
                        followerCount: userInfo.stats?.followerCount || 0,
                        videoCount: userInfo.stats?.videoCount || 0
                    };
                }
                
                // Buscar vídeos
                if (jsonData['__DEFAULT_SCOPE__'] && 
                    jsonData['__DEFAULT_SCOPE__']['webapp.user-detail'] &&
                    jsonData['__DEFAULT_SCOPE__']['webapp.user-detail']['itemList']) {
                    
                    const videos = jsonData['__DEFAULT_SCOPE__']['webapp.user-detail']['itemList'];
                    if (videos && videos.length > 0) {
                        const video = videos[0];
                        latestVideo = {
                            id: video.id || video.itemId || null,
                            title: video.desc || '',
                            description: video.desc || '',
                            url: `https://www.tiktok.com/@${cleanUsername}/video/${video.id || video.itemId}`,
                            thumbnail: video.video?.cover || video.video?.dynamicCover || '',
                            createdAt: video.createTime || Date.now()
                        };
                    }
                }
                
                // Verificar se está em live
                if (jsonData['__DEFAULT_SCOPE__'] && 
                    jsonData['__DEFAULT_SCOPE__']['webapp.user-detail'] &&
                    jsonData['__DEFAULT_SCOPE__']['webapp.user-detail']['userInfo'] &&
                    jsonData['__DEFAULT_SCOPE__']['webapp.user-detail']['userInfo']['user']) {
                    
                    isLive = jsonData['__DEFAULT_SCOPE__']['webapp.user-detail']['userInfo']['user']['isLive'] || false;
                }
            } catch (parseError) {
                console.warn(`⚠️ Erro ao parsear JSON do TikTok:`, parseError.message);
            }
        }
        
        // Fallback: tentar extrair de outros scripts
        if (!userData || !latestVideo) {
            // Buscar em todos os scripts
            $('script').each((i, elem) => {
                const scriptContent = $(elem).html();
                if (scriptContent && scriptContent.includes('"userInfo"')) {
                    try {
                        // Tentar encontrar JSON válido
                        const jsonMatch = scriptContent.match(/window\.__UNIVERSAL_DATA_FOR_REHYDRATION__\s*=\s*({.+?});/s);
                        if (jsonMatch) {
                            const jsonData = JSON.parse(jsonMatch[1]);
                            // Processar dados similar ao acima
                        }
                    } catch (e) {
                        // Ignorar erros de parse
                    }
                }
            });
        }
        
        // Se ainda não encontrou, tentar método alternativo: buscar via API não oficial
        if (!latestVideo) {
            latestVideo = await getLatestVideoAlternative(cleanUsername);
        }
        
        if (!userData) {
            userData = {
                username: cleanUsername,
                displayName: cleanUsername,
                avatar: '',
                followerCount: 0,
                videoCount: 0
            };
        }
        
        console.log(`✅ Informações obtidas para @${cleanUsername}${latestVideo ? ` - Último vídeo: ${latestVideo.id}` : ''}`);
        
        return {
            ...userData,
            latestVideo: latestVideo,
            isLive: isLive
        };
        
    } catch (error) {
        console.error(`❌ Erro ao buscar informações do TikTok para @${cleanUsername}:`, error.message);
        
        if (error.response) {
            console.error(`   Status: ${error.response.status}`);
        }
        
        return null;
    }
}

/**
 * Método alternativo: buscar último vídeo via API não oficial
 */
async function getLatestVideoAlternative(username) {
    try {
        // Usar API pública não oficial do TikTok (pode não funcionar sempre)
        const apiUrl = `https://www.tiktok.com/api/user/detail/?uniqueId=${username}`;
        
        const response = await axios.get(apiUrl, {
            headers: {
                'User-Agent': USER_AGENT,
                'Referer': `https://www.tiktok.com/@${username}`
            },
            timeout: 5000
        });
        
        if (response.data && response.data.userInfo && response.data.userInfo.user) {
            // Buscar vídeos do usuário
            const videoUrl = `https://www.tiktok.com/api/post/item_list/?secUid=${response.data.userInfo.user.secUid}&count=1`;
            const videoResponse = await axios.get(videoUrl, {
                headers: {
                    'User-Agent': USER_AGENT,
                    'Referer': `https://www.tiktok.com/@${username}`
                },
                timeout: 5000
            });
            
            if (videoResponse.data && videoResponse.data.itemList && videoResponse.data.itemList.length > 0) {
                const video = videoResponse.data.itemList[0];
                return {
                    id: video.id || video.itemId,
                    title: video.desc || '',
                    description: video.desc || '',
                    url: `https://www.tiktok.com/@${username}/video/${video.id || video.itemId}`,
                    thumbnail: video.video?.cover || video.video?.dynamicCover || '',
                    createdAt: video.createTime || Date.now()
                };
            }
        }
    } catch (error) {
        // Ignorar erros do método alternativo
        console.warn(`⚠️ Método alternativo falhou para @${username}:`, error.message);
    }
    
    return null;
}

/**
 * Send TikTok notification to Discord
 */
async function sendTikTokNotification(guildId, tiktokConfig, type, data) {
    try {
        if (!botClient || !botClient.guilds) {
            console.warn('⚠️ Bot client não disponível para enviar notificação TikTok');
            return;
        }
        
        const guild = botClient.guilds.cache.get(guildId);
        if (!guild) {
            console.warn(`⚠️ Servidor ${guildId} não encontrado`);
            return;
        }
        
        const channel = guild.channels.cache.get(tiktokConfig.channelId);
        if (!channel) {
            console.warn(`⚠️ Canal ${tiktokConfig.channelId} não encontrado no servidor ${guildId}`);
            return;
        }
        
        const { EmbedBuilder } = require('discord.js');
        
        if (type === 'video') {
            const embed = new EmbedBuilder()
                .setTitle('🎥 Novo Vídeo do TikTok!')
                .setDescription(`**@${tiktokConfig.username}** acabou de postar um novo vídeo!`)
                .setURL(data.url || `https://www.tiktok.com/@${tiktokConfig.username}`)
                .setColor(0x000000) // TikTok black
                .setTimestamp();
            
            if (data.title) {
                embed.addFields({ name: 'Título', value: data.title.substring(0, 256) || 'Sem título' });
            }
            
            if (data.thumbnail) {
                embed.setThumbnail(data.thumbnail);
            }
            
            embed.setFooter({ text: `TikTok • @${tiktokConfig.username}` });
            
            await channel.send({
                content: `🎥 **Novo vídeo do TikTok!**\n\n@${tiktokConfig.username} acabou de postar um novo vídeo!`,
                embeds: [embed]
            });
            
        } else if (type === 'live') {
            const embed = new EmbedBuilder()
                .setTitle('🔴 Live Iniciada!')
                .setDescription(`**@${tiktokConfig.username}** está ao vivo agora!\n\n[Assistir Live](https://www.tiktok.com/@${tiktokConfig.username}/live)`)
                .setURL(`https://www.tiktok.com/@${tiktokConfig.username}/live`)
                .setColor(0xFF0050) // TikTok red
                .setTimestamp()
                .setFooter({ text: `TikTok Live • @${tiktokConfig.username}` });
            
            await channel.send({
                content: `🔴 **Live iniciada!**\n\n@${tiktokConfig.username} está ao vivo agora!`,
                embeds: [embed]
            });
        }
        
        console.log(`✅ Notificação TikTok enviada para servidor ${guildId} (${type})`);
    } catch (error) {
        console.error(`❌ Erro ao enviar notificação TikTok para servidor ${guildId}:`, error.message);
    }
}

/**
 * Stop TikTok polling
 */
function stopTikTokPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
        console.log('🛑 Sistema de polling TikTok parado');
    }
}

module.exports = {
    initTikTokPolling,
    stopTikTokPolling,
    checkTikTokUpdates,
    checkServerTikTok
};
