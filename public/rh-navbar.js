/**
 * Renderiza a Navbar do RH dinamicamente.
 * @param {string} activePage - O nome da página ativa para destacar no menu (ex: 'ferias', 'taxas').
 */
function renderRHNavbar(activePage) {
    const navbarHtml = `
    <nav class="rh-navbar">
        <a href="/protected/index.html" class="rh-navbar-brand">
            <span>👥</span> Portal RH
        </a>
        <div class="rh-navbar-menu">
            <a href="/protected/dashboard-rh.html" class="rh-nav-link ${activePage === 'ferias' ? 'active' : ''}">Férias</a>
            <a href="/protected/dashboard-taxas.html" class="rh-nav-link ${activePage === 'taxas' ? 'active' : ''}">Pgto Taxas</a>
            <a href="/protected/dashboard-solicitacoes-taxa.html" class="rh-nav-link ${activePage === 'req_taxas' ? 'active' : ''}">Req. Taxas</a>
            <a href="/protected/dashboard-candidatos.html" class="rh-nav-link ${activePage === 'candidatos' ? 'active' : ''}">Candidatos</a>
            <a href="/protected/dashboard-recrutamento.html" class="rh-nav-link ${activePage === 'recrutamento' ? 'active' : ''}">Recrutamento Interno</a>
            <a href="/protected/dashboard-onthejob.html" class="rh-nav-link ${activePage === 'onthejob' ? 'active' : ''}">On The Job</a>
            <a href="/protected/dashboard-vagas.html" class="rh-nav-link ${activePage === 'vagas' ? 'active' : ''}">Vagas</a>
            <a href="/protected/dashboard-epis.html" class="rh-nav-link ${activePage === 'epis' ? 'active' : ''}">EPIs</a>
            <a href="/protected/dashboard-desligamento.html" class="rh-nav-link ${activePage === 'desligamento' ? 'active' : ''}">Desligamento</a>
            <a href="/protected/dashboard-avaliacao.html" class="rh-nav-link ${activePage === 'avaliacoes' ? 'active' : ''}">Avaliações</a>
            <a href="/protected/dashboard-experiencia.html" class="rh-nav-link ${activePage === 'experiencia' ? 'active' : ''}">Experiência</a>
            <a href="/protected/dashboard-formularios.html" class="rh-nav-link ${activePage === 'formularios' ? 'active' : ''}" data-role="admin">Formulários</a>
            <button onclick="logout()" class="rh-nav-link logout-btn" style="background: none; border: none; cursor: pointer; color: white;">🚪 Sair</button>
        </div>
    </nav>
    `;
    // Inserir no início do body ou em um container específico
    const container = document.getElementById('navbar-container');
    if (container) {
        container.innerHTML = navbarHtml;
    } else {
        document.body.insertAdjacentHTML('afterbegin', navbarHtml);
    }

    // Hide admin-only links if not admin
    checkNavbarPermissions();
}

async function checkNavbarPermissions() {
    try {
        const res = await fetch('/api/me');
        if (res.ok) {
            const data = await res.json();
            if (data.user.role !== 'admin') {
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
