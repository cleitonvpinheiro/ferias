const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../services/db');
const { rhAuth } = require('../middleware/auth');
const { pdfBufferFromOnTheJobData } = require('../services/pdfService');

// Public: Submit On The Job
router.post('/on-the-job', async (req, res) => {
    try {
        const payload = req.body;
        // Validation could be more extensive
        if (!payload.colaboradorNome || !payload.empresa) {
            return res.status(400).json({ ok: false, erro: 'Campos obrigatórios ausentes' });
        }

        const id = crypto.randomUUID();
        const novo = {
            id,
            ...payload,
            status: 'pendente',
            createdAt: new Date().toISOString()
        };

        await db.onthejob.create(novo);

        res.json({ ok: true, id });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao salvar On The Job' });
    }
});

// RH: List
router.get('/rh/on-the-job', rhAuth, async (req, res) => {
    try {
        const data = await db.onthejob.getAll();
        const sorted = data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        res.json(sorted);
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao listar On The Job' });
    }
});

// RH: Get Single
router.get('/rh/on-the-job/:id', rhAuth, async (req, res) => {
    try {
        const item = await db.onthejob.getById(req.params.id);
        if (!item) return res.status(404).json({ ok: false, erro: 'Registro não encontrado' });
        res.json(item);
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao buscar registro' });
    }
});

// PDF Generation
router.get('/rh/on-the-job/:id/pdf', rhAuth, async (req, res) => {
    try {
        const item = await db.onthejob.getById(req.params.id);
        if (!item) return res.status(404).send('Registro não encontrado');

        const payload = {
            ...item,
            colaborador: item.colaboradorNome || item.colaborador || 'N/A'
        };

        const buffer = await pdfBufferFromOnTheJobData(payload);

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Length': buffer.length,
            'Content-Disposition': `inline; filename="OnTheJob_${item.colaboradorNome || 'func'}.pdf"`
        });
        res.send(buffer);
    } catch (e) {
        console.error(e);
        res.status(500).send('Erro ao gerar PDF');
    }
});

module.exports = router;
