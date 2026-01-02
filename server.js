const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const basicAuth = require('express-basic-auth');
const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const pdfService = require('./services/pdfService');

const LOGO_PATH = path.join(__dirname, 'assets', 'logo.png');

dotenv.config();

const app = express();

// --- Segurança Básica (Helmet) ---
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.sheetjs.com", "https://cdnjs.cloudflare.com"], // unsafe-inline necessário para scripts inline simples se houver
            scriptSrcAttr: ["'unsafe-inline'"], // Permite event handlers inline como onclick
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "blob:"], // data: necessário para imagens base64
            connectSrc: ["'self'", "https://cdn.sheetjs.com", "http://localhost:8080", "ws://localhost:8080"],
            objectSrc: ["'none'"],
        },
    },
}));

// --- Rate Limiting ---
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: 'Muitas requisições, tente novamente mais tarde.'
});
app.use(limiter);

const candidatoLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 10, // 10 requisições por IP
    message: 'Muitas tentativas de cadastro. Tente novamente em 1 hora.'
});

app.use(cors());
app.use(express.json({ limit: '10mb' })); // Aumentado para suportar imagens base64
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// --- Middleware de Autenticação RH ---
const rhAuth = basicAuth({
    users: { [process.env.RH_USER || 'admin']: process.env.RH_PASS || 'admin123' },
    challenge: true,
    realm: 'Painel RH'
});

// --- Middleware de Autenticação Portaria ---
const portariaAuth = basicAuth({
    users: { [process.env.PORTARIA_USER || 'portaria']: process.env.PORTARIA_PASS || 'portaria123' },
    challenge: true,
    realm: 'Painel Portaria'
});

app.get('/protected/dashboard-portaria.html', portariaAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'protected', 'dashboard-portaria.html'));
});

app.get('/protected/dashboard-funcionarios.html', rhAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'protected', 'dashboard-funcionarios.html'));
});

// Rota protegida para servir o Portal RH (Home Unificada)
app.get('/rh', rhAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'protected', 'index.html'));
});

app.get('/protected/index.html', rhAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'protected', 'index.html'));
});

app.get('/protected/dashboard-rh.html', rhAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'protected', 'dashboard-rh.html'));
});

app.get('/protected/dashboard-taxas.html', rhAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'protected', 'dashboard-taxas.html'));
});

app.get('/protected/dashboard-candidatos.html', rhAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'protected', 'dashboard-candidatos.html'));
});

app.get('/protected/dashboard-vagas.html', rhAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'protected', 'dashboard-vagas.html'));
});

app.get('/protected/dashboard-onthejob.html', rhAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'protected', 'dashboard-onthejob.html'));
});

// Mantendo rotas antigas para compatibilidade (mas agora redirecionando ou servindo o arquivo correto)
app.get('/dashboard-rh.html', rhAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'protected', 'dashboard-rh.html'));
});

// Rota protegida para servir o dashboard de Vagas
app.get('/dashboard-vagas.html', rhAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'protected', 'dashboard-vagas.html'));
});

// Rota protegida para servir o dashboard de Taxas
app.get('/dashboard-taxas.html', rhAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'protected', 'dashboard-taxas.html'));
});

// Rota protegida para servir o dashboard de Candidatos
app.get('/dashboard-candidatos.html', rhAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'protected', 'dashboard-candidatos.html'));
});

app.get('/protected/dashboard-epis.html', rhAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'protected', 'dashboard-epis.html'));
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/assets', express.static('assets'));

const DB_PATH = path.join(__dirname, 'data', 'solicitacoes.json');
const FUNCIONARIOS_DB_PATH = path.join(__dirname, 'data', 'funcionarios.json');

