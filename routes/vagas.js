const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../services/db');
const emailService = require('../services/email');
const pdfService = require('../services/pdfService');
const { recrutamentoAuth, verifyToken, checkRole, ROLES } = require('../middleware/auth');

const vagasCreateAuth = [verifyToken, checkRole([ROLES.GESTOR, ROLES.SUPERVISOR, ROLES.GERENTE, ROLES.RECRUTAMENTO, ROLES.RH_GERAL, ROLES.RH, ROLES.ADMIN])];
const gerenteAuth = [verifyToken, checkRole([ROLES.GERENTE, ROLES.ADMIN])];

router.get('/rh/vagas', recrutamentoAuth, async (req, res) => {
    try {
        const data = await db.vagas.getAll();
        const lista = (data || [])
            .filter(v => String(v && v.status || '').trim().toLowerCase() !== 'pendente_gerente')
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        res.json(lista);
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao listar vagas' });
    }
});

router.get('/gerente/vagas', gerenteAuth, async (req, res) => {
    try {
        const data = await db.vagas.getAll();
        const lista = (data || [])
            .filter(v => String(v && v.status || '').trim().toLowerCase() === 'pendente_gerente')
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        res.json(lista);
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao listar vagas' });
    }
});

router.post('/gerente/vagas/:id/aprovar', gerenteAuth, async (req, res) => {
    try {
        const id = String(req.params.id || '').trim();
        if (!id) return res.status(400).json({ ok: false, erro: 'ID inválido' });

        const vaga = await db.vagas.getById(id);
        if (!vaga) return res.status(404).json({ ok: false, erro: 'Vaga não encontrada' });

        const statusAtual = String(vaga.status || '').trim().toLowerCase();
        if (statusAtual !== 'pendente_gerente') {
            return res.status(409).json({ ok: false, erro: 'Vaga não está pendente para aprovação do gerente' });
        }

        const username = req.user && req.user.username ? String(req.user.username) : null;
        const nome = req.user && req.user.name ? String(req.user.name) : null;
        const email = req.user && req.user.email ? String(req.user.email) : null;

        vaga.status = 'pendente';
        vaga.ativa = true;
        vaga.aprovado_por_gerente_username = username;
        vaga.aprovado_por_gerente_nome = nome;
        vaga.aprovado_por_gerente_email = email;
        vaga.aprovado_por_gerente_at = new Date().toISOString();
        vaga.updatedAt = new Date().toISOString();

        await db.vagas.update(id, vaga);
        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao aprovar vaga' });
    }
});

router.post('/vagas', vagasCreateAuth, async (req, res) => {
    try {
        const payload = req.body || {};

        const username = req.user && req.user.username ? String(req.user.username) : '';
        const emailUsuario = req.user && req.user.email ? String(req.user.email) : '';
        payload.email_gestor = emailUsuario || (username ? `${username}@familiamadalosso.com.br` : null);
        payload.gestor_nome = req.user && req.user.name ? String(req.user.name) : null;
        payload.gestor_username = username || null;

        if (!payload.cargo || !payload.setor) {
            return res.status(400).json({ ok: false, erro: 'Campos obrigatórios ausentes' });
        }

        const motivo = String(payload.motivo || '').trim().toLowerCase();
        if (motivo === 'substituicao') {
            const substituicaoId = String(payload.substituicao_id || '').trim();
            const substituicaoNome = String(payload.substituicao_nome || '').trim();
            const dataDesligamento = String(payload.data_desligamento || '').trim();

            if (!substituicaoId && !substituicaoNome) {
                return res.status(400).json({ ok: false, erro: 'Colaborador a ser desligado é obrigatório para substituição' });
            }
            if (!dataDesligamento) {
                return res.status(400).json({ ok: false, erro: 'Data prevista de desligamento é obrigatória para substituição' });
            }

            payload.sera_desligado = 'sim';

            if (substituicaoId) {
                const func = await db.funcionarios.getById(substituicaoId);
                if (!func) {
                    return res.status(400).json({ ok: false, erro: 'Colaborador a ser desligado inválido' });
                }
                const cargoVaga = String(payload.cargo || '').trim();
                const cargoFunc = String(func.cargo || '').trim();
                if (cargoVaga && cargoFunc && cargoVaga !== cargoFunc) {
                    return res.status(400).json({ ok: false, erro: 'O colaborador selecionado não corresponde à função escolhida' });
                }
            }

            const normDoc = (v) => String(v || '').replace(/\D/g, '');
            const normNome = (v) => String(v || '').trim().toLowerCase();
            const novoDoc = normDoc(payload.substituicao_cpf || payload.substituicao_doc);
            const novoId = substituicaoId;
            const novoNome = normNome(substituicaoNome);

            const existentes = await db.vagas.getAll();
            const conflito = (existentes || []).find(v => {
                if (!v) return false;
                if (String(v.motivo || '').trim().toLowerCase() !== 'substituicao') return false;
                const status = String(v.status || '').trim().toLowerCase();
                if (status === 'rejeitada' || status === 'reprovada') return false;

                const doc = normDoc(v.substituicao_cpf || v.substituicao_doc);
                const id = String(v.substituicao_id || '').trim();
                const nome = normNome(v.substituicao_nome);

                if (novoDoc) {
                    if (doc && doc === novoDoc) return true;
                    if (!doc && novoNome && nome === novoNome) return true;
                    return false;
                }

                if (novoId) {
                    if (id && id === novoId) return true;
                    if (!id && novoNome && nome === novoNome) return true;
                    return false;
                }

                return !!(novoNome && nome === novoNome);
            });
            if (conflito) {
                return res.status(409).json({ ok: false, erro: 'Já existe uma vaga de substituição cadastrada para este colaborador' });
            }
        }

        const id = crypto.randomUUID();
        const role = req.user && req.user.role ? String(req.user.role).trim().toLowerCase() : '';
        const statusInicial = role === ROLES.SUPERVISOR ? 'pendente_gerente' : 'pendente';
        const ativaInicial = role === ROLES.SUPERVISOR ? false : true;
        const novaVaga = {
            id,
            ...payload,
            status: statusInicial,
            ativa: ativaInicial,
            createdAt: new Date().toISOString()
        };
        
        await db.vagas.create(novaVaga);

        res.json({ ok: true, id });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao criar vaga' });
    }
});

