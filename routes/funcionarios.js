const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const questorService = require('../services/questorService');
const { normalizeCpf, isValidCpf } = require('../utils/validation');
const {
    hasFullRhAccess,
    isEquipeScopedRole,
    resolveEquipeForUser,
    assertCanAccessFuncionario: hierarchyAssertAccess,
} = require('../utils/hierarchy');
const upload = require('../middleware/upload');
const path = require('path');
const fs = require('fs');



let db;

module.exports = (_db, auth) => {
    db = _db;
    const { verifyToken,checkRole,ROLES,dpAuth,auditLog } = auth;
    const funcionariosReadAuth = [verifyToken, checkRole([ROLES.ADMIN, ROLES.DP, ROLES.TD, ROLES.RH_GERAL, ROLES.RH, ROLES.RECRUTAMENTO, ROLES.GESTOR, ROLES.LIDER, ROLES.SUPERVISOR, ROLES.GERENTE])];

    const norm = (v) => String(v || '').trim().toUpperCase();

async function assertCanAccessFuncionario(req, funcionarioId) {
    return hierarchyAssertAccess(db, req, funcionarioId);
}

function pctFromScores(total, max) {
    const t = Number(total);
    const m = Number(max);
    if (!Number.isFinite(t) || !Number.isFinite(m) || m <= 0) return null;
    const pct = (t / m) * 100;
    return Math.round(pct * 10) / 10;
}

// Public
router.get('/funcionarios', funcionariosReadAuth, async (req, res) => {
    const role = String(req.user && req.user.role || '').trim().toLowerCase();
    const busca = String(req.query.busca || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    if (isEquipeScopedRole(role)) {
        const username = req.user && req.user.username;
        if (!username) return res.status(401).json({ ok: false, erro: 'Usuário não autenticado' });

        const totalEquipe = await resolveEquipeForUser(db, {
            username,
            role,
            name: req.user && req.user.name,
            email: req.user && req.user.email,
        });

        if (!busca) return res.json(totalEquipe);
        const filtrado = totalEquipe.filter(f =>
            String(f.nome || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(busca)
        );
        return res.json(filtrado);
    }

    const data = await db.funcionarios.getAll({ busca });
    return res.json(data);
});

router.get('/funcionarios/:id', funcionariosReadAuth, async (req, res) => {
    try {
        const id = String(req.params.id || '').trim();
        const access = await assertCanAccessFuncionario(req, id);
        if (!access.ok) return res.status(access.status).json({ ok: false, erro: access.erro });

        const item = await db.funcionarios.getById(id);
        if (!item) return res.status(404).json({ ok: false, erro: 'Colaborador não encontrado' });
        return res.json({ ok: true, item });
    } catch (e) {
        console.error('Erro ao obter colaborador:', e);
        return res.status(500).json({ ok: false, erro: 'Erro ao carregar colaborador' });
    }
});

router.get('/funcionarios/:id/foto', funcionariosReadAuth, async (req, res) => {
    try {
        const id = String(req.params.id || '').trim();
        const access = await assertCanAccessFuncionario(req, id);
        if (!access.ok) return res.status(access.status).send(access.erro || 'Forbidden');

        const item = await db.funcionarios.getById(id);
        if (!item) return res.status(404).send('Not found');
        const foto = item && item.foto ? String(item.foto).trim() : '';
        if (!foto) return res.status(404).send('Not found');

        const safe = path.basename(foto);
        if (!safe || safe !== foto) return res.status(404).send('Not found');
        if (!/^[a-zA-Z0-9.\-_]+$/.test(safe)) return res.status(404).send('Not found');

        const filePath = path.join(__dirname, '..', 'uploads', safe);
        if (!fs.existsSync(filePath)) return res.status(404).send('Not found');
        res.setHeader('Cache-Control', 'no-store');
        return res.sendFile(filePath);
    } catch (e) {
        console.error('Erro ao servir foto do colaborador:', e);
        return res.status(500).send('Erro');
    }
});

router.get('/funcionarios/:id/perfil', funcionariosReadAuth, async (req, res) => {
    try {
        const id = String(req.params.id || '').trim();
        const access = await assertCanAccessFuncionario(req, id);
        if (!access.ok) return res.status(access.status).json({ ok: false, erro: access.erro });

        const funcionario = await db.funcionarios.getById(id);
        if (!funcionario) return res.status(404).json({ ok: false, erro: 'Colaborador não encontrado' });

        const safe = async (promise, fallback) => {
            try {
                return await promise;
            } catch (_) {
                return fallback;
            }
        };

        const [solicitacoesAll, disciplinarAll, avaliacoesAll, taxasAll, eventosAll] = await Promise.all([
            safe(db.solicitacoes.getAll(), []),
            safe(db.disciplinarRegistros.getAll(), []),
            safe(db.avaliacoes.getAll(), []),
            safe(db.taxas.getAll(), []),
            safe(db.intranet.listEvents({ from: null, limit: 50 }), [])
        ]);

        const feriasAll = (Array.isArray(solicitacoesAll) ? solicitacoesAll : [])
            .filter(s => String(s && (s.funcionarioId || s.funcionario_id) || '').trim() === id)
            .sort((a, b) => new Date(b.updatedAt || b.updated_at || b.createdAt || b.created_at || 0) - new Date(a.updatedAt || a.updated_at || a.createdAt || a.created_at || 0));

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const parseDay = (v) => {
            if (!v) return null;
            const d = new Date(v);
            return Number.isNaN(d.getTime()) ? null : d;
        };
        const futuros = feriasAll
            .map(s => ({ s, d: parseDay(s && s.inicio) }))
            .filter(x => x.d && x.d.getTime() >= today.getTime())
            .sort((a, b) => a.d.getTime() - b.d.getTime());

        const feriasPendentes = feriasAll.filter(s => {
            const st = String(s && s.status || '').trim().toLowerCase();
            return ['pendente_rh', 'pendente_gestor', 'aguardando_assinatura'].includes(st);
        }).length;

        const ferias = {
            total: feriasAll.length,
            pendentes: feriasPendentes,
            proximoInicio: futuros[0] ? (futuros[0].s && futuros[0].s.inicio) : null,
            ultima: feriasAll[0] ? {
                id: feriasAll[0].id,
                status: feriasAll[0].status,
                statusRH: feriasAll[0].statusRH || feriasAll[0].status_rh,
                inicio: feriasAll[0].inicio,
                inicio2: feriasAll[0].inicio2,
                tipoGozo: feriasAll[0].tipoGozo || feriasAll[0].tipo_gozo,
                createdAt: feriasAll[0].createdAt || feriasAll[0].created_at,
                updatedAt: feriasAll[0].updatedAt || feriasAll[0].updated_at
            } : null,
            recentes: feriasAll.slice(0, 5).map(s => ({
                id: s.id,
                status: s.status,
                inicio: s.inicio,
                inicio2: s.inicio2,
                tipoGozo: s.tipoGozo || s.tipo_gozo,
                createdAt: s.createdAt || s.created_at
            }))
        };

        const disciplinarArr = (Array.isArray(disciplinarAll) ? disciplinarAll : [])
            .filter(r => String(r && r.funcionarioId || '').trim() === id)
            .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

        const advertencias = disciplinarArr.filter(r => String(r && r.tipo || '').toLowerCase() === 'advertencia').length;
        const suspensoes = disciplinarArr.filter(r => String(r && r.tipo || '').toLowerCase() === 'suspensao').length;

        const disciplinar = {
            total: disciplinarArr.length,
            advertencias,
            suspensoes,
            recentes: disciplinarArr.slice(0, 6).map(r => ({
                id: r.id,
                tipo: r.tipo,
                dataOcorrencia: r.dataOcorrencia || null,
                motivo: r.motivo || null,
                descricao: r.descricao || null,
                diasSuspensao: r.diasSuspensao != null ? r.diasSuspensao : null,
                createdAt: r.createdAt || null
            }))
        };

        const normKey = (v) => String(v || '')
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');

        const nomeKey = normKey(funcionario && funcionario.nome);
        const setorKey = normKey(funcionario && funcionario.setor);

        const avArrAll = (Array.isArray(avaliacoesAll) ? avaliacoesAll : [])
            .filter(a => a && a.tipo && a.tipo !== 'experiencia')
            .filter(a => normKey(a.funcionario) === nomeKey || (setorKey && normKey(a.setor || a.departamento) === setorKey && normKey(a.funcionario) === nomeKey))
            .sort((a, b) => new Date(b.updatedAt || b.updated_at || b.createdAt || b.created_at || 0) - new Date(a.updatedAt || a.updated_at || a.createdAt || a.created_at || 0));

        const avWithPct = avArrAll.map(a => {
            const total = (a && a.weightedTotalScore != null) ? a.weightedTotalScore : a.totalScore;
            const max = (a && a.weightedMaxScore != null) ? a.weightedMaxScore : a.maxScore;
            return { ...a, pct: pctFromScores(total, max) };
        }).filter(a => typeof a.pct === 'number');

        const desempenho = {
            total: avArrAll.length,
            mediaPct: avWithPct.length ? Math.round((avWithPct.reduce((sum, a) => sum + a.pct, 0) / avWithPct.length) * 10) / 10 : null,
            ultimas: avWithPct.slice(0, 10).map(a => ({
                id: a.id,
                tipo: a.tipo,
                avaliador: a.avaliador,
                setor: a.setor || a.departamento || null,
                pct: a.pct,
                createdAt: a.createdAt || a.created_at,
                updatedAt: a.updatedAt || a.updated_at
            }))
        };

        const cpf = normalizeCpf(funcionario && funcionario.cpf);
        const taxasAprovadas = cpf
            ? (Array.isArray(taxasAll) ? taxasAll : [])
                .filter(t => normalizeCpf(t && t.cpf) === cpf)
                .filter(t => String(t && t.status || '').toLowerCase() === 'aprovado')
            : [];

        const beneficiosTimeline = [];
        for (const t of taxasAprovadas) {
            const when = t && (t.signedAt || t.updatedAt || t.createdAt);
            const vt = t && t.valores && t.valores.vt ? Number(t.valores.vt.total || 0) : 0;
            const taxa = t && t.valores && t.valores.taxa ? Number(t.valores.taxa.total || 0) : 0;
            if (Number.isFinite(vt) && vt > 0) {
                beneficiosTimeline.push({ tipo: 'VT', valor: vt, when: when || null, descricao: 'Vale-transporte' });
            }
            if (Number.isFinite(taxa) && taxa > 0) {
                beneficiosTimeline.push({ tipo: 'Taxa', valor: taxa, when: when || null, descricao: t && t.nome_taxa ? String(t.nome_taxa) : 'Taxa' });
            }
            if ((!vt || vt <= 0) && (!taxa || taxa <= 0)) {
                beneficiosTimeline.push({ tipo: 'Pagamento', valor: null, when: when || null, descricao: t && t.nome_taxa ? String(t.nome_taxa) : 'Pagamento' });
            }
        }
        beneficiosTimeline.sort((a, b) => new Date(b.when || 0) - new Date(a.when || 0));

        const beneficios = {
            total: beneficiosTimeline.length,
            timeline: beneficiosTimeline.slice(0, 12)
        };

        const eventos = (Array.isArray(eventosAll) ? eventosAll : [])
            .map(e => ({
                id: e.id,
                titulo: e.titulo,
                descricao: e.descricao || null,
                local: e.local || null,
                data_inicio: e.data_inicio || null,
                data_fim: e.data_fim || null
            }))
            .filter(e => {
                const d = e.data_inicio ? new Date(e.data_inicio) : null;
                if (!d || Number.isNaN(d.getTime())) return false;
                return d.getTime() >= today.getTime();
            })
            .sort((a, b) => new Date(a.data_inicio) - new Date(b.data_inicio))
            .slice(0, 6);

        return res.json({
            ok: true,
            perfil: {
                funcionario,
                ferias,
                disciplinar,
                desempenho,
                beneficios,
                eventos,
                faltas: null,
                treinamentos: [],
                jornada: null,
                contatoEmergencia: null
            }
        });
    } catch (e) {
        console.error('Erro ao carregar perfil do colaborador:', e);
        return res.status(500).json({ ok: false, erro: 'Erro ao carregar perfil' });
    }
});

// RH Protected
router.get('/rh/funcionarios', dpAuth, auditLog('view_all', 'funcionarios'), async (req, res) => {
    const normalizeNumericIdValue = (val) => {
        const s = String(val ?? '').trim();
        if (!s) return '';
        const compact = s.replace(/\s+/g, '');
        if (/^\d+$/.test(compact)) return compact;
        if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(compact)) return compact.replace(/\./g, '').split(',')[0];
        if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(compact)) return compact.replace(/,/g, '').split('.')[0];
        if (/^\d+[.,]\d+$/.test(compact)) return compact.split(compact.includes(',') ? ',' : '.')[0];
        return s;
    };

    const data = await db.funcionarios.getAll();
    const out = (Array.isArray(data) ? data : []).map(f => {
        if (!f) return f;
        const matricula = f.matricula != null ? normalizeNumericIdValue(f.matricula) : f.matricula;
        const tipo_vinculo = f.tipo_vinculo != null ? normalizeNumericIdValue(f.tipo_vinculo) : f.tipo_vinculo;
        return { ...f, matricula, tipo_vinculo };
    });
    res.json(out);
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

router.post('/rh/funcionarios/importar', dpAuth, auditLog('import_excel', 'funcionarios'), async (req, res) => {
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

        const normalizeVinculoImport = (v) => {
            if (v === null || v === undefined) return undefined;
            const s = String(v).trim();
            if (!s) return undefined;
            const low = s.toLowerCase();
            if (low === 'm' || low.startsWith('mens')) return 'Mensalista';
            if (low === 'h' || low.startsWith('hor')) return 'Horista';
            const compact = s.replace(/\s+/g, '');
            if (/^\d+$/.test(compact)) return compact;
            if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(compact)) return compact.replace(/\./g, '').split(',')[0];
            if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(compact)) return compact.replace(/,/g, '').split('.')[0];
            if (/^\d+[.,]\d+$/.test(compact)) return compact.split(compact.includes(',') ? ',' : '.')[0];
            return s;
        };

        const normalizeMaybeNumericIdValue = (v) => {
            if (v === null || v === undefined) return undefined;
            const s = String(v).trim();
            if (!s) return undefined;
            const compact = s.replace(/\s+/g, '');
            if (/^\d+$/.test(compact)) return compact;
            if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(compact)) return compact.replace(/\./g, '').split(',')[0];
            if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(compact)) return compact.replace(/,/g, '').split('.')[0];
            if (/^\d+[.,]\d+$/.test(compact)) return compact.split(compact.includes(',') ? ',' : '.')[0];
            return s;
        };

        const cleanIncomingFuncionario = (f) => {
            const nome = normalizeStr(f && f.nome);
            if (!nome) return null;

            const out = { nome };

            const cpf = normalizeCpf(f && f.cpf);
            if (cpf && cpf.length === 11 && isValidCpf(cpf)) out.cpf = cpf;

            const matricula = normalizeStr(f && f.matricula);
            if (matricula) out.matricula = matricula;

            const setorFallback = normalizeStr(f && (f.setor || f.descricao_setor));
            if (setorFallback) out.setor = setorFallback;

            const keys = [
                'cargo',
                'data_admissao',
                'nascimento',
                'sexo',
                'raca_cor',
                'nacionalidade',
                'tipo_vinculo',
                'contrato',
                'pais_origem',
                'estado_origem',
                'naturalidade',
                'anotacoes',
                'banco',
                'agencia',
                'conta',
                'tipo_conta',
                'chave_pix',
                'status'
            ];
            for (const k of keys) {
                const val = k === 'tipo_vinculo'
                    ? normalizeVinculoImport(f && f[k])
                    : (k === 'contrato' ? normalizeMaybeNumericIdValue(f && f[k]) : normalizeStr(f && f[k]));
                if (val !== undefined) out[k] = val;
            }

            return out;
        };

        const splitAnotacoes = (text) => {
            const raw = String(text || '').trim();
            if (!raw) return [];
            if (raw.includes('\n')) {
                return raw
                    .split(/\r?\n/g)
                    .map(s => String(s || '').trim())
                    .filter(Boolean);
            }
            return [raw];
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
                const anotacoesItems = splitAnotacoes(fClean.anotacoes);
                if (anotacoesItems.length > 0 && db.disciplinarRegistros && typeof db.disciplinarRegistros.createIgnore === 'function') {
                    for (const note of anotacoesItems) {
                        const hash = crypto.createHash('sha256').update(note).digest('hex').slice(0, 16);
                        const id = `import-anotacao-${existing.id}-${hash}`;
                        const nowIso = new Date().toISOString();
                        await db.disciplinarRegistros.createIgnore({
                            id,
                            funcionarioId: existing.id,
                            tipo: 'advertencia',
                            dataOcorrencia: nowIso.slice(0, 10),
                            motivo: 'Importação (Anotações)',
                            descricao: note,
                            origem: 'excel_ou_api',
                            createdAt: nowIso,
                            updatedAt: nowIso
                        });
                    }
                }
            } else {
                const newId = crypto.randomUUID();
                await db.funcionarios.create({
                    id: newId,
                    ...fClean
                });
                // Após db.funcionarios.create({...})
                try {
                    const novoFunc = await db.funcionarios.getById(newId);
                    if (novoFunc && novoFunc.data_admissao) {
                        setImmediate(async () => {
                            try {
                                const avaliacaoFactory = require('./avaliacao');
                                const avaliacaoRouter = avaliacaoFactory(db, auth);
                                if (typeof avaliacaoRouter.gerarCiclosParaFuncionario === 'function') {
                                    await avaliacaoRouter.gerarCiclosParaFuncionario(novoFunc, 6);
                                }
                            } catch (e) {
                                console.error('Erro ao gerar ciclos para novo colaborador:', e.message);
                            }
                        });
                    }
                } catch (e) {
                    console.error('Erro ao iniciar geração de ciclos:', e.message);
                }
                keepIds.add(String(newId));
                novos++;
                const anotacoesItems = splitAnotacoes(fClean.anotacoes);
                if (anotacoesItems.length > 0 && db.disciplinarRegistros && typeof db.disciplinarRegistros.createIgnore === 'function') {
                    for (const note of anotacoesItems) {
                        const hash = crypto.createHash('sha256').update(note).digest('hex').slice(0, 16);
                        const id = `import-anotacao-${newId}-${hash}`;
                        const nowIso = new Date().toISOString();
                        await db.disciplinarRegistros.createIgnore({
                            id,
                            funcionarioId: newId,
                            tipo: 'advertencia',
                            dataOcorrencia: nowIso.slice(0, 10),
                            motivo: 'Importação (Anotações)',
                            descricao: note,
                            origem: 'excel_ou_api',
                            createdAt: nowIso,
                            updatedAt: nowIso
                        });
                    }
                }
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

router.put('/rh/funcionarios/:id', dpAuth, auditLog('update', 'funcionarios'), async (req, res) => {
    try {
        const id = String(req.params.id || '').trim();
        if (!id) return res.status(400).json({ ok: false, erro: 'ID inválido' });

        const existing = await db.funcionarios.getById(id);
        if (!existing) return res.status(404).json({ ok: false, erro: 'Colaborador não encontrado' });

        const body = req.body || {};
        const nome = String(body.nome !== undefined ? body.nome : existing.nome || '').trim();
        if (!nome) return res.status(400).json({ ok: false, erro: 'Nome é obrigatório' });

        let cpf = existing.cpf;
        if (Object.prototype.hasOwnProperty.call(body, 'cpf')) {
            const raw = normalizeCpf(body.cpf);
            if (!raw) {
                // Campo vazio no formulário: mantém o CPF já cadastrado
                cpf = existing.cpf;
            } else if (raw.length === 11) {
                if (!isValidCpf(raw)) {
                    return res.status(400).json({ ok: false, erro: 'CPF inválido' });
                }
                cpf = raw;
            } else {
                return res.status(400).json({ ok: false, erro: 'CPF deve conter 11 dígitos' });
            }
        }

        const pick = (key) =>
            Object.prototype.hasOwnProperty.call(body, key) ? (body[key] || null) : existing[key];

        const updated = {
            ...existing,
            nome,
            cpf,
            matricula: pick('matricula'),
            cargo: pick('cargo'),
            setor: pick('setor'),
            tipo_vinculo: pick('tipo_vinculo'),
            status: pick('status') || 'Ativo',
            data_admissao: pick('data_admissao'),
            nascimento: pick('nascimento'),
            sexo: pick('sexo'),
            raca_cor: pick('raca_cor'),
            nacionalidade: pick('nacionalidade'),
            anotacoes: pick('anotacoes'),
        };

        await db.funcionarios.update(id, updated);

        if (Object.prototype.hasOwnProperty.call(body, 'setor')) {
            await db.sql.run(
                'UPDATE avaliacao_participantes SET avaliado_setor = ? WHERE avaliado_id = ?',
                [updated.setor || null, id]
            );
        }

        res.json({ ok: true });
    } catch (e) {
        console.error('Erro ao atualizar colaborador:', e);
        if (e && e.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ ok: false, erro: 'CPF já cadastrado para outro colaborador' });
        }
        res.status(500).json({ ok: false, erro: 'Erro ao atualizar colaborador' });
    }
});

