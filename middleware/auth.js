const jwt = require('jsonwebtoken');
require('dotenv').config();

const SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV !== 'production' ? 'dev-jwt-secret' : null);
if (!SECRET) {
    throw new Error('FATAL: JWT_SECRET não definido no .env');
}

// Role Definitions
const ROLES = {
    ADMIN: 'admin',
    RH: 'rh', // Legacy
    RH_GERAL: 'rh_geral',
    DP: 'dp',
    RECRUTAMENTO: 'recrutamento',
    TD: 'td',
    SESMT: 'sesmt',
    PORTARIA: 'portaria',
    GESTOR: 'gestor',
    ENDOMARKETING: 'endomarketing',
    PENDENTE: 'pendente'
};

const ALL_RH_ROLES = [
    ROLES.ADMIN, 
    ROLES.RH, 
    ROLES.RH_GERAL, 
    ROLES.DP, 
    ROLES.RECRUTAMENTO, 
    ROLES.TD, 
    ROLES.SESMT
];

const PORTAL_ROLES = [
    ...ALL_RH_ROLES,
    ROLES.PORTARIA,
    ROLES.GESTOR,
    ROLES.ENDOMARKETING
];

const PUBLIC_PAGE_ACCESS = {
    '/ferias.html': [ROLES.ADMIN, ROLES.RH, ROLES.RH_GERAL, ROLES.DP, ROLES.GESTOR],
    '/vagas.html': [ROLES.ADMIN, ROLES.RH, ROLES.RH_GERAL, ROLES.RECRUTAMENTO, ROLES.GESTOR],
    '/taxas.html': [ROLES.ADMIN, ROLES.RH, ROLES.RH_GERAL, ROLES.DP, ROLES.GESTOR],
    '/solicitacao-taxa.html': [ROLES.ADMIN, ROLES.RH, ROLES.RH_GERAL, ROLES.DP, ROLES.GESTOR],
    '/trabalheConosco.html': [ROLES.ADMIN, ROLES.RH, ROLES.RH_GERAL, ROLES.RECRUTAMENTO],
    '/recrutamentoInterno.html': [ROLES.ADMIN, ROLES.RH, ROLES.RH_GERAL, ROLES.RECRUTAMENTO],
    '/onTheJob.html': [ROLES.ADMIN, ROLES.RH, ROLES.RH_GERAL, ROLES.DP, ROLES.TD],
    '/avaliacao-lideranca.html': [ROLES.ADMIN, ROLES.RH, ROLES.RH_GERAL, ROLES.TD, ROLES.GESTOR],
    '/avaliacao-adm.html': [ROLES.ADMIN, ROLES.RH, ROLES.RH_GERAL, ROLES.TD, ROLES.GESTOR],
    '/avaliacao-operacional.html': [ROLES.ADMIN, ROLES.RH, ROLES.RH_GERAL, ROLES.TD, ROLES.GESTOR],
    '/form-avaliacao-experiencia.html': [ROLES.ADMIN, ROLES.RH, ROLES.RH_GERAL, ROLES.DP, ROLES.TD, ROLES.GESTOR]
};

const PROTECTED_PAGE_ACCESS = {
    '/index.html': PORTAL_ROLES,
    '/dashboard-portaria.html': [ROLES.ADMIN, ROLES.RH, ROLES.RH_GERAL, ROLES.PORTARIA],
    '/dashboard-rh.html': [ROLES.ADMIN, ROLES.RH, ROLES.RH_GERAL, ROLES.DP],
    '/dashboard-taxas.html': [ROLES.ADMIN, ROLES.RH, ROLES.RH_GERAL, ROLES.DP],
    '/dashboard-solicitacoes-taxa.html': [ROLES.ADMIN, ROLES.RH, ROLES.RH_GERAL, ROLES.DP],
    '/dashboard-candidatos.html': [ROLES.ADMIN, ROLES.RH, ROLES.RH_GERAL, ROLES.RECRUTAMENTO],
    '/dashboard-recrutamento.html': [ROLES.ADMIN, ROLES.RH, ROLES.RH_GERAL, ROLES.RECRUTAMENTO],
    '/dashboard-onthejob.html': [ROLES.ADMIN, ROLES.RH, ROLES.RH_GERAL, ROLES.DP, ROLES.TD],
    '/dashboard-vagas.html': [ROLES.ADMIN, ROLES.RH, ROLES.RH_GERAL, ROLES.RECRUTAMENTO],
    '/dashboard-epis.html': [ROLES.ADMIN, ROLES.RH, ROLES.RH_GERAL, ROLES.SESMT],
    '/dashboard-funcionarios.html': [ROLES.ADMIN, ROLES.RH, ROLES.RH_GERAL, ROLES.DP],
    '/dashboard-desligamento.html': [ROLES.ADMIN, ROLES.RH, ROLES.RH_GERAL, ROLES.DP],
    '/entrevista-desligamento.html': [ROLES.ADMIN, ROLES.RH, ROLES.RH_GERAL, ROLES.DP],
    '/dashboard-avaliacao.html': [ROLES.ADMIN, ROLES.RH, ROLES.RH_GERAL, ROLES.TD],
    '/dashboard-experiencia.html': [ROLES.ADMIN, ROLES.RH, ROLES.RH_GERAL, ROLES.DP, ROLES.GESTOR],
    '/dashboard-formularios.html': [ROLES.ADMIN, ROLES.RH, ROLES.RH_GERAL, ROLES.TD, ROLES.ENDOMARKETING],
    '/gerenciar-usuarios.html': [ROLES.ADMIN, ROLES.RH, ROLES.RH_GERAL]
};

