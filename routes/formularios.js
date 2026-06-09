const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const axios = require('axios');
const jwt = require('jsonwebtoken');

const normRole = (v) => String(v || '').trim().toLowerCase();


let db;

module.exports = (_db, auth) => {
    db = _db;
    const { verifyToken,checkRole,ROLES,tdAuth,SECRET } = auth;
    const ALL_ROLES = new Set(Object.values(ROLES).map(r => normRole(r)));

async function getOptionalUser(req) {
    let token = req.cookies && req.cookies.token;
    if (!token && req.headers.authorization) {
        const parts = String(req.headers.authorization || '').split(' ');
        if (parts.length === 2 && parts[0] === 'Bearer') token = parts[1];
    }
    if (!token) return null;
    try {
        const decoded = jwt.verify(token, SECRET);
        if (decoded && typeof decoded.role === 'string') decoded.role = normRole(decoded.role);
        const username = decoded && decoded.username ? String(decoded.username).trim().toLowerCase() : '';
        if (username) {
            try {
                const dbUser = await db.users.getByUsername(username);
                if (dbUser && typeof dbUser.role === 'string' && dbUser.role.trim()) decoded.role = normRole(dbUser.role);
                if (dbUser && typeof dbUser.email === 'string' && dbUser.email.trim()) decoded.email = dbUser.email.trim();
                if (dbUser && typeof dbUser.name === 'string' && dbUser.name.trim()) decoded.name = dbUser.name.trim();
            } catch (_) {}
        }
        return decoded;
    } catch (_) {
        return null;
    }
}

function sanitizeAllowedRoles(raw) {
    const arr = Array.isArray(raw) ? raw : [];
    return Array.from(
        new Set(
            arr
                .map(x => normRole(x))
                .filter(x => x && ALL_ROLES.has(x))
        )
    );
}

async function assertFormAccess(req, res, form) {
    const publico = form && (form.publico == null ? 1 : (Number(form.publico) ? 1 : 0));
    if (publico) return { ok: true, user: null };

    const user = await getOptionalUser(req);
    if (!user) {
        res.status(401).json({ error: 'Login necessário para acessar este formulário.' });
        return { ok: false };
    }

    const role = normRole(user && user.role);
    if (role === ROLES.ADMIN) return { ok: true, user };

    const allowed = Array.isArray(form && form.allowed_roles) ? form.allowed_roles.map(normRole) : [];
    const allowSet = new Set(allowed.filter(Boolean));
    if (allowSet.size === 0) {
        res.status(403).json({ error: 'Acesso restrito.' });
        return { ok: false };
    }
    if (!allowSet.has(role)) {
        res.status(403).json({ error: 'Acesso proibido para seu perfil.' });
        return { ok: false };
    }
    return { ok: true, user };
}

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
        const access = await assertFormAccess(req, res, form);
        if (!access.ok) return;
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
        const access = await assertFormAccess(req, res, form);
        if (!access.ok) return;

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
        const publico = req.body && Object.prototype.hasOwnProperty.call(req.body, 'publico') ? (req.body.publico ? 1 : 0) : 1;
        const allowedRoles = sanitizeAllowedRoles(req.body && (req.body.allowed_roles || req.body.allowedRoles));
        
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
            publico,
            allowed_roles: publico ? [] : allowedRoles,
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
        const publico = req.body && Object.prototype.hasOwnProperty.call(req.body, 'publico') ? (req.body.publico ? 1 : 0) : (form.publico == null ? 1 : (Number(form.publico) ? 1 : 0));
        const allowedRoles = sanitizeAllowedRoles(req.body && (req.body.allowed_roles || req.body.allowedRoles));

        const updatedForm = {
            ...form,
            titulo: titulo || form.titulo,
            tipo: tipo || form.tipo,
            questoes: questoes || form.questoes,
            ativo: ativo !== undefined ? ativo : form.ativo,
            dashboardId: dashboardId || form.dashboardId || form.dashboard_id || form.id,
            publico,
            allowed_roles: publico ? [] : (allowedRoles.length ? allowedRoles : (Array.isArray(form.allowed_roles) ? form.allowed_roles : [])),
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

// Importar formulários via Excel
router.post('/importar', tdAuth, async (req, res) => {
    try {
        const { items } = req.body || {};
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ ok: false, erro: 'Nenhum dado enviado' });
        }

        const now = new Date().toISOString();
        let importados = 0;

        for (const item of items) {
            const titulo = String(item.titulo || item.Titulo || '').trim();
            if (!titulo) continue;

            const id = String(item.id || item.ID || titulo.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')).trim();
            const tipo = String(item.tipo || item.Tipo || 'avaliacao').trim();
            const dashId = String(item.dashboard_id || item.dashboardId || item['ID Dashboard'] || id).trim();
            
            // Processar questões se vierem como string JSON ou formatadas
            let questoes = [];
            try {
                const qRaw = item.questoes || item.Questoes || item['Questões'];
                if (qRaw) {
                    questoes = typeof qRaw === 'string' ? JSON.parse(qRaw) : qRaw;
                }
            } catch (e) {
                console.warn(`Erro ao processar questões do formulário ${titulo}:`, e.message);
            }

            const existing = await db.formularios.getById(id);
            if (existing) {
                // Atualiza se já existir
                await db.formularios.update(id, {
                    ...existing,
                    titulo,
                    tipo,
                    questoes,
                    dashboardId: dashId,
                    updatedAt: now
                });
            } else {
                // Cria se não existir
                const existingDash = await db.dashboardsFormularios.getById(dashId);
                await db.dashboardsFormularios.create({
                    id: dashId,
                    titulo: existingDash ? null : titulo,
                    tipo: existingDash ? null : tipo
                });

                await db.formularios.create({
                    id,
                    titulo,
                    tipo,
                    questoes,
                    ativo: true,
                    publico: 1,
                    dashboardId: dashId,
                    createdAt: now,
                    updatedAt: now
                });
            }
            importados++;
        }

        res.json({ ok: true, importados });
    } catch (e) {
        console.error('Erro na importação de formulários:', e);
        res.status(500).json({ ok: false, erro: 'Erro ao importar formulários' });
    }
});

