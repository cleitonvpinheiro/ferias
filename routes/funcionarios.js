const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../services/db');
const questorService = require('../services/questorService');
const { dpAuth, verifyToken, checkRole, ROLES } = require('../middleware/auth');
const { normalizeCpf, isValidCpf } = require('../utils/validation');

const funcionariosReadAuth = [verifyToken, checkRole([ROLES.ADMIN, ROLES.DP, ROLES.TD, ROLES.RH_GERAL, ROLES.RH, ROLES.RECRUTAMENTO])];

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
        const { funcionarios, modo } = req.body || {};
        if (!Array.isArray(funcionarios)) {
            return res.status(400).json({ ok: false, erro: 'Formato inválido' });
        }

        const normalizeStr = (v) => {
            if (v === null || v === undefined) return undefined;
            const s = String(v).trim();
            return s === '' ? undefined : s;
        };

        const cleanIncomingFuncionario = (f) => {
            const nome = normalizeStr(f && f.nome);
            if (!nome) return null;

            const out = { nome };

            const cpf = normalizeCpf(f && f.cpf);
            if (cpf && cpf.length === 11 && isValidCpf(cpf)) out.cpf = cpf;

            const matricula = normalizeStr(f && f.matricula);
            if (matricula) out.matricula = matricula;

            const keys = [
                'cargo',
                'setor',
                'data_admissao',
                'nascimento',
                'sexo',
                'raca_cor',
                'nacionalidade',
                'tipo_vinculo',
                'banco',
                'agencia',
                'conta',
                'tipo_conta',
                'chave_pix'
            ];
            for (const k of keys) {
                const val = normalizeStr(f && f[k]);
                if (val !== undefined) out[k] = val;
            }

            return out;
        };

        const currentDb = await db.funcionarios.getAll();
        let novos = 0;
        let atualizados = 0;
        let cpfsInvalidos = 0;
        const keepIds = new Set();

        for (const f of funcionarios) {
            const fClean = cleanIncomingFuncionario(f);
            if (!fClean) continue;

            const rawCpf = normalizeCpf(f && f.cpf);
            if (rawCpf && (!fClean.cpf || !isValidCpf(rawCpf))) {
                cpfsInvalidos++;
            }

            let existing = null;
            
            // Tentar encontrar por CPF se existir
            if (fClean.cpf) {
                existing = currentDb.find(e => e.cpf === fClean.cpf);
            }
            
            // Se não encontrou por CPF, tentar por Matrícula (se existir)
            if (!existing && fClean.matricula) {
                existing = currentDb.find(e => e.matricula === fClean.matricula);
            }

            // Se não encontrou por CPF nem Matrícula, tentar por Nome (para evitar duplicação de quem não tem documentos)
            if (!existing && fClean.nome) {
                existing = currentDb.find(e => e.nome.toLowerCase().trim() === fClean.nome.toLowerCase().trim());
            }

            if (existing) {
                await db.funcionarios.update(existing.id, { ...existing, ...fClean });
                keepIds.add(String(existing.id));
                atualizados++;
            } else {
                const newId = crypto.randomUUID();
                await db.funcionarios.create({
                    id: newId,
                    ...fClean
                });
                keepIds.add(String(newId));
                novos++;
            }
        }

        let removidos = 0;
        if (String(modo || '').toLowerCase() === 'sync') {
            const toRemove = currentDb.filter(e => e && e.id && !keepIds.has(String(e.id)));
            for (const e of toRemove) {
                await db.funcionarios.delete(e.id);
                removidos++;
            }
        }

        res.json({ ok: true, novos, atualizados, removidos, cpfsInvalidos });
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

