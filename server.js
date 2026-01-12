require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const xss = require('xss-clean');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 8080;

// Security Middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.sheetjs.com", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
            scriptSrcAttr: ["'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'", "https://cdn.sheetjs.com", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "http://localhost:*", "ws://localhost:*", "http://127.0.0.1:*", "ws://127.0.0.1:*"],
            objectSrc: ["'none'"],
        },
    },
    hsts: false // Disable HSTS for local development to prevent SSL errors on localhost
}));

// Data Sanitization against XSS
app.use(xss());

// Cookie Parser
app.use(cookieParser());

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: 'Muitas requisições, tente novamente mais tarde.'
});
app.use(limiter);

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
// Public Routes (Login, etc)
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// Routes
const authRouter = require('./routes/auth');
const feriasRouter = require('./routes/ferias');
const funcionariosRouter = require('./routes/funcionarios');
const episRouter = require('./routes/epis');
const uniformesRouter = require('./routes/uniformes');
const vagasRouter = require('./routes/vagas');
const candidatosRouter = require('./routes/candidatos');
const taxasRouter = require('./routes/taxas');
const movimentacaoRouter = require('./routes/movimentacao');
const portariaRouter = require('./routes/portaria');
const rhRouter = require('./routes/rh');
const recrutamentoRouter = require('./routes/recrutamento');
const onthejobRouter = require('./routes/onthejob');
const desligamentoRouter = require('./routes/desligamento');
const avaliacaoRouter = require('./routes/avaliacao');
const formulariosRouter = require('./routes/formularios');
const usersRouter = require('./routes/users');

// Protected HTML Routes (Redirect to static or serve directly)
const { rhAuth, portariaAuth } = require('./middleware/auth');

// Middleware de Autenticação (JWT)
// Substitui a proteção estática anterior pelo middleware verifyToken
app.use('/protected', rhAuth, express.static(path.join(__dirname, 'protected')));

app.get('/rh', rhAuth, (req, res) => res.sendFile(path.join(__dirname, 'protected/index.html')));

// Legacy Redirects
app.get('/dashboard-rh.html', rhAuth, (req, res) => res.sendFile(path.join(__dirname, 'protected/dashboard-rh.html')));
app.get('/dashboard-vagas.html', rhAuth, (req, res) => res.sendFile(path.join(__dirname, 'protected/dashboard-vagas.html')));
app.get('/dashboard-taxas.html', rhAuth, (req, res) => res.sendFile(path.join(__dirname, 'protected/dashboard-taxas.html')));
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
app.use('/api', movimentacaoRouter);
app.use('/api', portariaRouter);
app.use('/api', rhRouter);
app.use('/api', recrutamentoRouter);
app.use('/api', onthejobRouter);
app.use('/api', desligamentoRouter);
app.use('/api', avaliacaoRouter);
app.use('/api', usersRouter);
app.use('/api/rh/formularios', formulariosRouter);

// Start Server
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