// Parse inteligente de texto para formulário (IA)
router.post('/ia-parse', [verifyToken, checkRole([ROLES.TD, ROLES.ADMIN])], async (req, res) => {
    try {
        const { texto } = req.body;
        if (!texto || texto.length < 10) {
            return res.status(400).json({ ok: false, erro: 'Texto muito curto para análise.' });
        }

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) return res.status(501).json({ ok: false, error: 'IA não configurada.' });

        const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
        const prompt = `
            Você é um especialista em estruturação de dados para sistemas de RH.
            Abaixo está um texto que contém perguntas de um formulário (pode ser vindo de Word ou Microsoft Forms).
            Converta este texto em um objeto JSON válido para o nosso sistema.
            
            O JSON deve ter este formato:
            {
                "titulo": "Título Sugerido",
                "tipo": "avaliacao" ou "pesquisa" ou "checklist",
                "questoes": [
                    {
                        "category": "Categoria da Questão",
                        "type": "text" ou "textarea" ou "rating" ou "select" ou "radio",
                        "question": "O texto da pergunta",
                        "required": true,
                        "options": [{"value": "1", "label": "Opção 1"}] (apenas se for select, radio ou rating)
                    }
                ]
            }

            Texto para converter:
            ${texto}
        `;

        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model,
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: "json_object" },
            temperature: 0.3
        }, {
            headers: { Authorization: `Bearer ${apiKey}` }
        });

        const result = JSON.parse(response.data.choices[0].message.content);
        res.json({ ok: true, data: result });
    } catch (e) {
        console.error('Erro no parse de IA:', e);
        res.status(500).json({ ok: false, erro: 'Falha ao processar texto com IA.' });
    }
});


    return router;
};
