require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const xss = require('xss-clean');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || '::';
const { verifyToken, checkRole, rhAuth, portalAuth, portariaAuth, PUBLIC_PAGE_ACCESS, PROTECTED_PAGE_ACCESS, ROLES } = require('./middleware/auth');

app.use((req, res, next) => {
    const requestId = crypto.randomUUID();
    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);
    const start = process.hrtime.bigint();

    res.on('finish', () => {
        const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
        const entry = {
            t: new Date().toISOString(),
            requestId,
            method: req.method,
            path: req.originalUrl || req.url,
            status: res.statusCode,
            durationMs: Math.round(durationMs),
            user: req.user ? { username: req.user.username, role: req.user.role } : undefined
        };
        console.log(JSON.stringify(entry));
    });

    next();
});

const runMiddlewares = (middlewares, req, res, next) => {
    let i = 0;
    const runNext = (err) => {
        if (err) return next(err);
        const mw = middlewares[i++];
        if (!mw) return next();
        mw(req, res, runNext);
    };
    runNext();
};

// Security Middleware
app.use(helmet({
    frameguard: process.env.NODE_ENV === 'production' ? { action: 'sameorigin' } : false,
    crossOriginOpenerPolicy: process.env.NODE_ENV === 'production' ? { policy: 'same-origin' } : false,
    crossOriginResourcePolicy: process.env.NODE_ENV === 'production' ? { policy: 'same-origin' } : false,
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.sheetjs.com", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
            scriptSrcAttr: ["'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'", "https://cdn.sheetjs.com", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "http://localhost:*", "ws://localhost:*", "http://127.0.0.1:*", "ws://127.0.0.1:*"],
            objectSrc: ["'none'"],
            "upgrade-insecure-requests": null,
        },
    },
    hsts: false // Disable HSTS for local development to prevent SSL errors on localhost
}));

// Data Sanitization against XSS
app.use(xss());

// Cookie Parser
app.use(cookieParser());

app.use((req, res, next) => {
    const method = req.method.toUpperCase();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return next();
    if (!req.cookies || !req.cookies.token) return next();

    const originalUrl = String(req.originalUrl || req.url || '');
    const isApiRequest = originalUrl.startsWith('/api/');

    const configured = (process.env.ALLOWED_ORIGINS || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

    if (configured.length === 0 || process.env.NODE_ENV !== 'production') {
        return next();
    }

    const host = req.get('host');
    const inferred = host ? [`http://${host}`, `https://${host}`] : [];
    const allowedOrigins = new Set([...configured, ...inferred]);

    const origin = req.headers.origin;
    let refererOrigin;
    const referer = req.headers.referer;
    if (typeof referer === 'string' && referer.length > 0) {
        try {
            refererOrigin = new URL(referer).origin;
        } catch (_) {}
    }

    if (!origin && !refererOrigin) return next();

    const allowed = (typeof origin === 'string' && allowedOrigins.has(origin)) || (typeof refererOrigin === 'string' && allowedOrigins.has(refererOrigin));
    if (allowed) return next();

    if (isApiRequest) return res.status(403).json({ ok: false, erro: 'Requisição bloqueada' });
    if (req.accepts('html')) return res.status(403).send('Forbidden');
    return res.status(403).json({ ok: false, erro: 'Requisição bloqueada' });
});

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: 'Muitas requisições, tente novamente mais tarde.'
});
app.use(limiter);

const configuredCorsOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (configuredCorsOrigins.length === 0) return callback(null, true);
        if (configuredCorsOrigins.includes(origin)) return callback(null, true);
        return callback(null, false);
    },
    credentials: true
}));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

app.get('/health', (req, res) => res.json({ ok: true, port: Number(process.env.ACTUAL_PORT || PORT), pid: process.pid }));
app.get('/ready', async (req, res) => {
    try {
        const db = require('./services/db');
        await db.ping();
        res.json({ ok: true, port: Number(process.env.ACTUAL_PORT || PORT), pid: process.pid });
    } catch (e) {
        res.status(503).json({ ok: false });
    }
});

app.use((req, res, next) => {
    const allowedRoles = PUBLIC_PAGE_ACCESS[req.path];
    if (!allowedRoles) return next();
    return runMiddlewares([verifyToken, checkRole(allowedRoles)], req, res, next);
});

