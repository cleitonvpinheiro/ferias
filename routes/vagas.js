const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../services/db');
const emailService = require('../services/email');
const pdfService = require('../services/pdfService');
const { recrutamentoAuth } = require('../middleware/auth');

router.get('/rh/vagas', recrutamentoAuth, async (req, res) => {
    try {
        const data = await db.vagas.getAll();
        const lista = data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        res.json(lista);
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao listar vagas' });
    }
});

router.post('/vagas', recrutamentoAuth, async (req, res) => {
    try {
        const payload = req.body;
        if (!payload.cargo || !payload.setor) {
            return res.status(400).json({ ok: false, erro: 'Campos obrigatórios ausentes' });
        }

        const id = crypto.randomUUID();
        const novaVaga = {
            id,
            ...payload,
            status: 'pendente',
            ativa: true,
            createdAt: new Date().toISOString()
        };
        
        await db.vagas.create(novaVaga);

        res.json({ ok: true, id });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao criar vaga' });
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
