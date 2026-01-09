const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../services/db');
const emailService = require('../services/email');
const pdfService = require('../services/pdfService');
const { rhAuth } = require('../middleware/auth');

router.post('/taxas/draft', async (req, res) => {
    try {
        const payload = req.body;
        let id = payload.id;
        
        if (id) {
            const item = await db.taxas.getById(id);
            if (item) {
                const updated = { ...item, ...payload, updatedAt: new Date().toISOString() };
                await db.taxas.update(id, updated);
                return res.json({ ok: true, id });
            }
        }

        id = id || crypto.randomUUID();
        const novoRascunho = {
            id,
            ...payload,
            status: 'rascunho',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        await db.taxas.create(novoRascunho);
        
        res.json({ ok: true, id });
    } catch (e) {
        console.error('Erro ao salvar rascunho:', e);
        res.status(500).json({ ok: false, erro: 'Erro ao salvar rascunho' });
    }
});

router.post('/taxas', async (req, res) => {
    try {
        const payload = req.body;
        if (!payload.nome_taxa || !payload.cpf || !payload.valores) {
            return res.status(400).json({ message: 'Dados incompletos.' });
        }

        let id = payload.id;
        let item = null;
        
        if (id) {
            const existing = await db.taxas.getById(id);
            if (existing) {
                 item = {
                    ...existing,
                    ...payload,
                    status: 'pendente',
                    updatedAt: new Date().toISOString()
                };
                await db.taxas.update(id, item);
            } else {
                item = {
                    id,
                    ...payload,
                    status: 'pendente',
                    createdAt: new Date().toISOString()
                };
                await db.taxas.create(item);
            }
        } else {
             id = crypto.randomUUID();
             item = {
                id,
                ...payload,
                status: 'pendente',
                createdAt: new Date().toISOString()
            };
            await db.taxas.create(item);
        }
        
        try {
            const funcionarios = await db.funcionarios.getAll();
            const cpfLimpo = payload.cpf ? payload.cpf.replace(/\D/g, '') : '';
            
            if (cpfLimpo) {
                const existingFunc = funcionarios.find(f => f.cpf && f.cpf.replace(/\D/g, '') === cpfLimpo);
                
                const dadosFuncionario = {
                    id: existingFunc ? existingFunc.id : crypto.randomUUID(),
                    nome: payload.nome_taxa,
                    cpf: payload.cpf,
                    funcao: payload.funcao,
                    departamento: payload.departamento,
                    banco: payload.banco,
                    agencia: payload.agencia,
                    conta: payload.conta,
                    tipo_conta: payload.tipo_conta,
                    chave_pix: payload.pix,
                    updatedAt: new Date().toISOString()
                };

                if (existingFunc) {
                    await db.funcionarios.update(existingFunc.id, { ...existingFunc, ...dadosFuncionario });
                } else {
                    await db.funcionarios.create({ ...dadosFuncionario, createdAt: new Date().toISOString() });
                }
            }
        } catch (e) {
            console.error('Erro ao salvar dados do funcionario:', e);
        }

    // --- Approval Flow Logic ---
    const motivosEspeciais = ['aumento_demanda', 'vaga_aberta'];
    const precisaAprovacao = (payload.motivo || []).some(m => motivosEspeciais.includes(m));

    if (precisaAprovacao) {
        const token = crypto.randomBytes(32).toString('hex');
        // Update item with approval info
        // Fetch again or use 'item' (item is updated in memory?)
        // item was local object.
        item.status = 'aguardando_aprovacao';
        item.approvalToken = token;
        await db.taxas.update(id, item);
        
        // Send email to Gestor
        await emailService.enviarEmailAprovacaoTaxa(item, token);
        return res.json({ message: 'Solicitação enviada para aprovação do gestor!', id });
    } else {
        // Standard Flow
        await emailService.enviarEmailTaxasRH(item);
        res.json({ message: 'Solicitação enviada com sucesso!', id });
    }
    
} catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Erro interno no servidor.' });
    }
});

router.get('/rh/taxas', rhAuth, async (req, res) => {
    const data = await db.taxas.getAll();
    const filtered = data.filter(item => item.status !== 'rascunho');
    res.json(filtered);
});

router.put('/rh/taxas/:id', rhAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        const existing = await db.taxas.getById(id);
        if (!existing) return res.status(404).json({ message: 'Taxa não encontrada' });

        const updatedItem = {
            ...existing,
            ...updates,
            updatedAt: new Date().toISOString()
        };

        await db.taxas.update(id, updatedItem);
        res.json({ ok: true, message: 'Dados atualizados com sucesso!' });
    } catch (e) {
        console.error('Erro ao atualizar taxa:', e);
        res.status(500).json({ message: 'Erro ao atualizar dados.' });
    }
});

