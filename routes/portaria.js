const express = require('express');
const router = express.Router();
const db = require('../services/db');
const { portariaAuth } = require('../middleware/auth');
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

router.get('/epi/epis', epiPublicLimiter, async (req, res) => {
    try {
        const epis = await db.epis.getAll();
        const mapped = epis.map(ep => ({ id: ep.id, nome: ep.nome, estoque: ep.estoque || 0, ca_validade: ep.ca_validade || null }));
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
        const hasPendente = descontos.some(d => {
            const cpf = String(d.cpf_funcionario || '').replace(/\D/g, '');
            return cpf === String(func.cpf || '').replace(/\D/g, '') && (d.status || 'pendente') === 'pendente';
        });
        if (hasPendente) return res.status(403).json({ ok: false, erro: 'Funcionário bloqueado: pendência no RH' });

        res.json({
            ok: true,
            funcionario: {
                id: func.id,
                nome: func.nome,
                cpf: func.cpf,
                matricula: func.matricula,
                cargo: func.cargo,
                setor: func.setor
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

        if (!funcionario_id) {
            if (!doc) return res.status(400).json({ ok: false, erro: 'Funcionário inválido' });
            const funcionarios = await db.funcionarios.getAll();
            const func = funcionarios.find(f => {
                const cpf = String(f.cpf || '').replace(/\D/g, '');
                const matricula = String(f.matricula || '').replace(/\D/g, '');
                return cpf === doc || matricula === doc;
            });
            if (!func) return res.status(404).json({ ok: false, erro: 'Funcionário não encontrado' });

            const descontos = await db.descontosEpis.getAll();
            const hasPendente = descontos.some(d => {
                const cpf = String(d.cpf_funcionario || '').replace(/\D/g, '');
                return cpf === String(func.cpf || '').replace(/\D/g, '') && (d.status || 'pendente') === 'pendente';
            });
            if (hasPendente) return res.status(403).json({ ok: false, erro: 'Funcionário bloqueado: pendência no RH' });

            funcionario_id = String(func.id);
        }

        const itens = Array.isArray(payload.itens_solicitados)
            ? payload.itens_solicitados
            : (Array.isArray(payload.itens) ? payload.itens : []);

        const itens_solicitados = itens.map(x => String(x)).filter(Boolean);
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
        
        // Bloqueio por desconto pendente
        const descontos = await db.descontosEpis.getAll();
        const hasPendente = descontos.some(d => {
            const cpf = String(d.cpf_funcionario || '').replace(/\D/g, '');
            return cpf === String(func.cpf || '').replace(/\D/g, '') && (d.status || 'pendente') === 'pendente';
        });
        if (hasPendente) {
            return res.status(403).json({ ok: false, erro: 'Funcionário bloqueado: pendência no RH' });
        }
        
        // Calcular itens em posse
        const allMovs = await db.movimentacoesEpis.getAll();
        const movs = allMovs.filter(m => m.funcionario_id === func.id);
        const posse = new Set();
        movs.forEach(m => {
            (m.itens_retirados || []).forEach(id => posse.add(id));
            (m.itens_devolvidos || []).forEach(id => posse.delete(id));
        });
        return res.json({ ok: true, funcionario: func, itensEmPosse: Array.from(posse) });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao buscar funcionário' });
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
        const status = String((req.body || {}).status || '').trim().toLowerCase();
        const allowed = new Set(['pendente', 'atendida', 'cancelada']);
        if (!allowed.has(status)) return res.status(400).json({ ok: false, erro: 'Status inválido' });

        const current = await db.solicitacoesEpis.getById(id);
        if (!current) return res.status(404).json({ ok: false, erro: 'Solicitação não encontrada' });

        const now = new Date().toISOString();
        const atendido_at = status === 'atendida' ? now : null;
        const atendido_por = status === 'atendida' ? (req.user && req.user.username ? String(req.user.username) : null) : null;

        await db.solicitacoesEpis.updateStatus(id, {
            status,
            atendido_at,
            atendido_por,
            updatedAt: now
        });

        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao atualizar solicitação' });
    }
});

// Registrar movimentação
router.post('/portaria/movimentacao', portariaAuth, async (req, res) => {
    try {
        const { funcionario_id, itens_retirados, itens_devolvidos, evidencia, tipo_evidencia, termo } = req.body;
        if (!funcionario_id) return res.status(400).json({ ok: false, erro: 'Funcionário inválido' });
        
        const epis = await db.epis.getAll();
        const now = new Date();
        
        // Validar estoque
        for (const id of (itens_retirados || [])) {
            const item = epis.find(e => e.id === id);
            if (!item) return res.status(400).json({ ok: false, erro: `EPI ${id} inexistente` });
            if ((item.estoque || 0) <= 0) return res.status(400).json({ ok: false, erro: `Sem estoque para ${item.nome}` });
            if (item.ca_validade) {
                const caDate = new Date(item.ca_validade);
                if (!Number.isNaN(caDate.getTime()) && caDate < now) {
                    return res.status(400).json({ ok: false, erro: `CA vencido para ${item.nome}` });
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
        
        // Atualizar estoque
        for (const id of (itens_retirados || [])) {
            const item = epis.find(e => e.id === id);
            if (item) {
                const newStock = Math.max(0, (item.estoque || 0) - 1);
                await db.epis.update(item.id, { ...item, estoque: newStock, updatedAt: new Date().toISOString() });
            }
        }
        for (const id of (itens_devolvidos || [])) {
            const item = epis.find(e => e.id === id);
            if (item) {
                const newStock = (item.estoque || 0) + 1;
                await db.epis.update(item.id, { ...item, estoque: newStock, updatedAt: new Date().toISOString() });
            }
        }
        
        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao registrar movimentação' });
    }
});

// Registrar desconto
router.post('/portaria/desconto', portariaAuth, async (req, res) => {
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

module.exports = router;
