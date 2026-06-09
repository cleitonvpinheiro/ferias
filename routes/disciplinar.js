const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const upload = require('../middleware/upload');
const { normalizeCpf } = require('../utils/validation');

const normalizeTipo = (tipo) => {
    const t = String(tipo || '').trim().toLowerCase();
    if (t === 'advertencia' || t === 'advertência') return 'advertencia';
    if (t === 'suspensao' || t === 'suspensão') return 'suspensao';
    return '';
};


module.exports = (db, auth) => {
    const { disciplinarAuth } = auth;

router.get('/rh/disciplinar', disciplinarAuth, async (req, res) => {
    try {
        const funcionarioId = req.query.funcionarioId ? String(req.query.funcionarioId) : '';
        const tipo = req.query.tipo ? normalizeTipo(req.query.tipo) : '';

        const allItems = await db.disciplinarRegistros.getAll();
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

router.get('/rh/disciplinar/modelo', disciplinarAuth, async (req, res) => {
    try {
        const modelo = db.disciplinarModelos && typeof db.disciplinarModelos.get === 'function'
            ? await db.disciplinarModelos.get('default')
            : null;
        if (!modelo) return res.json({ ok: true, modelo: null });
        res.json({
            ok: true,
            modelo: {
                ...modelo,
                url: `/uploads/${modelo.filename}`
            }
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao buscar modelo' });
    }
});
router.post('/rh/disciplinar/modelo', disciplinarAuth, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ ok: false, erro: 'Arquivo obrigatório' });
        if (!db.disciplinarModelos || typeof db.disciplinarModelos.upsert !== 'function') {
            return res.status(500).json({ ok: false, erro: 'Repositório de modelos indisponível' });
        }
        const uploadedBy = req.user && (req.user.name || req.user.username) ? (req.user.name || req.user.username) : null;
        const modelo = await db.disciplinarModelos.upsert({
            id: 'default',
            filename: req.file.filename,
            originalName: req.file.originalname,
            mimetype: req.file.mimetype,
            uploadedBy
        });
        res.json({
            ok: true,
            modelo: {
                ...modelo,
                url: `/uploads/${modelo.filename}`
            }
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao importar modelo' });
    }
});
router.get('/rh/disciplinar/:id', disciplinarAuth, async (req, res) => {
    try {
        const item = await db.disciplinarRegistros.getById(req.params.id);
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

        await db.disciplinarRegistros.create(item);
        res.json({ ok: true, item });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao criar registro' });
    }
});

router.post('/rh/disciplinar/importar', disciplinarAuth, async (req, res) => {
    try {
        const items = Array.isArray(req.body && req.body.items) ? req.body.items : [];
        if (!items.length) return res.status(400).json({ ok: false, erro: 'Nenhum item para importar' });

        const funcionarios = await db.funcionarios.getAll();
        const byCpf = new Map();
        const byNome = new Map();

        const normNome = (v) => String(v || '')
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, ' ');

        for (const f of Array.isArray(funcionarios) ? funcionarios : []) {
            const id = f && f.id ? String(f.id) : '';
            if (!id) continue;
            const cpf = normalizeCpf(f && f.cpf);
            if (cpf) byCpf.set(String(cpf), id);
            const nomeKey = normNome(f && f.nome);
            if (nomeKey) byNome.set(nomeKey, id);
        }

        const nowIso = new Date().toISOString();
        let importados = 0;
        let ignorados = 0;
        let naoEncontrados = 0;
        let invalidos = 0;

        for (const raw of items) {
            const tipo = normalizeTipo(raw && raw.tipo);
            const dataOcorrencia = raw && raw.dataOcorrencia ? String(raw.dataOcorrencia).trim() : '';
            const motivo = raw && raw.motivo ? String(raw.motivo).trim() : '';
            const descricao = raw && raw.descricao ? String(raw.descricao).trim() : '';
            const diasSuspensao = raw && raw.diasSuspensao !== undefined && raw.diasSuspensao !== null
                ? Number(raw.diasSuspensao)
                : null;

            if (!tipo || !dataOcorrencia) {
                invalidos++;
                continue;
            }

            const cpf = normalizeCpf(raw && raw.cpf);
            const nome = raw && raw.nome ? String(raw.nome).trim() : '';
            const funcionarioId = (cpf && byCpf.get(String(cpf))) || (nome && byNome.get(normNome(nome))) || '';
            if (!funcionarioId) {
                naoEncontrados++;
                continue;
            }

            const dedupKey = JSON.stringify({
                funcionarioId,
                tipo,
                dataOcorrencia,
                motivo,
                descricao,
                diasSuspensao: tipo === 'suspensao' ? (Number.isFinite(diasSuspensao) ? diasSuspensao : null) : null
            });
            const hash = crypto.createHash('sha256').update(dedupKey).digest('hex').slice(0, 24);
            const id = `import-disc-${hash}`;

            const payload = {
                id,
                funcionarioId,
                tipo,
                dataOcorrencia,
                motivo,
                descricao,
                diasSuspensao: tipo === 'suspensao' ? (Number.isFinite(diasSuspensao) ? diasSuspensao : null) : null,
                criadoPor: req.user && (req.user.name || req.user.username) ? (req.user.name || req.user.username) : null,
                origem: 'excel',
                createdAt: nowIso,
                updatedAt: nowIso
            };

            if (db.disciplinarRegistros && typeof db.disciplinarRegistros.createIgnore === 'function') {
                await db.disciplinarRegistros.createIgnore(payload);
                importados++;
                continue;
            }

            try {
                await db.disciplinarRegistros.create({ ...payload, id: crypto.randomUUID() });
                importados++;
            } catch (_) {
                ignorados++;
            }
        }

        res.json({ ok: true, importados, ignorados, naoEncontrados, invalidos });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao importar registros' });
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
        const diasSuspensao = payload.diasSuspensao != null ? Number(payload.diasSuspensao) : null;

        if (!funcionarioId) return res.status(400).json({ ok: false, erro: 'Funcionário obrigatório' });
        if (!tipo)          return res.status(400).json({ ok: false, erro: 'Tipo inválido' });
        if (!dataOcorrencia) return res.status(400).json({ ok: false, erro: 'Data obrigatória' });

        const now = new Date().toISOString();
        const item = {
            id: crypto.randomUUID(),
            funcionarioId,        // ← camelCase, igual ao que o db.create espera
            tipo,
            dataOcorrencia,
            motivo,
            descricao,
            diasSuspensao: tipo === 'suspensao' ? (Number.isFinite(diasSuspensao) ? diasSuspensao : null) : null,
            criadoPor: req.user?.name || req.user?.username || null,
            createdAt: now,
            updatedAt: now
        };

        await db.disciplinarRegistros.create(item);
        res.json({ ok: true, item });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao criar registro' });
    }
});

router.put('/rh/disciplinar/:id', disciplinarAuth, async (req, res) => {
    try {
        const payload = req.body || {};
        
        // Garantir que funcionarioId seja string ou null
        let funcionarioId = payload.funcionarioId;
        if (funcionarioId !== undefined && funcionarioId !== null) {
            funcionarioId = String(funcionarioId);
        } else {
            funcionarioId = null; // ← Converter undefined/null para null explicitamente
        }
        
        const tipo = payload.tipo !== undefined ? normalizeTipo(payload.tipo) : undefined;
        const dataOcorrencia = payload.dataOcorrencia !== undefined ? String(payload.dataOcorrencia || '') : undefined;
        const motivo = payload.motivo !== undefined ? String(payload.motivo || '') : undefined;
        const descricao = payload.descricao !== undefined ? String(payload.descricao || '') : undefined;
        const diasSuspensao = payload.diasSuspensao !== undefined ? payload.diasSuspensao : undefined;

        if (tipo === '') return res.status(400).json({ ok: false, erro: 'Tipo inválido' });
        if (dataOcorrencia === '') return res.status(400).json({ ok: false, erro: 'Data inválida' });

        // Se funcionarioId é null, permite passar (vai setar NULL no banco)
        // Se a validação exigir funcionarioId obrigatório, descomente a linha abaixo:
        // if (funcionarioId === null) return res.status(400).json({ ok: false, erro: 'Funcionário inválido' });

        const updated = await db.disciplinarRegistros.update(req.params.id, {
            funcionarioId, // Agora é string ou null, nunca undefined
            tipo,
            dataOcorrencia,
            motivo,
            descricao,
            diasSuspensao,
            updatedAt: new Date().toISOString().replace('T', ' ').replace('Z', '') // Formato MySQL
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
        await db.disciplinarRegistros.delete(req.params.id);
        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao excluir registro' });
    }
});


    return router;
};
