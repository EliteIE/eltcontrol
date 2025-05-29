// js/main.js - Versão Consolidada Completa
document.addEventListener('DOMContentLoaded', () => {
    // --- Elementos DOM Comuns ---
    const pageTitle = document.getElementById('pageTitle');
    const pageSubtitle = document.getElementById('pageSubtitle');
    const mainDashboardContent = document.getElementById('mainDashboardContent');
    const dynamicContentArea = document.getElementById('dynamicContentArea');
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const navLinksContainer = document.getElementById('navLinks');
    const usernameDisplay = document.getElementById('usernameDisplay');
    const userRoleDisplay = document.getElementById('userRoleDisplay');
    const userAvatar = document.getElementById('userAvatar');
    const logoutButton = document.getElementById('logoutButton');
    const notificationBellButton = document.getElementById('notificationBellButton');
    const notificationCountBadge = document.getElementById('notificationCountBadge');
    const notificationDropdown = document.getElementById('notificationDropdown');
    const notificationList = document.getElementById('notificationList');
    const markAllAsReadButton = document.getElementById('markAllAsReadButton');
    const temporaryAlertsContainer = document.getElementById('temporaryAlertsContainer');
    const modalPlaceholder = document.getElementById('modalPlaceholder');

    // --- Elementos do Dashboard Dinâmico ---
    const kpiContainer = document.getElementById('kpiContainer');
    const chartsContainer = document.getElementById('chartsContainer');
    const recentActivitiesContainer = document.getElementById('recentActivitiesContainer');

    // --- Estado da Aplicação ---
    let activeCharts = {};
    let activeReportCharts = {};
    let activeAiCharts = {};
    let activeMgmtReportCharts = {};
    let notificationUpdateInterval;
    const MAX_NOTIFICATIONS_IN_DROPDOWN = 5;

    let currentPageProducts = 1;
    const PRODUCTS_PER_PAGE = 10;
    let currentProductFilters = { search: '', category: '', stockStatus: '' };
    let productToEditSku = null;
    let productToDeleteSku = null;

    let currentSaleItems = [];
    let currentSale = { cliente: '', vendedorId: null, vendedorNome: '', itens: [], subtotalItens: 0, desconto: 0, total: 0, formaPagamento: 'dinheiro', status: 'pendente' };

    let currentPageSalesHistory = 1;
    const SALES_HISTORY_PER_PAGE = 10;
    let currentSalesHistoryFilters = {};
    let saleToCancelId = null;

    let mgmtReportGlobalStartDate = '';
    let mgmtReportGlobalEndDate = '';

    let editingUserId = null;
    let fileToRestore = null;

    // --- CONFIGURAÇÃO DE NAVEGAÇÃO ---
    const navigationConfig = {
        gerente: [
            { icon: 'fa-tachometer-alt', text: 'Painel Geral', section: 'dashboard', requiredPermission: 'dashboard' },
            { icon: 'fa-boxes-stacked', text: 'Produtos', section: 'products', requiredPermission: 'inventario.visualizar' },
            { icon: 'fa-cash-register', text: 'Registar Venda', section: 'sales', requiredPermission: 'vendas.registrar' },
            { icon: 'fa-history', text: 'Vendas (Hist/Rel)', section: 'sales_history_reports', requiredPermission: 'vendas.visualizar' },
            { icon: 'fa-chart-bar', text: 'Rel. Gerenciais', section: 'mgmt_reports', requiredPermission: 'vendas.relatoriosGerenciais' },
            { icon: 'fa-robot', text: 'Inteligência IA', section: 'ai_features_advanced', requiredPermission: 'ia.assistenteVirtual' },
            { icon: 'fa-cogs', text: 'Configurações', section: 'settings', requiredPermission: 'configuracoes.sistema' }
        ],
        inventario: [
            { icon: 'fa-tachometer-alt', text: 'Painel Geral', section: 'dashboard', requiredPermission: 'dashboard' },
            { icon: 'fa-boxes-stacked', text: 'Produtos', section: 'products', requiredPermission: 'inventario.visualizar' },
            { icon: 'fa-chart-bar', text: 'Rel. Gerenciais', section: 'mgmt_reports', requiredPermission: 'vendas.relatoriosGerenciais' },
            { icon: 'fa-robot', text: 'Previsão Demanda', section: 'ai_features_advanced', requiredPermission: 'ia.previsaoDemanda' },
        ],
        vendas: [
            { icon: 'fa-tachometer-alt', text: 'Painel Geral', section: 'dashboard', requiredPermission: 'dashboard' },
            { icon: 'fa-cash-register', text: 'Registar Venda', section: 'sales', requiredPermission: 'vendas.registrar' },
            { icon: 'fa-history', text: 'Minhas Vendas', section: 'sales_history_reports', requiredPermission: 'vendas.visualizar' },
            { icon: 'fa-comments', text: 'Assistente IA', section: 'ai_features_advanced', requiredPermission: 'ia.assistenteVirtual' },
        ]
    };

    // --- FUNÇÕES AUXILIARES ---
    function getLoggedInUser() { 
        const u = sessionStorage.getItem('loggedInUser'); 
        return u ? JSON.parse(u) : null; 
    }
    
    function formatCurrency(value) { 
        return `R$ ${Number(value || 0).toFixed(2).replace('.', ',')}`; 
    }
    
    function formatDate(isoString, includeTime = true, relative = false) { 
        if (!isoString) return 'N/A'; 
        const date = new Date(isoString); 
        if (relative) { 
            const now = new Date(); 
            const diffSeconds = Math.round((now - date) / 1000); 
            if (diffSeconds < 5) return `agora`; 
            if (diffSeconds < 60) return `${diffSeconds}s atrás`; 
            const diffMinutes = Math.round(diffSeconds / 60); 
            if (diffMinutes < 60) return `${diffMinutes}m atrás`; 
            const diffHours = Math.round(diffMinutes / 60); 
            if (diffHours < 24) return `${diffHours}h atrás`; 
            const diffDays = Math.round(diffHours / 24);
            if (diffDays < 30) return `${diffDays}d atrás`;
        } 
        const options = { day: '2-digit', month: '2-digit', year: 'numeric' }; 
        if(includeTime) { 
            options.hour = '2-digit'; 
            options.minute = '2-digit'; 
            options.second = '2-digit';
        } 
        return date.toLocaleString('pt-BR', options); 
    }
    
    function formatProfileName(perfilId) { 
        if (!perfilId) return "N/A"; 
        const names = { 
            gerente: "Dono/Gerente", 
            inventario: "Controlador de Estoque", 
            vendas: "Vendedor" 
        }; 
        return names[perfilId] || (perfilId.charAt(0).toUpperCase() + perfilId.slice(1)); 
    }
    
    function showTemporaryAlert(message, type = 'info', duration = 4000) { 
        if(!temporaryAlertsContainer) {
            console.warn("temporaryAlertsContainer não encontrado."); 
            return;
        } 
        const alertId = `alert-${Date.now()}`; 
        const alertDiv = document.createElement('div'); 
        alertDiv.id = alertId; 
        alertDiv.className = `temporary-alert temporary-alert-${type}`; 
        alertDiv.innerHTML = `<span>${message}</span><button class="close-btn" onclick="this.parentElement.remove()">&times;</button>`; 
        temporaryAlertsContainer.appendChild(alertDiv); 
        setTimeout(() => alertDiv.classList.add('show'), 10); 
        setTimeout(() => { 
            alertDiv.classList.remove('show'); 
            setTimeout(() => alertDiv.remove(), 500); 
        }, duration); 
    }
    
    function debounce(func, delay) { 
        let timeout; 
        return function(...args) { 
            clearTimeout(timeout); 
            timeout = setTimeout(() => func.apply(this, args), delay); 
        }; 
    }

    // --- SISTEMA DE NOTIFICAÇÕES E ALERTAS ---
    function showModalAlert(title, message, type = 'warning') {
        if (!modalPlaceholder) return;

        let iconClass = 'fa-exclamation-triangle text-amber-400';
        if (type === 'error') iconClass = 'fa-times-circle text-red-500';
        if (type === 'info') iconClass = 'fa-info-circle text-sky-400';

        const modalHTML = `
            <div id="criticalAlertModal" class="modal-backdrop">
                <div class="modal-content">
                    <div class="flex items-center mb-4">
                        <i class="fas ${iconClass} fa-2x mr-3"></i>
                        <h5 class="modal-title">${title}</h5>
                    </div>
                    <p class="modal-body">${message}</p>
                    <div class="modal-footer text-right">
                        <button id="closeCriticalAlertModal" class="bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-md">Entendido</button>
                    </div>
                </div>
            </div>
        `;
        modalPlaceholder.innerHTML = modalHTML;
        document.getElementById('closeCriticalAlertModal').addEventListener('click', () => {
            modalPlaceholder.innerHTML = '';
        });
    }

    function updateNotificationBell() {
        const user = getLoggedInUser();
        if (!user || !notificationCountBadge) return;

        if (typeof obterNotificacoesNaoLidas !== 'function') {
            console.warn("Função obterNotificacoesNaoLidas não definida.");
            return;
        }
        
        // Corrigido para lidar com a função assíncrona
        obterNotificacoesNaoLidas(user.perfil).then(notificacoes => {
            const unreadCount = notificacoes.length;
            notificationCountBadge.textContent = unreadCount;
            if (unreadCount > 0) {
                notificationCountBadge.classList.remove('hidden');
            } else {
                notificationCountBadge.classList.add('hidden');
            }
        }).catch(error => {
            console.error("Erro ao obter notificações não lidas:", error);
        });
    }

    function renderNotificationDropdown() {
        const user = getLoggedInUser();
        if (!user || !notificationList || typeof obterNotificacoes !== 'function') return;

        // Corrigido para lidar com a função assíncrona
        obterNotificacoes(user.perfil).then(notifications => {
            notificationList.innerHTML = '';

            if (notifications.length === 0) {
                notificationList.innerHTML = '<p class="p-4 text-center text-slate-500 text-sm">Nenhuma notificação.</p>';
                return;
            }

            notifications.slice(0, MAX_NOTIFICATIONS_IN_DROPDOWN).forEach(notif => {
                const itemDiv = document.createElement('div');
                itemDiv.className = `notification-item cursor-pointer ${!notif.lida ? 'unread' : ''}`;
                itemDiv.dataset.id = notif.id;
                itemDiv.innerHTML = `
                    <div class="flex justify-between items-start">
                        <h6 class="notification-title text-sm">${notif.titulo}</h6>
                        ${!notif.lida ? '<span class="bg-sky-500 text-white text-xs px-1.5 py-0.5 rounded-full">Nova</span>' : ''}
                    </div>
                    <p class="notification-message text-xs">${notif.mensagem}</p>
                    <div class="flex justify-between items-center mt-1">
                        <span class="notification-time text-xs">${formatDate(notif.timestamp, true, true)}</span>
                        ${!notif.lida ? `<button data-id="${notif.id}" class="mark-one-read-btn text-sky-400 hover:underline text-xs">Marcar como lida</button>` : ''}
                    </div>
                `;
                itemDiv.addEventListener('click', (e) => handleNotificationClick(e, notif));
                notificationList.appendChild(itemDiv);
            });

            document.querySelectorAll('.mark-one-read-btn').forEach(button => {
                button.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const notifId = parseInt(e.target.dataset.id);
                    if (typeof marcarNotificacaoComoLida === 'function') {
                        marcarNotificacaoComoLida(notifId).catch(error => {
                            console.error("Erro ao marcar notificação como lida:", error);
                        });
                    }
                });
            });
        }).catch(error => {
            console.error("Erro ao obter notificações:", error);
            notificationList.innerHTML = '<p class="p-4 text-center text-red-400 text-sm">Erro ao carregar notificações.</p>';
        });
    }

    function handleNotificationClick(event, notification) {
        if (!notification.lida && typeof marcarNotificacaoComoLida === 'function') {
            marcarNotificacaoComoLida(notification.id).catch(error => {
                console.error("Erro ao marcar notificação como lida:", error);
            });
        }

        if (notification.acao) {
            console.log("Ação da notificação:", notification.acao);
            if (notification.acao.tipo === 'link' && notification.acao.valor) {
                if (notification.acao.valor.startsWith('#')) {
                    window.location.hash = notification.acao.valor;
                }
            } else if (notification.acao.tipo === 'modal_critico' && notification.acao.valor) {
                showModalAlert(notification.titulo, notification.acao.valor, 'warning');
            }
        }
        if (notificationDropdown) notificationDropdown.classList.add('hidden');
    }

    function setupNotificationSystem() {
        if (!notificationBellButton || !notificationDropdown || !markAllAsReadButton) return;

        updateNotificationBell();
        renderNotificationDropdown();

        notificationBellButton.addEventListener('click', (e) => {
            e.stopPropagation();
            notificationDropdown.classList.toggle('hidden');
            if (!notificationDropdown.classList.contains('hidden')) {
                renderNotificationDropdown();
            }
        });

        markAllAsReadButton.addEventListener('click', () => {
            const user = getLoggedInUser();
            if (user && typeof marcarTodasComoLidas === 'function') {
                marcarTodasComoLidas(user.perfil).catch(error => {
                    console.error("Erro ao marcar todas notificações como lidas:", error);
                });
            }
        });

        document.addEventListener('click', (e) => {
            if (notificationDropdown && !notificationDropdown.classList.contains('hidden') &&
                !notificationBellButton.contains(e.target) && !notificationDropdown.contains(e.target)) {
                notificationDropdown.classList.add('hidden');
            }
        });

        document.addEventListener('novaNotificacao', () => {
            updateNotificationBell();
            if (notificationDropdown && !notificationDropdown.classList.contains('hidden')) {
                renderNotificationDropdown();
            }
        });
        
        document.addEventListener('notificacaoLida', () => {
            updateNotificationBell();
            if (notificationDropdown && !notificationDropdown.classList.contains('hidden')) {
                renderNotificationDropdown();
            }
        });
        
        document.addEventListener('notificacoesLidas', () => {
            updateNotificationBell();
            if (notificationDropdown && !notificationDropdown.classList.contains('hidden')) {
                renderNotificationDropdown();
            }
        });

        if (notificationUpdateInterval) clearInterval(notificationUpdateInterval);
        notificationUpdateInterval = setInterval(() => {
            if (document.visibilityState === 'visible') {
                updateNotificationBell();
                if (notificationDropdown && !notificationDropdown.classList.contains('hidden')) {
                    renderNotificationDropdown();
                }
            }
        }, 30000);
    }

    // --- LÓGICA DE LOGIN (index.html) ---
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        if (getLoggedInUser()) {
            window.location.href = 'dashboard.html';
        }
        
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = loginForm.email.value;
            const password = loginForm.password.value;
            const errorMessageElement = document.getElementById('loginErrorMessage');

            try {
                if (typeof autenticarUsuario === 'function') {
                    // Corrigido para aguardar a resposta da função assíncrona
                    const user = await autenticarUsuario(email, password);
                    
                    if (user) {
                        sessionStorage.setItem('loggedInUser', JSON.stringify(user));
                        window.location.href = 'dashboard.html';
                    } else {
                        if (errorMessageElement) {
                            errorMessageElement.textContent = 'Email ou senha inválidos.';
                            errorMessageElement.style.display = 'block';
                        }
                    }
                } else {
                    console.error("Função autenticarUsuario não encontrada.");
                    if (errorMessageElement) {
                        errorMessageElement.textContent = 'Erro no sistema. Tente mais tarde.';
                        errorMessageElement.style.display = 'block';
                    }
                }
            } catch (error) {
                console.error("Erro durante autenticação:", error);
                if (errorMessageElement) {
                    errorMessageElement.textContent = 'Erro ao conectar ao servidor. Tente novamente.';
                    errorMessageElement.style.display = 'block';
                }
            }
        });
    }

    // --- LÓGICA DO DASHBOARD (dashboard.html) ---
    if (document.getElementById('dashboardPage') || document.querySelector('body.dashboard-page')) {
        const loggedInUser = getLoggedInUser();
        if (!loggedInUser) {
            window.location.href = 'index.html';
        } else {
            if (usernameDisplay) usernameDisplay.textContent = loggedInUser.nome;
            if (userRoleDisplay) userRoleDisplay.textContent = formatProfileName(loggedInUser.perfil);
            if (userAvatar) {
                if (userAvatar.tagName === 'IMG') {
                    userAvatar.src = `https://placehold.co/40x40/64748B/E2E8F0?text=${loggedInUser.nome.charAt(0).toUpperCase()}`;
                } else {
                    userAvatar.innerHTML = `<span>${loggedInUser.nome.charAt(0).toUpperCase()}</span>`;
                }
            }
            
            if (logoutButton) { 
                logoutButton.addEventListener('click', () => { 
                    sessionStorage.removeItem('loggedInUser'); 
                    window.location.href = 'index.html'; 
                }); 
            }
            
            if (sidebarToggle && sidebar) { 
                sidebarToggle.addEventListener('click', () => sidebar.classList.toggle('-translate-x-full')); 
            }
            
            function adjustSidebarVisibility() { 
                if (!sidebar) return; 
                if (window.innerWidth >= 768) { 
                    sidebar.classList.remove('-translate-x-full'); 
                } else { 
                    sidebar.classList.add('-translate-x-full'); 
                } 
            }
            window.addEventListener('resize', adjustSidebarVisibility);
            adjustSidebarVisibility();

            // Inicializar dados e configurar sistema
            if (typeof inicializarDados === 'function') {
                inicializarDados().then(() => {
                    // Após inicializar dados, configurar navegação e carregar dashboard
                    populateNavigation(loggedInUser.perfil);
                    setupNotificationSystem();

                    let initialSection = 'dashboard';
                    if (window.location.hash && window.location.hash !== '#') {
                        const sectionFromHash = window.location.hash.substring(1);
                        const navItem = (navigationConfig[loggedInUser.perfil] || []).find(item => item.section === sectionFromHash);
                        if (navItem && typeof verificarPermissao === 'function' && verificarPermissao(loggedInUser.perfil, navItem.requiredPermission)) {
                            initialSection = sectionFromHash;
                        }
                    }
                    loadSectionContent(initialSection, loggedInUser);
                }).catch(error => {
                    console.error("Erro ao inicializar dados:", error);
                    showTemporaryAlert("Erro ao carregar dados. Algumas funcionalidades podem não estar disponíveis.", "error");
                    
                    // Mesmo com erro, tentar carregar a interface básica
                    populateNavigation(loggedInUser.perfil);
                    loadSectionContent('dashboard', loggedInUser);
                });
            } else {
                console.warn("Função inicializarDados não encontrada. Carregando interface sem dados.");
                populateNavigation(loggedInUser.perfil);
                setupNotificationSystem();
                loadSectionContent('dashboard', loggedInUser);
            }

            window.addEventListener('hashchange', () => {
                let sectionFromHash = window.location.hash.substring(1) || 'dashboard';
                const navItem = (navigationConfig[loggedInUser.perfil] || []).find(item => item.section === sectionFromHash);
                if (navItem && typeof verificarPermissao === 'function' && verificarPermissao(loggedInUser.perfil, navItem.requiredPermission)) {
                    loadSectionContent(sectionFromHash, loggedInUser);
                } else {
                    loadSectionContent('dashboard', loggedInUser);
                }
            });
        }
    }

    // --- FUNÇÃO CENTRAL DE CARREGAMENTO DE CONTEÚDO ---
    function loadSectionContent(sectionId, user) {
        if (!user) {
            console.error("Usuário não autenticado ao tentar carregar seção:", sectionId);
            window.location.href = 'index.html';
            return;
        }

        // Verificar se o usuário tem permissão para acessar esta seção
        const navItem = (navigationConfig[user.perfil] || []).find(item => item.section === sectionId);
        if (!navItem) {
            console.warn(`Seção ${sectionId} não disponível para o perfil ${user.perfil}`);
            sectionId = 'dashboard'; // Redirecionar para dashboard se seção não disponível
        } else if (typeof verificarPermissao === 'function' && !verificarPermissao(user.perfil, navItem.requiredPermission)) {
            console.warn(`Usuário não tem permissão para acessar a seção ${sectionId}`);
            showTemporaryAlert("Você não tem permissão para acessar esta seção.", "error");
            sectionId = 'dashboard'; // Redirecionar para dashboard se não tem permissão
        }

        // Atualizar URL hash sem disparar evento hashchange
        const currentHash = window.location.hash.substring(1);
        if (currentHash !== sectionId) {
            history.replaceState(null, '', `#${sectionId}`);
        }

        // Atualizar navegação ativa
        document.querySelectorAll('#navLinks a').forEach(link => {
            if (link.dataset.section === sectionId) {
                link.classList.add('active-nav-link', 'bg-slate-700', 'text-sky-400');
            } else {
                link.classList.remove('active-nav-link', 'bg-slate-700', 'text-sky-400');
            }
        });

        // Atualizar título e subtítulo da página
        if (pageTitle) pageTitle.textContent = getPageTitle(sectionId, user);
        if (pageSubtitle) pageSubtitle.textContent = getPageSubtitle(sectionId, user);

        // Mostrar/ocultar áreas de conteúdo apropriadas
        if (mainDashboardContent) mainDashboardContent.style.display = (sectionId === 'dashboard') ? 'block' : 'none';
        if (dynamicContentArea) {
            dynamicContentArea.style.display = (sectionId !== 'dashboard') ? 'block' : 'none';
            if (sectionId !== 'dashboard') dynamicContentArea.innerHTML = '';
        }

        // Limpar gráficos ativos se necessário
        const clearActiveCharts = (chartObject) => { 
            Object.values(chartObject).forEach(chart => { 
                if(chart && typeof chart.destroy === 'function') chart.destroy(); 
            }); 
            return {}; 
        };
        
        if (sectionId !== 'dashboard' && mainDashboardContent && Object.keys(activeCharts).length > 0) activeCharts = clearActiveCharts(activeCharts);
        if (sectionId !== 'sales_history_reports' && sectionId !== 'mgmt_reports' && Object.keys(activeReportCharts).length > 0) activeReportCharts = clearActiveCharts(activeReportCharts);
        if (sectionId !== 'mgmt_reports' && Object.keys(activeMgmtReportCharts).length > 0) activeMgmtReportCharts = clearActiveCharts(activeMgmtReportCharts);
        if (sectionId !== 'ai_features_advanced' && Object.keys(activeAiCharts).length > 0) activeAiCharts = clearActiveCharts(activeAiCharts);

        // Carregar conteúdo da seção
        try {
            switch (sectionId) {
                case 'dashboard':
                    if (typeof displayDynamicDashboard === 'function') displayDynamicDashboard(user);
                    break;
                case 'products':
                    if (typeof renderProductModule === 'function') renderProductModule(user);
                    break;
                case 'sales':
                    if (typeof renderSalesModule === 'function') renderSalesModule(user);
                    break;
                case 'sales_history_reports':
                    if (typeof renderSalesHistoryReportsModule === 'function') renderSalesHistoryReportsModule(user);
                    break;
                case 'mgmt_reports':
                    if (typeof renderManagementReportsModule === 'function') renderManagementReportsModule(user);
                    break;
                case 'ai_features_advanced':
                    if (typeof renderAIFeaturesModule === 'function') renderAIFeaturesModule(user);
                    break;
                case 'settings':
                    if (typeof renderSettingsModule === 'function') renderSettingsModule(user);
                    break;
                default:
                    console.warn(`Seção desconhecida: ${sectionId}`);
                    dynamicContentArea.innerHTML = `<div class="p-8 text-center"><i class="fas fa-exclamation-triangle text-amber-400 text-4xl mb-4"></i><p>Seção não encontrada ou em desenvolvimento.</p></div>`;
            }
        } catch (error) {
            console.error(`Erro ao carregar seção ${sectionId}:`, error);
            showTemporaryAlert(`Erro ao carregar seção: ${error.message}`, 'error');
            dynamicContentArea.innerHTML = `<div class="p-8 text-center"><i class="fas fa-exclamation-circle text-red-500 text-4xl mb-4"></i><p>Ocorreu um erro ao carregar esta seção. Por favor, tente novamente mais tarde.</p></div>`;
        }
    }

    function getPageTitle(sectionId, user) {
        switch (sectionId) {
            case 'dashboard':
                return `Painel ${formatProfileName(user.perfil)}`;
            case 'products':
                return "Gerenciamento de Produtos";
            case 'sales':
                return "Registar Venda";
            case 'sales_history_reports':
                return user.perfil === 'vendas' ? "Minhas Vendas" : "Vendas: Histórico e Relatórios";
            case 'mgmt_reports':
                return "Relatórios Gerenciais";
            case 'ai_features_advanced':
                return user.perfil === 'vendas' ? "Assistente IA" : 
                       user.perfil === 'inventario' ? "Previsão de Demanda" : "Inteligência Artificial";
            case 'settings':
                return "Configurações do Sistema";
            default:
                return "EliteControl";
        }
    }

    function getPageSubtitle(sectionId, user) {
        switch (sectionId) {
            case 'dashboard':
                return "Sua visão personalizada.";
            case 'products':
                return "Controle seu catálogo.";
            case 'sales':
                return "Crie uma nova transação.";
            case 'sales_history_reports':
                return user.perfil === 'vendas' ? "Acompanhe suas vendas." : "Analise suas vendas.";
            case 'mgmt_reports':
                return "Insights para decisões.";
            case 'ai_features_advanced':
                return user.perfil === 'vendas' ? "Seu assistente pessoal." : 
                       user.perfil === 'inventario' ? "Antecipe necessidades de estoque." : "Recursos avançados de IA.";
            case 'settings':
                return "Personalize o sistema.";
            default:
                return "Sistema de Controle de Estoque Inteligente";
        }
    }

    // --- NAVEGAÇÃO LATERAL ---
    function populateNavigation(userProfile) {
        if (!navLinksContainer) return;
        navLinksContainer.innerHTML = '';

        const navLinks = navigationConfig[userProfile] || [];
        navLinks.forEach(linkInfo => {
            if (typeof verificarPermissao === 'function' && verificarPermissao(userProfile, linkInfo.requiredPermission)) {
                const listItem = document.createElement('li');
                const anchor = document.createElement('a');
                anchor.href = '#';
                anchor.classList.add('flex', 'items-center', 'py-2.5', 'px-4', 'rounded-lg', 'transition', 'duration-200', 'hover:bg-slate-700', 'hover:text-sky-400');
                anchor.dataset.section = linkInfo.section;

                const icon = document.createElement('i');
                icon.className = `fas ${linkInfo.icon} w-6 text-center mr-3`;
                const span = document.createElement('span');
                span.className = 'font-medium';
                span.textContent = linkInfo.text;

                anchor.appendChild(icon);
                anchor.appendChild(span);
                listItem.appendChild(anchor);
                navLinksContainer.appendChild(listItem);

                anchor.addEventListener('click', (e) => {
                    e.preventDefault();
                    const loggedUser = getLoggedInUser();
                    if (loggedUser) {
                        loadSectionContent(linkInfo.section, loggedUser);
                        if (window.innerWidth < 768 && sidebar) {
                            sidebar.classList.add('-translate-x-full');
                        }
                    }
                });
            }
        });
    }

    // --- DASHBOARD DINÂMICO: KPIs, Gráficos, Atividades ---
    function displayDynamicDashboard(user) {
        if (!mainDashboardContent || !kpiContainer || !chartsContainer || !recentActivitiesContainer) {
            console.error("Elementos do DOM para o dashboard dinâmico não encontrados.");
            return;
        }
        clearDashboardMainCharts();
        renderKPIs(user);
        renderDashboardMainCharts(user);
        renderRecentActivities(user);
    }

    function clearDashboardMainCharts() {
        if (kpiContainer) kpiContainer.innerHTML = '';
        if (chartsContainer) chartsContainer.innerHTML = '';
        if (recentActivitiesContainer) recentActivitiesContainer.innerHTML = '';
        
        Object.values(activeCharts).forEach(chart => {
            if (chart && typeof chart.destroy === 'function') chart.destroy();
        });
        activeCharts = {};
    }

    function createKPIElement(title, value, iconClass, colorClass = 'text-sky-400') {
        return `
            <div class="bg-slate-800 p-6 rounded-xl shadow-lg hover:shadow-slate-700/50 transition-shadow duration-300">
                <div class="flex items-center justify-between mb-3">
                    <h4 class="text-lg font-semibold ${colorClass}">${title}</h4>
                    <i class="fas ${iconClass} fa-2x text-slate-500"></i>
                </div>
                <p class="text-3xl font-bold text-slate-100">${value}</p>
            </div>
        `;
    }

    function renderKPIs(user) {
        if (!kpiContainer) return;
        kpiContainer.innerHTML = '';
        let kpiHTML = '';
        
        try {
            // Corrigido para lidar com funções assíncronas
            Promise.all([
                typeof obterProdutos === 'function' ? obterProdutos() : [],
                typeof obterVendas === 'function' ? obterVendas() : []
            ]).then(([produtos, vendas]) => {
                const today = new Date().toISOString().slice(0, 10);

                if (user.perfil === 'gerente') {
                    const valorTotalInventario = produtos.reduce((sum, p) => sum + (p.precoCusto * p.quantidade), 0);
                    const vendasHojeValor = vendas.filter(v => v.data.startsWith(today) && v.status === 'finalizada').reduce((sum, v) => sum + v.total, 0);
                    const itensEstoqueBaixo = produtos.filter(p => p.quantidade <= p.estoqueMinimo).length;
                    kpiHTML += createKPIElement("Valor Total do Inventário", formatCurrency(valorTotalInventario), "fa-dollar-sign", "text-green-400");
                    kpiHTML += createKPIElement("Vendas do Dia", formatCurrency(vendasHojeValor), "fa-cash-register", "text-sky-400");
                    kpiHTML += createKPIElement("Itens Estoque Baixo", itensEstoqueBaixo, "fa-exclamation-triangle", "text-amber-400");
                    kpiHTML += createKPIElement("Alertas de Anomalias", "0", "fa-shield-virus", "text-red-400");
                } else if (user.perfil === 'inventario') {
                    const totalSKUs = produtos.length;
                    const itensEstoqueBaixo = produtos.filter(p => p.quantidade <= p.estoqueMinimo).length;
                    const ultimaAtualizacaoProduto = produtos.length > 0 ? Math.max(...produtos.map(p => new Date(p.ultimaAtualizacao || p.dataCriacao || 0).getTime())) : null;
                    kpiHTML += createKPIElement("Total de SKUs", totalSKUs, "fa-boxes-stacked", "text-sky-400");
                    kpiHTML += createKPIElement("Itens Estoque Baixo", itensEstoqueBaixo, "fa-exclamation-triangle", "text-amber-400");
                    kpiHTML += createKPIElement("Última Atualização (Prod.)", ultimaAtualizacaoProduto ? formatDate(new Date(ultimaAtualizacaoProduto).toISOString()) : 'N/A', "fa-history", "text-purple-400");
                    kpiHTML += createKPIElement("Produtos Cadastrados", totalSKUs, "fa-clipboard-list", "text-green-400");
                } else if (user.perfil === 'vendas') {
                    const vendasHoje = vendas.filter(v => v.data.startsWith(today) && v.status === 'finalizada' && v.vendedorId === user.id);
                    const vendasHojeValor = vendasHoje.reduce((sum, v) => sum + v.total, 0);
                    const numVendasHoje = vendasHoje.length;
                    const produtosDisponiveis = produtos.filter(p => p.quantidade > 0).length;
                    
                    kpiHTML += createKPIElement("Minhas Vendas (Hoje)", formatCurrency(vendasHojeValor), "fa-hand-holding-usd", "text-green-400");
                    kpiHTML += createKPIElement("Nº de Vendas (Hoje)", numVendasHoje, "fa-file-invoice-dollar", "text-sky-400");
                    kpiHTML += createKPIElement("Produtos Disponíveis", produtosDisponiveis, "fa-boxes", "text-purple-400");
                    kpiHTML += `
                        <div class="bg-sky-600 hover:bg-sky-700 p-6 rounded-xl shadow-lg text-white flex flex-col items-center justify-center cursor-pointer transition-all" onclick="window.location.hash='sales'">
                            <i class="fas fa-plus-circle fa-3x mb-2"></i>
                            <h4 class="text-lg font-semibold">Nova Venda</h4>
                        </div>`;
                }
                
                kpiContainer.innerHTML = kpiHTML;
            }).catch(error => {
                console.error("Erro ao renderizar KPIs:", error);
                kpiContainer.innerHTML = `
                    <div class="col-span-full bg-slate-800 p-6 rounded-xl shadow-lg">
                        <div class="flex items-center text-red-400 mb-3">
                            <i class="fas fa-exclamation-circle fa-2x mr-3"></i>
                            <h4 class="text-lg font-semibold">Erro ao carregar indicadores</h4>
                        </div>
                        <p class="text-slate-400">Não foi possível carregar os indicadores. Tente recarregar a página.</p>
                    </div>
                `;
            });
        } catch (error) {
            console.error("Erro ao renderizar KPIs:", error);
            kpiContainer.innerHTML = `
                <div class="col-span-full bg-slate-800 p-6 rounded-xl shadow-lg">
                    <div class="flex items-center text-red-400 mb-3">
                        <i class="fas fa-exclamation-circle fa-2x mr-3"></i>
                        <h4 class="text-lg font-semibold">Erro ao carregar indicadores</h4>
                    </div>
                    <p class="text-slate-400">Não foi possível carregar os indicadores. Tente recarregar a página.</p>
                </div>
            `;
        }
    }

    // Restante do código permanece o mesmo...
    // Módulos de Produtos, Vendas, Relatórios, etc.
});
