const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const emailService = require('../services/email');
const pdfService = require('../services/pdfService');
const externalTalentService = require('../services/externalTalentService');


module.exports = (db, auth) => {
    const { verifyToken,checkRole,ROLES,recrutamentoAuth,auditLog } = auth;
    const vagasCreateAuth = [verifyToken, checkRole([ROLES.GESTOR, ROLES.LIDER, ROLES.SUPERVISOR, ROLES.GERENTE, ROLES.RECRUTAMENTO, ROLES.RH_GERAL, ROLES.RH, ROLES.ADMIN])];
    const gerenteAuth = [verifyToken, checkRole([ROLES.GERENTE, ROLES.ADMIN])];

router.get('/rh/vagas', recrutamentoAuth, auditLog('view_all', 'vagas'), async (req, res) => {
    try {
        const data = await db.vagas.getAll();
        const lista = (data || [])
            .filter(v => String(v && v.status || '').trim().toLowerCase() !== 'pendente_gerente')
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        res.json(lista);
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao listar vagas' });
    }
});

router.get('/gerente/vagas', gerenteAuth, async (req, res) => {
    try {
        const data = await db.vagas.getAll();
        const lista = (data || [])
            .filter(v => String(v && v.status || '').trim().toLowerCase() === 'pendente_gerente')
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        res.json(lista);
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao listar vagas' });
    }
});

router.post('/gerente/vagas/:id/aprovar', gerenteAuth, async (req, res) => {
    try {
        const id = String(req.params.id || '').trim();
        if (!id) return res.status(400).json({ ok: false, erro: 'ID inválido' });

        const vaga = await db.vagas.getById(id);
        if (!vaga) return res.status(404).json({ ok: false, erro: 'Vaga não encontrada' });

        const statusAtual = String(vaga.status || '').trim().toLowerCase();
        if (statusAtual !== 'pendente_gerente') {
            return res.status(409).json({ ok: false, erro: 'Vaga não está pendente para aprovação do gerente' });
        }

        const username = req.user && req.user.username ? String(req.user.username) : null;
        const nome = req.user && req.user.name ? String(req.user.name) : null;
        const email = req.user && req.user.email ? String(req.user.email) : null;

        vaga.status = 'pendente';
        vaga.ativa = true;
        vaga.aprovado_por_gerente_username = username;
        vaga.aprovado_por_gerente_nome = nome;
        vaga.aprovado_por_gerente_email = email;
        vaga.aprovado_por_gerente_at = new Date().toISOString();
        vaga.updatedAt = new Date().toISOString();

        await db.vagas.update(id, vaga);
        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao aprovar vaga' });
    }
});

router.post('/vagas', vagasCreateAuth, auditLog('create', 'vagas'), async (req, res) => {
    try {
        const payload = req.body || {};

        const username = req.user && req.user.username ? String(req.user.username) : '';
        const emailUsuario = req.user && req.user.email ? String(req.user.email) : '';
        payload.email_gestor = emailUsuario || (username ? `${username}@familiamadalosso.com.br` : null);
        payload.gestor_nome = req.user && req.user.name ? String(req.user.name) : null;
        payload.gestor_username = username || null;

        if (!payload.cargo || !payload.setor) {
            return res.status(400).json({ ok: false, erro: 'Campos obrigatórios ausentes' });
        }

        const motivo = String(payload.motivo || '').trim().toLowerCase();
        if (motivo === 'substituicao') {
            const substituicaoId = String(payload.substituicao_id || '').trim();
            const substituicaoNome = String(payload.substituicao_nome || '').trim();
            const dataDesligamento = String(payload.data_desligamento || '').trim();

            if (!substituicaoId && !substituicaoNome) {
                return res.status(400).json({ ok: false, erro: 'Colaborador a ser desligado é obrigatório para substituição' });
            }
            if (!dataDesligamento) {
                return res.status(400).json({ ok: false, erro: 'Data prevista de desligamento é obrigatória para substituição' });
            }

            payload.sera_desligado = 'sim';

            if (substituicaoId) {
                const func = await db.funcionarios.getById(substituicaoId);
                if (!func) {
                    return res.status(400).json({ ok: false, erro: 'Colaborador a ser desligado inválido' });
                }
                const cargoVaga = String(payload.cargo || '').trim();
                const cargoFunc = String(func.cargo || '').trim();
                if (cargoVaga && cargoFunc && cargoVaga !== cargoFunc) {
                    return res.status(400).json({ ok: false, erro: 'O colaborador selecionado não corresponde à função escolhida' });
                }
            }

            const normDoc = (v) => String(v || '').replace(/\D/g, '');
            const normNome = (v) => String(v || '').trim().toLowerCase();
            const novoDoc = normDoc(payload.substituicao_cpf || payload.substituicao_doc);
            const novoId = substituicaoId;
            const novoNome = normNome(substituicaoNome);

            const existentes = await db.vagas.getAll();
            const conflito = (existentes || []).find(v => {
                if (!v) return false;
                if (String(v.motivo || '').trim().toLowerCase() !== 'substituicao') return false;
                const status = String(v.status || '').trim().toLowerCase();
                if (status === 'rejeitada' || status === 'reprovada') return false;

                const doc = normDoc(v.substituicao_cpf || v.substituicao_doc);
                const id = String(v.substituicao_id || '').trim();
                const nome = normNome(v.substituicao_nome);

                if (novoDoc) {
                    if (doc && doc === novoDoc) return true;
                    if (!doc && novoNome && nome === novoNome) return true;
                    return false;
                }

                if (novoId) {
                    if (id && id === novoId) return true;
                    if (!id && novoNome && nome === novoNome) return true;
                    return false;
                }

                return !!(novoNome && nome === novoNome);
            });
            if (conflito) {
                return res.status(409).json({ ok: false, erro: 'Já existe uma vaga de substituição cadastrada para este colaborador' });
            }
        }

        const id = crypto.randomUUID();
        const role = req.user && req.user.role ? String(req.user.role).trim().toLowerCase() : '';
        const statusInicial = role === ROLES.SUPERVISOR ? 'pendente_gerente' : 'pendente';
        const ativaInicial = role === ROLES.SUPERVISOR ? false : true;
        const novaVaga = {
            id,
            ...payload,
            status: statusInicial,
            ativa: ativaInicial,
            createdAt: new Date().toISOString()
        };
        
        await db.vagas.create(novaVaga);

        res.json({ ok: true, id });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao criar vaga' });
    }
});

router.put('/vagas/:id', recrutamentoAuth, async (req, res) => {
    try {
        const id = String(req.params.id || '').trim();
        if (!id) return res.status(400).json({ ok: false, erro: 'ID inválido' });

        const vaga = await db.vagas.getById(id);
        if (!vaga) return res.status(404).json({ ok: false, erro: 'Vaga não encontrada' });

        const body = req.body || {};
        const hasAtiva = Object.prototype.hasOwnProperty.call(body, 'ativa');
        const hasStatus = Object.prototype.hasOwnProperty.call(body, 'status');
        if (!hasAtiva && !hasStatus) return res.status(400).json({ ok: false, erro: 'Nenhum campo para atualizar' });

        if (hasAtiva) vaga.ativa = !!body.ativa;
        if (hasStatus) vaga.status = String(body.status || '').trim().toLowerCase() || vaga.status;
        vaga.updatedAt = new Date().toISOString();

        await db.vagas.update(id, vaga);
        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao atualizar vaga' });
    }
});

router.delete('/vagas/:id', recrutamentoAuth, async (req, res) => {
    try {
        const id = String(req.params.id || '').trim();
        if (!id) return res.status(400).json({ ok: false, erro: 'ID inválido' });
        const vaga = await db.vagas.getById(id);
        if (!vaga) return res.status(404).json({ ok: false, erro: 'Vaga não encontrada' });

        await db.vagas.delete(id);
        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao excluir vaga' });
    }
});

router.post('/vagas/avaliar', recrutamentoAuth, async (req, res) => {
    try {
        const { id, status, justificativa } = req.body;
        if (!id || !status) {
            return res.status(400).json({ ok: false, erro: 'ID e Status obrigatórios' });
        }

        const vaga = await db.vagas.getById(id);
        if (!vaga) {
            return res.status(404).json({ ok: false, erro: 'Vaga não encontrada' });
        }

        vaga.status = status;
        vaga.justificativa_rh = justificativa;
        
        if (status === 'rejeitada' || status === 'reprovada') {
            vaga.ativa = false;
        } else if (status === 'aprovada') {
            vaga.ativa = true;
        }

        vaga.updatedAt = new Date().toISOString();
        
        await db.vagas.update(id, vaga);

        if (status === 'rejeitada' || status === 'reprovada') {
             await emailService.notificarGestorVaga(vaga, status, justificativa);
        }

        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao avaliar vaga' });
    }
});

router.get('/rh/vagas/:id/sugestoes', recrutamentoAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const vaga = await db.vagas.getById(id);
        if (!vaga) return res.status(404).json({ ok: false, erro: 'Vaga não encontrada' });

        const candidatos = await db.candidatos.getAll();
        const termo = (vaga.titulo || '').toLowerCase().trim();
        const setorTermo = (vaga.setor || '').toLowerCase().trim();

        // Sistema de pontuação para sugestões
        const sugestoes = candidatos.map(c => {
            let score = 0;
            const matches = [];

            // 1. Candidatura direta (Prioridade máxima)
            if (c.vaga_id === id) {
                score += 100;
                matches.push("Candidatou-se a esta vaga");
            }

            // 2. Cargo pretendido
            const cargoPretendido = (c.cargo || '').toLowerCase();
            if (cargoPretendido.includes(termo)) {
                score += 50;
                matches.push("Cargo pretendido compatível");
            }

            // 3. Experiência Recente (Cargo 1)
            const exp1 = (c.cargo1 || '').toLowerCase();
            if (exp1.includes(termo)) {
                score += 40;
                matches.push("Experiência recente compatível");
            }

            // 4. Experiência Anterior (Cargo 2)
            const exp2 = (c.cargo2 || '').toLowerCase();
            if (exp2.includes(termo)) {
                score += 20;
                matches.push("Experiência anterior compatível");
            }

            // 5. Busca no currículo (texto livre)
            const cv = (c.curriculo || '').toLowerCase();
            if (cv.includes(termo)) {
                score += 15;
                matches.push("Termo encontrado no currículo");
            }
            if (cv.includes(setorTermo)) {
                score += 10;
                matches.push("Setor encontrado no currículo");
            }

            return { ...c, score, matchReason: matches.join(", ") };
        })
        .filter(c => c.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10); // Top 10 sugestões

        res.json({ ok: true, sugestoes });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao buscar sugestões' });
    }
});

