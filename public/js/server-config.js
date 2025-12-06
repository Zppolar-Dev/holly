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
    async function loadGuildChannels() {
        try {
            const res = await fetch(`${CONFIG.API_BASE_URL}/api/server/${guildId}/channels`, {
                credentials: 'include'
            });

            if (res.ok) {
                const channels = await res.json();
                return channels.filter(ch => ch.type === 0); // Only text channels
            }
            return [];
        } catch (error) {
            console.error('Erro ao carregar canais:', error);
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
                    return guild;
                }
            }
            return null;
        } catch (error) {
            console.error('Erro ao carregar informações do servidor:', error);
            return null;
        }
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
            UI.notifyJoinMessage.value = notifications.memberJoin?.message || 'Bem-vindo @nome ao servidor! Entrou em @hora';
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
            UI.notifyLeaveMessage.value = notifications.memberLeave?.message || '@nome saiu do servidor em @hora';
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

        const isAuthenticated = await checkAuth();
        if (!isAuthenticated) return;

        const [config, channels, serverInfo] = await Promise.all([
            loadServerConfig(),
            loadGuildChannels(),
            loadServerInfo()
        ]);

        if (config) {
            populateForm(config);
        }

        if (channels) {
            populateChannels(channels);
        }

        setupEventListeners();
        initTheme();

        showLoading(false);
    }

    init();
});

