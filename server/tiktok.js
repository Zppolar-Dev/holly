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
    console.log('\n' + '='.repeat(60));
    console.log('🎵 INICIALIZANDO SISTEMA DE POLLING TIKTOK');
    console.log('='.repeat(60));
    
    db = database;
    botClient = bot;
    
    console.log(`📊 Status da inicialização:`);
    console.log(`   - Database: ${db ? '✅ Disponível' : '❌ Não disponível'}`);
    console.log(`   - Bot Client: ${botClient ? '✅ Disponível' : '❌ Não disponível'}`);
    
    if (!db) {
        console.error('❌ ERRO: TikTok polling não iniciado - banco de dados não disponível');
        console.log('='.repeat(60) + '\n');
        return;
    }
    
    if (!botClient) {
        console.error('❌ ERRO: TikTok polling não iniciado - bot client não disponível');
        console.log('='.repeat(60) + '\n');
        return;
    }
    
    console.log(`✅ Sistema de polling TikTok inicializado (método alternativo)`);
    console.log(`   - Intervalo de polling: ${POLLING_INTERVAL / 1000 / 60} minutos`);
    console.log(`   - Banco de dados: ✅`);
    console.log(`   - Bot client: ✅`);
    
    // Clear any existing interval
    if (pollingInterval) {
        clearInterval(pollingInterval);
        console.log('   - Intervalo anterior limpo');
    }
    
    // Start polling immediately, then every 2 minutes
    console.log('\n🔄 Executando primeira verificação do TikTok...');
    checkTikTokUpdates().then(() => {
        console.log('✅ Primeira verificação concluída');
    }).catch(err => {
        console.error('❌ Erro na primeira verificação do TikTok:', err.message);
        console.error(err.stack);
    });
    
    pollingInterval = setInterval(() => {
        console.log(`\n⏰ Executando verificação periódica do TikTok (a cada ${POLLING_INTERVAL / 1000 / 60} minutos)...`);
        checkTikTokUpdates().catch(err => {
            console.error('❌ Erro no polling do TikTok:', err.message);
            console.error(err.stack);
        });
    }, POLLING_INTERVAL);
    
    console.log(`✅ Polling TikTok configurado para executar a cada ${POLLING_INTERVAL / 1000 / 60} minutos`);
    console.log('='.repeat(60) + '\n');
}

/**
 * Check for TikTok updates for all enabled servers
 */
