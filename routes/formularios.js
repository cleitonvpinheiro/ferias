const express = require('express');
const router = express.Router();
const db = require('../services/db');
const { tdAuth, adminAuth, verifyToken, checkRole, ROLES } = require('../middleware/auth');
const crypto = require('crypto');
const axios = require('axios');

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
        const dash = form.dashboardId || form.dashboard_id || form.id;
        if (dash && db.dashboardsFormularios && db.dashboardsFormularios.touch) {
            await db.dashboardsFormularios.touch(dash);
        }
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

// Listar respostas de um formulário
router.get('/:id/respostas', [verifyToken, checkRole([ROLES.TD, ROLES.RH_GERAL, ROLES.RH, ROLES.ADMIN, ROLES.ENDOMARKETING || 'endomarketing'])], async (req, res) => {
    try {
        const form = await db.formularios.getById(req.params.id);
        if (!form) {
            return res.status(404).json({ error: 'Formulário não encontrado' });
        }
        const respostas = await db.respostas.getByFormId(req.params.id);
        res.json(respostas || []);
    } catch (error) {
        console.error('Erro ao obter respostas do formulário:', error);
        res.status(500).json({ error: 'Erro ao obter respostas' });
    }
});

router.get('/dashboards/list', [verifyToken, checkRole([ROLES.TD, ROLES.RH_GERAL, ROLES.RH, ROLES.ADMIN, ROLES.ENDOMARKETING || 'endomarketing'])], async (req, res) => {
    try {
        const items = await db.dashboardsFormularios.getAll();
        res.json(items || []);
    } catch (error) {
        console.error('Erro ao listar dashboards de formulários:', error);
        res.status(500).json({ error: 'Erro ao listar dashboards' });
    }
});

router.get('/dashboards/:id', [verifyToken, checkRole([ROLES.TD, ROLES.RH_GERAL, ROLES.RH, ROLES.ADMIN, ROLES.ENDOMARKETING || 'endomarketing'])], async (req, res) => {
    try {
        const id = req.params.id;
        const dash = await db.dashboardsFormularios.getById(id);
        if (!dash) return res.status(404).json({ error: 'Dashboard não encontrado' });
        const forms = await db.formularios.getByDashboardId(id);
        res.json({ dashboard: dash, forms: forms || [] });
    } catch (error) {
        console.error('Erro ao obter dashboard de formulários:', error);
        res.status(500).json({ error: 'Erro ao obter dashboard' });
    }
});

router.get('/dashboards/:id/respostas', [verifyToken, checkRole([ROLES.TD, ROLES.RH_GERAL, ROLES.RH, ROLES.ADMIN, ROLES.ENDOMARKETING || 'endomarketing'])], async (req, res) => {
    try {
        const id = req.params.id;
        const dash = await db.dashboardsFormularios.getById(id);
        if (!dash) return res.status(404).json({ error: 'Dashboard não encontrado' });
        const respostas = await db.respostas.getByDashboardId(id);
        res.json(respostas || []);
    } catch (error) {
        console.error('Erro ao obter respostas do dashboard:', error);
        res.status(500).json({ error: 'Erro ao obter respostas' });
    }
});

router.post('/:id/ai-resumo', [verifyToken, checkRole([ROLES.TD, ROLES.RH_GERAL, ROLES.RH, ROLES.ADMIN, ROLES.ENDOMARKETING || 'endomarketing'])], async (req, res) => {
    try {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            return res.status(501).json({ ok: false, error: 'IA não configurada (OPENAI_API_KEY ausente)' });
        }

        const form = await db.formularios.getById(req.params.id);
        if (!form) return res.status(404).json({ ok: false, error: 'Formulário não encontrado' });

        const respostas = await db.respostas.getByFormId(req.params.id);
        const items = Array.isArray(respostas) ? respostas : [];

        const questoes = Array.isArray(form.questoes) ? form.questoes : [];
        const compact = items
            .slice()
            .sort((a, b) => String(b.created_at || b.createdAt || '').localeCompare(String(a.created_at || a.createdAt || '')))
            .slice(0, 120)
            .map(it => {
                const respostasObj = (it && it.respostas && typeof it.respostas === 'object') ? it.respostas : {};
                const respostasFmt = questoes.map((q, idx) => {
                    const r = respostasObj[String(idx)] ?? respostasObj[idx];
                    const ans = r && typeof r === 'object' ? (r.answer ?? '') : (r ?? '');
                    return {
                        category: q.category || '',
                        question: q.question || q.text || '',
                        answer: String(ans ?? '')
                    };
                });
                return {
                    createdAt: it.created_at || it.createdAt || '',
                    funcionarioId: it.funcionario_id || it.funcionarioId || null,
                    respostas: respostasFmt
                };
            });

        const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
        const prompt = [
            'Você é um analista de RH.',
            'A seguir há respostas de um formulário.',
            'Gere um resumo em pt-BR com:',
            '- Principais temas (bullet points)',
            '- Padrões/repetições (se houver)',
            '- Pontos de atenção (riscos, conflitos, segurança, compliance) quando aparecerem',
            '- Recomendações práticas para o RH',
            '',
            `Formulário: ${String(form.titulo || form.id || '')}`,
            `Tipo: ${String(form.tipo || '')}`,
            `Total de respostas no banco: ${items.length}`,
            `Amostra analisada: ${compact.length}`,
            '',
            'Dados (amostra):',
            JSON.stringify(compact)
        ].join('\n');

        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model,
            messages: [
                { role: 'system', content: 'Responda apenas com texto, sem markdown.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.2
        }, {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 30000
        });

        const content = response && response.data && response.data.choices && response.data.choices[0] && response.data.choices[0].message
            ? response.data.choices[0].message.content
            : '';

        res.json({ ok: true, content: String(content || '').trim() });
    } catch (error) {
        const msg = error && error.response && error.response.data
            ? JSON.stringify(error.response.data)
            : (error && error.message ? error.message : 'Erro ao gerar resumo');
        res.status(500).json({ ok: false, error: msg });
    }
});

