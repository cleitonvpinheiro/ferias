const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const pdfService = require('../services/pdfService');
const multer = require('multer');
const xlsx = require('xlsx');

const upload = multer({ storage: multer.memoryStorage() });


let db;

module.exports = (_db, auth) => {
    db = _db;
    const { sesmtAuth } = auth;

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
            const codigo_qr = row['QR'] || row['qr'] || row['Codigo QR'] || row['codigo_qr'] || row['codigoQr'] || null;
            const vida_util_dias = row['Vida útil (dias)'] || row['vida_util_dias'] || row['VidaUtilDias'] || row['vidaUtilDias'] || null;
            const status = row['Status'] || row['status'] || null;

            if (nome) {
                const parsedPossuiCa = parseBoolish(possuiCaRaw, null);
                const possui_ca = parsedPossuiCa == null ? (ca_validade ? 1 : 0) : (parsedPossuiCa ? 1 : 0);
                const novoEpi = {
                    id: crypto.randomUUID(),
                    nome: String(nome),
                    valor: parseFloat(valor) || 0,
                    estoque: parseInt(estoque || 0, 10),
                    codigo_qr: codigo_qr ? String(codigo_qr).trim() : null,
                    vida_util_dias: vida_util_dias === null || vida_util_dias === undefined || vida_util_dias === '' ? null : parseInt(vida_util_dias, 10),
                    status: status ? String(status).trim().toLowerCase() : 'ativo',
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
        const { nome, valor, estoque, ca_validade, possui_ca: possuiCaRaw, codigo_qr, vida_util_dias, status } = req.body;
        if (!nome || !valor) return res.status(400).json({ ok: false, erro: 'Dados incompletos' });

        const parsedPossuiCa = parseBoolish(possuiCaRaw, true);
        const possui_ca = parsedPossuiCa ? 1 : 0;

        const novoEpi = {
            id: crypto.randomUUID(),
            nome,
            valor: parseFloat(valor),
            estoque: parseInt(estoque || 0, 10),
            codigo_qr: codigo_qr ? String(codigo_qr).trim() : null,
            vida_util_dias: vida_util_dias === undefined || vida_util_dias === null || vida_util_dias === '' ? null : parseInt(vida_util_dias, 10),
            status: status ? String(status).trim().toLowerCase() : 'ativo',
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
        const { nome, valor, estoque, ca_validade, possui_ca: possuiCaRaw, codigo_qr, vida_util_dias, status } = req.body;
        
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
            ...(codigo_qr !== undefined ? { codigo_qr: codigo_qr ? String(codigo_qr).trim() : null } : {}),
            ...(vida_util_dias !== undefined ? { vida_util_dias: vida_util_dias === null || vida_util_dias === '' ? null : parseInt(vida_util_dias, 10) } : {}),
            ...(status !== undefined ? { status: status ? String(status).trim().toLowerCase() : 'ativo' } : {}),
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

// Kits automáticos por cargo/setor (usado pela Portaria no fluxo diário)
router.get('/rh/kits-uniforme', sesmtAuth, async (req, res) => {
    try {
        const kits = await db.kitsUniforme.getAll();
        res.json({ ok: true, kits });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao listar kits' });
    }
});

router.post('/rh/kits-uniforme', sesmtAuth, async (req, res) => {
    try {
        const payload = req.body || {};
        const itens = Array.isArray(payload.itens) ? payload.itens.map(x => String(x)).filter(Boolean) : [];
        if (itens.length === 0) return res.status(400).json({ ok: false, erro: 'Informe ao menos 1 item no kit' });

        const id = payload.id ? String(payload.id) : crypto.randomUUID();
        const kit = {
            id,
            setor: payload.setor ? String(payload.setor) : null,
            cargo: payload.cargo ? String(payload.cargo) : null,
            itens,
            ativo: payload.ativo !== undefined ? !!payload.ativo : true,
            createdAt: payload.createdAt ? String(payload.createdAt) : new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        await db.kitsUniforme.upsert(kit);
        res.json({ ok: true, id });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao salvar kit' });
    }
});

router.delete('/rh/kits-uniforme/:id', sesmtAuth, async (req, res) => {
    try {
        await db.kitsUniforme.remove(String(req.params.id || ''));
        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao remover kit' });
    }
});

// Ocorrências (avaria/extravio) - RH decide e gera desconto/termo
router.get('/rh/ocorrencias-uniforme', sesmtAuth, async (req, res) => {
    try {
        const status = req.query && req.query.status ? String(req.query.status).trim().toLowerCase() : '';
        const ocorrs = await db.ocorrenciasUniforme.getAll();
        const filtered = status && status !== 'all'
            ? ocorrs.filter(o => String(o.status || 'pendente').trim().toLowerCase() === status)
            : ocorrs;

        const ciclos = await Promise.all(filtered.map(o => db.ciclosUniforme.getById(String(o.ciclo_id))));
        const cicloMap = new Map(ciclos.filter(Boolean).map(c => [String(c.id), c]));

        const funcionarios = await db.funcionarios.getAll();
        const funcMap = new Map(funcionarios.map(f => [String(f.id), f]));

        const epis = await db.epis.getAll();
        const epiMap = new Map(epis.map(e => [String(e.id), e]));

        const out = filtered.map(o => {
            const c = cicloMap.get(String(o.ciclo_id));
            const f = c ? funcMap.get(String(c.funcionario_id)) : null;
            const itensIds = o && o.dados && Array.isArray(o.dados.itens) ? o.dados.itens.map(String) : [];
            const counts = {};
            itensIds.forEach(i => { counts[i] = (counts[i] || 0) + 1; });
            const itens = Object.keys(counts).map(id => {
                const e = epiMap.get(String(id));
                return { id: String(id), nome: e ? e.nome : id, quantidade: counts[id], valor: e ? (Number(e.valor) || 0) : 0 };
            });
            return { ...o, ciclo: c || null, funcionario: f || null, itens };
        });

        res.json({ ok: true, ocorrencias: out });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao listar ocorrências' });
    }
});

router.post('/rh/ocorrencias-uniforme/:id/decidir', sesmtAuth, async (req, res) => {
    try {
        const id = String(req.params.id || '');
        const payload = req.body || {};
        const decisao = payload.decisao ? String(payload.decisao).trim().toLowerCase() : '';
        if (!new Set(['aprovar', 'recusar']).has(decisao)) return res.status(400).json({ ok: false, erro: 'Decisão inválida' });

        const ocorr = await db.ocorrenciasUniforme.getById(id);
        if (!ocorr) return res.status(404).json({ ok: false, erro: 'Ocorrência não encontrada' });

        const ciclo = await db.ciclosUniforme.getById(String(ocorr.ciclo_id));
        if (!ciclo) return res.status(404).json({ ok: false, erro: 'Ciclo não encontrado' });

        const funcionario = await db.funcionarios.getById(String(ciclo.funcionario_id));
        if (!funcionario) return res.status(404).json({ ok: false, erro: 'Funcionário não encontrado' });

        const now = new Date().toISOString();
        const aprovador = req.user && req.user.username ? String(req.user.username) : null;

        if (decisao === 'recusar') {
            await db.ocorrenciasUniforme.update(id, {
                ...ocorr,
                status: 'recusado',
                aprovado_por: aprovador,
                updatedAt: now
            });
            return res.json({ ok: true, status: 'recusado' });
        }

        const parcelas = parseInt(payload.parcelas || 1, 10) || 1;
        const itensIds = ocorr && ocorr.dados && Array.isArray(ocorr.dados.itens) ? ocorr.dados.itens.map(String) : [];
        if (itensIds.length === 0) return res.status(400).json({ ok: false, erro: 'Ocorrência sem itens' });

        const epis = await db.epis.getAll();
        const itens = itensIds.map(epiId => {
            const e = epis.find(x => String(x.id) === String(epiId));
            return { id: String(epiId), nome: e ? String(e.nome || epiId) : String(epiId), valor: e && typeof e.valor === 'number' ? e.valor : 0 };
        });

        const descontoId = crypto.randomUUID();
        await db.descontosEpis.create({
            id: descontoId,
            nome_funcionario: String(funcionario.nome || ''),
            cpf_funcionario: String(funcionario.cpf || ''),
            itens,
            parcelas,
            status: 'pendente',
            createdAt: now,
            updatedAt: now
        });

        await db.ocorrenciasUniforme.update(id, {
            ...ocorr,
            status: 'aprovado',
            aprovado_por: aprovador,
            updatedAt: now
        });

        const buffer = await pdfService.pdfBufferFromDescontoData({
            nome_funcionario: String(funcionario.nome || ''),
            cpf_funcionario: String(funcionario.cpf || ''),
            itens,
            parcelas
        });
        const termoPdf = 'data:application/pdf;base64,' + buffer.toString('base64');

        res.json({ ok: true, status: 'aprovado', desconto_id: descontoId, termo: termoPdf });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao decidir ocorrência' });
    }
});


    return router;
};
