const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../services/db');
const questorService = require('../services/questorService');
const { rhAuth } = require('../middleware/auth');

// Public
router.get('/funcionarios', async (req, res) => {
    const data = await db.funcionarios.getAll();
    res.json(data);
});

// RH Protected
router.get('/rh/funcionarios', rhAuth, async (req, res) => {
    const data = await db.funcionarios.getAll();
    res.json(data);
});

// Sincronizar com Questor
router.post('/rh/funcionarios/sync-questor', rhAuth, async (req, res) => {
    try {
        const resultado = await questorService.syncFuncionarios();
        res.json(resultado);
    } catch (e) {
        console.error('Erro na sincronização Questor:', e);
        res.status(500).json({ ok: false, erro: e.message || 'Erro ao sincronizar com Questor' });
    }
});

router.post('/rh/funcionarios/importar', rhAuth, async (req, res) => {
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

router.delete('/rh/funcionarios/:id', rhAuth, async (req, res) => {
    try {
        await db.funcionarios.delete(req.params.id);
        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao excluir funcionário' });
    }
});

module.exports = router;
