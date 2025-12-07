/**
 * Admin Panel JavaScript
 * Administrative area for bot and site management
 */

document.addEventListener('DOMContentLoaded', async function() {
    const CONFIG = {
        API_BASE_URL: window.location.origin,
        THEME_KEY: 'holly_theme'
    };

    let currentUser = null;
    let isOwner = false;

    // UI Elements
    const UI = {
        adminsList: document.getElementById('adminsList'),
        addAdminForm: document.getElementById('addAdminForm'),
        newAdminId: document.getElementById('newAdminId'),
        addAdminBtn: document.getElementById('addAdminBtn'),
        serversTableContainer: document.getElementById('serversTableContainer'),
        themeToggle: document.getElementById('themeToggle')
    };

    // Check authentication and admin status
    async function checkAuth() {
        try {
            const res = await fetch(`${CONFIG.API_BASE_URL}/api/user`, {
                credentials: 'include'
            });

            if (!res.ok) {
                window.location.href = '/dashboard';
                return false;
            }

            currentUser = await res.json();
            
            // Check if user is owner
            isOwner = currentUser.id === '909204567042981978';
            
            // Show add admin form only for owner
            if (isOwner && UI.addAdminForm) {
                UI.addAdminForm.style.display = 'block';
            }
            
            return true;
        } catch (error) {
            console.error('Erro ao verificar autenticação:', error);
            window.location.href = '/dashboard';
            return false;
        }
    }

    // Load administrators
    async function loadAdministrators() {
        try {
            const res = await fetch(`${CONFIG.API_BASE_URL}/api/admin/administrators`, {
                credentials: 'include'
            });

            if (!res.ok) {
                throw new Error('Erro ao carregar administradores');
            }

            const admins = await res.json();
            renderAdministrators(admins);
        } catch (error) {
            console.error('Erro ao carregar administradores:', error);
            UI.adminsList.innerHTML = '<div class="loading">Erro ao carregar administradores</div>';
        }
    }

    // Render administrators list
    function renderAdministrators(admins) {
        if (!UI.adminsList) return;
        
        if (admins.length === 0) {
            UI.adminsList.innerHTML = '<div class="loading">Nenhum administrador encontrado</div>';
            return;
        }

        const html = admins.map(admin => `
            <div class="admin-item">
                <div class="admin-info">
                    <img src="https://cdn.discordapp.com/embed/avatars/${parseInt(admin.user_id) % 5}.png" 
                         alt="Admin" class="admin-avatar">
                    <div>
                        <strong>ID: ${admin.user_id}</strong>
                        <div style="font-size: 0.85rem; color: var(--text-light);">
                            Adicionado em: ${new Date(admin.added_at).toLocaleDateString('pt-BR')}
                        </div>
                    </div>
                </div>
                ${isOwner ? `
                    <button class="btn-danger" onclick="removeAdmin('${admin.user_id}')">
                        <i class="fas fa-trash"></i> Remover
                    </button>
                ` : ''}
            </div>
        `).join('');

        UI.adminsList.innerHTML = html;
    }

    // Remove administrator
    window.removeAdmin = async function(userId) {
        if (!confirm('Tem certeza que deseja remover este administrador?')) {
            return;
        }

        try {
            const res = await fetch(`${CONFIG.API_BASE_URL}/api/admin/administrators/${userId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (res.ok) {
                showNotification('✅ Administrador removido com sucesso!', 'success');
                loadAdministrators();
            } else {
                const error = await res.json();
                showNotification(error.error || 'Erro ao remover administrador', 'error');
            }
        } catch (error) {
            console.error('Erro ao remover administrador:', error);
            showNotification('Erro ao remover administrador', 'error');
        }
    };

    // Add administrator with confirmation
    if (UI.addAdminBtn) {
        UI.addAdminBtn.addEventListener('click', async () => {
            const userId = UI.newAdminId.value.trim();
            
            if (!userId) {
                showNotification('Por favor, insira o ID do usuário', 'error');
                return;
            }

            // Fetch user info from Discord
            try {
                const userRes = await fetch(`${CONFIG.API_BASE_URL}/api/discord/user/${userId}`, {
                    credentials: 'include'
                });

                if (!userRes.ok) {
                    const error = await userRes.json();
                    showNotification(error.error || 'Usuário não encontrado', 'error');
                    return;
                }

                const user = await userRes.json();
                
                // Show confirmation modal
                const confirmed = await showConfirmAddAdmin(user);
                if (!confirmed) {
                    return;
                }

                // Add administrator
                const res = await fetch(`${CONFIG.API_BASE_URL}/api/admin/administrators`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({ userId })
                });

                if (res.ok) {
                    showNotification('✅ Administrador adicionado com sucesso!', 'success');
                    UI.newAdminId.value = '';
                    loadAdministrators();
                } else {
                    const error = await res.json();
                    showNotification(error.error || 'Erro ao adicionar administrador', 'error');
                }
            } catch (error) {
                console.error('Erro ao adicionar administrador:', error);
                showNotification('Erro ao adicionar administrador', 'error');
            }
        });
    }
    
    // Show confirmation modal for adding admin
    function showConfirmAddAdmin(user) {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'admin-confirm-modal';
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
            `;
            
            modal.innerHTML = `
                <div style="background: var(--card-bg, #fff); border-radius: 12px; padding: 2rem; max-width: 400px; width: 90%; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
                    <h3 style="margin-top: 0; color: var(--text-color, #333);">Confirmar Adição</h3>
                    <div style="display: flex; align-items: center; gap: 1rem; margin: 1.5rem 0;">
                        <img src="${user.avatarUrl}" alt="${user.username}" style="width: 64px; height: 64px; border-radius: 50%;">
                        <div>
                            <div style="font-weight: 600; color: var(--text-color, #333);">${user.username}${user.discriminator ? `#${user.discriminator}` : ''}</div>
                            <div style="font-size: 0.85rem; color: var(--text-light, #666);">ID: ${user.id}</div>
                        </div>
                    </div>
                    <p style="color: var(--text-color, #333); margin: 1rem 0;">Tem certeza que deseja adicionar este usuário como administrador?</p>
                    <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
                        <button id="confirm-yes" style="flex: 1; padding: 0.75rem; background: #2ecc71; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">Sim, adicionar</button>
                        <button id="confirm-no" style="flex: 1; padding: 0.75rem; background: #e74c3c; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">Cancelar</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            modal.querySelector('#confirm-yes').addEventListener('click', () => {
                document.body.removeChild(modal);
                resolve(true);
            });
            
            modal.querySelector('#confirm-no').addEventListener('click', () => {
                document.body.removeChild(modal);
                resolve(false);
            });
            
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    document.body.removeChild(modal);
                    resolve(false);
                }
            });
        });
    }

    // Load all servers
    async function loadAllServers() {
        try {
            const res = await fetch(`${CONFIG.API_BASE_URL}/api/admin/servers`, {
                credentials: 'include'
            });

            if (!res.ok) {
                throw new Error('Erro ao carregar servidores');
            }

            const servers = await res.json();
            renderServers(servers);
        } catch (error) {
            console.error('Erro ao carregar servidores:', error);
            UI.serversTableContainer.innerHTML = '<div class="loading">Erro ao carregar servidores</div>';
        }
    }

    // Render servers table
    function renderServers(servers) {
        if (!UI.serversTableContainer) return;
        
        if (servers.length === 0) {
            UI.serversTableContainer.innerHTML = '<div class="loading">Nenhum servidor encontrado</div>';
            return;
        }

        const html = `
            <table class="servers-table">
                <thead>
                    <tr>
                        <th>Servidor</th>
                        <th>ID</th>
                        <th>Membros</th>
                        <th>Prefixo</th>
                        <th>Status do Bot</th>
                        <th>Última Visto</th>
                        <th>Comandos Executados</th>
                        <th>Usuários Únicos</th>
                    </tr>
                </thead>
                <tbody>
                    ${servers.map(server => `
                        <tr>
                            <td>
                                ${server.guildIcon ? `<img src="${server.guildIcon}" style="width: 32px; height: 32px; border-radius: 50%; margin-right: 0.5rem; vertical-align: middle;">` : ''}
                                <strong>${server.guildName || 'Unknown'}</strong>
                            </td>
                            <td><code>${server.guildId}</code></td>
                            <td>${server.memberCount || 0}</td>
                            <td><code>${server.prefix || '!'}</code></td>
                            <td>
                                <span class="status-badge ${server.botPresent ? 'present' : 'absent'}">
                                    ${server.botPresent ? 'Presente' : 'Ausente'}
                                </span>
                            </td>
                            <td>${server.lastSeen ? new Date(server.lastSeen).toLocaleString('pt-BR') : 'Nunca'}</td>
                            <td>${server.stats?.commandsExecuted || 0}</td>
                            <td>${server.stats?.uniqueUsers || 0}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        UI.serversTableContainer.innerHTML = html;
    }

    // Show notification
    function showNotification(message, type = 'info') {
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

    // Load user info and setup dropdown
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
                
                // Setup user dropdown
                setupUserDropdown(user);
                
                return user;
            }
            return null;
        } catch (error) {
            console.error('Erro ao carregar informações do usuário:', error);
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
        
        if (dropdownToggle) {
            dropdownToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                userDropdown.classList.toggle('active');
            });
        }
        
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
                });
            };
        }
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (userDropdown && !userDropdown.contains(e.target)) {
                userDropdown.classList.remove('active');
            }
        });
    }

    // Initialize
    async function init() {
        const isAuthenticated = await checkAuth();
        if (!isAuthenticated) return;

        await loadUserInfo();
        
        await Promise.all([
            loadAdministrators(),
            loadAllServers()
        ]);

        initTheme();
    }

    init();
});

