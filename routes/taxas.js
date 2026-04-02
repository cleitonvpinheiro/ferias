const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../services/db');
const emailService = require('../services/email');
const pdfService = require('../services/pdfService');
const { dpAuth, verifyToken, checkRole, ROLES } = require('../middleware/auth');
const { normalizeCpf, isValidCpf } = require('../utils/validation');

const taxasFormAuth = [verifyToken, checkRole([ROLES.DP, ROLES.RH_GERAL, ROLES.RH, ROLES.GESTOR, ROLES.SUPERVISOR, ROLES.GERENTE])];
const gestorTaxasAuth = [verifyToken, checkRole([ROLES.GESTOR, ROLES.SUPERVISOR, ROLES.GERENTE])];

const normalizeName = (v) => {
    const s = String(v || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[.]/g, '')
        .replace(/\s+/g, ' ');
    return s;
};

const getApprovalToken = (item) => (item && (item.approval_token || item.approvalToken)) || null;
const setApprovalToken = (item, token) => {
    if (!item) return;
    item.approval_token = token || null;
    item.approvalToken = token || null;
};

const getSignatureToken = (item) => (item && (item.signature_token || item.signatureToken)) || null;
const setSignatureToken = (item, token) => {
    if (!item) return;
    item.signature_token = token || null;
    item.signatureToken = token || null;
};

const APROVADOR_POR_COLABORADOR = (() => {
    const m = new Map();
    const add = (aprovador, colaboradores) => {
        colaboradores.forEach(nome => m.set(normalizeName(nome), aprovador));
    };
    add('Anderson', ['Ricardo', 'Janete', 'Romário', 'Jamille']);
    add('Adriana', ['Marcelo C', 'Regina', 'Ergeton', 'Priscila']);
    add('Michelly', ['Andréa', 'Jadson', 'Wesley', 'Giovana']);
    add('Luciana', ['Gianna']);
    add('Leonardo', ['Marcelo B']);
    add('Jaqueline', ['Hebert', 'Taynna', 'Janaina', 'Juninho']);
    return m;
})();

const resolveAprovadorNome = (colaboradorNome) => {
    const norm = normalizeName(colaboradorNome);
    if (!norm) return null;
    const direct = APROVADOR_POR_COLABORADOR.get(norm);
    if (direct) return direct;
    const parts = norm.split(' ').filter(Boolean);
    const first = parts[0] || '';
    if (first) {
        const byFirst = APROVADOR_POR_COLABORADOR.get(first);
        if (byFirst) return byFirst;
    }
    if (parts.length >= 2) {
        const key = `${first} ${String(parts[1] || '').slice(0, 1)}`.trim();
        const byInitial = APROVADOR_POR_COLABORADOR.get(key);
        if (byInitial) return byInitial;
    }
    return null;
};

const resolveAprovadorUser = async (aprovadorNome) => {
    if (!aprovadorNome) return null;
    const target = normalizeName(aprovadorNome);
    if (!target) return null;
    const users = await db.users.getAll();
    const gestores = (users || []).filter(u => String(u && u.role || '').trim().toLowerCase() === ROLES.GESTOR);
    return gestores.find(u => normalizeName(u && (u.name || u.username)) === target) || null;
};

const isUserAprovadorDaTaxa = (user, item) => {
    const userUsername = String(user && user.username || '').trim().toLowerCase();
    const itemUsername = String(item && item.aprovador_username || '').trim().toLowerCase();
    if (userUsername && itemUsername) return userUsername === itemUsername;
    const userKey = normalizeName(user && (user.name || user.username));
    const aprovadorKey = normalizeName(item && item.aprovador_nome);
    return !!userKey && !!aprovadorKey && userKey === aprovadorKey;
};

async function getGestorSetores(username) {
    if (!username) return [];
    const equipe = await db.gestorEquipes.getEquipeByGestor(username);
    const norm = (v) => String(v || '').trim().toUpperCase();
    const setores = (equipe || [])
        .map(f => norm(f && f.setor))
        .filter(Boolean);
    return Array.from(new Set(setores));
}

