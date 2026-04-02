const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const db = require('../services/db');
const emailService = require('../services/email');
const pdfService = require('../services/pdfService');
const upload = require('../middleware/upload');
const { recrutamentoAuth } = require('../middleware/auth');
const { normalizeCpf, isValidCpf } = require('../utils/validation');

router.post('/candidaturas', upload.single('curriculo'), async (req, res) => {
    try {
        const payload = req.body;
        // Validação básica
        if (!payload.nome || !payload.email || !payload.telefone) {
            return res.status(400).json({ ok: false, erro: 'Campos obrigatórios ausentes' });
        }

        const cpfDigits = normalizeCpf(payload.cpf);
        if (cpfDigits) {
            if (!isValidCpf(cpfDigits)) {
                return res.status(400).json({ ok: false, erro: 'CPF inválido' });
            }
            payload.cpf = cpfDigits;
        }

        const id = crypto.randomUUID();
        
        const novoCandidato = {
            id,
            ...payload,
            curriculo: req.file ? req.file.filename : null,
            status: 'recebido',
            createdAt: new Date().toISOString(),
            historico: [{
                data: new Date().toISOString(),
                acao: 'recebido',
                detalhe: 'Candidatura enviada pelo site'
            }]
        };
        
        await db.candidatos.create(novoCandidato);

        await emailService.notificarRHCandidatura(novoCandidato);

        res.json({ ok: true, id });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao processar candidatura' });
    }
});

router.get('/rh/candidatos', recrutamentoAuth, async (req, res) => {
    try {
        const data = await db.candidatos.getAll();
        // Ordenar por data decrescente
        const sorted = data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        res.json(sorted);
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao listar candidatos' });
    }
});

router.get('/rh/candidatos/:id', recrutamentoAuth, async (req, res) => {
    try {
        const candidato = await db.candidatos.getById(req.params.id);
        if (!candidato) return res.status(404).json({ ok: false, erro: 'Candidato não encontrado' });
        res.json(candidato);
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao buscar candidato' });
    }
});

router.delete('/rh/candidatos/:id', recrutamentoAuth, async (req, res) => {
    try {
        const candidato = await db.candidatos.getById(req.params.id);
        if (!candidato) return res.status(404).json({ ok: false, erro: 'Candidato não encontrado' });

        const fileName = candidato.curriculo ? String(candidato.curriculo) : '';
        if (fileName) {
            const filePath = path.join(__dirname, '..', 'uploads', fileName);
            try {
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            } catch (e) {
                console.error('Falha ao remover currículo:', e.message || e);
            }
        }

        await db.candidatos.delete(req.params.id);
        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao excluir candidato' });
    }
});

async function atualizarStatusCandidato(req, res) {
    try {
        const { status, observacao, proximaIntegracao } = req.body;
        const candidato = await db.candidatos.getById(req.params.id);
        
        if (!candidato) return res.status(404).json({ ok: false, erro: 'Candidato não encontrado' });

        if (status) candidato.status = status;
        if (observacao) candidato.observacao = observacao;
        if (proximaIntegracao !== undefined) candidato.proximaIntegracao = proximaIntegracao;
        
        if (!candidato.historico) candidato.historico = [];
        candidato.historico.push({
            data: new Date().toISOString(),
            acao: 'alteracao_status',
            detalhe: status ? `Status alterado para ${status}` : 'Dados atualizados',
            observacao: observacao || (proximaIntegracao !== undefined ? `Próxima integração: ${proximaIntegracao || '-'}` : undefined)
        });
        
        await db.candidatos.update(candidato.id, candidato);
        
        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao atualizar status' });
    }
}

router.post('/rh/candidatos/:id/status', recrutamentoAuth, atualizarStatusCandidato);
router.put('/rh/candidatos/:id/status', recrutamentoAuth, atualizarStatusCandidato);

router.post('/rh/candidatos/:id/agendar', recrutamentoAuth, async (req, res) => {
    try {
        const { data: dataEntrevista, local, entrevistador } = req.body;
        const candidato = await db.candidatos.getById(req.params.id);
        
        if (!candidato) return res.status(404).json({ ok: false, erro: 'Candidato não encontrado' });

        candidato.status = 'entrevista_agendada';
        candidato.data_entrevista = dataEntrevista;
        candidato.local_entrevista = local;
        candidato.entrevistador = entrevistador;
        
        if (!candidato.historico) candidato.historico = [];
        candidato.historico.push({
            data: new Date().toISOString(),
            acao: 'agendamento_entrevista',
            detalhe: `Entrevista agendada para ${dataEntrevista}`
        });
        
        await db.candidatos.update(candidato.id, candidato);
        
        await emailService.enviarConviteEntrevista(candidato, dataEntrevista, local);

        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao agendar entrevista' });
    }
});

router.get('/rh/candidatos/arquivo-banco', recrutamentoAuth, async (req, res) => {
    try {
        const candidatos = await db.candidatos.getAll();
        // Exemplo simples de CSV
        let csv = "Nome;Email;Telefone;Vaga;Status;Data\n";
        candidatos.forEach(c => {
            csv += `${c.nome};${c.email};${c.telefone};${c.vaga_interesse || ''};${c.status};${c.createdAt}\n`;
        });
        
        res.set({
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="candidatos_${new Date().toISOString().split('T')[0]}.csv"`
        });
        res.send(csv);
    } catch (e) {
        console.error(e);
        res.status(500).send('Erro ao gerar arquivo');
    }
});

router.get('/candidatos/pdf/:id', recrutamentoAuth, async (req, res) => {
    try {
        const item = await db.candidatos.getById(req.params.id);
        if (!item) return res.status(404).send('Candidato não encontrado');
        
        const buffer = await pdfService.pdfBufferFromCandidato(item);
        
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="candidato-${item.nome}.pdf"`
        });
        res.send(buffer);
    } catch (e) {
        console.error(e);
        res.status(500).send('Erro ao gerar PDF');
    }
});

module.exports = router;
