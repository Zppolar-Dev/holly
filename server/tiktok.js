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
                // New video detected! Update lastVideoId FIRST to prevent duplicate notifications
                console.log(`🎥 ✅ NOVO VÍDEO DETECTADO para @${username}: ${latestVideoId}`);
                console.log(`   - Título: ${userInfo.latestVideo.title || 'Sem título'}`);
                console.log(`   - URL: ${userInfo.latestVideo.url || 'N/A'}`);
                
                // Update last video ID IMMEDIATELY to prevent race conditions
                await db.updateTikTokConfig(guildId, {
                    ...tiktok,
                    lastVideoId: latestVideoId
                });
                
                // Now send notification
                try {
                    await sendTikTokNotification(guildId, tiktok, 'video', {
                        ...userInfo.latestVideo,
                        username: userInfo.username || username,
                        displayName: userInfo.displayName || username,
                        avatar: userInfo.avatar || '',
                        followerCount: userInfo.followerCount || 0,
                        videoCount: userInfo.videoCount || 0
                    });
                    console.log(`✅ Notificação enviada e lastVideoId atualizado para ${latestVideoId}`);
                } catch (notifError) {
                    console.error(`❌ Erro ao enviar notificação:`, notifError.message);
                    console.error(notifError.stack);
                    // If notification fails, we might want to reset lastVideoId
                    // But for now, we'll keep it to avoid spam
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
                // Live started! Update status FIRST to prevent duplicate notifications
                console.log(`🔴 Live detectada para @${username}`);
                
                // Update live status IMMEDIATELY to prevent race conditions
                await db.updateTikTokConfig(guildId, {
                    ...tiktok,
                    lastLiveStatus: true
                });
                
                // Now send notification
                try {
                    await sendTikTokNotification(guildId, tiktok, 'live', {
                        username: userInfo.username || username,
                        displayName: userInfo.displayName || username,
                        avatar: userInfo.avatar || '',
                        followerCount: userInfo.followerCount || 0,
                        videoCount: userInfo.videoCount || 0,
                        title: userInfo.liveTitle || 'Live em andamento',
                        url: `https://www.tiktok.com/@${username}/live`
                    });
                    console.log(`✅ Notificação de live enviada e lastLiveStatus atualizado`);
                } catch (notifError) {
                    console.error(`❌ Erro ao enviar notificação de live:`, notifError.message);
                    // If notification fails, we might want to reset lastLiveStatus
                    // But for now, we'll keep it as true to avoid spam
                }
            } else if (!isLive && tiktok.lastLiveStatus) {
                // Live ended (update status but don't notify)
                await db.updateTikTokConfig(guildId, {
                    ...tiktok,
                    lastLiveStatus: false
                });
                console.log(`ℹ️ Live finalizada para @${username}, status atualizado`);
            } else if (isLive && tiktok.lastLiveStatus) {
                console.log(`ℹ️ Live ainda em andamento para @${username} (já notificado)`);
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
        
        // Debug: verificar se a página foi carregada corretamente
        const pageTitle = $('title').text();
        console.log(`   - Título da página: ${pageTitle.substring(0, 50)}...`);
        
        // Tentar extrair dados do JSON embutido na página
        let userData = null;
        let latestVideo = null;
        let isLive = false;
        
        // TikTok geralmente coloca dados em um script tag com id="__UNIVERSAL_DATA_FOR_REHYDRATION__"
        const scriptTags = $('script#__UNIVERSAL_DATA_FOR_REHYDRATION__');
        console.log(`   - Script tags encontrados: ${scriptTags.length}`);
        
        if (scriptTags.length > 0) {
            try {
                const scriptContent = scriptTags.html();
                console.log(`📄 Script tag encontrado, tamanho: ${scriptContent.length} caracteres`);
                
                const jsonData = JSON.parse(scriptContent);
                console.log(`✅ JSON parseado com sucesso`);
                console.log(`   - Chaves principais: ${Object.keys(jsonData).join(', ')}`);
                
                // Navegar pela estrutura de dados do TikTok - tentar múltiplas estruturas
                let userInfoPath = null;
                let itemListPath = null;
                
                // Tentar diferentes caminhos para userInfo
                if (jsonData['__DEFAULT_SCOPE__']?.['webapp.user-detail']?.['userInfo']) {
                    userInfoPath = jsonData['__DEFAULT_SCOPE__']['webapp.user-detail']['userInfo'];
                } else if (jsonData['__UNIVERSAL_DATA_FOR_REHYDRATION__']?.['__DEFAULT_SCOPE__']?.['webapp.user-detail']?.['userInfo']) {
                    userInfoPath = jsonData['__UNIVERSAL_DATA_FOR_REHYDRATION__']['__DEFAULT_SCOPE__']['webapp.user-detail']['userInfo'];
                }
                
                if (userInfoPath) {
                    console.log(`✅ userInfo encontrado`);
                    userData = {
                        username: userInfoPath.user?.uniqueId || cleanUsername,
                        displayName: userInfoPath.user?.nickname || cleanUsername,
                        avatar: userInfoPath.user?.avatarMedium || '',
                        followerCount: userInfoPath.stats?.followerCount || 0,
                        videoCount: userInfoPath.stats?.videoCount || 0
                    };
                    
                    // Verificar se está em live
                    isLive = userInfoPath.user?.isLive || userInfoPath.user?.roomId ? true : false;
                    console.log(`   - Live status: ${isLive}`);
                    
                    // Tentar extrair secUid para usar na API alternativa
                    const secUid = userInfoPath.user?.secUid;
                    if (secUid && !latestVideo) {
                        console.log(`   - secUid encontrado no userInfo: ${secUid.substring(0, 20)}...`);
                        console.log(`   - Tentando buscar vídeos via API usando secUid...`);
                        try {
                            const videoUrl = `https://www.tiktok.com/api/post/item_list/?secUid=${secUid}&count=1&cursor=0`;
                            console.log(`   - URL da API: ${videoUrl.substring(0, 100)}...`);
                            
                            const videoResponse = await axios.get(videoUrl, {
                                headers: {
                                    'User-Agent': USER_AGENT,
                                    'Referer': `https://www.tiktok.com/@${cleanUsername}`,
                                    'Accept': 'application/json, text/plain, */*',
                                    'Accept-Language': 'en-US,en;q=0.9'
                                },
                                timeout: 10000,
                                validateStatus: function (status) {
                                    return status < 500;
                                }
                            });
                            
                            console.log(`   - Status da resposta: ${videoResponse.status}`);
                            console.log(`   - Tipo da resposta: ${typeof videoResponse.data}`);
                            console.log(`   - É array? ${Array.isArray(videoResponse.data)}`);
                            
                            if (videoResponse.data) {
                                console.log(`   - Chaves na resposta: ${typeof videoResponse.data === 'object' && !Array.isArray(videoResponse.data) ? Object.keys(videoResponse.data).join(', ') : 'N/A'}`);
                            }
                            
                            if (videoResponse.status === 200 && videoResponse.data) {
                                let itemList = null;
                                if (videoResponse.data.itemList) {
                                    itemList = videoResponse.data.itemList;
                                    console.log(`   - itemList encontrado: ${itemList.length} itens`);
                                } else if (videoResponse.data.items) {
                                    itemList = videoResponse.data.items;
                                    console.log(`   - items encontrado: ${itemList.length} itens`);
                                } else if (videoResponse.data.data) {
                                    if (videoResponse.data.data.itemList) {
                                        itemList = videoResponse.data.data.itemList;
                                        console.log(`   - data.itemList encontrado: ${itemList.length} itens`);
                                    } else if (videoResponse.data.data.items) {
                                        itemList = videoResponse.data.data.items;
                                        console.log(`   - data.items encontrado: ${itemList.length} itens`);
                                    }
                                } else if (Array.isArray(videoResponse.data)) {
                                    itemList = videoResponse.data;
                                    console.log(`   - Resposta é array direto: ${itemList.length} itens`);
                                }
                                
                                if (itemList && Array.isArray(itemList) && itemList.length > 0) {
                                    const video = itemList[0];
                                    console.log(`   - Primeiro vídeo encontrado:`, {
                                        id: video.id || video.itemId || video.awemeId,
                                        hasDesc: !!video.desc,
                                        hasVideo: !!video.video
                                    });
                                    
                                    latestVideo = {
                                        id: video.id || video.itemId || video.awemeId || String(video.createTime || Date.now()),
                                        title: video.desc || video.description || '',
                                        description: video.desc || video.description || '',
                                        url: `https://www.tiktok.com/@${cleanUsername}/video/${video.id || video.itemId || video.awemeId}`,
                                        thumbnail: video.video?.cover || video.video?.dynamicCover || video.video?.originCover || '',
                                        createdAt: video.createTime || video.create_time || Date.now()
                                    };
                                    console.log(`✅ Vídeo encontrado via secUid do userInfo: ${latestVideo.id}`);
                                } else {
                                    console.warn(`   ⚠️ itemList não encontrado ou vazio na resposta`);
                                    if (videoResponse.data && typeof videoResponse.data === 'object') {
                                        console.warn(`   - Primeiros 300 chars da resposta: ${JSON.stringify(videoResponse.data).substring(0, 300)}`);
                                    }
                                }
                            } else {
                                console.warn(`   ⚠️ Resposta inválida ou vazia`);
                            }
                        } catch (apiError) {
                            console.warn(`   ⚠️ Erro ao buscar vídeos via secUid:`, apiError.message);
                            if (apiError.response) {
                                console.warn(`   - Status: ${apiError.response.status}`);
                                console.warn(`   - Data: ${JSON.stringify(apiError.response.data).substring(0, 200)}`);
                            }
                        }
                    } else if (!secUid) {
                        console.warn(`   ⚠️ secUid não encontrado no userInfo`);
                    }
                } else {
                    console.warn(`⚠️ userInfo não encontrado na estrutura esperada`);
                }
                
                // Tentar diferentes caminhos para itemList (vídeos)
                const defaultScope = jsonData['__DEFAULT_SCOPE__'];
                if (defaultScope) {
                    console.log(`   - Chaves em __DEFAULT_SCOPE__: ${Object.keys(defaultScope).join(', ')}`);
                    
                    const userDetail = defaultScope['webapp.user-detail'];
                    if (userDetail) {
                        console.log(`   - Chaves em webapp.user-detail: ${Object.keys(userDetail).join(', ')}`);
                        
                        // Tentar itemList primeiro
                        if (userDetail['itemList']) {
                            itemListPath = userDetail['itemList'];
                            console.log(`   - itemList encontrado em __DEFAULT_SCOPE__`);
                        }
                        
                        // Tentar itemModule
                        if (!itemListPath && userDetail['itemModule']) {
                            const itemModule = userDetail['itemModule'];
                            const videoIds = Object.keys(itemModule);
                            console.log(`   - itemModule encontrado com ${videoIds.length} vídeos`);
                            if (videoIds.length > 0) {
                                const firstVideoId = videoIds[0];
                                const video = itemModule[firstVideoId];
                                latestVideo = {
                                    id: video.id || video.awemeId || firstVideoId || String(video.createTime || video.create_time || Date.now()),
                                    title: video.desc || video.description || '',
                                    description: video.desc || video.description || '',
                                    url: `https://www.tiktok.com/@${cleanUsername}/video/${video.id || video.awemeId || firstVideoId}`,
                                    thumbnail: video.video?.cover || video.video?.dynamicCover || video.video?.originCover || '',
                                    createdAt: video.createTime || video.create_time || Date.now()
                                };
                                console.log(`✅ Vídeo encontrado via itemModule: ${latestVideo.id}`);
                            }
                        }
                        
                        // Tentar outras estruturas possíveis em userDetail
                        if (!latestVideo) {
                            // Tentar buscar em todas as chaves que podem conter vídeos
                            for (const key of Object.keys(userDetail)) {
                                if (key.includes('item') || key.includes('video') || key.includes('post') || key.includes('list')) {
                                    const value = userDetail[key];
                                    if (Array.isArray(value) && value.length > 0) {
                                        console.log(`   - Tentando extrair de ${key} (array com ${value.length} itens)`);
                                        const video = value[0];
                                        if (video.id || video.itemId || video.awemeId) {
                                            latestVideo = {
                                                id: video.id || video.itemId || video.awemeId,
                                                title: video.desc || video.description || '',
                                                description: video.desc || video.description || '',
                                                url: `https://www.tiktok.com/@${cleanUsername}/video/${video.id || video.itemId || video.awemeId}`,
                                                thumbnail: video.video?.cover || video.video?.dynamicCover || video.video?.originCover || '',
                                                createdAt: video.createTime || video.create_time || Date.now()
                                            };
                                            console.log(`✅ Vídeo encontrado via ${key}: ${latestVideo.id}`);
                                            break;
                                        }
                                    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                                        const videoIds = Object.keys(value);
                                        if (videoIds.length > 0) {
                                            console.log(`   - Tentando extrair de ${key} (objeto com ${videoIds.length} chaves)`);
                                            const firstVideoId = videoIds[0];
                                            const video = value[firstVideoId];
                                            if (video && (video.id || video.itemId || video.awemeId)) {
                                                latestVideo = {
                                                    id: video.id || video.awemeId || firstVideoId,
                                                    title: video.desc || video.description || '',
                                                    description: video.desc || video.description || '',
                                                    url: `https://www.tiktok.com/@${cleanUsername}/video/${video.id || video.awemeId || firstVideoId}`,
                                                    thumbnail: video.video?.cover || video.video?.dynamicCover || video.video?.originCover || '',
                                                    createdAt: video.createTime || video.create_time || Date.now()
                                                };
                                                console.log(`✅ Vídeo encontrado via ${key}: ${latestVideo.id}`);
                                                break;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    
                    // Buscar em outras chaves do __DEFAULT_SCOPE__ que podem conter vídeos
                    if (!latestVideo) {
                        console.log(`   - Buscando vídeos em outras estruturas do __DEFAULT_SCOPE__...`);
                        for (const scopeKey of Object.keys(defaultScope)) {
                            if (scopeKey.includes('video') || scopeKey.includes('item') || scopeKey.includes('post') || scopeKey.includes('list')) {
                                const scopeValue = defaultScope[scopeKey];
                                if (Array.isArray(scopeValue) && scopeValue.length > 0) {
                                    console.log(`   - Tentando extrair de __DEFAULT_SCOPE__[${scopeKey}] (array com ${scopeValue.length} itens)`);
                                    const video = scopeValue[0];
                                    if (video.id || video.itemId || video.awemeId) {
                                        latestVideo = {
                                            id: video.id || video.itemId || video.awemeId,
                                            title: video.desc || video.description || '',
                                            description: video.desc || video.description || '',
                                            url: `https://www.tiktok.com/@${cleanUsername}/video/${video.id || video.itemId || video.awemeId}`,
                                            thumbnail: video.video?.cover || video.video?.dynamicCover || video.video?.originCover || '',
                                            createdAt: video.createTime || video.create_time || Date.now()
                                        };
                                        console.log(`✅ Vídeo encontrado via __DEFAULT_SCOPE__[${scopeKey}]: ${latestVideo.id}`);
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
                
                if (itemListPath && Array.isArray(itemListPath) && itemListPath.length > 0) {
                    console.log(`✅ itemList encontrado com ${itemListPath.length} itens`);
                    const video = itemListPath[0];
                    latestVideo = {
                        id: video.id || video.itemId || video.awemeId || String(video.createTime || video.create_time || Date.now()),
                        title: video.desc || video.description || '',
                        description: video.desc || video.description || '',
                        url: `https://www.tiktok.com/@${cleanUsername}/video/${video.id || video.itemId || video.awemeId}`,
                        thumbnail: video.video?.cover || video.video?.dynamicCover || video.video?.originCover || '',
                        createdAt: video.createTime || video.create_time || Date.now()
                    };
                    console.log(`   - Vídeo ID: ${latestVideo.id}`);
                    console.log(`   - Título: ${latestVideo.title ? latestVideo.title.substring(0, 50) + '...' : 'Sem título'}`);
                }
            } catch (parseError) {
                console.warn(`⚠️ Erro ao parsear JSON do TikTok:`, parseError.message);
                console.warn(`   Stack: ${parseError.stack}`);
            }
        } else {
            console.warn(`⚠️ Script tag #__UNIVERSAL_DATA_FOR_REHYDRATION__ não encontrado`);
            // Tentar buscar em outros scripts
            const allScripts = $('script');
            console.log(`   - Total de scripts encontrados: ${allScripts.length}`);
            
            allScripts.each((i, elem) => {
                const scriptContent = $(elem).html();
                if (scriptContent && scriptContent.includes('"userInfo"') && scriptContent.includes('"itemList"')) {
                    try {
                        // Tentar encontrar JSON válido
                        const jsonMatch = scriptContent.match(/window\.__UNIVERSAL_DATA_FOR_REHYDRATION__\s*=\s*({.+?});/s);
                        if (jsonMatch) {
                            const jsonData = JSON.parse(jsonMatch[1]);
                            console.log(`✅ JSON encontrado em script alternativo`);
                            // Processar similar ao acima
                        }
                    } catch (e) {
                        // Ignorar erros de parse
                    }
                }
            });
        }
        
        // Fallback: tentar extrair de outros scripts
        if (!userData || !latestVideo) {
            console.log(`🔄 Tentando métodos alternativos de extração...`);
            // Buscar em todos os scripts
            $('script').each((i, elem) => {
                const scriptContent = $(elem).html();
                if (scriptContent && (scriptContent.includes('"userInfo"') || scriptContent.includes('"itemList"') || scriptContent.includes('"itemModule"'))) {
                    try {
                        // Tentar encontrar JSON válido de diferentes formas
                        let jsonData = null;
                        
                        // Forma 1: window.__UNIVERSAL_DATA_FOR_REHYDRATION__ = {...};
                        let jsonMatch = scriptContent.match(/window\.__UNIVERSAL_DATA_FOR_REHYDRATION__\s*=\s*({[\s\S]+?});/);
                        if (jsonMatch) {
                            jsonData = JSON.parse(jsonMatch[1]);
                        }
                        
                        // Forma 2: <script id="__UNIVERSAL_DATA_FOR_REHYDRATION__">{...}</script>
                        if (!jsonData) {
                            jsonMatch = scriptContent.match(/^({[\s\S]+})$/);
                            if (jsonMatch) {
                                try {
                                    jsonData = JSON.parse(jsonMatch[1]);
                                } catch (e) {
                                    // Ignorar
                                }
                            }
                        }
                        
                        if (jsonData) {
                            console.log(`✅ JSON encontrado em script alternativo ${i}`);
                            // Tentar extrair dados
                            if (!userData && jsonData['__DEFAULT_SCOPE__']?.['webapp.user-detail']?.['userInfo']) {
                                const userInfo = jsonData['__DEFAULT_SCOPE__']['webapp.user-detail']['userInfo'];
                                userData = {
                                    username: userInfo.user?.uniqueId || cleanUsername,
                                    displayName: userInfo.user?.nickname || cleanUsername,
                                    avatar: userInfo.user?.avatarMedium || '',
                                    followerCount: userInfo.stats?.followerCount || 0,
                                    videoCount: userInfo.stats?.videoCount || 0
                                };
                                isLive = userInfo.user?.isLive || userInfo.user?.roomId ? true : false;
                            }
                            
                            if (!latestVideo) {
                                // Tentar itemList
                                const itemList = jsonData['__DEFAULT_SCOPE__']?.['webapp.user-detail']?.['itemList'];
                                if (itemList && Array.isArray(itemList) && itemList.length > 0) {
                                    const video = itemList[0];
                                    latestVideo = {
                                        id: video.id || video.itemId || video.awemeId || null,
                                        title: video.desc || video.description || '',
                                        description: video.desc || video.description || '',
                                        url: `https://www.tiktok.com/@${cleanUsername}/video/${video.id || video.itemId || video.awemeId}`,
                                        thumbnail: video.video?.cover || video.video?.dynamicCover || video.video?.originCover || '',
                                        createdAt: video.createTime || video.create_time || Date.now()
                                    };
                                }
                                
                                // Tentar itemModule
                                if (!latestVideo && jsonData['__DEFAULT_SCOPE__']?.['webapp.user-detail']?.['itemModule']) {
                                    const itemModule = jsonData['__DEFAULT_SCOPE__']['webapp.user-detail']['itemModule'];
                                    const videoIds = Object.keys(itemModule);
                                    if (videoIds.length > 0) {
                                        const firstVideoId = videoIds[0];
                                        const video = itemModule[firstVideoId];
                                        latestVideo = {
                                            id: video.id || video.awemeId || firstVideoId,
                                            title: video.desc || video.description || '',
                                            description: video.desc || video.description || '',
                                            url: `https://www.tiktok.com/@${cleanUsername}/video/${video.id || video.awemeId || firstVideoId}`,
                                            thumbnail: video.video?.cover || video.video?.dynamicCover || video.video?.originCover || '',
                                            createdAt: video.createTime || video.create_time || Date.now()
                                        };
                                    }
                                }
                            }
                        }
                    } catch (e) {
                        // Ignorar erros de parse
                    }
                }
            });
        }
        
        // Se ainda não encontrou, tentar método alternativo: buscar via API não oficial
        if (!latestVideo) {
            console.log(`🔄 Tentando método alternativo de API...`);
            latestVideo = await getLatestVideoAlternative(cleanUsername);
            if (latestVideo) {
                console.log(`✅ Vídeo encontrado via API alternativa: ${latestVideo.id}`);
            } else {
                console.warn(`⚠️ API alternativa também não retornou vídeo`);
            }
        }
        
        // Último fallback: tentar extrair da URL do primeiro vídeo na página
        if (!latestVideo) {
            console.log(`🔄 Tentando extrair vídeo da estrutura HTML...`);
            
            // Método 1: Buscar links de vídeo na página
            const videoLinks = $('a[href*="/video/"]');
            console.log(`   - Links de vídeo encontrados: ${videoLinks.length}`);
            if (videoLinks.length > 0) {
                const firstLink = videoLinks.first();
                const href = firstLink.attr('href');
                console.log(`   - Primeiro link: ${href}`);
                const videoIdMatch = href.match(/\/video\/(\d+)/);
                if (videoIdMatch) {
                    const videoId = videoIdMatch[1];
                    latestVideo = {
                        id: videoId,
                        title: firstLink.attr('title') || firstLink.text() || '',
                        description: firstLink.attr('title') || firstLink.text() || '',
                        url: href.startsWith('http') ? href : `https://www.tiktok.com${href}`,
                        thumbnail: '',
                        createdAt: Date.now()
                    };
                    console.log(`✅ Vídeo encontrado via HTML: ${videoId}`);
                }
            }
            
            // Método 2: Buscar em data attributes
            if (!latestVideo) {
                const videoElements = $('[data-e2e="user-post-item"]');
                console.log(`   - Elementos de vídeo encontrados (data-e2e): ${videoElements.length}`);
                if (videoElements.length > 0) {
                    const firstElement = videoElements.first();
                    const videoLink = firstElement.find('a[href*="/video/"]');
                    if (videoLink.length > 0) {
                        const href = videoLink.attr('href');
                        const videoIdMatch = href.match(/\/video\/(\d+)/);
                        if (videoIdMatch) {
                            const videoId = videoIdMatch[1];
                            latestVideo = {
                                id: videoId,
                                title: '',
                                description: '',
                                url: href.startsWith('http') ? href : `https://www.tiktok.com${href}`,
                                thumbnail: '',
                                createdAt: Date.now()
                            };
                            console.log(`✅ Vídeo encontrado via data-e2e: ${videoId}`);
                        }
                    }
                }
            }
            
            // Método 3: Buscar em diferentes seletores
            if (!latestVideo) {
                const selectors = [
                    '[data-e2e="user-post-item-list"] a[href*="/video/"]',
                    '.video-item a[href*="/video/"]',
                    '[class*="video"] a[href*="/video/"]',
                    'div[class*="Item"] a[href*="/video/"]'
                ];
                
                for (const selector of selectors) {
                    const elements = $(selector);
                    console.log(`   - Tentando seletor "${selector}": ${elements.length} elementos`);
                    if (elements.length > 0) {
                        const firstElement = elements.first();
                        const href = firstElement.attr('href');
                        if (href) {
                            const videoIdMatch = href.match(/\/video\/(\d+)/);
                            if (videoIdMatch) {
                                const videoId = videoIdMatch[1];
                                latestVideo = {
                                    id: videoId,
                                    title: firstElement.attr('title') || firstElement.text() || '',
                                    description: firstElement.attr('title') || firstElement.text() || '',
                                    url: href.startsWith('http') ? href : `https://www.tiktok.com${href}`,
                                    thumbnail: '',
                                    createdAt: Date.now()
                                };
                                console.log(`✅ Vídeo encontrado via seletor "${selector}": ${videoId}`);
                                break;
                            }
                        }
                    }
                }
            }
            
            // Método 4: Buscar vídeo IDs diretamente no HTML (regex)
            if (!latestVideo) {
                const htmlContent = $.html();
                const videoIdMatches = htmlContent.match(/\/video\/(\d{15,})/g);
                if (videoIdMatches && videoIdMatches.length > 0) {
                    const firstMatch = videoIdMatches[0];
                    const videoId = firstMatch.match(/\d{15,}/)[0];
                    console.log(`   - Vídeo ID encontrado via regex: ${videoId}`);
                    latestVideo = {
                        id: videoId,
                        title: '',
                        description: '',
                        url: `https://www.tiktok.com/@${cleanUsername}/video/${videoId}`,
                        thumbnail: '',
                        createdAt: Date.now()
                    };
                    console.log(`✅ Vídeo encontrado via regex no HTML: ${videoId}`);
                }
            }
        }
        
        // Verificar live status também no HTML se não foi encontrado no JSON
        if (!isLive) {
            // Buscar indicadores de live no HTML
            const liveIndicators = $('[data-e2e="live-badge"], .live-indicator, [class*="live"]');
            if (liveIndicators.length > 0) {
                isLive = true;
                console.log(`✅ Live detectado via HTML (${liveIndicators.length} indicadores encontrados)`);
            }
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
        console.log(`   🔄 Tentando API alternativa para buscar vídeos...`);
        
        // Método 1: Tentar buscar via API de user detail
        const apiUrl = `https://www.tiktok.com/api/user/detail/?uniqueId=${username}`;
        
        const response = await axios.get(apiUrl, {
            headers: {
                'User-Agent': USER_AGENT,
                'Referer': `https://www.tiktok.com/@${username}`,
                'Accept': 'application/json, text/plain, */*'
            },
            timeout: 10000,
            validateStatus: function (status) {
                return status < 500;
            }
        });
        
        console.log(`   - Status da API user detail: ${response.status}`);
        console.log(`   - Tipo da resposta: ${typeof response.data}`);
        console.log(`   - É array? ${Array.isArray(response.data)}`);
        if (response.data && typeof response.data === 'object' && !Array.isArray(response.data)) {
            console.log(`   - Chaves na resposta: ${Object.keys(response.data).join(', ')}`);
        } else if (response.data) {
            console.log(`   - Primeiros 200 chars da resposta: ${JSON.stringify(response.data).substring(0, 200)}`);
        } else {
            console.warn(`   - Resposta vazia ou inválida`);
        }
        
        if (response.status === 200 && response.data) {
            // Tentar diferentes estruturas de resposta
            let userInfo = null;
            let secUid = null;
            
            if (response.data.userInfo && response.data.userInfo.user) {
                userInfo = response.data.userInfo;
                secUid = response.data.userInfo.user.secUid;
            } else if (response.data.user && response.data.user.secUid) {
                userInfo = { user: response.data.user };
                secUid = response.data.user.secUid;
            } else if (response.data.data && response.data.data.userInfo) {
                userInfo = response.data.data.userInfo;
                secUid = response.data.data.userInfo.user?.secUid;
            }
            
            console.log(`   - userInfo encontrado: ${userInfo ? 'Sim' : 'Não'}`);
            console.log(`   - secUid obtido: ${secUid ? secUid.substring(0, 20) + '...' : 'Não'}`);
            
            if (secUid) {
                // Buscar vídeos do usuário usando secUid
                const videoUrl = `https://www.tiktok.com/api/post/item_list/?secUid=${secUid}&count=1&cursor=0`;
                console.log(`   - Buscando vídeos em: ${videoUrl.substring(0, 80)}...`);
                
                const videoResponse = await axios.get(videoUrl, {
                    headers: {
                        'User-Agent': USER_AGENT,
                        'Referer': `https://www.tiktok.com/@${username}`,
                        'Accept': 'application/json, text/plain, */*'
                    },
                    timeout: 10000,
                    validateStatus: function (status) {
                        return status < 500;
                    }
                });
                
                console.log(`   - Status da API item_list: ${videoResponse.status}`);
                
                if (videoResponse.status === 200 && videoResponse.data) {
                    console.log(`   - Chaves na resposta: ${Object.keys(videoResponse.data).join(', ')}`);
                    
                    // Tentar diferentes estruturas de resposta
                    let itemList = null;
                    if (videoResponse.data.itemList) {
                        itemList = videoResponse.data.itemList;
                    } else if (videoResponse.data.items) {
                        itemList = videoResponse.data.items;
                    } else if (videoResponse.data.data && videoResponse.data.data.itemList) {
                        itemList = videoResponse.data.data.itemList;
                    } else if (Array.isArray(videoResponse.data)) {
                        itemList = videoResponse.data;
                    }
                    
                    if (itemList && Array.isArray(itemList) && itemList.length > 0) {
                        const video = itemList[0];
                        console.log(`✅ Vídeo encontrado via API alternativa: ${video.id || video.itemId || video.awemeId}`);
                        return {
                            id: video.id || video.itemId || video.awemeId || String(video.createTime || Date.now()),
                            title: video.desc || video.description || '',
                            description: video.desc || video.description || '',
                            url: `https://www.tiktok.com/@${username}/video/${video.id || video.itemId || video.awemeId}`,
                            thumbnail: video.video?.cover || video.video?.dynamicCover || video.video?.originCover || '',
                            createdAt: video.createTime || video.create_time || Date.now()
                        };
                    } else {
                        console.warn(`   ⚠️ itemList não encontrado na resposta da API`);
                    }
                } else {
                    console.warn(`   ⚠️ API item_list retornou status ${videoResponse.status}`);
                }
            }
        } else {
            console.warn(`   ⚠️ API user detail não retornou dados válidos`);
        }
    } catch (error) {
        console.warn(`⚠️ Método alternativo falhou para @${username}:`, error.message);
        if (error.response) {
            console.warn(`   - Status: ${error.response.status}`);
            console.warn(`   - Data: ${JSON.stringify(error.response.data).substring(0, 200)}`);
        }
    }
    
    return null;
}

/**
 * Send TikTok notification to Discord
 */
async function sendTikTokNotification(guildId, tiktokConfig, type, data) {
    try {
        console.log(`📤 Enviando notificação TikTok (${type}) para servidor ${guildId}...`);
        
        // Since bot and web server are separate processes, always use HTTP to send to bot
        // The bot HTTP server will handle sending to Discord
        return await sendTikTokNotificationViaHTTP(guildId, tiktokConfig, type, data);
        
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
        // Send directly to bot HTTP server
        // Bot HTTP server runs on BOT_HTTP_URL or localhost:3001
        const botHttpUrl = process.env.BOT_HTTP_URL || 'http://localhost:3001';
        const syncSecret = process.env.BOT_SYNC_SECRET || 'default_secret_change_me';
        
        console.log(`\n${'='.repeat(60)}`);
        console.log(`📤 ENVIANDO NOTIFICAÇÃO TIKTOK VIA HTTP`);
        console.log(`${'='.repeat(60)}`);
        
        const http = require('http');
        const https = require('https');
        const httpModule = botHttpUrl.startsWith('https') ? https : http;
        
        // Prepare notification data
        const notificationData = {
            secret: syncSecret,
            guildId: guildId,
            type: type,
            config: tiktokConfig,
            data: data
        };
        
        // Send to bot HTTP server
        const url = new URL(`${botHttpUrl}/api/tiktok/notify`);
        const postData = JSON.stringify(notificationData);
        
        console.log(`📤 Enviando notificação TikTok para bot HTTP server:`);
        console.log(`   - URL completa: ${botHttpUrl}/api/tiktok/notify`);
        console.log(`   - Hostname: ${url.hostname}`);
        console.log(`   - Port: ${url.port || (url.protocol === 'https:' ? 443 : 80)}`);
        console.log(`   - Path: ${url.pathname}`);
        console.log(`   - BOT_HTTP_URL configurado: ${process.env.BOT_HTTP_URL ? 'Sim' : 'Não (usando localhost:3001)'}`);
        
        // Add headers to bypass ngrok warning page if using ngrok
        const headers = {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
            'User-Agent': 'Mozilla/5.0 (compatible; TikTokBot/1.0)'
        };
        
        // Add ngrok bypass header if using ngrok
        if (url.hostname.includes('ngrok')) {
            headers['ngrok-skip-browser-warning'] = 'any';
        }
        
        const options = {
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname,
            method: 'POST',
            headers: headers,
            timeout: 30000 // Increased timeout to 30 seconds
        };
        
        await new Promise((resolve, reject) => {
            const req = httpModule.request(options, (res) => {
                let responseData = '';
                res.on('data', (chunk) => { responseData += chunk; });
                res.on('end', () => {
                    if (res.statusCode === 200 || res.statusCode === 201) {
                        console.log(`✅ Notificação TikTok enviada via HTTP para bot`);
                        resolve();
                    } else {
                        console.warn(`⚠️ Resposta HTTP ${res.statusCode} ao enviar notificação TikTok: ${responseData.substring(0, 200)}`);
                        reject(new Error(`HTTP ${res.statusCode}: ${responseData.substring(0, 100)}`));
                    }
                });
            });
            
            req.on('error', (error) => {
                console.error(`\n${'='.repeat(60)}`);
                console.error(`❌ ERRO AO ENVIAR NOTIFICAÇÃO TIKTOK VIA HTTP`);
                console.error(`${'='.repeat(60)}`);
                console.error(`   Erro: ${error.message}`);
                console.error(`   URL tentada: ${botHttpUrl}`);
                console.error(`\n💡 SOLUÇÕES:`);
                if (error.code === 'ECONNREFUSED') {
                    console.error(`   ⚠️ Conexão recusada - servidor não está acessível`);
                    console.error(`   📍 O servidor web está tentando acessar: ${url.hostname}:${url.port || (url.protocol === 'https:' ? 443 : 80)}`);
                    console.error(`\n   🔧 OPÇÕES:`);
                    console.error(`   1. Se o bot está rodando LOCALMENTE:`);
                    console.error(`      - Use um túnel (ngrok, localtunnel, etc.) para expor o bot HTTP server`);
                    console.error(`      - Configure BOT_HTTP_URL no servidor web com a URL do túnel`);
                    console.error(`      - Exemplo: BOT_HTTP_URL=https://seu-bot.ngrok.io`);
                    console.error(`\n   2. Se o bot está no RENDER (serviço separado):`);
                    console.error(`      - Configure BOT_HTTP_URL com a URL pública do serviço do bot`);
                    console.error(`      - Exemplo: BOT_HTTP_URL=https://seu-bot-service.onrender.com:3001`);
                    console.error(`      - Ou use a porta padrão do Render se configurada`);
                } else if (error.code === 'ENOTFOUND') {
                    console.error(`   ⚠️ Hostname não encontrado`);
                    console.error(`   - Verifique se a URL em BOT_HTTP_URL está correta`);
                    console.error(`   - Verifique se o hostname está acessível`);
                } else {
                    console.error(`   - Verifique se o bot HTTP server está rodando`);
                    console.error(`   - Verifique a variável de ambiente BOT_HTTP_URL`);
                    console.error(`   - Se bot e servidor web estão em serviços separados, use a URL pública do bot`);
                }
                console.error(`${'='.repeat(60)}\n`);
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
    }
}

module.exports = {
    initTikTokPolling,
    forceCheckTikTokUpdates,
    stopTikTokPolling,
    checkTikTokUpdates,
    checkServerTikTok
};