router.post('/taxas/draft', taxasFormAuth, async (req, res) => {
    try {
        const payload = req.body || {};
        const cpfDigits = normalizeCpf(payload.cpf);
        if (cpfDigits && cpfDigits.length === 11 && isValidCpf(cpfDigits)) {
            payload.cpf = cpfDigits;
        } else {
            delete payload.cpf;
        }

        if (payload.forma_pagamento === 'youcard') {
            payload.pix = cpfDigits && cpfDigits.length === 11 ? cpfDigits : '';
        }
        let id = payload.id;
        
        if (id) {
            const item = await db.taxas.getById(id);
            if (item) {
                const updated = { ...item, ...payload, updatedAt: new Date().toISOString() };
                await db.taxas.update(id, updated);
                return res.json({ ok: true, id });
            }
        }

        id = id || crypto.randomUUID();
        const novoRascunho = {
            id,
            ...payload,
            status: 'rascunho',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        await db.taxas.create(novoRascunho);
        
        res.json({ ok: true, id });
    } catch (e) {
        console.error('Erro ao salvar rascunho:', e);
        res.status(500).json({ ok: false, erro: 'Erro ao salvar rascunho' });
    }
});

router.post('/taxas', taxasFormAuth, async (req, res) => {
    try {
        const payload = req.body || {};
        const cpfDigits = normalizeCpf(payload.cpf);
        if (!cpfDigits || !isValidCpf(cpfDigits)) {
            return res.status(400).json({ message: 'CPF inválido.' });
        }
        payload.cpf = cpfDigits;
        if (!payload.nome_taxa || !payload.cpf || !payload.valores) {
            return res.status(400).json({ message: 'Dados incompletos.' });
        }
        
        const depNormLimit = String(payload.departamento || '').trim().toUpperCase();
        if (!depNormLimit) {
            return res.status(400).json({ message: 'Departamento inválido.' });
        }
        const todas = await db.taxas.getAll();
        const ativos = new Set(['aguardando_aprovacao_gestor', 'aguardando_aprovacao_rh', 'pendente', 'aguardando_assinatura']);
        const ativosSetor = todas.filter(x => String(x.departamento || '').trim().toUpperCase() === depNormLimit && ativos.has(String(x.status || '').toLowerCase()));
        if (ativosSetor.length >= 3) {
            return res.status(400).json({ message: 'Limite de 3 solicitações ativas para este setor.' });
        }
        
        if (req.user && req.user.role === ROLES.GESTOR) {
            const setores = await getGestorSetores(req.user.username);
            if (!setores.length) {
                return res.status(403).json({ message: 'Setor do gestor não configurado.' });
            }
            const depNorm = String(payload.departamento || '').trim().toUpperCase();
            if (!depNorm || !setores.includes(depNorm)) {
                return res.status(403).json({ message: 'Departamento inválido para este gestor.' });
            }
            payload.departamento = depNorm;
        }

        if (payload.forma_pagamento === 'youcard') {
            payload.pix = cpfDigits;
        }

        let id = payload.id;
        let item = null;
        
        if (id) {
            const existing = await db.taxas.getById(id);
            if (existing) {
                 item = {
                    ...existing,
                    ...payload,
                    status: 'pendente',
                    updatedAt: new Date().toISOString()
                };
                await db.taxas.update(id, item);
            } else {
                item = {
                    id,
                    ...payload,
                    status: 'pendente',
                    createdAt: new Date().toISOString()
                };
                await db.taxas.create(item);
            }
        } else {
             id = crypto.randomUUID();
             item = {
                id,
                ...payload,
                status: 'pendente',
                createdAt: new Date().toISOString()
            };
            await db.taxas.create(item);
        }
        
        try {
            const funcionarios = await db.funcionarios.getAll();
            const cpfLimpo = cpfDigits;
            
            if (cpfLimpo) {
                const existingFunc = funcionarios.find(f => f.cpf && f.cpf.replace(/\D/g, '') === cpfLimpo);
                
                const dadosFuncionario = {
                    id: existingFunc ? existingFunc.id : crypto.randomUUID(),
                    nome: payload.nome_taxa,
                    cpf: cpfLimpo,
                    funcao: payload.funcao,
                    departamento: payload.departamento,
                    updatedAt: new Date().toISOString()
                };
                
                if (payload.forma_pagamento === 'pix') {
                    dadosFuncionario.chave_pix = payload.pix;
                } else if (payload.forma_pagamento === 'transferencia') {
                    dadosFuncionario.banco = payload.banco;
                    dadosFuncionario.agencia = payload.agencia;
                    dadosFuncionario.conta = payload.conta;
                    dadosFuncionario.tipo_conta = payload.tipo_conta;
                }

                if (existingFunc) {
                    await db.funcionarios.update(existingFunc.id, { ...existingFunc, ...dadosFuncionario });
                } else {
                    await db.funcionarios.create({ ...dadosFuncionario, createdAt: new Date().toISOString() });
                }
            }
        } catch (e) {
            console.error('Erro ao salvar dados do funcionario:', e);
        }

    const aprovadorNome = resolveAprovadorNome(item.nome_taxa);
    if (aprovadorNome) {
        item.status = 'aguardando_aprovacao_gestor';
        item.aprovador_nome = aprovadorNome;

        const aprovadorUser = await resolveAprovadorUser(aprovadorNome);
        item.aprovador_username = aprovadorUser ? aprovadorUser.username : null;
        if (aprovadorUser) {
            item.email_gestor = aprovadorUser.email || `${aprovadorUser.username}@familiamadalosso.com.br`;
        } else {
            item.email_gestor = null;
        }

        const token = crypto.randomBytes(32).toString('hex');
        setApprovalToken(item, token);
        setSignatureToken(item, null);
        item.updatedAt = new Date().toISOString();
        await db.taxas.update(id, item);

        if (item.email_gestor) {
            try { await emailService.enviarEmailAprovacaoTaxa(item, token); } catch (_) {}
        }

        return res.json({ message: `Solicitação enviada para aprovação de ${aprovadorNome}!`, id });
    }

    item.status = 'aguardando_aprovacao_rh';
    item.aprovador_nome = null;
    item.aprovador_username = null;
    setApprovalToken(item, null);
    setSignatureToken(item, null);
    item.updatedAt = new Date().toISOString();
    await db.taxas.update(id, item);
    await emailService.enviarEmailTaxasRH(item);
    res.json({ message: 'Solicitação enviada para aprovação do RH!', id });
    
} catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Erro interno no servidor.' });
    }
});

