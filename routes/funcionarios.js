const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../services/db');
const questorService = require('../services/questorService');
const { dpAuth, verifyToken, checkRole, ROLES } = require('../middleware/auth');

const funcionariosReadAuth = [verifyToken, checkRole([ROLES.DP, ROLES.TD, ROLES.RH_GERAL, ROLES.RH])];

// Public
router.get('/funcionarios', funcionariosReadAuth, async (req, res) => {
    const data = await db.funcionarios.getAll();
    res.json(data);
});

// RH Protected
router.get('/rh/funcionarios', dpAuth, async (req, res) => {
    const data = await db.funcionarios.getAll();
    res.json(data);
});

// Sincronizar com Questor
router.post('/rh/funcionarios/sync-questor', dpAuth, async (req, res) => {
    try {
        const resultado = await questorService.syncFuncionarios();
        res.json(resultado);
    } catch (e) {
        console.error('Erro na sincronização Questor:', e);
        res.status(500).json({ ok: false, erro: e.message || 'Erro ao sincronizar com Questor' });
    }
});

router.post('/rh/funcionarios/importar', dpAuth, async (req, res) => {
    try {
        const { funcionarios } = req.body;
        if (!Array.isArray(funcionarios)) {
            return res.status(400).json({ ok: false, erro: 'Formato inválido' });
        }

        const currentDb = await db.funcionarios.getAll();
        let novos = 0;
        let atualizados = 0;

        for (const f of funcionarios) {
            // Normalizar CPF para evitar strings vazias que violam UNIQUE em inserts múltiplos (embora SQLite aceite NULLs múltiplos)
            if (!f.cpf || f.cpf.trim() === '') {
                f.cpf = null;
            }

            let existing = null;
            
            // Tentar encontrar por CPF se existir
            if (f.cpf) {
                existing = currentDb.find(e => e.cpf === f.cpf);
            }
            
            // Se não encontrou por CPF, tentar por Matrícula (se existir)
            if (!existing && f.matricula) {
                existing = currentDb.find(e => e.matricula === f.matricula);
            }

            // Se não encontrou por CPF nem Matrícula, tentar por Nome (para evitar duplicação de quem não tem documentos)
            if (!existing && f.nome) {
                existing = currentDb.find(e => e.nome.toLowerCase().trim() === f.nome.toLowerCase().trim());
            }

            if (existing) {
                await db.funcionarios.update(existing.id, { ...existing, ...f });
                atualizados++;
            } else {
                await db.funcionarios.create({
                    id: crypto.randomUUID(),
                    ...f
                });
                novos++;
            }
        }

        res.json({ ok: true, novos, atualizados });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao importar funcionários' });
    }
});

router.delete('/rh/funcionarios/:id', dpAuth, async (req, res) => {
    try {
        await db.funcionarios.delete(req.params.id);
        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao excluir funcionário' });
    }
});

router.get('/gestor/equipe', [verifyToken, checkRole([ROLES.GESTOR, ROLES.RH_GERAL, ROLES.RH, ROLES.DP])], async (req, res) => {
    try {
        const username = req.user && req.user.username;
        if (!username) return res.status(401).json({ ok: false, erro: 'Usuário não autenticado' });
        const equipe = await db.gestorEquipes.getEquipeByGestor(username);
        res.json(equipe);
    } catch (e) {
        console.error('Erro ao obter equipe do gestor:', e);
        res.status(500).json({ ok: false, erro: 'Erro ao carregar equipe' });
    }
});

const equipeManageAuth = [verifyToken, checkRole([ROLES.ADMIN, ROLES.RH_GERAL, ROLES.RH])];

router.get('/rh/equipe/:gestor', equipeManageAuth, async (req, res) => {
    try {
        const equipe = await db.gestorEquipes.getEquipeByGestor(req.params.gestor);
        res.json(equipe);
    } catch (e) {
        console.error('Erro ao obter equipe:', e);
        res.status(500).json({ ok: false, erro: 'Erro ao obter equipe' });
    }
});

router.post('/rh/equipe/:gestor', equipeManageAuth, async (req, res) => {
    try {
        const { funcionario_id } = req.body;
        if (!funcionario_id) return res.status(400).json({ ok: false, erro: 'funcionario_id é obrigatório' });
        await db.gestorEquipes.addMembro(req.params.gestor, funcionario_id);
        res.json({ ok: true });
    } catch (e) {
        console.error('Erro ao adicionar membro na equipe:', e);
        res.status(500).json({ ok: false, erro: 'Erro ao adicionar membro' });
    }
});

router.delete('/rh/equipe/:gestor/:funcionarioId', equipeManageAuth, async (req, res) => {
    try {
        await db.gestorEquipes.removeMembro(req.params.gestor, req.params.funcionarioId);
        res.json({ ok: true });
    } catch (e) {
        console.error('Erro ao remover membro da equipe:', e);
        res.status(500).json({ ok: false, erro: 'Erro ao remover membro' });
    }
});

module.exports = router;