router.post('/rh/taxas/:id/aprovar', rhAuth, async (req, res) => {
    const item = await db.taxas.getById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Taxa não encontrada' });
    
    // Change status to waiting for signature
    const signatureToken = crypto.randomBytes(32).toString('hex');
    item.status = 'aguardando_assinatura';
    item.signatureToken = signatureToken;
    item.updatedAt = new Date().toISOString();
    
    await db.taxas.update(item.id, item);
    
    // Send email to collaborator (solicitante) to sign
    await emailService.enviarSolicitacaoAssinaturaTaxa(item, signatureToken);
    
    res.json({ message: 'Aprovado pelo RH. Enviado para assinatura do colaborador.' });
});

router.get('/api/taxas/dados-assinatura', async (req, res) => {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Token não fornecido' });
    
    const data = await db.taxas.getAll();
    const item = data.find(i => i.signatureToken === token && i.status === 'aguardando_assinatura');
    
    if (!item) return res.status(404).json({ error: 'Solicitação não encontrada ou já assinada.' });
    
    res.json(item);
});

router.post('/api/taxas/assinar', async (req, res) => {
    const { token, assinatura } = req.body;
    if (!token || !assinatura) return res.status(400).json({ error: 'Dados incompletos' });
    
    const data = await db.taxas.getAll();
    const item = data.find(i => i.signatureToken === token && i.status === 'aguardando_assinatura');
    
    if (!item) return res.status(404).json({ error: 'Solicitação não encontrada' });
    
    item.assinatura_taxa = assinatura;
    item.status = 'aprovado'; // Final status
    item.signedAt = new Date().toISOString();
    item.signatureToken = null; // Consume token
    
    await db.taxas.update(item.id, item);
    
    // Notify RH/Gestor? Maybe later.
    
    res.json({ ok: true, message: 'Assinado com sucesso!' });
});

router.post('/rh/taxas/:id/reprovar', rhAuth, async (req, res) => {
    const item = await db.taxas.getById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Taxa não encontrada' });
    
    item.status = 'reprovado';
    item.updatedAt = new Date().toISOString();
    await db.taxas.update(item.id, item);
    res.json({ message: 'Reprovado com sucesso' });
});

router.get('/rh/taxas/arquivo-pagamento', rhAuth, async (req, res) => {
    const data = await db.taxas.getAll();
    const aprovadas = data.filter(i => i.status === 'aprovado');
    
    if (aprovadas.length === 0) return res.status(400).send('Nenhuma taxa aprovada para pagamento.');

    let csvContent = "Nome;CPF;Banco;Agencia;Conta;Valor;FormaPagamento;ChavePix;Departamento\n";
    
    aprovadas.forEach(item => {
        const valor = item.valores?.total_geral || '0.00';
        const forma = item.forma_pagamento || '';
        const pix = item.pix || '';
        const banco = item.banco || '';
        const agencia = item.agencia || '';
        const conta = item.conta || '';
        
        csvContent += `${item.nome_taxa};${item.cpf};${banco};${agencia};${conta};${valor};${forma};${pix};${item.departamento}\n`;
    });

    res.set({
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="remessa_pagamentos_${new Date().toISOString().split('T')[0]}.csv"`
    });
    res.send(csvContent);
});

router.get('/taxas/responder-aprovacao', async (req, res) => {
    try {
        const { token, acao } = req.query;
        if (!token || !['aprovar', 'reprovar'].includes(acao)) {
            return res.status(400).send('Link inválido.');
        }

        const data = await db.taxas.getAll();
        const item = data.find(i => i.approvalToken === token && i.status === 'aguardando_aprovacao');

        if (!item) {
            return res.status(404).send('Solicitação não encontrada ou já processada.');
        }
        
        if (acao === 'aprovar') {
            item.status = 'pendente'; // Goes to RH
            item.approvalToken = null; // Consume token
            item.approvedAt = new Date().toISOString();
            
            // Notify RH now that it's approved
            await emailService.enviarEmailTaxasRH(item);
            
            // Notify Requester
            if (item.email_solicitante) {
                await emailService.enviarEmailResultadoTaxa(item, true);
            }
        } else {
            item.status = 'reprovado'; // Rejected by Gestor
            item.approvalToken = null;
            item.rejectedAt = new Date().toISOString();

            // Notify Requester
            if (item.email_solicitante) {
                await emailService.enviarEmailResultadoTaxa(item, false);
            }
        }

        await db.taxas.update(item.id, item);

        res.send(`
            <html>
                <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                    <h1 style="color: ${acao === 'aprovar' ? 'green' : 'red'}">
                        Solicitação ${acao === 'aprovar' ? 'Aprovada' : 'Reprovada'} com Sucesso!
                    </h1>
                    <p>Você pode fechar esta janela.</p>
                </body>
            </html>
        `);

    } catch (e) {
        console.error(e);
        res.status(500).send('Erro ao processar resposta.');
    }
});

router.get('/taxas/pdf/:id', async (req, res) => {
    const item = await db.taxas.getById(req.params.id);
    if (!item) return res.status(404).send('Solicitação não encontrada');

    try {
        const buffer = await pdfService.pdfBufferFromTaxaData(item);
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="taxa-${item.nome_taxa}.pdf"`
        });
        res.send(buffer);
    } catch (e) {
        console.error(e);
        res.status(500).send('Erro ao gerar PDF');
    }
});

module.exports = router;
