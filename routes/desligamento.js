const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../services/db');
const { rhAuth } = require('../middleware/auth');
const pdfService = require('../services/pdfService');

// Public: Submit Interview
router.post('/entrevistas-desligamento', async (req, res) => {
    try {
        const payload = req.body;
        if (!payload.nome || !payload.setor) {
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
router.get('/rh/entrevistas-desligamento', rhAuth, async (req, res) => {
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
router.get('/rh/entrevistas-desligamento/:id', rhAuth, async (req, res) => {
    try {
        const item = await db.entrevistasDesligamento.getById(req.params.id);
        if (!item) return res.status(404).json({ ok: false, erro: 'Registro não encontrado' });
        res.json(item);
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao buscar registro' });
    }
});

router.get('/rh/entrevistas-desligamento/:id/pdf', rhAuth, async (req, res) => {
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
