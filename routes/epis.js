const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../services/db');
const { sesmtAuth } = require('../middleware/auth');
const pdfService = require('../services/pdfService');
const multer = require('multer');
const xlsx = require('xlsx');

const upload = multer({ storage: multer.memoryStorage() });

function parseBoolish(v, fallback = null) {
    if (v === undefined || v === null || v === '') return fallback;
    if (typeof v === 'boolean') return v;
    const s = String(v).trim().toLowerCase();
    if (['1', 'true', 'sim', 's', 'yes', 'y'].includes(s)) return true;
    if (['0', 'false', 'nao', 'não', 'n', 'no'].includes(s)) return false;
    return fallback;
}

router.post('/rh/epis/import', sesmtAuth, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ ok: false, erro: 'Nenhum arquivo enviado' });
        }

        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet);

        let count = 0;
        for (const row of data) {
            // Map columns (flexible matching)
            const nome = row['Nome'] || row['nome'] || row['Item'] || row['item'];
            const valor = row['Valor'] || row['valor'] || row['Preco'] || row['preco'] || 0;
            const estoque = row['Estoque'] || row['estoque'] || row['Qtd'] || row['qtd'] || 0;
            const ca_validade = row['Validade'] || row['validade'] || row['CA'] || row['ca'] || null;
            const possuiCaRaw = row['Possui CA'] || row['possui_ca'] || row['Possui_CA'] || row['possuiCA'];

            if (nome) {
                const parsedPossuiCa = parseBoolish(possuiCaRaw, null);
                const possui_ca = parsedPossuiCa == null ? (ca_validade ? 1 : 0) : (parsedPossuiCa ? 1 : 0);
                const novoEpi = {
                    id: crypto.randomUUID(),
                    nome: String(nome),
                    valor: parseFloat(valor) || 0,
                    estoque: parseInt(estoque || 0, 10),
                    possui_ca,
                    ca_validade: possui_ca ? (ca_validade ? new Date(ca_validade).toISOString() : null) : null,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                
                await db.epis.create(novoEpi);
                count++;
            }
        }

        res.json({ ok: true, count });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao processar arquivo' });
    }
});

router.get('/rh/epis', sesmtAuth, async (req, res) => {
    try {
        const epis = await db.epis.getAll();
        res.json(epis);
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao listar EPIs' });
    }
});

router.get('/rh/epis/movimentacoes', sesmtAuth, async (req, res) => {
    try {
        const [movs, funcionarios] = await Promise.all([
            db.movimentacoesEpis.getAll(),
            db.funcionarios.getAll()
        ]);

        const mapped = movs.map(m => {
            const func = funcionarios.find(f => f.id === m.funcionario_id);
            return {
                ...m,
                nome_funcionario: func ? func.nome : 'Desconhecido',
                // Normalizar data (sqlite retorna created_at)
                createdAt: m.created_at || m.createdAt
            };
        });

        // Ordenar mais recente primeiro
        mapped.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.json(mapped);
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao listar movimentações de EPIs' });
    }
});

router.post('/rh/epis', sesmtAuth, async (req, res) => {
    try {
        const { nome, valor, estoque, ca_validade, possui_ca: possuiCaRaw } = req.body;
        if (!nome || !valor) return res.status(400).json({ ok: false, erro: 'Dados incompletos' });

        const parsedPossuiCa = parseBoolish(possuiCaRaw, true);
        const possui_ca = parsedPossuiCa ? 1 : 0;

        const novoEpi = {
            id: crypto.randomUUID(),
            nome,
            valor: parseFloat(valor),
            estoque: parseInt(estoque || 0, 10),
            possui_ca,
            ca_validade: possui_ca ? (ca_validade || null) : null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        await db.epis.create(novoEpi);

        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao criar EPI' });
    }
});

router.delete('/rh/epis/:id', sesmtAuth, async (req, res) => {
    try {
        await db.epis.delete(req.params.id);
        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao remover EPI' });
    }
});

// Atualizar estoque e CA
router.put('/rh/epis/:id', sesmtAuth, async (req, res) => {
    try {
        const { nome, valor, estoque, ca_validade, possui_ca: possuiCaRaw } = req.body;
        
        const existing = await db.epis.getById(req.params.id);
        if (!existing) return res.status(404).json({ ok: false, erro: 'EPI não encontrado' });

        const parsedPossuiCa = parseBoolish(possuiCaRaw, null);
        const nextPossuiCa = parsedPossuiCa == null ? (existing.possui_ca == null ? 1 : Number(existing.possui_ca) ? 1 : 0) : (parsedPossuiCa ? 1 : 0);
        const nextCaValidade =
            parsedPossuiCa === false
                ? null
                : (ca_validade !== undefined ? ca_validade : existing.ca_validade);

        const updated = {
            ...existing,
            ...(nome !== undefined ? { nome } : {}),
            ...(valor !== undefined ? { valor: parseFloat(valor) } : {}),
            ...(estoque !== undefined ? { estoque: parseInt(estoque, 10) } : {}),
            ...(parsedPossuiCa != null ? { possui_ca: nextPossuiCa } : {}),
            ...(nextCaValidade !== undefined ? { ca_validade: nextPossuiCa ? nextCaValidade : null } : {}),
            updatedAt: new Date().toISOString()
        };
        
        await db.epis.update(req.params.id, updated);
        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao atualizar EPI' });
    }
});

// Descontos RH - listar e resolver
router.get('/rh/descontos', sesmtAuth, async (req, res) => {
    try {
        const descontos = await db.descontosEpis.getAll();
        res.json(descontos);
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao listar descontos' });
    }
});

router.get('/rh/descontos/:id/pdf', sesmtAuth, async (req, res) => {
    try {
        const item = await db.descontosEpis.getById(req.params.id);
        if (!item) return res.status(404).send('Registro não encontrado');
        
        const pdfBuffer = await pdfService.pdfBufferFromDescontoData(item);
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="desconto-${item.id}.pdf"`,
            'Content-Length': pdfBuffer.length
        });
        res.send(pdfBuffer);
    } catch (e) {
        console.error(e);
        res.status(500).send('Erro ao gerar PDF');
    }
});

router.post('/rh/descontos/:id/status', sesmtAuth, async (req, res) => {
    try {
        const { status } = req.body;
        // Validate status if needed
        await db.descontosEpis.update(req.params.id, {
            status: status, // 'pendente_rh' or 'resolvido'
            updatedAt: new Date().toISOString()
        });
        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao atualizar status do desconto' });
    }
});

router.post('/rh/descontos/:id/resolver', sesmtAuth, async (req, res) => {
    try {
        await db.descontosEpis.update(req.params.id, {
            status: 'resolvido',
            updatedAt: new Date().toISOString()
        });
        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao resolver desconto' });
    }
});

module.exports = router;
