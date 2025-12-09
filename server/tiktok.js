/**
 * TikTok Integration Module (Alternative Method)
 * Uses web scraping to get TikTok user info and videos
 * ⚠️ Note: This method may violate TikTok's Terms of Service. Use at your own risk.
 */

const axios = require('axios');
const cheerio = require('cheerio');

// Polling interval (2 minutes for faster detection, can be changed back to 5 minutes)
const POLLING_INTERVAL = 2 * 60 * 1000;

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
    
    if (!db) {
        console.warn('⚠️ TikTok polling não iniciado: banco de dados não disponível');
        return;
    }
    
    if (!botClient) {
        console.warn('⚠️ TikTok polling não iniciado: bot client não disponível');
        return;
    }
    
    console.log('🎵 Sistema de polling TikTok inicializado (método alternativo)');
    console.log(`   - Intervalo de polling: ${POLLING_INTERVAL / 1000 / 60} minutos`);
    console.log(`   - Banco de dados: ${db ? '✅' : '❌'}`);
    console.log(`   - Bot client: ${botClient ? '✅' : '❌'}`);
    
    // Start polling immediately, then every 2 minutes
    console.log('🔄 Executando primeira verificação do TikTok...');
    checkTikTokUpdates().catch(err => {
        console.error('❌ Erro na primeira verificação do TikTok:', err.message);
    });
    
    pollingInterval = setInterval(() => {
        checkTikTokUpdates().catch(err => {
            console.error('❌ Erro no polling do TikTok:', err.message);
        });
    }, POLLING_INTERVAL);
    
    console.log(`✅ Polling TikTok configurado para executar a cada ${POLLING_INTERVAL / 1000 / 60} minutos`);
}

/**
 * Check for TikTok updates for all enabled servers
 */