async function checkTikTokUpdates() {
    const startTime = Date.now();
    console.log('\n' + '-'.repeat(60));
    console.log('🔍 INICIANDO VERIFICAÇÃO DO TIKTOK');
    console.log('-'.repeat(60));
    
    try {
        if (!db || !db.getTikTokEnabledServers) {
            console.error('❌ ERRO: TikTok polling - banco de dados não disponível');
            console.log(`   - db: ${db ? '✅' : '❌'}`);
            console.log(`   - getTikTokEnabledServers: ${db && db.getTikTokEnabledServers ? '✅' : '❌'}`);
            return;
        }
        
        console.log('📊 Buscando servidores com TikTok habilitado...');
        const servers = await db.getTikTokEnabledServers();
        console.log(`   - Servidores encontrados: ${servers.length}`);
        
        if (servers.length === 0) {
            console.log('ℹ️ Nenhum servidor com TikTok habilitado encontrado');
            console.log('   Verifique se há servidores com TikTok habilitado no banco de dados');
            console.log('-'.repeat(60) + '\n');
            return;
        }
        
        console.log(`\n🔍 Verificando ${servers.length} perfil(is) TikTok...`);
        console.log('   Servidores:');
        servers.forEach((server, index) => {
            console.log(`   ${index + 1}. Servidor ${server.guildId} - @${server.tiktok?.username || 'N/A'} (Video: ${server.tiktok?.notifyVideo ? '✅' : '❌'}, Live: ${server.tiktok?.notifyLive ? '✅' : '❌'})`);
        });
        
        for (const server of servers) {
            try {
                console.log(`\n📡 Verificando servidor ${server.guildId} - @${server.tiktok?.username || 'N/A'}`);
                await checkServerTikTok(server);
                // Pequeno delay entre requisições para evitar rate limit
                await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (error) {
                console.error(`❌ Erro ao verificar TikTok para servidor ${server.guildId}:`, error.message);
                console.error(error.stack);
            }
        }
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`\n✅ Verificação TikTok concluída em ${duration}s`);
        console.log('-'.repeat(60) + '\n');
    } catch (error) {
        console.error('❌ ERRO CRÍTICO ao verificar atualizações do TikTok:', error.message);
        console.error(error.stack);
        console.log('-'.repeat(60) + '\n');
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
        console.log(`📤 Enviando notificação TikTok (${type}) para servidor ${guildId}...`);
        
        // Since bot and web server are separate processes, we need to make HTTP request to bot
        // Check if bot is registered/active
        if (!botClient || !botClient.active) {
            console.warn('⚠️ Bot não está registrado/ativo. Tentando enviar via HTTP...');
            // Try to send via HTTP to bot endpoint
            return await sendTikTokNotificationViaHTTP(guildId, tiktokConfig, type, data);
        }
        
        // If bot client has guilds (direct access), use it
        if (botClient.guilds && botClient.guilds.cache) {
            const guild = botClient.guilds.cache.get(guildId);
            if (!guild) {
                console.warn(`⚠️ Servidor ${guildId} não encontrado no cache do bot`);
                return await sendTikTokNotificationViaHTTP(guildId, tiktokConfig, type, data);
            }
            
            console.log(`✅ Servidor encontrado: ${guild.name}`);
            
            const channel = guild.channels.cache.get(tiktokConfig.channelId);
            if (!channel) {
                console.warn(`⚠️ Canal ${tiktokConfig.channelId} não encontrado no servidor ${guildId}`);
                return await sendTikTokNotificationViaHTTP(guildId, tiktokConfig, type, data);
            }
            
            console.log(`✅ Canal encontrado: ${channel.name} (${channel.id})`);
        } else {
            // Bot is registered but we don't have direct access - use HTTP
            return await sendTikTokNotificationViaHTTP(guildId, tiktokConfig, type, data);
        }
        
        // If we reach here, we have direct access to bot client
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
            
            console.log(`📨 Enviando mensagem para canal ${channel.name}...`);
            console.log(`   - Conteúdo: ${messageOptions.content ? messageOptions.content.substring(0, 100) + '...' : 'Nenhum'}`);
            console.log(`   - Embeds: ${messageOptions.embeds.length}`);
            
            const sentMessage = await channel.send(messageOptions);
            console.log(`✅ Mensagem enviada com sucesso! ID: ${sentMessage.id}`);
            
            // Delete after specified time
            if (tiktokConfig.videoDeleteAfter && tiktokConfig.videoDeleteAfter > 0) {
                console.log(`⏰ Mensagem será deletada em ${tiktokConfig.videoDeleteAfter} segundos`);
                setTimeout(() => {
                    sentMessage.delete().catch((err) => {
                        console.error(`❌ Erro ao deletar mensagem:`, err.message);
                    });
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
            
            console.log(`📨 Enviando mensagem de live para canal ${channel.name}...`);
            console.log(`   - Conteúdo: ${messageOptions.content ? messageOptions.content.substring(0, 100) + '...' : 'Nenhum'}`);
            console.log(`   - Embeds: ${messageOptions.embeds.length}`);
            
            const sentMessage = await channel.send(messageOptions);
            console.log(`✅ Mensagem de live enviada com sucesso! ID: ${sentMessage.id}`);
            
            // Delete after specified time
            if (tiktokConfig.liveDeleteAfter && tiktokConfig.liveDeleteAfter > 0) {
                console.log(`⏰ Mensagem será deletada em ${tiktokConfig.liveDeleteAfter} segundos`);
                setTimeout(() => {
                    sentMessage.delete().catch((err) => {
                        console.error(`❌ Erro ao deletar mensagem:`, err.message);
                    });
                }, tiktokConfig.liveDeleteAfter * 1000);
            }
        }
        
        console.log(`✅ Notificação TikTok enviada para servidor ${guildId} (${type})`);
    } catch (error) {
        console.error(`❌ Erro ao enviar notificação TikTok para servidor ${guildId} (${type}):`, error.message);
        console.error(error.stack);
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

/**
 * Send TikTok notification via HTTP to bot (when bot and web server are separate processes)
 */
async function sendTikTokNotificationViaHTTP(guildId, tiktokConfig, type, data) {
    try {
        // Since bot and web server are separate, we need the bot to have an HTTP endpoint
        // For now, we'll use the website URL and the bot should have a route to handle this
        // The bot needs to implement: POST /api/tiktok/notify
        const websiteUrl = process.env.WEBSITE_URL || 'https://dash-holly.com';
        const syncSecret = process.env.BOT_SYNC_SECRET || 'default_secret_change_me';
        
        const http = require('http');
        const https = require('https');
        const httpModule = websiteUrl.startsWith('https') ? https : http;
        
        // Prepare notification data
        const notificationData = {
            secret: syncSecret,
            guildId: guildId,
            type: type,
            config: tiktokConfig,
            data: data
        };
        
        // Try to send to bot endpoint (bot needs to implement this)
        // For now, we'll try the website URL - the bot should proxy or handle this
        const url = new URL(`${websiteUrl}/api/tiktok/notify`);
        const postData = JSON.stringify(notificationData);
        
        const options = {
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            },
            timeout: 10000
        };
        
        await new Promise((resolve, reject) => {
            const req = httpModule.request(options, (res) => {
                let responseData = '';
                res.on('data', (chunk) => { responseData += chunk; });
                res.on('end', () => {
                    if (res.statusCode === 200 || res.statusCode === 201) {
                        console.log(`✅ Notificação TikTok enviada via HTTP`);
                        resolve();
                    } else {
                        console.warn(`⚠️ Resposta HTTP ${res.statusCode} ao enviar notificação TikTok`);
                        reject(new Error(`HTTP ${res.statusCode}: ${responseData.substring(0, 100)}`));
                    }
                });
            });
            
            req.on('error', (error) => {
                console.warn(`⚠️ Erro ao enviar notificação TikTok via HTTP: ${error.message}`);
                console.warn(`   ⚠️ Bot precisa implementar endpoint /api/tiktok/notify`);
                reject(error);
            });
            
            req.on('timeout', () => {
                req.destroy();
                console.warn(`⚠️ Timeout ao enviar notificação TikTok via HTTP`);
                reject(new Error('Timeout'));
            });
            
            req.write(postData);
            req.end();
        });
        
    } catch (error) {
        console.error(`❌ Erro ao enviar notificação TikTok via HTTP:`, error.message);
        console.error(`   ⚠️ NOTA: Bot precisa implementar endpoint POST /api/tiktok/notify para receber notificações`);
    }
}

module.exports = {
    initTikTokPolling,
    forceCheckTikTokUpdates,
    stopTikTokPolling,
    checkTikTokUpdates,
    checkServerTikTok
};
