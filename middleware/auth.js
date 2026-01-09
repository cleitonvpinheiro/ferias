const jwt = require('jsonwebtoken');
require('dotenv').config();

const SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV !== 'production' ? 'dev-jwt-secret' : null);
if (!SECRET) {
    throw new Error('FATAL: JWT_SECRET não definido no .env');
}

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
        if (!req.user || !roles.includes(req.user.role)) {
            if (req.accepts('html')) {
                // Redireciona para login ou página de erro
                return res.redirect('/login.html?error=forbidden');
            }
            return res.status(403).json({ ok: false, erro: 'Acesso proibido para seu perfil' });
        }
        next();
    };
};

// Funções para compatibilidade com o código anterior, mas usando JWT
const rhAuth = [verifyToken, checkRole(['rh'])];
const portariaAuth = [verifyToken, checkRole(['portaria', 'rh'])]; // RH também pode acessar portaria se quiser

module.exports = { 
    verifyToken, 
    checkRole, 
    rhAuth, 
    portariaAuth,
    SECRET 
};