async function checkTikTokUpdates() {
    try {
        if (!db || !db.getTikTokEnabledServers) {
            console.warn('⚠️ TikTok polling: banco de dados não disponível');
            return;
        }
        
        const servers = await db.getTikTokEnabledServers();
        
        if (servers.length === 0) {
            console.log('ℹ️ Nenhum servidor com TikTok habilitado encontrado');
            return;
        }
        
        console.log(`🔍 Verificando ${servers.length} perfil(is) TikTok...`);
        
        for (const server of servers) {
            try {
                console.log(`📡 Verificando servidor ${server.guildId} - @${server.tiktok?.username || 'N/A'}`);
                await checkServerTikTok(server);
                // Pequeno delay entre requisições para evitar rate limit
                await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (error) {
                console.error(`❌ Erro ao verificar TikTok para servidor ${server.guildId}:`, error.message);
                console.error(error.stack);
            }
        }
        
        console.log('✅ Verificação TikTok concluída');
    } catch (error) {
        console.error('❌ Erro ao verificar atualizações do TikTok:', error.message);
        console.error(error.stack);
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
            const currentLastVideoId = tiktok.lastVideoId || null;
            
            console.log(`📹 Verificando vídeo para @${username}:`);
            console.log(`   - Último vídeo salvo: ${currentLastVideoId || 'Nenhum'}`);
            console.log(`   - Último vídeo encontrado: ${latestVideoId || 'Nenhum'}`);
            
            if (latestVideoId && latestVideoId !== currentLastVideoId) {
                // New video detected!
                console.log(`🎥 ✅ NOVO VÍDEO DETECTADO para @${username}: ${latestVideoId}`);
                console.log(`   - Título: ${userInfo.latestVideo.title || 'Sem título'}`);
                console.log(`   - URL: ${userInfo.latestVideo.url || 'N/A'}`);
                
                try {
                    await sendTikTokNotification(guildId, tiktok, 'video', {
                        ...userInfo.latestVideo,
                        username: userInfo.username || username,
                        displayName: userInfo.displayName || username,
                        avatar: userInfo.avatar || '',
                        followerCount: userInfo.followerCount || 0,
                        videoCount: userInfo.videoCount || 0
                    });
                    
                    // Update last video ID
                    await db.updateTikTokConfig(guildId, {
                        ...tiktok,
                        lastVideoId: latestVideoId
                    });
                    
                    console.log(`✅ Notificação enviada e lastVideoId atualizado para ${latestVideoId}`);
                } catch (notifError) {
                    console.error(`❌ Erro ao enviar notificação:`, notifError.message);
                    console.error(notifError.stack);
                }
            } else if (latestVideoId === currentLastVideoId) {
                console.log(`ℹ️ Nenhum novo vídeo para @${username} (último vídeo já processado)`);
            } else if (!latestVideoId) {
                console.warn(`⚠️ Nenhum vídeo encontrado para @${username}`);
            }
        } else if (tiktok.notifyVideo && !userInfo.latestVideo) {
            console.warn(`⚠️ notifyVideo está habilitado mas nenhum vídeo foi encontrado para @${username}`);
        }
        
        // Check for live status
        if (tiktok.notifyLive) {
            const isLive = userInfo.isLive || false;
            
            if (isLive && !tiktok.lastLiveStatus) {
                // Live started!
                console.log(`🔴 Live detectada para @${username}`);
                await sendTikTokNotification(guildId, tiktok, 'live', {
                    username: userInfo.username || username,
                    displayName: userInfo.displayName || username,
                    avatar: userInfo.avatar || '',
                    followerCount: userInfo.followerCount || 0,
                    videoCount: userInfo.videoCount || 0,
                    title: userInfo.liveTitle || 'Live em andamento',
                    url: `https://www.tiktok.com/@${username}/live`
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
        
        console.log(`✅ Informações obtidas para @${cleanUsername}:`);
        console.log(`   - Username: ${userData.username}`);
        console.log(`   - Display Name: ${userData.displayName}`);
        console.log(`   - Seguidores: ${userData.followerCount}`);
        console.log(`   - Vídeos: ${userData.videoCount}`);
        console.log(`   - Último vídeo: ${latestVideo ? `${latestVideo.id} - ${latestVideo.title || 'Sem título'}` : 'Nenhum'}`);
        console.log(`   - Em live: ${isLive ? 'Sim' : 'Não'}`);
        
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
        
        // Helper function to format numbers (e.g., 1200000 -> 1.2M)
        const formatNumber = (num) => {
            if (num >= 1000000) {
                return (num / 1000000).toFixed(1) + 'M';
            } else if (num >= 1000) {
                return (num / 1000).toFixed(1) + 'K';
            }
            return num.toString();
        };
        
        // Replace placeholders in messages - different for video and live
        const replacePlaceholders = (text) => {
            if (!text) return '';
            
            // Base replacements (always available)
            let processedText = text
                .replace(/\{username\}/g, data.username || tiktokConfig.username)
                .replace(/\{profile\.name\}/g, data.displayName || data.username || tiktokConfig.username)
                .replace(/\{profile\.url\}/g, `https://www.tiktok.com/@${tiktokConfig.username}`)
                .replace(/\{profile\.avatar\}/g, data.avatar || '')
                .replace(/\{profile\.followers\}/g, formatNumber(data.followerCount || 0))
                .replace(/\{profile\.videos\}/g, formatNumber(data.videoCount || 0));
            
            // Type-specific replacements
            if (type === 'video') {
                // Video placeholders only
                processedText = processedText
                    .replace(/\{video\.title\}/g, data.title || 'Novo Vídeo')
                    .replace(/\{video\.url\}/g, data.url || `https://www.tiktok.com/@${tiktokConfig.username}`)
                    .replace(/\{video\.thumbnail\}/g, data.thumbnail || '')
                    .replace(/\{video\.id\}/g, data.id || '')
                    .replace(/\{video\.description\}/g, data.description || data.title || '');
            } else if (type === 'live') {
                // Live placeholders only
                processedText = processedText
                    .replace(/\{live\.title\}/g, data.title || 'Live em andamento')
                    .replace(/\{live\.url\}/g, data.url || `https://www.tiktok.com/@${tiktokConfig.username}/live`)
                    .replace(/\{live\.viewers\}/g, formatNumber(data.viewers || 0));
            }
            
            return processedText;
        };
        
        if (type === 'video') {
            const message = tiktokConfig.videoMessage || `🎥 **Novo vídeo do TikTok!**\n\n@${tiktokConfig.username} acabou de postar um novo vídeo!`;
            const customEmbed = tiktokConfig.videoEmbed;
            
            let embed = null;
            
            if (customEmbed && (customEmbed.title || customEmbed.description)) {
                // Use custom embed
                embed = new EmbedBuilder();
                
                if (customEmbed.title) {
                    embed.setTitle(replacePlaceholders(customEmbed.title));
                    if (customEmbed.titleUrl) {
                        embed.setURL(replacePlaceholders(customEmbed.titleUrl));
                    }
                }
                
                if (customEmbed.description) {
                    embed.setDescription(replacePlaceholders(customEmbed.description));
                }
                
                if (customEmbed.color) {
                    embed.setColor(parseInt(customEmbed.color.replace('#', ''), 16));
                } else {
                    embed.setColor(0x000000); // TikTok black
                }
                
                if (customEmbed.thumbnail && customEmbed.thumbnail.url) {
                    const thumbnailUrl = replacePlaceholders(customEmbed.thumbnail.url);
                    if (thumbnailUrl) {
                        embed.setThumbnail(thumbnailUrl);
                    }
                } else if (data.thumbnail && type === 'video') {
                    embed.setThumbnail(data.thumbnail);
                }
                
                if (customEmbed.image && customEmbed.image.url) {
                    const imageUrl = replacePlaceholders(customEmbed.image.url);
                    if (imageUrl) {
                        embed.setImage(imageUrl);
                    }
                } else if (data.thumbnail && type === 'video') {
                    // Use video thumbnail as image if no custom image
                    embed.setImage(data.thumbnail);
                }
                
                if (customEmbed.footer && customEmbed.footer.text) {
                    embed.setFooter({ 
                        text: replacePlaceholders(customEmbed.footer.text),
                        iconURL: customEmbed.footer.icon_url ? replacePlaceholders(customEmbed.footer.icon_url) : undefined
                    });
                } else {
                    embed.setFooter({ text: `TikTok • @${tiktokConfig.username}` });
                }
                
                if (customEmbed.fields && Array.isArray(customEmbed.fields)) {
                    customEmbed.fields.forEach(field => {
                        if (field.name && field.value) {
                            embed.addFields({ 
                                name: replacePlaceholders(field.name), 
                                value: replacePlaceholders(field.value),
                                inline: field.inline || false
                            });
                        }
                    });
                }
                
                embed.setTimestamp();
            } else {
                // Default embed
                embed = new EmbedBuilder()
                    .setTitle('🎥 Novo Vídeo do TikTok!')
                    .setDescription(`**@${tiktokConfig.username}** acabou de postar um novo vídeo!`)
                    .setURL(data.url || `https://www.tiktok.com/@${tiktokConfig.username}`)
                    .setColor(0x000000)
                    .setTimestamp();
                
                if (data.thumbnail) {
                    embed.setThumbnail(data.thumbnail);
                }
                
                embed.setFooter({ text: `TikTok • @${tiktokConfig.username}` });
            }
            
            const messageOptions = {
                content: replacePlaceholders(message),
                embeds: embed ? [embed] : []
            };
            
            const sentMessage = await channel.send(messageOptions);
            
            // Delete after specified time
            if (tiktokConfig.videoDeleteAfter && tiktokConfig.videoDeleteAfter > 0) {
                setTimeout(() => {
                    sentMessage.delete().catch(() => {});
                }, tiktokConfig.videoDeleteAfter * 1000);
            }
            
        } else if (type === 'live') {
            const message = tiktokConfig.liveMessage || `🔴 **Live iniciada!**\n\n@${tiktokConfig.username} está ao vivo agora!`;
            const customEmbed = tiktokConfig.liveEmbed;
            
            let embed = null;
            
            if (customEmbed && (customEmbed.title || customEmbed.description)) {
                // Use custom embed
                embed = new EmbedBuilder();
                
                if (customEmbed.title) {
                    embed.setTitle(replacePlaceholders(customEmbed.title));
                    if (customEmbed.titleUrl) {
                        embed.setURL(replacePlaceholders(customEmbed.titleUrl));
                    }
                }
                
                if (customEmbed.description) {
                    embed.setDescription(replacePlaceholders(customEmbed.description));
                }
                
                if (customEmbed.color) {
                    embed.setColor(parseInt(customEmbed.color.replace('#', ''), 16));
                } else {
                    embed.setColor(0xFF0050); // TikTok red
                }
                
                if (customEmbed.thumbnail && customEmbed.thumbnail.url) {
                    const thumbnailUrl = replacePlaceholders(customEmbed.thumbnail.url);
                    if (thumbnailUrl) {
                        embed.setThumbnail(thumbnailUrl);
                    }
                } else if (data.avatar && type === 'live') {
                    // Use profile avatar as thumbnail for live if available
                    embed.setThumbnail(data.avatar);
                }
                
                if (customEmbed.image && customEmbed.image.url) {
                    const imageUrl = replacePlaceholders(customEmbed.image.url);
                    if (imageUrl) {
                        embed.setImage(imageUrl);
                    }
                }
                
                if (customEmbed.footer && customEmbed.footer.text) {
                    embed.setFooter({ 
                        text: replacePlaceholders(customEmbed.footer.text),
                        iconURL: customEmbed.footer.icon_url ? replacePlaceholders(customEmbed.footer.icon_url) : undefined
                    });
                } else {
                    embed.setFooter({ text: `TikTok Live • @${tiktokConfig.username}` });
                }
                
                if (customEmbed.fields && Array.isArray(customEmbed.fields)) {
                    customEmbed.fields.forEach(field => {
                        if (field.name && field.value) {
                            embed.addFields({ 
                                name: replacePlaceholders(field.name), 
                                value: replacePlaceholders(field.value),
                                inline: field.inline || false
                            });
                        }
                    });
                }
                
                embed.setTimestamp();
            } else {
                // Default embed
                embed = new EmbedBuilder()
                    .setTitle('🔴 Live Iniciada!')
                    .setDescription(`**@${tiktokConfig.username}** está ao vivo agora!\n\n[Assistir Live](https://www.tiktok.com/@${tiktokConfig.username}/live)`)
                    .setURL(`https://www.tiktok.com/@${tiktokConfig.username}/live`)
                    .setColor(0xFF0050)
                    .setTimestamp()
                    .setFooter({ text: `TikTok Live • @${tiktokConfig.username}` });
            }
            
            const messageOptions = {
                content: replacePlaceholders(message),
                embeds: embed ? [embed] : []
            };
            
            const sentMessage = await channel.send(messageOptions);
            
            // Delete after specified time
            if (tiktokConfig.liveDeleteAfter && tiktokConfig.liveDeleteAfter > 0) {
                setTimeout(() => {
                    sentMessage.delete().catch(() => {});
                }, tiktokConfig.liveDeleteAfter * 1000);
            }
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

/**
 * Force check TikTok updates (manual trigger)
 */
async function forceCheckTikTokUpdates() {
    console.log('🔄 Verificação manual do TikTok solicitada...');
    await checkTikTokUpdates();
}

module.exports = {
    initTikTokPolling,
    forceCheckTikTokUpdates,
    stopTikTokPolling,
    checkTikTokUpdates,
    checkServerTikTok
};
