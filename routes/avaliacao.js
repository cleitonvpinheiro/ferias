const express = require('express');
const router = express.Router();
const db = require('../services/db');
const crypto = require('crypto');
const { rhAuth } = require('../middleware/auth');
const pdfService = require('../services/pdfService');

// POST: Submit a new evaluation
router.post('/avaliacao', async (req, res) => {
    try {
        const payload = req.body;
        
        // Basic validation
        if (!payload.tipo || !payload.funcionario || !payload.avaliador) {
            return res.status(400).json({ ok: false, erro: 'Campos obrigatórios ausentes' });
        }

        const novaAvaliacao = {
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
            ...payload
        };

        await db.avaliacoes.create(novaAvaliacao);

        res.json({ ok: true, id: novaAvaliacao.id });
    } catch (error) {
        console.error('Erro ao salvar avaliação:', error);
        res.status(500).json({ ok: false, erro: 'Erro interno ao processar avaliação' });
    }
});

// GET: Get single evaluation
router.get('/avaliacao/:id', async (req, res) => {
    try {
        const item = await db.avaliacoes.getById(req.params.id);
        if (!item) return res.status(404).json({ ok: false, erro: 'Não encontrado' });
        res.json(item);
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao buscar dados.' });
    }
});

// GET: Find evaluation by employee and type (public access needed for form auto-fill)
router.get('/avaliacao/buscar/recente', async (req, res) => {
    try {
        const { funcionario, tipo } = req.query;
        if (!funcionario) return res.status(400).json({ ok: false, erro: 'Funcionário obrigatório' });

        const all = await db.avaliacoes.getAll();
        
        // Find most recent matching
        const matches = all.filter(a => 
            a.funcionario === funcionario && 
            (!tipo || a.tipo === tipo)
        );

        if (matches.length === 0) {
            return res.status(404).json({ ok: false, message: 'Nenhuma avaliação encontrada' });
        }

        // Sort by createdAt desc
        matches.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        res.json(matches[0]);
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao buscar avaliação' });
    }
});

// PUT: Update evaluation (for 2nd stage or corrections)
router.put('/avaliacao/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const payload = req.body;
        
        const existing = await db.avaliacoes.getById(id);
        if (!existing) return res.status(404).json({ ok: false, erro: 'Avaliação não encontrada' });
        
        const updated = {
            ...existing,
            ...payload,
            updatedAt: new Date().toISOString()
        };
        
        await db.avaliacoes.update(id, updated);
        res.json({ ok: true, id, message: 'Avaliação atualizada com sucesso!' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao atualizar.' });
    }
});

// GET: List evaluations (Protected, handled by auth middleware in server.js mounting)
// Can filter by type (lideranca, adm, operacional)
router.get('/avaliacoes', rhAuth, async (req, res) => {
    try {
        const { tipo } = req.query;
        let data = await db.avaliacoes.getAll();

        if (tipo) {
            data = data.filter(item => item.tipo === tipo);
        }

        // Sort by date desc
        data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.json(data);
    } catch (error) {
        console.error('Erro ao listar avaliações:', error);
        res.status(500).json({ ok: false, erro: 'Erro ao buscar avaliações' });
    }
});

router.get('/rh/avaliacoes/:id/pdf', rhAuth, async (req, res) => {
    try {
        const item = await db.avaliacoes.getById(req.params.id);
        if (!item) return res.status(404).send('Registro não encontrado');
        
        // Prepare payload for PDF
        // Avaliacao object structure depends on the form (Lideranca, ADM, Operacional)
        // But pdfBufferFromAvaliacaoData handles generic fields.
        // We might need to map some fields if they don't match exactly.
        // pdfService expects: avaliado, avaliador, createdAt, tipo, notas, comentarios
        
        const payload = {
            ...item,
            avaliado: item.funcionario || item.nome || 'N/A',
            avaliador: item.avaliador || 'N/A'
        };

        const pdfBuffer = await pdfService.pdfBufferFromAvaliacaoData(payload);
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="avaliacao-${item.id}.pdf"`,
            'Content-Length': pdfBuffer.length
        });
        res.send(pdfBuffer);
    } catch (e) {
        console.error(e);
        res.status(500).send('Erro ao gerar PDF');
    }
});

module.exports = router;