router.get('/rh/taxas', dpAuth, async (req, res) => {
    const data = await db.taxas.getAll();
    const filtered = data.filter(item => item.status !== 'rascunho');
    res.json(filtered);
});

router.put('/rh/taxas/:id', dpAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        const existing = await db.taxas.getById(id);
        if (!existing) return res.status(404).json({ message: 'Taxa não encontrada' });

        const updatedItem = {
            ...existing,
            ...updates,
            updatedAt: new Date().toISOString()
        };

        await db.taxas.update(id, updatedItem);
        res.json({ ok: true, message: 'Dados atualizados com sucesso!' });
    } catch (e) {
        console.error('Erro ao atualizar taxa:', e);
        res.status(500).json({ message: 'Erro ao atualizar dados.' });
    }
});

router.post('/rh/taxas/:id/aprovar', dpAuth, async (req, res) => {
    const item = await db.taxas.getById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Taxa não encontrada' });

    const status = String(item.status || '').toLowerCase();
    if (!['aguardando_aprovacao_rh', 'pendente'].includes(status)) {
        return res.status(400).json({ message: 'Status inválido para aprovação do RH.' });
    }
    
    // Change status to waiting for signature
    const signatureToken = crypto.randomBytes(32).toString('hex');
    item.status = 'aguardando_assinatura';
    setSignatureToken(item, signatureToken);
    setApprovalToken(item, null);
    item.updatedAt = new Date().toISOString();
    
    await db.taxas.update(item.id, item);
    
    // Send email to collaborator (solicitante) to sign
    await emailService.enviarSolicitacaoAssinaturaTaxa(item, signatureToken);
    
    res.json({ message: 'Aprovado pelo RH. Enviado para assinatura do colaborador.' });
});

router.get('/taxas/dados-assinatura', async (req, res) => {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Token não fornecido' });
    
    const data = await db.taxas.getAll();
    const item = data.find(i => getSignatureToken(i) === token && i.status === 'aguardando_assinatura');
    
    if (!item) return res.status(404).json({ error: 'Solicitação não encontrada ou já assinada.' });
    
    res.json(item);
});

