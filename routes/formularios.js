const express = require('express');
const router = express.Router();
const db = require('../services/db');
const { tdAuth, adminAuth, verifyToken, checkRole, ROLES } = require('../middleware/auth');
const crypto = require('crypto');

// --- Rotas Públicas ---

// Obter definição pública de um formulário
router.get('/public/:id', async (req, res) => {
    try {
        const form = await db.formularios.getById(req.params.id);
        if (!form) {
            return res.status(404).json({ error: 'Formulário não encontrado' });
        }
        if (!form.ativo) {
            return res.status(403).json({ error: 'Este formulário não está aceitando respostas no momento.' });
        }
        // Retornar apenas dados necessários para renderização pública
        res.json({
            id: form.id,
            titulo: form.titulo,
            tipo: form.tipo,
            questoes: form.questoes
        });
    } catch (error) {
        console.error('Erro ao obter formulário público:', error);
        res.status(500).json({ error: 'Erro ao obter formulário' });
    }
});

// Enviar resposta para um formulário
router.post('/public/:id/responder', async (req, res) => {
    try {
        const formId = req.params.id;
        const { respostas, funcionarioId } = req.body;

        const form = await db.formularios.getById(formId);
        if (!form) {
            return res.status(404).json({ error: 'Formulário não encontrado' });
        }
        if (!form.ativo) {
            return res.status(403).json({ error: 'Este formulário não está aceitando respostas no momento.' });
        }

        const newResponse = {
            id: crypto.randomUUID(),
            formulario_id: formId,
            funcionario_id: funcionarioId || null, // Opcional (anônimo ou autenticado)
            respostas: respostas || {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await db.respostas.create(newResponse);
        res.status(201).json({ message: 'Resposta enviada com sucesso!', id: newResponse.id });
    } catch (error) {
        console.error('Erro ao salvar resposta:', error);
        res.status(500).json({ error: 'Erro ao salvar resposta' });
    }
});

// --- Rotas Administrativas (RH) ---

// Listar todos os formulários
router.get('/', [verifyToken, checkRole([ROLES.TD, ROLES.RH_GERAL, ROLES.RH, ROLES.ADMIN, ROLES.ENDOMARKETING || 'endomarketing'])], async (req, res) => {
    try {
        const forms = await db.formularios.getAll();
        res.json(forms);
    } catch (error) {
        console.error('Erro ao listar formulários:', error);
        res.status(500).json({ error: 'Erro ao listar formulários' });
    }
});

// Obter um formulário específico
router.get('/:id', [verifyToken, checkRole([ROLES.TD, ROLES.RH_GERAL, ROLES.RH, ROLES.ADMIN, ROLES.ENDOMARKETING || 'endomarketing'])], async (req, res) => {
    try {
        const form = await db.formularios.getById(req.params.id);
        if (!form) {
            return res.status(404).json({ error: 'Formulário não encontrado' });
        }
        res.json(form);
    } catch (error) {
        console.error('Erro ao obter formulário:', error);
        res.status(500).json({ error: 'Erro ao obter formulário' });
    }
});

// Criar novo formulário
router.post('/', tdAuth, async (req, res) => {
    try {
        const { id, titulo, tipo, questoes, ativo } = req.body;
        
        // Generate ID if not provided
        const newId = id || titulo.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

        const existing = await db.formularios.getById(newId);
        if (existing) {
            return res.status(400).json({ error: 'Já existe um formulário com este ID' });
        }

        const newForm = {
            id: newId,
            titulo,
            tipo: tipo || 'avaliacao',
            questoes: questoes || [],
            ativo: ativo !== undefined ? ativo : true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await db.formularios.create(newForm);
        res.status(201).json(newForm);
    } catch (error) {
        console.error('Erro ao criar formulário:', error);
        res.status(500).json({ error: 'Erro ao criar formulário' });
    }
});

// Atualizar formulário
router.put('/:id', tdAuth, async (req, res) => {
    try {
        const { titulo, tipo, questoes, ativo } = req.body;
        const form = await db.formularios.getById(req.params.id);
        
        if (!form) {
            return res.status(404).json({ error: 'Formulário não encontrado' });
        }

        const updatedForm = {
            ...form,
            titulo: titulo || form.titulo,
            tipo: tipo || form.tipo,
            questoes: questoes || form.questoes,
            ativo: ativo !== undefined ? ativo : form.ativo,
            updatedAt: new Date().toISOString()
        };

        await db.formularios.update(req.params.id, updatedForm);
        res.json(updatedForm);
    } catch (error) {
        console.error('Erro ao atualizar formulário:', error);
        res.status(500).json({ error: 'Erro ao atualizar formulário' });
    }
});

// Excluir formulário
router.delete('/:id', adminAuth, async (req, res) => {
    try {
        await db.formularios.delete(req.params.id);
        res.json({ message: 'Formulário excluído com sucesso' });
    } catch (error) {
        console.error('Erro ao excluir formulário:', error);
        res.status(500).json({ error: 'Erro ao excluir formulário' });
    }
});

module.exports = router;
