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

// --- Importação da função de inicialização do DB ---
const dbInitializer = require('./services/db'); // Importa a função de inicialização

// --- Declaração de 'auth' e 'db' fora do escopo da função startServer
// para que possam ser acessados globalmente após a inicialização
let db;
let auth;

// --- Função assíncrona para iniciar o servidor ---
async function startServer() {
    try {
        // 1. Inicializa o banco de dados primeiro
        db = await dbInitializer();
        console.log('✅ Banco de dados inicializado com sucesso!');

        // 2. Agora que 'db' está pronto, importe e inicialize o módulo 'auth'
        //    passando a instância 'db' para ele.
        auth = require('./middleware/auth')(db); // <--- AQUI!

        // 3. Chame reloadRolePermissions APÓS o DB estar pronto e o auth.js inicializado
        await auth.reloadRolePermissions();
        setInterval(auth.reloadRolePermissions, 60_000); // E agende o intervalo

        // --- A partir daqui, o resto do seu server.js pode ser configurado ---

        app.use((req, res, next) => {
            const requestId = crypto.randomUUID();
            req.requestId = requestId;
            res.setHeader('X-Request-Id', requestId);
            const start = process.hrtime.bigint();
            res.on('finish', () => {
                const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
                const rawPath = String(req.originalUrl || req.url || '');
                const safePath = rawPath.split('?')[0];
                const entry = {
                    t: new Date().toISOString(),
                    requestId,
                    method: req.method,
                    path: safePath,
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
            hsts: false
        }));

        app.use(cookieParser());

        app.use(bodyParser.json({ limit: '50mb' }));
        app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

        app.use((req, res, next) => {
            const ct = req.headers['content-type'] || '';
            if (ct.includes('multipart/form-data')) return next();
            xss()(req, res, next);
        });
        

        app.use((req, res, next) => {
            const method = req.method.toUpperCase();
            if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return next();
            if (!req.cookies || !req.cookies.token) return next();
            const originalUrl = String(req.originalUrl || req.url || '');
            const isApiRequest = originalUrl.startsWith('/api/');
            if (process.env.NODE_ENV !== 'production') return next();
            const configured = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
            const host = req.get('host');
            const inferred = host ? [`http://${host}`, `https://${host}`] : [];
            const allowedOrigins = new Set([...configured, ...inferred]);
            if (allowedOrigins.size === 0) return next();
            const origin = req.headers.origin;
            let refererOrigin;
            const referer = req.headers.referer;
            if (typeof referer === 'string' && referer.length > 0) {
                try { refererOrigin = new URL(referer).origin; } catch (_) {}
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
            standardHeaders: true,
            legacyHeaders: false,
            message: 'Muitas requisições, tente novamente mais tarde.' 
        });
        app.use(limiter);

        const authLimiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutos
            max: 15, // 15 tentativas
            message: { ok: false, erro: 'Muitas tentativas de login. Tente novamente em 15 minutos.' }
        });
        app.use('/api/auth/login', authLimiter);
        app.use('/api/login', authLimiter);

        const uploadLimiter = rateLimit({
            windowMs: 60 * 60 * 1000, // 1 hora
            max: 30, // 30 uploads por hora por IP
            message: { ok: false, erro: 'Limite de uploads atingido. Tente novamente mais tarde.' }
        });
        app.use('/api/candidaturas', uploadLimiter);

        const configuredCorsOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
        app.use(cors({
            origin: (origin, callback) => {
                if (!origin) return callback(null, true);
                if (configuredCorsOrigins.length === 0) return callback(null, true);
                if (configuredCorsOrigins.includes(origin)) return callback(null, true);
                return callback(null, false);
            },
            credentials: true
        }));

        const multer = require('multer');
        const fs = require('fs');

        const intranetUploadsDir = path.join(__dirname, 'public/uploads/intranet');
        if (!fs.existsSync(intranetUploadsDir)) fs.mkdirSync(intranetUploadsDir, { recursive: true });

        const intranetUpload = multer({
            storage: multer.diskStorage({
                destination: (req, file, cb) => cb(null, intranetUploadsDir),
                filename: (req, file, cb) => {
                    const ext = path.extname(file.originalname).toLowerCase();
                    cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
                }
            }),
            limits: { fileSize: 5 * 1024 * 1024 },
            fileFilter: (req, file, cb) => {
                const ext = path.extname(file.originalname).toLowerCase();
                console.log('=== MULTER fileFilter ===');
                console.log('fieldname:', file.fieldname);
                console.log('originalname:', file.originalname);
                console.log('mimetype:', file.mimetype);
                console.log('ext:', ext);
                const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
                console.log('permitido:', allowed.includes(ext));
                cb(null, allowed.includes(ext));
            }
        });

        /* app.post('/api/intranet/posts', intranetUpload.single('imagem'), (req, res, next) => next()); */

        

        app.get('/health', (req, res) => res.json({ ok: true, port: Number(process.env.ACTUAL_PORT || PORT), pid: process.pid }));
        app.get('/ready', async (req, res) => {
            try {
                // Aqui você pode usar a instância 'db' já inicializada
                await db.ping();
                res.json({ ok: true, port: Number(process.env.ACTUAL_PORT || PORT), pid: process.pid });
            } catch (e) {
                res.status(503).json({ ok: false });
            }
        });

        app.use((req, res, next) => {
            const allowedRoles = auth.PUBLIC_PAGE_ACCESS[req.path]; // Usa 'auth' global
            if (!allowedRoles) return next();
            return runMiddlewares([auth.verifyToken, auth.checkRole(allowedRoles)], req, res, next); // Usa 'auth' global
        });

        const noCacheHtmlHeaders = (res, filePath) => {
            if (String(filePath || '').toLowerCase().endsWith('.html')) {
                res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
                res.setHeader('Pragma', 'no-cache');
                res.setHeader('Expires', '0');
            }
        };

        app.get('/', (req, res) => {
            res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.set('Pragma', 'no-cache');
            res.set('Expires', '0');
            res.sendFile(path.join(__dirname, 'protected/index.html'));
        });

        app.get('/formularios', (req, res) => {
            res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.set('Pragma', 'no-cache');
            res.set('Expires', '0');
            res.sendFile(path.join(__dirname, 'public/index.html'));
        });

        app.use(express.static(path.join(__dirname, 'public'), { setHeaders: noCacheHtmlHeaders }));
        app.use('/uploads/intranet', express.static(path.join(__dirname, 'public/uploads/intranet')));
        app.use('/uploads', (req, res, next) => runMiddlewares([auth.verifyToken, auth.checkRole([auth.ROLES.ADMIN, auth.ROLES.DP, auth.ROLES.RECRUTAMENTO, auth.ROLES.RH, auth.ROLES.RH_GERAL])], req, res, next), express.static(path.join(__dirname, 'uploads')));
        app.use('/assets', express.static(path.join(__dirname, 'assets')));

        app.get('/login.html', (req, res) => {
            res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.set('Pragma', 'no-cache');
            res.set('Expires', '0');
            res.sendFile(path.join(__dirname, 'public/login.html'));
        });

        app.get('/entrevista-desligamento.html', (req, res, next) => {
            const allowedRoles = auth.PROTECTED_PAGE_ACCESS['/entrevista-desligamento.html']; // Usa 'auth' global
            return runMiddlewares([auth.verifyToken, auth.checkRole(allowedRoles)], req, res, () => {
                res.sendFile(path.join(__dirname, 'protected/entrevista-desligamento.html'));
            });
        });

        // --- Importação das Rotas ---
        // As rotas também precisarão da instância 'db' e 'auth'
        // Vamos criar uma função para configurar as rotas
        const setupRoutes = (dbInstance, authInstance) => {
            // As rotas agora recebem 'db' e 'auth'
            const authRouter = require('./routes/auth')(dbInstance, authInstance);
            const feriasRouter = require('./routes/ferias')(dbInstance, authInstance);
            const funcionariosRouter = require('./routes/funcionarios')(dbInstance, authInstance);
            const episRouter = require('./routes/epis')(dbInstance, authInstance);
            const epiModuleRouter = require('./modules/epi/routes')(dbInstance, authInstance);
            const uniformesRouter = require('./routes/uniformes')(dbInstance, authInstance);
            const vagasRouter = require('./routes/vagas')(dbInstance, authInstance);
            const candidatosRouter = require('./routes/candidatos')(dbInstance, authInstance);
            const taxasRouter = require('./routes/taxas')(dbInstance, authInstance);
            const solicitacaoTaxaRouter = require('./routes/solicitacaoTaxa')(dbInstance, authInstance);
            const movimentacaoRouter = require('./routes/movimentacao')(dbInstance, authInstance);
            const portariaRouter = require('./routes/portaria')(dbInstance, authInstance);
            const rhRouter = require('./routes/rh')(dbInstance, authInstance);
            const recrutamentoRouter = require('./routes/recrutamento')(dbInstance, authInstance);
            const onthejobRouter = require('./routes/onthejob')(dbInstance, authInstance);
            const desligamentoRouter = require('./routes/desligamento')(dbInstance, authInstance);
            const avaliacaoRouter = require('./routes/avaliacao')(dbInstance, authInstance);
            const formulariosRouter = require('./routes/formularios')(dbInstance, authInstance);
            const usersRouter = require('./routes/users')(dbInstance, authInstance);
            const disciplinarRouter = require('./routes/disciplinar')(dbInstance, authInstance);

            // Montagem das rotas
            app.use('/api', authRouter);
            app.use('/api', feriasRouter);
            app.use('/api', funcionariosRouter);
            app.use('/api', episRouter);
            app.use('/api', epiModuleRouter);
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
        };

        // Chame a função para configurar as rotas
        setupRoutes(db, auth);


        const resolveProtectedHomeForUser = (req) => {
            const role = String(req.user && req.user.role || '').trim().toLowerCase();
            if (['gestor', 'lider', 'supervisor', 'gerente'].includes(role)) return '/protected/dashboard-gestor.html';
            if (role === 'portaria') return '/protected/dashboard-portaria.html?monitor=1';
            return '/protected/index.html';
        };

        app.get('/protected', auth.portalAuth, (req, res) => {
            res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.set('Pragma', 'no-cache');
            res.set('Expires', '0');
            const target = resolveProtectedHomeForUser(req);
            if (target === '/protected/index.html') {
                return res.sendFile(path.join(__dirname, 'protected/index.html'));
            }
            return res.redirect(target);
        });

        app.get('/protected/index.html', auth.portalAuth, (req, res) => {
            res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.set('Pragma', 'no-cache');
            res.set('Expires', '0');
            const target = resolveProtectedHomeForUser(req);
            if (target === '/protected/index.html') {
                return res.sendFile(path.join(__dirname, 'protected/index.html'));
            }
            return res.redirect(target);
        });

        app.use('/protected', auth.portalAuth, (req, res, next) => { // Usa 'auth' global
            if (process.env.SHOW_ALL_DASH === '1') return next();
            if (req.user && req.user.role === 'admin') return next();
            const pathname = req.path === '/' ? '/index.html' : req.path;
            if (pathname === '/dashboard-disciplinar.html') {
                return runMiddlewares([auth.checkRole([auth.ROLES.DP, auth.ROLES.RH_GERAL, auth.ROLES.RH, auth.ROLES.ADMIN])], req, res, next); // Usa 'auth' global
            }
            const allowedRoles = auth.PROTECTED_PAGE_ACCESS[pathname]; // Usa 'auth' global
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

        app.get('/rh', auth.rhAuth, (req, res) => res.sendFile(path.join(__dirname, 'protected/index.html'))); // Usa 'auth' global
        app.get('/dashboard-rh.html', auth.rhAuth, (req, res) => res.sendFile(path.join(__dirname, 'protected/dashboard-rh.html'))); // Usa 'auth' global
        app.get('/dashboard-vagas.html', auth.rhAuth, (req, res) => res.sendFile(path.join(__dirname, 'protected/dashboard-vagas.html'))); // Usa 'auth' global
        app.get('/dashboard-taxas.html', auth.portalAuth, (req, res) => res.redirect('/protected/dashboard-taxas.html')); // Usa 'auth' global
        app.get('/dashboard-candidatos.html', auth.rhAuth, (req, res) => res.sendFile(path.join(__dirname, 'protected/dashboard-candidatos.html'))); // Usa 'auth' global
        app.get('/dashboard-avaliacao.html', auth.expDashAuth, (req, res) => res.sendFile(path.join(__dirname, 'protected/dashboard-avaliacao.html'))); // Usa 'auth' global
        app.get('/dashboard-experiencia.html', auth.expDashAuth, (req, res) => res.sendFile(path.join(__dirname, 'protected/dashboard-experiencia.html'))); // Usa 'auth' global

        // ✅ Rota pública de busca — DEVE vir antes do app.use('/api', ...)
        app.get('/api/public/funcionarios/busca', async (req, res) => {
            try {
                // Aqui você pode usar a instância 'db' já inicializada
                const busca = String(req.query.busca || '').trim();
                if (busca.length < 3) return res.json([]);
                const todos = await db.funcionarios.getAll();
                const norm = (v) => String(v || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                const buscaNorm = norm(busca);
                const resultado = todos
                    .filter(f => f.ativo !== 0 && norm(f.nome).includes(buscaNorm))
                    .map(f => ({ id: f.id, nome: f.nome, cargo: f.cargo || '', setor: f.setor || '' }));
                return res.json(resultado);
            } catch (e) {
                console.error('Erro na busca pública de colaboradores:', e);
                return res.status(500).json([]);
            }
        });

        // --- Início do servidor ---
        let currentPort = parseInt(String(PORT), 10);
        if (!Number.isFinite(currentPort) || currentPort < 0 || currentPort >= 65536) currentPort = 8080;
        const allowPortFallback = String(process.env.ALLOW_PORT_FALLBACK || '').trim() === '1';
        let retries = allowPortFallback ? 5 : 0;

        function startListening() {
            const srv = app.listen(currentPort, HOST, () => {
                process.env.ACTUAL_PORT = String(currentPort);
                const ifaces = os.networkInterfaces();
                const lanIps = Object.values(ifaces).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
                console.log(`Servidor rodando na porta ${currentPort}`);
                console.log(`URL: http://localhost:${currentPort}/login.html`);
                console.log(`URL: http://127.0.0.1:${currentPort}/login.html`);
                lanIps.forEach((ip) => { console.log(`URL LAN: http://${ip}:${currentPort}/login.html`); });
            });
            srv.on('error', (err) => {
                if (err && err.code === 'EADDRINUSE') {
                    if (retries > 0) {
                        console.warn(`Porta ${currentPort} em uso. Tentando a próxima...`);
                        currentPort = Number(currentPort) + 1;
                        if (!Number.isFinite(currentPort) || currentPort >= 65536) { console.error(`Porta inválida calculada. Abortando.`); process.exit(1); }
                        retries -= 1;
                        setTimeout(startListening, 100);
                        return;
                    }
                    console.error(`Porta ${currentPort} já está em uso.`);
                    process.exit(1);
                }
                console.error(err);
                process.exit(1);
            });
        }
        startListening(); // Inicia o listener do servidor
        // --- Fim do servidor ---

    } catch (error) {
        console.error('❌ Erro fatal ao iniciar o servidor:', error.message);
        process.exit(1);
    }
}

startServer(); // Chama a função principal para iniciar tudo
