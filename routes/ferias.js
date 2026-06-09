const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const pdfService = require('../services/pdfService');
const emailService = require('../services/email');
const { validarPayloadFerias } = require('../utils/validation');

function sanitizeObjectForDb(obj) {
    if (typeof obj !== 'object' || obj === null) {
        return obj;
    }
    const sanitized = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const value = obj[key];
            sanitized[key] = (value === undefined) ? null : value;
        }
    }
    return sanitized;
}

module.exports = (db, auth) => {
    const { verifyToken, checkRole, ROLES, dpAuth } = auth;
    const feriasFormAuth = [verifyToken, checkRole([ROLES.DP, ROLES.RH_GERAL, ROLES.RH, ROLES.GESTOR, ROLES.LIDER])];
    const gestorFeriasAuth = [verifyToken, checkRole([ROLES.GESTOR, ROLES.LIDER])];

    router.get('/solicitacao/:id', feriasFormAuth, async (req, res) => {
        try {
            const item = await db.solicitacoes.getById(req.params.id);
            if (!item) return res.status(404).json({ ok: false, erro: 'Solicitação não encontrada' });
            res.json(item);
        } catch (e) {
            console.error(e);
            res.status(500).json({ ok: false, erro: 'Erro ao buscar solicitação' });
        }
    });

    router.get('/rh/solicitacoes', dpAuth, async (req, res) => {
        try {
            const data = await db.solicitacoes.getAll();
            const lista = data
                .filter(i => ['pendente_rh', 'pendente_gestor', 'aguardando_assinatura', 'assinado', 'concluido', 'reprovado'].includes(i.status))
                .sort((a, b) => {
                    if (a.status === 'pendente_rh' && b.status !== 'pendente_rh') return -1;
                    if (a.status !== 'pendente_rh' && b.status === 'pendente_rh') return 1;
                    return new Date(b.createdAt) - new Date(a.createdAt);
                });

            res.json(lista);
        } catch (e) {
            console.error(e);
            res.status(500).json({ ok: false, erro: 'Erro ao listar solicitações' });
        }
    });

    router.get('/gestor/solicitacoes', gestorFeriasAuth, async (req, res) => {
        try {
            const username = req.user && req.user.username;
            if (!username) return res.status(401).json({ ok: false, erro: 'Usuário não autenticado' });

            const equipe = await db.gestorEquipes.getEquipeByGestor(username);
            const equipeIds = new Set((equipe || []).map(f => String(f.id)));
            const equipeNomes = new Set((equipe || []).map(f => String(f.nome || '').trim().toLowerCase()).filter(Boolean));

            const solicitacoes = await db.solicitacoes.getAll();
            const filtradas = (solicitacoes || [])
                .filter(s => {
                    const fid = s.funcionarioId || s.funcionario_id;
                    if (fid && equipeIds.has(String(fid))) return true;
                    const nome = String(s.nome || '').trim().toLowerCase();
                    return nome && equipeNomes.has(nome);
                })
                .sort((a, b) => new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0));

            res.json({ ok: true, solicitacoes: filtradas });
        } catch (e) {
            console.error('Erro ao listar solicitacoes do gestor:', e);
            res.status(500).json({ ok: false, erro: 'Erro ao listar solicitações' });
        }
    });

    router.get('/pdf/:id', feriasFormAuth, async (req, res) => {
        try {
            const item = await db.solicitacoes.getById(req.params.id);
            if (!item) return res.status(404).send('Solicitação não encontrada');

            const buffer = await pdfService.pdfBufferFromData(item);

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=Ferias_${item.nome.replace(/\s+/g, '_')}.pdf`);
            res.send(buffer);
        } catch (e) {
            console.error(e);
            res.status(500).send('Erro ao gerar PDF');
        }
    });

    router.post('/encaminhar', feriasFormAuth, async (req, res) => {
        // 1. Sanitiza o req.body logo no início da rota
        const sanitizedBody = sanitizeObjectForDb(req.body);

        const { nome, setor, inicio, tipoGozo, id: existingId } = sanitizedBody; // Use o body sanitizado
        if (!nome || !setor || !inicio || !tipoGozo) return res.status(400).json({ ok: false, erro: 'Campos obrigatórios ausentes' });

        try {
            let id = existingId;
            let isUpdate = false;
            let item = null;

            if (id) {
                item = await db.solicitacoes.getById(id);
                if (item) {
                    const historicoItem = {
                        data: new Date().toISOString(),
                        acao: 'reenvio',
                        ator: 'Solicitante'
                    };
                    const historico = item.historico || [];
                    historico.push(historicoItem);

                    // 2. Sanitiza o objeto antes de passá-lo para db.solicitacoes.update
                    item = sanitizeObjectForDb({ // <-- AQUI
                        ...item,
                        ...sanitizedBody, // Use o body sanitizado
                        status: 'pendente_rh',
                        statusRH: null,       // Substituído undefined por null
                        sugestaoData: null,   // Substituído undefined por null
                        historico,
                        updatedAt: new Date().toISOString()
                    });
                    isUpdate = true;
                    await db.solicitacoes.update(id, item);
                } else {
                    id = crypto.randomUUID();
                }
            } else {
                id = crypto.randomUUID();
            }

            if (!isUpdate) {
                // 3. Sanitiza o objeto antes de passá-lo para db.solicitacoes.create (linha 136)
                const novaSolicitacao = sanitizeObjectForDb({ // <-- AQUI
                    id,
                    ...sanitizedBody, // Use o body sanitizado
                    status: 'pendente_rh',
                    createdAt: new Date().toISOString(),
                    historico: [{
                        data: new Date().toISOString(),
                        acao: 'pendente_rh',
                        ator: 'Solicitante'
                    }]
                });
                await db.solicitacoes.create(novaSolicitacao); // <-- LINHA 136
            }

            const result = await emailService.enviarLinkRH(sanitizedBody, req.protocol, id); // Use sanitizedBody

            const mockLink = result.link;
            if (result.ok) {
                if (result.mock) {
                    console.log('--- LINK RH GERADO ---');
                    console.log(mockLink);
                }
                return res.json({ ok: true, mensagem: isUpdate ? 'Solicitação atualizada e reencaminhada ao RH' : 'Encaminhado ao RH' });
            } else {
                return res.status(500).json({ ok: false, erro: 'Falha ao enviar email ao RH' });
            }
        } catch (e) {
            console.error(e);
            return res.status(500).json({ ok: false, erro: 'Erro interno' });
        }
    });

    router.post('/solicitacao', dpAuth, async (req, res) => {
        // 1. Sanitiza o req.body logo no início da rota
        const sanitizedBody = sanitizeObjectForDb(req.body);

        const valid = validarPayloadFerias(sanitizedBody); // Use o body sanitizado para validação
        if (!valid.ok) return res.status(400).json({ ok: false, erro: valid.erro });
        try {
            let currentStatus = 'concluido';
            let updatedItemForNotify = sanitizedBody; // Começa com o body sanitizado

            if (sanitizedBody.id) { // Use sanitizedBody.id
                let item = await db.solicitacoes.getById(sanitizedBody.id);
                if (item) {
                    let signatureToken = null;
                    if (sanitizedBody.statusRH === 'aprovado' && !sanitizedBody.assinatura) { // Use sanitizedBody
                        currentStatus = 'aguardando_assinatura';
                        signatureToken = crypto.randomBytes(32).toString('hex');
                    } else if (sanitizedBody.statusRH === 'reprovado') { // Use sanitizedBody
                        currentStatus = 'pendente_gestor';
                    } else {
                        currentStatus = 'concluido';
                    }

                    const historicoItem = {
                        data: new Date().toISOString(),
                        acao: sanitizedBody.statusRH || 'alteracao', // Use sanitizedBody
                        justificativa: sanitizedBody.justificativa, // Use sanitizedBody
                        ator: 'RH'
                    };
                    const historico = item.historico || [];
                    historico.push(historicoItem);

                    // 2. Sanitiza o objeto antes de passá-lo para db.solicitacoes.update
                    item = sanitizeObjectForDb({ // <-- AQUI
                        ...item,
                        ...sanitizedBody, // Use o body sanitizado
                        status: currentStatus,
                        historico,
                        updatedAt: new Date().toISOString()
                    });

                    if (signatureToken) {
                        item.signatureToken = signatureToken;
                    }

                    await db.solicitacoes.update(item.id, item);
                    updatedItemForNotify = item; // updatedItemForNotify agora é o item sanitizado

                    if (currentStatus === 'aguardando_assinatura') {
                        await emailService.notificarGestor({ ...item, signatureToken }, req.protocol || 'http');
                        return res.json({ ok: true, mensagem: 'Aprovação registrada. Aguardando assinatura.' });
                    }
                }
            } else {
                const id = crypto.randomUUID();
                sanitizedBody.id = id; // Adiciona id ao body sanitizado
                // 3. Sanitiza o objeto antes de passá-lo para db.solicitacoes.create
                const newItem = sanitizeObjectForDb({ id, ...sanitizedBody, status: 'finalizado_sem_id_origem', createdAt: new Date().toISOString() }); // <-- AQUI
                await db.solicitacoes.create(newItem);
            }

            /* Redundant block removed */

            const pdfBuffer = await pdfService.pdfBufferFromData(updatedItemForNotify); // Use updatedItemForNotify
            const filename = `${updatedItemForNotify.nome.replace(/\s+/g, '_')}_${Date.now()}.pdf`; // Use updatedItemForNotify
            const emailResult = await emailService.enviarEmailComPDF(pdfBuffer, filename, updatedItemForNotify); // Use updatedItemForNotify

            await emailService.notificarGestor({ ...updatedItemForNotify, status: currentStatus }, req.protocol || 'http');

            let autentiqueResult = { ok: false, msg: 'Não enviado (reprovado)' };
            if (updatedItemForNotify.statusRH === 'aprovado') { // Use updatedItemForNotify
                autentiqueResult = await emailService.enviarAutentique(pdfBuffer, filename, updatedItemForNotify.gestorEmail); // Use updatedItemForNotify
            }

            return res.json({ ok: true, mensagem: 'Solicitação processada com sucesso', email: emailResult.ok, autentique: autentiqueResult });
        } catch (e) {
            console.error(e);
            return res.status(500).json({ ok: false, erro: 'Falha ao processar solicitação' });
        }
    });

    router.get('/solicitacao/token/:token', async (req, res) => {
        const { token } = req.params;
        const data = await db.solicitacoes.getAll();
        const item = data.find(i => i.signatureToken === token && i.status === 'aguardando_assinatura');

        if (!item) return res.status(404).json({ error: 'Solicitação não encontrada ou já assinada.' });

        res.json(item);
    });

    router.post('/solicitacao/assinar', async (req, res) => {
        const { token, assinatura } = req.body;
        if (!token || !assinatura) return res.status(400).json({ ok: false, erro: 'Dados incompletos' });

        try {
            const data = await db.solicitacoes.getAll();
            const item = data.find(i => i.signatureToken === token && i.status === 'aguardando_assinatura');

            if (!item) return res.status(404).json({ ok: false, erro: 'Solicitação não encontrada' });

            // Update item
            item.assinatura = assinatura;
            item.status = 'assinado';
            const signed_at = new Date().toISOString().replace('T', ' ').replace('Z', '');
            item.signatureToken = null; // Consume token

            const historicoItem = {
                data: new Date().toISOString(),
                acao: 'assinatura_colaborador',
                ator: 'Colaborador'
            };
            item.historico = item.historico || [];
            item.historico.push(historicoItem);

            await db.solicitacoes.update(item.id, item);

            // Generate Final PDF with Signature
            const pdfBuffer = await pdfService.pdfBufferFromData(item);
            const filename = `${item.nome.replace(/\s+/g, '_')}_Assinado.pdf`;

            // Send email with PDF to RH and Manager (and Collaborator if email known - assume Gestor will forward for now or use previous email if available)
            // Note: We don't have explicit collaborator email field in form, relying on gestor/rh.

            // Send to RH
            await emailService.enviarEmailComPDF(pdfBuffer, filename, item);

            // Notify Gestor Final
            await emailService.notificarGestor({ ...item, status: 'assinado' }, req.protocol || 'http');

            res.json({ ok: true, mensagem: 'Assinado com sucesso!' });
        } catch (e) {
            console.error('Erro ao assinar solicitação:', e);
            res.status(500).json({ ok: false, erro: 'Erro interno ao processar assinatura.' });
        }
    });

    router.post('/solicitacao/rh-aprovar', dpAuth, async (req, res) => {
        // 1. Sanitiza o req.body logo no início da rota
        const sanitizedBody = sanitizeObjectForDb(req.body);

        const { id, statusRH, sugestaoData, justificativa } = sanitizedBody; // Use o body sanitizado

        if (!id || !statusRH) {
            return res.status(400).json({ ok: false, erro: 'Dados incompletos' });
        }

        try {
            let item = await db.solicitacoes.getById(id);

            if (!item) {
                return res.status(404).json({ ok: false, erro: 'Solicitação não encontrada' });
            }

            let currentStatus = item.status;
            let signatureToken = null;

            if (statusRH === 'aprovado') {
                currentStatus = 'aguardando_assinatura';
                signatureToken = crypto.randomBytes(32).toString('hex');
            } else if (statusRH === 'reprovado') {
                currentStatus = 'pendente_gestor';
            }

            const historicoItem = {
                data: new Date().toISOString(),
                acao: statusRH,
                justificativa: justificativa, // Use a justificativa sanitizada
                ator: 'RH'
            };

            const historico = item.historico || [];
            historico.push(historicoItem);

            // 2. Sanitiza o objeto antes de passá-lo para db.solicitacoes.update
            item = sanitizeObjectForDb({ // <-- AQUI
                ...item,
                status: currentStatus,
                statusRH,
                sugestaoData: statusRH === 'reprovado' ? (sugestaoData || null) : null, // Garante null
                justificativa: justificativa || null, // Garante null
                historico,
                updatedAt: new Date().toISOString()
            });

            if (signatureToken) {
                item.signatureToken = signatureToken;
            }

            await db.solicitacoes.update(id, item);

            // Notifications
            if (currentStatus === 'aguardando_assinatura') {
                await emailService.notificarGestor({ ...item, signatureToken }, req.protocol || 'http');
            } else if (currentStatus === 'pendente_gestor') {
                await emailService.notificarGestor({ ...item }, req.protocol || 'http');
            }

            return res.json({ ok: true, mensagem: 'Avaliação processada com sucesso' });

        } catch (e) {
            console.error('Erro ao processar aprovação RH:', e);
            return res.status(500).json({ ok: false, erro: 'Erro interno' });
        }
    });

    router.post('/solicitacao/definir-status', dpAuth, async (req, res) => {
        // 1. Sanitiza o req.body logo no início da rota
        const sanitizedBody = sanitizeObjectForDb(req.body);

        const { id, status } = sanitizedBody; // Use o body sanitizado

        if (!id || !['concluido', 'assinado'].includes(status)) {
            return res.status(400).json({ ok: false, erro: 'Dados inválidos' });
        }

        try {
            const item = await db.solicitacoes.getById(id);
            if (!item) return res.status(404).json({ ok: false, erro: 'Solicitação não encontrada' });

            const historicoItem = {
                data: new Date().toISOString(),
                acao: `alteracao_status_${status}`,
                ator: 'RH'
            };
            const historico = item.historico || [];
            historico.push(historicoItem);

            // 2. Sanitiza o objeto antes de passá-lo para db.solicitacoes.update
            const updatedItem = sanitizeObjectForDb({ // <-- AQUI
                ...item,
                status,
                historico,
                updatedAt: new Date().toISOString()
            });

            await db.solicitacoes.update(id, updatedItem);
            res.json({ ok: true, mensagem: `Status atualizado para ${status}` });
        } catch (e) {
            console.error('Erro ao atualizar status:', e);
            res.status(500).json({ ok: false, erro: 'Erro interno' });
        }
    });

    return router;
};
