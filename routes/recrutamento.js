const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../services/db');
const pdfService = require('../services/pdfService');
const { recrutamentoAuth } = require('../middleware/auth');

// Public: Submit Application
router.post('/recrutamento-interno', async (req, res) => {
    try {
        const payload = req.body;
        // Basic validation
        if (!payload.nome || !payload.cargoPretendido || !payload.setor) {
            return res.status(400).json({ ok: false, erro: 'Campos obrigatórios ausentes' });
        }

        const id = crypto.randomUUID();
        const novo = {
            id,
            ...payload,
            status: 'recebido', // recebido, em_analise, aprovado, reprovado
            createdAt: new Date().toISOString()
        };

        await db.recrutamentoInterno.create(novo);

        res.json({ ok: true, id });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao processar recrutamento interno' });
    }
});

// RH: List Applications
router.get('/rh/recrutamento-interno', recrutamentoAuth, async (req, res) => {
    try {
        const data = await db.recrutamentoInterno.getAll();
        const sorted = data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        res.json(sorted);
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao listar recrutamento interno' });
    }
});

// RH: Get Single Application
router.get('/rh/recrutamento-interno/:id', recrutamentoAuth, async (req, res) => {
    try {
        const item = await db.recrutamentoInterno.getById(req.params.id);
        if (!item) return res.status(404).json({ ok: false, erro: 'Registro não encontrado' });
        res.json(item);
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao buscar registro' });
    }
});

router.get('/rh/recrutamento-interno/:id/pdf', recrutamentoAuth, async (req, res) => {
    try {
        const item = await db.recrutamentoInterno.getById(req.params.id);
        if (!item) return res.status(404).send('Registro não encontrado');

        const pdfBuffer = await pdfService.pdfBufferFromRecrutamentoInternoData(item);

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="recrutamento-${item.id}.pdf"`,
            'Content-Length': pdfBuffer.length
        });
        res.send(pdfBuffer);
    } catch (e) {
        console.error(e);
        res.status(500).send('Erro ao gerar PDF');
    }
});

// RH: Update Status
router.post('/rh/recrutamento-interno/:id/status', recrutamentoAuth, async (req, res) => {
    try {
        const { status, observacao } = req.body;
        const item = await db.recrutamentoInterno.getById(req.params.id);
        
        if (!item) return res.status(404).json({ ok: false, erro: 'Registro não encontrado' });

        const updated = {
            ...item,
            status: status || item.status,
            observacao_rh: observacao || item.observacao_rh,
            updatedAt: new Date().toISOString()
        };

        await db.recrutamentoInterno.update(req.params.id, updated);
        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao atualizar status' });
    }
});

module.exports = router;
