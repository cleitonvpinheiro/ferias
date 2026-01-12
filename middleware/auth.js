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
    PORTARIA: 'portaria'
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

// Middleware para verificar token JWT
const verifyToken = (req, res, next) => {
    // Tenta pegar token do cookie ou header Authorization
    let token = req.cookies.token;
    
    if (!token && req.headers.authorization) {
        const parts = req.headers.authorization.split(' ');
        if (parts.length === 2 && parts[0] === 'Bearer') {
            token = parts[1];
        }
    }

    if (!token) {
        // Se for requisição de API (JSON), retorna 401
        // Se for navegação (HTML), redireciona para login
        if (req.accepts('html')) {
            return res.redirect('/login.html');
        }
        return res.status(401).json({ ok: false, erro: 'Acesso não autorizado' });
    }

    try {
        const decoded = jwt.verify(token, SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.clearCookie('token');
        if (req.accepts('html')) {
            return res.redirect('/login.html');
        }
        return res.status(401).json({ ok: false, erro: 'Token inválido ou expirado' });
    }
};

// Middleware para verificar papel (Role)
const checkRole = (roles) => {
    return (req, res, next) => {
        // If roles is a string, convert to array
        const allowedRoles = Array.isArray(roles) ? roles : [roles];
        
        // If user is admin, allow everything? Maybe explicit is better.
        // Let's add admin to allowedRoles if not present, assuming admin can access everything
        if (!allowedRoles.includes(ROLES.ADMIN)) allowedRoles.push(ROLES.ADMIN);

        if (!req.user || !allowedRoles.includes(req.user.role)) {
            if (req.accepts('html')) {
                // Redireciona para login ou página de erro
                return res.redirect('/login.html?error=forbidden');
            }
            return res.status(403).json({ ok: false, erro: 'Acesso proibido para seu perfil' });
        }
        next();
    };
};

// Pre-defined auth middlewares
const rhAuth = [verifyToken, checkRole(ALL_RH_ROLES)];
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
    portariaAuth,
    recrutamentoAuth,
    dpAuth,
    tdAuth,
    sesmtAuth,
    adminAuth,
    SECRET,
    ROLES
};
