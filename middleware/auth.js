// middleware/auth.js
const jwt = require('jsonwebtoken');
require('dotenv').config();

const SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV !== 'production' ? 'dev-jwt-secret' : null);
if (!SECRET) {
    throw new Error('FATAL: JWT_SECRET não definido no .env');
}

module.exports = (db) => {

    // ── Role Definitions ──────────────────────────────────────────────────────
    const ROLES = {
        ADMIN        : 'admin',
        RH           : 'rh',
        RH_GERAL     : 'rh_geral',
        DP           : 'dp',
        RECRUTAMENTO : 'recrutamento',
        TD           : 'td',
        SESMT        : 'sesmt',
        PORTARIA     : 'portaria',
        GESTOR       : 'gestor',
        LIDER        : 'lider',
        SUPERVISOR   : 'supervisor',
        GERENTE      : 'gerente',
        ENDOMARKETING: 'endomarketing',
        PENDENTE     : 'pendente',
    };

    const ALL_RH_ROLES = [
        ROLES.ADMIN, ROLES.RH, ROLES.RH_GERAL, ROLES.DP,
        ROLES.RECRUTAMENTO, ROLES.TD, ROLES.SESMT,
    ];

    const PORTAL_ROLES = [
        ...ALL_RH_ROLES,
        ROLES.PORTARIA, ROLES.GESTOR, ROLES.LIDER, ROLES.SUPERVISOR,
        ROLES.GERENTE, ROLES.ENDOMARKETING,
    ];

    const PUBLIC_PAGE_ACCESS = {
        '/ferias.html'                    : [ROLES.ADMIN, ROLES.RH, ROLES.RH_GERAL, ROLES.DP, ROLES.GESTOR, ROLES.LIDER],
        '/vagas.html'                     : [ROLES.ADMIN, ROLES.RH, ROLES.RH_GERAL, ROLES.RECRUTAMENTO, ROLES.GESTOR, ROLES.LIDER, ROLES.SUPERVISOR, ROLES.GERENTE],
        '/taxas.html'                     : [ROLES.ADMIN, ROLES.RH, ROLES.RH_GERAL, ROLES.DP, ROLES.GESTOR, ROLES.LIDER, ROLES.SUPERVISOR, ROLES.GERENTE],
        '/solicitacao-taxa.html'          : [ROLES.ADMIN, ROLES.RH, ROLES.RH_GERAL, ROLES.DP, ROLES.GESTOR, ROLES.LIDER, ROLES.SUPERVISOR, ROLES.GERENTE],
        '/trabalheConosco.html'           : [ROLES.ADMIN, ROLES.RH, ROLES.RH_GERAL, ROLES.RECRUTAMENTO],
        '/recrutamentoInterno.html'       : [ROLES.ADMIN, ROLES.RH, ROLES.RH_GERAL, ROLES.RECRUTAMENTO],
        '/onTheJob.html'                  : [ROLES.ADMIN, ROLES.RH_GERAL, ROLES.TD],
        '/avaliacao-lideranca.html'       : [ROLES.ADMIN, ROLES.RH, ROLES.RH_GERAL, ROLES.TD, ROLES.GESTOR, ROLES.LIDER, ROLES.SUPERVISOR, ROLES.GERENTE],
        '/avaliacao-adm.html'             : [ROLES.ADMIN, ROLES.RH, ROLES.RH_GERAL, ROLES.TD, ROLES.GESTOR, ROLES.LIDER, ROLES.SUPERVISOR, ROLES.GERENTE],
        '/avaliacao-operacional.html'     : [ROLES.ADMIN, ROLES.RH, ROLES.RH_GERAL, ROLES.TD, ROLES.GESTOR, ROLES.LIDER, ROLES.SUPERVISOR, ROLES.GERENTE],
        '/form-avaliacao-experiencia.html': [ROLES.ADMIN, ROLES.RH, ROLES.RH_GERAL, ROLES.DP, ROLES.TD, ROLES.GESTOR, ROLES.LIDER, ROLES.SUPERVISOR, ROLES.GERENTE],
    };

    const PROTECTED_PAGE_ACCESS_BASE = {
        '/index.html'                             : PORTAL_ROLES,
        '/dashboard-gestor.html'                  : [ROLES.ADMIN, ROLES.RH, ROLES.RH_GERAL, ROLES.GESTOR, ROLES.LIDER, ROLES.SUPERVISOR, ROLES.GERENTE],
        '/dashboard-portaria.html'                : [ROLES.ADMIN, ROLES.RH, ROLES.RH_GERAL, ROLES.PORTARIA],
        '/dashboard-rh.html'                      : [ROLES.ADMIN, ROLES.RH, ROLES.RH_GERAL, ROLES.DP],
        '/dashboard-taxas.html'                   : [ROLES.ADMIN, ROLES.RH, ROLES.RH_GERAL, ROLES.DP, ROLES.GESTOR, ROLES.LIDER, ROLES.SUPERVISOR, ROLES.GERENTE],
        '/dashboard-solicitacoes-taxa.html'       : [ROLES.ADMIN, ROLES.RH, ROLES.RH_GERAL, ROLES.DP, ROLES.LIDER, ROLES.SUPERVISOR, ROLES.GERENTE],
        '/dashboard-candidatos.html'              : [ROLES.ADMIN, ROLES.RH, ROLES.RH_GERAL, ROLES.RECRUTAMENTO],
        '/dashboard-recrutamento.html'            : [ROLES.ADMIN, ROLES.RH, ROLES.RH_GERAL, ROLES.RECRUTAMENTO],
        '/dashboard-onthejob.html'                : [ROLES.ADMIN, ROLES.RH_GERAL, ROLES.TD],
        '/dashboard-vagas.html'                   : [ROLES.ADMIN, ROLES.RH, ROLES.RH_GERAL, ROLES.RECRUTAMENTO, ROLES.LIDER, ROLES.SUPERVISOR, ROLES.GERENTE],
        '/dashboard-epis.html'                    : [ROLES.ADMIN, ROLES.RH, ROLES.RH_GERAL, ROLES.SESMT],
        '/dashboard-funcionarios.html'            : [ROLES.ADMIN, ROLES.RH, ROLES.RH_GERAL, ROLES.DP],
        '/dashboard-disciplinar.html'             : [ROLES.ADMIN, ROLES.RH, ROLES.RH_GERAL, ROLES.DP],
        '/dashboard-beneficios.html'              : [ROLES.ADMIN, ROLES.RH, ROLES.RH_GERAL, ROLES.DP],
        '/dashboard-desligamento.html'            : [ROLES.ADMIN, ROLES.RH, ROLES.RH_GERAL, ROLES.DP],
        '/entrevista-desligamento.html'           : [ROLES.ADMIN, ROLES.RH, ROLES.RH_GERAL, ROLES.DP],
        '/dashboard-avaliacao.html'               : [ROLES.ADMIN, ROLES.RH, ROLES.RH_GERAL, ROLES.TD, ROLES.GESTOR, ROLES.LIDER, ROLES.SUPERVISOR, ROLES.GERENTE],
        '/dashboard-experiencia.html'             : [ROLES.ADMIN, ROLES.RH, ROLES.RH_GERAL, ROLES.DP, ROLES.GESTOR, ROLES.LIDER, ROLES.SUPERVISOR, ROLES.GERENTE],
        '/dashboard-formularios.html'             : [ROLES.ADMIN, ROLES.RH, ROLES.RH_GERAL, ROLES.TD, ROLES.ENDOMARKETING],
        '/dashboard-formulario-respostas.html'    : [ROLES.ADMIN, ROLES.RH, ROLES.RH_GERAL, ROLES.TD, ROLES.ENDOMARKETING],
        '/gerenciar-usuarios.html'                : [ROLES.ADMIN, ROLES.RH, ROLES.RH_GERAL],
    };

    const cloneAccessMap = (m) => {
        const out = {};
        Object.entries(m).forEach(([k, v]) => { out[k] = Array.isArray(v) ? [...v] : v; });
        return out;
    };

    const PROTECTED_PAGE_ACCESS = cloneAccessMap(PROTECTED_PAGE_ACCESS_BASE);

    const getProtectedPages = () =>
        Object.keys(PROTECTED_PAGE_ACCESS_BASE).filter(p => p !== '/index.html');

    const getEffectiveProtectedPathsForRole = (role) => {
        const out = [];
        Object.entries(PROTECTED_PAGE_ACCESS).forEach(([path, roles]) => {
            if (path === '/index.html') return;
            if (Array.isArray(roles) && roles.includes(role)) out.push(path);
        });
        return out.sort((a, b) => a.localeCompare(b));
    };

    // ── reloadRolePermissions ─────────────────────────────────────────────────
    const reloadRolePermissions = async () => {
        try {
            const rows = await db.rolePermissions.getAll();
            const next = cloneAccessMap(PROTECTED_PAGE_ACCESS_BASE);
            const allPaths = Object.keys(next).filter(p => p !== '/index.html');
            const normRole = (v) => String(v || '').trim().toLowerCase();

            (rows || []).forEach(r => {
                const role = normRole(r && r.role);
                if (!role || role === ROLES.ADMIN) return;
                const allowed = Array.isArray(r.protected_paths) ? r.protected_paths : [];
                const allowedSet = new Set(allowed.filter(p => allPaths.includes(p)));
                const unionOnly = [ROLES.GERENTE, ROLES.GESTOR, ROLES.SUPERVISOR, ROLES.LIDER].includes(role);
                if (!unionOnly) {
                    allPaths.forEach(path => {
                        if (!Array.isArray(next[path])) next[path] = [];
                        next[path] = next[path].filter(x => x !== role);
                    });
                }
                allowedSet.forEach(path => {
                    if (!Array.isArray(next[path])) next[path] = [];
                    if (!next[path].includes(role)) next[path].push(role);
                });
            });

            Object.keys(PROTECTED_PAGE_ACCESS).forEach(k => delete PROTECTED_PAGE_ACCESS[k]);
            Object.assign(PROTECTED_PAGE_ACCESS, next);
        } catch (e) {
            // Tabela pode não existir ainda (primeira execução). Não é fatal —
            // o servidor sobe com as permissões padrão do PROTECTED_PAGE_ACCESS_BASE.
            const isTableMissing = e && (e.code === 'ER_NO_SUCH_TABLE' || e.code === 'ER_NO_DB_ERROR');
            if (isTableMissing) {
                console.warn('⚠️  role_permissions: tabela não encontrada. Usando permissões padrão.');
            } else {
                console.error('Erro ao recarregar permissões por perfil:', e);
            }
        }
    };

    // ── verifyToken ───────────────────────────────────────────────────────────
    const verifyToken = async (req, res, next) => {
        const originalUrl = String(req.originalUrl || req.url || '');
        const isApiRequest = originalUrl.startsWith('/api/');
        let token = req.cookies.token;

        if (!token && req.headers.authorization) {
            const parts = req.headers.authorization.split(' ');
            if (parts.length === 2 && parts[0] === 'Bearer') token = parts[1];
        }

        if (!token) {
            if (isApiRequest) return res.status(401).json({ ok: false, erro: 'Acesso não autorizado' });
            if (req.accepts('html')) return res.redirect('/login.html');
            return res.status(401).json({ ok: false, erro: 'Acesso não autorizado' });
        }

        try {
            const decoded = jwt.verify(token, SECRET);
            if (decoded && typeof decoded.role === 'string') {
                decoded.role = decoded.role.trim().toLowerCase();
            }
            try {
                const username = decoded && decoded.username
                    ? String(decoded.username).trim().toLowerCase() : '';
                if (username) {
                    const dbUser = await db.users.getByUsername(username);
                    if (dbUser && typeof dbUser.role === 'string' && dbUser.role.trim())
                        decoded.role = dbUser.role.trim().toLowerCase();
                    if (dbUser && typeof dbUser.email === 'string' && dbUser.email.trim())
                        decoded.email = dbUser.email.trim();
                    if (dbUser && typeof dbUser.name === 'string' && dbUser.name.trim())
                        decoded.name = dbUser.name.trim();
                }
            } catch (_) {}
            req.user = decoded;
            next();
        } catch (err) {
            res.clearCookie('token');
            if (isApiRequest) return res.status(401).json({ ok: false, erro: 'Token inválido ou expirado' });
            if (req.accepts('html')) return res.redirect('/login.html');
            return res.status(401).json({ ok: false, erro: 'Token inválido ou expirado' });
        }
    };

    // ── checkRole ─────────────────────────────────────────────────────────────
    const checkRole = (roles) => (req, res, next) => {
        const originalUrl = String(req.originalUrl || req.url || '');
        const isApiRequest = originalUrl.startsWith('/api/');
        const allowedRoles = Array.isArray(roles) ? [...roles] : [roles];
        if (!allowedRoles.includes(ROLES.ADMIN)) allowedRoles.push(ROLES.ADMIN);

        if (req.user && req.user.role === ROLES.ADMIN) return next();

        if (!req.user || !allowedRoles.includes(req.user.role)) {
            if (!isApiRequest && req.accepts('html')) {
                if (req.user && req.user.role === ROLES.PENDENTE)
                    return res.redirect('/login.html?error=pendente');
                return res.redirect('/login.html?error=forbidden');
            }
            if (req.user && req.user.role === ROLES.PENDENTE)
                return res.status(403).json({ ok: false, erro: 'Acesso pendente de liberação' });
            return res.status(403).json({ ok: false, erro: 'Acesso proibido para seu perfil' });
        }
        next();
    };

    // ── Auth middleware combos ────────────────────────────────────────────────
    const rhAuth        = [verifyToken, checkRole(ALL_RH_ROLES)];
    const portalAuth    = [verifyToken, checkRole(PORTAL_ROLES)];
    const portariaAuth  = [verifyToken, checkRole([ROLES.PORTARIA, ...ALL_RH_ROLES])];
    const recrutamentoAuth = [verifyToken, checkRole([ROLES.RECRUTAMENTO, ROLES.RH_GERAL, ROLES.RH])];
    const dpAuth        = [verifyToken, checkRole([ROLES.DP, ROLES.RH_GERAL, ROLES.RH])];
    const tdAuth        = [verifyToken, checkRole([ROLES.TD, ROLES.RH_GERAL, ROLES.RH])];
    const onTheJobAuth  = [verifyToken, checkRole([ROLES.TD, ROLES.RH_GERAL])];
    const disciplinarAuth = [verifyToken, checkRole([ROLES.DP, ROLES.RH_GERAL, ROLES.RH])];
    const sesmtAuth     = [verifyToken, checkRole([ROLES.SESMT, ROLES.RH_GERAL, ROLES.RH])];
    const adminAuth     = [verifyToken, checkRole([ROLES.ADMIN])];
    const expDashAuth   = [verifyToken, checkRole([...ALL_RH_ROLES, ROLES.GESTOR, ROLES.LIDER, ROLES.SUPERVISOR, ROLES.GERENTE])];

    // ── auditLog ─────────────────────────────────────────────────────────────
    const auditLog = (action, resource = null, resourceId = null) => async (req, res, next) => {
        const user = req.user;
        const data = {
            user_id: user ? user.id : null,
            username: user ? user.username : 'anonymous',
            action,
            resource,
            resource_id: resourceId || (req.params && req.params.id) || null,
            details: {
                method: req.method,
                path: req.originalUrl,
                query: req.query,
                body: ['POST', 'PUT', 'PATCH'].includes(req.method) ? { ...req.body, password: undefined, token: undefined } : null
            },
            ip_address: req.ip || req.headers['x-forwarded-for'],
            user_agent: req.headers['user-agent']
        };
        db.auditLogs.log(data).catch(err => console.error('Audit log error:', err));
        next();
    };

    return {
        verifyToken,
        checkRole,
        auditLog,
        rhAuth,
        portalAuth,
        portariaAuth,
        recrutamentoAuth,
        dpAuth,
        tdAuth,
        onTheJobAuth,
        disciplinarAuth,
        sesmtAuth,
        adminAuth,
        expDashAuth,
        SECRET,
        ROLES,
        ALL_RH_ROLES,
        PORTAL_ROLES,
        PUBLIC_PAGE_ACCESS,
        PROTECTED_PAGE_ACCESS,
        PROTECTED_PAGE_ACCESS_BASE,
        reloadRolePermissions,
        getProtectedPages,
        getEffectiveProtectedPathsForRole,
    };
};