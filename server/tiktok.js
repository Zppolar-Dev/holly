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
            // Buscar links de vídeo na página
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
            
            // Também tentar buscar em data attributes
            if (!latestVideo) {
                const videoElements = $('[data-e2e="user-post-item"]');
                console.log(`   - Elementos de vídeo encontrados: ${videoElements.length}`);
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
        
        if (response.status === 200 && response.data && response.data.userInfo && response.data.userInfo.user) {
            const secUid = response.data.userInfo.user.secUid;
            console.log(`   - secUid obtido: ${secUid ? 'Sim' : 'Não'}`);
            
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
