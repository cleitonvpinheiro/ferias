const express = require('express');
const router = express.Router();
const db = require('../services/db');
const crypto = require('crypto');
const emailService = require('../services/email');
const { dpAuth, verifyToken, checkRole, ROLES } = require('../middleware/auth');

const solicitacaoTaxaFormAuth = [verifyToken, checkRole([ROLES.DP, ROLES.RH_GERAL, ROLES.RH, ROLES.GESTOR])];

// Endpoint público para criar solicitação
router.post('/solicitacao-taxa', solicitacaoTaxaFormAuth, async (req, res) => {
    try {
        const payload = req.body;
        // Validação básica
        if (!payload.solicitante || !payload.departamento || !payload.funcao_necessaria || !payload.motivo || !payload.data_necessaria) {
            return res.status(400).json({ message: 'Campos obrigatórios faltando.' });
        }

        const id = crypto.randomUUID();
        const newItem = {
            id,
            solicitante: payload.solicitante,
            departamento: payload.departamento,
            funcao_necessaria: payload.funcao_necessaria,
            motivo: payload.motivo,
            detalhe_motivo: payload.detalhe_motivo || '',
            data_necessaria: payload.data_necessaria,
            horario_inicio: payload.horario_inicio,
            horario_fim: payload.horario_fim,
            quantidade_vagas: parseInt(payload.quantidade_vagas) || 1,
            observacoes: payload.observacoes || '',
            status: 'pendente',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        await db.solicitacoesTaxa.create(newItem);
        
        // TODO: Enviar email para RH avisando da nova solicitação?
        
        res.json({ ok: true, message: 'Solicitação enviada com sucesso!', id });
    } catch (e) {
        console.error('Erro ao criar solicitação de taxa:', e);
        res.status(500).json({ ok: false, message: 'Erro interno no servidor.' });
    }
});

// Endpoint protegido para listar solicitações (Para Dashboard RH)
router.get('/rh/solicitacoes-taxa', dpAuth, async (req, res) => {
    try {
        const data = await db.solicitacoesTaxa.getAll();
        res.json(data);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Erro ao buscar solicitações.' });
    }
});

// Endpoint protegido para atualizar status (Aprovar/Reprovar)
router.put('/rh/solicitacoes-taxa/:id', dpAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body; // Espera { status: 'aprovado' | 'reprovado' }
        
        const existing = await db.solicitacoesTaxa.getById(id);
        if (!existing) return res.status(404).json({ message: 'Solicitação não encontrada' });

        const updatedItem = {
            ...existing,
            ...updates,
            updatedAt: new Date().toISOString()
        };

        await db.solicitacoesTaxa.update(id, updatedItem);

        if (updates.status === 'aprovado' || updates.status === 'reprovado') {
            await emailService.enviarEmailResultadoSolicitacaoTaxa(updatedItem, updates.status === 'aprovado');
        }

        res.json({ ok: true, message: 'Solicitação atualizada.' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Erro ao atualizar.' });
    }
});

module.exports = router;