function readFuncionariosDB() {
    if (!fs.existsSync(FUNCIONARIOS_DB_PATH)) return [];
    try {
        const data = fs.readFileSync(FUNCIONARIOS_DB_PATH, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        console.error('Erro ao ler DB Funcionarios:', e);
        return [];
    }
}

function writeFuncionariosDB(data) {
    try {
        fs.writeFileSync(FUNCIONARIOS_DB_PATH, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Erro ao salvar DB Funcionarios:', e);
    }
}

function readDB() {
    if (!fs.existsSync(DB_PATH)) return [];
    try {
        const data = fs.readFileSync(DB_PATH, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        console.error('Erro ao ler DB:', e);
        return [];
    }
}

function writeDB(data) {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Erro ao salvar DB:', e);
    }
}

const VAGAS_DB_PATH = path.join(__dirname, 'data', 'vagas.json');
const TAXAS_DB_PATH = path.join(__dirname, 'data', 'taxas.json');
const CANDIDATOS_DB_PATH = path.join(__dirname, 'data', 'candidatos.json');
const EPIS_DB_PATH = path.join(__dirname, 'data', 'epis.json');

const MOVIMENTACOES_EPIS_DB_PATH = path.join(__dirname, 'data', 'movimentacoes_epis.json');
const DESCONTOS_EPIS_DB_PATH = path.join(__dirname, 'data', 'descontos_epis.json');

function readMovimentacoesEpisDB() {
    if (!fs.existsSync(MOVIMENTACOES_EPIS_DB_PATH)) return [];
    try {
        const data = fs.readFileSync(MOVIMENTACOES_EPIS_DB_PATH, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        console.error('Erro ao ler DB Movimentacoes EPIs:', e);
        return [];
    }
}

function writeMovimentacoesEpisDB(data) {
    try {
        fs.writeFileSync(MOVIMENTACOES_EPIS_DB_PATH, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Erro ao salvar DB Movimentacoes EPIs:', e);
    }
}

function readDescontosEpisDB() {
    if (!fs.existsSync(DESCONTOS_EPIS_DB_PATH)) return [];
    try {
        const data = fs.readFileSync(DESCONTOS_EPIS_DB_PATH, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        console.error('Erro ao ler DB Descontos EPIs:', e);
        return [];
    }
}

function writeDescontosEpisDB(data) {
    try {
        fs.writeFileSync(DESCONTOS_EPIS_DB_PATH, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Erro ao salvar DB Descontos EPIs:', e);
    }
}

function readVagasDB() {
    if (!fs.existsSync(VAGAS_DB_PATH)) return [];
    try {
        const data = fs.readFileSync(VAGAS_DB_PATH, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        console.error('Erro ao ler DB Vagas:', e);
        return [];
    }
}

function readCandidatosDB() {
    if (!fs.existsSync(CANDIDATOS_DB_PATH)) return [];
    try {
        const data = fs.readFileSync(CANDIDATOS_DB_PATH, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        console.error('Erro ao ler DB Candidatos:', e);
        return [];
    }
}

function writeVagasDB(data) {
    try {
        fs.writeFileSync(VAGAS_DB_PATH, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Erro ao salvar DB Vagas:', e);
    }
}

function writeCandidatosDB(data) {
    try {
        fs.writeFileSync(CANDIDATOS_DB_PATH, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Erro ao salvar DB Candidatos:', e);
    }
}

function readEpisDB() {
    if (!fs.existsSync(EPIS_DB_PATH)) return [];
    try {
        const data = fs.readFileSync(EPIS_DB_PATH, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        console.error('Erro ao ler DB EPIs:', e);
        return [];
    }
}

function writeEpisDB(data) {
    try {
        fs.writeFileSync(EPIS_DB_PATH, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Erro ao salvar DB EPIs:', e);
    }
}

function readTaxasDB() {
    if (!fs.existsSync(TAXAS_DB_PATH)) return [];
    try {
        const data = fs.readFileSync(TAXAS_DB_PATH, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        console.error('Erro ao ler DB Taxas:', e);
        return [];
    }
}

function writeTaxasDB(data) {
    try {
        fs.writeFileSync(TAXAS_DB_PATH, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Erro ao salvar DB Taxas:', e);
    }
}

const tiposGozoPermitidos = new Set(['20', '20+10', '30', '15+15']);

function validarPayload(p) {
  if (!p) return { ok: false, erro: 'Dados ausentes' };
  const { nome, setor, inicio, inicio2, tipoGozo, decimo, statusRH, sugestaoData, assinatura } = p;
  if (!nome || !setor || !inicio || !tipoGozo) return { ok: false, erro: 'Campos obrigatórios ausentes' };
  if (!tiposGozoPermitidos.has(String(tipoGozo))) return { ok: false, erro: 'Período de férias inválido' };
  const d = new Date(inicio);
  if (Number.isNaN(d.getTime())) return { ok: false, erro: 'Data inválida' };
  if (String(tipoGozo).includes('+') && tipoGozo !== '20+10') {
    if (!inicio2) return { ok: false, erro: 'Informe o segundo período' };
    const d2 = new Date(inicio2);
    if (Number.isNaN(d2.getTime())) return { ok: false, erro: 'Data do segundo período inválida' };
  }
  if (assinatura) {
    const hasBase64Prefix = typeof assinatura === 'string' && assinatura.startsWith('data:image/');
    if (!hasBase64Prefix) return { ok: false, erro: 'Assinatura inválida' };
  }
  return { ok: true };
}





async function enviarEmailComPDF(buffer, filename, payload) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = String(process.env.SMTP_SECURE || 'false') === 'true';
  const to = process.env.DP_EMAIL;
  const from = process.env.MAIL_FROM || user;

  const subject = `Solicitação de Férias – ${payload.nome} (${payload.statusRH === 'aprovado' ? 'APROVADO' : 'REPROVADO'})`;
  const text = `Nome: ${payload.nome}\nSetor: ${payload.setor}\nInício: ${new Date(payload.inicio).toLocaleDateString('pt-BR')}\nStatus: ${payload.statusRH === 'aprovado' ? 'APROVADO' : 'REPROVADO'}`;

  if (!host || !port || !user || !pass || !to) {
    console.log('--- EMAIL MOCK (PDF) ---');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Text: ${text}`);
    return { ok: true, mock: true };
  }
  const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
  
  try {
     await transporter.sendMail({ from, to, subject, text, attachments: [{ filename, content: buffer }] });
     return { ok: true };
  } catch (e) {
     console.error('Erro ao enviar email real:', e);
     return { ok: false, erro: e.message };
  }
}

async function notificarGestor(payload, protocol) {
  console.log('DEBUG: notificarGestor called', { id: payload.id, protocol, statusRH: payload.statusRH });
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = String(process.env.SMTP_SECURE || 'false') === 'true';
  const from = process.env.MAIL_FROM || user;
  const to = payload.gestorEmail;
  
  const aprovado = payload.statusRH === 'aprovado';
  const subject = `Status Solicitação de Férias – ${payload.nome}`;
  let text = '';
  
  if (aprovado) {
    if (payload.status === 'aguardando_assinatura') {
        text = `Olá,\n\nA solicitação de férias para ${payload.nome} foi APROVADA pelo RH.\n\nPor favor, compareça ao RH com o colaborador para assinatura dos documentos e finalização do processo.`;
    } else {
        text = `Olá,\n\nA solicitação de férias para ${payload.nome} foi APROVADA e ASSINADA.\n\nO processo foi concluído com sucesso.`;
    }
  } else {
    const sug = payload.sugestaoData ? new Date(payload.sugestaoData).toLocaleDateString('pt-BR') : 'A definir';
    
    // Gera link de edição se tivermos ID e protocol
    let linkEdicao = '';
    if (payload.id && protocol) {
        const baseUrl = `${protocol}://${process.env.BASE_URL || 'localhost:8080'}`;
        linkEdicao = `\n\nPara ajustar a solicitação e reenviar, clique aqui: ${baseUrl}/ferias.html?id=${payload.id}`;
    }

    text = `Olá,\n\nA solicitação de férias para ${payload.nome} foi REPROVADA pelo RH.\n\nSugestão de nova data: ${sug}.`;
    
    if (payload.justificativa) {
        text += `\n\nJustificativa: ${payload.justificativa}`;
    }

    text += `\n\nFavor realizar as alterações necessárias.${linkEdicao}`;
  }

  if (!host || !port || !user || !pass || !to) {
    console.log('--- EMAIL MOCK (Gestor) ---');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Text: ${text}`);
    return { ok: true, mock: true };
  }

  const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });

  try {
    await transporter.sendMail({ from, to, subject, text });
    return { ok: true };
  } catch (e) {
    console.error('Erro ao enviar email gestor:', e);
    return { ok: false };
  }
}

async function enviarAutentique(buffer, filename, overrideEmail) {
  const token = process.env.AUTENTIQUE_TOKEN;
  const emailOk = (e) => typeof e === 'string' && /[^\s@]+@[^\s@]+\.[^\s@]+/.test(e);
  const gestorEmail = emailOk(overrideEmail) ? overrideEmail : process.env.GESTOR_EMAIL;
  const rhEmail = process.env.DP_EMAIL;
  const sandbox = String(process.env.AUTENTIQUE_SANDBOX || 'true') === 'true';
  
  if (!token) {
      console.log('--- AUTENTIQUE MOCK ---');
      console.log(`To (Gestor): ${gestorEmail}`);
      console.log(`To (RH): ${rhEmail}`);
      console.log(`Document: ${filename}`);
      const mockLink = 'https://sandbox.autentique.com.br/documento/mock-uuid';
      console.log(`Link: ${mockLink}`);
      return { ok: true, link: mockLink };
  }

  if (!gestorEmail) return { ok: false };
  
  const signers = [{ email: gestorEmail, action: 'SIGN' }];
  if (emailOk(rhEmail)) {
      signers.push({ email: rhEmail, action: 'SIGN' });
  }

  const operations = {
    query:
      'mutation CreateDocument($document: DocumentInput!, $signers: [SignerInput!]!, $file: Upload!) { createDocument(sandbox: ' + (sandbox ? 'true' : 'false') + ', document: $document, signers: $signers, file: $file) { id name signatures { link { short_link } } } }',
    variables: {
      document: { name: filename },
      signers: signers,
      file: null
    }
  };
  const form = new FormData();
  form.append('operations', JSON.stringify(operations));
  form.append('map', JSON.stringify({ file: ['variables.file'] }));
  form.append('file', buffer, { filename, contentType: 'application/pdf' });
  const res = await axios.post('https://api.autentique.com.br/v2/graphql', form, { headers: { Authorization: `Bearer ${token}`, ...form.getHeaders() } });
  const data = res.data;
  const link = data && data.data && data.data.createDocument && data.data.createDocument.signatures && data.data.createDocument.signatures[0] && data.data.createDocument.signatures[0].link && data.data.createDocument.signatures[0].link.short_link;
  return { ok: true, link: link || null };
}

async function enviarLinkRH(payload, protocol, id) {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const secure = String(process.env.SMTP_SECURE || 'false') === 'true';
    const to = process.env.DP_EMAIL;
    const from = process.env.MAIL_FROM || user;

    // Constrói query string com ID
    const params = new URLSearchParams();
    params.append('mode', 'rh');
    params.append('id', id);

    const baseUrl = `${protocol}://${process.env.BASE_URL || 'localhost:8080'}`;
    const link = `${baseUrl}/ferias.html?${params.toString()}`;

    const subject = `Nova Solicitação de Férias – ${payload.nome}`;
    const text = `Recebida nova solicitação de férias para ${payload.nome} (${payload.setor}).\n\nClique no link abaixo para validar:\n\n${link}`;

    if (!host || !port || !user || !pass || !to) {
     console.log('--- EMAIL MOCK (Link RH) ---');
     console.log(`To: ${to}`);
     console.log(`Subject: ${subject}`);
     console.log(`Text: ${text}`);
     return { ok: true, mock: true, link };
  }
  const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
  
  await transporter.sendMail({ from, to, subject, text });
  return { ok: true, link };
}

async function enviarEmailTaxasRH(payload) {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const secure = String(process.env.SMTP_SECURE || 'false') === 'true';
    const to = process.env.DP_EMAIL;
    const from = process.env.MAIL_FROM || user;

    const subject = `Nova Solicitação de Pagamento de Taxa – ${payload.nome_taxa}`;
    const text = `Recebida nova solicitação de pagamento de taxa para ${payload.nome_taxa} (${payload.funcao}).\n\nDepartamento: ${payload.departamento}\nTotal: R$ ${payload.valores?.total_geral || '0.00'}\n\nAcesse o painel do RH para visualizar.`;

    if (!host || !port || !user || !pass || !to) {
        console.log('--- EMAIL MOCK (Taxas RH) ---');
        console.log(`To: ${to}`);
        console.log(`Subject: ${subject}`);
        console.log(`Text: ${text}`);
        return { ok: true, mock: true };
    }
    const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });

    try {
        await transporter.sendMail({ from, to, subject, text });
        return { ok: true };
    } catch (e) {
        console.error('Erro ao enviar email Taxas RH:', e);
        return { ok: false, erro: e.message };
    }
}

// --- Rotas API ---

// Gestão de Funcionários (RH)
app.get('/api/rh/funcionarios', rhAuth, (req, res) => {
    const funcionarios = readFuncionariosDB();
    res.json(funcionarios);
});

app.post('/api/rh/funcionarios/importar', rhAuth, (req, res) => {
    try {
        const { funcionarios } = req.body;
        if (!Array.isArray(funcionarios)) {
            return res.status(400).json({ ok: false, erro: 'Formato inválido' });
        }

        const db = readFuncionariosDB();
        let novos = 0;
        let atualizados = 0;

        funcionarios.forEach(f => {
            const idx = db.findIndex(existing => existing.cpf === f.cpf);
            if (idx >= 0) {
                // Atualiza existente preservando ID
                db[idx] = { ...db[idx], ...f };
                atualizados++;
            } else {
                // Cria novo
                db.push({
                    id: crypto.randomUUID(),
                    ...f
                });
                novos++;
            }
        });

        writeFuncionariosDB(db);
        res.json({ ok: true, novos, atualizados });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao importar funcionários' });
    }
});

app.delete('/api/rh/funcionarios/:id', rhAuth, (req, res) => {
    try {
        const db = readFuncionariosDB();
        const novoDb = db.filter(f => f.id !== req.params.id);
        
        if (db.length === novoDb.length) {
            return res.status(404).json({ ok: false, erro: 'Funcionário não encontrado' });
        }

        writeFuncionariosDB(novoDb);
        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao excluir funcionário' });
    }
});

// Gestão de EPIs (RH)
app.get('/api/rh/epis', rhAuth, (req, res) => {
    const epis = readEpisDB();
    res.json(epis);
});

app.post('/api/rh/epis', rhAuth, (req, res) => {
    try {
        const { nome, valor } = req.body;
        if (!nome || !valor) return res.status(400).json({ ok: false, erro: 'Dados incompletos' });

        const db = readEpisDB();
        const novoEpi = {
            id: crypto.randomUUID(),
            nome,
            valor: parseFloat(valor),
            createdAt: new Date().toISOString()
        };
        
        db.push(novoEpi);
        writeEpisDB(db);

        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao criar EPI' });
    }
});

app.delete('/api/rh/epis/:id', rhAuth, (req, res) => {
    try {
        const db = readEpisDB();
        const idx = db.findIndex(i => i.id == req.params.id); // == to catch string/number
        if (idx === -1) return res.status(404).json({ ok: false, erro: 'EPI não encontrado' });

        db.splice(idx, 1);
        writeEpisDB(db);

        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao remover EPI' });
    }
});

app.get('/api/solicitacao/:id', (req, res) => {
    const db = readDB();
    const item = db.find(i => i.id === req.params.id);
    if (!item) return res.status(404).json({ ok: false, erro: 'Solicitação não encontrada' });
    res.json(item);
});

app.get('/api/rh/solicitacoes', rhAuth, (req, res) => {
    console.log('DEBUG: GET /api/rh/solicitacoes');
    try {
        const db = readDB();
        // Retorna todas as solicitações relevantes para o RH
        // Ordena: pendentes primeiro, depois por data de criação (mais recentes primeiro para histórico)
        const lista = db
            .filter(i => ['pendente_rh', 'aguardando_assinatura', 'concluido', 'reprovado'].includes(i.status))
            .sort((a, b) => {
                // Prioridade para pendente_rh
                if (a.status === 'pendente_rh' && b.status !== 'pendente_rh') return -1;
                if (a.status !== 'pendente_rh' && b.status === 'pendente_rh') return 1;
                // Depois por data (mais recentes primeiro)
                return new Date(b.createdAt) - new Date(a.createdAt);
            });
        
        res.json(lista);
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao listar solicitações' });
    }
});

app.get('/api/pdf/:id', async (req, res) => {
    try {
        const db = readDB();
        const item = db.find(i => i.id === req.params.id);
        if (!item) return res.status(404).send('Solicitação não encontrada');
        
        const buffer = await pdfService.pdfBufferFromData(item);
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Ferias_${item.nome.replace(/\s+/g, '_')}.pdf`);
        res.send(buffer);
    } catch (e) {
        console.error(e);
        res.status(500).send('Erro ao gerar PDF');
    }
});

app.post('/api/encaminhar', async (req, res) => {
    // Validação básica
    const { nome, setor, inicio, tipoGozo, id: existingId } = req.body;
    if (!nome || !setor || !inicio || !tipoGozo) return res.status(400).json({ ok: false, erro: 'Campos obrigatórios ausentes' });

    try {
        const db = readDB();
        let id = existingId;
        let isUpdate = false;

        // Se ID foi fornecido, verifica se existe para atualizar
        if (id) {
            const idx = db.findIndex(i => i.id === id);
            if (idx !== -1) {
                // Atualiza existente
                const historicoItem = {
                    data: new Date().toISOString(),
                    acao: 'reenvio',
                    ator: 'Solicitante'
                };
                const historico = db[idx].historico || [];
                historico.push(historicoItem);

                db[idx] = {
                    ...db[idx],
                    ...req.body,
                    status: 'pendente_rh', // Reseta status
                    statusRH: undefined,   // Limpa aprovação anterior
                    sugestaoData: undefined,
                    historico,
                    updatedAt: new Date().toISOString()
                };
                isUpdate = true;
            } else {
                // ID não encontrado, gera novo
                id = crypto.randomUUID();
            }
        } else {
            id = crypto.randomUUID();
        }

        if (!isUpdate) {
            const novaSolicitacao = {
                id,
                ...req.body,
                status: 'pendente_rh',
                createdAt: new Date().toISOString(),
                historico: [{
                    data: new Date().toISOString(),
                    acao: 'pendente_rh',
                    ator: 'Solicitante'
                }]
            };
            db.push(novaSolicitacao);
        }

        writeDB(db);

        const result = await enviarLinkRH(req.body, req.protocol, id);
        
        // Em modo de desenvolvimento/mock, retorna o link gerado para facilitar testes
        const mockLink = result.link;

        if (result.ok) {
            // Log do link no console para o desenvolvedor
            if (result.mock) {
                console.log('--- LINK RH GERADO ---');
                console.log(mockLink);
            }

            return res.json({ ok: true, mensagem: isUpdate ? 'Solicitação atualizada e reencaminhada ao RH' : 'Encaminhado ao RH' });
        } else {
            return res.status(500).json({ ok: false, erro: 'Falha ao enviar email ao RH' });
        }
    } catch (e) {
        console.error(e);
        return res.status(500).json({ ok: false, erro: 'Erro interno' });
    }
});

app.post('/api/solicitacao', async (req, res) => {
  const valid = validarPayload(req.body);
  if (!valid.ok) return res.status(400).json({ ok: false, erro: valid.erro });
  try {
    let currentStatus = 'concluido';
    
    // Atualiza DB se ID estiver presente
    if (req.body.id) {
        const db = readDB();
        const idx = db.findIndex(i => i.id === req.body.id);
        if (idx !== -1) {
            // Lógica de Estado
            if (req.body.statusRH === 'aprovado' && !req.body.assinatura) {
                currentStatus = 'aguardando_assinatura';
            } else if (req.body.statusRH === 'reprovado') {
                currentStatus = 'reprovado';
            } else {
                currentStatus = 'concluido';
            }

            const historicoItem = {
                data: new Date().toISOString(),
                acao: req.body.statusRH || 'alteracao',
                justificativa: req.body.justificativa,
                ator: 'RH'
            };
            const historico = db[idx].historico || [];
            historico.push(historicoItem);

            db[idx] = { 
                ...db[idx], 
                ...req.body, 
                status: currentStatus,
                historico,
                updatedAt: new Date().toISOString() 
            };
            writeDB(db);
        }
    } else {
         // Fallback para legado
         const id = crypto.randomUUID();
         req.body.id = id;
         const db = readDB();
         db.push({ id, ...req.body, status: 'finalizado_sem_id_origem', createdAt: new Date().toISOString() });
         writeDB(db);
    }

    // Se estiver aguardando assinatura, NÃO gera PDF final, apenas notifica gestor
    if (currentStatus === 'aguardando_assinatura') {
        await notificarGestor({ ...req.body, status: currentStatus }, req.protocol || 'http');
        return res.json({ ok: true, mensagem: 'Aprovação registrada. Aguardando assinatura.' });
    }

    const pdfBuffer = await pdfService.pdfBufferFromData(req.body);
    const filename = `${req.body.nome.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
    const emailResult = await enviarEmailComPDF(pdfBuffer, filename, req.body);
    
    // Notifica gestor sobre a decisao final
    await notificarGestor({ ...req.body, status: currentStatus }, req.protocol || 'http');

    let autentiqueResult = { ok: false, msg: 'Não enviado (reprovado)' };
    if (req.body.statusRH === 'aprovado') {
       autentiqueResult = await enviarAutentique(pdfBuffer, filename, req.body.gestorEmail);
    }

    return res.json({ ok: true, mensagem: 'Solicitação processada com sucesso', email: emailResult.ok, autentique: autentiqueResult });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, erro: 'Falha ao processar solicitação' });
  }
});

app.get('/api/rh/vagas', rhAuth, (req, res) => {
    try {
        const db = readVagasDB();
        const lista = db.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        res.json(lista);
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao listar vagas' });
    }
});

// --- Rotas Taxas ---

app.get('/api/funcionarios', (req, res) => {
    const db = readFuncionariosDB();
    res.json(db);
});

// Rota para salvar rascunho (auto-save)
app.post('/api/taxas/draft', async (req, res) => {
    try {
        const payload = req.body;
        const db = readTaxasDB();
        let id = payload.id;
        
        // Se já tem ID, atualiza
        if (id) {
            const idx = db.findIndex(i => i.id === id);
            if (idx !== -1) {
                db[idx] = { ...db[idx], ...payload, updatedAt: new Date().toISOString() };
                writeTaxasDB(db);
                return res.json({ ok: true, id });
            }
        }

        // Se não tem ID ou não achou, cria novo como rascunho
        id = id || crypto.randomUUID();
        const novoRascunho = {
            id,
            ...payload,
            status: 'rascunho',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        db.push(novoRascunho);
        writeTaxasDB(db);
        
        res.json({ ok: true, id });
    } catch (e) {
        console.error('Erro ao salvar rascunho:', e);
        res.status(500).json({ ok: false, erro: 'Erro ao salvar rascunho' });
    }
});

app.post('/api/taxas', async (req, res) => {
    try {
        const payload = req.body;
        // Basic validation
        if (!payload.nome_taxa || !payload.cpf || !payload.valores) {
            return res.status(400).json({ message: 'Dados incompletos.' });
        }

        const db = readTaxasDB();
        let id = payload.id;
        
        // Se já existe ID (rascunho), usamos ele, senão criamos novo
        if (id) {
            // Verificar se existe para atualizar status
            const idx = db.findIndex(i => i.id === id);
            if (idx !== -1) {
                // Atualiza o existente
                 db[idx] = {
                    ...db[idx],
                    ...payload,
                    status: 'pendente', // Muda de rascunho para pendente
                    updatedAt: new Date().toISOString()
                };
            } else {
                // ID veio mas não achou (estranho, mas tratamos como novo)
                const novaSolicitacao = {
                    id,
                    ...payload,
                    status: 'pendente',
                    createdAt: new Date().toISOString()
                };
                db.push(novaSolicitacao);
            }
        } else {
             id = crypto.randomUUID();
             const novaSolicitacao = {
                id,
                ...payload,
                status: 'pendente',
                createdAt: new Date().toISOString()
            };
            db.push(novaSolicitacao);
        }
        
        writeTaxasDB(db);

        // Salvar/Atualizar dados do funcionário para auto-preenchimento
        try {
            const funcionarios = readFuncionariosDB();
            // Normaliza CPF para busca (remove caracteres não numéricos)
            const cpfLimpo = payload.cpf ? payload.cpf.replace(/\D/g, '') : '';
            
            if (cpfLimpo) {
                const index = funcionarios.findIndex(f => f.cpf && f.cpf.replace(/\D/g, '') === cpfLimpo);
                
                const dadosFuncionario = {
                    id: index !== -1 ? funcionarios[index].id : crypto.randomUUID(),
                    nome: payload.nome_taxa,
                    cpf: payload.cpf,
                    funcao: payload.funcao,
                    departamento: payload.departamento,
                    banco: payload.banco,
                    agencia: payload.agencia,
                    conta: payload.conta,
                    tipo_conta: payload.tipo_conta,
                    chave_pix: payload.pix,
                    updatedAt: new Date().toISOString()
                };

                if (index !== -1) {
                    funcionarios[index] = { ...funcionarios[index], ...dadosFuncionario };
                } else {
                    funcionarios.push({ ...dadosFuncionario, createdAt: new Date().toISOString() });
                }
                writeFuncionariosDB(funcionarios);
            }
        } catch (e) {
            console.error('Erro ao salvar dados do funcionario:', e);
        }

        // Notificar RH
        await enviarEmailTaxasRH(db.find(i => i.id === id));

        res.json({ message: 'Solicitação enviada com sucesso!', id });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Erro interno no servidor.' });
    }
});

app.get('/api/rh/taxas', rhAuth, (req, res) => {
    const db = readTaxasDB();
    res.json(db);
});

// Aprovar Taxa
app.post('/api/rh/taxas/:id/aprovar', rhAuth, (req, res) => {
    const db = readTaxasDB();
    const idx = db.findIndex(i => i.id === req.params.id);
    if (idx === -1) return res.status(404).json({ message: 'Taxa não encontrada' });
    
    db[idx].status = 'aprovado';
    db[idx].updatedAt = new Date().toISOString();
    writeTaxasDB(db);
    res.json({ message: 'Aprovado com sucesso' });
});

// Reprovar Taxa
app.post('/api/rh/taxas/:id/reprovar', rhAuth, (req, res) => {
    const db = readTaxasDB();
    const idx = db.findIndex(i => i.id === req.params.id);
    if (idx === -1) return res.status(404).json({ message: 'Taxa não encontrada' });
    
    db[idx].status = 'reprovado';
    db[idx].updatedAt = new Date().toISOString();
    writeTaxasDB(db);
    res.json({ message: 'Reprovado com sucesso' });
});

// Gerar Arquivo de Pagamento (Simples TXT/CSV para exemplo)
app.get('/api/rh/taxas/arquivo-pagamento', rhAuth, (req, res) => {
    const db = readTaxasDB();
    const aprovadas = db.filter(i => i.status === 'aprovado');
    
    if (aprovadas.length === 0) return res.status(400).send('Nenhuma taxa aprovada para pagamento.');

    // Formato CSV simples: Nome,CPF,Banco,Agencia,Conta,Valor,FormaPagamento,Pix
    let csvContent = "Nome;CPF;Banco;Agencia;Conta;Valor;FormaPagamento;ChavePix;Departamento\n";
    
    aprovadas.forEach(item => {
        const valor = item.valores?.total_geral || '0.00';
        const forma = item.forma_pagamento || '';
        const pix = item.pix || '';
        const banco = item.banco || '';
        const agencia = item.agencia || '';
        const conta = item.conta || '';
        
        csvContent += `${item.nome_taxa};${item.cpf};${banco};${agencia};${conta};${valor};${forma};${pix};${item.departamento}\n`;
    });

    res.set({
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="remessa_pagamentos_${new Date().toISOString().split('T')[0]}.csv"`
    });
    res.send(csvContent);
});

app.get('/api/taxas/pdf/:id', async (req, res) => {
    const db = readTaxasDB();
    const item = db.find(i => i.id === req.params.id);
    if (!item) return res.status(404).send('Solicitação não encontrada');

    try {
        const buffer = await pdfService.pdfBufferFromTaxaData(item);
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="taxa-${item.nome_taxa}.pdf"`
        });
        res.send(buffer);
    } catch (e) {
        console.error(e);
        res.status(500).send('Erro ao gerar PDF');
    }
});

async function notificarGestorVaga(vaga, status, justificativa) {
    // Configurações de email (mesmas do resto do sistema)
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM || '"RH Madalosso" <rh@familiamadalosso.com.br>';

    const to = vaga.email_gestor;
    if (!to) {
        console.log('Sem email de gestor para notificar na vaga', vaga.id);
        return { ok: false, erro: 'Email não informado' };
    }

    const isAprovado = status === 'aprovada';
    const subject = isAprovado 
        ? `Vaga Aprovada – ${vaga.cargo}` 
        : `Vaga Rejeitada – ${vaga.cargo}`;
        
    let text = `Olá,\n\nA solicitação de vaga para o cargo de ${vaga.cargo} foi analisada pelo RH.\n\n`;
    text += `Status: ${status.toUpperCase()}\n`;
    
    if (justificativa) {
        text += `Justificativa/Observação: ${justificativa}\n`;
    }

    if (isAprovado) {
        text += `\nPróximos passos serão alinhados em breve.`;
    }

    if (!host || !port || !user || !pass) {
        console.log('--- EMAIL MOCK (Vagas) ---');
        console.log(`To: ${to}`);
        console.log(`Subject: ${subject}`);
        console.log(`Text: ${text}`);
        return { ok: true, mock: true };
    }

    try {
        const transporter = nodemailer.createTransport({ host, port, secure: false, auth: { user, pass } });
        await transporter.sendMail({ from, to, subject, text });
        return { ok: true };
    } catch (e) {
        console.error('Erro ao enviar email vaga:', e);
        return { ok: false, erro: e.message };
    }
}

app.post('/api/vagas/avaliar', rhAuth, async (req, res) => {
    try {
        const { id, status, justificativa } = req.body;
        if (!id || !status) {
            return res.status(400).json({ ok: false, erro: 'ID e Status obrigatórios' });
        }

        const db = readVagasDB();
        const idx = db.findIndex(i => i.id === id);
        if (idx === -1) {
            return res.status(404).json({ ok: false, erro: 'Vaga não encontrada' });
        }

        db[idx].status = status; // aprovada, rejeitada
        db[idx].justificativa_rh = justificativa;
        
        // Se rejeitada, marca como não ativa
        if (status === 'rejeitada' || status === 'reprovada') {
            db[idx].ativa = false;
        } else if (status === 'aprovada') {
            db[idx].ativa = true;
        }

        db[idx].updatedAt = new Date().toISOString();
        
        writeVagasDB(db);

        // Enviar email se rejeitada (ou aprovada também, por boa prática)
        // O usuário pediu especificamente "se rejeitada... deve voltar email"
        if (status === 'rejeitada' || status === 'reprovada') {
             await notificarGestorVaga(db[idx], status, justificativa);
        }

        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao avaliar vaga' });
    }
});

app.post('/api/vagas', rhAuth, async (req, res) => {
    try {
        const payload = req.body;
        if (!payload.cargo || !payload.setor) {
            return res.status(400).json({ ok: false, erro: 'Campos obrigatórios ausentes' });
        }

        const db = readVagasDB();
        const id = crypto.randomUUID();
        const novaVaga = {
            id,
            ...payload,
            status: 'pendente',
            ativa: true, // Por padrão ativa (aparece na lista de abertas/pendentes)
            createdAt: new Date().toISOString()
        };
        db.push(novaVaga);
        writeVagasDB(db);

        // Opcional: Notificar RH por email sobre nova vaga
        
        return res.json({ ok: true, id });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao salvar vaga' });
    }
});

app.put('/api/vagas/:id', rhAuth, (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const db = readVagasDB();
        const idx = db.findIndex(v => v.id === id);
        
        if (idx === -1) return res.status(404).json({ ok: false, erro: 'Vaga não encontrada' });
        
        // Se estiver reabrindo, pode querer atualizar o status para aprovada se estava rejeitada?
        // Vamos manter simples: atualiza os campos enviados.
        
        db[idx] = { ...db[idx], ...updates, updatedAt: new Date().toISOString() };
        writeVagasDB(db);
        
        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao atualizar vaga' });
    }
});

app.delete('/api/vagas/:id', rhAuth, (req, res) => {
    try {
        const { id } = req.params;
        const db = readVagasDB();
        const filtered = db.filter(v => v.id !== id);
        
        if (db.length === filtered.length) return res.status(404).json({ ok: false, erro: 'Vaga não encontrada' });
        
        writeVagasDB(filtered);
        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao excluir vaga' });
    }
});

app.get('/api/rh/vagas/:id/sugestoes', rhAuth, (req, res) => {
    try {
        const { id } = req.params;
        const vagas = readVagasDB();
        const vaga = vagas.find(v => v.id === id);
        
        if (!vaga) return res.status(404).json({ ok: false, erro: 'Vaga não encontrada' });
        
        const candidatos = readCandidatosDB();
        
        // Normalizer helper
        const normalize = (str) => str ? str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";
        
        const cargoVaga = normalize(vaga.cargo);
        if (!cargoVaga) return res.json([]); // Sem cargo definido, sem sugestões

        const sugestoes = candidatos.filter(c => {
            const c1 = normalize(c.cargo1);
            const c2 = normalize(c.cargo2);
            const pf = normalize(c.periodoFuncao);
            
            // Match Logic:
            // 1. Cargo do candidato contém o da vaga (ex: "Auxiliar de Cozinha" contém "Cozinha") - Wait, "Cozinha" contains "Cozinha".
            // 2. Cargo da vaga contém o do candidato (ex: "Chefe de Cozinha" contém "Cozinha")
            // Precisamos ter cuidado com matches muito curtos.
            
            const matches = (source, target) => {
                if (!source || !target) return false;
                if (target.length < 3) return source === target; // Evita match em "de", "e", etc.
                return source.includes(target);
            };

            return matches(c1, cargoVaga) || matches(cargoVaga, c1) ||
                   matches(c2, cargoVaga) || matches(cargoVaga, c2) ||
                   matches(pf, cargoVaga) || matches(cargoVaga, pf);
        });
        
        const sugestoesLeve = sugestoes
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .map(({ curriculo, ...rest }) => rest);
            
        res.json(sugestoesLeve);
        
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao buscar sugestões' });
    }
});

app.get('/api/vagas/pdf/:id', async (req, res) => {
    try {
        const db = readVagasDB();
        const item = db.find(i => i.id === req.params.id);
        if (!item) return res.status(404).send('Vaga não encontrada');
        
        const buffer = await pdfService.pdfBufferFromVagaData(item);
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Vaga_${item.cargo.replace(/\s+/g, '_')}.pdf`);
        res.send(buffer);
    } catch (e) {
        console.error(e);
        res.status(500).send('Erro ao gerar PDF');
    }
});

// --- Rotas Candidatos ---

// Função simples de sanitização para evitar XSS básico
function sanitizeInput(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/<[^>]*>?/gm, '').trim(); // Remove tags HTML
}

app.post('/api/candidatos', candidatoLimiter, async (req, res) => {
    try {
        const payload = req.body;
        
        // 1. Validação de Campos Obrigatórios
        if (!payload.nome || !payload.email || !payload.telefone) {
            return res.status(400).json({ ok: false, erro: 'Campos obrigatórios ausentes' });
        }

        // Validação básica de email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(payload.email)) {
            return res.status(400).json({ ok: false, erro: 'Email inválido' });
        }

        // 2. Sanitização de todo o payload
        const safePayload = {};
        for (const key in payload) {
            if (key === 'curriculo') continue; // Tratado separadamente
            const val = payload[key];
            if (typeof val === 'string') {
                safePayload[key] = sanitizeInput(val);
            } else {
                safePayload[key] = val;
            }
        }

        // 3. Validação de Currículo (Arquivo)
        if (payload.curriculo) {
            if (typeof payload.curriculo !== 'string' || !payload.curriculo.startsWith('data:')) {
                return res.status(400).json({ ok: false, erro: 'Formato de arquivo inválido' });
            }

            // Validar MIME Type
            const matches = payload.curriculo.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (!matches || matches.length !== 3) {
                return res.status(400).json({ ok: false, erro: 'Arquivo corrompido ou inválido' });
            }

            const mimeType = matches[1];
            const allowedMimes = [
                'application/pdf', 
                'application/msword', 
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'image/jpeg', 
                'image/png'
            ];

            if (!allowedMimes.includes(mimeType)) {
                return res.status(400).json({ ok: false, erro: 'Tipo de arquivo não permitido. Apenas PDF, DOC, DOCX, JPG ou PNG.' });
            }

            // Validar Tamanho (aprox. 5MB limite)
            // Base64 string length ~ 1.37 * file size
            // 5MB * 1.37 ~= 7,200,000 chars
            const base64Length = matches[2].length;
            if (base64Length > 7500000) { 
                return res.status(400).json({ ok: false, erro: 'Arquivo muito grande. Limite máximo de 5MB.' });
            }
            
            safePayload.curriculo = payload.curriculo;
        }

        const db = readCandidatosDB();
        const id = crypto.randomUUID();
        
        const novoCandidato = {
            id,
            ...safePayload,
            status: 'novo', // novo, visto, entrevista, contratado, rejeitado
            createdAt: new Date().toISOString()
        };
        
        db.push(novoCandidato);
        writeCandidatosDB(db);

        res.json({ ok: true, message: 'Candidatura enviada com sucesso!', id });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro interno ao salvar candidatura.' });
    }
});

app.get('/api/rh/candidatos', rhAuth, (req, res) => {
    try {
        const db = readCandidatosDB();
        // Ordenar por data (mais recente primeiro)
        const lista = db.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        // Retornar lista sem o base64 do curriculo para economizar banda na listagem
        const listaLeve = lista.map(({ curriculo, ...rest }) => rest);
        res.json(listaLeve);
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao listar candidatos' });
    }
});

app.get('/api/rh/candidatos/:id', rhAuth, (req, res) => {
    try {
        const db = readCandidatosDB();
        const item = db.find(i => i.id === req.params.id);
        if (!item) return res.status(404).json({ ok: false, erro: 'Candidato não encontrado' });
        res.json(item);
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao buscar candidato' });
    }
});

app.get('/api/rh/candidatos/:id/curriculo', rhAuth, (req, res) => {
    try {
        const db = readCandidatosDB();
        const item = db.find(i => i.id === req.params.id);
        if (!item || !item.curriculo) return res.status(404).send('Currículo não encontrado');

        // item.curriculo deve ser algo como "data:application/pdf;base64,JVBER..."
        const matches = item.curriculo.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        
        if (!matches || matches.length !== 3) {
            return res.status(400).send('Formato de arquivo inválido');
        }

        const type = matches[1];
        const buffer = Buffer.from(matches[2], 'base64');
        
        // Extensão baseada no tipo
        let ext = 'bin';
        if (type.includes('pdf')) ext = 'pdf';
        else if (type.includes('word')) ext = 'doc';
        else if (type.includes('officedocument')) ext = 'docx';
        else if (type.includes('image')) ext = 'jpg';

        res.set({
            'Content-Type': type,
            'Content-Disposition': `attachment; filename="Curriculo_${item.nome.replace(/\s+/g, '_')}.${ext}"`
        });
        res.send(buffer);
    } catch (e) {
        console.error(e);
        res.status(500).send('Erro ao baixar currículo');
    }
});

app.put('/api/rh/candidatos/:id/status', rhAuth, (req, res) => {
    try {
        const { status } = req.body;
        if (!status) return res.status(400).json({ ok: false, erro: 'Status não informado' });

        const db = readCandidatosDB();
        const idx = db.findIndex(i => i.id === req.params.id);
        if (idx === -1) return res.status(404).json({ ok: false, erro: 'Candidato não encontrado' });

        db[idx].status = status;
        db[idx].updatedAt = new Date().toISOString();
        writeCandidatosDB(db);

        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao atualizar status' });
    }
});

app.delete('/api/rh/candidatos/:id', rhAuth, (req, res) => {
    try {
        const db = readCandidatosDB();
        const idx = db.findIndex(i => i.id === req.params.id);
        if (idx === -1) return res.status(404).json({ ok: false, erro: 'Candidato não encontrado' });

        db.splice(idx, 1);
        writeCandidatosDB(db);

        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao remover candidato' });
    }
});


// --- Rotas Portaria (EPIs) ---

// Buscar funcionário por CPF (Simulação Biometria)
app.get('/api/portaria/funcionario/:cpf', portariaAuth, (req, res) => {
    try {
        const cpf = req.params.cpf.replace(/\D/g, ''); // Remove formatação
        const funcionarios = readFuncionariosDB();
        
        if (!funcionarios || !Array.isArray(funcionarios)) {
             console.error('Erro DB Funcionarios: ', funcionarios);
             return res.status(500).json({ ok: false, erro: 'Erro no banco de dados de funcionários' });
        }

        const func = funcionarios.find(f => f.cpf && f.cpf.replace(/\D/g, '') === cpf);

        if (!func) return res.status(404).json({ ok: false, erro: 'Funcionário não encontrado' });

        // Verificação de pendências financeiras (Termos de Desconto não resolvidos)
        let descontos = [];
        try {
            descontos = readDescontosEpisDB();
        } catch(e) {
            descontos = [];
        }

        const pendencias = descontos.filter(d => 
            d.cpf_funcionario.replace(/\D/g, '') === cpf && 
            d.status !== 'resolvido'
        );

        if (pendencias.length > 0) {
            return res.status(403).json({ 
                ok: false, 
                erro: 'BLOQUEADO: Funcionário possui termo de desconto pendente no RH. Favor comparecer ao DP.',
                bloqueado: true
            });
        }

        // Buscar movimentações abertas (itens que estão com o funcionário)
        let movimentacoes = [];
        try {
            movimentacoes = readMovimentacoesEpisDB();
            if (!Array.isArray(movimentacoes)) movimentacoes = [];
        } catch(e) {
            console.error('Erro ao ler movimentacoes:', e);
            movimentacoes = [];
        }

        const itensEmPosse = movimentacoes
            .filter(m => m.funcionario_id === func.id && m.data_devolucao === null)
            .map(m => m.epi_id);

        res.json({
            ok: true,
            funcionario: {
                id: func.id,
                nome: func.nome,
                cargo: func.cargo,
                setor: func.setor,
                cpf: func.cpf
            },
            itensEmPosse
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao buscar funcionário' });
    }
});

// Listar todos EPIs
app.get('/api/portaria/epis', portariaAuth, (req, res) => {
    const epis = readEpisDB();
    res.json(epis);
});

// Atualizar Estoque (Adicionar)
app.post('/api/portaria/estoque', portariaAuth, (req, res) => {
    try {
        const { epi_id, quantidade } = req.body;
        const db = readEpisDB();
        const idx = db.findIndex(e => e.id === epi_id);
        
        if (idx !== -1) {
            db[idx].estoque = (db[idx].estoque || 0) + parseInt(quantidade);
            writeEpisDB(db);
            res.json({ ok: true, novo_estoque: db[idx].estoque });
        } else {
            res.status(404).json({ ok: false, erro: 'Item não encontrado' });
        }
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao atualizar estoque' });
    }
});

// Registrar Movimentação (Entrada/Saída)
app.post('/api/portaria/movimentacao', portariaAuth, (req, res) => {
    try {
        const { funcionario_id, itens_retirados, itens_devolvidos } = req.body; // Arrays de IDs de EPIs
        const db = readMovimentacoesEpisDB();
        const dbEpis = readEpisDB(); // Carregar EPIs para atualizar estoque
        const agora = new Date().toISOString();

        // Registrar retiradas
        if (itens_retirados && itens_retirados.length > 0) {
            // Validação de estoque primeiro
            for (const epi_id of itens_retirados) {
                const epi = dbEpis.find(e => e.id === epi_id);
                if (!epi) return res.status(400).json({ ok: false, erro: 'Item não encontrado' });
                if ((epi.estoque || 0) <= 0) {
                    return res.status(400).json({ 
                        ok: false, 
                        erro: `Estoque insuficiente para: ${epi.nome}` 
                    });
                }
            }

            itens_retirados.forEach(epi_id => {
                db.push({
                    id: crypto.randomUUID(),
                    funcionario_id,
                    epi_id,
                    data_retirada: agora,
                    data_devolucao: null,
                    evidencia_retirada: req.body.evidencia,
                    tipo_evidencia_retirada: req.body.tipo_evidencia
                });

                // Baixa no estoque
                const epiIndex = dbEpis.findIndex(e => e.id === epi_id);
                if (epiIndex !== -1) {
                    dbEpis[epiIndex].estoque = (dbEpis[epiIndex].estoque || 0) - 1;
                }
            });
            writeEpisDB(dbEpis);
        }

        // Registrar devoluções (atualizar registros abertos)
        if (itens_devolvidos && itens_devolvidos.length > 0) {
            itens_devolvidos.forEach(epi_id => {
                // Procura o registro mais antigo aberto deste item para este funcionário
                const regIndex = db.findIndex(m => 
                    m.funcionario_id === funcionario_id && 
                    m.epi_id === epi_id && 
                    m.data_devolucao === null
                );
                
                if (regIndex !== -1) {
                    db[regIndex].data_devolucao = agora;
                    db[regIndex].evidencia_devolucao = req.body.evidencia;
                    db[regIndex].tipo_evidencia_devolucao = req.body.tipo_evidencia;
                }
            });
        }

        writeMovimentacoesEpisDB(db);
        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao registrar movimentação' });
    }
});

// Gerar Termo de Desconto
app.post('/api/portaria/desconto', portariaAuth, async (req, res) => {
    try {
        const payload = req.body; // { nome_funcionario, cpf_funcionario, itens: [{nome, valor}], parcelas }
        
        // Salvar registro do desconto
        const db = readDescontosEpisDB();
        const id = crypto.randomUUID();
        db.push({ 
            id, 
            ...payload, 
            status: 'pendente_rh', // Novo status
            createdAt: new Date().toISOString() 
        });
        writeDescontosEpisDB(db);

        // Não gera PDF aqui, apenas confirma envio ao RH
        res.json({ ok: true, id, mensagem: 'Termo enviado para o RH com sucesso.' }); 
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao gerar desconto' });
    }
});

app.get('/api/portaria/desconto/:id/pdf', portariaAuth, async (req, res) => {
    // Mantido caso precise baixar depois, mas o fluxo principal agora é via RH
    try {
        const db = readDescontosEpisDB();
        const item = db.find(i => i.id === req.params.id);
        if (!item) return res.status(404).send('Desconto não encontrado');
        
        const buffer = await pdfService.pdfBufferFromDescontoData(item);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Desconto_${item.nome_funcionario}.pdf`);
        res.send(buffer);
    } catch (e) {
        res.status(500).send('Erro');
    }
});

// --- Rotas RH Descontos ---

app.get('/api/rh/descontos', rhAuth, (req, res) => {
    const db = readDescontosEpisDB();
    // Ordenar pendentes primeiro
    const lista = db.sort((a, b) => {
        if (a.status === 'pendente_rh' && b.status !== 'pendente_rh') return -1;
        if (a.status !== 'pendente_rh' && b.status === 'pendente_rh') return 1;
        return new Date(b.createdAt) - new Date(a.createdAt);
    });
    res.json(lista);
});

app.post('/api/rh/descontos/:id/resolver', rhAuth, (req, res) => {
    try {
        const db = readDescontosEpisDB();
        const idx = db.findIndex(i => i.id === req.params.id);
        if (idx === -1) return res.status(404).json({ ok: false, erro: 'Termo não encontrado' });
        
        db[idx].status = 'resolvido';
        db[idx].resolvidoEm = new Date().toISOString();
        writeDescontosEpisDB(db);
        
        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao resolver termo' });
    }
});

app.get('/api/rh/descontos/:id/pdf', rhAuth, async (req, res) => {
    try {
        const db = readDescontosEpisDB();
        const item = db.find(i => i.id === req.params.id);
        if (!item) return res.status(404).send('Desconto não encontrado');
        
        const buffer = await pdfService.pdfBufferFromDescontoData(item);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=Desconto_${item.nome_funcionario}.pdf`);
        res.send(buffer);
    } catch (e) {
        res.status(500).send('Erro');
    }
});

app.get('/api/rh/movimentacoes', rhAuth, (req, res) => {
    try {
        const db = readMovimentacoesEpisDB();
        const sorted = db.sort((a, b) => {
             const dateA = a.data_devolucao || a.data_retirada;
             const dateB = b.data_devolucao || b.data_retirada;
             return new Date(dateB) - new Date(dateA);
        });
        res.json(sorted);
    } catch (e) {
        console.error(e);
        res.status(500).json([]);
    }
});

const readEntrevistasDesligamentoDB = () => {
    try {
        const data = fs.readFileSync(path.join(__dirname, 'data', 'entrevistas_desligamento.json'));
        return JSON.parse(data);
    } catch (e) { return []; }
};

const writeEntrevistasDesligamentoDB = (data) => {
    fs.writeFileSync(path.join(__dirname, 'data', 'entrevistas_desligamento.json'), JSON.stringify(data, null, 2));
};



// --- Rotas Entrevistas Desligamento ---

app.get('/api/rh/entrevistas-desligamento', rhAuth, (req, res) => {
    try {
        const db = readEntrevistasDesligamentoDB();
        res.json(db.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao listar entrevistas' });
    }
});

app.post('/api/rh/entrevistas-desligamento', rhAuth, (req, res) => {
    try {
        const db = readEntrevistasDesligamentoDB();
        const novo = {
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
            ...req.body
        };
        db.push(novo);
        writeEntrevistasDesligamentoDB(db);
        res.json({ ok: true, id: novo.id });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao salvar entrevista' });
    }
});

app.get('/api/rh/entrevistas-desligamento/:id', rhAuth, (req, res) => {
    try {
        const db = readEntrevistasDesligamentoDB();
        const item = db.find(i => i.id === req.params.id);
        if (!item) return res.status(404).json({ ok: false, erro: 'Não encontrado' });
        res.json(item);
    } catch (e) {
        res.status(500).json({ ok: false, erro: 'Erro ao buscar' });
    }
});

app.get('/api/rh/entrevistas-desligamento/:id/pdf', rhAuth, async (req, res) => {
    try {
        const db = readEntrevistasDesligamentoDB();
        const item = db.find(i => i.id === req.params.id);
        if (!item) return res.status(404).send('Não encontrado');
        
        const buffer = await pdfService.pdfBufferFromEntrevistaDesligamentoData(item);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Desligamento_${item.nome.replace(/\s+/g, '_')}.pdf`);
        res.send(buffer);
    } catch (e) {
        console.error(e);
        res.status(500).send('Erro ao gerar PDF');
    }
});

app.get('/protected/entrevista-desligamento.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'protected', 'entrevista-desligamento.html'));
});

// Public POST for interview submission (No RH Auth required)
app.post('/api/entrevistas-desligamento', (req, res) => {
    try {
        const db = readEntrevistasDesligamentoDB();
        const novo = {
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
            ...req.body
        };
        db.push(novo);
        writeEntrevistasDesligamentoDB(db);
        res.json({ ok: true, id: novo.id });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao salvar entrevista' });
    }
});

app.get('/protected/dashboard-desligamento.html', rhAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'protected', 'dashboard-desligamento.html'));
});


const RECRUTAMENTO_DB_PATH = path.join(__dirname, 'data', 'recrutamento_interno.json');

function readRecrutamentoDB() {
    if (!fs.existsSync(RECRUTAMENTO_DB_PATH)) return [];
    try {
        const data = fs.readFileSync(RECRUTAMENTO_DB_PATH, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return [];
    }
}

function writeRecrutamentoDB(data) {
    fs.writeFileSync(RECRUTAMENTO_DB_PATH, JSON.stringify(data, null, 2));
}

async function enviarEmailRecrutamento(buffer, filename, payload) {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const secure = String(process.env.SMTP_SECURE || 'false') === 'true';
    const to = process.env.DP_EMAIL;
    const from = process.env.MAIL_FROM || user;

    const subject = `Recrutamento Interno – ${payload.nome} – ${payload.cargoPretendido}`;
    const text = `Nova candidatura interna recebida.\n\nNome: ${payload.nome}\nCargo Atual: ${payload.cargoAtual}\nSetor: ${payload.setor}\nCargo Pretendido: ${payload.cargoPretendido}\n\nVeja o PDF anexo.`;

    if (!host || !port || !user || !pass || !to) {
        console.log('--- EMAIL MOCK (Recrutamento) ---');
        console.log(`To: ${to}`);
        console.log(`Subject: ${subject}`);
        return { ok: true, mock: true };
    }

    const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
    try {
        await transporter.sendMail({ from, to, subject, text, attachments: [{ filename, content: buffer }] });
        return { ok: true };
    } catch (e) {
        console.error('Erro ao enviar email recrutamento:', e);
        return { ok: false, erro: e.message };
    }
}

app.post('/api/recrutamento-interno', async (req, res) => {
    try {
        const payload = req.body;
        // Basic validation
        if (!payload.nome || !payload.cargoPretendido) {
            return res.status(400).json({ ok: false, erro: 'Campos obrigatórios ausentes' });
        }

        const db = readRecrutamentoDB();
        const novo = {
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
            ...payload
        };
        
        db.push(novo);
        writeRecrutamentoDB(db);

        // Generate PDF
        try {
            const buffer = await pdfService.pdfBufferFromRecrutamentoInternoData(novo);
            const filename = `Recrutamento_${novo.nome.replace(/\s+/g, '_')}.pdf`;
            
            // Send Email
            await enviarEmailRecrutamento(buffer, filename, novo);
        } catch (pdfErr) {
            console.error('Erro ao gerar/enviar PDF Recrutamento:', pdfErr);
            // Não falha a requisição se o PDF falhar, mas loga
        }

        res.json({ ok: true, id: novo.id });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao processar recrutamento' });
    }
});

// --- On The Job ---

const ON_THE_JOB_DB_PATH = path.join(__dirname, 'data', 'onthejob.json');

function readOnTheJobDB() {
    if (!fs.existsSync(ON_THE_JOB_DB_PATH)) return [];
    try {
        const data = fs.readFileSync(ON_THE_JOB_DB_PATH, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return [];
    }
}

function writeOnTheJobDB(data) {
    fs.writeFileSync(ON_THE_JOB_DB_PATH, JSON.stringify(data, null, 2));
}

async function enviarEmailOnTheJob(buffer, filename, payload) {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const secure = String(process.env.SMTP_SECURE || 'false') === 'true';
    const to = process.env.DP_EMAIL;
    const from = process.env.MAIL_FROM || user;

    const subject = `On The Job – ${payload.colaborador}`;
    const text = `Nova solicitação de On The Job recebida.\n\nColaborador: ${payload.colaborador}\nEmpresa: ${payload.empresa}\nCargo Atual: ${payload.comparativo?.cargo?.atual || ''}\nCargo Proposto: ${payload.comparativo?.cargo?.proposta || ''}\n\nVeja o PDF anexo.`;

    if (!host || !port || !user || !pass || !to) {
        console.log('--- EMAIL MOCK (On The Job) ---');
        console.log(`To: ${to}`);
        console.log(`Subject: ${subject}`);
        return { ok: true, mock: true };
    }

    const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
    try {
        await transporter.sendMail({ from, to, subject, text, attachments: [{ filename, content: buffer }] });
        return { ok: true };
    } catch (e) {
        console.error('Erro ao enviar email On The Job:', e);
        return { ok: false, erro: e.message };
    }
}

app.post('/api/on-the-job', async (req, res) => {
    try {
        const payload = req.body;
        // Basic validation
        if (!payload.colaborador) {
            return res.status(400).json({ ok: false, erro: 'Campos obrigatórios ausentes' });
        }

        const db = readOnTheJobDB();
        const novo = {
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
            ...payload
        };
        
        db.push(novo);
        writeOnTheJobDB(db);

        // Generate PDF
        try {
            const buffer = await pdfService.pdfBufferFromOnTheJobData(novo);
            const filename = `OnTheJob_${novo.colaborador.replace(/\s+/g, '_')}.pdf`;
            
            // Send Email
            await enviarEmailOnTheJob(buffer, filename, novo);
        } catch (pdfErr) {
            console.error('Erro ao gerar/enviar PDF On The Job:', pdfErr);
        }

        res.json({ ok: true, id: novo.id });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao processar On The Job' });
    }
});

// --- Rotas RH Recrutamento Interno ---

app.get('/api/rh/recrutamento-interno', rhAuth, (req, res) => {
    try {
        const db = readRecrutamentoDB();
        res.json(db.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao listar recrutamento interno' });
    }
});

app.get('/api/rh/recrutamento-interno/:id', rhAuth, (req, res) => {
    try {
        const db = readRecrutamentoDB();
        const item = db.find(i => i.id === req.params.id);
        if (!item) return res.status(404).json({ ok: false, erro: 'Não encontrado' });
        res.json(item);
    } catch (e) {
        res.status(500).json({ ok: false, erro: 'Erro ao buscar' });
    }
});

app.get('/api/rh/recrutamento-interno/:id/pdf', rhAuth, async (req, res) => {
    try {
        const db = readRecrutamentoDB();
        const item = db.find(i => i.id === req.params.id);
        if (!item) return res.status(404).send('Não encontrado');
        
        const buffer = await pdfService.pdfBufferFromRecrutamentoInternoData(item);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Recrutamento_${item.nome.replace(/\s+/g, '_')}.pdf`);
        res.send(buffer);
    } catch (e) {
        console.error(e);
        res.status(500).send('Erro ao gerar PDF');
    }
});

app.get('/protected/dashboard-recrutamento.html', rhAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'protected', 'dashboard-recrutamento.html'));
});

// Final do arquivo
// --- Rotas RH On The Job ---

app.get('/api/rh/on-the-job', rhAuth, (req, res) => {
    const db = readOnTheJobDB();
    db.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(db);
});

app.get('/api/rh/on-the-job/:id', rhAuth, (req, res) => {
    const db = readOnTheJobDB();
    const item = db.find(i => i.id === req.params.id);
    if (!item) return res.status(404).json({ ok: false, erro: 'Não encontrado' });
    res.json(item);
});

app.get('/api/rh/on-the-job/:id/pdf', rhAuth, async (req, res) => {
    try {
        const db = readOnTheJobDB();
        const item = db.find(i => i.id === req.params.id);
        if (!item) return res.status(404).send('Não encontrado');
        
        const buffer = await pdfService.pdfBufferFromOnTheJobData(item);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=OnTheJob_${item.colaborador.replace(/\s+/g, '_')}.pdf`);
        res.send(buffer);
    } catch (e) {
        console.error(e);
        res.status(500).send('Erro ao gerar PDF');
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
