/**
 * Renderiza o menu do RH como sidebar responsiva.
 * @param {string} activePage - Página ativa para destacar no menu.
 */
function renderRHNavbar(activePage) {
    const sidebarHtml = `
    <div class="rh-mobile-header" role="banner">
        <button class="rh-sidebar-toggle" aria-label="Abrir menu" aria-expanded="false">☰</button>
        <div class="rh-mobile-title"><span data-translate="rh_nav_brand">Portal RH</span></div>
    </div>
    <aside class="rh-portal-sidebar" aria-label="Portal RH navigation">
        <a href="/formularios" class="backlink">&larr; <span data-translate="rh_nav_back_forms">Voltar ao Portal de Formulários</span></a>

        <div class="rh-portal-brand">
            <a href="/protected/index.html" class="rh-portal-brand-link">
                <img class="rh-portal-logo" src="/assets/logo.png" alt="Logo Família Madalosso">
                <div class="rh-portal-brand-text">
                    <div class="rh-portal-brand-title" data-translate="rh_portal_title">Portal do RH</div>
                    <div class="rh-portal-brand-subtitle" data-translate="rh_portal_subtitle">Selecione o módulo que deseja acessar</div>
                </div>
                <div class="rh-portal-user-avatar" id="rhUserAvatar" aria-hidden="true" hidden>—</div>
            </a>
        </div>

        <nav class="rh-portal-nav" aria-label="Módulos">
            <a href="/protected/dashboard-disciplinar.html" data-protected-path="/protected/dashboard-disciplinar.html" class="rh-portal-link ${activePage === 'disciplinar' ? 'active' : ''}">
                <span class="rh-portal-link-icon" aria-hidden="true">⚠️</span>
                <span class="rh-portal-link-text" data-translate="rh_nav_disciplinar">Advertências e Suspensões</span>
            </a>

            <a href="/protected/dashboard-avaliacao.html" data-protected-path="/protected/dashboard-avaliacao.html" class="rh-portal-link ${activePage === 'avaliacoes' ? 'active' : ''}">
                <span class="rh-portal-link-icon" aria-hidden="true">📊</span>
                <span class="rh-portal-link-text" data-translate="rh_card_avaliacoes_title">Avaliações de Desempenho</span>
            </a>
            
            <a href="/protected/dashboard-experiencia.html" data-protected-path="/protected/dashboard-experiencia.html" class="rh-portal-link ${activePage === 'experiencia' ? 'active' : ''}">
                <span class="rh-portal-link-icon" aria-hidden="true">⏳</span>
                <span class="rh-portal-link-text" data-translate="rh_card_experiencia_title">Avaliações de Experiências</span>
            </a>

            
            <a href="/protected/dashboard-candidatos.html" data-protected-path="/protected/dashboard-candidatos.html" class="rh-portal-link ${activePage === 'candidatos' ? 'active' : ''}">
                <span class="rh-portal-link-icon" aria-hidden="true">👥</span>
                <span class="rh-portal-link-text" data-translate="rh_card_candidatos_title">Banco de Talentos</span>
            </a>

            <a href="/protected/dashboard-beneficios.html" data-protected-path="/protected/dashboard-beneficios.html" class="rh-portal-link ${activePage === 'beneficios' ? 'active' : ''}">
                <span class="rh-portal-link-icon" aria-hidden="true">💳</span>
                <span class="rh-portal-link-text" data-translate="rh_nav_beneficios">Benefícios</span>
            </a>

            <a href="/protected/dashboard-funcionarios.html" data-protected-path="/protected/dashboard-funcionarios.html" class="rh-portal-link ${activePage === 'funcionarios' ? 'active' : ''}">
                <span class="rh-portal-link-icon" aria-hidden="true">👷</span>
                <span class="rh-portal-link-text" data-translate="rh_card_funcionarios_title">Colaboradores</span>
            </a>

            <a href="/protected/dashboard-desligamento.html" data-protected-path="/protected/dashboard-desligamento.html" class="rh-portal-link ${activePage === 'desligamento' ? 'active' : ''}">
                <span class="rh-portal-link-icon" aria-hidden="true">🚪</span>
                <span class="rh-portal-link-text" data-translate="rh_card_desligamento_title">Desligamento</span>
            </a>


            <!--<a href="/protected/dashboard-epis.html" data-protected-path="/protected/dashboard-epis.html" class="rh-portal-link ${activePage === 'epis' ? 'active' : ''}">
                <span class="rh-portal-link-icon" aria-hidden="true">🦺</span>
                <span class="rh-portal-link-text" data-translate="rh_card_epis_title">Gestão de EPIs</span>
            </a>-->

            <a href="/protected/dashboard-rh.html" data-protected-path="/protected/dashboard-rh.html" class="rh-portal-link ${activePage === 'ferias' ? 'active' : ''}">
                <span class="rh-portal-link-icon" aria-hidden="true">🏖️</span>
                <span class="rh-portal-link-text" data-translate="rh_card_ferias_title">Gestão de Férias</span>
            </a>

            <a href="/protected/dashboard-vagas.html" data-protected-path="/protected/dashboard-vagas.html" class="rh-portal-link ${activePage === 'vagas' ? 'active' : ''}">
                <span class="rh-portal-link-icon" aria-hidden="true">📢</span>
                <span class="rh-portal-link-text" data-translate="rh_card_vagas_title">Gestão de Vagas</span>
            </a>

           <!--<a href="/protected/dashboard-onthejob.html" data-protected-path="/protected/dashboard-onthejob.html" class="rh-portal-link ${activePage === 'onthejob' ? 'active' : ''}">
                <span class="rh-portal-link-icon" aria-hidden="true">🚀</span>
                <span class="rh-portal-link-text" data-translate="rh_card_onthejob_title">On The Job</span>
            </a>-->

            <a href="/protected/dashboard-taxas.html" data-protected-path="/protected/dashboard-taxas.html" class="rh-portal-link ${activePage === 'taxas' ? 'active' : ''}">
                <span class="rh-portal-link-icon" aria-hidden="true">💰</span>
                <span class="rh-portal-link-text" data-translate="rh_card_taxas_title">Pagamento de Taxas</span>
            </a>

            <a href="/protected/dashboard-gestor.html" data-protected-path="/protected/dashboard-gestor.html" class="rh-portal-link ${activePage === 'gestor' ? 'active' : ''}">
                <span class="rh-portal-link-icon" aria-hidden="true">📌</span>
                <span class="rh-portal-link-text">Painel do Gestor</span>
            </a>

            <!-- <a href="/protected/dashboard-portaria.html" data-protected-path="/protected/dashboard-portaria.html" class="rh-portal-link ${activePage === 'portaria' ? 'active' : ''}">
                <span class="rh-portal-link-icon" aria-hidden="true">🏢</span>
                <span class="rh-portal-link-text" data-translate="rh_card_portaria_title">Portaria</span>
            </a>-->

            <a href="/protected/dashboard-recrutamento.html" data-protected-path="/protected/dashboard-recrutamento.html" class="rh-portal-link ${activePage === 'recrutamento' ? 'active' : ''}">
                <span class="rh-portal-link-icon" aria-hidden="true">📋</span>
                <span class="rh-portal-link-text" data-translate="rh_card_recrutamento_title">Recrutamento Interno</span>
            </a>

            <a href="/protected/dashboard-solicitacoes-taxa.html" data-protected-path="/protected/dashboard-solicitacoes-taxa.html" class="rh-portal-link ${activePage === 'req_taxas' ? 'active' : ''}">
                <span class="rh-portal-link-icon" aria-hidden="true">🧾</span>
                <span class="rh-portal-link-text" data-translate="rh_nav_req_taxas">Req. Taxas</span>
            </a>

            <a href="/protected/dashboard-formularios.html" data-protected-path="/protected/dashboard-formularios.html" class="rh-portal-link ${activePage === 'formularios' ? 'active' : ''}">
                <span class="rh-portal-link-icon" aria-hidden="true">📝</span>
                <span class="rh-portal-link-text" data-translate="rh_card_formularios_title">Gestão de Formulários</span>
            </a>

            <a href="/protected/gerenciar-usuarios.html" data-protected-path="/protected/gerenciar-usuarios.html" class="rh-portal-link ${activePage === 'usuarios' ? 'active' : ''}">
                <span class="rh-portal-link-icon" aria-hidden="true">🔐</span>
                <span class="rh-portal-link-text" data-translate="rh_card_usuarios_title">Gestão de Usuários</span>
            </a>
        </nav>

        <div class="rh-portal-actions">
            <button class="rh-portal-action" type="button" onclick="changePassword()">🔑 <span data-translate="rh_nav_change_password">Alterar senha</span></button>
            <button class="rh-portal-action" type="button" onclick="logout()">🚪 <span data-translate="rh_nav_sair">Sair</span></button>
        </div>
    </aside>
    <div class="rh-sidebar-backdrop" hidden></div>
    `;

    const container = document.getElementById('navbar-container');
    if (container) {
        container.innerHTML = sidebarHtml;
    } else {
        document.body.insertAdjacentHTML('afterbegin', sidebarHtml);
    }

    // Marca o body para aplicar layout com sidebar
    document.body.classList.add('with-rh-sidebar');

    // Toggle mobile
    const toggle = document.querySelector('.rh-sidebar-toggle');
    const backdrop = document.querySelector('.rh-sidebar-backdrop');
    const setOpen = (open) => {
        if (open) {
            document.body.classList.add('sidebar-open');
            if (toggle) toggle.setAttribute('aria-expanded', 'true');
            if (backdrop) backdrop.hidden = false;
        } else {
            document.body.classList.remove('sidebar-open');
            if (toggle) toggle.setAttribute('aria-expanded', 'false');
            if (backdrop) backdrop.hidden = true;
        }
    };
    if (toggle) {
        toggle.addEventListener('click', () => {
            const open = !document.body.classList.contains('sidebar-open');
            setOpen(open);
        });
    }
    if (backdrop) {
        backdrop.addEventListener('click', () => setOpen(false));
    }
    document.querySelectorAll('.rh-portal-nav a').forEach(a => {
        a.addEventListener('click', () => {
            if (window.matchMedia && window.matchMedia('(max-width: 768px)').matches) setOpen(false);
        });
    });
    window.addEventListener('resize', () => {
        if (window.matchMedia && !window.matchMedia('(max-width: 768px)').matches) setOpen(false);
    });

    // Permissões
    checkNavbarPermissions();
}

