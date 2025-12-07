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
        notifyLeaveEnabled: document.getElementById('notify-leave-enabled'),
        notifyLeaveConfig: document.getElementById('notify-leave-config'),
        notifyLeaveChannel: document.getElementById('notify-leave-channel'),
        notifyLeaveMessage: document.getElementById('notify-leave-message'),
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
                
                return user;
            } else if (res.status === 401) {
                // Token expired - redirect to login
                console.warn('Token expirado, redirecionando para login...');
                window.location.href = '/dashboard?error=session_expired';
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
            memberJoin: { enabled: false, channelId: null, message: '' },
            memberLeave: { enabled: false, channelId: null, message: '' }
        };

        // Join notifications
        if (UI.notifyJoinEnabled) {
            UI.notifyJoinEnabled.checked = notifications.memberJoin?.enabled || false;
            toggleNotificationConfig('join', UI.notifyJoinEnabled.checked);
        }
        if (UI.notifyJoinChannel) {
            UI.notifyJoinChannel.value = notifications.memberJoin?.channelId || '';
        }
        if (UI.notifyJoinMessage) {
            UI.notifyJoinMessage.value = notifications.memberJoin?.message || 'Welcome {user} to the server! Joined at {time}';
        }

        // Leave notifications
        if (UI.notifyLeaveEnabled) {
            UI.notifyLeaveEnabled.checked = notifications.memberLeave?.enabled || false;
            toggleNotificationConfig('leave', UI.notifyLeaveEnabled.checked);
        }
        if (UI.notifyLeaveChannel) {
            UI.notifyLeaveChannel.value = notifications.memberLeave?.channelId || '';
        }
        if (UI.notifyLeaveMessage) {
            UI.notifyLeaveMessage.value = notifications.memberLeave?.message || '{username} left the server at {time}';
        }

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

            // Save join notifications
            await fetch(`${CONFIG.API_BASE_URL}/api/server/${guildId}/notifications`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    type: 'memberJoin',
                    enabled: UI.notifyJoinEnabled.checked,
                    channelId: UI.notifyJoinChannel.value || null,
                    message: UI.notifyJoinMessage.value.trim()
                })
            });

            // Save leave notifications
            await fetch(`${CONFIG.API_BASE_URL}/api/server/${guildId}/notifications`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    type: 'memberLeave',
                    enabled: UI.notifyLeaveEnabled.checked,
                    channelId: UI.notifyLeaveChannel.value || null,
                    message: UI.notifyLeaveMessage.value.trim()
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
            
            // Small delay before redirect
            setTimeout(() => {
                window.location.href = '/dashboard';
            }, 1000);
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
        // Simple notification system
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            background: ${type === 'success' ? '#2ecc71' : type === 'error' ? '#e74c3c' : '#3498db'};
            color: white;
            border-radius: 8px;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transition = 'opacity 0.3s';
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
                await loadGuildChannels(true);
                refreshBtn.disabled = false;
                refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
                showNotification('✅ Canais atualizados!', 'success');
            });
        }

        if (refreshBtnLeave) {
            refreshBtnLeave.addEventListener('click', async () => {
                refreshBtnLeave.disabled = true;
                refreshBtnLeave.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                await loadGuildChannels(true);
                refreshBtnLeave.disabled = false;
                refreshBtnLeave.innerHTML = '<i class="fas fa-sync-alt"></i>';
                showNotification('✅ Canais atualizados!', 'success');
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

    // Initialize
    async function init() {
        showLoading(true);

        // Load user info first (this handles auth check and redirects if needed)
        const user = await loadUserInfo();
        
        // If user is null, it means token expired and we should have redirected
        // But just in case, check again
        if (!user) {
            showLoading(false);
            // loadUserInfo should have already redirected, but if not, redirect now
            setTimeout(() => {
                window.location.href = '/dashboard?error=session_expired';
            }, 1000);
            return;
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
    }

    init();
});

