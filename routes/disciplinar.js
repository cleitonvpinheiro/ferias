const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const db = require('../services/db');
const { disciplinarAuth } = require('../middleware/auth');

const normalizeTipo = (tipo) => {
    const t = String(tipo || '').trim().toLowerCase();
    if (t === 'advertencia' || t === 'advertência') return 'advertencia';
    if (t === 'suspensao' || t === 'suspensão') return 'suspensao';
    return '';
};

router.get('/rh/disciplinar', disciplinarAuth, async (req, res) => {
    try {
        const funcionarioId = req.query.funcionarioId ? String(req.query.funcionarioId) : '';
        const tipo = req.query.tipo ? normalizeTipo(req.query.tipo) : '';

        const allItems = await db.disciplinar.getAll();
        const filtered = allItems
            .filter((i) => (funcionarioId ? String(i.funcionarioId) === funcionarioId : true))
            .filter((i) => (tipo ? String(i.tipo) === tipo : true))
            .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

        res.json(filtered);
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao listar registros' });
    }
});

router.get('/rh/disciplinar/:id', disciplinarAuth, async (req, res) => {
    try {
        const item = await db.disciplinar.getById(req.params.id);
        if (!item) return res.status(404).json({ ok: false, erro: 'Registro não encontrado' });
        res.json(item);
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao buscar registro' });
    }
});

router.post('/rh/disciplinar', disciplinarAuth, async (req, res) => {
    try {
        const payload = req.body || {};
        const funcionarioId = payload.funcionarioId ? String(payload.funcionarioId) : '';
        const tipo = normalizeTipo(payload.tipo);
        const dataOcorrencia = payload.dataOcorrencia ? String(payload.dataOcorrencia) : '';
        const motivo = payload.motivo ? String(payload.motivo) : '';
        const descricao = payload.descricao ? String(payload.descricao) : '';
        const diasSuspensao = payload.diasSuspensao !== undefined && payload.diasSuspensao !== null
            ? Number(payload.diasSuspensao)
            : null;

        if (!funcionarioId) return res.status(400).json({ ok: false, erro: 'Funcionário obrigatório' });
        if (!tipo) return res.status(400).json({ ok: false, erro: 'Tipo inválido' });
        if (!dataOcorrencia) return res.status(400).json({ ok: false, erro: 'Data obrigatória' });

        const now = new Date().toISOString();
        const item = {
            id: crypto.randomUUID(),
            funcionarioId,
            tipo,
            dataOcorrencia,
            motivo,
            descricao,
            diasSuspensao: tipo === 'suspensao' ? (Number.isFinite(diasSuspensao) ? diasSuspensao : null) : null,
            criadoPor: req.user && (req.user.name || req.user.username) ? (req.user.name || req.user.username) : null,
            createdAt: now,
            updatedAt: now
        };

        await db.disciplinar.create(item);
        res.json({ ok: true, item });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao criar registro' });
    }
});

router.put('/rh/disciplinar/:id', disciplinarAuth, async (req, res) => {
    try {
        const payload = req.body || {};
        const tipo = payload.tipo !== undefined ? normalizeTipo(payload.tipo) : undefined;
        const funcionarioId = payload.funcionarioId !== undefined ? String(payload.funcionarioId || '') : undefined;
        const dataOcorrencia = payload.dataOcorrencia !== undefined ? String(payload.dataOcorrencia || '') : undefined;
        const motivo = payload.motivo !== undefined ? String(payload.motivo || '') : undefined;
        const descricao = payload.descricao !== undefined ? String(payload.descricao || '') : undefined;
        const diasSuspensao = payload.diasSuspensao !== undefined ? payload.diasSuspensao : undefined;

        if (tipo === '') return res.status(400).json({ ok: false, erro: 'Tipo inválido' });
        if (funcionarioId === '') return res.status(400).json({ ok: false, erro: 'Funcionário inválido' });
        if (dataOcorrencia === '') return res.status(400).json({ ok: false, erro: 'Data inválida' });

        const updated = await db.disciplinar.update(req.params.id, {
            funcionarioId,
            tipo,
            dataOcorrencia,
            motivo,
            descricao,
            diasSuspensao,
            updatedAt: new Date().toISOString()
        });

        if (!updated) return res.status(404).json({ ok: false, erro: 'Registro não encontrado' });
        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao atualizar registro' });
    }
});

router.delete('/rh/disciplinar/:id', disciplinarAuth, async (req, res) => {
    try {
        await db.disciplinar.remove(req.params.id);
        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao excluir registro' });
    }
});

module.exports = router;
