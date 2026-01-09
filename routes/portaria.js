const express = require('express');
const router = express.Router();
const db = require('../services/db');
const { portariaAuth } = require('../middleware/auth');
const crypto = require('crypto');

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

// Registrar movimentação
router.post('/portaria/movimentacao', portariaAuth, async (req, res) => {
    try {
        const { funcionario_id, itens_retirados, itens_devolvidos, evidencia, tipo_evidencia } = req.body;
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

        await db.movimentacoesEpis.create({
            id: crypto.randomUUID(),
            funcionario_id,
            itens_retirados: Array.isArray(itens_retirados) ? itens_retirados : [],
            itens_devolvidos: Array.isArray(itens_devolvidos) ? itens_devolvidos : [],
            evidencia: evidencia || null,
            tipo_evidencia: tipo_evidencia || null,
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