router.get('/gestor/equipe', [verifyToken, checkRole([ROLES.GESTOR, ROLES.SUPERVISOR, ROLES.GERENTE, ROLES.RH_GERAL, ROLES.RH, ROLES.DP])], async (req, res) => {
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

router.get('/gestor/setores', [verifyToken, checkRole([ROLES.GESTOR, ROLES.SUPERVISOR, ROLES.GERENTE, ROLES.RH_GERAL, ROLES.RH, ROLES.DP])], async (req, res) => {
    try {
        const username = req.user && req.user.username;
        if (!username) return res.status(401).json({ ok: false, erro: 'Usuário não autenticado' });
        const setores = await db.gestorSetores.getSetoresByGestor(username);
        res.json(setores);
    } catch (e) {
        console.error('Erro ao obter setores do gestor:', e);
        res.status(500).json({ ok: false, erro: 'Erro ao carregar setores' });
    }
});

// Envio de alerta por Gestor sobre colaborador
router.post('/gestor/alerta-equipe', [verifyToken, checkRole([ROLES.GESTOR, ROLES.SUPERVISOR, ROLES.GERENTE, ROLES.RH_GERAL, ROLES.RH])], async (req, res) => {
    try {
        const { funcionario_id, to, subject, body } = req.body || {};
        if (!funcionario_id) return res.status(400).json({ ok: false, erro: 'funcionario_id é obrigatório' });
        const func = await db.funcionarios.getById(funcionario_id);
        if (!func) return res.status(404).json({ ok: false, erro: 'Colaborador não encontrado' });

        const emailService = require('../services/email');
        const recipient = String(to || process.env.SMTP_TO_RH || '').trim();
        const sub = String(subject || `Alerta do colaborador ${func.nome || ''}`).trim();
        const msg = String(body || '').trim();

        if (!recipient) {
            // Sem destinatário configurado, faz mock no console
            console.log('--- EMAIL MOCK (Alerta Equipe) ---');
            console.log('To:', '(não informado)');
            console.log('Subject:', sub);
            console.log('Text:', msg);
            return res.json({ ok: true, mock: true });
        }

        const result = await emailService.enviarEmailAlertaGestor({
            to: recipient,
            subject: sub,
            text: msg
        });
        if (result.ok) return res.json({ ok: true });
        return res.status(500).json({ ok: false, erro: result.erro || 'Falha ao enviar email' });
    } catch (e) {
        console.error('Erro ao enviar alerta de equipe:', e);
        res.status(500).json({ ok: false, erro: 'Erro interno ao enviar alerta' });
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

router.get('/rh/equipe-setores/:gestor', equipeManageAuth, async (req, res) => {
    try {
        const gestor = String(req.params.gestor || '').trim();
        if (!gestor) return res.status(400).json({ ok: false, erro: 'Gestor inválido' });
        const setores = await db.gestorSetores.getSetoresByGestor(gestor);
        res.json(setores);
    } catch (e) {
        console.error('Erro ao obter setores do gestor:', e);
        res.status(500).json({ ok: false, erro: 'Erro ao obter setores' });
    }
});

router.post('/rh/equipe-setores/:gestor', equipeManageAuth, async (req, res) => {
    try {
        const gestor = String(req.params.gestor || '').trim();
        const setor = req.body && typeof req.body.setor === 'string' ? req.body.setor : '';
        const setorNorm = String(setor || '').trim();
        if (!gestor) return res.status(400).json({ ok: false, erro: 'Gestor inválido' });
        if (!setorNorm) return res.status(400).json({ ok: false, erro: 'setor é obrigatório' });
        await db.gestorSetores.addSetor(gestor, setorNorm);
        res.json({ ok: true });
    } catch (e) {
        console.error('Erro ao adicionar setor ao gestor:', e);
        res.status(500).json({ ok: false, erro: 'Erro ao adicionar setor' });
    }
});

router.delete('/rh/equipe-setores/:gestor/:setor', equipeManageAuth, async (req, res) => {
    try {
        const gestor = String(req.params.gestor || '').trim();
        const setor = String(req.params.setor || '').trim();
        if (!gestor) return res.status(400).json({ ok: false, erro: 'Gestor inválido' });
        if (!setor) return res.status(400).json({ ok: false, erro: 'Setor inválido' });
        await db.gestorSetores.removeSetor(gestor, setor);
        res.json({ ok: true });
    } catch (e) {
        console.error('Erro ao remover setor do gestor:', e);
        res.status(500).json({ ok: false, erro: 'Erro ao remover setor' });
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
