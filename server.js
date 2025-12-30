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
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.sheetjs.com"], // unsafe-inline necessário para scripts inline simples se houver
            scriptSrcAttr: ["'unsafe-inline'"], // Permite event handlers inline como onclick
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:"], // data: necessário para imagens base64
            connectSrc: ["'self'", "https://cdn.sheetjs.com"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: [],
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

// --- Middleware de Autenticação RH ---
const rhAuth = basicAuth({
    users: { [process.env.RH_USER || 'admin']: process.env.RH_PASS || 'admin123' },
    challenge: true,
    realm: 'Painel RH'
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

function pdfBufferFromTaxaData(payload) {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  const chunks = [];
  doc.on('data', c => chunks.push(c));
  return new Promise(resolve => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    const titulo = 'FORMULÁRIO DE PAGAMENTO DE TAXAS';
    
    // Header
    doc.rect(40, 40, doc.page.width - 80, 50).fillAndStroke('#333333', '#000000');
    doc.fillColor('#FFFFFF').fontSize(16).text(titulo, 40, 58, { width: doc.page.width - 80, align: 'center' });
    
    doc.fillColor('#000000').fontSize(10);
    let y = 100;

    const drawBox = (label, value, x, y, w, h) => {
        doc.rect(x, y, w, h).stroke();
        doc.font('Helvetica-Bold').text(label, x + 5, y + 5);
        doc.font('Helvetica').text(value || '', x + 5, y + 20);
    };

    // Nome da Taxa
    drawBox('NOME DA TAXA:', payload.nome_taxa, 40, y, doc.page.width - 80, 40);
    y += 40;

    // CPF
    drawBox('CPF:', payload.cpf, 40, y, doc.page.width - 80, 40);
    y += 40;

    // Forma de Pagamento
    const formaPagamentoText = payload.forma_pagamento === 'transferencia' ? 'TRANSFERÊNCIA BANCÁRIA' : 
                               payload.forma_pagamento === 'pix' ? 'PIX' : '';
    drawBox('FORMA DE PAGAMENTO:', formaPagamentoText, 40, y, doc.page.width - 80, 40);
    y += 40;

    // Banco | Agencia | Conta | Tipo
    const w4 = (doc.page.width - 80) / 4;
    drawBox('BANCO:', payload.banco, 40, y, w4, 40);
    drawBox('AGÊNCIA:', payload.agencia, 40 + w4, y, w4, 40);
    drawBox('CONTA:', payload.conta, 40 + w4 * 2, y, w4, 40);
    
    // Tipo de Conta Checkboxes
    doc.rect(40 + w4 * 3, y, w4, 40).stroke();
    doc.font('Helvetica-Bold').text('TIPO DE CONTA:', 40 + w4 * 3 + 5, y + 5);
    const ccCheck = payload.tipo_conta === 'corrente' ? '(X)' : '( )';
    const cpCheck = payload.tipo_conta === 'poupanca' ? '(X)' : '( )';
    doc.font('Helvetica').fontSize(8).text(`Conta Corrente ${ccCheck}`, 40 + w4 * 3 + 5, y + 20);
    doc.font('Helvetica').fontSize(8).text(`Conta Poupança ${cpCheck}`, 40 + w4 * 3 + 5, y + 30);
    doc.fontSize(10);
    y += 40;

    // PIX
    drawBox('PIX VINCULADO A CONTA:', payload.pix, 40, y, doc.page.width - 80, 40);
    y += 40;

    // Departamento | Funcao
    const w2 = (doc.page.width - 80) / 2;
    drawBox('DEPARTAMENTO:', payload.departamento, 40, y, w2, 40);
    drawBox('FUNÇÃO:', payload.funcao, 40 + w2, y, w2, 40);
    y += 40;

    // Motivo
    doc.rect(40, y, doc.page.width - 80, 30).stroke();
    doc.font('Helvetica-Bold').text('MOTIVO:', 45, y + 10);
    const motivos = payload.motivo || [];
    const mDemanda = motivos.includes('aumento_demanda') ? '(X)' : '( )';
    const mEvento = motivos.includes('evento') ? '(X)' : '( )';
    const mVaga = motivos.includes('vaga_aberta') ? '(X)' : '( )';
    
    doc.font('Helvetica').text(`${mDemanda} AUMENTO DE DEMANDA   ${mEvento} EVENTO   ${mVaga} VAGA ABERTA (ANTECESSOR): ${payload.antecessor || '________________'}`, 100, y + 10);
    y += 30;

    // Table Header
    doc.rect(40, y, doc.page.width - 80, 20).fill('#555555');
    doc.fillColor('#FFFFFF').font('Helvetica-Bold');
    doc.text('ITEM', 40, y + 5, { width: w4, align: 'center' });
    doc.text('VALOR', 40 + w4, y + 5, { width: w4, align: 'center' });
    doc.text('QUANTIDADE', 40 + w4 * 2, y + 5, { width: w4, align: 'center' });
    doc.text('TOTAL', 40 + w4 * 3, y + 5, { width: w4, align: 'center' });
    y += 20;

    // Table Rows
    const drawRow = (item, valor, qtd, total) => {
        doc.fillColor('#000000').font('Helvetica');
        doc.rect(40, y, w4, 20).stroke();
        doc.text(item, 40, y + 5, { width: w4, align: 'center' });
        
        doc.rect(40 + w4, y, w4, 20).stroke();
        doc.text(valor, 40 + w4, y + 5, { width: w4, align: 'center' });
        
        doc.rect(40 + w4 * 2, y, w4, 20).stroke();
        doc.text(qtd, 40 + w4 * 2, y + 5, { width: w4, align: 'center' });
        
        doc.rect(40 + w4 * 3, y, w4, 20).stroke();
        doc.text(total, 40 + w4 * 3, y + 5, { width: w4, align: 'center' });
        y += 20;
    };

    drawRow('TAXA', payload.valores?.taxa?.valor || '', payload.valores?.taxa?.qtd || '', payload.valores?.taxa?.total || '');
    drawRow('VT', payload.valores?.vt?.valor || '', payload.valores?.vt?.qtd || '', payload.valores?.vt?.total || '');
    
    // Total Geral
    doc.fillColor('#000000').font('Helvetica-Bold');
    doc.rect(40, y, w4, 20).stroke();
    doc.text('TOTAL', 40, y + 5, { width: w4, align: 'center' });
    doc.rect(40 + w4, y, w4 * 3, 20).stroke(); // Empty middle
    doc.rect(40 + w4 * 3, y, w4, 20).stroke();
    doc.text(payload.valores?.total_geral || '', 40 + w4 * 3, y + 5, { width: w4, align: 'center' });
    y += 30;

    // Dias Trabalhados
    doc.font('Helvetica-Bold').text('Marque os dias o mês e o a semana em que foram realizados a taxa', 40, y);
    y += 15;
    
    const dias = payload.dias_trabalhados || [];
    // Print in rows of 2
    for(let i=0; i<dias.length; i+=2) {
        const d1 = dias[i];
        const d2 = dias[i+1];
        
        let textLine = `Data: ${d1.data ? new Date(d1.data).toLocaleDateString('pt-BR') : '___/___/___'}   Dia da Semana: ${d1.dia || '_________'}`;
        if (d2) {
            textLine += `          Data: ${d2.data ? new Date(d2.data).toLocaleDateString('pt-BR') : '___/___/___'}   Dia da Semana: ${d2.dia || '_________'}`;
        }
        doc.font('Helvetica').text(textLine, 40, y);
        doc.moveTo(40, y+12).lineTo(doc.page.width - 40, y+12).stroke(); // Underline look
        y += 20;
    }
    if (dias.length === 0) {
        // Empty lines if no dates
         doc.font('Helvetica').text('Data: ___/___/___   Dia da Semana: _________          Data: ___/___/___   Dia da Semana: _________', 40, y);
         y+=20;
         doc.font('Helvetica').text('Data: ___/___/___   Dia da Semana: _________          Data: ___/___/___   Dia da Semana: _________', 40, y);
         y+=20;
    }
    y += 10;

    // Observacoes
    doc.font('Helvetica-Bold').text('Observações de pagamento:', 40, y);
    y += 15;
    doc.font('Helvetica').fontSize(9);
    
    const obsWidth = doc.page.width - 80;
    const obs1 = '• Os formulários devem serem entregues na segunda feira até as 12:00 e serão pagas na terça feira e na quinta feita até as 12:00 que serão pagas na sexta feira.';
    const h1 = doc.heightOfString(obs1, { width: obsWidth });
    doc.text(obs1, 40, y, { width: obsWidth });
    y += h1 + 5;

    const obs2 = '• Os formulários não entregues no prazo, ou em caso de falta de dados cadastrais, ou com letras ilegíveis, a taxa só será paga no prazo seguinte.';
    const h2 = doc.heightOfString(obs2, { width: obsWidth });
    doc.text(obs2, 40, y, { width: obsWidth });
    y += h2 + 60; // Garante espaço suficiente para a assinatura (que é desenhada com y-50)

    // Assinaturas
    const sigW = (doc.page.width - 80) / 2 - 20;
    
    // Taxa
    doc.moveTo(40, y).lineTo(40 + sigW, y).stroke();
    doc.font('Helvetica').fontSize(10).text('Assinatura do Taxa', 40, y + 5, { width: sigW, align: 'center' });
    if (payload.assinatura_taxa) {
        try {
            const sigBuf = Buffer.from(payload.assinatura_taxa.replace(/^data:image\/\w+;base64,/, ''), 'base64');
            // Mantendo y - 50, mas como y desceu, a assinatura sobe em relação à linha, mas fica longe do texto acima
            doc.image(sigBuf, 40 + (sigW/2) - 50, y - 50, { fit: [100, 40] });
        } catch(e) {}
    }

    // Gestor
    doc.moveTo(doc.page.width - 40 - sigW, y).lineTo(doc.page.width - 40, y).stroke();
    doc.text('Assinatura Líder/Gestor', doc.page.width - 40 - sigW, y + 5, { width: sigW, align: 'center' });
    if (payload.assinatura_gestor) {
        try {
            const sigBuf = Buffer.from(payload.assinatura_gestor.replace(/^data:image\/\w+;base64,/, ''), 'base64');
            doc.image(sigBuf, doc.page.width - 40 - sigW + (sigW/2) - 50, y - 50, { fit: [100, 40] });
        } catch(e) {}
    }
    
    y += 40;
    // Data RH
    doc.moveTo(doc.page.width - 200, y).lineTo(doc.page.width - 40, y).stroke();
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}   RH/DP`, doc.page.width - 200, y + 5, { width: 160, align: 'right' });

    doc.end();
  });
}

function pdfBufferFromVagaData(payload) {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  const chunks = [];
  doc.on('data', c => chunks.push(c));
  return new Promise(resolve => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    const titulo = 'FORMULÁRIO ABERTURA DE VAGA DE TRABALHO';
    
    // Header Box
    doc.rect(40, 40, doc.page.width - 80, 50).fillAndStroke('#333333', '#000000');
    doc.fillColor('#FFFFFF').fontSize(16).text(titulo, 40, 58, { width: doc.page.width - 80, align: 'center' });
    
    // Reset colors for body
    doc.fillColor('#000000').fontSize(10);
    let y = 100;

    // Helper to draw labeled box
    const drawBox = (label, value, x, y, w, h) => {
        doc.rect(x, y, w, h).stroke();
        doc.font('Helvetica-Bold').text(label, x + 5, y + 5);
        doc.font('Helvetica').text(value || '', x + 5, y + 20);
    };

    // Dados Gerais Header
    doc.rect(40, y, doc.page.width - 80, 20).fill('#555555');
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').text('DADOS GERAIS', 40, y + 5, { width: doc.page.width - 80, align: 'center' });
    y += 20;

    doc.fillColor('#000000');
    // Cargo | Num Vagas
    drawBox('CARGO:', payload.cargo, 40, y, (doc.page.width - 80) * 0.7, 40);
    drawBox('NÚMERO DE VAGAS:', payload.numero_vagas, 40 + (doc.page.width - 80) * 0.7, y, (doc.page.width - 80) * 0.3, 40);
    y += 40;
    // Setor | Data
    drawBox('SETOR:', payload.setor, 40, y, (doc.page.width - 80) * 0.7, 40);
    drawBox('DATA:', new Date(payload.data_abertura).toLocaleDateString('pt-BR'), 40 + (doc.page.width - 80) * 0.7, y, (doc.page.width - 80) * 0.3, 40);
    y += 40;

    // Motivo Header
    doc.rect(40, y, doc.page.width - 80, 20).fill('#555555');
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').text('MOTIVO DA CONTRATAÇÃO', 40, y + 5, { width: doc.page.width - 80, align: 'center' });
    y += 20;

    doc.fillColor('#000000');
    // Left side: Substituicao details
    const leftW = (doc.page.width - 80) * 0.65;
    const rightW = (doc.page.width - 80) * 0.35;
    
    doc.rect(40, y, leftW, 80).stroke();
    doc.font('Helvetica-Bold').text('SUBSTITUIÇÃO (nome):', 45, y + 10);
    doc.font('Helvetica').text(payload.substituicao_nome || '__________________________', 160, y + 10);
    
    doc.font('Helvetica-Bold').text('SERÁ DESLIGADO:', 45, y + 35);
    const simCheck = payload.sera_desligado === 'sim' ? '( X )' : '(   )';
    const naoCheck = payload.sera_desligado === 'nao' ? '( X )' : '(   )';
    doc.font('Helvetica').text(`${simCheck} SIM   ${naoCheck} NÃO`, 150, y + 35);

    doc.font('Helvetica-Bold').text('REPORTARÁ A QUEM:', 45, y + 60);
    doc.font('Helvetica').text(payload.reportara_a || '__________________________', 170, y + 60);

    // Right side: Checkboxes
    doc.rect(40 + leftW, y, rightW, 80).stroke();
    const substCheck = payload.motivo === 'substituicao' ? '( X )' : '(   )';
    const aumCheck = payload.motivo === 'aumento_quadro' ? '( X )' : '(   )';
    
    doc.font('Helvetica-Bold').text(`SUBSTITUIÇÃO ${substCheck}`, 40 + leftW + 10, y + 25);
    doc.font('Helvetica-Bold').text(`AUMENTO DE QUADRO ${aumCheck}`, 40 + leftW + 10, y + 55);
    y += 80;

    // Escala / Tipo
    doc.rect(40, y, leftW, 20).fill('#555555');
    doc.fillColor('#FFFFFF').text('ESCALA / HORÁRIO DE TRABALHO', 40, y + 5, { width: leftW, align: 'center' });
    
    doc.rect(40 + leftW, y, rightW, 20).fill('#555555');
    doc.text('TIPO DE CONTRATAÇÃO', 40 + leftW, y + 5, { width: rightW, align: 'center' });
    y += 20;

    doc.fillColor('#000000');
    // Escala content
    doc.rect(40, y, leftW, 50).stroke();
    doc.font('Helvetica').text(payload.escala_horario || '', 45, y + 15, { width: leftW - 10 });

    // Tipo content
    doc.rect(40 + leftW, y, rightW, 50).stroke();
    const menCheck = payload.tipo_contratacao === 'mensalista' ? '( X )' : '(   )';
    const horCheck = payload.tipo_contratacao === 'horista' ? '( X )' : '(   )';
    doc.font('Helvetica-Bold').text(`MENSALISTA ${menCheck}`, 40 + leftW + 10, y + 15);
    doc.font('Helvetica-Bold').text(`HORISTA       ${horCheck}`, 40 + leftW + 10, y + 35);
    y += 50;

    // Salario Header
    doc.rect(40, y, doc.page.width - 80, 20).fill('#555555');
    doc.fillColor('#FFFFFF').text('SALÁRIO E BENEFÍCIOS:', 40, y + 5, { width: doc.page.width - 80, align: 'center' });
    y += 20;

    doc.fillColor('#000000');
    doc.rect(40, y, doc.page.width - 80, 40).stroke();
    doc.font('Helvetica').text(payload.salario_beneficios || '', 45, y + 10);
    y += 40;

    // Faixa Etaria | Sexo
    doc.rect(40, y, leftW, 20).fill('#555555');
    doc.fillColor('#FFFFFF').text('FAIXA ETÁRIA | IDADE', 40, y + 5, { width: leftW, align: 'center' });
    
    doc.rect(40 + leftW, y, rightW, 20).fill('#555555');
    doc.text('SEXO', 40 + leftW, y + 5, { width: rightW, align: 'center' });
    y += 20;

    doc.fillColor('#000000');
    doc.rect(40, y, leftW, 30).stroke();
    doc.font('Helvetica').text(payload.faixa_etaria || '', 45, y + 10);

    doc.rect(40 + leftW, y, rightW, 30).stroke();
    doc.font('Helvetica').text(payload.sexo || '', 40 + leftW + 10, y + 10);
    y += 30;

    // Detalhamento Header
    doc.rect(40, y, doc.page.width - 80, 35).fill('#555555');
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').text('DETALHAMENTO DO PERFIL / DESCRIÇÃO DE ATIVIDADES', 40, y + 5, { width: doc.page.width - 80, align: 'center' });
    doc.font('Helvetica').fontSize(8).text('Obs.: Nesse campo o solicitante deve preencher as atividades/responsabilidades do cargo e também detalhar o perfil desejado para que o recrutador atenda a solicitação de forma assertiva.', 45, y + 20, { width: doc.page.width - 90, align: 'center' });
    y += 35;

    doc.fillColor('#000000').fontSize(10);
    doc.rect(40, y, doc.page.width - 80, 80).stroke();
    doc.text(payload.detalhamento_atividades || '', 45, y + 5, { width: doc.page.width - 90 });
    y += 80;

    // Experiencia | Formacao
    const halfW = (doc.page.width - 80) / 2;
    doc.rect(40, y, halfW, 20).fill('#555555');
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').text('EXPERIÊNCIA', 40, y + 5, { width: halfW, align: 'center' });
    doc.rect(40 + halfW, y, halfW, 20).fill('#555555');
    doc.text('FORMAÇÃO', 40 + halfW, y + 5, { width: halfW, align: 'center' });
    y += 20;

    doc.fillColor('#000000');
    doc.rect(40, y, halfW, 60).stroke();
    doc.text(payload.experiencia || '', 45, y + 5, { width: halfW - 10 });
    doc.rect(40 + halfW, y, halfW, 60).stroke();
    doc.text(payload.formacao || '', 40 + halfW + 5, y + 5, { width: halfW - 10 });
    y += 60;

    // Requisitos | Observacao
    doc.rect(40, y, halfW, 20).fill('#555555');
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').text('REQUISITOS', 40, y + 5, { width: halfW, align: 'center' });
    doc.rect(40 + halfW, y, halfW, 20).fill('#555555');
    doc.text('OBSERVAÇÃO', 40 + halfW, y + 5, { width: halfW, align: 'center' });
    y += 20;

    doc.fillColor('#000000');
    doc.rect(40, y, halfW, 60).stroke();
    doc.text(payload.requisitos || '', 45, y + 5, { width: halfW - 10 });
    doc.rect(40 + halfW, y, halfW, 60).stroke();
    doc.text(payload.observacao || '', 40 + halfW + 5, y + 5, { width: halfW - 10 });
    y += 80; // Extra space

    // Footer Signature
    doc.font('Helvetica').text('Data: _____/_____/_______', 40, y);
    doc.moveTo(300, y).lineTo(550, y).stroke();
    doc.text('Assinatura do responsável', 300, y + 5);

    if (payload.assinatura) {
        try {
            const sigBuf = Buffer.from(payload.assinatura.replace(/^data:image\/\w+;base64,/, ''), 'base64');
            doc.image(sigBuf, 320, y - 50, { fit: [200, 50] });
        } catch(e) { console.error('Erro img assinatura vaga', e); }
    }

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
        const buffer = await pdfBufferFromTaxaData(item);
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

app.post('/api/vagas', async (req, res) => {
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

app.get('/api/vagas/pdf/:id', async (req, res) => {
    try {
        const db = readVagasDB();
        const item = db.find(i => i.id === req.params.id);
        if (!item) return res.status(404).send('Vaga não encontrada');
        
        const buffer = await pdfBufferFromVagaData(item);
        
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


// Final do arquivo
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
