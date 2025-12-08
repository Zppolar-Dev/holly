/**
 * Server Configuration Page
 * Dedicated page for configuring a specific server
 */

document.addEventListener('DOMContentLoaded', async function() {
    const CONFIG = {
        CLIENT_ID: '1069819161057968218',
        API_BASE_URL: window.location.origin,
        THEME_KEY: 'holly_theme'
    };

    // Get guild ID from URL
    const pathParts = window.location.pathname.split('/');
    const guildId = pathParts[pathParts.length - 1];

    if (!guildId || guildId === 'server') {
        window.location.href = '/dashboard';
        return;
    }

    let serverConfig = null;
    let guildChannels = [];
    let serverInfo = null; // Store server info globally
    let currentUser = null; // Store current user data globally

    // UI Elements
    const UI = {
        loadingOverlay: document.getElementById('loadingOverlay'),
        serverName: document.getElementById('serverName'),
        serverId: document.getElementById('serverId'),
        prefixInput: document.getElementById('server-prefix'),
        nicknameInput: document.getElementById('server-nickname'),
        notifyJoinEnabled: document.getElementById('notify-join-enabled'),
        notifyJoinConfig: document.getElementById('notify-join-config'),
        notifyJoinChannel: document.getElementById('notify-join-channel'),
        notifyJoinMessage: document.getElementById('notify-join-message'),
        notifyJoinUseEmbed: document.getElementById('notify-join-use-embed'),
        notifyJoinSimple: document.getElementById('notify-join-simple'),
        notifyJoinEmbed: document.getElementById('notify-join-embed'),
        notifyJoinEmbedTitle: document.getElementById('notify-join-embed-title'),
        notifyJoinEmbedDescription: document.getElementById('notify-join-embed-description'),
        notifyJoinEmbedColor: document.getElementById('notify-join-embed-color'),
        notifyJoinEmbedColorPicker: document.getElementById('notify-join-embed-color-picker'),
        notifyJoinEmbedThumbnailUser: document.getElementById('notify-join-embed-thumbnail-user'),
        notifyJoinEmbedThumbnail: document.getElementById('notify-join-embed-thumbnail'),
        notifyJoinEmbedImage: document.getElementById('notify-join-embed-image'),
        notifyJoinEmbedFooter: document.getElementById('notify-join-embed-footer'),
        notifyLeaveEnabled: document.getElementById('notify-leave-enabled'),
        notifyLeaveConfig: document.getElementById('notify-leave-config'),
        notifyLeaveChannel: document.getElementById('notify-leave-channel'),
        notifyLeaveMessage: document.getElementById('notify-leave-message'),
        notifyLeaveUseEmbed: document.getElementById('notify-leave-use-embed'),
        notifyLeaveSimple: document.getElementById('notify-leave-simple'),
        notifyLeaveEmbed: document.getElementById('notify-leave-embed'),
        notifyLeaveEmbedTitle: document.getElementById('notify-leave-embed-title'),
        notifyLeaveEmbedDescription: document.getElementById('notify-leave-embed-description'),
        notifyLeaveEmbedColor: document.getElementById('notify-leave-embed-color'),
        notifyLeaveEmbedColorPicker: document.getElementById('notify-leave-embed-color-picker'),
        notifyLeaveEmbedThumbnailUser: document.getElementById('notify-leave-embed-thumbnail-user'),
        notifyLeaveEmbedThumbnail: document.getElementById('notify-leave-embed-thumbnail'),
        notifyLeaveEmbedImage: document.getElementById('notify-leave-embed-image'),
        notifyLeaveEmbedFooter: document.getElementById('notify-leave-embed-footer'),
        saveBtn: document.getElementById('save-btn'),
        cancelBtn: document.getElementById('cancel-btn'),
        themeToggle: document.getElementById('themeToggle')
    };

    // Show/hide loading
    function showLoading(show) {
        if (UI.loadingOverlay) {
            UI.loadingOverlay.style.display = show ? 'flex' : 'none';
        }
    }

    // Check authentication
    async function checkAuth() {
        try {
            const res = await fetch(`${CONFIG.API_BASE_URL}/api/user`, {
                credentials: 'include'
            });

            if (!res.ok) {
                window.location.href = '/dashboard';
                return false;
            }

            const user = await res.json();
            return true;
        } catch (error) {
            console.error('Erro ao verificar autenticação:', error);
            window.location.href = '/dashboard';
            return false;
        }
    }

    // Load server configuration
    async function loadServerConfig() {
        try {
            const res = await fetch(`${CONFIG.API_BASE_URL}/api/server/${guildId}/config`, {
                credentials: 'include'
            });

            if (!res.ok) {
                throw new Error('Erro ao carregar configuração');
            }

            serverConfig = await res.json();
            return serverConfig;
        } catch (error) {
            console.error('Erro ao carregar configuração:', error);
            showNotification('Erro ao carregar configurações do servidor', 'error');
            return null;
        }
    }

    // Load guild channels
    async function loadGuildChannels(showLoading = true) {
        try {
            if (showLoading) {
                const joinSelect = UI.notifyJoinChannel;
                const leaveSelect = UI.notifyLeaveChannel;
                if (joinSelect) joinSelect.innerHTML = '<option value="">Carregando canais...</option>';
                if (leaveSelect) leaveSelect.innerHTML = '<option value="">Carregando canais...</option>';
            }

            const res = await fetch(`${CONFIG.API_BASE_URL}/api/server/${guildId}/channels`, {
                credentials: 'include'
            });

            if (res.ok) {
                const channels = await res.json();
                const textChannels = channels.filter(ch => ch.type === 0); // Only text channels
                populateChannels(textChannels);
                return textChannels;
            } else {
                const joinSelect = UI.notifyJoinChannel;
                const leaveSelect = UI.notifyLeaveChannel;
                if (joinSelect) joinSelect.innerHTML = '<option value="">Erro ao carregar canais</option>';
                if (leaveSelect) leaveSelect.innerHTML = '<option value="">Erro ao carregar canais</option>';
            }
            return [];
        } catch (error) {
            console.error('Erro ao carregar canais:', error);
            const joinSelect = UI.notifyJoinChannel;
            const leaveSelect = UI.notifyLeaveChannel;
            if (joinSelect) joinSelect.innerHTML = '<option value="">Erro ao carregar canais</option>';
            if (leaveSelect) leaveSelect.innerHTML = '<option value="">Erro ao carregar canais</option>';
            return [];
        }
    }

    // Load server info
    async function loadServerInfo() {
        try {
            const res = await fetch(`${CONFIG.API_BASE_URL}/api/user/guilds`, {
                credentials: 'include'
            });

            if (res.ok) {
                const guilds = await res.json();
                const guild = guilds.find(g => g.id === guildId);
                if (guild) {
                    UI.serverName.textContent = guild.name;
                    UI.serverId.textContent = `ID: ${guild.id}`;
                    
                    // Set server icon
                    const serverIcon = document.getElementById('serverIcon');
                    if (serverIcon && guild.icon) {
                        serverIcon.src = `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128`;
                    } else if (serverIcon) {
                        serverIcon.src = `https://cdn.discordapp.com/embed/avatars/${parseInt(guild.id) % 5}.png`;
                    }
                    
                    return guild;
                }
            }
            return null;
        } catch (error) {
            console.error('Erro ao carregar informações do servidor:', error);
            return null;
        }
    }

    // Load user info
    async function loadUserInfo() {
        try {
            const res = await fetch(`${CONFIG.API_BASE_URL}/api/user`, {
                credentials: 'include'
            });

            if (res.ok) {
                const user = await res.json();
                
                // Set user avatar in navbar
                const navUserAvatar = document.getElementById('nav-user-avatar');
                const navUsername = document.getElementById('nav-username');
                if (navUserAvatar && user.avatar) {
                    navUserAvatar.src = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`;
                } else if (navUserAvatar) {
                    navUserAvatar.src = `https://cdn.discordapp.com/embed/avatars/${parseInt(user.discriminator || 0) % 5}.png`;
                }
                if (navUsername) {
                    navUsername.textContent = user.username || 'Usuário';
                }
                
                // Set user avatar in config page
                const userAvatar = document.getElementById('userAvatar');
                if (userAvatar && user.avatar) {
                    userAvatar.src = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`;
                } else if (userAvatar) {
                    userAvatar.src = `https://cdn.discordapp.com/embed/avatars/${parseInt(user.discriminator || 0) % 5}.png`;
                }
                
                // Set user display name
                const userDisplayName = document.getElementById('userDisplayName');
                if (userDisplayName) {
                    userDisplayName.textContent = user.username || 'Usuário';
                }
                
                // Set user discriminator
                const userDiscriminator = document.getElementById('userDiscriminator');
                if (userDiscriminator) {
                    userDiscriminator.textContent = user.discriminator ? `#${user.discriminator}` : '';
                }
                
                // Setup user dropdown with user data
                setupUserDropdown(user);
                
                // Store user data globally for previews
                currentUser = user;
                
                return user;
            } else if (res.status === 401) {
                // Token expired or session lost - don't redirect, just show login option
                console.warn('⚠️ Token expirado ou sessão perdida - mostrando opção de login');
                // Setup dropdown to show login option
                setupUserDropdown(null);
                return null;
            } else {
                console.error('Erro ao carregar informações do usuário:', res.status, res.statusText);
                // Setup dropdown anyway but show login option
                setupUserDropdown(null);
                return null;
            }
        } catch (error) {
            console.error('Erro ao carregar informações do usuário:', error);
            // Setup dropdown anyway but show login option
            setupUserDropdown(null);
            return null;
        }
    }
    
    // Setup user dropdown
    function setupUserDropdown(user) {
        const userDropdown = document.getElementById('userDropdown');
        if (!userDropdown) return;
        
        const dropdownToggle = userDropdown.querySelector('.dropdown-toggle');
        const loginBtn = document.getElementById('login-btn');
        const logoutBtn = userDropdown.querySelector('a[href="#"]:last-child');
        
        // Remove existing event listeners by cloning
        const newToggle = dropdownToggle.cloneNode(true);
        dropdownToggle.parentNode.replaceChild(newToggle, dropdownToggle);
        
        if (newToggle) {
            newToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                userDropdown.classList.toggle('active');
            });
        }
        
        if (user) {
            // User is logged in
            if (loginBtn) {
                loginBtn.style.display = 'none';
            }
            
            if (logoutBtn) {
                logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Sair';
                logoutBtn.onclick = (e) => {
                    e.preventDefault();
                    fetch(`${CONFIG.API_BASE_URL}/auth/logout`, {
                        method: 'POST',
                        credentials: 'include'
                    }).then(() => {
                        window.location.href = '/';
                    }).catch(() => {
                        window.location.href = '/';
                    });
                };
            }
        } else {
            // User is not logged in
            if (loginBtn) {
                loginBtn.style.display = 'block';
                loginBtn.onclick = (e) => {
                    e.preventDefault();
                    window.location.href = `${CONFIG.API_BASE_URL}/auth/discord`;
                };
            }
            
            if (logoutBtn) {
                logoutBtn.style.display = 'none';
            }
        }
        
        // Close dropdown when clicking outside (only add once)
        const clickHandler = (e) => {
            if (userDropdown && !userDropdown.contains(e.target)) {
                userDropdown.classList.remove('active');
            }
        };
        
        // Remove old listener if exists
        document.removeEventListener('click', clickHandler);
        document.addEventListener('click', clickHandler);
    }

    // Populate form with config
    function populateForm(config) {
        if (!config) return;

        // Prefix
        if (UI.prefixInput) {
            UI.prefixInput.value = config.prefix || '!';
        }

        // Nickname
        if (UI.nicknameInput) {
            UI.nicknameInput.value = config.nickname || '';
        }

        // Notifications
        const notifications = config.notifications || {
            memberJoin: { enabled: false, channelId: null, message: '', embed: null, deleteAfter: 0 },
            memberLeave: { enabled: false, channelId: null, message: '', embed: null, deleteAfter: 0 }
        };

        // Join notifications
        if (UI.notifyJoinEnabled) {
            UI.notifyJoinEnabled.checked = notifications.memberJoin?.enabled || false;
            toggleNotificationConfig('join', UI.notifyJoinEnabled.checked);
        }
        if (UI.notifyJoinChannel) {
            UI.notifyJoinChannel.value = notifications.memberJoin?.channelId || '';
        }
        
        // Delete after
        const joinDeleteAfter = document.getElementById('notify-join-delete-after');
        if (joinDeleteAfter) {
            joinDeleteAfter.value = notifications.memberJoin?.deleteAfter || 0;
        }
        
        // Update preview automatically
        setTimeout(() => {
            updateMainPreview('join');
        }, 100);

        // Leave notifications
        if (UI.notifyLeaveEnabled) {
            UI.notifyLeaveEnabled.checked = notifications.memberLeave?.enabled || false;
            toggleNotificationConfig('leave', UI.notifyLeaveEnabled.checked);
        }
        if (UI.notifyLeaveChannel) {
            UI.notifyLeaveChannel.value = notifications.memberLeave?.channelId || '';
        }
        
        // Delete after
        const leaveDeleteAfter = document.getElementById('notify-leave-delete-after');
        if (leaveDeleteAfter) {
            leaveDeleteAfter.value = notifications.memberLeave?.deleteAfter || 0;
        }
        
        // Update preview automatically
        setTimeout(() => {
            updateMainPreview('leave');
        }, 100);

        // Modules
        const modules = config.modules || {};
        document.querySelectorAll('[data-module]').forEach(checkbox => {
            const moduleName = checkbox.dataset.module;
            checkbox.checked = modules[moduleName] !== false;
        });
    }

    // Populate channels dropdown
    function populateChannels(channels) {
        guildChannels = channels;
        
        const joinSelect = UI.notifyJoinChannel;
        const leaveSelect = UI.notifyLeaveChannel;

        [joinSelect, leaveSelect].forEach(select => {
            if (!select) return;
            
            // Clear existing options except first
            while (select.options.length > 1) {
                select.remove(1);
            }

            channels.forEach(channel => {
                const option = document.createElement('option');
                option.value = channel.id;
                option.textContent = `# ${channel.name}`;
                select.appendChild(option);
            });
        });
    }

    // Toggle notification config visibility
    function toggleNotificationConfig(type, enabled) {
        const configDiv = type === 'join' ? UI.notifyJoinConfig : UI.notifyLeaveConfig;
        if (configDiv) {
            configDiv.style.display = enabled ? 'block' : 'none';
        }
    }
    
    // Toggle embed mode
    function toggleEmbedMode(type, useEmbed) {
        const simpleDiv = type === 'join' ? UI.notifyJoinSimple : UI.notifyLeaveSimple;
        const embedDiv = type === 'join' ? UI.notifyJoinEmbed : UI.notifyLeaveEmbed;
        
        if (simpleDiv) {
            simpleDiv.style.display = useEmbed ? 'none' : 'block';
        }
        if (embedDiv) {
            embedDiv.style.display = useEmbed ? 'block' : 'none';
        }
        
        // Update preview
        updatePreview(type);
    }

    // Save configuration
    async function saveConfig() {
        const prefix = UI.prefixInput.value.trim();
        const nickname = UI.nicknameInput.value.trim();

        if (!prefix || prefix.length === 0) {
            showNotification('O prefixo não pode estar vazio!', 'error');
            UI.prefixInput.focus();
            return;
        }

        if (prefix.length > 5) {
            showNotification('O prefixo não pode ter mais de 5 caracteres!', 'error');
            UI.prefixInput.focus();
            return;
        }

        if (nickname.length > 32) {
            showNotification('O apelido não pode ter mais de 32 caracteres!', 'error');
            UI.nicknameInput.focus();
            return;
        }

        UI.saveBtn.disabled = true;
        UI.saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';

        try {
            // Save prefix
            await fetch(`${CONFIG.API_BASE_URL}/api/server/${guildId}/prefix`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ prefix })
            });

            // Save nickname
            await fetch(`${CONFIG.API_BASE_URL}/api/server/${guildId}/nickname`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ nickname: nickname || null })
            });

            // Get notification data from serverConfig (updated by modal)
            const notifications = serverConfig.notifications || {
                memberJoin: { enabled: false, channelId: null, message: '', embed: null, deleteAfter: 0 },
                memberLeave: { enabled: false, channelId: null, message: '', embed: null, deleteAfter: 0 }
            };
            
            // Update enabled and channelId from UI
            notifications.memberJoin.enabled = UI.notifyJoinEnabled.checked;
            notifications.memberJoin.channelId = UI.notifyJoinChannel.value || null;
            const joinDeleteAfter = document.getElementById('notify-join-delete-after');
            if (joinDeleteAfter) {
                notifications.memberJoin.deleteAfter = parseInt(joinDeleteAfter.value) || 0;
            }
            
            notifications.memberLeave.enabled = UI.notifyLeaveEnabled.checked;
            notifications.memberLeave.channelId = UI.notifyLeaveChannel.value || null;
            const leaveDeleteAfter = document.getElementById('notify-leave-delete-after');
            if (leaveDeleteAfter) {
                notifications.memberLeave.deleteAfter = parseInt(leaveDeleteAfter.value) || 0;
            }
            
            // Save join notifications
            await fetch(`${CONFIG.API_BASE_URL}/api/server/${guildId}/notifications`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    type: 'memberJoin',
                    enabled: notifications.memberJoin.enabled,
                    channelId: notifications.memberJoin.channelId,
                    message: notifications.memberJoin.message || '',
                    embed: notifications.memberJoin.embed,
                    deleteAfter: notifications.memberJoin.deleteAfter
                })
            });

            // Save leave notifications
            await fetch(`${CONFIG.API_BASE_URL}/api/server/${guildId}/notifications`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    type: 'memberLeave',
                    enabled: notifications.memberLeave.enabled,
                    channelId: notifications.memberLeave.channelId,
                    message: notifications.memberLeave.message || '',
                    embed: notifications.memberLeave.embed,
                    deleteAfter: notifications.memberLeave.deleteAfter
                })
            });

            // Save modules
            const modules = {};
            document.querySelectorAll('[data-module]').forEach(checkbox => {
                modules[checkbox.dataset.module] = checkbox.checked;
            });

            const modulePromises = Object.entries(modules).map(([module, enabled]) =>
                fetch(`${CONFIG.API_BASE_URL}/api/server/${guildId}/module`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ module, enabled })
                })
            );

            await Promise.all(modulePromises);

            showNotification('✅ Configurações salvas com sucesso!', 'success');
            
            // Don't redirect - just show success notification
        } catch (error) {
            console.error('Erro ao salvar configurações:', error);
            showNotification('Erro ao salvar configurações', 'error');
        } finally {
            UI.saveBtn.disabled = false;
            UI.saveBtn.innerHTML = '<i class="fas fa-save"></i> Salvar Configurações';
        }
    }

    // Show notification
    function showNotification(message, type = 'info') {
        // Notification system matching dashboard style
        const types = {
            success: { icon: 'check-circle', color: '#2ecc71' },
            error: { icon: 'exclamation-triangle', color: '#e74c3c' },
            info: { icon: 'info-circle', color: '#3498db' },
            warning: { icon: 'exclamation-circle', color: '#f39c12' }
        };

        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.setAttribute('role', 'alert');
        notification.setAttribute('aria-live', 'assertive');
        notification.innerHTML = `
            <i class="fas fa-${types[type]?.icon || 'info-circle'}" aria-hidden="true"></i>
            <span>${message}</span>
        `;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            background: ${types[type]?.color || '#3498db'};
            color: white;
            border-radius: 8px;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            display: flex;
            align-items: center;
            gap: 0.75rem;
            font-size: 0.95rem;
            font-weight: 500;
            animation: slideInRight 0.3s ease-out;
        `;
        document.body.appendChild(notification);

        // Add animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        if (!document.head.querySelector('style[data-notification-anim]')) {
            style.setAttribute('data-notification-anim', 'true');
            document.head.appendChild(style);
        }

        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transition = 'opacity 0.3s, transform 0.3s';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // Theme toggle
    function initTheme() {
        const theme = localStorage.getItem(CONFIG.THEME_KEY) || 'light';
        document.documentElement.setAttribute('data-theme', theme);
        
        if (UI.themeToggle) {
            UI.themeToggle.addEventListener('click', () => {
                const currentTheme = document.documentElement.getAttribute('data-theme');
                const newTheme = currentTheme === 'light' ? 'dark' : 'light';
                document.documentElement.setAttribute('data-theme', newTheme);
                localStorage.setItem(CONFIG.THEME_KEY, newTheme);
                
                const icon = UI.themeToggle.querySelector('i');
                if (icon) {
                    icon.className = newTheme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
                }
            });
        }
    }

    // Event listeners
    function setupEventListeners() {
        // Notification toggles
        if (UI.notifyJoinEnabled) {
            UI.notifyJoinEnabled.addEventListener('change', (e) => {
                toggleNotificationConfig('join', e.target.checked);
            });
        }

        if (UI.notifyLeaveEnabled) {
            UI.notifyLeaveEnabled.addEventListener('change', (e) => {
                toggleNotificationConfig('leave', e.target.checked);
            });
        }

        // Refresh channels buttons
        const refreshBtn = document.getElementById('refresh-channels');
        const refreshBtnLeave = document.getElementById('refresh-channels-leave');
        
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                refreshBtn.disabled = true;
                refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                
                // Request channels from bot
                try {
                    await fetch(`${CONFIG.API_BASE_URL}/api/bot/request-channels`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ guildId })
                    });
                } catch (error) {
                    console.error('Erro ao solicitar canais do bot:', error);
                }
                
                // Wait a bit for bot to sync, then reload
                setTimeout(async () => {
                    await loadGuildChannels(true);
                    refreshBtn.disabled = false;
                    refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
                    showNotification('✅ Canais atualizados!', 'success');
                }, 2000);
            });
        }

        if (refreshBtnLeave) {
            refreshBtnLeave.addEventListener('click', async () => {
                refreshBtnLeave.disabled = true;
                refreshBtnLeave.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                
                // Request channels from bot
                try {
                    await fetch(`${CONFIG.API_BASE_URL}/api/bot/request-channels`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ guildId })
                    });
                } catch (error) {
                    console.error('Erro ao solicitar canais do bot:', error);
                }
                
                // Wait a bit for bot to sync, then reload
                setTimeout(async () => {
                    await loadGuildChannels(true);
                    refreshBtnLeave.disabled = false;
                    refreshBtnLeave.innerHTML = '<i class="fas fa-sync-alt"></i>';
                    showNotification('✅ Canais atualizados!', 'success');
                }, 2000);
            });
        }

        // Save button
        if (UI.saveBtn) {
            UI.saveBtn.addEventListener('click', saveConfig);
        }

        // Cancel button
        if (UI.cancelBtn) {
            UI.cancelBtn.addEventListener('click', () => {
                window.location.href = '/dashboard';
            });
        }
    }
    
    // Test message function
    function testMessage(type) {
        const messageInput = type === 'join' ? UI.notifyJoinMessage : UI.notifyLeaveMessage;
        const previewDiv = type === 'join' ? document.getElementById('join-message-preview') : document.getElementById('leave-message-preview');
        const previewText = type === 'join' ? document.getElementById('join-preview-text') : document.getElementById('leave-preview-text');
        
        if (!messageInput || !previewDiv || !previewText) return;
        
        const message = messageInput.value.trim();
        if (!message) {
            showNotification('Digite uma mensagem para testar', 'warning');
            return;
        }
        
        // Show preview
        previewDiv.style.display = 'block';
        updatePreview(type);
        
        // Scroll to preview
        previewDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    
    // Update preview with variable replacement
    function updatePreview(type) {
        const messageInput = type === 'join' ? UI.notifyJoinMessage : UI.notifyLeaveMessage;
        const previewDiv = type === 'join' ? document.getElementById('join-message-preview') : document.getElementById('leave-message-preview');
        const previewText = type === 'join' ? document.getElementById('join-preview-text') : document.getElementById('leave-preview-text');
        const timestamp = document.querySelector(`#${type === 'join' ? 'join' : 'leave'}-message-preview .discord-timestamp`);
        
        if (!messageInput || !previewDiv || !previewText) return;
        
        let message = messageInput.value.trim();
        if (!message) {
            previewDiv.style.display = 'none';
            return;
        }
        
        // Get server info for variables
        const serverName = UI.serverName?.textContent || 'Server';
        const now = new Date();
        const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        const date = now.toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const members = '100'; // Placeholder
        
        // Replace variables
        message = message
            .replace(/\{user\}/g, '<span class="discord-mention">@UsuarioTeste</span>')
            .replace(/\{username\}/g, 'UsuarioTeste')
            .replace(/\{time\}/g, time)
            .replace(/\{date\}/g, date)
            .replace(/\{server\}/g, serverName)
            .replace(/\{members\}/g, members);
        
        // Update preview
        previewText.innerHTML = message;
        
        // Update timestamp
        if (timestamp) {
            const nowStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
            timestamp.textContent = `Today at ${nowStr}`;
        }
    }

    // Initialize
    async function init() {
        showLoading(true);

        // Always setup user dropdown first (even if not authenticated)
        // This ensures the dropdown is configured regardless of auth state
        setupUserDropdown(null);

        // Load user info (this handles auth check)
        const user = await loadUserInfo();
        
        // If user is null, it means token expired or session lost
        // But don't redirect immediately - let user see the page and try to login
        if (!user) {
            console.warn('⚠️ Usuário não autenticado - mostrando opção de login');
            // Setup dropdown to show login option (already done above, but ensure it's set)
            setupUserDropdown(null);
            showLoading(false);
            // Don't redirect - let user see the page and login if needed
            // The page will show login option in dropdown
            return Promise.resolve();
        }

        // User is authenticated, continue loading
        const [config, serverInfo] = await Promise.all([
            loadServerConfig(),
            loadServerInfo()
        ]);

        // Load channels after config is loaded
        await loadGuildChannels(true);

        if (config) {
            populateForm(config);
        }

        setupEventListeners();
        initTheme();

        showLoading(false);
        return Promise.resolve();
    }

    // ========== MODAL DE EDIÇÃO DE MENSAGEM ==========
    let currentEditType = null; // 'join' or 'leave'
    let embedFields = []; // Array to store embed fields
    
    // Open message edit modal
    function openMessageEditModal(type) {
        console.log('🔧 Abrindo modal para:', type);
        currentEditType = type;
        const modal = document.getElementById('message-edit-modal');
        const modalTitle = document.getElementById('modal-title');
        
        if (!modal) {
            console.error('❌ Modal não encontrado!');
            return;
        }
        
        console.log('✅ Modal encontrado, configurando...');
        modalTitle.textContent = type === 'join' ? 'Editar Mensagem de Entrada' : 'Editar Mensagem de Saída';
        
        // Load current configuration
        const notifications = serverConfig?.notifications || {
            memberJoin: { enabled: false, channelId: null, message: '', embed: null, deleteAfter: 0 },
            memberLeave: { enabled: false, channelId: null, message: '', embed: null, deleteAfter: 0 }
        };
        
        const notification = type === 'join' ? notifications.memberJoin : notifications.memberLeave;
        
        // Determine message type
        const hasText = notification.message && notification.message.trim();
        const hasEmbed = notification.embed && (notification.embed.title || notification.embed.description);
        
        let messageType = 'text';
        if (hasText && hasEmbed) messageType = 'both';
        else if (hasEmbed) messageType = 'embed';
        
        document.getElementById('message-type').value = messageType;
        toggleMessageType(messageType);
        
        // Load text message
        if (document.getElementById('message-text')) {
            document.getElementById('message-text').value = notification.message || '';
        }
        
        // Load embed configuration
        if (notification.embed) {
            loadEmbedConfig(notification.embed);
        } else {
            resetEmbedConfig();
        }
        
        // Update preview
        updateModalPreview();
        
        // Show modal
        console.log('📂 Mostrando modal...');
        console.log('Modal antes:', modal.style.display, modal.classList.toString());
        modal.style.display = 'flex';
        modal.style.visibility = 'visible';
        modal.style.opacity = '1';
        modal.style.pointerEvents = 'all';
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        console.log('Modal depois:', modal.style.display, modal.classList.toString());
        console.log('✅ Modal deve estar visível agora');
        
        // Force reflow
        void modal.offsetHeight;
        
        // Setup scroll indicators after modal is shown
        setTimeout(() => {
            setupScrollIndicators();
        }, 100);
    }
    
    // Close modal
    function closeMessageEditModal() {
        const modal = document.getElementById('message-edit-modal');
        if (modal) {
            modal.classList.remove('active');
            modal.style.display = 'none';
            modal.style.visibility = 'hidden';
            modal.style.opacity = '0';
            modal.style.pointerEvents = 'none';
            document.body.style.overflow = '';
        }
    }
    
    // Toggle message type
    function toggleMessageType(type) {
        const textSection = document.getElementById('text-message-section');
        const embedSection = document.getElementById('embed-config-section');
        
        if (type === 'text') {
            if (textSection) textSection.style.display = 'block';
            if (embedSection) embedSection.style.display = 'none';
        } else if (type === 'embed') {
            if (textSection) textSection.style.display = 'none';
            if (embedSection) embedSection.style.display = 'block';
        } else { // both
            if (textSection) textSection.style.display = 'block';
            if (embedSection) embedSection.style.display = 'block';
        }
        
        updateModalPreview();
    }
    
    // Load embed configuration into form
    function loadEmbedConfig(embed) {
        if (!embed) return;
        
        if (document.getElementById('embed-color')) {
            const color = embed.color || '#5865f2';
            document.getElementById('embed-color').value = color;
            if (document.getElementById('embed-color-picker')) {
                document.getElementById('embed-color-picker').value = color;
            }
        }
        
        if (document.getElementById('embed-author-name')) {
            document.getElementById('embed-author-name').value = embed.author?.name || '';
        }
        if (document.getElementById('embed-author-url')) {
            document.getElementById('embed-author-url').value = embed.author?.url || '';
        }
        if (document.getElementById('embed-author-icon')) {
            document.getElementById('embed-author-icon').value = embed.author?.icon_url || '';
        }
        
        if (document.getElementById('embed-title')) {
            document.getElementById('embed-title').value = embed.title || '';
        }
        if (document.getElementById('embed-title-url')) {
            document.getElementById('embed-title-url').value = embed.titleUrl || '';
        }
        if (document.getElementById('embed-description')) {
            document.getElementById('embed-description').value = embed.description || '';
        }
        
        if (document.getElementById('embed-image')) {
            document.getElementById('embed-image').value = embed.image?.url || '';
        }
        if (document.getElementById('embed-thumbnail')) {
            document.getElementById('embed-thumbnail').value = embed.thumbnail?.url || '';
        }
        
        if (document.getElementById('embed-footer-text')) {
            document.getElementById('embed-footer-text').value = embed.footer?.text || '';
        }
        if (document.getElementById('embed-footer-icon')) {
            document.getElementById('embed-footer-icon').value = embed.footer?.icon_url || '';
        }
        
        // Load fields
        embedFields = [];
        if (embed.fields && Array.isArray(embed.fields)) {
            embed.fields.forEach(field => {
                addEmbedField(field.name || '', field.value || '', field.inline || false);
            });
        }
    }
    
    // Reset embed configuration
    function resetEmbedConfig() {
        if (document.getElementById('embed-color')) {
            document.getElementById('embed-color').value = '#5865f2';
            if (document.getElementById('embed-color-picker')) {
                document.getElementById('embed-color-picker').value = '#5865f2';
            }
        }
        
        const fields = ['embed-author-name', 'embed-author-url', 'embed-author-icon', 
                       'embed-title', 'embed-title-url', 'embed-description',
                       'embed-image', 'embed-thumbnail', 'embed-footer-text', 'embed-footer-icon'];
        fields.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        
        embedFields = [];
        const container = document.getElementById('embed-fields-container');
        if (container) container.innerHTML = '';
    }
    
    // Add embed field
    function addEmbedField(name = '', value = '', inline = false) {
        const fieldId = `field-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        embedFields.push({ id: fieldId, name, value, inline });
        
        const container = document.getElementById('embed-fields-container');
        if (!container) return;
        
        const fieldDiv = document.createElement('div');
        fieldDiv.className = 'embed-field-item';
        fieldDiv.id = fieldId;
        fieldDiv.innerHTML = `
            <div class="embed-field-item-header">
                <h6>Field ${embedFields.length}</h6>
                <button type="button" class="remove-field-btn" onclick="removeEmbedField('${fieldId}')">
                    <i class="fas fa-times"></i> Remover
                </button>
            </div>
            <div class="form-group" style="margin-bottom: 0.5rem;">
                <label>Nome</label>
                <input type="text" class="form-input field-name" value="${name}" placeholder="Nome do field">
            </div>
            <div class="form-group" style="margin-bottom: 0.5rem;">
                <label>Valor</label>
                <textarea class="form-input field-value" rows="2" placeholder="Valor do field">${value}</textarea>
            </div>
            <div class="form-group">
                <label class="toggle-switch">
                    <input type="checkbox" class="field-inline" ${inline ? 'checked' : ''}>
                    <span class="slider"></span>
                    <span>Inline (mesma linha)</span>
                </label>
            </div>
        `;
        
        container.appendChild(fieldDiv);
        
        // Add event listeners
        const nameInput = fieldDiv.querySelector('.field-name');
        const valueInput = fieldDiv.querySelector('.field-value');
        const inlineInput = fieldDiv.querySelector('.field-inline');
        
        [nameInput, valueInput, inlineInput].forEach(input => {
            if (input) {
                input.addEventListener('input', updateModalPreview);
                input.addEventListener('change', updateModalPreview);
            }
        });
        
        updateModalPreview();
    }
    
    // Remove embed field
    window.removeEmbedField = function(fieldId) {
        embedFields = embedFields.filter(f => f.id !== fieldId);
        const fieldDiv = document.getElementById(fieldId);
        if (fieldDiv) fieldDiv.remove();
        updateModalPreview();
    };
    
    // Update modal preview
    function updateModalPreview() {
        const messageType = document.getElementById('message-type')?.value || 'text';
        const messageText = document.getElementById('message-text')?.value || '';
        const previewSimple = document.getElementById('modal-preview-simple');
        const previewEmbed = document.getElementById('modal-preview-embed');
        
        // Replace variables helper
        const replaceVars = (text) => {
            if (!text) return '';
            const serverName = UI.serverName?.textContent || 'Server';
            const now = new Date();
            const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
            const date = now.toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric' });
            
            // Get user data
            const userName = currentUser?.username || 'Usuario';
            const userId = currentUser?.id || '000000000000000000';
            const userAvatar = currentUser?.avatar 
                ? `https://cdn.discordapp.com/avatars/${currentUser.id}/${currentUser.avatar}.png?size=64`
                : '/images/holly.gif';
            
            // Get server icon
            const serverIcon = UI.serverIcon?.src || 'https://cdn.discordapp.com/embed/avatars/0.png';
            
            // Replace channel mentions (<#channelId>) with channel names
            let processedText = text.replace(/<#(\d+)>/g, (match, channelId) => {
                const channel = guildChannels.find(ch => ch.id === channelId);
                const channelName = channel ? channel.name : 'canal-desconhecido';
                return `<span class="discord-mention">#${channelName}</span>`;
            });
            
            // Replace role mentions (<@&roleId>) with role names
            processedText = processedText.replace(/<@&(\d+)>/g, (match, roleId) => {
                const role = guildRoles.find(r => r.id === roleId);
                const roleName = role ? role.name : 'cargo-desconhecido';
                return `<span class="discord-mention">@${roleName}</span>`;
            });
            
            return processedText
                .replace(/\{user\}/g, `<span class="discord-mention">@${userName}</span>`)
                .replace(/\{username\}/g, userName)
                .replace(/\{user\.avatar\}/g, userAvatar)
                .replace(/\{user\.id\}/g, userId)
                .replace(/\{server\.icon\}/g, serverIcon)
                .replace(/\{time\}/g, time)
                .replace(/\{date\}/g, date)
                .replace(/\{server\}/g, serverName)
                .replace(/\{members\}/g, '100');
        };
        
        // Update simple message preview
        if (previewSimple) {
            const previewText = document.getElementById('modal-preview-text');
            const timestamp = previewSimple.querySelector('.discord-message-timestamp');
            
            if (previewText) {
                if (messageType === 'text' || messageType === 'both') {
                    previewText.innerHTML = replaceVars(messageText);
                    previewSimple.style.display = 'flex';
                } else {
                    previewSimple.style.display = 'none';
                }
            }
            
            // Update timestamp
            if (timestamp) {
                const now = new Date();
                const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
                timestamp.textContent = `Today at ${timeStr}`;
            }
        }
        
        // Update embed preview
        if (previewEmbed && (messageType === 'embed' || messageType === 'both')) {
            updateModalEmbedPreview(previewEmbed, replaceVars);
            previewEmbed.style.display = 'block';
        } else if (previewEmbed) {
            previewEmbed.style.display = 'none';
        }
    }
    
    // Update embed preview (for modal)
    function updateModalEmbedPreview(container, replaceVars) {
        const color = document.getElementById('embed-color')?.value || '#5865f2';
        const authorName = document.getElementById('embed-author-name')?.value || '';
        const authorUrl = document.getElementById('embed-author-url')?.value || '';
        const authorIcon = document.getElementById('embed-author-icon')?.value || '';
        const title = document.getElementById('embed-title')?.value || '';
        const titleUrl = document.getElementById('embed-title-url')?.value || '';
        const description = document.getElementById('embed-description')?.value || '';
        const image = document.getElementById('embed-image')?.value || '';
        const thumbnail = document.getElementById('embed-thumbnail')?.value || '';
        const footerText = document.getElementById('embed-footer-text')?.value || '';
        const footerIcon = document.getElementById('embed-footer-icon')?.value || '';
        
        // Build embed HTML
        let embedHTML = `<div class="discord-embed-color-bar" style="background-color: ${color};"></div>`;
        embedHTML += '<div class="discord-embed-content">';
        
        // Helper to replace placeholders in URLs
        const replaceVarsInUrl = (url) => {
            if (!url) return '';
            const serverIcon = UI.serverIcon?.src || 'https://cdn.discordapp.com/embed/avatars/0.png';
            const userId = currentUser?.id || '000000000000000000';
            const userAvatar = currentUser?.avatar 
                ? `https://cdn.discordapp.com/avatars/${currentUser.id}/${currentUser.avatar}.png?size=64`
                : '/images/holly.gif';
            
            return url
                .replace(/\{user\.avatar\}/g, userAvatar)
                .replace(/\{user\.id\}/g, userId)
                .replace(/\{server\.icon\}/g, serverIcon);
        };
        
        // Author
        if (authorName) {
            embedHTML += '<div class="discord-embed-author">';
            if (authorIcon) {
                const iconUrl = replaceVarsInUrl(authorIcon);
                embedHTML += `<img src="${iconUrl}" alt="Author" class="discord-embed-author-icon" onerror="this.style.display='none'">`;
            }
            if (authorUrl) {
                embedHTML += `<a href="${replaceVarsInUrl(authorUrl)}" target="_blank" style="color: inherit; text-decoration: none;">${replaceVars(authorName)}</a>`;
            } else {
                embedHTML += replaceVars(authorName);
            }
            embedHTML += '</div>';
        }
        
        // Title
        if (title) {
            if (titleUrl) {
                embedHTML += `<div class="discord-embed-title"><a href="${replaceVarsInUrl(titleUrl)}" target="_blank" style="color: inherit; text-decoration: none;">${replaceVars(title)}</a></div>`;
            } else {
                embedHTML += `<div class="discord-embed-title">${replaceVars(title)}</div>`;
            }
        }
        
        // Description
        if (description) {
            embedHTML += `<div class="discord-embed-description">${replaceVars(description)}</div>`;
        }
        
        // Fields
        if (embedFields.length > 0) {
            embedHTML += '<div class="discord-embed-fields">';
            embedFields.forEach(field => {
                const fieldDiv = document.getElementById(field.id);
                if (fieldDiv) {
                    const name = fieldDiv.querySelector('.field-name')?.value || '';
                    const value = fieldDiv.querySelector('.field-value')?.value || '';
                    const inline = fieldDiv.querySelector('.field-inline')?.checked || false;
                    
                    if (name || value) {
                        embedHTML += `<div class="discord-embed-field" style="display: ${inline ? 'inline-block' : 'block'}; width: ${inline ? '48%' : '100%'}; margin-right: ${inline ? '2%' : '0'};">`;
                        embedHTML += `<div class="discord-embed-field-name">${replaceVars(name)}</div>`;
                        embedHTML += `<div class="discord-embed-field-value">${replaceVars(value)}</div>`;
                        embedHTML += '</div>';
                    }
                }
            });
            embedHTML += '</div>';
        }
        
        // Thumbnail
        if (thumbnail) {
            const thumbnailUrl = replaceVarsInUrl(thumbnail);
            embedHTML += `<div class="discord-embed-thumbnail"><img src="${thumbnailUrl}" alt="Thumbnail" onerror="this.parentElement.style.display='none'"></div>`;
        }
        
        // Image
        if (image) {
            const imageUrl = replaceVarsInUrl(image);
            embedHTML += `<div class="discord-embed-image"><img src="${imageUrl}" alt="Embed Image" onerror="this.parentElement.style.display='none'"></div>`;
        }
        
        // Footer
        if (footerText) {
            embedHTML += '<div class="discord-embed-footer">';
            if (footerIcon) {
                const footerIconUrl = replaceVarsInUrl(footerIcon);
                embedHTML += `<img src="${footerIconUrl}" alt="Footer" class="discord-embed-footer-icon" onerror="this.style.display='none'">`;
            }
            embedHTML += `<span>${replaceVars(footerText)}</span>`;
            embedHTML += '</div>';
        }
        
        embedHTML += '</div>';
        container.innerHTML = embedHTML;
    }
    
    // Save message configuration
    async function saveMessageConfig() {
        if (!currentEditType) return;
        
        const messageType = document.getElementById('message-type')?.value || 'text';
        const messageText = document.getElementById('message-text')?.value || '';
        
        // Validate: at least one must have content
        if (messageType === 'text' && !messageText.trim()) {
            showNotification('A mensagem de texto não pode estar vazia quando o tipo é "Apenas Texto"', 'error');
            return;
        }
        
        if (messageType === 'embed') {
            const title = document.getElementById('embed-title')?.value || '';
            const description = document.getElementById('embed-description')?.value || '';
            if (!title.trim() && !description.trim()) {
                showNotification('O embed deve ter pelo menos título ou descrição', 'error');
                return;
            }
        }
        
        // Build embed object
        let embed = null;
        if (messageType === 'embed' || messageType === 'both') {
            embed = {
                color: document.getElementById('embed-color')?.value || '#5865f2',
                author: {
                    name: document.getElementById('embed-author-name')?.value || null,
                    url: document.getElementById('embed-author-url')?.value || null,
                    icon_url: document.getElementById('embed-author-icon')?.value || null
                },
                title: document.getElementById('embed-title')?.value || null,
                titleUrl: document.getElementById('embed-title-url')?.value || null,
                description: document.getElementById('embed-description')?.value || null,
                image: document.getElementById('embed-image')?.value ? { url: document.getElementById('embed-image').value } : null,
                thumbnail: document.getElementById('embed-thumbnail')?.value ? { url: document.getElementById('embed-thumbnail').value } : null,
                footer: {
                    text: document.getElementById('embed-footer-text')?.value || null,
                    icon_url: document.getElementById('embed-footer-icon')?.value || null
                },
                fields: []
            };
            
            // Add fields
            embedFields.forEach(field => {
                const fieldDiv = document.getElementById(field.id);
                if (fieldDiv) {
                    const name = fieldDiv.querySelector('.field-name')?.value || '';
                    const value = fieldDiv.querySelector('.field-value')?.value || '';
                    const inline = fieldDiv.querySelector('.field-inline')?.checked || false;
                    
                    if (name || value) {
                        embed.fields.push({ name, value, inline });
                    }
                }
            });
            
            // Clean null values
            if (!embed.author.name && !embed.author.url && !embed.author.icon_url) {
                embed.author = null;
            }
            if (!embed.footer.text && !embed.footer.icon_url) {
                embed.footer = null;
            }
            if (embed.fields.length === 0) {
                embed.fields = null;
            }
        }
        
        // Save to temporary storage (will be saved when user clicks main save button)
        if (!serverConfig.notifications) {
            serverConfig.notifications = {
                memberJoin: { enabled: false, channelId: null, message: '', embed: null, deleteAfter: 0 },
                memberLeave: { enabled: false, channelId: null, message: '', embed: null, deleteAfter: 0 }
            };
        }
        
        const notification = currentEditType === 'join' ? serverConfig.notifications.memberJoin : serverConfig.notifications.memberLeave;
        const finalMessage = (messageType === 'text' || messageType === 'both') ? messageText : '';
        const finalEmbed = (messageType === 'embed' || messageType === 'both') ? embed : null;
        
        // Update notification object
        notification.message = finalMessage;
        notification.embed = finalEmbed;
        
        // Save directly to server
        try {
            const deleteAfter = currentEditType === 'join' 
                ? document.getElementById('notify-join-delete-after')?.value || 0
                : document.getElementById('notify-leave-delete-after')?.value || 0;
            
            await fetch(`${CONFIG.API_BASE_URL}/api/server/${guildId}/notifications`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    type: currentEditType === 'join' ? 'memberJoin' : 'memberLeave',
                    enabled: notification.enabled || false,
                    channelId: notification.channelId || null,
                    message: finalMessage,
                    embed: finalEmbed,
                    deleteAfter: parseInt(deleteAfter) || 0
                })
            });
            
            // Update preview on main page
            updateMainPreview(currentEditType);
            
            // Close modal
            closeMessageEditModal();
            
            showNotification('✅ Mensagem salva com sucesso!', 'success');
        } catch (error) {
            console.error('Erro ao salvar mensagem:', error);
            showNotification('❌ Erro ao salvar mensagem. Tente novamente.', 'error');
        }
    }
    
    // Update main preview (outside modal)
    function updateMainPreview(type) {
        const notification = type === 'join' ? serverConfig.notifications.memberJoin : serverConfig.notifications.memberLeave;
        const previewSimple = document.getElementById(`${type}-preview-simple`);
        const previewEmbed = document.getElementById(`${type}-preview-embed`);
        
        // Find preview section by traversing up from previewSimple
        const previewSection = previewSimple?.closest('.message-preview-section');
        
        if (!previewSimple && !previewEmbed) {
            console.warn(`⚠️ Preview elements not found for type: ${type}`);
            return;
        }
        
        const hasText = notification.message && notification.message.trim();
        const hasEmbed = notification.embed && (notification.embed.title || notification.embed.description);
        
        // Replace variables helper
        const replaceVars = (text) => {
            if (!text) return '';
            const serverName = UI.serverName?.textContent || 'Server';
            const now = new Date();
            const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
            const date = now.toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric' });
            
            // Get user data
            const userName = currentUser?.username || 'Usuario';
            const userId = currentUser?.id || '000000000000000000';
            const userAvatar = currentUser?.avatar 
                ? `https://cdn.discordapp.com/avatars/${currentUser.id}/${currentUser.avatar}.png?size=64`
                : '/images/holly.gif';
            
            // Get server icon
            const serverIcon = UI.serverIcon?.src || 'https://cdn.discordapp.com/embed/avatars/0.png';
            
            // Replace channel mentions (<#channelId>) with channel names
            let processedText = text.replace(/<#(\d+)>/g, (match, channelId) => {
                const channel = guildChannels.find(ch => ch.id === channelId);
                const channelName = channel ? channel.name : 'canal-desconhecido';
                return `<span class="discord-mention">#${channelName}</span>`;
            });
            
            // Replace role mentions (<@&roleId>) with role names
            processedText = processedText.replace(/<@&(\d+)>/g, (match, roleId) => {
                const role = guildRoles.find(r => r.id === roleId);
                const roleName = role ? role.name : 'cargo-desconhecido';
                return `<span class="discord-mention">@${roleName}</span>`;
            });
            
            return processedText
                .replace(/\{user\}/g, `<span class="discord-mention">@${userName}</span>`)
                .replace(/\{username\}/g, userName)
                .replace(/\{user\.avatar\}/g, userAvatar)
                .replace(/\{user\.id\}/g, userId)
                .replace(/\{server\.icon\}/g, serverIcon)
                .replace(/\{time\}/g, time)
                .replace(/\{date\}/g, date)
                .replace(/\{server\}/g, serverName)
                .replace(/\{members\}/g, '100');
        };
        
        // Update simple message
        if (previewSimple && hasText) {
            const previewText = document.getElementById(`${type}-preview-text`);
            const timestamp = previewSimple.querySelector('.discord-message-timestamp');
            
            if (previewText) {
                previewText.innerHTML = replaceVars(notification.message);
            }
            
            // Update timestamp
            if (timestamp) {
                const now = new Date();
                const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
                timestamp.textContent = `Today at ${timeStr}`;
            }
            
            previewSimple.style.display = 'flex';
        } else if (previewSimple && !hasEmbed) {
            previewSimple.style.display = 'none';
        } else if (previewSimple) {
            previewSimple.style.display = 'flex';
        }
        
        // Update embed
        if (previewEmbed && hasEmbed) {
            updateMainEmbedPreview(previewEmbed, notification.embed, replaceVars);
            previewEmbed.style.display = 'block';
        } else if (previewEmbed) {
            previewEmbed.style.display = 'none';
        }
        
        // Show preview section if has content
        if (previewSection) {
            if (hasText || hasEmbed) {
                previewSection.style.display = 'block';
                previewSection.style.visibility = 'visible';
            } else {
                previewSection.style.display = 'none';
            }
        } else {
            console.warn(`⚠️ Preview section não encontrada para type: ${type}`);
        }
    }
    
    // Update main embed preview (for preview outside modal)
    function updateMainEmbedPreview(container, embed, replaceVars) {
        if (!embed) return;
        
        const color = embed.color || '#5865f2';
        
        // Helper to replace placeholders in URLs (defined before use)
        const replaceVarsInUrl = (url) => {
            if (!url) return '';
            const serverIcon = UI.serverIcon?.src || 'https://cdn.discordapp.com/embed/avatars/0.png';
            const userId = currentUser?.id || '000000000000000000';
            const userAvatar = currentUser?.avatar 
                ? `https://cdn.discordapp.com/avatars/${currentUser.id}/${currentUser.avatar}.png?size=64`
                : '/images/holly.gif';
            
            return url
                .replace(/\{user\.avatar\}/g, userAvatar)
                .replace(/\{user\.id\}/g, userId)
                .replace(/\{server\.icon\}/g, serverIcon);
        };
        
        // Build embed HTML
        let embedHTML = `<div class="discord-embed-color-bar" style="background-color: ${color};"></div>`;
        embedHTML += '<div class="discord-embed-content">';
        
        // Author
        if (embed.author && embed.author.name) {
            embedHTML += '<div class="discord-embed-author">';
            if (embed.author.icon_url) {
                const authorIconUrl = replaceVarsInUrl(embed.author.icon_url);
                embedHTML += `<img src="${authorIconUrl}" alt="Author" class="discord-embed-author-icon" onerror="this.style.display='none'">`;
            }
            if (embed.author.url) {
                const authorUrl = replaceVarsInUrl(embed.author.url);
                embedHTML += `<a href="${authorUrl}" target="_blank" style="color: inherit; text-decoration: none;">${replaceVars(embed.author.name)}</a>`;
            } else {
                embedHTML += replaceVars(embed.author.name);
            }
            embedHTML += '</div>';
        }
        
        // Title
        if (embed.title) {
            if (embed.titleUrl) {
                const titleUrl = replaceVarsInUrl(embed.titleUrl);
                embedHTML += `<div class="discord-embed-title"><a href="${titleUrl}" target="_blank" style="color: inherit; text-decoration: none;">${replaceVars(embed.title)}</a></div>`;
            } else {
                embedHTML += `<div class="discord-embed-title">${replaceVars(embed.title)}</div>`;
            }
        }
        
        // Description
        if (embed.description) {
            embedHTML += `<div class="discord-embed-description">${replaceVars(embed.description)}</div>`;
        }
        
        // Fields
        if (embed.fields && Array.isArray(embed.fields) && embed.fields.length > 0) {
            embedHTML += '<div class="discord-embed-fields">';
            embed.fields.forEach(field => {
                if (field.name || field.value) {
                    embedHTML += `<div class="discord-embed-field" style="display: ${field.inline ? 'inline-block' : 'block'}; width: ${field.inline ? '48%' : '100%'}; margin-right: ${field.inline ? '2%' : '0'};">`;
                    embedHTML += `<div class="discord-embed-field-name">${replaceVars(field.name || '\u200b')}</div>`;
                    embedHTML += `<div class="discord-embed-field-value">${replaceVars(field.value || '\u200b')}</div>`;
                    embedHTML += '</div>';
                }
            });
            embedHTML += '</div>';
        }
        
        // Thumbnail
        if (embed.thumbnail && embed.thumbnail.url) {
            const thumbnailUrl = replaceVarsInUrl(embed.thumbnail.url);
            embedHTML += `<div class="discord-embed-thumbnail"><img src="${thumbnailUrl}" alt="Thumbnail" onerror="this.parentElement.style.display='none'"></div>`;
        }
        
        // Image
        if (embed.image && embed.image.url) {
            const imageUrl = replaceVarsInUrl(embed.image.url);
            embedHTML += `<div class="discord-embed-image"><img src="${imageUrl}" alt="Embed Image" onerror="this.parentElement.style.display='none'"></div>`;
        }
        
        // Footer
        if (embed.footer && embed.footer.text) {
            embedHTML += '<div class="discord-embed-footer">';
            if (embed.footer.icon_url) {
                const footerIconUrl = replaceVarsInUrl(embed.footer.icon_url);
                embedHTML += `<img src="${footerIconUrl}" alt="Footer" class="discord-embed-footer-icon" onerror="this.style.display='none'">`;
            }
            embedHTML += `<span>${replaceVars(embed.footer.text)}</span>`;
            embedHTML += '</div>';
        }
        
        // Author icon
        if (embed.author && embed.author.icon_url) {
            // Author was already added, but we need to update the icon URL
            const authorIconUrl = replaceVarsInUrl(embed.author.icon_url);
            // Find the author icon in the HTML and update it
            embedHTML = embedHTML.replace(
                /<img src="[^"]*" alt="Author" class="discord-embed-author-icon"/g,
                `<img src="${authorIconUrl}" alt="Author" class="discord-embed-author-icon"`
            );
        }
        
        embedHTML += '</div>';
        container.innerHTML = embedHTML;
    }
    
    // Setup modal event listeners
    function setupModalListeners() {
        console.log('🔧 Configurando event listeners do modal...');
        // Edit message buttons
        const editJoinBtn = document.getElementById('edit-join-message');
        const editLeaveBtn = document.getElementById('edit-leave-message');
        
        console.log('📌 Botão join encontrado:', !!editJoinBtn);
        console.log('📌 Botão leave encontrado:', !!editLeaveBtn);
        
        if (editJoinBtn) {
            editJoinBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('🖱️ Clique no botão edit-join-message');
                openMessageEditModal('join');
            });
        }
        
        if (editLeaveBtn) {
            editLeaveBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('🖱️ Clique no botão edit-leave-message');
                openMessageEditModal('leave');
            });
        }
        
        // Close modal buttons
        const closeModalBtn = document.getElementById('close-message-modal');
        const cancelBtn = document.getElementById('cancel-message-edit');
        
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', closeMessageEditModal);
        }
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', closeMessageEditModal);
        }
        
        // Close on backdrop click
        const modal = document.getElementById('message-edit-modal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    closeMessageEditModal();
                }
            });
        }
        
        // Message type change
        const messageTypeSelect = document.getElementById('message-type');
        if (messageTypeSelect) {
            messageTypeSelect.addEventListener('change', (e) => {
                toggleMessageType(e.target.value);
            });
        }
        
        // Add embed field button
        const addFieldBtn = document.getElementById('add-embed-field');
        if (addFieldBtn) {
            addFieldBtn.addEventListener('click', () => addEmbedField());
        }
        
        // Color picker sync
        const colorPicker = document.getElementById('embed-color-picker');
        const colorInput = document.getElementById('embed-color');
        
        if (colorPicker && colorInput) {
            colorPicker.addEventListener('input', (e) => {
                colorInput.value = e.target.value;
                updateModalPreview();
            });
            
            colorInput.addEventListener('input', (e) => {
                if (e.target.value.match(/^#[0-9A-Fa-f]{6}$/)) {
                    colorPicker.value = e.target.value;
                }
                updateModalPreview();
            });
        }
        
        // Color presets
        document.querySelectorAll('.color-preset').forEach(preset => {
            preset.addEventListener('click', (e) => {
                const color = e.target.dataset.color;
                if (colorInput) colorInput.value = color;
                if (colorPicker) colorPicker.value = color;
                
                // Update active state
                document.querySelectorAll('.color-preset').forEach(p => p.classList.remove('active'));
                e.target.classList.add('active');
                
                updateModalPreview();
            });
        });
        
        // Save message button
        const saveMessageBtn = document.getElementById('save-message-edit');
        if (saveMessageBtn) {
            saveMessageBtn.addEventListener('click', saveMessageConfig);
        }
        
        // Update preview on input changes
        const previewInputs = [
            'message-text', 'embed-author-name', 'embed-author-url', 'embed-author-icon',
            'embed-title', 'embed-title-url', 'embed-description',
            'embed-image', 'embed-thumbnail', 'embed-footer-text', 'embed-footer-icon'
        ];
        
        previewInputs.forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('input', updateModalPreview);
            }
        });
        
        // Setup autocomplete for channels (#) and roles (@) in message text
        const messageTextInput = document.getElementById('message-text');
        const embedDescriptionInput = document.getElementById('embed-description');
        
        [messageTextInput, embedDescriptionInput].forEach(input => {
            if (input) {
                setupAutocomplete(input);
            }
        });
        
        // Setup emoji picker buttons
        document.querySelectorAll('.emoji-picker-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = btn.dataset.target;
                openEmojiPicker(targetId);
            });
        });
        
        // Setup scroll indicators for modal body
        setupScrollIndicators();
    }
    
    // Emoji picker system
    let guildEmojis = [];
    let emojiPickerTarget = null;
    
    async function loadGuildEmojis() {
        if (guildEmojis.length > 0) return guildEmojis;
        
        try {
            const res = await fetch(`${CONFIG.API_BASE_URL}/api/server/${guildId}/emojis`, {
                credentials: 'include'
            });
            
            if (res.ok) {
                guildEmojis = await res.json();
                return guildEmojis;
            } else {
                console.warn('Erro ao buscar emojis:', res.status, res.statusText);
                return [];
            }
        } catch (error) {
            console.error('Erro ao buscar emojis:', error);
            return [];
        }
    }
    
    async function openEmojiPicker(targetId) {
        emojiPickerTarget = targetId;
        const sidebar = document.getElementById('emoji-picker-sidebar');
        const overlay = document.getElementById('emoji-sidebar-overlay');
        const container = document.getElementById('emoji-picker-container');
        
        if (!sidebar || !container) return;
        
        // Show loading
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; color: var(--text-light); padding: 2rem;">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Carregando emojis...</p>
            </div>
        `;
        
        sidebar.classList.add('active');
        if (overlay) overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // Load emojis
        const emojis = await loadGuildEmojis();
        
        if (emojis.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; color: var(--text-light); padding: 2rem;">
                    <i class="fas fa-frown"></i>
                    <p>Nenhum emoji encontrado neste servidor</p>
                </div>
            `;
            return;
        }
        
        // Render emojis
        container.innerHTML = emojis.map(emoji => `
            <button 
                type="button" 
                class="emoji-item" 
                data-emoji="${emoji.animated ? `<a:${emoji.name}:${emoji.id}>` : `<:${emoji.name}:${emoji.id}>`}"
                title="${emoji.name}"
            >
                <img src="${emoji.url}" alt="${emoji.name}">
            </button>
        `).join('');
        
        // Add click handlers
        container.querySelectorAll('.emoji-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const emoji = btn.dataset.emoji;
                insertEmoji(emoji);
            });
        });
    }
    
    function insertEmoji(emoji) {
        if (!emojiPickerTarget) return;
        
        const target = document.getElementById(emojiPickerTarget);
        if (!target) return;
        
        const cursorPos = target.selectionStart || target.value.length;
        const textBefore = target.value.substring(0, cursorPos);
        const textAfter = target.value.substring(cursorPos);
        
        target.value = textBefore + emoji + textAfter;
        target.setSelectionRange(cursorPos + emoji.length, cursorPos + emoji.length);
        target.focus();
        
        // Update preview
        updateModalPreview();
        
        // Close modal
        closeEmojiPicker();
    }
    
    function closeEmojiPicker() {
        const sidebar = document.getElementById('emoji-picker-sidebar');
        const overlay = document.getElementById('emoji-sidebar-overlay');
        if (sidebar) {
            sidebar.classList.remove('active');
        }
        if (overlay) {
            overlay.classList.remove('active');
        }
        document.body.style.overflow = '';
        emojiPickerTarget = null;
    }
    
    // Setup scroll indicators for modal
    function setupScrollIndicators() {
        const modalBody = document.querySelector('#message-edit-modal .modal-body');
        if (!modalBody) return;
        
        const topIndicator = modalBody.querySelector('.scroll-indicator-top');
        const bottomIndicator = modalBody.querySelector('.scroll-indicator-bottom');
        
        if (!topIndicator || !bottomIndicator) return;
        
        function updateScrollIndicators() {
            const { scrollTop, scrollHeight, clientHeight } = modalBody;
            const isScrollable = scrollHeight > clientHeight;
            
            if (!isScrollable) {
                topIndicator.style.display = 'none';
                bottomIndicator.style.display = 'none';
                return;
            }
            
            // Show top indicator if scrolled down
            if (scrollTop > 10) {
                topIndicator.style.display = 'block';
                topIndicator.style.opacity = '1';
            } else {
                topIndicator.style.opacity = '0';
                setTimeout(() => {
                    if (modalBody.scrollTop <= 10) {
                        topIndicator.style.display = 'none';
                    }
                }, 200);
            }
            
            // Show bottom indicator if not scrolled to bottom
            if (scrollTop < scrollHeight - clientHeight - 10) {
                bottomIndicator.style.display = 'block';
                bottomIndicator.style.opacity = '1';
            } else {
                bottomIndicator.style.opacity = '0';
                setTimeout(() => {
                    if (modalBody.scrollTop >= scrollHeight - clientHeight - 10) {
                        bottomIndicator.style.display = 'none';
                    }
                }, 200);
            }
        }
        
        // Update on scroll
        modalBody.addEventListener('scroll', updateScrollIndicators);
        
        // Update on resize
        window.addEventListener('resize', updateScrollIndicators);
        
        // Initial update
        setTimeout(updateScrollIndicators, 100);
    }
    
    // Autocomplete system for channels (#) and roles (@)
    function setupAutocomplete(input) {
        let autocompleteDiv = null;
        let currentQuery = '';
        
        input.addEventListener('input', (e) => {
            const value = e.target.value;
            const cursorPos = e.target.selectionStart;
            const textBeforeCursor = value.substring(0, cursorPos);
            
            // Check for # (channel) or @ (role)
            const lastHash = textBeforeCursor.lastIndexOf('#');
            const lastAt = textBeforeCursor.lastIndexOf('@');
            
            // Determine which trigger is more recent and valid
            let lastTrigger = -1;
            let type = null;
            
            if (lastHash !== -1 && lastAt !== -1) {
                // Both found, use the one that's closer to cursor
                lastTrigger = Math.max(lastHash, lastAt);
                type = lastHash > lastAt ? 'channel' : 'role';
            } else if (lastHash !== -1) {
                lastTrigger = lastHash;
                type = 'channel';
            } else if (lastAt !== -1) {
                lastTrigger = lastAt;
                type = 'role';
            }
            
            if (lastTrigger !== -1 && type) {
                const textAfterTrigger = textBeforeCursor.substring(lastTrigger + 1);
                // Only show autocomplete if there's no space after trigger and not already a mention
                if (!textAfterTrigger.includes(' ') && !textAfterTrigger.includes('\n') && !textAfterTrigger.includes('>') && !textAfterTrigger.includes('&')) {
                    currentQuery = textAfterTrigger.toLowerCase();
                    console.log('🔍 Autocomplete triggered:', { type, query: currentQuery, lastHash, lastAt, lastTrigger });
                    showAutocomplete(input, type, currentQuery, lastTrigger);
                } else {
                    hideAutocomplete();
                }
            } else {
                hideAutocomplete();
            }
        });
        
        input.addEventListener('keydown', (e) => {
            if (autocompleteDiv && autocompleteDiv.style.display !== 'none') {
                const items = autocompleteDiv.querySelectorAll('.autocomplete-item');
                const selected = autocompleteDiv.querySelector('.autocomplete-item.selected');
                
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    if (selected) {
                        selected.classList.remove('selected');
                        const next = selected.nextElementSibling || items[0];
                        if (next) next.classList.add('selected');
                    } else if (items[0]) {
                        items[0].classList.add('selected');
                    }
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    if (selected) {
                        selected.classList.remove('selected');
                        const prev = selected.previousElementSibling || items[items.length - 1];
                        if (prev) prev.classList.add('selected');
                    } else if (items[items.length - 1]) {
                        items[items.length - 1].classList.add('selected');
                    }
                } else if (e.key === 'Enter' && selected) {
                    e.preventDefault();
                    selectAutocompleteItem(input, selected);
                } else if (e.key === 'Escape') {
                    hideAutocomplete();
                }
            }
        });
        
        async function showAutocomplete(input, type, query, triggerPos) {
            if (!autocompleteDiv) {
                autocompleteDiv = document.createElement('div');
                autocompleteDiv.className = 'autocomplete-dropdown';
                autocompleteDiv.style.cssText = 'position: absolute; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 4px; max-height: 200px; overflow-y: auto; z-index: 10000; box-shadow: 0 4px 12px rgba(0,0,0,0.15); display: none;';
                document.body.appendChild(autocompleteDiv);
            }
            
            let items = [];
            if (type === 'channel') {
                items = getChannels(query);
            } else if (type === 'role') {
                items = await getRoles(query);
            }
            console.log('📋 Items encontrados:', items.length, 'tipo:', type);
            
            if (items.length === 0) {
                hideAutocomplete();
                return;
            }
            
            autocompleteDiv.innerHTML = items.map(item => 
                `<div class="autocomplete-item" data-value="${item.value}" data-display="${item.display}">
                    ${item.icon || ''} ${item.display}
                </div>`
            ).join('');
            
            // Position autocomplete
            const rect = input.getBoundingClientRect();
            autocompleteDiv.style.top = `${rect.bottom + window.scrollY + 5}px`;
            autocompleteDiv.style.left = `${rect.left + window.scrollX}px`;
            autocompleteDiv.style.width = `${Math.max(rect.width, 200)}px`;
            autocompleteDiv.style.display = 'block';
            
            // Add click handlers
            autocompleteDiv.querySelectorAll('.autocomplete-item').forEach((item, index) => {
                if (index === 0) item.classList.add('selected');
                item.addEventListener('click', () => selectAutocompleteItem(input, item));
            });
        }
        
        function getChannels(query) {
            if (!guildChannels || guildChannels.length === 0) return [];
            return guildChannels
                .filter(ch => (ch.isText || ch.type === 0 || ch.type === 5) && ch.name && ch.name.toLowerCase().includes(query))
                .slice(0, 10)
                .map(ch => ({
                    value: `<#${ch.id}>`,
                    display: `# ${ch.name}`,
                    icon: '<span style="color: #80848e;">#</span>'
                }));
        }
        
        let guildRoles = [];
        
        async function getRoles(query) {
            try {
                if (guildRoles.length === 0) {
                    // Fetch roles from API
                    const res = await fetch(`${CONFIG.API_BASE_URL}/api/server/${guildId}/roles`, {
                        credentials: 'include'
                    });
                    if (res.ok) {
                        const roles = await res.json();
                        guildRoles = Array.isArray(roles) ? roles : [];
                    } else {
                        console.warn('Erro ao buscar cargos:', res.status, res.statusText);
                        return [];
                    }
                }
                
                if (!guildRoles || guildRoles.length === 0) return [];
                
                // If query is empty, return all roles (up to 10)
                // Otherwise filter by name
                let filtered = guildRoles.filter(role => role && role.name && role.id && role.id !== guildId);
                
                if (query && query.trim()) {
                    filtered = filtered.filter(role => role.name.toLowerCase().includes(query.toLowerCase()));
                }
                
                return filtered
                    .slice(0, 10)
                    .map(role => ({
                        value: `<@&${role.id}>`,
                        display: `@ ${role.name}`,
                        icon: '<span style="color: #80848e;">@</span>'
                    }));
            } catch (error) {
                console.error('Erro ao buscar cargos:', error);
                return [];
            }
        }
        
        function selectAutocompleteItem(input, item) {
            const value = input.value;
            const cursorPos = input.selectionStart;
            const textBeforeCursor = value.substring(0, cursorPos);
            const textAfterCursor = value.substring(cursorPos);
            
            const lastHash = textBeforeCursor.lastIndexOf('#');
            const lastAt = textBeforeCursor.lastIndexOf('@');
            const lastTrigger = Math.max(lastHash, lastAt);
            
            if (lastTrigger !== -1) {
                const newValue = value.substring(0, lastTrigger) + item.dataset.value + ' ' + textAfterCursor;
                input.value = newValue;
                input.setSelectionRange(lastTrigger + item.dataset.value.length + 1, lastTrigger + item.dataset.value.length + 1);
                input.focus();
                updateModalPreview();
            }
            
            hideAutocomplete();
        }
        
        function hideAutocomplete() {
            if (autocompleteDiv) {
                autocompleteDiv.style.display = 'none';
            }
        }
        
        // Hide autocomplete when clicking outside
        document.addEventListener('click', (e) => {
            if (autocompleteDiv && !autocompleteDiv.contains(e.target) && e.target !== input) {
                hideAutocomplete();
            }
        });
    }
    
    // Call setupModalListeners in setupEventListeners
    const originalSetupEventListeners = setupEventListeners;
    setupEventListeners = function() {
        originalSetupEventListeners();
        setupModalListeners();
    };

    // Setup edit buttons directly - multiple approaches to ensure it works
    function setupEditButtons() {
        console.log('🔧 Configurando botões de edição...');
        
        const editJoinBtn = document.getElementById('edit-join-message');
        const editLeaveBtn = document.getElementById('edit-leave-message');
        
        console.log('📌 Botão join:', editJoinBtn ? 'ENCONTRADO' : 'NÃO ENCONTRADO');
        console.log('📌 Botão leave:', editLeaveBtn ? 'ENCONTRADO' : 'NÃO ENCONTRADO');
        
        if (editJoinBtn) {
            // Remove old listeners
            const newBtn = editJoinBtn.cloneNode(true);
            editJoinBtn.parentNode.replaceChild(newBtn, editJoinBtn);
            
            newBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('✅ Clique no botão edit-join-message');
                openMessageEditModal('join');
            });
        }
        
        if (editLeaveBtn) {
            // Remove old listeners
            const newBtn = editLeaveBtn.cloneNode(true);
            editLeaveBtn.parentNode.replaceChild(newBtn, editLeaveBtn);
            
            newBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('✅ Clique no botão edit-leave-message');
                openMessageEditModal('leave');
            });
        }
    }
    
    // Use event delegation as backup
    document.addEventListener('click', (e) => {
        const target = e.target.closest('#edit-join-message, #edit-leave-message');
        if (target) {
            e.preventDefault();
            e.stopPropagation();
            const type = target.id === 'edit-join-message' ? 'join' : 'leave';
            console.log(`🖱️ Clique via delegation: ${type}`);
            openMessageEditModal(type);
        }
    });

    // Setup buttons after init
    init().then(() => {
        setTimeout(() => {
            setupEditButtons();
        }, 500);
    }).catch(() => {
        // If init doesn't return a promise, setup buttons anyway
        setTimeout(() => {
            setupEditButtons();
        }, 1000);
    });
});

