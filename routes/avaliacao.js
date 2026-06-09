const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const pdfService = require('../services/pdfService');
const {
    norm,
    isEquipeScopedRole,
    hasFullRhAccess,
    resolveEquipeForUser,
    buildEquipeScope,
    pertenceAoEscopo,
} = require('../utils/hierarchy');

// ─── Middleware de autenticação ───────────────────────────────────────────────

// ─── Helpers gerais ───────────────────────────────────────────────────────────

/** Normaliza string: trim + lower + sem acento */
let db; // preenchido pela factory (db, auth) => { db = _db; ... }

module.exports = (_db, auth) => {
    db = _db;
    const { verifyToken, checkRole, ROLES } = auth;
    const avaliacoesAuth = [verifyToken, checkRole([ROLES.DP, ROLES.TD, ROLES.RH_GERAL, ROLES.RH, ROLES.GESTOR, ROLES.LIDER, ROLES.SUPERVISOR, ROLES.GERENTE])];
    const ciclosManageAuth = [verifyToken, checkRole([ROLES.DP, ROLES.TD, ROLES.RH_GERAL, ROLES.RH])];

    /** Retorna nomes e setores da equipe de um gestor/supervisor */
    async function getEquipeScope(req) {
        const username = req.user && req.user.username;
        const role = req.user && req.user.role;
        const dbUser = username ? await db.users.getByUsername(username) : null;

        return buildEquipeScope(db, {
            username,
            role,
            name: (dbUser && dbUser.name) || (req.user && req.user.name),
            email: (dbUser && dbUser.email) || (req.user && req.user.email),
        });
    }

    /** Verifica se um item pertence ao escopo de equipe do gestor */
    function avaliacaoPertenceAEscala(item, scope, roleNorm) {
        return pertenceAoEscopo(item, scope, roleNorm);
    }

    async function canAccessParticipanteByScope(req, participante) {
        if (!participante) return false;

        const username = String(req.user && req.user.username || '').trim().toLowerCase();
        const role = norm(req.user && req.user.role);
        const avaliadorUsername = String(participante.avaliador_username || '').trim().toLowerCase();

        if (avaliadorUsername && avaliadorUsername === username) return true;
        if (!isEquipeScopedRole(role)) return false;
        if (norm(participante.relacao) !== 'gestor') return false;

        const scope = await getEquipeScope(req);
        return avaliacaoPertenceAEscala({
            avaliadoId: participante.avaliado_id,
            funcionario: participante.avaliado_nome,
            setor: participante.avaliado_setor,
            cargo: participante.avaliado_cargo,
        }, scope, role);
    }
    /** Infere o tipo de avaliação a partir do cargo/setor do funcionário */
    function inferTipoAvaliacaoFromFuncionario({ cargo, setor }) {
        // usa "norm" que já existe no backend, não "normalizeFuncionarioKey"
        const hay = `${norm(cargo)} ${norm(setor)}`.trim();
        if (/(gerent|supervis|coorden|lider|encarreg)/.test(hay)) return 'lideranca';
        if (/(^|\s)cozinha(\s|$)|\bbar\b/.test(hay)) return 'operacional';
        if (/(eventos h|eventos e espaco kids|recepcao|recepcion|salao|equipe[\s-]*(1|2|3)\b|atendimento|atendente|call.?center|sac|helpdesk|teleatendimento|balcao|caixa|balconista)/.test(hay)) return 'atendimento';
        if (/(adm|administr|\brh\b|\bdp\b|financ|contab|compras|\bti\b|fiscal|jurid|almox|aprendiz|eventos|comercial|qualidade|\bpcp\b|processos|controlador|controladoria)/.test(hay)) return 'adm';

        return 'operacional';
    }

    async function syncCicloTipoIfNeeded(ciclo, funcionario) {
        if (!ciclo || !funcionario) return ciclo;
        const titulo = String(ciclo.titulo || '').trim();
        if (/^Experiência (45|90) dias/i.test(titulo)) return ciclo;

        const esperado = inferTipoAvaliacaoFromFuncionario({ cargo: funcionario.cargo, setor: funcionario.setor });
        const atual = norm(ciclo.tipo_formulario || ciclo.tipoFormulario || '');
        if (!esperado || esperado === atual) return ciclo;

        const atualizado = { ...ciclo, tipo_formulario: esperado };
        await db.avaliacaoCiclos.update(ciclo.id, atualizado);
        ciclo.tipo_formulario = esperado;
        return ciclo;
    }

    /** Busca funcionário pelo nome normalizado */
    async function findFuncionarioByNome(nome) {
        const key = norm(nome);
        if (!key) return null;
        const all = await db.funcionarios.getAll();
        const list = Array.isArray(all) ? all : [];
        return list.find(f => norm(f && f.nome) === key) || null;
    }

    /** Verifica compatibilidade de tipo de avaliação */
    function tipoCompatComEsperado(tipo, esperado) {
        const t = norm(tipo);
        const e = norm(esperado);
        if (!e) return true;
        if (e === 'atendimento') return t === 'operacional' || t === 'atendimento';
        return t === e;
    }

    /** Parse seguro de JSON (retorna fallback em caso de erro) */
    function parseJsonMaybe(v, fallback = null) {
        if (v == null) return fallback;
        if (typeof v === 'object') return v;
        const s = String(v || '').trim();
        if (!s) return fallback;
        try { return JSON.parse(s); }
        catch (_) { return fallback; }
    }

    /** Verifica se uma resposta é discursiva */
    function isDiscursiveAnswer(ans) {
        if (!ans) return false;
        if (ans.isDiscursive) return true;
        return /discurs/.test(norm(ans.category || ans.categoria));
    }

    /** Calcula scores ponderados por categoria */
    function computeWeightedScoresFromAnswers({ answers, pesosCategoria = {}, maxScoreItem = 7.7 } = {}) {
        const list = Array.isArray(answers) ? answers : [];
        const weights = pesosCategoria && typeof pesosCategoria === 'object' ? pesosCategoria : {};
        const normMap = new Map(
            Object.entries(weights).map(([k, w]) => [norm(k), Number.isFinite(Number(w)) ? Number(w) : 1])
        );
        let total = 0, max = 0;
        for (const ans of list) {
            if (isDiscursiveAnswer(ans)) continue;
            const score = Number(ans && ans.score);
            if (!Number.isFinite(score)) continue;
            const cat = norm(ans && (ans.category || ans.categoria));
            const weight = normMap.has(cat) ? normMap.get(cat) : 1;
            const mx = Number.isFinite(Number(ans && ans.maxScore)) ? Number(ans.maxScore) : Number(maxScoreItem);
            total += score * weight;
            max += mx * weight;
        }
        return { weightedTotalScore: total, weightedMaxScore: max, weightedPct: max > 0 ? total / max : null };
    }

    /** Monta mapa de pesos por categoria */
    function buildWeightsMap(pesosCategoria) {
        const weights = pesosCategoria && typeof pesosCategoria === 'object' ? pesosCategoria : {};
        return new Map(
            Object.entries(weights).map(([k, w]) => [norm(k), Number.isFinite(Number(w)) ? Number(w) : 1])
        );
    }

    /** Calcula totais de uma avaliação aplicando pesos */
    function computeTotalsFromEvaluation({ avaliacao, participantePeso = 1, pesosCategoria = {}, maxScoreItem = 7.7 } = {}) {
        const av = avaliacao || null;
        const partW = Number.isFinite(Number(participantePeso)) ? Number(participantePeso) : 1;
        if (!av || partW <= 0) return { ok: false, total: 0, max: 0, byCategoria: {} };

        const answers = Array.isArray(av.answers) ? av.answers : [];
        const weightsMap = buildWeightsMap(pesosCategoria);
        const byCategoria = {};
        let total = 0, max = 0;

        if (answers.length > 0) {
            let any = false;
            for (const ans of answers) {
                if (isDiscursiveAnswer(ans)) continue;
                const score = Number(ans && ans.score);
                if (!Number.isFinite(score)) continue;
                any = true;
                const catKey = norm(ans && (ans.category || ans.categoria)) || 'sem_categoria';
                const catW = weightsMap.has(catKey) ? weightsMap.get(catKey) : 1;
                const mx = Number.isFinite(Number(ans && ans.maxScore)) ? Number(ans.maxScore) : Number(maxScoreItem);
                const w = partW * catW;
                total += score * w;
                max += mx * w;
                if (!byCategoria[catKey]) byCategoria[catKey] = { total: 0, max: 0 };
                byCategoria[catKey].total += score * w;
                byCategoria[catKey].max += mx * w;
            }
            return { ok: any, total, max, byCategoria };
        }

        const wt = Number(av.weightedTotalScore), wm = Number(av.weightedMaxScore);
        if (Number.isFinite(wt) && Number.isFinite(wm) && wm > 0)
            return { ok: true, total: wt * partW, max: wm * partW, byCategoria: {} };

        const t = Number(av.totalScore), m = Number(av.maxScore);
        if (Number.isFinite(t) && Number.isFinite(m) && m > 0)
            return { ok: true, total: t * partW, max: m * partW, byCategoria: {} };

        return { ok: false, total: 0, max: 0, byCategoria: {} };
    }

    /** Computa resultado consolidado de um ciclo */
    function computeConsolidado({ ciclo, participantes = [], avaliacoesById = new Map() } = {}) {
        const pesosRelacao = parseJsonMaybe(ciclo && ciclo.pesos_relacao, {}) || {};
        const pesosCategoria = parseJsonMaybe(ciclo && ciclo.pesos_categoria, {}) || {};
        const maxScoreItem = Number.isFinite(Number(ciclo && ciclo.max_score_item)) ? Number(ciclo.max_score_item) : 7.7;

        const relacaoPeso = (rel) => {
            const k = norm(rel);
            const raw = pesosRelacao && Object.prototype.hasOwnProperty.call(pesosRelacao, k) ? pesosRelacao[k] : 1;
            return Number.isFinite(Number(raw)) ? Number(raw) : 1;
        };

        const byAvaliados = new Map();
        for (const p of (Array.isArray(participantes) ? participantes : [])) {
            const avaliadoId = String(p && p.avaliado_id || '').trim();
            if (!avaliadoId) continue;

            if (!byAvaliados.has(avaliadoId)) {
                byAvaliados.set(avaliadoId, {
                    avaliadoId,
                    avaliadoNome: p.avaliado_nome || null,
                    avaliadoSetor: p.avaliado_setor || null,
                    avaliadoCargo: p.avaliado_cargo || null,
                    totalSolicitadas: 0,
                    concluidas: 0,
                    total: 0,
                    max: 0,
                    byRelacao: {},
                    byCategoria: {}
                });
            }

            const item = byAvaliados.get(avaliadoId);
            item.totalSolicitadas += 1;

            const peso = Number.isFinite(Number(p.peso)) ? Number(p.peso) : 1;
            const pesoFinal = peso * relacaoPeso(p.relacao);
            const relKey = norm(p.relacao) || 'gestor';

            if (!item.byRelacao[relKey]) item.byRelacao[relKey] = { total: 0, max: 0, count: 0 };

            const av = p.avaliacao_id ? avaliacoesById.get(p.avaliacao_id) : null;
            const totals = computeTotalsFromEvaluation({ avaliacao: av, participantePeso: pesoFinal, pesosCategoria, maxScoreItem });
            if (!totals.ok) continue;

            item.concluidas += 1;
            item.total += totals.total;
            item.max += totals.max;

            item.byRelacao[relKey].total += totals.total;
            item.byRelacao[relKey].max += totals.max;
            item.byRelacao[relKey].count += 1;

            Object.entries(totals.byCategoria || {}).forEach(([cat, v]) => {
                if (!item.byCategoria[cat]) item.byCategoria[cat] = { total: 0, max: 0 };
                item.byCategoria[cat].total += v.total;
                item.byCategoria[cat].max += v.max;
            });
        }

        return Array.from(byAvaliados.values()).map(r => {
            const mediaPct = r.max > 0 ? r.total / r.max : null;
            const byRelacao = Object.entries(r.byRelacao).map(([k, v]) => ({
                relacao: k, pct: v.max > 0 ? v.total / v.max : null, count: v.count
            })).sort((a, b) => (b.pct || 0) - (a.pct || 0));
            const byCategoria = Object.entries(r.byCategoria).map(([k, v]) => ({
                categoria: k, pct: v.max > 0 ? v.total / v.max : null
            })).sort((a, b) => (b.pct || 0) - (a.pct || 0));

            return {
                avaliadoId: r.avaliadoId,
                avaliadoNome: r.avaliadoNome,
                avaliadoSetor: r.avaliadoSetor,
                avaliadoCargo: r.avaliadoCargo,
                totalSolicitadas: r.totalSolicitadas,
                concluidas: r.concluidas,
                mediaPct,
                byRelacao,
                byCategoria
            };
        }).sort((a, b) => (b.mediaPct || 0) - (a.mediaPct || 0));
    }

    /** Resolve a URL do formulário pelo tipo de avaliação */
    function tipoToFormUrl(tipo) {
        const t = norm(tipo);
        if (t === 'experiencia') return { base: '/form-avaliacao-experiencia.html' };
        if (t === 'lideranca') return { base: '/avaliacao-lideranca.html' };
        if (t === 'adm') return { base: '/avaliacao-adm.html' };
        if (t === 'atendimento') return { base: '/avaliacao-atendimento.html' };
        return { base: '/avaliacao-operacional.html' };
    }

    // ─── Helpers de data ──────────────────────────────────────────────────────────

    /** Parse de datas no formato YYYY-MM-DD ou DD/MM/YYYY como horário local */
    function parseBrDate(s) {
        if (!s) return null;
        const str = String(s).trim();
        const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (isoMatch)
            return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
        const brMatch = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
        if (brMatch)
            return new Date(Number(brMatch[3]), Number(brMatch[2]) - 1, Number(brMatch[1]));
        return null;
    }

    const toYMD = (date) => {
        const d = new Date(date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const normDataInicioCiclo = (val) => {
        if (!val) return '';
        if (val instanceof Date) return toYMD(val);
        return String(val).trim().split(/[ T]/)[0];
    };

    /** Reutiliza ciclo existente (evita duplicar mesmo título + data de início). */
    async function findExistingCicloId(titulo, dataInicioYmd) {
        const tituloNorm = String(titulo || '').trim();
        const dataNorm = normDataInicioCiclo(dataInicioYmd);
        if (!tituloNorm || !dataNorm) return null;

        const row = await db.sql.get(
            `SELECT id FROM avaliacao_ciclos
             WHERE titulo = ? AND DATE(data_inicio) = ?
             ORDER BY created_at ASC
             LIMIT 1`,
            [tituloNorm, dataNorm]
        );
        return row && row.id ? row.id : null;
    }

    const pendenciaPeriodoKey = (avaliadoId, tituloCiclo) =>
        `${String(avaliadoId || '').trim().toLowerCase()}_${norm(String(tituloCiclo || ''))}`;

    const addDays = (date, days) => {
        const d = new Date(date);
        d.setDate(d.getDate() + days);
        return d;
    };

    const addMonths = (date, months) => {
        const d = new Date(date);
        d.setMonth(d.getMonth() + months);
        return d;
    };

    // ─── Cache de throttle (evita sync a cada request) ───────────────────────────
    const _syncCache = new Map();

    function _syncThrottle(key, ttlMs = 5 * 60 * 1000) { // Reduzido para 5 minutos padrão
        const last = _syncCache.get(key);
        if (last && Date.now() - last < ttlMs) return false;
        _syncCache.set(key, Date.now());
        return true;
    }

    // ─── Helpers de ciclo ─────────────────────────────────────────────────────────

    async function getGestorUsername(funcionarioId) {
        const rows = await db.sql.all(
            `SELECT gestor_username FROM gestor_equipes WHERE funcionario_id = ? LIMIT 1`,
            [funcionarioId]
        );
        return rows && rows.length > 0 ? rows[0].gestor_username : null;
    }

    async function getCiclosExistentesFuncionario(funcionarioId) {
        const rows = await db.sql.all(
            `SELECT DISTINCT c.id, c.titulo, c.data_inicio
             FROM avaliacao_participantes p
             JOIN avaliacao_ciclos c ON c.id = p.ciclo_id
             WHERE p.avaliado_id = ?`,
            [funcionarioId]
        );
        return rows.map(r => ({
            id: r.id,
            titulo: r.titulo,
            dataInicio: r.data_inicio instanceof Date ? toYMD(r.data_inicio) : String(r.data_inicio).split(/[ T]/)[0]
        }));
    }

    async function criarCicloParaFuncionario({ titulo, tipo, modelo, dataInicio, dataFim, funcionario, gestorUsername }) {
        const now = new Date().toISOString();
        const cicloId = crypto.randomUUID();

        await db.avaliacaoCiclos.create({
            id: cicloId,
            titulo,
            descricao: null,
            modelo,
            tipo_formulario: tipo,
            pesos_categoria: null,
            pesos_relacao: null,
            max_score_item: 7.7,
            data_inicio: dataInicio,
            data_fim: dataFim,
            status: 'ativo',
            criado_por: 'sistema',
            created_at: now
        });

        // Gestor avalia o colaborador
        if (gestorUsername) {
            await db.avaliacaoParticipantes.create({
                id: crypto.randomUUID(),
                ciclo_id: cicloId,
                avaliado_id: funcionario.id,
                avaliado_nome: funcionario.nome,
                avaliado_setor: funcionario.setor || null,
                avaliado_cargo: funcionario.cargo || null,
                avaliador_username: gestorUsername,
                avaliador_nome: gestorUsername,
                avaliador_role: 'gestor',
                relacao: 'gestor',
                peso: 1,
                status: 'pendente',
                created_at: now
            });
        }

        // Autoavaliação para modelo 180
        if (modelo === '180') {
            const usernameAuto = funcionario.matricula || funcionario.cpf || funcionario.id;
            await db.avaliacaoParticipantes.create({
                id: crypto.randomUUID(),
                ciclo_id: cicloId,
                avaliado_id: funcionario.id,
                avaliado_nome: funcionario.nome,
                avaliado_setor: funcionario.setor || null,
                avaliado_cargo: funcionario.cargo || null,
                avaliador_username: usernameAuto,
                avaliador_nome: funcionario.nome,
                avaliador_role: 'colaborador',
                relacao: 'auto',
                peso: 1,
                status: 'pendente',
                created_at: now
            });
        }

        return cicloId;
    }

    async function gerarCiclosParaFuncionario(funcionario, quantidadeSemestres = 6, forceManagerUsername = null) {
        if (!funcionario || !funcionario.data_admissao) return { criados: 0, pulados: 0 };

        const admissao = parseBrDate(funcionario.data_admissao);
        if (!admissao) return { criados: 0, pulados: 0 };

        const tipo = inferTipoAvaliacaoFromFuncionario({ cargo: funcionario.cargo, setor: funcionario.setor });
        let gestor = forceManagerUsername || await getGestorUsername(funcionario.id);

        if (!gestor && funcionario.setor) {
            const fSetorNorm = norm(funcionario.setor);
            const allGS = await db.sql.all(`SELECT setor, gestor_username FROM gestor_setores`);
            const match = allGS.find(gs => norm(gs.setor) === fSetorNorm);
            if (match) gestor = match.gestor_username;
        }

        const gUsername = gestor ? String(gestor).trim().toLowerCase() : null;
        let criados = 0, pulados = 0;

        const baseCiclos = [
            {
                titulo: `Experiência 45 dias — ${funcionario.nome}`,
                tipo: 'experiencia',
                modelo: '90',
                dataInicio: toYMD(admissao),
                dataFim: toYMD(addDays(admissao, 45))
            },
            {
                titulo: `Experiência 90 dias — ${funcionario.nome}`,
                tipo: 'experiencia',
                modelo: '90',
                dataInicio: toYMD(addDays(admissao, 46)),
                dataFim: toYMD(addDays(admissao, 90))
            },
            {
                titulo: `1º Desempenho — ${funcionario.nome}`,
                tipo,
                modelo: '180',
                dataInicio: toYMD(addDays(admissao, 91)),
                dataFim: toYMD(addDays(admissao, 180))
            }
        ];

        // Gera apenas o ciclo semestral atual
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        const mesesDeEmpresa = Math.floor((hoje - admissao) / (30.44 * 86400000));
        if (mesesDeEmpresa >= 6) {
            let semBase = new Date(admissao);
            while (addMonths(semBase, 6) <= hoje) {
                semBase = addMonths(semBase, 6);
            }
            const dataInicioSem = semBase;
            const dataFimSem = addMonths(semBase, 6);
            const ano = dataInicioSem.getFullYear();
            const semestre = dataInicioSem.getMonth() < 6 ? '1º' : '2º';

            baseCiclos.push({
                titulo: `Desempenho ${semestre} Sem. ${ano} — ${funcionario.nome}`,
                tipo,
                modelo: '180',
                dataInicio: toYMD(dataInicioSem),
                dataFim: toYMD(dataFimSem)
            });
        }

        for (const ciclo of baseCiclos) {
            try {
                let cicloId = await findExistingCicloId(ciclo.titulo, ciclo.dataInicio);

                if (cicloId) {
                    pulados++;
                } else {
                    cicloId = await criarCicloSemParticipantes({ ...ciclo, criadoPor: 'sistema' });
                    criados++;
                }

                if (!cicloId) continue;

                if (gUsername) {
                    const hasGestor = await db.sql.get(
                        'SELECT id FROM avaliacao_participantes WHERE ciclo_id = ? AND avaliado_id = ? AND LOWER(avaliador_username) = LOWER(?) AND relacao = "gestor"',
                        [cicloId, funcionario.id, gUsername]
                    );
                    if (!hasGestor) {
                        await db.avaliacaoParticipantes.create({
                            id: crypto.randomUUID(),
                            ciclo_id: cicloId,
                            avaliado_id: funcionario.id,
                            avaliado_nome: funcionario.nome,
                            avaliado_setor: funcionario.setor,
                            avaliado_cargo: funcionario.cargo,
                            avaliador_username: gUsername,
                            avaliador_nome: null,
                            avaliador_role: 'gestor',
                            relacao: 'gestor',
                            peso: 1,
                            status: 'pendente'
                        });
                    }
                }

                const usernameAuto = String(funcionario.matricula || funcionario.cpf || funcionario.id).trim().toLowerCase();
                const hasAuto = await db.sql.get(
                    'SELECT id FROM avaliacao_participantes WHERE ciclo_id = ? AND avaliado_id = ? AND LOWER(avaliador_username) = LOWER(?) AND relacao = "auto"',
                    [cicloId, funcionario.id, usernameAuto]
                );
                if (!hasAuto) {
                    await db.avaliacaoParticipantes.create({
                        id: crypto.randomUUID(),
                        ciclo_id: cicloId,
                        avaliado_id: funcionario.id,
                        avaliado_nome: funcionario.nome,
                        avaliado_setor: funcionario.setor,
                        avaliado_cargo: funcionario.cargo,
                        avaliador_username: usernameAuto,
                        avaliador_nome: funcionario.nome,
                        avaliador_role: 'colaborador',
                        relacao: 'auto',
                        peso: 1,
                        status: 'pendente'
                    });
                }
            } catch (e) {
                console.error(`Erro ao processar ciclo "${ciclo.titulo}" para ${funcionario.nome}:`, e.message);
            }
        }

        return { criados, pulados };
    }

    /** Cria apenas o cabeçalho do ciclo, sem participantes */
    async function criarCicloSemParticipantes({ titulo, tipo, modelo, dataInicio, dataFim, criadoPor }) {
        const id = crypto.randomUUID();
        await db.avaliacaoCiclos.create({
            id,
            titulo,
            descricao: null,
            modelo,
            tipo_formulario: tipo,
            pesos_categoria: null,
            pesos_relacao: null,
            max_score_item: 7.7,
            data_inicio: dataInicio,
            data_fim: dataFim,
            status: 'ativo',
            criado_por: criadoPor || 'sistema',
            created_at: new Date().toISOString()
        });
        return id;
    }

    async function syncAnniversaryParticipants(managerUsername, userRole) {
        try {
            const cacheKey = `sync_${managerUsername}`;
            if (!_syncThrottle(cacheKey)) return;

            const roleNorm = norm(userRole);
            const isRH = hasFullRhAccess(roleNorm);
            let equipe = [];

            if (isRH) {
                const todos = await db.funcionarios.getAll();
                equipe = (Array.isArray(todos) ? todos : []).filter(f => f && f.ativo !== 0 && f.data_admissao);
            } else {
                const currentUser = await db.users.getByUsername(managerUsername);
                const resolved = await resolveEquipeForUser(db, {
                    username: managerUsername,
                    role: userRole,
                    name: currentUser && currentUser.name,
                    email: currentUser && currentUser.email,
                });
                equipe = resolved.filter(f => f && f.data_admissao);
            }

            if (!equipe.length) return;

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            for (const f of equipe) {
                try {
                    // Throttle por funcionário para evitar processamento excessivo
                    // Admin/RH tem throttle reduzido para 1 minuto, outros 1 hora
                    const empThrottle = isRH ? 60000 : 60 * 60 * 1000;
                    const empCacheKey = `sync_emp_${f.id}`;
                    if (!_syncThrottle(empCacheKey, empThrottle)) continue;

                    const admissao = parseBrDate(f.data_admissao);
                    if (!admissao) continue;
                    // Sincroniza ciclos (experiência + semestrais)
                    // Se não for RH, passa o managerUsername atual como preferência de gestor
                    await gerarCiclosParaFuncionario(f, 6, isRH ? null : managerUsername);
                } catch (e) {
                    console.error(`Erro ao sincronizar ciclos de ${f.nome}:`, e.message);
                }
            }
        } catch (e) {
            console.error('Erro ao sincronizar marcos de avaliação:', e);
        }
    }

    // ─── Helpers internos do endpoint de pendências ───────────────────────────────

    /** Retorna meia-noite local de uma data */
    function startOfDay(d) {
        const x = new Date(d);
        x.setHours(0, 0, 0, 0);
        return x;
    }

    /** Diferença em dias inteiros entre duas datas */
    function diffDays(a, b) {
        return Math.floor((startOfDay(a).getTime() - startOfDay(b).getTime()) / 86400000);
    }

    /**
     * Verifica se um ciclo gerado pelo sistema é semestral de desempenho.
     * Critério: criado_por === 'sistema' E título contém "Desempenho N".
     */
    function isCicloSemestralSistema(ciclo) {
        return (
            String(ciclo.criado_por || '').trim() === 'sistema' &&
            ciclo.titulo &&
            /Desempenho \d/.test(ciclo.titulo)
        );
    }

    /**
     * Verifica se um ciclo gerado pelo sistema é de experiência.
     * Critério: criado_por === 'sistema' E título contém "Experiência" ou "1º Desempenho".
     */
    function isCicloExperienciaSistema(ciclo) {
        return (
            String(ciclo.criado_por || '').trim() === 'sistema' &&
            ciclo.titulo &&
            /(Experiência|1º Desempenho)/.test(ciclo.titulo)
        );
    }

    /**
     * Constrói o objeto de retorno de uma pendência (link + metadados).
     * Retorna null se o ciclo estiver fora da janela temporal ou do mês de aniversário.
     *
     * Regras:
     *  - Ciclos semestrais do sistema → só aparecem no mês em que o funcionário
     *    faz aniversário de empresa (admDate.getMonth() === today.getMonth()).
     *  - Ciclos de experiência do sistema → respeitam apenas data_inicio/data_fim.
     *  - Ciclos manuais (criado_por !== 'sistema') → respeitam apenas data_inicio/data_fim.
     */
    function buildPendenciaItem({ p, ciclo, admDate, today, hojeMs, req }) {
        const dataInicioCiclo = ciclo.data_inicio
            ? (() => { const d = new Date(ciclo.data_inicio); d.setHours(0, 0, 0, 0); return d; })()
            : null;
        const dataFimCiclo = ciclo.data_fim
            ? (() => { const d = new Date(ciclo.data_fim); d.setHours(23, 59, 59, 999); return d; })()
            : null;

        // ✅ Bloqueia ciclos que ainda não começaram
        if (dataInicioCiclo && hojeMs < dataInicioCiclo.getTime()) return null;

        // ✅ Bloqueia ciclos encerrados (sem folga extra de 1 dia)
        if (dataFimCiclo && hojeMs > dataFimCiclo.getTime()) return null;

        // ✅ Ciclos semestrais do sistema só aparecem no mês de aniversário de empresa
        if (isCicloSemestralSistema(ciclo) && admDate) {
            const mesAniversario = admDate.getMonth();
            const mesHoje = today.getMonth();
            if (mesAniversario !== mesHoje) return null;
        }

        // ── Monta link do formulário ──────────────────────────────────────────────
        const tipo = ciclo.tipo_formulario || '';
        const form = tipoToFormUrl(tipo);
        const params = new URLSearchParams();

        if (p.avaliado_nome) params.set('funcionario', String(p.avaliado_nome));
        const avaliadorNome = String(req.user && (req.user.name || req.user.username) || '').trim();
        if (avaliadorNome) params.set('avaliador', avaliadorNome);
        if (p.avaliado_cargo) params.set('funcao', String(p.avaliado_cargo));
        if (p.avaliado_setor) params.set('setor', String(p.avaliado_setor));
        params.set('from', 'dashboard-avaliacao');
        params.set('cicloId', String(p.ciclo_id));
        params.set('participanteId', String(p.id));
        if (form.extra && form.extra.modelo) params.set('modelo', String(form.extra.modelo));

        const cicloDataFim = ciclo.data_fim ? String(ciclo.data_fim) : null;
        let diasParaFim = null;
        if (cicloDataFim) {
            const d = new Date(cicloDataFim);
            if (!Number.isNaN(d.getTime())) diasParaFim = diffDays(d, today);
        }

        return {
            id: p.id,
            cicloId: p.ciclo_id,
            cicloTitulo: ciclo.titulo || null,
            cicloModelo: ciclo.modelo || null,
            cicloDataInicio: ciclo.data_inicio ? String(ciclo.data_inicio) : null,
            cicloDataFim: ciclo.data_fim ? String(ciclo.data_fim) : null,
            diasParaFim,
            tipoFormulario: tipo || null,
            avaliadoId: p.avaliado_id,
            avaliadoNome: p.avaliado_nome,
            avaliadoSetor: p.avaliado_setor,
            avaliadoCargo: p.avaliado_cargo,
            relacao: p.relacao,
            peso: p.peso,
            status: p.status,
            link: `${form.base}?${params.toString()}`
        };
    }

    // ─── Rotas ────────────────────────────────────────────────────────────────────

    // GET /avaliacao/prazo
    router.get('/avaliacao/prazo', verifyToken, async (req, res) => {
        try {
            const tipo = norm(req.query && req.query.tipo);
            if (!tipo) return res.status(400).json({ ok: false, erro: 'tipo é obrigatório' });
            const row = await db.avaliacaoPrazos.getByTipo(tipo);
            res.json({
                ok: true,
                tipo,
                data_inicio: row ? (row.data_inicio || null) : null,
                data_fim: row ? (row.data_fim || null) : null
            });
        } catch (e) {
            console.error(e);
            res.status(500).json({ ok: false, erro: 'Erro ao buscar prazo' });
        }
    });

    // PUT /avaliacao/prazo
    router.put('/avaliacao/prazo', verifyToken, async (req, res) => {
        try {
            const role = norm(req.user && req.user.role);
            if (!['rh', 'rh_geral'].includes(role))
                return res.status(403).json({ ok: false, erro: 'Apenas RH pode alterar o prazo' });

            const tipo = norm(req.body && req.body.tipo);
            if (!tipo) return res.status(400).json({ ok: false, erro: 'tipo é obrigatório' });

            const parseDate = (s) => {
                const str = String(s || '').trim();
                return /^\d{4}-\d{2}-\d{2}$/.test(str) ? str : null;
            };
            const rawInicio = String(req.body && (req.body.data_inicio ?? '')).trim();
            const rawFim = String(req.body && (req.body.data_fim ?? '')).trim();
            const data_inicio = parseDate(rawInicio);
            const data_fim = parseDate(rawFim);

            if ((rawInicio && !data_inicio) || (rawFim && !data_fim))
                return res.status(400).json({ ok: false, erro: 'Formato de data inválido. Use YYYY-MM-DD.' });

            const out = await db.avaliacaoPrazos.upsert({ tipo, data_inicio, data_fim });
            res.json({ ok: true, ...out });
        } catch (e) {
            console.error(e);
            res.status(500).json({ ok: false, erro: 'Erro ao salvar prazo' });
        }
    });

    // GET /avaliacao/pendencias
    // ─── CORREÇÃO PRINCIPAL ───────────────────────────────────────────────────────
    // Ciclos semestrais gerados pelo sistema (criado_por='sistema', título "Desempenho N")
    // só aparecem no mês em que o funcionário faz aniversário de empresa.
    // Ciclos de experiência e ciclos manuais respeitam apenas data_inicio/data_fim.
    router.get('/avaliacao/pendencias', avaliacoesAuth, async (req, res) => {
        try {
            const username = String(req.user && req.user.username || '').trim().toLowerCase();
            const role = norm(req.user && req.user.role);
            if (!username) return res.status(400).json({ ok: false, erro: 'Usuário inválido' });

            const isRH = ['admin', 'rh', 'rh_geral', 'dp', 'td'].includes(role);

            // 1. Sincroniza pendências baseadas no aniversário antes de listar
            // Throttle de 10 segundos para Admin/RH e 1 minuto para outros
            const throttleMs = isRH ? 10000 : 60000;
            const cacheKey = `sync_route_${username}`;
            if (_syncThrottle(cacheKey, throttleMs)) {
                // Se for RH, não bloqueia a resposta esperando sincronizar todos (pode demorar)
                if (isRH) {
                    syncAnniversaryParticipants(username, role).catch(e => console.error('Background sync error:', e));
                } else {
                    await syncAnniversaryParticipants(username, role);
                }
            }

            const today = startOfDay(new Date());
            const hojeMs = today.getTime();

            // 2. Busca pendências conforme role
            const pendenciasRaw = (isRH || isEquipeScopedRole(role))
                ? await db.avaliacaoParticipantes.getAllPendentes()
                : await db.avaliacaoParticipantes.listPendentesByAvaliador(username);

            // 3. Carrega ciclos e funcionários em lote
            const cicloIds = Array.from(new Set((pendenciasRaw || []).map(p => p && p.ciclo_id).filter(Boolean)));
            const funcionarioIds = Array.from(new Set((pendenciasRaw || []).map(p => p && p.avaliado_id).filter(Boolean)));

            const [ciclosArr, funcArr] = await Promise.all([
                cicloIds.length > 0 ? db.sql.all(`SELECT * FROM avaliacao_ciclos WHERE id IN (${cicloIds.map(() => '?').join(',')})`, cicloIds) : [],
                funcionarioIds.length > 0 ? db.sql.all(`SELECT * FROM funcionarios WHERE id IN (${funcionarioIds.map(() => '?').join(',')})`, funcionarioIds) : []
            ]);

            const ciclosById = new Map(ciclosArr.filter(Boolean).map(c => [c.id, c]));
            const funcById = new Map(funcArr.filter(Boolean).map(f => [f.id, f]));

            const contexto = norm(req.query && req.query.contexto || '');

            // 4. Constrói itens; prioriza gestor sobre auto; deduplica por ciclo e por período (título)
            const seenParticipante = new Set();
            const seenPeriodo = new Set();
            const out = [];

            const pendenciasOrdenadas = [...(pendenciasRaw || [])].sort((a, b) => {
                const ra = norm(a && a.relacao) === 'gestor' ? 0 : 1;
                const rb = norm(b && b.relacao) === 'gestor' ? 0 : 1;
                return ra - rb;
            });

            for (const p of pendenciasOrdenadas) {
                if (!p) continue;

                const ciclo = ciclosById.get(p.ciclo_id);
                if (!ciclo || norm(ciclo.status) !== 'ativo') continue;

                const participanteKey = `${p.ciclo_id}_${p.avaliado_id}`.toLowerCase();
                if (seenParticipante.has(participanteKey)) continue;

                const titulo = ciclo.titulo || '';
                const periodoKey = pendenciaPeriodoKey(p.avaliado_id, titulo);
                if (seenPeriodo.has(periodoKey)) continue;

                const isExp = /^Experiência (45|90) dias/i.test(titulo);

                if (contexto === 'experiencia' && !isExp) continue;
                if (contexto === 'desempenho' && isExp) continue;

                if (!String(p.id || '').trim()) continue;

                let func = funcById.get(p.avaliado_id);
                if (!func && p.avaliado_nome) {
                    const nomeKey = norm(p.avaliado_nome);
                    func = funcArr.find(f => norm(f && f.nome) === nomeKey) || null;
                }

                const admDate = func && func.data_admissao ? parseBrDate(func.data_admissao) : null;
                if (!admDate) {
                    console.warn('PENDENCIA SEM admDate:', {
                        avaliadoId: p.avaliado_id,
                        avaliadoNome: p.avaliado_nome,
                        cicloTitulo: ciclo.titulo
                    });
                    continue;
                }

                await syncCicloTipoIfNeeded(ciclo, func);
                const item = buildPendenciaItem({ p, ciclo, admDate, today, hojeMs, req });
                if (item) {
                    seenParticipante.add(participanteKey);
                    seenPeriodo.add(periodoKey);
                    out.push(item);
                }
            }

            // 5. Filtra por escopo de equipe para gestores
            if (isEquipeScopedRole(req.user && req.user.role)) {
                const scope = await getEquipeScope(req);
                return res.json(
                    out.filter(p => avaliacaoPertenceAEscala({
                        avaliadoId: p.avaliadoId,
                        funcionario: p.avaliadoNome,
                        setor: p.avaliadoSetor,
                        cargo: p.avaliadoCargo,
                    }, scope, role))
                );
            }

            

            res.json(out);
        } catch (e) {
            console.error(e);
            res.status(500).json({ ok: false, erro: 'Erro ao carregar pendências' });
        }
    });

    // POST /avaliacao/participantes/:id/start
    router.post('/avaliacao/participantes/:id/start', avaliacoesAuth, async (req, res) => {
        try {
            const id = String(req.params.id || '').trim();
            if (!id) return res.status(400).json({ ok: false, erro: 'ID inválido' });

            const part = await db.avaliacaoParticipantes.getById(id);
            if (!part) return res.status(404).json({ ok: false, erro: 'Não encontrado' });

            if (!(await canAccessParticipanteByScope(req, part)))
                return res.status(403).json({ ok: false, erro: 'Acesso proibido' });

            const ciclo = part && part.ciclo_id ? await db.avaliacaoCiclos.getById(part.ciclo_id) : null;
            if (ciclo && norm(ciclo.status) !== 'ativo')
                return res.status(400).json({ ok: false, erro: 'Ciclo encerrado' });

            await db.avaliacaoParticipantes.markStarted({ id });
            res.json({ ok: true });
        } catch (e) {
            console.error(e);
            res.status(500).json({ ok: false, erro: 'Erro ao iniciar pendência' });
        }
    });

    // GET /avaliacao/ciclos
    router.get('/avaliacao/ciclos', avaliacoesAuth, async (req, res) => {
        try {
            const role = norm(req.user && req.user.role);
            const username = String(req.user && req.user.username || '').trim().toLowerCase();
            const isManageRole = [norm(ROLES.ADMIN), norm(ROLES.RH), norm(ROLES.RH_GERAL), norm(ROLES.DP), norm(ROLES.TD)].includes(role);

            // Sincroniza se for Admin/RH para garantir que os ciclos apareçam após limpeza ou novos colaboradores
            if (isManageRole) {
                const cacheKey = `sync_ciclos_${username}`;
                if (_syncThrottle(cacheKey, 30000)) { // 30 segundos
                    syncAnniversaryParticipants(username, role).catch(e => console.error('Background sync cycles:', e));
                }
            }

            const ciclos = isManageRole
                ? await db.avaliacaoCiclos.getAll()
                : await db.avaliacaoCiclos.listByAvaliador(username);
            res.json({ ok: true, ciclos });
        } catch (e) {
            console.error(e);
            res.status(500).json({ ok: false, erro: 'Erro ao listar ciclos' });
        }
    });

    // POST /avaliacao/ciclos
    router.post('/avaliacao/ciclos', ciclosManageAuth, async (req, res) => {
        try {
            const payload = req.body || {};
            const titulo = String(payload.titulo || '').trim();
            const tipo_formulario = norm(payload.tipo_formulario || payload.tipoFormulario || '');

            if (!titulo) return res.status(400).json({ ok: false, erro: 'Título obrigatório' });
            if (!tipo_formulario) return res.status(400).json({ ok: false, erro: 'Tipo de formulário obrigatório' });

            const pesos_categoria = parseJsonMaybe(payload.pesos_categoria || payload.pesosCategoria, {});
            const pesos_relacao = parseJsonMaybe(payload.pesos_relacao || payload.pesosRelacao, {});
            const max_score_item = Number.isFinite(Number(payload.max_score_item || payload.maxScoreItem))
                ? Number(payload.max_score_item || payload.maxScoreItem)
                : 7.7;

            const ciclo = {
                id: crypto.randomUUID(),
                titulo,
                descricao: payload.descricao || null,
                modelo: String(payload.modelo || '180').trim(),
                tipo_formulario,
                pesos_categoria: pesos_categoria ? JSON.stringify(pesos_categoria) : null,
                pesos_relacao: pesos_relacao ? JSON.stringify(pesos_relacao) : null,
                max_score_item,
                data_inicio: payload.data_inicio || payload.dataInicio || null,
                data_fim: payload.data_fim || payload.dataFim || null,
                status: payload.status || 'ativo',
                criado_por: String(req.user && req.user.username || '').trim().toLowerCase(),
                created_at: new Date().toISOString()
            };

            await db.avaliacaoCiclos.create(ciclo);
            res.json({ ok: true, ciclo });
        } catch (e) {
            console.error(e);
            res.status(500).json({ ok: false, erro: 'Erro ao criar ciclo' });
        }
    });

    // POST /avaliacao/ciclos/:id/participantes
    router.post('/avaliacao/ciclos/:id/participantes', ciclosManageAuth, async (req, res) => {
        try {
            const cicloId = String(req.params.id || '').trim();
            const ciclo = await db.avaliacaoCiclos.getById(cicloId);
            if (!ciclo) return res.status(404).json({ ok: false, erro: 'Ciclo não encontrado' });
            if (norm(ciclo.status) !== 'ativo') return res.status(400).json({ ok: false, erro: 'Ciclo encerrado' });

            const payload = req.body || {};
            const avaliadoId = String(payload.avaliadoId || payload.funcionarioId || payload.avaliado_id || '').trim();
            const avaliadorUsername = String(payload.avaliadorUsername || payload.avaliador_username || '').trim().toLowerCase();
            const relacao = norm(payload.relacao || 'gestor');
            const peso = Number.isFinite(Number(payload.peso)) ? Number(payload.peso) : 1;

            if (!avaliadoId) return res.status(400).json({ ok: false, erro: 'Colaborador obrigatório' });
            if (!avaliadorUsername) return res.status(400).json({ ok: false, erro: 'Avaliador (username) obrigatório' });

            const funcionario = await db.funcionarios.getById(avaliadoId);
            if (!funcionario) return res.status(404).json({ ok: false, erro: 'Colaborador não encontrado' });

            const tipoCiclo = norm(ciclo.tipo_formulario || ciclo.tipoFormulario || '');
            if (tipoCiclo) {
                const esperado = inferTipoAvaliacaoFromFuncionario({ cargo: funcionario.cargo, setor: funcionario.setor });
                if (!tipoCompatComEsperado(tipoCiclo, esperado))
                    return res.status(400).json({
                        ok: false,
                        erro: `Colaborador incompatível com o ciclo. Esperado: ${esperado}. Ciclo: ${tipoCiclo}.`
                    });
            }

            const user = await db.users.getByUsername(avaliadorUsername);
            const avaliadorRole = user && user.role ? String(user.role).trim().toLowerCase() : null;

            if (avaliadorRole && isEquipeScopedRole(avaliadorRole)) {
                const equipe = await db.gestorEquipes.getEquipeByGestor(avaliadorUsername);
                const nomes = new Set((equipe || []).map(f => norm(f && f.nome)).filter(Boolean));
                const setores = new Set((equipe || []).map(f => norm(f && f.setor)).filter(Boolean));
                const allowed = nomes.has(norm(funcionario.nome)) || setores.has(norm(funcionario.setor));
                if (!allowed)
                    return res.status(400).json({ ok: false, erro: 'Avaliador não tem permissão para este colaborador' });
            }

            const participante = {
                id: crypto.randomUUID(),
                ciclo_id: cicloId,
                avaliado_id: avaliadoId,
                avaliado_nome: funcionario.nome || null,
                avaliado_setor: funcionario.setor || null,
                avaliado_cargo: funcionario.cargo || null,
                avaliador_username: avaliadorUsername,
                avaliador_nome: user && user.name ? user.name : null,
                avaliador_role: avaliadorRole,
                relacao: relacao || 'gestor',
                peso,
                status: 'pendente',
                created_at: new Date().toISOString()
            };

            await db.avaliacaoParticipantes.create(participante);
            res.json({ ok: true, participante });
        } catch (e) {
            const msg = String(e && e.message || '');
            if (msg.includes('SQLITE_CONSTRAINT'))
                return res.status(400).json({ ok: false, erro: 'Participante já cadastrado neste ciclo' });
            console.error(e);
            res.status(500).json({ ok: false, erro: 'Erro ao adicionar participante' });
        }
    });

    // GET /avaliacao/ciclos/:id/consolidado
    router.get('/avaliacao/ciclos/:id/consolidado', avaliacoesAuth, async (req, res) => {
        try {
            const cicloId = String(req.params.id || '').trim();
            const ciclo = await db.avaliacaoCiclos.getById(cicloId);
            if (!ciclo) return res.status(404).json({ ok: false, erro: 'Ciclo não encontrado' });

            if (norm(ciclo.status) !== 'ativo') {
                const stored = await db.avaliacaoConsolidado.getByCiclo(cicloId);
                if (Array.isArray(stored) && stored.length > 0) {
                    const items = stored.map(r => r && r.dados ? r.dados : null).filter(Boolean);
                    if (isEquipeScopedRole(req.user && req.user.role)) {
                        const scope = await getEquipeScope(req);
                        return res.json({
                            ok: true, ciclo,
                            consolidado: items.filter(x => avaliacaoPertenceAEscala({ avaliadoId: x.avaliadoId, funcionario: x.avaliadoNome, setor: x.avaliadoSetor, cargo: x.avaliadoCargo }, scope, norm(req.user && req.user.role)))
                        });
                    }
                    return res.json({ ok: true, ciclo, consolidado: items });
                }
            }

            let parts = await db.avaliacaoParticipantes.listByCiclo(cicloId);
            if (isEquipeScopedRole(req.user && req.user.role)) {
                const scope = await getEquipeScope(req);
                parts = (parts || []).filter(p => avaliacaoPertenceAEscala({ avaliadoId: p.avaliado_id, funcionario: p.avaliado_nome, setor: p.avaliado_setor, cargo: p.avaliado_cargo }, scope, norm(req.user && req.user.role)));
            }

            const avaliacaoIds = Array.from(new Set((parts || []).map(p => p && p.avaliacao_id).filter(Boolean)));
            const avArr = await Promise.all(avaliacaoIds.map(id => db.avaliacoes.getById(id)));
            const byId = new Map(avArr.filter(Boolean).map(a => [a.id, a]));
            const consolidado = computeConsolidado({ ciclo, participantes: parts, avaliacoesById: byId });

            res.json({ ok: true, ciclo, consolidado });
        } catch (e) {
            console.error(e);
            res.status(500).json({ ok: false, erro: 'Erro ao gerar consolidado' });
        }
    });

    // GET /avaliacao/ciclos/:id/avaliados/:avaliadoId/relatorio
    router.get('/avaliacao/ciclos/:id/avaliados/:avaliadoId/relatorio', avaliacoesAuth, async (req, res) => {
        try {
            const cicloId = String(req.params.id || '').trim();
            const avaliadoId = String(req.params.avaliadoId || '').trim();
            if (!cicloId || !avaliadoId) return res.status(400).json({ ok: false, erro: 'Parâmetros inválidos' });

            const ciclo = await db.avaliacaoCiclos.getById(cicloId);
            if (!ciclo) return res.status(404).json({ ok: false, erro: 'Ciclo não encontrado' });

            const funcionario = await db.funcionarios.getById(avaliadoId);
            if (isEquipeScopedRole(req.user && req.user.role)) {
                const scope = await getEquipeScope(req);
                if (!avaliacaoPertenceAEscala(
                    { funcionario: funcionario && funcionario.nome, setor: funcionario && funcionario.setor, cargo: funcionario && funcionario.cargo },
                    scope,
                    norm(req.user && req.user.role)
                )) {
                    return res.status(403).json({ ok: false, erro: 'Acesso proibido para este colaborador' });
                }
            }

            let parts = await db.avaliacaoParticipantes.listByCiclo(cicloId);
            parts = (Array.isArray(parts) ? parts : []).filter(p => String(p && p.avaliado_id || '').trim() === avaliadoId);

            const avaliacaoIds = Array.from(new Set(parts.map(p => p && p.avaliacao_id).filter(Boolean)));
            const avArr = await Promise.all(avaliacaoIds.map(id => db.avaliacoes.getById(id)));
            const byId = new Map(avArr.filter(Boolean).map(a => [a.id, a]));

            const consolidadoArr = computeConsolidado({ ciclo, participantes: parts, avaliacoesById: byId });
            const consolidado = Array.isArray(consolidadoArr) && consolidadoArr.length > 0 ? consolidadoArr[0] : null;

            const pesosCategoria = parseJsonMaybe(ciclo.pesos_categoria, {}) || {};
            const maxScoreItem = Number.isFinite(Number(ciclo.max_score_item)) ? Number(ciclo.max_score_item) : 7.7;
            const pesosRelacao = parseJsonMaybe(ciclo.pesos_relacao, {}) || {};
            const relacaoPeso = (rel) => {
                const k = norm(rel);
                const raw = pesosRelacao && Object.prototype.hasOwnProperty.call(pesosRelacao, k) ? pesosRelacao[k] : 1;
                return Number.isFinite(Number(raw)) ? Number(raw) : 1;
            };

            const avaliacoes = parts.map(p => {
                const av = p.avaliacao_id ? byId.get(p.avaliacao_id) : null;
                const peso = Number.isFinite(Number(p.peso)) ? Number(p.peso) : 1;
                const pesoFinal = peso * relacaoPeso(p.relacao);

                let pctCategoria = null, totalCategoria = null, maxCategoria = null;
                if (av && Array.isArray(av.answers) && av.answers.length > 0) {
                    const calc = computeWeightedScoresFromAnswers({ answers: av.answers, pesosCategoria, maxScoreItem });
                    if (Number.isFinite(Number(calc.weightedTotalScore)) && Number.isFinite(Number(calc.weightedMaxScore)) && Number(calc.weightedMaxScore) > 0) {
                        totalCategoria = calc.weightedTotalScore;
                        maxCategoria = calc.weightedMaxScore;
                        pctCategoria = calc.weightedPct;
                    }
                }
                if (pctCategoria == null && av) {
                    const t = Number(av.weightedTotalScore ?? av.totalScore);
                    const m = Number(av.weightedMaxScore ?? av.maxScore);
                    if (Number.isFinite(t) && Number.isFinite(m) && m > 0) {
                        totalCategoria = t; maxCategoria = m; pctCategoria = t / m;
                    }
                }

                return {
                    participanteId: p.id,
                    relacao: p.relacao,
                    peso,
                    pesoFinal,
                    status: p.status,
                    avaliadorUsername: p.avaliador_username,
                    avaliadorNome: p.avaliador_nome,
                    avaliacaoId: p.avaliacao_id || null,
                    pctCategoria,
                    totalCategoria,
                    maxCategoria,
                    createdAt: p.created_at,
                    completedAt: p.completed_at
                };
            }).sort((a, b) => String(a.relacao || '').localeCompare(String(b.relacao || '')));

            res.json({
                ok: true,
                ciclo: {
                    ...ciclo,
                    pesos_categoria: parseJsonMaybe(ciclo.pesos_categoria, {}) || {},
                    pesos_relacao: parseJsonMaybe(ciclo.pesos_relacao, {}) || {},
                    max_score_item: maxScoreItem
                },
                avaliado: {
                    id: avaliadoId,
                    nome: funcionario ? funcionario.nome : (parts[0] && parts[0].avaliado_nome) || null,
                    setor: funcionario ? funcionario.setor : (parts[0] && parts[0].avaliado_setor) || null,
                    cargo: funcionario ? funcionario.cargo : (parts[0] && parts[0].avaliado_cargo) || null
                },
                consolidado,
                avaliacoes
            });
        } catch (e) {
            console.error(e);
            res.status(500).json({ ok: false, erro: 'Erro ao carregar relatório' });
        }
    });

    // GET /avaliacao/ciclos/:id/avaliados/:avaliadoId/pdf
    router.get('/avaliacao/ciclos/:id/avaliados/:avaliadoId/pdf', avaliacoesAuth, async (req, res) => {
        try {
            const cicloId = String(req.params.id || '').trim();
            const avaliadoId = String(req.params.avaliadoId || '').trim();
            if (!cicloId || !avaliadoId) return res.status(400).send('Parâmetros inválidos');

            const ciclo = await db.avaliacaoCiclos.getById(cicloId);
            if (!ciclo) return res.status(404).send('Ciclo não encontrado');

            const funcionario = await db.funcionarios.getById(avaliadoId);
            if (isEquipeScopedRole(req.user && req.user.role)) {
                const scope = await getEquipeScope(req);
                if (!avaliacaoPertenceAEscala(
                    { funcionario: funcionario && funcionario.nome, setor: funcionario && funcionario.setor, cargo: funcionario && funcionario.cargo },
                    scope,
                    norm(req.user && req.user.role)
                )) {
                    return res.status(403).send('Acesso proibido');
                }
            }

            let parts = await db.avaliacaoParticipantes.listByCiclo(cicloId);
            parts = (Array.isArray(parts) ? parts : []).filter(p => String(p && p.avaliado_id || '').trim() === avaliadoId);

            const avaliacaoIds = Array.from(new Set(parts.map(p => p && p.avaliacao_id).filter(Boolean)));
            const avArr = await Promise.all(avaliacaoIds.map(id => db.avaliacoes.getById(id)));
            const byId = new Map(avArr.filter(Boolean).map(a => [a.id, a]));

            let consolidado = null;
            try {
                const stored = await db.avaliacaoConsolidado.getByCicloEAvaliado({ cicloId, avaliadoId });
                if (stored && stored.dados) consolidado = stored.dados;
            } catch (_) { }

            if (!consolidado) {
                const arr = computeConsolidado({ ciclo, participantes: parts, avaliacoesById: byId });
                consolidado = Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
            }

            const pesosCategoria = parseJsonMaybe(ciclo.pesos_categoria, {}) || {};
            const maxScoreItem = Number.isFinite(Number(ciclo.max_score_item)) ? Number(ciclo.max_score_item) : 7.7;
            const pesosRelacao = parseJsonMaybe(ciclo.pesos_relacao, {}) || {};
            const relacaoPeso = (rel) => {
                const k = norm(rel);
                const raw = pesosRelacao && Object.prototype.hasOwnProperty.call(pesosRelacao, k) ? pesosRelacao[k] : 1;
                return Number.isFinite(Number(raw)) ? Number(raw) : 1;
            };

            const avaliacoes = parts.map(p => {
                const av = p.avaliacao_id ? byId.get(p.avaliacao_id) : null;
                const peso = Number.isFinite(Number(p.peso)) ? Number(p.peso) : 1;
                const pesoFinal = peso * relacaoPeso(p.relacao);
                let pctCategoria = null;
                if (av && Array.isArray(av.answers) && av.answers.length > 0) {
                    const calc = computeWeightedScoresFromAnswers({ answers: av.answers, pesosCategoria, maxScoreItem });
                    if (typeof calc.weightedPct === 'number') pctCategoria = calc.weightedPct;
                }
                if (pctCategoria == null && av) {
                    const t = Number(av.weightedTotalScore ?? av.totalScore);
                    const m = Number(av.weightedMaxScore ?? av.maxScore);
                    if (Number.isFinite(t) && Number.isFinite(m) && m > 0) pctCategoria = t / m;
                }
                return {
                    relacao: p.relacao,
                    pesoFinal,
                    status: p.status,
                    avaliadorUsername: p.avaliador_username,
                    avaliadorNome: p.avaliador_nome,
                    pctCategoria
                };
            }).sort((a, b) => String(a.relacao || '').localeCompare(String(b.relacao || '')));

            const payload = {
                ciclo: {
                    ...ciclo,
                    pesos_categoria: parseJsonMaybe(ciclo.pesos_categoria, {}) || {},
                    pesos_relacao: parseJsonMaybe(ciclo.pesos_relacao, {}) || {},
                    max_score_item: maxScoreItem
                },
                avaliado: {
                    id: avaliadoId,
                    nome: funcionario ? funcionario.nome : (parts[0] && parts[0].avaliado_nome) || null,
                    setor: funcionario ? funcionario.setor : (parts[0] && parts[0].avaliado_setor) || null,
                    cargo: funcionario ? funcionario.cargo : (parts[0] && parts[0].avaliado_cargo) || null
                },
                consolidado,
                avaliacoes
            };

            const pdfBuffer = await pdfService.pdfBufferFromAvaliacaoCicloRelatorio(payload);
            const safeName = String(payload.avaliado && payload.avaliado.nome || 'colaborador')
                .replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_').slice(0, 64) || 'colaborador';

            res.set({
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="ciclo-${cicloId}-${safeName}.pdf"`,
                'Content-Length': pdfBuffer.length
            });
            res.send(pdfBuffer);
        } catch (e) {
            console.error(e);
            res.status(500).send('Erro ao gerar PDF do ciclo');
        }
    });

    // POST /avaliacao/ciclos/:id/encerrar
    router.post('/avaliacao/ciclos/:id/encerrar', ciclosManageAuth, async (req, res) => {
        try {
            const cicloId = String(req.params.id || '').trim();
            const ciclo = await db.avaliacaoCiclos.getById(cicloId);
            if (!ciclo) return res.status(404).json({ ok: false, erro: 'Ciclo não encontrado' });
            if (norm(ciclo.status) !== 'ativo') return res.json({ ok: true, cicloId, status: ciclo.status });

            const parts = await db.avaliacaoParticipantes.listByCiclo(cicloId);
            const avaliacaoIds = Array.from(new Set((parts || []).map(p => p && p.avaliacao_id).filter(Boolean)));
            const avArr = await Promise.all(avaliacaoIds.map(id => db.avaliacoes.getById(id)));
            const byId = new Map(avArr.filter(Boolean).map(a => [a.id, a]));
            const consolidado = computeConsolidado({ ciclo, participantes: parts, avaliacoesById: byId });

            const now = new Date().toISOString();
            const rows = consolidado.map(c => ({
                id: crypto.randomUUID(),
                ciclo_id: cicloId,
                avaliado_id: c.avaliadoId,
                dados: JSON.stringify({ ...c, cicloId }),
                created_at: now,
                updated_at: now
            }));

            await db.avaliacaoConsolidado.upsertMany(rows);
            await db.avaliacaoCiclos.updateStatus({ id: cicloId, status: 'encerrado' });

            res.json({ ok: true, cicloId, status: 'encerrado', total: consolidado.length });
        } catch (e) {
            console.error(e);
            res.status(500).json({ ok: false, erro: 'Erro ao encerrar ciclo' });
        }
    });

    // GET /avaliacao/ciclos/:id/resumo
    router.get('/avaliacao/ciclos/:id/resumo', avaliacoesAuth, async (req, res) => {
        try {
            const cicloId = String(req.params.id || '').trim();
            const ciclo = await db.avaliacaoCiclos.getById(cicloId);
            if (!ciclo) return res.status(404).json({ ok: false, erro: 'Ciclo não encontrado' });

            const pesosRelacao = parseJsonMaybe(ciclo.pesos_relacao, {}) || {};
            const pesosCategoria = parseJsonMaybe(ciclo.pesos_categoria, {}) || {};
            const maxScoreItem = Number.isFinite(Number(ciclo.max_score_item)) ? Number(ciclo.max_score_item) : 7.7;
            const relacaoPeso = (rel) => {
                const k = norm(rel);
                const raw = pesosRelacao && Object.prototype.hasOwnProperty.call(pesosRelacao, k) ? pesosRelacao[k] : 1;
                return Number.isFinite(Number(raw)) ? Number(raw) : 1;
            };

            let parts = await db.avaliacaoParticipantes.listByCiclo(cicloId);
            if (isEquipeScopedRole(req.user && req.user.role)) {
                const scope = await getEquipeScope(req);
                parts = (parts || []).filter(p => avaliacaoPertenceAEscala(
                    { avaliadoId: p.avaliado_id, funcionario: p.avaliado_nome, setor: p.avaliado_setor, cargo: p.avaliado_cargo },
                    scope,
                    norm(req.user && req.user.role)
                ));
            } else {
                const username = String(req.user && req.user.username || '').trim().toLowerCase();
                parts = (parts || []).filter(p => String(p.avaliador_username || '').trim().toLowerCase() === username);
            }

            if (!parts || parts.length === 0) {
                return res.json({ ok: true, ciclo, ranking: [] });
            }

            const byAvaliacaoId = new Map();
            const avaliacaoIds = Array.from(new Set((parts || []).map(p => p && p.avaliacao_id).filter(Boolean)));
            const avArr = await Promise.all(avaliacaoIds.map(id => db.avaliacoes.getById(id)));
            avArr.filter(Boolean).forEach(a => byAvaliacaoId.set(a.id, a));

            const byAvaliados = new Map();
            (parts || []).forEach(p => {
                const key = String(p.avaliado_id || '').trim();
                if (!key) return;
                if (!byAvaliados.has(key)) {
                    byAvaliados.set(key, {
                        avaliadoId: p.avaliado_id,
                        avaliadoNome: p.avaliado_nome,
                        avaliadoSetor: p.avaliado_setor,
                        avaliadoCargo: p.avaliado_cargo,
                        totalSolicitadas: 0,
                        concluidas: 0,
                        somaPeso: 0,
                        somaPctPonderada: 0
                    });
                }
                const item = byAvaliados.get(key);
                item.totalSolicitadas += 1;

                const peso = Number.isFinite(Number(p.peso)) ? Number(p.peso) : 1;
                const pesoFinal = peso * relacaoPeso(p.relacao);
                const av = p.avaliacao_id ? byAvaliacaoId.get(p.avaliacao_id) : null;

                const getPct = () => {
                    if (!av) return null;
                    const wt = Number(av.weightedTotalScore), wm = Number(av.weightedMaxScore);
                    if (Number.isFinite(wt) && Number.isFinite(wm) && wm > 0) return wt / wm;
                    if (Array.isArray(av.answers) && av.answers.length > 0) {
                        const calc = computeWeightedScoresFromAnswers({ answers: av.answers, pesosCategoria, maxScoreItem });
                        if (typeof calc.weightedPct === 'number') return calc.weightedPct;
                    }
                    const t = Number(av.totalScore), m = Number(av.maxScore);
                    if (Number.isFinite(t) && Number.isFinite(m) && m > 0) return t / m;
                    return null;
                };
                const pct = getPct();

                if (typeof pct === 'number') {
                    item.concluidas += 1;
                    item.somaPeso += pesoFinal;
                    item.somaPctPonderada += pct * pesoFinal;
                }
            });

            const ranking = Array.from(byAvaliados.values())
                .map(r => ({ ...r, mediaPct: r.somaPeso > 0 ? r.somaPctPonderada / r.somaPeso : null }))
                .sort((a, b) => (b.mediaPct || 0) - (a.mediaPct || 0));

            res.json({
                ok: true,
                ciclo: {
                    ...ciclo,
                    pesos_categoria: parseJsonMaybe(ciclo.pesos_categoria, {}) || {},
                    pesos_relacao: parseJsonMaybe(ciclo.pesos_relacao, {}) || {},
                    max_score_item: maxScoreItem
                },
                ranking
            });
        } catch (e) {
            console.error(e);
            res.status(500).json({ ok: false, erro: 'Erro ao gerar resumo do ciclo' });
        }
    });

    // POST /avaliacao — Submete uma nova avaliação
    router.post('/avaliacao', avaliacoesAuth, async (req, res) => {
        try {
            const payload = req.body;
            const roleNorm = norm(req.user && req.user.role);
            const isGestorAv = ['gestor', 'supervisor', 'gerente'].includes(roleNorm);

            if (isGestorAv) {
                const avaliadorAuto = String(req.user && (req.user.name || req.user.username) || '').trim();
                if (avaliadorAuto) payload.avaliador = avaliadorAuto;
            }

            if (!payload.tipo || !payload.funcionario || !payload.avaliador)
                return res.status(400).json({ ok: false, erro: 'Campos obrigatórios ausentes' });

            try {
                const tipo = norm(payload.tipo);
                if (['lideranca', 'adm', 'operacional', 'atendimento'].includes(tipo)) {
                    const funcDb = await findFuncionarioByNome(payload.funcionario);
                    const cargo = funcDb ? funcDb.cargo : (payload.funcao || payload.cargo || null);
                    const setor = funcDb ? funcDb.setor : (payload.setor || payload.departamento || null);
                    const esperado = inferTipoAvaliacaoFromFuncionario({ cargo, setor });
                    if (!tipoCompatComEsperado(tipo, esperado))
                        return res.status(400).json({
                            ok: false,
                            erro: `Tipo de avaliação incompatível com a função/setor do colaborador. Esperado: ${esperado}.`
                        });
                }
            } catch (_) { }

            if (isEquipeScopedRole(req.user && req.user.role)) {
                const scope = await getEquipeScope(req);
                if (!avaliacaoPertenceAEscala(payload, scope))
                    return res.status(403).json({ ok: false, erro: 'Acesso proibido para este colaborador' });
            }

            const novaAvaliacao = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...payload };

            const participanteId = String(payload.participanteId || payload.participante_id || '').trim();
            const cicloIdPayload = String(payload.cicloId || payload.ciclo_id || '').trim();

            let ciclo = null;
            if (participanteId || cicloIdPayload) {
                try {
                    if (participanteId) {
                        const part = await db.avaliacaoParticipantes.getById(participanteId);
                        if (!part) return res.status(400).json({ ok: false, erro: 'Pendência inválida' });
                        if (!(await canAccessParticipanteByScope(req, part)))
                            return res.status(403).json({ ok: false, erro: 'Acesso proibido' });
                        if (part && part.ciclo_id) ciclo = await db.avaliacaoCiclos.getById(part.ciclo_id);
                    } else if (cicloIdPayload) {
                        ciclo = await db.avaliacaoCiclos.getById(cicloIdPayload);
                    }

                    if (ciclo && norm(ciclo.status) !== 'ativo')
                        return res.status(400).json({ ok: false, erro: 'Ciclo encerrado' });
                } catch (_) { }
            }

            // ✅ calcula sempre que houver answers, independente de ter ciclo
            if (Array.isArray(novaAvaliacao.answers) && novaAvaliacao.answers.length > 0) {
                let pesosCategoria = {};
                let maxScoreItem = 7.7;
                if (ciclo) {
                    pesosCategoria = parseJsonMaybe(ciclo.pesos_categoria, {}) || {};
                    maxScoreItem = Number.isFinite(Number(ciclo.max_score_item)) ? Number(ciclo.max_score_item) : 7.7;
                }
                const calc = computeWeightedScoresFromAnswers({ answers: novaAvaliacao.answers, pesosCategoria, maxScoreItem });
                if (Number.isFinite(Number(calc.weightedTotalScore)) && Number.isFinite(Number(calc.weightedMaxScore))) {
                    novaAvaliacao.weightedTotalScore = calc.weightedTotalScore;
                    novaAvaliacao.weightedMaxScore = calc.weightedMaxScore;
                    if (typeof calc.weightedPct === 'number') novaAvaliacao.weightedPct = calc.weightedPct;
                }
            }
            console.log('novaAvaliacao keys:', JSON.stringify(Object.fromEntries(Object.entries(novaAvaliacao).map(([k, v]) => [k, v === undefined ? 'UNDEFINED' : typeof v]))));
            await db.avaliacoes.create(novaAvaliacao);

            if (participanteId) {
                const part = await db.avaliacaoParticipantes.getById(participanteId);
                if (part && (await canAccessParticipanteByScope(req, part)))
                    await db.avaliacaoParticipantes.complete({ id: participanteId, avaliacaoId: novaAvaliacao.id });
            }

            res.json({ ok: true, id: novaAvaliacao.id });
        } catch (error) {
            console.error('Erro ao salvar avaliação:', error);
            res.status(500).json({ ok: false, erro: 'Erro interno ao processar avaliação' });
        }
    });

    // GET /avaliacao/:id
    router.get('/avaliacao/:id', avaliacoesAuth, async (req, res) => {
        try {
            const item = await db.avaliacoes.getById(req.params.id);
            if (!item) return res.status(404).json({ ok: false, erro: 'Não encontrado' });
            if (isEquipeScopedRole(req.user && req.user.role)) {
                const scope = await getEquipeScope(req);
                if (!avaliacaoPertenceAEscala(item, scope))
                    return res.status(403).json({ ok: false, erro: 'Acesso proibido para este registro' });
            }
            res.json(item);
        } catch (e) {
            console.error(e);
            res.status(500).json({ ok: false, erro: 'Erro ao buscar dados.' });
        }
    });

    // GET /avaliacao/buscar/recente
    router.get('/avaliacao/buscar/recente', avaliacoesAuth, async (req, res) => {
        try {
            const { funcionario, tipo } = req.query;
            if (!funcionario) return res.status(400).json({ ok: false, erro: 'Funcionário obrigatório' });

            let matches = (await db.avaliacoes.getAll()).filter(a =>
                a.funcionario === funcionario && (!tipo || a.tipo === tipo)
            );

            if (isEquipeScopedRole(req.user && req.user.role)) {
                const scope = await getEquipeScope(req);
                matches = matches.filter(a => avaliacaoPertenceAEscala(a, scope));
            }

            if (matches.length === 0)
                return res.status(404).json({ ok: false, message: 'Nenhuma avaliação encontrada' });

            matches.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            res.json(matches[0]);
        } catch (e) {
            console.error(e);
            res.status(500).json({ ok: false, erro: 'Erro ao buscar avaliação' });
        }
    });

    // PUT /avaliacao/:id
    router.put('/avaliacao/:id', avaliacoesAuth, async (req, res) => {
        try {
            const { id } = req.params;
            const existing = await db.avaliacoes.getById(id);
            if (!existing) return res.status(404).json({ ok: false, erro: 'Avaliação não encontrada' });

            const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
            await db.avaliacoes.update(id, updated);
            res.json({ ok: true, id, message: 'Avaliação atualizada com sucesso!' });
        } catch (e) {
            console.error(e);
            res.status(500).json({ ok: false, erro: 'Erro ao atualizar.' });
        }
    });

    // GET /avaliacoes
    router.get('/avaliacoes', avaliacoesAuth, async (req, res) => {
        try {
            const { tipo } = req.query;
            let data = await db.avaliacoes.getAll();

            if (tipo) data = data.filter(item => item.tipo === tipo);

            if (isEquipeScopedRole(req.user && req.user.role)) {
                const scope = await getEquipeScope(req);
                data = data.filter(item => avaliacaoPertenceAEscala(item, scope));
            }

            data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            res.json(data);
        } catch (error) {
            console.error('Erro ao listar avaliações:', error);
            res.status(500).json({ ok: false, erro: 'Erro ao buscar avaliações' });
        }
    });

    // GET /rh/avaliacoes/:id/pdf
    router.get('/rh/avaliacoes/:id/pdf', avaliacoesAuth, async (req, res) => {
        try {
            const item = await db.avaliacoes.getById(req.params.id);
            if (!item) return res.status(404).send('Registro não encontrado');

            if (isEquipeScopedRole(req.user && req.user.role)) {
                const scope = await getEquipeScope(req);
                if (!avaliacaoPertenceAEscala(item, scope))
                    return res.status(403).send('Acesso proibido');
            }

            const payload = { ...item, avaliado: item.funcionario || item.nome || 'N/A', avaliador: item.avaliador || 'N/A' };
            const pdfBuffer = await pdfService.pdfBufferFromAvaliacaoData(payload);

            res.set({
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="avaliacao-${item.id}.pdf"`,
                'Content-Length': pdfBuffer.length
            });
            res.send(pdfBuffer);
        } catch (e) {
            console.error(e);
            res.status(500).send('Erro ao gerar PDF');
        }
    });

    // POST /avaliacao/ciclos/gerar-lote
    router.post('/avaliacao/ciclos/gerar-lote', ciclosManageAuth, async (req, res) => {
        try {
            const todos = await db.funcionarios.getAll();
            const ativos = (Array.isArray(todos) ? todos : []).filter(f => f && f.data_admissao && f.ativo !== 0);

            let totalCriados = 0, totalPulados = 0, erros = 0;
            const resultados = [];

            for (const f of ativos) {
                try {
                    const r = await gerarCiclosParaFuncionario(f, 6);
                    totalCriados += r.criados;
                    totalPulados += r.pulados;
                    resultados.push({ nome: f.nome, ...r });
                } catch (e) {
                    erros++;
                    resultados.push({ nome: f.nome, erro: e.message });
                }
            }

            res.json({ ok: true, totalCriados, totalPulados, erros, resultados });
        } catch (e) {
            console.error(e);
            res.status(500).json({ ok: false, erro: e.message });
        }
    });

    // POST /avaliacao/ciclos/gerar/:funcionarioId
    router.post('/avaliacao/ciclos/gerar/:funcionarioId', ciclosManageAuth, async (req, res) => {
        try {
            const funcionario = await db.funcionarios.getById(req.params.funcionarioId);
            if (!funcionario) return res.status(404).json({ ok: false, erro: 'Colaborador não encontrado' });

            const r = await gerarCiclosParaFuncionario(funcionario, 6);
            res.json({ ok: true, nome: funcionario.nome, ...r });
        } catch (e) {
            console.error(e);
            res.status(500).json({ ok: false, erro: e.message });
        }
    });

    // GET /avaliacoes/:id/assinaturas
    // GET /avaliacoes/assinaturas - Lista todas as assinaturas
    // GET /avaliacoes/assinaturas - Lista todas as assinaturas
    router.get('/avaliacoes/assinaturas', verifyToken, async (req, res) => {
        try {
            const result = await db.sql.all('SELECT * FROM avaliacao_assinaturas');
            res.json({ ok: true, assinaturas: result });
        } catch (e) {
            console.error('Erro ao buscar assinaturas:', e);
            res.status(500).json({ ok: false, erro: 'Erro ao buscar assinaturas' });
        }
    });

    // GET /avaliacoes/:id/assinaturas - Busca assinaturas de uma avaliação
    router.get('/avaliacoes/:id/assinaturas', verifyToken, async (req, res) => {
        try {
            const avaliacaoId = String(req.params.id || '').trim();
            if (!avaliacaoId) return res.status(400).json({ ok: false, erro: 'ID inválido' });

            const rows = await db.sql.all(
                'SELECT * FROM avaliacao_assinaturas WHERE avaliacao_id = ?',
                [avaliacaoId]
            );

            // Parse JSON fields
            const parsed = (rows || []).map(row => {
                if (row.gestor) try { row.gestor = JSON.parse(row.gestor); } catch (_) { }
                if (row.colaborador) try { row.colaborador = JSON.parse(row.colaborador); } catch (_) { }
                return row;
            });

            res.json({ ok: true, assinaturas: parsed });
        } catch (e) {
            console.error('Erro ao buscar assinaturas:', e);
            res.status(500).json({ ok: false, erro: 'Erro ao buscar assinaturas' });
        }
    });

    // POST /avaliacoes/:id/assinaturas
    router.post('/avaliacoes/:id/assinaturas', verifyToken, async (req, res) => {
        try {
            const avaliacaoId = String(req.params.id || '').trim();
            if (!avaliacaoId) return res.status(400).json({ ok: false, erro: 'ID inválido' });

            const avaliacao = await db.avaliacoes.getById(avaliacaoId);
            if (!avaliacao) return res.status(404).json({ ok: false, erro: 'Avaliação não encontrada' });

            const { gestor, colaborador, periodo } = req.body || {};
            const finalPeriodo = String(periodo || '90').trim();

            if (!gestor && !colaborador)
                return res.status(400).json({ ok: false, erro: 'Informe ao menos a assinatura do gestor ou colaborador' });

            const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

            await db.sql.run(
                `INSERT INTO avaliacao_assinaturas (avaliacao_id, periodo, gestor, colaborador, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               gestor      = COALESCE(VALUES(gestor), gestor),
               colaborador = COALESCE(VALUES(colaborador), colaborador),
               updated_at  = ?`,
                [avaliacaoId, finalPeriodo, gestor ? JSON.stringify(gestor) : null, colaborador ? JSON.stringify(colaborador) : null, now, now, now]
            );

            res.json({ ok: true, avaliacaoId, periodo: finalPeriodo });
        } catch (e) {
            console.error('Erro ao salvar assinatura:', e);
            res.status(500).json({ ok: false, erro: 'Erro ao salvar assinatura' });
        }
    });

    // ─── Exports ──────────────────────────────────────────────────────────────────
    router.gerarCiclosParaFuncionario = gerarCiclosParaFuncionario;

    return router;
};