router.post('/rh/funcionarios/:id/foto', dpAuth, upload.single('foto'), async (req, res) => {
    try {
        const id = String(req.params.id || '').trim();
        if (!id) return res.status(400).json({ ok: false, erro: 'ID inválido' });

        const func = await db.funcionarios.getById(id);
        if (!func) return res.status(404).json({ ok: false, erro: 'Colaborador não encontrado' });

        if (!req.file) return res.status(400).json({ ok: false, erro: 'Nenhuma foto enviada' });
        const mime = String(req.file.mimetype || '');
        if (!mime.startsWith('image/')) return res.status(400).json({ ok: false, erro: 'Arquivo deve ser uma imagem' });

        await db.funcionarios.updateFoto(id, req.file.filename);
        res.json({ ok: true, foto: req.file.filename });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao salvar foto' });
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

router.get('/gestor/equipe', [verifyToken, checkRole([ROLES.GESTOR, ROLES.LIDER, ROLES.SUPERVISOR, ROLES.GERENTE, ROLES.RH_GERAL, ROLES.RH, ROLES.DP])], async (req, res) => {
    try {
        const username = req.user && req.user.username;
        if (!username) return res.status(401).json({ ok: false, erro: 'Usuário não autenticado' });

        const role = String(req.user && req.user.role || '').trim().toLowerCase();
        const equipe = hasFullRhAccess(role)
            ? await db.funcionarios.getAll()
            : await resolveEquipeForUser(db, {
                username,
                role,
                name: req.user && req.user.name,
                email: req.user && req.user.email,
            });

        res.json(equipe);
    } catch (e) {
        console.error('Erro ao obter equipe do gestor:', e);
        res.status(500).json({ ok: false, erro: 'Erro ao carregar equipe' });
    }
});

router.get('/gestor/setores', [verifyToken, checkRole([ROLES.GESTOR, ROLES.LIDER, ROLES.SUPERVISOR, ROLES.GERENTE, ROLES.RH_GERAL, ROLES.RH, ROLES.DP])], async (req, res) => {
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

router.get('/rh/setores', equipeManageAuth, async (req, res) => {
    try {
        await db.setores.syncFromFuncionarios();
        const setores = await db.setores.getAll({ includeInactive: true });
        const funcionarios = await db.funcionarios.getAll();
        const counts = new Map();
        (funcionarios || []).forEach(f => {
            const s = String(f.setor || '').trim();
            if (s) counts.set(s, (counts.get(s) || 0) + 1);
        });
        const setoresComCount = setores.map(s => ({
            ...s,
            totalColaboradores: counts.get(String(s.nome || '').trim()) || 0
        }));
        res.json({ ok: true, setores: setoresComCount });
    } catch (e) {
        console.error('Erro ao listar setores:', e);
        res.status(500).json({ ok: false, erro: 'Erro ao listar setores' });
    }
});

router.post('/rh/setores', equipeManageAuth, async (req, res) => {
    try {
        const nome = String((req.body && req.body.nome) || '').trim();
        if (!nome) return res.status(400).json({ ok: false, erro: 'nome é obrigatório' });
        await db.setores.create(nome);
        res.json({ ok: true });
    } catch (e) {
        console.error('Erro ao criar setor:', e);
        res.status(500).json({ ok: false, erro: 'Erro ao criar setor' });
    }
});

router.put('/rh/setores/:nome', equipeManageAuth, async (req, res) => {
    try {
        const nome = String(req.params.nome || '').trim();
        if (!nome) return res.status(400).json({ ok: false, erro: 'Setor inválido' });

        const novoNome = String((req.body && (req.body.novo_nome ?? req.body.novoNome)) || '').trim();
        if (novoNome) {
            const result = await db.setores.rename(nome, novoNome);
            return res.json({ ok: true, ...result });
        }

        if (Object.prototype.hasOwnProperty.call((req.body || {}), 'ativo')) {
            const ativo = !!req.body.ativo;
            await db.setores.setActive(nome, ativo);
            return res.json({ ok: true });
        }

        return res.status(400).json({ ok: false, erro: 'Nada para atualizar' });
    } catch (e) {
        console.error('Erro ao atualizar setor:', e);
        res.status(500).json({ ok: false, erro: 'Erro ao atualizar setor' });
    }
});

router.get('/rh/setores/:nome/colaboradores', equipeManageAuth, async (req, res) => {
    try {
        const nome = String(req.params.nome || '').trim();
        if (!nome) return res.status(400).json({ ok: false, erro: 'Setor inválido' });

        const ids = await db.setores.listColaboradorIds(nome);
        const todos = await db.funcionarios.getAll();
        const idSet = new Set(ids);
        const colaboradores = (todos || []).filter(f => idSet.has(String(f && f.id || '').trim()));

        res.json({ ok: true, setor: nome, colaboradores, ids });
    } catch (e) {
        console.error('Erro ao listar colaboradores do setor:', e);
        res.status(500).json({ ok: false, erro: 'Erro ao listar colaboradores do setor' });
    }
});

router.put('/rh/setores/:nome/colaboradores', equipeManageAuth, async (req, res) => {
    try {
        const nome = String(req.params.nome || '').trim();
        if (!nome) return res.status(400).json({ ok: false, erro: 'Setor inválido' });

        const raw = req.body && req.body.funcionario_ids;
        if (!Array.isArray(raw)) {
            return res.status(400).json({ ok: false, erro: 'funcionario_ids deve ser um array' });
        }

        const result = await db.setores.setColaboradores(nome, raw);
        res.json({ ok: true, ...result });
    } catch (e) {
        console.error('Erro ao atualizar colaboradores do setor:', e);
        res.status(500).json({ ok: false, erro: e.message || 'Erro ao atualizar colaboradores do setor' });
    }
});

router.get('/rh/equipe/:gestor', equipeManageAuth, async (req, res) => {
    try {
        const gestor = String(req.params.gestor || '').trim();
        const source = String(req.query && req.query.source || '').trim().toLowerCase();
        const equipeDireta = await db.gestorEquipes.getEquipeByGestor(gestor);
        if (source === 'direct' || source === 'direta') {
            return res.json(equipeDireta);
        }
        const setoresDoGestor = await db.gestorSetores.getSetoresByGestor(gestor);
        const nomeSetores = setoresDoGestor.map(s => s.setor);
        let equipeSetor = [];
        if (nomeSetores.length > 0) {
            const todos = await db.funcionarios.getAll();
            equipeSetor = todos.filter(f => f.setor && nomeSetores.includes(f.setor));
        }
        const ids = new Set(equipeDireta.map(f => f.id));
        const equipe = [...equipeDireta, ...equipeSetor.filter(f => !ids.has(f.id))];
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
        const nomes = (Array.isArray(setores) ? setores : [])
            .map(s => (s && typeof s === 'object') ? s.setor : s)
            .map(s => String(s || '').trim())
            .filter(Boolean);
        res.json(nomes);
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


    return router;
};