async function checkNavbarPermissions() {
    try {
        const res = await fetch('/api/access', { headers: { 'Accept': 'application/json' }, cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        const allowAll = !!(data && data.access && data.access.allowAll);
        const role = data && data.user && data.user.role;
        const user = data && data.user ? data.user : null;
        const allowed = new Set((data && data.access && data.access.protectedPaths) ? data.access.protectedPaths : []);

        const roleNorm = String(role || '').trim().toLowerCase();
        const isGestor = ['gestor', 'supervisor', 'gerente', 'lider'].includes(roleNorm);
        if (isGestor) {
            const backLink = document.querySelector('.rh-portal-sidebar > a.backlink');
            if (backLink) backLink.style.display = 'none';

            const mobileTitle = document.querySelector('.rh-mobile-title span');
            if (mobileTitle) mobileTitle.textContent = 'Painel do Gestor';

            const brandLink = document.querySelector('.rh-portal-brand-link');
            if (brandLink) brandLink.setAttribute('href', '/protected/dashboard-gestor.html');

            const brandTitle = document.querySelector('.rh-portal-brand-title');
            if (brandTitle) brandTitle.textContent = 'Painel do Gestor';

            renderNavbarUserAvatar(user);
        }

        document.querySelectorAll('[data-protected-path]').forEach(link => {
            const p = link.getAttribute('data-protected-path');
            if (!p) return;
            const canSeeDisciplinar = p === '/protected/dashboard-disciplinar.html' && ['admin', 'rh', 'rh_geral', 'dp'].includes(role);
            const canSeeBeneficios = p === '/protected/dashboard-beneficios.html' && ['admin', 'rh', 'rh_geral', 'dp'].includes(role);
            const canSee = allowAll || role === 'admin' || allowed.has(p) || canSeeDisciplinar || canSeeBeneficios;
            link.style.display = canSee ? '' : 'none';
        });

        if (isGestor) {
            const gestorLink = document.querySelector('[data-protected-path="/protected/dashboard-gestor.html"]');
            if (gestorLink) gestorLink.style.display = 'none';
        }

        if (String(role || '').trim().toLowerCase() === 'dp') {
            maybeShowDpPopupAlerts();
        }
    } catch (e) {
        console.error('Erro ao verificar permissões da navbar', e);
    }
}

function initials(v) {
    const s = String(v || '').trim();
    if (!s) return '';
    const parts = s.split(/\s+/g).filter(Boolean);
    const a = (parts[0] || '').slice(0, 1);
    const b = (parts.length > 1 ? parts[parts.length - 1] : '').slice(0, 1);
    return (a + b).toUpperCase();
}

function renderNavbarUserAvatar(user) {
    const el = document.getElementById('rhUserAvatar');
    if (!el) return;
    const name = user && (user.name || user.username) ? String(user.name || user.username) : '';
    const init = initials(name) || '—';
    el.hidden = false;
    el.textContent = init;

    const img = new Image();
    img.alt = '';
    img.onload = () => {
        el.textContent = '';
        el.appendChild(img);
    };
    img.onerror = () => {
        el.textContent = init;
    };
    img.src = `/api/me/foto?ts=${Date.now()}`;
}

let __dpAlertsPopupPromise = null;
let __swalLoader = null;

function ensureSwal() {
    try {
        if (window.Swal && typeof window.Swal.fire === 'function') return Promise.resolve(true);
    } catch (_) {}
    if (__swalLoader) return __swalLoader;
    __swalLoader = new Promise((resolve) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/sweetalert2@11';
        s.async = true;
        s.onload = () => resolve(true);
        s.onerror = () => resolve(false);
        document.head.appendChild(s);
    });
    return __swalLoader;
}

function todayKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function getLang() {
    try {
        const v = String(localStorage.getItem('app_lang') || '').trim().toLowerCase();
        if (v === 'pt' || v === 'es' || v === 'en') return v;
    } catch (_) {}
    return 'pt';
}

function i18n(key, fallback) {
    const lang = getLang();
    const dict = window.__APP_I18N__ && window.__APP_I18N__[lang];
    const val = dict && dict[key];
    return (typeof val === 'string' && val.length) ? val : fallback;
}

function fmt(tpl, vars) {
    let out = String(tpl || '');
    const v = vars && typeof vars === 'object' ? vars : {};
    Object.keys(v).forEach(k => {
        out = out.replaceAll(`{${k}}`, String(v[k]));
    });
    return out;
}

async function maybeShowDpPopupAlerts() {
    if (__dpAlertsPopupPromise) return __dpAlertsPopupPromise;
    __dpAlertsPopupPromise = (async () => {
        const storageKey = 'dp_popup_alertas_v1';
        const key = todayKey();
        try {
            const last = localStorage.getItem(storageKey);
            if (last === key) return;
        } catch (_) {}

        let data;
        try {
            const res = await fetch('/api/rh/alertas', { headers: { 'Accept': 'application/json' }, cache: 'no-store' });
            data = await res.json().catch(() => ({}));
            if (!res.ok || !data.ok) return;
        } catch (_) {
            return;
        }

        const expTotal = Number(data.experiencia && data.experiencia.total || 0);
        const feriasTotal = Number(data.ferias_aquisitivo && data.ferias_aquisitivo.total || 0);
        const total = expTotal + feriasTotal;
        if (!total) return;

        try { localStorage.setItem(storageKey, key); } catch (_) {}

        const exp = data.experiencia || {};
        const expNear = Number(exp.near44 || 0) + Number(exp.near89 || 0);
        const expOver = Number(exp.overdue44 || 0) + Number(exp.overdue89 || 0);

        const feriasItems = Array.isArray(data.ferias_aquisitivo && data.ferias_aquisitivo.items) ? data.ferias_aquisitivo.items : [];
        const feriasOver = feriasItems.filter(x => Number(x && x.dias) < 0).length;
        const feriasNear = feriasItems.filter(x => Number(x && x.dias) >= 0).length;

        const intro = fmt(i18n('dp_popup_intro', 'Você tem {total} item(ns) em atenção.'), { total });
        const expLine = fmt(i18n('dp_popup_line', '{total} item(ns) • {overdue} vencido(s) • {near} próximo(s)'), { total: expTotal, overdue: expOver, near: expNear });
        const feriasLine = fmt(i18n('dp_popup_line_people', '{total} colaborador(es) • {overdue} vencido(s) • {near} próximo(s)'), { total: feriasTotal, overdue: feriasOver, near: feriasNear });

        const html = `
            <div style="text-align:left; display:flex; flex-direction:column; gap:12px;">
                <div style="font-size:0.95rem; color: var(--text-secondary);">${intro}</div>
                <div style="display:grid; grid-template-columns: 1fr; gap:10px;">
                    <div style="border:1px solid var(--border); border-radius:12px; padding:12px; background: var(--bg-body);">
                        <div style="font-weight:900; margin-bottom:4px;">${i18n('dp_popup_exp_title', '⏳ Experiência (45/90)')}</div>
                        <div style="color: var(--text-secondary); font-size:0.92rem;">${expLine}</div>
                        <div style="margin-top:10px;">
                            <button id="dp-go-exp" class="btn btn-outline" type="button" style="width:100%; justify-content:center;">${i18n('dp_popup_exp_btn', 'Abrir painel de experiência')}</button>
                        </div>
                    </div>
                    <div style="border:1px solid var(--border); border-radius:12px; padding:12px; background: var(--bg-body);">
                        <div style="font-weight:900; margin-bottom:4px;">${i18n('dp_popup_ferias_title', '🏖️ Férias (fim aquisitivo)')}</div>
                        <div style="color: var(--text-secondary); font-size:0.92rem;">${feriasLine}</div>
                        <div style="margin-top:10px;">
                            <button id="dp-go-ferias" class="btn btn-outline" type="button" style="width:100%; justify-content:center;">${i18n('dp_popup_ferias_btn', 'Abrir painel de férias')}</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const hasSwal = await ensureSwal();
        if (hasSwal && window.Swal && typeof window.Swal.fire === 'function') {
            await window.Swal.fire({
                title: i18n('dp_popup_title', 'Alertas DP'),
                html,
                icon: 'warning',
                showConfirmButton: false,
                showCloseButton: true,
                didOpen: () => {
                    const expBtn = document.getElementById('dp-go-exp');
                    if (expBtn) expBtn.addEventListener('click', () => { window.location.href = '/protected/dashboard-experiencia.html'; });
                    const ferBtn = document.getElementById('dp-go-ferias');
                    if (ferBtn) ferBtn.addEventListener('click', () => { window.location.href = '/protected/dashboard-rh.html'; });
                }
            });
            return;
        }

        const msg = fmt(i18n('dp_popup_fallback', 'Alertas DP:\n- Experiência (45/90): {exp}\n- Férias (fim aquisitivo): {ferias}'), { exp: expTotal, ferias: feriasTotal });
        alert(msg);
    })();
    return __dpAlertsPopupPromise;
}

async function logout() {
    try {
        await fetch('/api/logout', { method: 'POST' });
        window.location.href = '/login.html';
    } catch (e) {
        console.error('Erro ao sair', e);
        window.location.href = '/login.html';
    }
}

async function changePassword() {
    const currentPassword = prompt('Senha atual:');
    if (currentPassword === null) return;
    const newPassword = prompt('Nova senha (mín. 6 caracteres):');
    if (newPassword === null) return;
    const confirmPassword = prompt('Confirmar nova senha:');
    if (confirmPassword === null) return;
    if (newPassword !== confirmPassword) {
        alert('As senhas não conferem.');
        return;
    }
    if (String(newPassword).length < 6) {
        alert('A nova senha deve ter ao menos 6 caracteres.');
        return;
    }
    try {
        const res = await fetch('/api/me/password', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentPassword, newPassword })
        });
        if (res.ok) {
            alert('Senha alterada com sucesso.');
            return;
        }
        let msg = 'Erro ao alterar senha.';
        try {
            const data = await res.json();
            if (data && data.erro) msg = data.erro;
        } catch (_) {}
        alert(msg);
    } catch (e) {
        console.error('Erro ao alterar senha', e);
        alert('Erro ao alterar senha.');
    }
}
