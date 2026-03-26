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
    <aside class="rh-sidebar" aria-label="Portal RH navigation">
        <div class="rh-sidebar-brand">
            <a href="/protected/index.html" class="brand-link">
                <span>👥</span> <span data-translate="rh_nav_brand">Portal RH</span>
            </a>
        </div>
        <nav class="rh-sidebar-menu">
            <a href="/protected/dashboard-rh.html" class="rh-side-link ${activePage === 'ferias' ? 'active' : ''}"><span data-translate="rh_nav_ferias">Férias</span></a>
            <a href="/protected/dashboard-taxas.html" class="rh-side-link ${activePage === 'taxas' ? 'active' : ''}"><span data-translate="rh_nav_pgto_taxas">Pgto Taxas</span></a>
            <a href="/protected/dashboard-solicitacoes-taxa.html" class="rh-side-link ${activePage === 'req_taxas' ? 'active' : ''}"><span data-translate="rh_nav_req_taxas">Req. Taxas</span></a>
            <a href="/protected/dashboard-candidatos.html" class="rh-side-link ${activePage === 'candidatos' ? 'active' : ''}"><span data-translate="rh_nav_candidatos">Candidatos</span></a>
            <a href="/protected/dashboard-recrutamento.html" class="rh-side-link ${activePage === 'recrutamento' ? 'active' : ''}"><span data-translate="rh_nav_recrutamento">Recrutamento Interno</span></a>
            <a href="/protected/dashboard-onthejob.html" class="rh-side-link ${activePage === 'onthejob' ? 'active' : ''}"><span data-translate="rh_nav_onthejob">On The Job</span></a>
            <a href="/protected/dashboard-vagas.html" class="rh-side-link ${activePage === 'vagas' ? 'active' : ''}"><span data-translate="rh_nav_vagas">Vagas</span></a>
            <a href="/protected/dashboard-epis.html" class="rh-side-link ${activePage === 'epis' ? 'active' : ''}"><span data-translate="rh_nav_epis">EPIs</span></a>
            <a href="/protected/dashboard-desligamento.html" class="rh-side-link ${activePage === 'desligamento' ? 'active' : ''}"><span data-translate="rh_nav_desligamento">Desligamento</span></a>
            <a href="/protected/dashboard-avaliacao.html" class="rh-side-link ${activePage === 'avaliacoes' ? 'active' : ''}"><span data-translate="rh_nav_avaliacoes">Avaliações</span></a>
            <a href="/protected/dashboard-experiencia.html" class="rh-side-link ${activePage === 'experiencia' ? 'active' : ''}"><span data-translate="rh_nav_experiencia">Experiência</span></a>
            <a href="/protected/dashboard-formularios.html" class="rh-side-link ${activePage === 'formularios' ? 'active' : ''}" data-role="admin"><span data-translate="rh_nav_formularios">Formulários</span></a>
        </nav>
        <div class="rh-sidebar-footer">
            <button class="logout-btn" onclick="logout()">🚪 <span data-translate="rh_nav_sair">Sair</span></button>
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
    document.querySelectorAll('.rh-sidebar-menu a').forEach(a => {
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
        const res = await fetch('/api/access', { headers: { 'Accept': 'application/json' } });
        if (!res.ok) return;
        const data = await res.json();
        const allowAll = !!(data && data.access && data.access.allowAll);
        if (allowAll) {
            const adminLinks = document.querySelectorAll('[data-role="admin"]');
            adminLinks.forEach(link => link.style.display = '');
            return;
        }
        // Fallback: hide admin-only links for non-admins
        const meRes = await fetch('/api/me');
        if (meRes.ok) {
            const me = await meRes.json();
            if (me.user.role !== 'admin') {
                const adminLinks = document.querySelectorAll('[data-role="admin"]');
                adminLinks.forEach(link => link.style.display = 'none');
            }
        }
    } catch (e) {
        console.error('Erro ao verificar permissões da navbar', e);
    }
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
