const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../services/db');
const emailService = require('../services/email');
const pdfService = require('../services/pdfService');
const { dpAuth } = require('../middleware/auth');

router.get('/rh/movimentacoes', dpAuth, async (req, res) => {
    try {
        const data = await db.movimentacoes.getAll();
        res.json(data);
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao carregar movimentações' });
    }
});

router.post('/movimentacao', async (req, res) => {
    try {
        const payload = req.body;
        const id = crypto.randomUUID();
        
        const nova = {
            id,
            ...payload,
            status: 'pendente',
            createdAt: new Date().toISOString()
        };
        
        await db.movimentacoes.create(nova);
        
        await emailService.notificarRHMovimentacao(nova);
        
        res.json({ ok: true, id });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao criar movimentação' });
    }
});

router.post('/rh/movimentacao/:id/aprovar', dpAuth, async (req, res) => {
    try {
        const item = await db.movimentacoes.getById(req.params.id);
        if (!item) return res.status(404).json({ ok: false, erro: 'Não encontrado' });
        
        await db.movimentacoes.update(req.params.id, {
            status: 'aprovado',
            updatedAt: new Date().toISOString()
        });
        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao aprovar' });
    }
});

router.post('/rh/movimentacao/:id/reprovar', dpAuth, async (req, res) => {
    try {
        const item = await db.movimentacoes.getById(req.params.id);
        if (!item) return res.status(404).json({ ok: false, erro: 'Não encontrado' });
        
        await db.movimentacoes.update(req.params.id, {
            status: 'reprovado',
            updatedAt: new Date().toISOString()
        });
        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao reprovar' });
    }
});

router.get('/rh/movimentacao/:id/pdf', dpAuth, async (req, res) => {
    try {
        const item = await db.movimentacoes.getById(req.params.id);
        if (!item) return res.status(404).send('Não encontrado');
        
        const buffer = await pdfService.pdfBufferFromMovimentacao(item);
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="movimentacao-${item.nome_colaborador || item.nome || 'func'}.pdf"`,
            'Content-Length': buffer.length
        });
        res.send(buffer);
    } catch (e) {
        console.error(e);
        res.status(500).send('Erro ao gerar PDF');
    }
});

module.exports = router;