// Middleware para verificar token JWT
const verifyToken = (req, res, next) => {
    const originalUrl = String(req.originalUrl || req.url || '');
    const isApiRequest = originalUrl.startsWith('/api/');
    // Tenta pegar token do cookie ou header Authorization
    let token = req.cookies.token;
    
    if (!token && req.headers.authorization) {
        const parts = req.headers.authorization.split(' ');
        if (parts.length === 2 && parts[0] === 'Bearer') {
            token = parts[1];
        }
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
        req.user = decoded;
        next();
    } catch (err) {
        res.clearCookie('token');
        if (isApiRequest) return res.status(401).json({ ok: false, erro: 'Token inválido ou expirado' });
        if (req.accepts('html')) return res.redirect('/login.html');
        return res.status(401).json({ ok: false, erro: 'Token inválido ou expirado' });
    }
};

// Middleware para verificar papel (Role)
const checkRole = (roles) => {
    return (req, res, next) => {
        const originalUrl = String(req.originalUrl || req.url || '');
        const isApiRequest = originalUrl.startsWith('/api/');
        // If roles is a string, convert to array
        const allowedRoles = Array.isArray(roles) ? [...roles] : [roles];
        
        // If user is admin, allow everything? Maybe explicit is better.
        // Let's add admin to allowedRoles if not present, assuming admin can access everything
        if (!allowedRoles.includes(ROLES.ADMIN)) allowedRoles.push(ROLES.ADMIN);

        if (!req.user || !allowedRoles.includes(req.user.role)) {
            if (!isApiRequest && req.accepts('html')) {
                // Redireciona para login ou página de erro
                if (req.user && req.user.role === ROLES.PENDENTE) return res.redirect('/login.html?error=pendente');
                return res.redirect('/login.html?error=forbidden');
            }
            if (req.user && req.user.role === ROLES.PENDENTE) return res.status(403).json({ ok: false, erro: 'Acesso pendente de liberação' });
            return res.status(403).json({ ok: false, erro: 'Acesso proibido para seu perfil' });
        }
        next();
    };
};

// Pre-defined auth middlewares
const rhAuth = [verifyToken, checkRole(ALL_RH_ROLES)];
const portalAuth = [verifyToken, checkRole(PORTAL_ROLES)];
const portariaAuth = [verifyToken, checkRole([ROLES.PORTARIA, ...ALL_RH_ROLES])];

// Granular Auth Middlewares
const recrutamentoAuth = [verifyToken, checkRole([ROLES.RECRUTAMENTO, ROLES.RH_GERAL, ROLES.RH])];
const dpAuth = [verifyToken, checkRole([ROLES.DP, ROLES.RH_GERAL, ROLES.RH])];
const tdAuth = [verifyToken, checkRole([ROLES.TD, ROLES.RH_GERAL, ROLES.RH])];
const sesmtAuth = [verifyToken, checkRole([ROLES.SESMT, ROLES.RH_GERAL, ROLES.RH])];
const adminAuth = [verifyToken, checkRole([ROLES.ADMIN])];

module.exports = { 
    verifyToken, 
    checkRole, 
    rhAuth, 
    portalAuth,
    portariaAuth,
    recrutamentoAuth,
    dpAuth,
    tdAuth,
    sesmtAuth,
    adminAuth,
    SECRET,
    ROLES,
    ALL_RH_ROLES,
    PORTAL_ROLES,
    PUBLIC_PAGE_ACCESS,
    PROTECTED_PAGE_ACCESS
};
