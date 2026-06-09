const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const pdfService = require('../services/pdfService');
const rateLimit = require('express-rate-limit');

const epiPublicLimiter = rateLimit({
    windowMs: 2 * 60 * 1000,
    max: 90,
    standardHeaders: true,
    legacyHeaders: false,
    message: { ok: false, erro: 'Muitas solicitações. Tente novamente.' }
});


let db;

module.exports = (_db, auth) => {
    db = _db;
    const { portariaAuth,sesmtAuth } = auth;

async function getItensEmPosse(funcionarioId) {
    const solicitacoes = await db.solicitacoesEpis.getAll();
    const atendidas = solicitacoes.filter(s =>
        String(s.funcionario_id) === String(funcionarioId) &&
        String(s.status || 'pendente').toLowerCase() === 'atendida'
    );
    const countById = new Map();
    atendidas.forEach(s => {
        const tipo = String(s.tipo || 'retirada').toLowerCase();
        const itens = Array.isArray(s.itens_solicitados) ? s.itens_solicitados : [];
        itens.forEach(id => {
            const key = String(id);
            const delta = tipo === 'devolucao' ? -1 : 1;
            countById.set(key, Number(countById.get(key) || 0) + delta);
        });
    });
    return Array.from(countById.entries()).filter(([, n]) => n > 0).map(([id, quantidade]) => ({ id: String(id), quantidade: Number(quantidade || 0) }));
}

async function registrarMovimentacaoEpi({ funcionario_id, itens_retirados, itens_devolvidos, evidencia, tipo_evidencia, termo }) {
    if (!funcionario_id) return { ok: false, erro: 'Funcionário inválido' };

    const epis = await db.epis.getAll();
    const now = new Date();

    const qtyByRetirada = new Map();
    (Array.isArray(itens_retirados) ? itens_retirados : []).forEach((raw) => {
        const id = String(raw);
        qtyByRetirada.set(id, Number(qtyByRetirada.get(id) || 0) + 1);
    });
    const qtyByDevolucao = new Map();
    (Array.isArray(itens_devolvidos) ? itens_devolvidos : []).forEach((raw) => {
        const id = String(raw);
        qtyByDevolucao.set(id, Number(qtyByDevolucao.get(id) || 0) + 1);
    });

    for (const [id, qty] of qtyByRetirada.entries()) {
        const item = epis.find(e => String(e.id) === String(id));
        if (!item) return { ok: false, erro: `EPI ${id} inexistente` };
        if ((item.estoque || 0) < qty) return { ok: false, erro: `Sem estoque para ${item.nome}` };
        if (item.ca_validade) {
            const caDate = new Date(item.ca_validade);
            if (!Number.isNaN(caDate.getTime()) && caDate < now) {
                return { ok: false, erro: `CA vencido para ${item.nome}` };
            }
        }
    }

    let termoPdf = termo;
    if (!termoPdf && evidencia && (itens_retirados?.length > 0 || itens_devolvidos?.length > 0)) {
        try {
            const funcionario = await db.funcionarios.getById(funcionario_id);
            if (funcionario) {
                const nomesRetirados = (itens_retirados || []).map(id => {
                    const e = epis.find(x => x.id === id);
                    return { nome: e ? e.nome : id, ca: e ? e.ca_validade : '' };
                });
                const nomesDevolvidos = (itens_devolvidos || []).map(id => {
                    const e = epis.find(x => x.id === id);
                    return { nome: e ? e.nome : id };
                });

                const buffer = await pdfService.gerarTermoEPI({
                    funcionario_nome: funcionario.nome,
                    itens_retirados: nomesRetirados,
                    itens_devolvidos: nomesDevolvidos,
                    assinatura: evidencia
                });
                termoPdf = 'data:application/pdf;base64,' + buffer.toString('base64');
            }
        } catch (errPdf) {
            console.error('Erro ao gerar termo PDF:', errPdf);
        }
    }

    await db.movimentacoesEpis.create({
        id: crypto.randomUUID(),
        funcionario_id,
        itens_retirados: Array.isArray(itens_retirados) ? itens_retirados : [],
        itens_devolvidos: Array.isArray(itens_devolvidos) ? itens_devolvidos : [],
        evidencia: evidencia || null,
        tipo_evidencia: tipo_evidencia || null,
        termo: termoPdf || null,
        createdAt: new Date().toISOString()
    });

    for (const [id, qty] of qtyByRetirada.entries()) {
        const item = epis.find(e => String(e.id) === String(id));
        if (item) {
            const newStock = Math.max(0, (item.estoque || 0) - qty);
            await db.epis.update(item.id, { ...item, estoque: newStock, updatedAt: new Date().toISOString() });
        }
    }
    for (const [id, qty] of qtyByDevolucao.entries()) {
        const item = epis.find(e => String(e.id) === String(id));
        if (item) {
            const newStock = (item.estoque || 0) + qty;
            await db.epis.update(item.id, { ...item, estoque: newStock, updatedAt: new Date().toISOString() });
        }
    }

    return { ok: true };
}

router.get('/epi/epis', epiPublicLimiter, async (req, res) => {
    try {
        const epis = await db.epis.getAll();
        const mapped = epis.map(ep => ({
            id: ep.id,
            nome: ep.nome,
            estoque: ep.estoque || 0,
            ca_validade: ep.ca_validade || null,
            codigo_qr: ep.codigo_qr || null
        }));
        res.json({ ok: true, epis: mapped });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao listar EPIs' });
    }
});

router.get('/epi/funcionario/:doc', epiPublicLimiter, async (req, res) => {
    try {
        const doc = String(req.params.doc || '').replace(/\D/g, '');
        if (!doc) return res.status(400).json({ ok: false, erro: 'Documento inválido' });

        const funcionarios = await db.funcionarios.getAll();
        const func = funcionarios.find(f => {
            const cpf = String(f.cpf || '').replace(/\D/g, '');
            const matricula = String(f.matricula || '').replace(/\D/g, '');
            return cpf === doc || matricula === doc;
        });
        if (!func) return res.status(404).json({ ok: false, erro: 'Funcionário não encontrado' });

        const descontos = await db.descontosEpis.getAll();
        const descontoPendente = descontos.some(d => {
            const cpf = String(d.cpf_funcionario || '').replace(/\D/g, '');
            return cpf === String(func.cpf || '').replace(/\D/g, '') && (d.status || 'pendente') === 'pendente';
        });

        const ciclosAbertos = await db.ciclosUniforme.getOpenByFuncionario(func.id);
        let cicloAbertoAnterior = false;
        if (Array.isArray(ciclosAbertos) && ciclosAbertos.length > 0) {
            const startOfToday = new Date();
            startOfToday.setHours(0, 0, 0, 0);
            const oldest = ciclosAbertos
                .map(c => ({ c, d: c && c.data_retirada ? new Date(c.data_retirada) : null }))
                .filter(x => x.d && !Number.isNaN(x.d.getTime()))
                .sort((a, b) => a.d - b.d)[0];
            cicloAbertoAnterior = !oldest || oldest.d < startOfToday;
        }

        const extraviosPendentes = await db.ocorrenciasUniforme.getPendentesPorFuncionarioETipo({ funcionarioId: func.id, tipo: 'extravio' });
        const extravioPendente = Array.isArray(extraviosPendentes) && extraviosPendentes.length > 0;

        const itensEmPosseDetalhado = await getItensEmPosse(func.id);
        const itensEmPosse = itensEmPosseDetalhado.map(x => String(x.id));
        const kit = await db.kitsUniforme.findBestMatch({ setor: func.setor, cargo: func.cargo });
        res.json({
            ok: true,
            funcionario: {
                id: func.id,
                nome: func.nome,
                cpf: func.cpf,
                matricula: func.matricula,
                cargo: func.cargo,
                setor: func.setor
            },
            itensEmPosse,
            itensEmPosseDetalhado,
            kitSugerido: kit && Array.isArray(kit.itens) ? kit.itens : [],
            bloqueios: {
                descontoPendente,
                cicloAbertoAnterior,
                extravioPendente
            }
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao buscar funcionário' });
    }
});

router.post('/epi/solicitacoes', epiPublicLimiter, async (req, res) => {
    try {
        const payload = req.body || {};
        const now = new Date().toISOString();

        let funcionario_id = payload.funcionario_id ? String(payload.funcionario_id) : '';
        const doc = payload.funcionario_doc ? String(payload.funcionario_doc).replace(/\D/g, '') : '';
        let func = null;

        if (!funcionario_id) {
            if (!doc) return res.status(400).json({ ok: false, erro: 'Funcionário inválido' });
            const funcionarios = await db.funcionarios.getAll();
            func = funcionarios.find(f => {
                const cpf = String(f.cpf || '').replace(/\D/g, '');
                const matricula = String(f.matricula || '').replace(/\D/g, '');
                return cpf === doc || matricula === doc;
            });
            if (!func) return res.status(404).json({ ok: false, erro: 'Funcionário não encontrado' });

            funcionario_id = String(func.id);
        }

        if (!func) {
            func = await db.funcionarios.getById(String(funcionario_id));
            if (!func) return res.status(404).json({ ok: false, erro: 'Funcionário não encontrado' });
        }

        const itens = Array.isArray(payload.itens_solicitados)
            ? payload.itens_solicitados
            : (Array.isArray(payload.itens) ? payload.itens : []);

        const itens_solicitados = itens.map(x => String(x)).filter(Boolean);
        if (itens_solicitados.length === 0) return res.status(400).json({ ok: false, erro: 'Selecione ao menos 1 EPI' });

        const tipo = payload.tipo ? String(payload.tipo).trim().toLowerCase() : 'retirada';
        if (!new Set(['retirada', 'devolucao']).has(tipo)) {
            return res.status(400).json({ ok: false, erro: 'Tipo inválido' });
        }

        if (tipo === 'retirada') {
            const descontos = await db.descontosEpis.getAll();
            const descontoPendente = descontos.some(d => {
                const cpf = String(d.cpf_funcionario || '').replace(/\D/g, '');
                return cpf === String(func.cpf || '').replace(/\D/g, '') && (d.status || 'pendente') === 'pendente';
            });
            if (descontoPendente) return res.status(403).json({ ok: false, erro: 'Funcionário bloqueado: pendência no RH' });

            const ciclosAbertos = await db.ciclosUniforme.getOpenByFuncionario(String(funcionario_id));
            if (Array.isArray(ciclosAbertos) && ciclosAbertos.length > 0) {
                return res.status(403).json({ ok: false, erro: 'Funcionário bloqueado: ciclo em aberto (devolução pendente)' });
            }

            const extraviosPendentes = await db.ocorrenciasUniforme.getPendentesPorFuncionarioETipo({ funcionarioId: String(funcionario_id), tipo: 'extravio' });
            if (Array.isArray(extraviosPendentes) && extraviosPendentes.length > 0) {
                return res.status(403).json({ ok: false, erro: 'Funcionário bloqueado: extravio pendente' });
            }
        }

        const epis = await db.epis.getAll();
        const epiIds = new Set(epis.map(e => String(e.id)));
        const invalid = itens_solicitados.filter(id => !epiIds.has(id));
        if (invalid.length > 0) return res.status(400).json({ ok: false, erro: `EPIs inválidos: ${invalid.join(', ')}` });

        if (tipo === 'retirada') {
            const qtyById = new Map();
            itens_solicitados.forEach((x) => {
                const id = String(x);
                qtyById.set(id, Number(qtyById.get(id) || 0) + 1);
            });
            for (const [id, qty] of qtyById.entries()) {
                const item = epis.find(e => String(e.id) === String(id));
                if (!item) return res.status(400).json({ ok: false, erro: `EPI ${id} inexistente` });
                if ((item.estoque || 0) < qty) return res.status(400).json({ ok: false, erro: `Sem estoque para ${item.nome}` });
                if (item.ca_validade) {
                    const caDate = new Date(item.ca_validade);
                    if (!Number.isNaN(caDate.getTime()) && caDate < new Date()) {
                        return res.status(400).json({ ok: false, erro: `CA vencido para ${item.nome}` });
                    }
                }
            }
        }

        let finalItens = itens_solicitados;
        if (tipo === 'devolucao') {
            const itensEmPosseDetalhado = await getItensEmPosse(funcionario_id);
            const posseQty = new Map(itensEmPosseDetalhado.map(x => [String(x.id), Number(x.quantidade || 0)]));
            const reqQty = new Map();
            finalItens.forEach((raw) => {
                const id = String(raw);
                reqQty.set(id, Number(reqQty.get(id) || 0) + 1);
            });

            const invalid = [];
            for (const [id, qty] of reqQty.entries()) {
                const max = Number(posseQty.get(id) || 0);
                if (max <= 0) invalid.push(id);
                else if (qty > max) invalid.push(id);
            }
            if (invalid.length > 0) return res.status(400).json({ ok: false, erro: 'Selecione apenas EPIs que estão em posse do colaborador (quantidade válida).' });
        }

        const assinatura = payload.assinatura ? String(payload.assinatura) : null;
        const assinatura_tipo = payload.assinatura_tipo ? String(payload.assinatura_tipo) : null;
        const evidencia_foto = payload.evidencia_foto ? String(payload.evidencia_foto) : null;

        if (!assinatura && !evidencia_foto) return res.status(400).json({ ok: false, erro: 'Assinatura ou evidência (foto) é obrigatória.' });
        const maxLen = 2_500_000;
        if (assinatura && assinatura.length > maxLen) return res.status(400).json({ ok: false, erro: 'Assinatura muito grande.' });
        if (evidencia_foto && evidencia_foto.length > maxLen) return res.status(400).json({ ok: false, erro: 'Foto muito grande.' });

        const row = {
            id: crypto.randomUUID(),
            funcionario_id,
            tipo,
            itens_solicitados: finalItens,
            status: 'pendente',
            atendido_at: null,
            atendido_por: null,
            assinatura,
            assinatura_tipo,
            assinatura_at: now,
            assinatura_por: funcionario_id,
            evidencia_foto,
            createdAt: now,
            updatedAt: now
        };

        await db.solicitacoesEpis.create(row);
        res.json({ ok: true, id: row.id });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao criar solicitação' });
    }
});

router.get('/portaria/candidatos', portariaAuth, async (req, res) => {
    try {
        const candidatos = await db.candidatos.getAll();
        const hoje = new Date().toISOString().split('T')[0];
        
        const doDia = candidatos.filter(c => {
            if (!c.data_entrevista) return false;
            return c.data_entrevista.startsWith(hoje);
        });
        
        res.json(doDia);
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao listar candidatos' });
    }
});

router.post('/portaria/registrar-chegada', portariaAuth, async (req, res) => {
    try {
        const { id, nome, empresa, documento, placa, tipo } = req.body;
        
        // Se for candidato
        if (tipo === 'candidato' && id) {
             const candidato = await db.candidatos.getById(id);
             // Note: Status updates for candidates are currently skipped as schema doesn't support them yet.
        }

        // Registro geral de acesso
        await db.acessos.create({
            tipo: tipo || 'visitante',
            nome,
            empresa,
            documento,
            placa,
            entrada: new Date().toISOString(),
            saida: null
        });

        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao registrar chegada' });
    }
});

router.post('/portaria/registrar-saida', portariaAuth, async (req, res) => {
    try {
        const { nome, documento } = req.body;
        
        const acessos = await db.acessos.getAll();
        const acesso = acessos.find(a => (a.nome === nome || a.documento === documento) && !a.saida);

        if (acesso) {
            await db.acessos.update(acesso.id, {
                saida: new Date().toISOString()
            });
            res.json({ ok: true });
        } else {
            res.status(404).json({ ok: false, erro: 'Registro de entrada não encontrado ou já baixado.' });
        }
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao registrar saída' });
    }
});

router.get('/portaria/historico', portariaAuth, async (req, res) => {
    try {
        const acessos = await db.acessos.getAll();
        const ultimos = acessos.slice(0, 100); 
        res.json(ultimos);
    } catch (e) {
         console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao listar histórico' });
    }
});

// Buscar funcionário por CPF/Matrícula e itens em posse
router.get('/portaria/funcionario/:doc', portariaAuth, async (req, res) => {
    try {
        const doc = String(req.params.doc).replace(/\D/g, '');
        const funcionarios = await db.funcionarios.getAll();
        const func = funcionarios.find(f => {
            const cpf = String(f.cpf || '').replace(/\D/g, '');
            const matricula = String(f.matricula || '').replace(/\D/g, '');
            return cpf === doc || matricula === doc;
        });
        if (!func) {
            return res.status(404).json({ ok: false, erro: 'Funcionário não encontrado' });
        }
        
        // Bloqueios (usados para limitar retirada; devolução deve continuar possível)
        const descontos = await db.descontosEpis.getAll();
        const descontoPendente = descontos.some(d => {
            const cpf = String(d.cpf_funcionario || '').replace(/\D/g, '');
            return cpf === String(func.cpf || '').replace(/\D/g, '') && (d.status || 'pendente') === 'pendente';
        });

        const ciclosAbertos = await db.ciclosUniforme.getOpenByFuncionario(func.id);
        let cicloAbertoAnterior = false;
        if (Array.isArray(ciclosAbertos) && ciclosAbertos.length > 0) {
            const startOfToday = new Date();
            startOfToday.setHours(0, 0, 0, 0);
            const oldest = ciclosAbertos
                .map(c => ({ c, d: c && c.data_retirada ? new Date(c.data_retirada) : null }))
                .filter(x => x.d && !Number.isNaN(x.d.getTime()))
                .sort((a, b) => a.d - b.d)[0];
            cicloAbertoAnterior = !oldest || oldest.d < startOfToday;
        }

        const extraviosPendentes = await db.ocorrenciasUniforme.getPendentesPorFuncionarioETipo({ funcionarioId: func.id, tipo: 'extravio' });
        const extravioPendente = Array.isArray(extraviosPendentes) && extraviosPendentes.length > 0;
        
        const itensEmPosseDetalhado = await getItensEmPosse(func.id);
        const itensEmPosse = itensEmPosseDetalhado.map(x => String(x.id));
        return res.json({
            ok: true,
            funcionario: func,
            itensEmPosse,
            itensEmPosseDetalhado,
            bloqueios: {
                descontoPendente,
                cicloAbertoAnterior,
                extravioPendente
            }
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao buscar funcionário' });
    }
});

router.get('/portaria/ciclos', portariaAuth, async (req, res) => {
    try {
        const funcionarioId = req.query && req.query.funcionario_id ? String(req.query.funcionario_id).trim() : '';
        if (!funcionarioId) return res.status(400).json({ ok: false, erro: 'funcionario_id é obrigatório' });

        const ciclos = await db.ciclosUniforme.getOpenByFuncionario(funcionarioId);
        const open = Array.isArray(ciclos) ? ciclos : [];
        if (open.length === 0) return res.json({ ok: true, ciclos: [] });

        const epis = await db.epis.getAll();
        const epiMap = new Map((epis || []).map(e => [String(e.id), e]));

        const out = [];
        for (const c of open) {
            const itensRows = await db.cicloItens.listByCiclo(String(c.id));
            const counts = {};
            (itensRows || []).forEach(r => {
                const iid = String(r.item_id);
                counts[iid] = (counts[iid] || 0) + 1;
            });
            const itens = Object.keys(counts).map(iid => {
                const e = epiMap.get(String(iid));
                return { id: iid, nome: e ? e.nome : iid, quantidade: counts[iid] };
            });
            out.push({
                id: String(c.id),
                funcionario_id: String(c.funcionario_id),
                data_retirada: c.data_retirada || null,
                status: c.status || 'em_uso',
                itens
            });
        }

        res.json({ ok: true, ciclos: out });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao listar ciclos' });
    }
});

// Catálogo de EPIs
router.get('/portaria/epis', portariaAuth, async (req, res) => {
    try {
        const epis = await db.epis.getAll();
        const mapped = epis.map(ep => ({ ...ep, estoque: ep.estoque || 0 }));
        res.json(mapped);
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao listar EPIs' });
    }
});

router.get('/portaria/solicitacoes', portariaAuth, async (req, res) => {
    try {
        const status = (req.query.status ? String(req.query.status) : '').trim().toLowerCase();
        const funcionarioId = (req.query.funcionario_id ? String(req.query.funcionario_id) : '').trim();

        const solicitacoes = await db.solicitacoesEpis.getAll();
        const funcionarios = await db.funcionarios.getAll();
        const epis = await db.epis.getAll();

        const funcMap = new Map(funcionarios.map(f => [String(f.id), f]));
        const epiMap = new Map(epis.map(e => [String(e.id), e]));

        const filtered = solicitacoes
            .filter(s => !status || String(s.status || 'pendente').toLowerCase() === status)
            .filter(s => !funcionarioId || String(s.funcionario_id) === funcionarioId);

        const mapped = filtered.map(s => {
            const func = funcMap.get(String(s.funcionario_id));
            const ids = Array.isArray(s.itens_solicitados) ? s.itens_solicitados.map(x => String(x)) : [];
            const counts = {};
            ids.forEach(id => { counts[id] = (counts[id] || 0) + 1; });

            const itens = Object.keys(counts).map(id => {
                const epi = epiMap.get(id);
                return {
                    id,
                    nome: epi ? epi.nome : id,
                    quantidade: counts[id],
                    estoque: epi ? (epi.estoque || 0) : null
                };
            });

            return {
                id: s.id,
                tipo: s.tipo || 'retirada',
                status: s.status || 'pendente',
                funcionario: func ? {
                    id: func.id,
                    nome: func.nome,
                    cpf: func.cpf,
                    matricula: func.matricula,
                    cargo: func.cargo,
                    setor: func.setor
                } : { id: s.funcionario_id },
                itens,
                hasEvidence: Boolean(s.assinatura || s.evidencia_foto),
                atendidoAt: s.atendido_at || null,
                atendidoPor: s.atendido_por || null,
                createdAt: s.created_at || null,
                updatedAt: s.updated_at || null
            };
        });

        res.json({ ok: true, solicitacoes: mapped });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao listar solicitações' });
    }
});

router.post('/portaria/solicitacoes', portariaAuth, async (req, res) => {
    try {
        const payload = req.body || {};
        const now = new Date().toISOString();

        let funcionario_id = payload.funcionario_id ? String(payload.funcionario_id) : '';

        const doc = payload.funcionario_doc ? String(payload.funcionario_doc).replace(/\D/g, '') : '';
        if (!funcionario_id && doc) {
            const funcionarios = await db.funcionarios.getAll();
            const func = funcionarios.find(f => {
                const cpf = String(f.cpf || '').replace(/\D/g, '');
                const matricula = String(f.matricula || '').replace(/\D/g, '');
                return cpf === doc || matricula === doc;
            });
            if (func) funcionario_id = String(func.id);
        }

        const itens = Array.isArray(payload.itens_solicitados)
            ? payload.itens_solicitados
            : (Array.isArray(payload.itens) ? payload.itens : []);

        const itens_solicitados = itens.map(x => String(x)).filter(Boolean);

        if (!funcionario_id) return res.status(400).json({ ok: false, erro: 'Funcionário inválido' });
        if (itens_solicitados.length === 0) return res.status(400).json({ ok: false, erro: 'Selecione ao menos 1 EPI' });

        const epis = await db.epis.getAll();
        const epiIds = new Set(epis.map(e => String(e.id)));
        const invalid = itens_solicitados.filter(id => !epiIds.has(id));
        if (invalid.length > 0) return res.status(400).json({ ok: false, erro: `EPIs inválidos: ${invalid.join(', ')}` });

        const row = {
            id: crypto.randomUUID(),
            funcionario_id,
            itens_solicitados,
            status: 'pendente',
            atendido_at: null,
            atendido_por: null,
            createdAt: now,
            updatedAt: now
        };

        await db.solicitacoesEpis.create(row);
        res.json({ ok: true, id: row.id });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao criar solicitação' });
    }
});

router.post('/portaria/solicitacoes/:id/status', portariaAuth, async (req, res) => {
    try {
        const id = String(req.params.id || '');
        const payload = req.body || {};
        const status = String(payload.status || '').trim().toLowerCase();
        const allowed = new Set(['pendente', 'atendida', 'cancelada']);
        if (!allowed.has(status)) return res.status(400).json({ ok: false, erro: 'Status inválido' });

        const current = await db.solicitacoesEpis.getById(id);
        if (!current) return res.status(404).json({ ok: false, erro: 'Solicitação não encontrada' });
        const currentStatus = String(current.status || 'pendente').trim().toLowerCase();
        if (currentStatus === status) return res.json({ ok: true });

        const currentTipo = String(current.tipo || 'retirada').trim().toLowerCase();
        if (currentTipo === 'devolucao' && status === 'atendida') {
            return res.status(400).json({ ok: false, erro: 'Use a confirmação de devolução para este tipo de solicitação.' });
        }

        const now = new Date().toISOString();
        const atendido_at = status === 'atendida' ? now : null;
        const atendido_por = status === 'atendida' ? (req.user && req.user.username ? String(req.user.username) : null) : null;

        const payloadAssinatura = payload.assinatura ? String(payload.assinatura) : null;
        const payloadAssinaturaTipo = payload.assinatura_tipo ? String(payload.assinatura_tipo) : null;
        const payloadEvidenciaFoto = payload.evidencia_foto ? String(payload.evidencia_foto) : null;

        const assinatura = payloadAssinatura ?? (current.assinatura ? String(current.assinatura) : null);
        const assinatura_tipo = payloadAssinatura ? (payloadAssinaturaTipo || 'canvas') : (current.assinatura_tipo ? String(current.assinatura_tipo) : null);
        const evidencia_foto = payloadEvidenciaFoto ?? (current.evidencia_foto ? String(current.evidencia_foto) : null);

        if (status === 'atendida') {
            const hasEvidence = !!(assinatura || evidencia_foto);
            if (!hasEvidence) return res.status(400).json({ ok: false, erro: 'Assinatura ou evidência (foto) é obrigatória.' });
            const maxLen = 2_500_000;
            if (payloadAssinatura && payloadAssinatura.length > maxLen) return res.status(400).json({ ok: false, erro: 'Assinatura muito grande.' });
            if (payloadEvidenciaFoto && payloadEvidenciaFoto.length > maxLen) return res.status(400).json({ ok: false, erro: 'Foto muito grande.' });

            if (currentTipo === 'retirada') {
                const same = Array.isArray(current.itens_solicitados) ? current.itens_solicitados.map(x => String(x)).sort() : [];
                const ciclosAbertos = await db.ciclosUniforme.getOpenByFuncionario(String(current.funcionario_id));
                if (Array.isArray(ciclosAbertos) && ciclosAbertos.length > 0) {
                    return res.status(403).json({ ok: false, erro: 'Funcionário com ciclo em aberto. Finalize a devolução antes de nova retirada.' });
                }

                const cicloId = crypto.randomUUID();
                await db.ciclosUniforme.create({
                    id: cicloId,
                    funcionario_id: String(current.funcionario_id),
                    data_retirada: now,
                    data_devolucao: null,
                    status: 'em_uso',
                    evidencias: null,
                    criado_por: atendido_por,
                    finalizado_por: null,
                    observacoes: null,
                    createdAt: now,
                    updatedAt: now
                });

                await db.cicloItens.createMany(
                    (same || []).map(itemId => ({
                        id: crypto.randomUUID(),
                        ciclo_id: cicloId,
                        item_id: String(itemId),
                        item_tipo: 'epi',
                        status_devolucao: null,
                        evidencia_foto: null,
                        createdAt: now
                    }))
                );

                const tipo_evidencia =
                    assinatura
                        ? (assinatura_tipo ? `solicitacao_${String(assinatura_tipo)}` : 'solicitacao_assinatura')
                        : 'solicitacao_foto';

                const mov = await registrarMovimentacaoEpi({
                    funcionario_id: String(current.funcionario_id),
                    itens_retirados: same,
                    itens_devolvidos: [],
                    evidencia: assinatura ? assinatura : (evidencia_foto ? evidencia_foto : null),
                    tipo_evidencia,
                    termo: null
                });
                if (!mov || !mov.ok) return res.status(400).json({ ok: false, erro: mov && mov.erro ? mov.erro : 'Erro ao registrar movimentação' });
            }
        }

        await db.solicitacoesEpis.updateStatus(id, {
            status,
            atendido_at,
            atendido_por,
            assinatura,
            assinatura_tipo,
            assinatura_at: status === 'atendida'
                ? ((payloadAssinatura || payloadEvidenciaFoto) ? now : (current.assinatura_at || now))
                : (current.assinatura_at || null),
            assinatura_por: status === 'atendida'
                ? ((payloadAssinatura || payloadEvidenciaFoto) ? atendido_por : (current.assinatura_por || atendido_por))
                : (current.assinatura_por || null),
            evidencia_foto,
            updatedAt: now
        });

        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao atualizar solicitação' });
    }
});

router.post('/portaria/solicitacoes/:id/confirmar-devolucao', portariaAuth, async (req, res) => {
    try {
        const id = String(req.params.id || '');
        const current = await db.solicitacoesEpis.getById(id);
        if (!current) return res.status(404).json({ ok: false, erro: 'Solicitação não encontrada' });

        const tipo = String(current.tipo || 'retirada').trim().toLowerCase();
        if (tipo !== 'devolucao') return res.status(400).json({ ok: false, erro: 'Tipo inválido para confirmação de devolução' });

        const status = String(current.status || 'pendente').trim().toLowerCase();
        if (status !== 'pendente') return res.status(400).json({ ok: false, erro: 'Solicitação não está pendente' });

        const evidencia = current.assinatura ? String(current.assinatura) : (current.evidencia_foto ? String(current.evidencia_foto) : null);
        if (!evidencia) return res.status(400).json({ ok: false, erro: 'Assinatura ou evidência (foto) é obrigatória.' });

        const now = new Date().toISOString();
        const atendido_por = req.user && req.user.username ? String(req.user.username) : null;
        const inspecao = Array.isArray(req.body?.inspecao_itens) ? req.body.inspecao_itens : null;
        if (!inspecao || inspecao.length === 0) {
            return res.status(400).json({ ok: false, erro: 'Inspeção obrigatória na devolução (status e foto).' });
        }

        const ciclosAbertos = await db.ciclosUniforme.getOpenByFuncionario(String(current.funcionario_id));
        if (!Array.isArray(ciclosAbertos) || ciclosAbertos.length === 0) {
            return res.status(400).json({ ok: false, erro: 'Nenhum ciclo em aberto encontrado para este colaborador.' });
        }
        if (ciclosAbertos.length > 1) {
            return res.status(400).json({ ok: false, erro: 'Existe mais de um ciclo em aberto. Regularize antes de finalizar devolução.' });
        }

        const ciclo = ciclosAbertos[0];
        const cicloItens = await db.cicloItens.listByCiclo(String(ciclo.id));
        if (!Array.isArray(cicloItens) || cicloItens.length === 0) {
            return res.status(400).json({ ok: false, erro: 'Ciclo sem itens.' });
        }

        const normStatus = (s) => String(s || '').trim().toLowerCase();
        const allowedStatus = new Set(['ok', 'avariado', 'extraviado']);

        const expand = [];
        inspecao.forEach(row => {
            const itemId = row && (row.item_id || row.epi_id || row.id) ? String(row.item_id || row.epi_id || row.id) : '';
            const st = normStatus(row && row.status);
            const qty = parseInt(row && row.quantidade ? row.quantidade : 1, 10) || 1;
            const foto = row && row.evidencia_foto ? String(row.evidencia_foto) : null;
            if (!itemId || !allowedStatus.has(st) || qty <= 0) return;
            if ((st === 'avariado' || st === 'extraviado') && !foto) return;
            for (let i = 0; i < qty; i++) expand.push({ itemId, status: st, evidencia_foto: foto });
        });

        if (expand.length === 0) {
            return res.status(400).json({ ok: false, erro: 'Inspeção inválida.' });
        }

        const countById = new Map();
        cicloItens.forEach(ci => {
            const key = String(ci.item_id);
            countById.set(key, Number(countById.get(key) || 0) + 1);
        });
        const expandCount = new Map();
        expand.forEach(x => {
            expandCount.set(x.itemId, Number(expandCount.get(x.itemId) || 0) + 1);
        });
        for (const [idItem, expected] of countById.entries()) {
            const got = Number(expandCount.get(idItem) || 0);
            if (got !== expected) {
                return res.status(400).json({ ok: false, erro: 'Inspeção deve informar o status de todos os itens do ciclo.' });
            }
        }

        const tipo_evidencia =
            current.assinatura
                ? (current.assinatura_tipo ? `solicitacao_${String(current.assinatura_tipo)}` : 'solicitacao_assinatura')
                : 'solicitacao_foto';

        const toDevolver = [];
        const avariados = [];
        const extraviados = [];

        const byItemQueue = new Map();
        expand.forEach(x => {
            const key = String(x.itemId);
            if (!byItemQueue.has(key)) byItemQueue.set(key, []);
            byItemQueue.get(key).push(x);
        });

        for (const ci of cicloItens) {
            const key = String(ci.item_id);
            const q = byItemQueue.get(key) || [];
            const next = q.shift();
            if (!next) continue;

            if (next.status === 'extraviado') extraviados.push(key);
            else if (next.status === 'avariado') avariados.push(key);
            else toDevolver.push(key);

            await db.cicloItens.update(String(ci.id), {
                status_devolucao: next.status,
                evidencia_foto: next.evidencia_foto || null
            });
        }

        if (toDevolver.length > 0 || avariados.length > 0) {
            const mov = await registrarMovimentacaoEpi({
                funcionario_id: String(current.funcionario_id),
                itens_retirados: [],
                itens_devolvidos: [...toDevolver, ...avariados],
                evidencia,
                tipo_evidencia,
                termo: null
            });
            if (!mov || !mov.ok) return res.status(400).json({ ok: false, erro: mov && mov.erro ? mov.erro : 'Erro ao registrar devolução' });
        }

        const ocorrenciasCriadas = [];
        if (extraviados.length > 0) {
            const oid = crypto.randomUUID();
            await db.ocorrenciasUniforme.create({
                id: oid,
                ciclo_id: String(ciclo.id),
                tipo: 'extravio',
                status: 'pendente',
                valor: null,
                parcelas: null,
                aprovado_por: null,
                dados: { itens: extraviados },
                createdAt: now,
                updatedAt: now
            });
            ocorrenciasCriadas.push({ id: oid, tipo: 'extravio' });
        }
        if (avariados.length > 0) {
            const oid = crypto.randomUUID();
            await db.ocorrenciasUniforme.create({
                id: oid,
                ciclo_id: String(ciclo.id),
                tipo: 'avaria',
                status: 'pendente',
                valor: null,
                parcelas: null,
                aprovado_por: null,
                dados: { itens: avariados },
                createdAt: now,
                updatedAt: now
            });
            ocorrenciasCriadas.push({ id: oid, tipo: 'avaria' });
        }

        const cicloStatus = extraviados.length > 0 ? 'extraviado' : (avariados.length > 0 ? 'avariado' : 'devolvido');
        await db.ciclosUniforme.update(String(ciclo.id), {
            id: String(ciclo.id),
            funcionario_id: String(ciclo.funcionario_id),
            data_retirada: ciclo.data_retirada || null,
            data_devolucao: now,
            status: cicloStatus,
            evidencias: null,
            criado_por: ciclo.criado_por || null,
            finalizado_por: atendido_por,
            observacoes: null,
            updatedAt: now
        });

        await db.solicitacoesEpis.updateStatus(id, {
            status: 'atendida',
            atendido_at: now,
            atendido_por,
            assinatura: current.assinatura ? String(current.assinatura) : null,
            assinatura_tipo: current.assinatura_tipo ? String(current.assinatura_tipo) : null,
            assinatura_at: current.assinatura_at || now,
            assinatura_por: current.assinatura_por || current.funcionario_id,
            evidencia_foto: current.evidencia_foto ? String(current.evidencia_foto) : null,
            updatedAt: now
        });

        return res.json({ ok: true, ciclo_id: String(ciclo.id), status: cicloStatus, ocorrencias: ocorrenciasCriadas });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao confirmar devolução' });
    }
});

// Registrar movimentação
router.post('/portaria/movimentacao', portariaAuth, async (req, res) => {
    try {
        const { funcionario_id, itens_retirados, itens_devolvidos, evidencia, tipo_evidencia, termo } = req.body;
        const retirados = Array.isArray(itens_retirados) ? itens_retirados.map(x => String(x)).filter(Boolean) : [];
        const devolvidos = Array.isArray(itens_devolvidos) ? itens_devolvidos.map(x => String(x)).filter(Boolean) : [];
        if (retirados.length > 0) {
            const ciclosAbertos = await db.ciclosUniforme.getOpenByFuncionario(String(funcionario_id));
            if (Array.isArray(ciclosAbertos) && ciclosAbertos.length > 0) {
                return res.status(403).json({ ok: false, erro: 'Funcionário com ciclo em aberto. Finalize a devolução antes de nova retirada.' });
            }
            const now = new Date().toISOString();
            const atendido_por = req.user && req.user.username ? String(req.user.username) : null;
            const cicloId = crypto.randomUUID();
            await db.ciclosUniforme.create({
                id: cicloId,
                funcionario_id: String(funcionario_id),
                data_retirada: now,
                data_devolucao: null,
                status: 'em_uso',
                evidencias: null,
                criado_por: atendido_por,
                finalizado_por: null,
                observacoes: null,
                createdAt: now,
                updatedAt: now
            });
            await db.cicloItens.createMany(
                retirados.map(itemId => ({
                    id: crypto.randomUUID(),
                    ciclo_id: cicloId,
                    item_id: String(itemId),
                    item_tipo: 'epi',
                    status_devolucao: null,
                    evidencia_foto: null,
                    createdAt: now
                }))
            );
        }
        if (devolvidos.length > 0) {
            const ciclosAbertos = await db.ciclosUniforme.getOpenByFuncionario(String(funcionario_id));
            if (Array.isArray(ciclosAbertos) && ciclosAbertos.length === 1) {
                const ciclo = ciclosAbertos[0];
                const itensRows = await db.cicloItens.listByCiclo(String(ciclo.id));
                const pending = (itensRows || []).filter(x => !x.status_devolucao);

                const byId = new Map();
                devolvidos.forEach(idItem => {
                    const key = String(idItem);
                    byId.set(key, Number(byId.get(key) || 0) + 1);
                });

                for (const [itemId, qty] of byId.entries()) {
                    let left = qty;
                    for (const row of pending) {
                        if (left <= 0) break;
                        if (String(row.item_id) !== String(itemId)) continue;
                        await db.cicloItens.update(String(row.id), { status_devolucao: 'ok', evidencia_foto: null });
                        left -= 1;
                    }
                }

                const refreshed = await db.cicloItens.listByCiclo(String(ciclo.id));
                const stillOpen = (refreshed || []).some(x => !x.status_devolucao);
                if (!stillOpen) {
                    const now = new Date().toISOString();
                    const atendido_por = req.user && req.user.username ? String(req.user.username) : null;
                    await db.ciclosUniforme.update(String(ciclo.id), {
                        id: String(ciclo.id),
                        funcionario_id: String(ciclo.funcionario_id),
                        data_retirada: ciclo.data_retirada || null,
                        data_devolucao: now,
                        status: 'devolvido',
                        evidencias: null,
                        criado_por: ciclo.criado_por || null,
                        finalizado_por: atendido_por,
                        observacoes: null,
                        updatedAt: now
                    });
                }
            }
        }
        const result = await registrarMovimentacaoEpi({
            funcionario_id,
            itens_retirados: retirados,
            itens_devolvidos: devolvidos,
            evidencia,
            tipo_evidencia,
            termo
        });
        if (!result || !result.ok) return res.status(400).json({ ok: false, erro: result && result.erro ? result.erro : 'Erro ao registrar movimentação' });
        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao registrar movimentação' });
    }
});

// Registrar desconto
router.post('/portaria/desconto', sesmtAuth, async (req, res) => {
    try {
        const payload = req.body || {};
        if (!payload.nome_funcionario || !payload.cpf_funcionario || !Array.isArray(payload.itens)) {
            return res.status(400).json({ ok: false, erro: 'Dados incompletos' });
        }
        
        await db.descontosEpis.create({
            id: crypto.randomUUID(),
            nome_funcionario: payload.nome_funcionario,
            cpf_funcionario: payload.cpf_funcionario,
            itens: payload.itens,
            parcelas: payload.parcelas || 1,
            status: 'pendente',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
        
        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao registrar desconto' });
    }
});

// Gerar termo de desconto (PDF)
router.post('/portaria/termo-desconto', sesmtAuth, async (req, res) => {
    try {
        const { funcionario_id, itens_nao_devolvidos, parcelas } = req.body || {};
        if (!funcionario_id || !Array.isArray(itens_nao_devolvidos) || itens_nao_devolvidos.length === 0) {
            return res.status(400).json({ ok: false, erro: 'Dados inválidos' });
        }
        const funcionario = await db.funcionarios.getById(funcionario_id);
        if (!funcionario) return res.status(404).json({ ok: false, erro: 'Funcionário não encontrado' });
        const epis = await db.epis.getAll();
        const itens = itens_nao_devolvidos.map(id => {
            const e = epis.find(x => String(x.id) === String(id));
            return {
                id: String(id),
                nome: e ? String(e.nome || id) : String(id),
                valor: e && typeof e.valor === 'number' ? e.valor : 0
            };
        });
        const descontoId = crypto.randomUUID();
        await db.descontosEpis.create({
            id: descontoId,
            nome_funcionario: String(funcionario.nome || ''),
            cpf_funcionario: String(funcionario.cpf || ''),
            itens,
            parcelas: parseInt(parcelas || 1, 10) || 1,
            status: 'pendente',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
        const buffer = await pdfService.pdfBufferFromDescontoData({
            nome_funcionario: String(funcionario.nome || ''),
            cpf_funcionario: String(funcionario.cpf || ''),
            itens,
            parcelas: parseInt(parcelas || 1, 10) || 1
        });
        const termoPdf = 'data:application/pdf;base64,' + buffer.toString('base64');
        res.json({ ok: true, termo: termoPdf, desconto_id: descontoId });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao gerar termo de desconto' });
    }
});

router.post('/portaria/estoque', portariaAuth, async (req, res) => {
    try {
        const { epi_id, quantidade } = req.body;
        const qtd = parseInt(quantidade, 10);
        
        if (!epi_id || isNaN(qtd) || qtd <= 0) {
            return res.status(400).json({ ok: false, erro: 'Dados inválidos' });
        }

        const epi = await db.epis.getById(epi_id);
        if (!epi) {
            return res.status(404).json({ ok: false, erro: 'EPI não encontrado' });
        }

        const novoEstoque = (epi.estoque || 0) + qtd;
        
        await db.epis.update(epi_id, {
            ...epi,
            estoque: novoEstoque,
            updatedAt: new Date().toISOString()
        });

        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao atualizar estoque' });
    }
});


    return router;
};
