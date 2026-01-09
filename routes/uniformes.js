const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../services/db');
const { rhAuth } = require('../middleware/auth');
const pdfService = require('../services/pdfService');

router.get('/uniformes', async (req, res) => {
    try {
        const data = await db.uniformes.getAll();
        res.json(data);
    } catch (e) {
         console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao listar uniformes' });
    }
});

router.post('/uniformes', async (req, res) => {
    try {
        const payload = req.body;
        if (!payload.nome || !payload.itens) {
            return res.status(400).json({ ok: false, erro: 'Dados incompletos' });
        }

        const id = crypto.randomUUID();
        const nova = {
            id,
            ...payload,
            status: 'pendente',
            createdAt: new Date().toISOString()
        };
        
        await db.uniformes.create(nova);

        res.json({ ok: true, id });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao solicitar uniforme' });
    }
});

router.get('/rh/uniformes/solicitacoes', rhAuth, async (req, res) => {
    try {
        const data = await db.uniformes.getAll();
        res.json(data);
    } catch (e) {
         console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao listar solicitações' });
    }
});

router.post('/rh/uniformes/solicitacao/:id/status', rhAuth, async (req, res) => {
    try {
        const { status } = req.body;
        const item = await db.uniformes.getById(req.params.id);
        if (!item) return res.status(404).json({ ok: false, erro: 'Solicitação não encontrada' });
        
        const updated = {
            ...item,
            status,
            updatedAt: new Date().toISOString()
        };
        
        await db.uniformes.update(req.params.id, updated);
        
        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao atualizar status' });
    }
});

router.get('/rh/uniformes/solicitacao/:id/pdf', rhAuth, async (req, res) => {
    try {
        const item = await db.uniformes.getById(req.params.id);
        if (!item) return res.status(404).send('Solicitação não encontrada');
        
        const buffer = await pdfService.pdfBufferFromUniformeData(item);
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="uniforme-${item.nome || 'func'}.pdf"`,
            'Content-Length': buffer.length
        });
        res.send(buffer);
    } catch (e) {
        console.error(e);
        res.status(500).send('Erro ao gerar PDF');
    }
});

module.exports = router;