router.get('/rh/vagas/:id/pdf', recrutamentoAuth, async (req, res) => {
    try {
        const item = await db.vagas.getById(req.params.id);
        if (!item) return res.status(404).send('Registro não encontrado');
        const pdfBuffer = await pdfService.pdfBufferFromVagaData(item);
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="vaga-${item.id}.pdf"`,
            'Content-Length': pdfBuffer.length
        });
        res.send(pdfBuffer);
    } catch (e) {
        console.error(e);
        res.status(500).send('Erro ao gerar PDF');
    }
});


    router.post('/rh/vagas/importar', recrutamentoAuth, auditLog('import_excel', 'vagas'), async (req, res) => {
        try {
            const { items } = req.body || {};
            if (!Array.isArray(items) || items.length === 0) {
                return res.status(400).json({ ok: false, erro: 'Nenhum dado enviado para importação' });
            }

            const now = new Date().toISOString();
            const createdBy = req.user && (req.user.name || req.user.username) ? (req.user.name || req.user.username) : 'Importação Excel';
            
            let importados = 0;

            for (const item of items) {
                const id = crypto.randomUUID();
                
                // Mapeamento básico de campos do Excel
                const novaVaga = {
                    id,
                    titulo: String(item.titulo || item.cargo || 'Vaga Importada').trim(),
                    cargo: String(item.cargo || item.titulo || '').trim(),
                    setor: String(item.setor || item.departamento || '').trim(),
                    departamento: String(item.departamento || item.setor || '').trim(),
                    descricao: String(item.descricao || '').trim(),
                    requisitos: String(item.requisitos || '').trim(),
                    beneficios: String(item.beneficios || '').trim(),
                    salario: item.salario || null,
                    horario: String(item.horario || '').trim(),
                    quantidade: parseInt(item.quantidade) || 1,
                    local: String(item.local || '').trim(),
                    gestor_nome: String(item.gestor || item.solicitante || createdBy).trim(),
                    status: 'aprovada', // Vagas importadas entram como aprovadas/abertas por padrão
                    ativa: true,
                    createdAt: now,
                    updatedAt: now
                };

                if (novaVaga.titulo && novaVaga.setor) {
                    await db.vagas.create(novaVaga);
                    importados++;
                }
            }

            res.json({ ok: true, importados });
        } catch (e) {
            console.error('Erro na importação de vagas:', e);
            res.status(500).json({ ok: false, erro: 'Erro ao importar vagas' });
        }
    });

    // Busca externa de candidatos (LinkedIn, Indeed, etc)
    router.get('/rh/vagas/:id/busca-externa', recrutamentoAuth, async (req, res) => {
        try {
            const vaga = await db.vagas.getById(req.params.id);
            if (!vaga) return res.status(404).json({ ok: false, erro: 'Vaga não encontrada' });

            const query = `${vaga.titulo} ${vaga.setor} Curitiba`;
            
            // Aqui o sistema integraria com as APIs das plataformas.
            // Como demonstração, retornamos uma estrutura que permite a busca manual 
            // ou via integração de IA se configurada.
            const sugestoesExternas = [
                {
                    plataforma: 'LinkedIn',
                    link: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(query)}`,
                    descricao: 'Buscar profissionais no LinkedIn'
                },
                {
                    plataforma: 'Indeed',
                    link: `https://br.indeed.com/jobs?q=${encodeURIComponent(vaga.titulo)}&l=Curitiba%2C+PR`,
                    descricao: 'Ver candidatos no Indeed'
                },
                {
                    plataforma: 'Catho',
                    link: `https://www.catho.com.br/buscar/vagas/?q=${encodeURIComponent(vaga.titulo)}`,
                    descricao: 'Consultar base da Catho'
                }
            ];

            res.json({ ok: true, sugestoesExternas, query });
        } catch (e) {
            console.error('Erro na busca externa:', e);
            res.status(500).json({ ok: false, erro: 'Erro ao processar busca externa' });
        }
    });

    return router;
};
