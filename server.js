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

dotenv.config();

const app = express();

// --- Segurança Básica (Helmet) ---
app.use(helmet({
    contentSecurityPolicy: false,
}));

// --- Rate Limiting ---
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Muitas requisições, tente novamente mais tarde.'
});
app.use(limiter);

app.use(cors());

// --- Middleware de Autenticação RH ---
const rhAuth = basicAuth({
    users: { [process.env.RH_USER || 'admin']: process.env.RH_PASS || 'admin123' },
    challenge: true,
    realm: 'Painel RH'
});

// Rota protegida para servir o dashboard do RH
app.get('/dashboard-rh.html', rhAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'protected', 'dashboard-rh.html'));
});
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/assets', express.static('assets'));

const DB_PATH = path.join(__dirname, 'data', 'solicitacoes.json');

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

function pdfBufferFromData(payload) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const chunks = [];
  doc.on('data', c => chunks.push(c));
  return new Promise(resolve => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    const titulo = 'Solicitação de Férias';
    const dataHoje = new Date().toLocaleDateString('pt-BR');
    const inicioFmt = new Date(payload.inicio).toLocaleDateString('pt-BR');
    const inicio2Fmt = payload.inicio2 ? new Date(payload.inicio2).toLocaleDateString('pt-BR') : null;

    doc.rect(50, 50, doc.page.width - 100, 60).fill('#f1f5f9');
    doc.fillColor('#0f172a').fontSize(20).text(titulo, 50, 72, { width: doc.page.width - 100, align: 'center' });
    doc.moveDown(2);

    doc.fillColor('#111827').fontSize(12);
    doc.text(`Data: ${dataHoje}`, { align: 'right' });
    doc.moveDown();

    doc.fontSize(14).fillColor('#0f172a').text('Dados do Colaborador');
    doc.moveTo(50, doc.y + 2).lineTo(doc.page.width - 50, doc.y + 2).stroke('#cbd5e1');
    doc.moveDown();

    doc.fillColor('#111827').fontSize(12);
    doc.text(`Nome`, { continued: true }).text(`: ${payload.nome}`);
    doc.text(`Setor`, { continued: true }).text(`: ${payload.setor}`);

    doc.moveDown();
    doc.fontSize(14).fillColor('#0f172a').text('Solicitação');
    doc.moveTo(50, doc.y + 2).lineTo(doc.page.width - 50, doc.y + 2).stroke('#cbd5e1');
    doc.moveDown();

    doc.fillColor('#111827').fontSize(12);
    doc.text(`Início das férias`, { continued: true }).text(`: ${inicioFmt}`);
    if (inicio2Fmt) doc.text(`Início do segundo período`, { continued: true }).text(`: ${inicio2Fmt}`);
    doc.text(`Período de Férias`, { continued: true }).text(`: ${payload.tipoGozo}`);
    doc.text(`Solicitação de 13º`, { continued: true }).text(`: ${payload.decimo ? 'Sim' : 'Não'}`);
    
    const aprovado = payload.statusRH === 'aprovado';
    doc.text(`Status RH`, { continued: true }).text(`: ${aprovado ? 'APROVADO' : 'REPROVADO'}`);
    if (!aprovado && payload.sugestaoData) {
       const sugFmt = new Date(payload.sugestaoData).toLocaleDateString('pt-BR');
       doc.text(`Sugestão de nova data`, { continued: true }).text(`: ${sugFmt}`);
    }
    
    // Configurações para as assinaturas
    doc.moveDown(2);
    const boxWidth = (doc.page.width - 100 - 20) / 3; // 3 assinaturas com 10px de gap entre elas
    const boxHeight = 100;
    let startY = doc.y;

    // --- Gestor ---
    doc.fontSize(10).fillColor('#0f172a').text('Gestor', 50, startY);
    doc.rect(50, startY + 15, boxWidth, boxHeight).stroke('#94a3b8');

    // Digital Signature Indicator for Gestor
    doc.fillColor('#6b7280').fontSize(8).text('Assinatura Eletrônica (Autentique)', 50 + 5, startY + boxHeight / 2, { width: boxWidth - 10, align: 'center' });

    const nomeGestor = payload.nomeGestor || payload.gestorEmail || 'Gestor';
    doc.fillColor('#111827').fontSize(9).text(nomeGestor, 50, startY + boxHeight + 20, { width: boxWidth, align: 'center' });

    // --- RH ---
    const xRH = 50 + boxWidth + 10;
    doc.fontSize(10).fillColor('#0f172a').text('RH', xRH, startY);
    doc.rect(xRH, startY + 15, boxWidth, boxHeight).stroke('#94a3b8');
    
    // Digital Signature Indicator for RH
    doc.fillColor('#6b7280').fontSize(8).text('Assinatura Eletrônica (Autentique)', xRH + 5, startY + boxHeight / 2, { width: boxWidth - 10, align: 'center' });
    
    doc.fillColor('#111827').fontSize(9).text('Validação RH', xRH, startY + boxHeight + 20, { width: boxWidth, align: 'center' });

    // --- Colaborador ---
    const xColab = xRH + boxWidth + 10;
    doc.fontSize(10).fillColor('#0f172a').text('Colaborador', xColab, startY);
    doc.rect(xColab, startY + 15, boxWidth, boxHeight).stroke('#94a3b8');
    if (payload.assinatura) {
        try {
            const sigBuf = Buffer.from(payload.assinatura.replace(/^data:image\/\w+;base64,/, ''), 'base64');
            doc.image(sigBuf, xColab + 5, startY + 15 + 5, { fit: [boxWidth - 10, boxHeight - 10] });
        } catch(e) { console.error('Erro img colab', e); }
    } else {
        doc.fillColor('#6b7280').fontSize(8).text('Aguardando assinatura...', xColab + 5, startY + boxHeight / 2, { width: boxWidth - 10, align: 'center' });
    }
    doc.fillColor('#111827').fontSize(9).text(payload.nome, xColab, startY + boxHeight + 20, { width: boxWidth, align: 'center' });


    doc.moveDown(12);

    doc.fillColor('#111827').fontSize(11).text('Declaro que as informações acima são verdadeiras.');
    doc.moveDown();
    doc.text('Local e data:', { continued: true }).text(` ${dataHoje}`);

    doc.end();
  });
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
        linkEdicao = `\n\nPara ajustar a solicitação e reenviar, clique aqui: ${baseUrl}/?id=${payload.id}`;
    }

    text = `Olá,\n\nA solicitação de férias para ${payload.nome} foi REPROVADA pelo RH.\n\nSugestão de nova data: ${sug}.\n\nFavor realizar as alterações necessárias.${linkEdicao}`;
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
    const link = `${baseUrl}/?${params.toString()}`;

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
        
        const buffer = await pdfBufferFromData(item);
        
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
                db[idx] = {
                    ...db[idx],
                    ...req.body,
                    status: 'pendente_rh', // Reseta status
                    statusRH: undefined,   // Limpa aprovação anterior
                    sugestaoData: undefined,
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
                createdAt: new Date().toISOString()
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

            db[idx] = { 
                ...db[idx], 
                ...req.body, 
                status: currentStatus,
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

    const pdfBuffer = await pdfBufferFromData(req.body);
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

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {});
