const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const db = require('../services/db');
const { dpAuth } = require('../middleware/auth');
const pdfService = require('../services/pdfService');

const desligamentoPublicLimiter = rateLimit({
    windowMs: 2 * 60 * 1000,
    max: 10,
    message: { ok: false, erro: 'Muitas tentativas. Tente novamente mais tarde.' }
});

// Public: Submit Interview
router.post('/entrevistas-desligamento', desligamentoPublicLimiter, async (req, res) => {
    try {
        const payload = req.body;
        if (!payload || !payload.nome || !payload.setor || !payload.cargo || !payload.data_admissao || !payload.tipo_desligamento || !payload.motivo_desligamento) {
            return res.status(400).json({ ok: false, erro: 'Campos obrigatórios ausentes' });
        }

        const id = crypto.randomUUID();
        const novo = {
            id,
            ...payload,
            createdAt: new Date().toISOString()
        };

        await db.entrevistasDesligamento.create(novo);

        res.json({ ok: true, id });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao salvar entrevista' });
    }
});

// RH: List
router.get('/rh/entrevistas-desligamento', dpAuth, async (req, res) => {
    try {
        const data = await db.entrevistasDesligamento.getAll();
        const sorted = data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        res.json(sorted);
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao listar entrevistas' });
    }
});

// RH: Get Single
router.get('/rh/entrevistas-desligamento/:id', dpAuth, async (req, res) => {
    try {
        const item = await db.entrevistasDesligamento.getById(req.params.id);
        if (!item) return res.status(404).json({ ok: false, erro: 'Registro não encontrado' });
        res.json(item);
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao buscar registro' });
    }
});

router.get('/rh/entrevistas-desligamento/:id/pdf', dpAuth, async (req, res) => {
    try {
        const item = await db.entrevistasDesligamento.getById(req.params.id);
        if (!item) return res.status(404).send('Registro não encontrado');
        
        const pdfBuffer = await pdfService.pdfBufferFromEntrevistaDesligamentoData(item);
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="entrevista-desligamento-${item.id}.pdf"`,
            'Content-Length': pdfBuffer.length
        });
        res.send(pdfBuffer);
    } catch (e) {
        console.error(e);
        res.status(500).send('Erro ao gerar PDF');
    }
});

module.exports = router;