router.post('/dashboards/:id/ai-resumo', [verifyToken, checkRole([ROLES.TD, ROLES.RH_GERAL, ROLES.RH, ROLES.ADMIN, ROLES.ENDOMARKETING || 'endomarketing'])], async (req, res) => {
    try {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            return res.status(501).json({ ok: false, error: 'IA não configurada (OPENAI_API_KEY ausente)' });
        }

        const dashId = req.params.id;
        const dash = await db.dashboardsFormularios.getById(dashId);
        if (!dash) return res.status(404).json({ ok: false, error: 'Dashboard não encontrado' });

        const forms = await db.formularios.getByDashboardId(dashId);
        const respostas = await db.respostas.getByDashboardId(dashId);
        const items = Array.isArray(respostas) ? respostas : [];
        const questoes = forms && forms[0] && Array.isArray(forms[0].questoes) ? forms[0].questoes : [];

        const compact = items
            .slice(0, 160)
            .map(it => {
                const respostasObj = (it && it.respostas && typeof it.respostas === 'object') ? it.respostas : {};
                const respostasFmt = questoes.map((q, idx) => {
                    const r = respostasObj[String(idx)] ?? respostasObj[idx];
                    const ans = r && typeof r === 'object' ? (r.answer ?? '') : (r ?? '');
                    return {
                        category: q.category || '',
                        question: q.question || q.text || '',
                        answer: String(ans ?? '')
                    };
                });
                return {
                    createdAt: it.created_at || it.createdAt || '',
                    funcionarioId: it.funcionario_id || it.funcionarioId || null,
                    formularioId: it.formulario_id || it.formularioId || null,
                    formularioTitulo: it.formulario_titulo || '',
                    respostas: respostasFmt
                };
            });

        const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
        const prompt = [
            'Você é um analista de RH.',
            'A seguir há respostas de um modelo de formulário (com histórico).',
            'Gere um resumo em pt-BR com:',
            '- Principais temas (bullet points)',
            '- Tendências ao longo do tempo (quando possível)',
            '- Pontos de atenção (riscos, conflitos, segurança, compliance) quando aparecerem',
            '- Recomendações práticas para o RH',
            '',
            `Dashboard/Modelo: ${String(dash.titulo || dash.id || '')}`,
            `Tipo: ${String(dash.tipo || '')}`,
            `Total de formulários no modelo: ${Array.isArray(forms) ? forms.length : 0}`,
            `Total de respostas no modelo: ${items.length}`,
            `Amostra analisada: ${compact.length}`,
            '',
            'Dados (amostra):',
            JSON.stringify(compact)
        ].join('\n');

        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model,
            messages: [
                { role: 'system', content: 'Responda apenas com texto, sem markdown.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.2
        }, {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 30000
        });

        const content = response && response.data && response.data.choices && response.data.choices[0] && response.data.choices[0].message
            ? response.data.choices[0].message.content
            : '';

        res.json({ ok: true, content: String(content || '').trim() });
    } catch (error) {
        const msg = error && error.response && error.response.data
            ? JSON.stringify(error.response.data)
            : (error && error.message ? error.message : 'Erro ao gerar resumo');
        res.status(500).json({ ok: false, error: msg });
    }
});

// Criar novo formulário
router.post('/', tdAuth, async (req, res) => {
    try {
        const { id, titulo, tipo, questoes, ativo, dashboardId } = req.body;
        
        // Generate ID if not provided
        const newId = id || titulo.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

        const existing = await db.formularios.getById(newId);
        if (existing) {
            return res.status(400).json({ error: 'Já existe um formulário com este ID' });
        }

        const dashId = (dashboardId && String(dashboardId).trim()) ? String(dashboardId).trim() : newId;
        const existingDash = await db.dashboardsFormularios.getById(dashId);
        await db.dashboardsFormularios.create({
            id: dashId,
            titulo: existingDash ? null : titulo,
            tipo: existingDash ? null : (tipo || 'avaliacao')
        });

        const newForm = {
            id: newId,
            titulo,
            tipo: tipo || 'avaliacao',
            questoes: questoes || [],
            ativo: ativo !== undefined ? ativo : true,
            dashboardId: dashId,
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
        const { titulo, tipo, questoes, ativo, dashboardId } = req.body;
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
            dashboardId: dashboardId || form.dashboardId || form.dashboard_id || form.id,
            updatedAt: new Date().toISOString()
        };

        const dash = await db.dashboardsFormularios.getById(updatedForm.dashboardId);
        const allowUpdateDashMeta = !dash || String(updatedForm.dashboardId) === String(updatedForm.id);
        await db.dashboardsFormularios.create({
            id: updatedForm.dashboardId,
            titulo: allowUpdateDashMeta ? updatedForm.titulo : null,
            tipo: allowUpdateDashMeta ? updatedForm.tipo : null,
            updatedAt: updatedForm.updatedAt
        });
        await db.formularios.update(req.params.id, updatedForm);
        res.json(updatedForm);
    } catch (error) {
        console.error('Erro ao atualizar formulário:', error);
        res.status(500).json({ error: 'Erro ao atualizar formulário' });
    }
});

// Excluir formulário
router.delete('/:id', tdAuth, async (req, res) => {
    try {
        await db.formularios.delete(req.params.id);
        res.json({ message: 'Formulário excluído com sucesso' });
    } catch (error) {
        console.error('Erro ao excluir formulário:', error);
        res.status(500).json({ error: 'Erro ao excluir formulário' });
    }
});

module.exports = router;