router.put('/vagas/:id', recrutamentoAuth, async (req, res) => {
    try {
        const id = String(req.params.id || '').trim();
        if (!id) return res.status(400).json({ ok: false, erro: 'ID inválido' });

        const vaga = await db.vagas.getById(id);
        if (!vaga) return res.status(404).json({ ok: false, erro: 'Vaga não encontrada' });

        const body = req.body || {};
        const hasAtiva = Object.prototype.hasOwnProperty.call(body, 'ativa');
        const hasStatus = Object.prototype.hasOwnProperty.call(body, 'status');
        if (!hasAtiva && !hasStatus) return res.status(400).json({ ok: false, erro: 'Nenhum campo para atualizar' });

        if (hasAtiva) vaga.ativa = !!body.ativa;
        if (hasStatus) vaga.status = String(body.status || '').trim().toLowerCase() || vaga.status;
        vaga.updatedAt = new Date().toISOString();

        await db.vagas.update(id, vaga);
        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao atualizar vaga' });
    }
});

router.delete('/vagas/:id', recrutamentoAuth, async (req, res) => {
    try {
        const id = String(req.params.id || '').trim();
        if (!id) return res.status(400).json({ ok: false, erro: 'ID inválido' });
        const vaga = await db.vagas.getById(id);
        if (!vaga) return res.status(404).json({ ok: false, erro: 'Vaga não encontrada' });

        await db.vagas.delete(id);
        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao excluir vaga' });
    }
});

router.post('/vagas/avaliar', recrutamentoAuth, async (req, res) => {
    try {
        const { id, status, justificativa } = req.body;
        if (!id || !status) {
            return res.status(400).json({ ok: false, erro: 'ID e Status obrigatórios' });
        }

        const vaga = await db.vagas.getById(id);
        if (!vaga) {
            return res.status(404).json({ ok: false, erro: 'Vaga não encontrada' });
        }

        vaga.status = status;
        vaga.justificativa_rh = justificativa;
        
        if (status === 'rejeitada' || status === 'reprovada') {
            vaga.ativa = false;
        } else if (status === 'aprovada') {
            vaga.ativa = true;
        }

        vaga.updatedAt = new Date().toISOString();
        
        await db.vagas.update(id, vaga);

        if (status === 'rejeitada' || status === 'reprovada') {
             await emailService.notificarGestorVaga(vaga, status, justificativa);
        }

        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao avaliar vaga' });
    }
});

router.get('/rh/vagas/:id/sugestoes', recrutamentoAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const vaga = await db.vagas.getById(id);
        if (!vaga) return res.status(404).json({ ok: false, erro: 'Vaga não encontrada' });

        const candidatos = await db.candidatos.getAll();
        
        // Simple fuzzy matching logic
        const termo = (vaga.titulo || vaga.cargo || '').toLowerCase();
        
        if (!termo) return res.json([]);

        const sugestoes = candidatos.filter(c => {
            // Check recent experience or desired position
            const cargo1 = (c.cargo1 || '').toLowerCase();
            const cargo2 = (c.cargo2 || '').toLowerCase();
            // Some candidates might have 'cargo' if imported from legacy
            const cargo = (c.cargo || '').toLowerCase();

            return cargo1.includes(termo) || 
                   cargo2.includes(termo) || 
                   cargo.includes(termo);
        });

        res.json(sugestoes);
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao buscar sugestões' });
    }
});

router.get('/rh/vagas/:id/pdf', recrutamentoAuth, async (req, res) => {
    try {
        const item = await db.vagas.getById(req.params.id);
        if (!item) return res.status(404).send('Registro não encontrado');
        const pdfBuffer = await pdfService.pdfBufferFromVagaData(item);
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="vaga-${item.id}.pdf"`,
            'Content-Length': pdfBuffer.length
        });
        res.send(pdfBuffer);
    } catch (e) {
        console.error(e);
        res.status(500).send('Erro ao gerar PDF');
    }
});

module.exports = router;