router.post('/taxas/assinar', async (req, res) => {
    const { token, assinatura } = req.body;
    if (!token || !assinatura) return res.status(400).json({ error: 'Dados incompletos' });
    
    const data = await db.taxas.getAll();
    const item = data.find(i => getSignatureToken(i) === token && i.status === 'aguardando_assinatura');
    
    if (!item) return res.status(404).json({ error: 'Solicitação não encontrada' });
    
    item.assinatura_taxa = assinatura;
    item.status = 'aprovado'; // Final status
    item.signedAt = new Date().toISOString();
    setSignatureToken(item, null); // Consume token
    
    await db.taxas.update(item.id, item);
    
    // Notify RH/Gestor? Maybe later.
    
    let pdf = null;
    let filename = null;
    try {
        const buffer = await pdfService.pdfBufferFromTaxaData(item);
        pdf = 'data:application/pdf;base64,' + buffer.toString('base64');
        const baseName = String(item.nome_taxa || 'taxa')
            .trim()
            .replace(/[\\/:*?"<>|]+/g, '-')
            .replace(/\s+/g, ' ')
            .slice(0, 80);
        filename = `taxa-${baseName || 'assinada'}.pdf`;
    } catch (e) {
        console.error('Erro ao gerar PDF após assinatura:', e);
    }

    res.json({ ok: true, message: 'Assinado com sucesso!', pdf, filename });
});

router.post('/rh/taxas/:id/reprovar', dpAuth, async (req, res) => {
    const item = await db.taxas.getById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Taxa não encontrada' });
    
    item.status = 'reprovado';
    setApprovalToken(item, null);
    item.updatedAt = new Date().toISOString();
    await db.taxas.update(item.id, item);
    if (item.email_solicitante) {
        try { await emailService.enviarEmailResultadoTaxa(item, false); } catch (_) {}
    }
    res.json({ message: 'Reprovado com sucesso' });
});

router.get('/gestor/taxas', gestorTaxasAuth, async (req, res) => {
    const data = await db.taxas.getAll();
    const filtered = data
        .filter(item => item.status !== 'rascunho')
        .filter(item => String(item.status || '').toLowerCase() === 'aguardando_aprovacao_gestor')
        .filter(item => isUserAprovadorDaTaxa(req.user, item));
    res.json(filtered);
});

router.post('/gestor/taxas/:id/aprovar', gestorTaxasAuth, async (req, res) => {
    const item = await db.taxas.getById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Taxa não encontrada' });
    if (String(item.status || '').toLowerCase() !== 'aguardando_aprovacao_gestor') {
        return res.status(400).json({ message: 'Item não está aguardando aprovação do gestor.' });
    }
    if (!isUserAprovadorDaTaxa(req.user, item)) {
        return res.status(403).json({ message: 'Você não tem permissão para aprovar esta taxa.' });
    }

    item.status = 'aguardando_aprovacao_rh';
    item.approvedAt = new Date().toISOString();
    item.gestorApprovedAt = new Date().toISOString();
    item.gestorApprovedBy = req.user && req.user.username;
    item.updatedAt = new Date().toISOString();
    await db.taxas.update(item.id, item);

    await emailService.enviarEmailTaxasRH(item);
    if (item.email_solicitante) {
        try { await emailService.enviarEmailResultadoTaxa(item, true); } catch (_) {}
    }

    res.json({ ok: true, message: 'Aprovado pelo gestor. Encaminhado para o RH.' });
});

// Gestor pode solicitar assinatura diretamente ao finalizar
router.post('/gestor/taxas/:id/solicitar-assinatura', gestorTaxasAuth, async (req, res) => {
    try {
        const item = await db.taxas.getById(req.params.id);
        if (!item) return res.status(404).json({ message: 'Taxa não encontrada' });
        const status = String(item.status || '').toLowerCase();
        if (status !== 'aguardando_aprovacao_gestor') {
            return res.status(400).json({ message: 'Item não está aguardando aprovação do gestor.' });
        }
        if (!isUserAprovadorDaTaxa(req.user, item)) {
            return res.status(403).json({ message: 'Você não tem permissão para esta taxa.' });
        }
        const signatureToken = crypto.randomBytes(32).toString('hex');
        item.status = 'aguardando_assinatura';
        setSignatureToken(item, signatureToken);
        setApprovalToken(item, null);
        item.gestorApprovedAt = new Date().toISOString();
        item.gestorApprovedBy = req.user && req.user.username;
        item.updatedAt = new Date().toISOString();
        await db.taxas.update(item.id, item);
        await emailService.enviarSolicitacaoAssinaturaTaxa(item, signatureToken);
        res.json({ ok: true, message: 'Assinatura solicitada ao colaborador.' });
    } catch (e) {
        console.error('Erro ao solicitar assinatura (gestor):', e);
        res.status(500).json({ message: 'Erro ao solicitar assinatura.' });
    }
});

router.post('/gestor/taxas/:id/reprovar', gestorTaxasAuth, async (req, res) => {
    const item = await db.taxas.getById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Taxa não encontrada' });
    if (String(item.status || '').toLowerCase() !== 'aguardando_aprovacao_gestor') {
        return res.status(400).json({ message: 'Item não está aguardando aprovação do gestor.' });
    }
    if (!isUserAprovadorDaTaxa(req.user, item)) {
        return res.status(403).json({ message: 'Você não tem permissão para reprovar esta taxa.' });
    }

    item.status = 'reprovado';
    item.rejectedAt = new Date().toISOString();
    item.gestorRejectedAt = new Date().toISOString();
    item.gestorRejectedBy = req.user && req.user.username;
    item.updatedAt = new Date().toISOString();
    await db.taxas.update(item.id, item);

    if (item.email_solicitante) {
        try { await emailService.enviarEmailResultadoTaxa(item, false); } catch (_) {}
    }

    res.json({ ok: true, message: 'Reprovado pelo gestor.' });
});

router.post('/rh/taxas/:id/reenviar-aprovacao-gestor', dpAuth, async (req, res) => {
    try {
        const item = await db.taxas.getById(req.params.id);
        if (!item) return res.status(404).json({ message: 'Taxa não encontrada' });
        const status = String(item.status || '').toLowerCase();
        if (!['aguardando_aprovacao_gestor', 'aguardando_aprovacao'].includes(status)) {
            return res.status(400).json({ message: 'Item não está aguardando aprovação do gestor.' });
        }
        if (!item.email_gestor) return res.status(400).json({ message: 'E-mail do gestor não informado.' });

        let token = getApprovalToken(item);
        if (!token) {
            token = crypto.randomBytes(32).toString('hex');
            setApprovalToken(item, token);
            item.updatedAt = new Date().toISOString();
            await db.taxas.update(item.id, item);
        }

        await emailService.enviarEmailAprovacaoTaxa(item, token);
        res.json({ ok: true, message: 'E-mail de aprovação reenviado ao gestor.' });
    } catch (e) {
        console.error('Erro ao reenviar aprovação do gestor:', e);
        res.status(500).json({ message: 'Erro ao reenviar aprovação do gestor.' });
    }
});

router.post('/rh/taxas/:id/reenviar-assinatura', dpAuth, async (req, res) => {
    try {
        const item = await db.taxas.getById(req.params.id);
        if (!item) return res.status(404).json({ message: 'Taxa não encontrada' });
        if (String(item.status || '').toLowerCase() !== 'aguardando_assinatura') {
            return res.status(400).json({ message: 'Item não está aguardando assinatura.' });
        }

        let token = getSignatureToken(item);
        if (!token) {
            token = crypto.randomBytes(32).toString('hex');
            setSignatureToken(item, token);
            item.updatedAt = new Date().toISOString();
            await db.taxas.update(item.id, item);
        }

        await emailService.enviarSolicitacaoAssinaturaTaxa(item, token);
        res.json({ ok: true, token, message: 'Link de assinatura reenviado ao colaborador.' });
    } catch (e) {
        console.error('Erro ao reenviar assinatura:', e);
        res.status(500).json({ message: 'Erro ao reenviar link de assinatura.' });
    }
});

router.get('/rh/taxas/arquivo-pagamento', dpAuth, async (req, res) => {
    try {
        const XLSX = require('xlsx');
        const data = await db.taxas.getAll();
        const aprovadas = data.filter(i => i.status === 'aprovado');
        if (aprovadas.length === 0) return res.status(400).send('Nenhuma taxa aprovada para pagamento.');
        
        const normStr = (v) => String(v || '').trim();
        const normUpper = (v) => normStr(v).toUpperCase();
        const parseMoney = (v) => {
            const n = Number(String(v || '').replace(',', '.'));
            return isNaN(n) ? 0 : n;
        };
        const primeiraData = (item) => {
            const d = item.dias_trabalhados && Array.isArray(item.dias_trabalhados) && item.dias_trabalhados[0] && item.dias_trabalhados[0].data;
            const src = d || item.created_at || item.updated_at;
            if (!src) return '';
            try { return new Date(src).toLocaleDateString('pt-BR'); } catch { return ''; }
        };
        const motivosText = (m) => {
            const arr = Array.isArray(m) ? m : [];
            return arr.map(x => {
                if (x === 'aumento_demanda') return 'Aumento de Demanda';
                if (x === 'evento') return 'Evento';
                if (x === 'vaga_aberta') return 'Vaga Aberta';
                return normStr(x);
            }).join(' | ');
        };
        const observacaoText = (item) => {
            if (Array.isArray(item.motivo) && item.motivo.includes('evento') && normStr(item.detalhe_motivo)) {
                return normStr(item.detalhe_motivo);
            }
            if (Array.isArray(item.motivo) && item.motivo.includes('vaga_aberta') && normStr(item.antecessor)) {
                return `Antecessor: ${normStr(item.antecessor)}`;
            }
            return '';
        };
        const CLASS_MAP = {
            'ALMOXARIFADO': 'Adm + Indiretos',
            'ATENDIMENTO': 'Matriz',
            'BAR': 'Matriz',
            'CFTV': 'Adm + Indiretos',
            'COMPRAS': 'Adm + Indiretos',
            'CONTROLADORIA': 'Adm + Indiretos',
            'COZINHA ATENDIMENTO': 'Adm + Indiretos',
            'DHO': 'Adm + Indiretos',
            'ESPACO KIDS': 'Matriz',
            'EVENTOS': 'Adm + Indiretos',
            'FABRICA DE MASSAS': 'Fábrica',
            'FINANCEIRO': 'Adm + Indiretos',
            'LAVANDERIA': 'Adm + Indiretos',
            'LIMPEZA': 'Adm + Indiretos',
            'MANUTENCAO': 'Adm + Indiretos',
            'MANUTENÇÃO': 'Adm + Indiretos',
            'MARKETING': 'Adm + Indiretos',
            'PCP PROCESSOS': 'Adm + Indiretos',
            'QUALIDADE': 'Adm + Indiretos',
            'REFEITORIO': 'Adm + Indiretos',
            'REFEITÓRIO': 'Adm + Indiretos',
            'SALAO': 'Adm + Indiretos',
            'SALÃO': 'Adm + Indiretos',
            'SEAP': 'Adm + Indiretos',
            'SEGURANCA': 'Adm + Indiretos',
            'SEGURANÇA': 'Adm + Indiretos',
            'SESMT': 'Adm + Indiretos',
            'SHOPPING BARIGUI': 'Barigui',
            'SHOPPING MUELLER': 'Mueller',
            'SHOPPING PALLADIUM': 'Palladium',
            'TI': 'Adm + Indiretos',
            'TO GO MADALOSSO': 'To Go'
        };
        const classificar = (centro) => {
            const key = normUpper(centro);
            return CLASS_MAP[key] || '';
        };
        
        const rows = aprovadas.map(item => {
            const setor = item.departamento || '';
            const valor = parseMoney(item.valores?.total_geral || 0);
            return {
                'DATA DA TAXA': primeiraData(item),
                'CPF': normStr(item.cpf),
                'NOME COMPLETO': normStr(item.nome_taxa),
                'VALOR': valor,
                'PIX': normStr(item.pix || item.chave_pix),
                'SETOR': normStr(setor),
                'FUNÇÃO': normStr(item.funcao),
                'MOTIVO': motivosText(item.motivo),
                'OBSERVAÇÃO': observacaoText(item),
                'CENTRO DE CUSTO': normStr(setor),
                'CLASSIFICAÇÃO': classificar(setor)
            };
        });
        
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(rows, { header: ['DATA DA TAXA','CPF','NOME COMPLETO','VALOR','PIX','SETOR','FUNÇÃO','MOTIVO','OBSERVAÇÃO','CENTRO DE CUSTO','CLASSIFICAÇÃO'] });
        XLSX.utils.book_append_sheet(wb, ws, 'Pagamentos');
        
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.set({
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="remessa_pagamentos_${new Date().toISOString().split('T')[0]}.xlsx"`
        });
        res.send(buf);
    } catch (e) {
        console.error('Erro ao gerar planilha de pagamentos:', e);
        res.status(500).send('Erro ao gerar planilha');
    }
});

// DP: Benefícios - Últimas compras por CPF
router.get('/rh/beneficios/ultimas-compras', dpAuth, async (req, res) => {
    try {
        const { cpf } = req.query;
        const norm = (v) => (v || '').toString().replace(/\D/g, '');
        const data = await db.taxas.getAll();
        const aprovadas = data.filter(i => i.status === 'aprovado');
        
        const alvoCpf = cpf ? norm(cpf) : null;
        const map = {};
        
        aprovadas.forEach(item => {
            const key = norm(item.cpf);
            if (alvoCpf && key !== alvoCpf) return;
            const vtTotal = Number(item.valores?.vt?.total || 0);
            const taxaTotal = Number(item.valores?.taxa?.total || 0);
            const quando = item.signedAt || item.updatedAt || item.createdAt;
            const quandoDate = quando ? new Date(quando) : null;
            
            if (!map[key]) {
                map[key] = {
                    cpf: key,
                    nome: item.nome_taxa,
                    ultimoVT: null,
                    ultimoVTValor: 0,
                    ultimoOutro: null,
                    ultimoOutroDescricao: null
                };
            }
            if (vtTotal > 0) {
                const currentDate = map[key].ultimoVT ? new Date(map[key].ultimoVT) : null;
                if (!currentDate || (quandoDate && quandoDate > currentDate)) {
                    map[key].ultimoVT = quandoDate ? quandoDate.toISOString() : null;
                    map[key].ultimoVTValor = vtTotal;
                }
            }
            if (taxaTotal > 0) {
                const currentDate2 = map[key].ultimoOutro ? new Date(map[key].ultimoOutro) : null;
                if (!currentDate2 || (quandoDate && quandoDate > currentDate2)) {
                    map[key].ultimoOutro = quandoDate ? quandoDate.toISOString() : null;
                    map[key].ultimoOutroDescricao = 'Taxa Extra';
                }
            }
        });
        
        const result = Object.values(map);
        res.json(alvoCpf ? (result[0] || null) : result);
    } catch (e) {
        console.error('Erro ao calcular últimas compras de benefícios:', e);
        res.status(500).json({ ok: false, erro: 'Erro ao calcular últimas compras' });
    }
});

router.get('/taxas/responder-aprovacao', async (req, res) => {
    try {
        const { token, acao } = req.query;
        if (!token || !['aprovar', 'reprovar'].includes(acao)) {
            return res.status(400).send('Link inválido.');
        }

        const data = await db.taxas.getAll();
        const item = data.find(i => getApprovalToken(i) === token && ['aguardando_aprovacao_gestor', 'aguardando_aprovacao'].includes(i.status));

        if (!item) {
            return res.status(404).send('Solicitação não encontrada ou já processada.');
        }
        
        if (acao === 'aprovar') {
            item.status = 'aguardando_aprovacao_rh';
            setApprovalToken(item, null); // Consume token
            item.approvedAt = new Date().toISOString();
            
            // Notify RH now that it's approved
            await emailService.enviarEmailTaxasRH(item);
            
            // Notify Requester
            if (item.email_solicitante) {
                await emailService.enviarEmailResultadoTaxa(item, true);
            }
        } else {
            item.status = 'reprovado'; // Rejected by Gestor
            setApprovalToken(item, null);
            item.rejectedAt = new Date().toISOString();

            // Notify Requester
            if (item.email_solicitante) {
                await emailService.enviarEmailResultadoTaxa(item, false);
            }
        }

        await db.taxas.update(item.id, item);

        res.send(`
            <html>
                <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                    <h1 style="color: ${acao === 'aprovar' ? 'green' : 'red'}">
                        Solicitação ${acao === 'aprovar' ? 'Aprovada' : 'Reprovada'} com Sucesso!
                    </h1>
                    <p>Você pode fechar esta janela.</p>
                </body>
            </html>
        `);

    } catch (e) {
        console.error(e);
        res.status(500).send('Erro ao processar resposta.');
    }
});

router.get('/taxas/pdf/:id', taxasFormAuth, async (req, res) => {
    const item = await db.taxas.getById(req.params.id);
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

module.exports = router;
