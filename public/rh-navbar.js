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
            <a href="/protected/dashboard-rh.html" data-protected-path="/protected/dashboard-rh.html" class="rh-side-link ${activePage === 'ferias' ? 'active' : ''}"><span data-translate="rh_nav_ferias">Férias</span></a>
            <a href="/protected/dashboard-taxas.html" data-protected-path="/protected/dashboard-taxas.html" class="rh-side-link ${activePage === 'taxas' ? 'active' : ''}"><span data-translate="rh_nav_pgto_taxas">Pgto Taxas</span></a>
            <a href="/protected/dashboard-solicitacoes-taxa.html" data-protected-path="/protected/dashboard-solicitacoes-taxa.html" class="rh-side-link ${activePage === 'req_taxas' ? 'active' : ''}"><span data-translate="rh_nav_req_taxas">Req. Taxas</span></a>
            <a href="/protected/dashboard-candidatos.html" data-protected-path="/protected/dashboard-candidatos.html" class="rh-side-link ${activePage === 'candidatos' ? 'active' : ''}"><span data-translate="rh_nav_candidatos">Candidatos</span></a>
            <a href="/protected/dashboard-recrutamento.html" data-protected-path="/protected/dashboard-recrutamento.html" class="rh-side-link ${activePage === 'recrutamento' ? 'active' : ''}"><span data-translate="rh_nav_recrutamento">Recrutamento Interno</span></a>
            <a href="/protected/dashboard-onthejob.html" data-protected-path="/protected/dashboard-onthejob.html" class="rh-side-link ${activePage === 'onthejob' ? 'active' : ''}"><span data-translate="rh_nav_onthejob">On The Job</span></a>
            <a href="/protected/dashboard-vagas.html" data-protected-path="/protected/dashboard-vagas.html" class="rh-side-link ${activePage === 'vagas' ? 'active' : ''}"><span data-translate="rh_nav_vagas">Vagas</span></a>
            <a href="/protected/dashboard-epis.html" data-protected-path="/protected/dashboard-epis.html" class="rh-side-link ${activePage === 'epis' ? 'active' : ''}"><span data-translate="rh_nav_epis">EPIs</span></a>
            <a href="/protected/dashboard-desligamento.html" data-protected-path="/protected/dashboard-desligamento.html" class="rh-side-link ${activePage === 'desligamento' ? 'active' : ''}"><span data-translate="rh_nav_desligamento">Desligamento</span></a>
            <a href="/protected/dashboard-avaliacao.html" data-protected-path="/protected/dashboard-avaliacao.html" class="rh-side-link ${activePage === 'avaliacoes' ? 'active' : ''}"><span data-translate="rh_nav_avaliacoes">Avaliações</span></a>
            <a href="/protected/dashboard-experiencia.html" data-protected-path="/protected/dashboard-experiencia.html" class="rh-side-link ${activePage === 'experiencia' ? 'active' : ''}"><span data-translate="rh_nav_experiencia">Experiência</span></a>
            <a href="/protected/dashboard-beneficios.html" class="rh-side-link ${activePage === 'beneficios' ? 'active' : ''}" data-protected-path="/protected/dashboard-beneficios.html"><span>Benefícios</span></a>
            <a href="/protected/dashboard-disciplinar.html" class="rh-side-link ${activePage === 'disciplinar' ? 'active' : ''}" data-protected-path="/protected/dashboard-disciplinar.html"><span>Advertências</span></a>
            <a href="/protected/dashboard-formularios.html" class="rh-side-link ${activePage === 'formularios' ? 'active' : ''}" data-protected-path="/protected/dashboard-formularios.html"><span data-translate="rh_nav_formularios">Formulários</span></a>
        </nav>
        <div class="rh-sidebar-footer">
            <a class="back-to-forms" href="/" style="display:inline-flex; align-items:center; gap:8px; padding:8px 10px; border:1px solid var(--border); border-radius:6px; color:var(--text); text-decoration:none; background:var(--bg-surface);">
                ⬅ <span>Formulários</span>
            </a>
            <button class="logout-btn" onclick="changePassword()" style="margin-top: 8px;">🔑 <span>Alterar senha</span></button>
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
        const res = await fetch('/api/access', { headers: { 'Accept': 'application/json' }, cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        const allowAll = !!(data && data.access && data.access.allowAll);
        const role = data && data.user && data.user.role;
        const allowed = new Set((data && data.access && data.access.protectedPaths) ? data.access.protectedPaths : []);

        document.querySelectorAll('[data-protected-path]').forEach(link => {
            const p = link.getAttribute('data-protected-path');
            if (!p) return;
            const canSeeDisciplinar = p === '/protected/dashboard-disciplinar.html' && ['admin', 'rh', 'rh_geral', 'dp'].includes(role);
            const canSeeBeneficios = p === '/protected/dashboard-beneficios.html' && ['admin', 'rh', 'rh_geral', 'dp'].includes(role);
            const canSee = allowAll || role === 'admin' || allowed.has(p) || canSeeDisciplinar || canSeeBeneficios;
            link.style.display = canSee ? '' : 'none';
        });
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