const noCacheHtmlHeaders = (res, filePath) => {
    if (String(filePath || '').toLowerCase().endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
};

// Public Routes (Login, etc)
app.use(express.static(path.join(__dirname, 'public'), { setHeaders: noCacheHtmlHeaders }));
app.use('/uploads', (req, res, next) => runMiddlewares([
    verifyToken,
    checkRole([ROLES.RECRUTAMENTO, ROLES.RH, ROLES.RH_GERAL])
], req, res, next), express.static(path.join(__dirname, 'uploads')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

app.get('/login.html', (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.sendFile(path.join(__dirname, 'public/login.html'));
});

app.get('/entrevista-desligamento.html', (req, res, next) => {
    const allowedRoles = PROTECTED_PAGE_ACCESS['/entrevista-desligamento.html'];
    return runMiddlewares([verifyToken, checkRole(allowedRoles)], req, res, () => {
        res.sendFile(path.join(__dirname, 'protected/entrevista-desligamento.html'));
    });
});

// Routes
const authRouter = require('./routes/auth');
const feriasRouter = require('./routes/ferias');
const funcionariosRouter = require('./routes/funcionarios');
const episRouter = require('./routes/epis');
const uniformesRouter = require('./routes/uniformes');
const vagasRouter = require('./routes/vagas');
const candidatosRouter = require('./routes/candidatos');
const taxasRouter = require('./routes/taxas');
const solicitacaoTaxaRouter = require('./routes/solicitacaoTaxa');
const movimentacaoRouter = require('./routes/movimentacao');
const portariaRouter = require('./routes/portaria');
const rhRouter = require('./routes/rh');
const recrutamentoRouter = require('./routes/recrutamento');
const onthejobRouter = require('./routes/onthejob');
const desligamentoRouter = require('./routes/desligamento');
const avaliacaoRouter = require('./routes/avaliacao');
const formulariosRouter = require('./routes/formularios');
const usersRouter = require('./routes/users');
const disciplinarRouter = require('./routes/disciplinar');

// Middleware de Autenticação (JWT)
// Substitui a proteção estática anterior pelo middleware verifyToken
app.use('/protected', portalAuth, (req, res, next) => {
    if (process.env.SHOW_ALL_DASH === '1') {
        return next();
    }
    if (req.user && req.user.role === 'admin') {
        return next();
    }
    const pathname = req.path === '/' ? '/index.html' : req.path;
    if (pathname === '/dashboard-disciplinar.html') {
        return runMiddlewares([checkRole([ROLES.DP, ROLES.RH_GERAL, ROLES.RH, ROLES.ADMIN])], req, res, next);
    }
    const allowedRoles = PROTECTED_PAGE_ACCESS[pathname];
    if (!allowedRoles) {
        const isHtml = pathname === '/index.html' || pathname.endsWith('.html');
        if (!isHtml) return next();
        if (req.accepts('html')) return res.redirect('/login.html?error=forbidden');
        return res.status(403).json({ ok: false, erro: 'Acesso proibido para seu perfil' });
    }
    if (req.user && (req.user.role === 'admin' || allowedRoles.includes(req.user.role))) return next();
    if (req.accepts('html')) return res.redirect('/login.html?error=forbidden');
    return res.status(403).json({ ok: false, erro: 'Acesso proibido para seu perfil' });
}, express.static(path.join(__dirname, 'protected'), { setHeaders: noCacheHtmlHeaders }));

app.get('/rh', rhAuth, (req, res) => res.sendFile(path.join(__dirname, 'protected/index.html')));

// Legacy Redirects
app.get('/dashboard-rh.html', rhAuth, (req, res) => res.sendFile(path.join(__dirname, 'protected/dashboard-rh.html')));
app.get('/dashboard-vagas.html', rhAuth, (req, res) => res.sendFile(path.join(__dirname, 'protected/dashboard-vagas.html')));
app.get('/dashboard-taxas.html', portalAuth, (req, res) => res.redirect('/protected/dashboard-taxas.html'));
app.get('/dashboard-candidatos.html', rhAuth, (req, res) => res.sendFile(path.join(__dirname, 'protected/dashboard-candidatos.html')));
app.get('/dashboard-avaliacao.html', rhAuth, (req, res) => res.sendFile(path.join(__dirname, 'protected/dashboard-avaliacao.html')));
app.get('/dashboard-experiencia.html', rhAuth, (req, res) => res.sendFile(path.join(__dirname, 'protected/dashboard-experiencia.html')));

// API Mounting
app.use('/api', authRouter);
app.use('/api', feriasRouter);
app.use('/api', funcionariosRouter);
app.use('/api', episRouter);
app.use('/api', uniformesRouter);
app.use('/api', vagasRouter);
app.use('/api', candidatosRouter);
app.use('/api', taxasRouter);
app.use('/api', solicitacaoTaxaRouter);
app.use('/api', movimentacaoRouter);
app.use('/api', portariaRouter);
app.use('/api', rhRouter);
app.use('/api', recrutamentoRouter);
app.use('/api', onthejobRouter);
app.use('/api', desligamentoRouter);
app.use('/api', avaliacaoRouter);
app.use('/api', usersRouter);
app.use('/api', disciplinarRouter);
app.use('/api/rh/formularios', formulariosRouter);

let currentPort = parseInt(String(PORT), 10);
if (!Number.isFinite(currentPort) || currentPort < 0 || currentPort >= 65536) currentPort = 8080;
const allowPortFallback = String(process.env.ALLOW_PORT_FALLBACK || '').trim() === '1';
let retries = allowPortFallback ? 5 : 0;

function start() {
    const srv = app.listen(currentPort, HOST, () => {
        process.env.ACTUAL_PORT = String(currentPort);
        const ifaces = os.networkInterfaces();
        const lanIps = Object.values(ifaces)
            .flat()
            .filter((i) => i && i.family === 'IPv4' && !i.internal)
            .map((i) => i.address);
        console.log(`Servidor rodando na porta ${currentPort}`);
        console.log(`URL: http://localhost:${currentPort}/login.html`);
        console.log(`URL: http://127.0.0.1:${currentPort}/login.html`);
        lanIps.forEach((ip) => {
            console.log(`URL LAN: http://${ip}:${currentPort}/login.html`);
        });
    });
    srv.on('error', (err) => {
        if (err && err.code === 'EADDRINUSE') {
            if (retries > 0) {
                console.warn(`Porta ${currentPort} em uso. Tentando a próxima...`);
                currentPort = Number(currentPort) + 1;
                if (!Number.isFinite(currentPort) || currentPort >= 65536) {
                    console.error(`Porta inválida calculada. Abortando.`);
                    process.exit(1);
                }
                retries -= 1;
                setTimeout(start, 100);
                return;
            }
            console.error(`Porta ${currentPort} já está em uso. Finalize o processo que está usando a porta ou defina outra porta em PORT no .env.`);
            process.exit(1);
        }
        console.error(err);
        process.exit(1);
    });
}
start();
