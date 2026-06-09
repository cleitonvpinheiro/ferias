const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadsDir = path.join(__dirname, '../public/uploads/intranet');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
    }
});

const uploadImg = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    fileFilter: (req, file, cb) => {
        const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, allowed.includes(ext));
    }
});


const norm = (s) => String(s || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const startOfDay = (d) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
};

const pctFromScores = (totalScore, maxScore) => {
    const t = Number(totalScore);
    const m = Number(maxScore);
    if (!Number.isFinite(t) || !Number.isFinite(m) || m <= 0) return null;
    return Math.round((t / m) * 1000) / 10;
};




module.exports = (db, auth) => {
    const { verifyToken,checkRole,ROLES,rhAuth,expDashAuth,PORTAL_ROLES } = auth;
    const portalApiAuth = [verifyToken, checkRole(PORTAL_ROLES)];
    const rhContentAuth = [verifyToken, checkRole([ROLES.ADMIN, ROLES.RH, ROLES.RH_GERAL, ROLES.DP, ROLES.TD])];

    const parseDateBR = (v) => {
        if (!v) return null;
        if (typeof v === 'string') {
            const parts = v.split('/');
            if (parts.length === 3) {
                const d = parseInt(parts[0], 10);
                const m = parseInt(parts[1], 10) - 1;
                const y = parseInt(parts[2], 10);
                const dt = new Date(y, m, d);
                if (!isNaN(dt.getTime())) return dt;
            }
        }
        const d = new Date(v);
        return Number.isNaN(d.getTime()) ? null : d;
    };

router.get('/rh/stats', rhAuth, async (req, res) => {
    try {
        const [ferias, candidatos, vagas, taxas, movimentacoes] = await Promise.all([
            db.solicitacoes.getAll(),
            db.candidatos.getAll(),
            db.vagas.getAll(),
            db.taxas.getAll(),
            db.movimentacoes.getAll()
        ]);

        const stats = {
            feriasPendentes: ferias.filter(f => f.status === 'pendente_rh').length,
            candidatosNovos: candidatos.filter(c => c.status === 'recebido').length,
            vagasAbertas: vagas.filter(v => v.status === 'aprovada' && v.ativa).length,
            taxasPendentes: taxas.filter(t => t.status === 'pendente').length,
            movimentacoesPendentes: movimentacoes.filter(m => m.status === 'pendente').length
        };

        res.json(stats);
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao carregar estatísticas' });
    }
});

router.get('/analytics/overview', portalApiAuth, async (req, res) => {
    try {
        const role = String(req.user && req.user.role || '').trim().toLowerCase();
        const username = req.user && req.user.username ? String(req.user.username) : null;

        const [avaliacoesAll, onTheJobAll, vagasAll, candidatosAll, taxasAll, feriasAll] = await Promise.all([
            db.avaliacoes.getAll(),
            db.movimentacoes.getAll(),
            db.vagas.getAll(),
            db.candidatos.getAll(),
            db.taxas.getAll(),
            db.solicitacoes.getAll()
        ]);

        const avs = (Array.isArray(avaliacoesAll) ? avaliacoesAll : [])
            .filter(a => a && a.tipo && a.tipo !== 'experiencia');

        const perfScores = avs
            .map(a => {
                const total = (a && a.weightedTotalScore != null) ? a.weightedTotalScore : a.totalScore;
                const max = (a && a.weightedMaxScore != null) ? a.weightedMaxScore : a.maxScore;
                return { ...a, pct: pctFromScores(total, max) };
            })
            .filter(a => typeof a.pct === 'number');

        const perfAvg = perfScores.length
            ? Math.round((perfScores.reduce((sum, a) => sum + a.pct, 0) / perfScores.length) * 10) / 10
            : null;

        const byTipo = {};
        for (const a of perfScores) {
            const k = String(a.tipo || '').trim().toLowerCase();
            if (!k) continue;
            if (!byTipo[k]) byTipo[k] = { tipo: k, avg: 0, count: 0 };
            byTipo[k].avg += a.pct;
            byTipo[k].count += 1;
        }
        const perfByTipo = Object.values(byTipo).map(x => ({
            tipo: x.tipo,
            avg: x.count ? Math.round((x.avg / x.count) * 10) / 10 : null,
            count: x.count
        })).sort((a, b) => (b.count - a.count) || (String(a.tipo).localeCompare(String(b.tipo))));

        const bySetor = {};
        for (const a of perfScores) {
            const k = norm(a.setor || a.departamento);
            if (!k) continue;
            if (!bySetor[k]) bySetor[k] = { setor: k, avg: 0, count: 0 };
            bySetor[k].avg += a.pct;
            bySetor[k].count += 1;
        }
        const perfBySetor = Object.values(bySetor)
            .map(x => ({
                setor: x.setor,
                avg: x.count ? Math.round((x.avg / x.count) * 10) / 10 : null,
                count: x.count
            }))
            .sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0))
            .slice(0, 12);

        const onTheJob = Array.isArray(onTheJobAll) ? onTheJobAll : [];
        const onb = { pendente: 0, em_andamento: 0, concluido: 0, outros: 0 };
        onTheJob.forEach(i => {
            const s = norm(i && i.status);
            if (s === 'pendente') onb.pendente++;
            else if (s === 'em_andamento' || s === 'andamento') onb.em_andamento++;
            else if (s === 'concluido') onb.concluido++;
            else onb.outros++;
        });

        const vagas = Array.isArray(vagasAll) ? vagasAll : [];
        const candidatos = Array.isArray(candidatosAll) ? candidatosAll : [];
        const taxas = Array.isArray(taxasAll) ? taxasAll : [];
        const ferias = Array.isArray(feriasAll) ? feriasAll : [];

        const recrutamento = {
            vagasAbertas: vagas.filter(v => v && (v.status === 'aprovada' || v.status === 'aberta') && (v.ativa === 1 || v.ativa === true)).length,
            candidatosNovos: candidatos.filter(c => c && c.status === 'recebido').length
        };

        const operacional = {
            feriasPendentesRh: ferias.filter(f => f && f.status === 'pendente_rh').length,
            taxasPendentes: taxas.filter(t => t && String(t.status || '').toLowerCase() === 'pendente').length,
            movimentacoesPendentes: onTheJob.filter(m => m && String(m.status || '').toLowerCase() === 'pendente').length
        };

        const turnover = (() => {
            const now = new Date();
            const start = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30));
            let desligamentos30d = 0;
            for (const v of vagas) {
                const dt = v && v.data_desligamento ? new Date(v.data_desligamento) : null;
                if (!dt || Number.isNaN(dt.getTime())) continue;
                if (dt.getTime() >= start.getTime()) desligamentos30d++;
            }
            return { desligamentos30d };
        })();

        res.json({
            ok: true,
            scope: { role, username },
            performance: {
                total: perfScores.length,
                avg: perfAvg,
                byTipo: perfByTipo,
                topSetores: perfBySetor
            },
            onboarding: onb,
            recrutamento,
            operacional,
            turnover
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao carregar analytics' });
    }
});

router.get('/analytics/performance-heatmap', portalApiAuth, async (req, res) => {
    try {
        const avs = await db.avaliacoes.getAll();
        const data = (Array.isArray(avs) ? avs : [])
            .filter(a => a && a.tipo && a.tipo !== 'experiencia')
            .map(a => {
                const total = (a && a.weightedTotalScore != null) ? a.weightedTotalScore : a.totalScore;
                const max = (a && a.weightedMaxScore != null) ? a.weightedMaxScore : a.maxScore;
                return { ...a, pct: pctFromScores(total, max) };
            })
            .filter(a => typeof a.pct === 'number');

        const map = {};
        const tipos = new Set();
        data.forEach(a => {
            const setor = norm(a.setor || a.departamento) || 'sem_setor';
            const tipo = norm(a.tipo) || 'sem_tipo';
            tipos.add(tipo);
            if (!map[setor]) map[setor] = {};
            if (!map[setor][tipo]) map[setor][tipo] = { sum: 0, count: 0 };
            map[setor][tipo].sum += a.pct;
            map[setor][tipo].count += 1;
        });

        const tipoList = Array.from(tipos).sort((a, b) => a.localeCompare(b));
        const setores = Object.keys(map).sort((a, b) => a.localeCompare(b));
        const rows = setores.map(setor => {
            const cells = {};
            tipoList.forEach(tipo => {
                const cell = map[setor][tipo];
                cells[tipo] = cell ? { avg: Math.round((cell.sum / cell.count) * 10) / 10, count: cell.count } : { avg: null, count: 0 };
            });
            return { setor, cells };
        });

        res.json({ ok: true, tipos: tipoList, rows });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao carregar heatmap' });
    }
});

router.get('/intranet/feed', portalApiAuth, async (req, res) => {
    try {
        const limit = Number(req.query && req.query.limit || 50);
        const rawType = String((req.query && (req.query.type || req.query.tipo)) || '').trim().toLowerCase();
        const tipo = rawType && rawType !== 'all' ? rawType : null;
        const data = await db.intranet.feed({ limit, tipo });
        res.json({ ok: true, items: Array.isArray(data) ? data : [] });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao carregar feed' });
    }
});

router.get('/public/intranet/feed', async (req, res) => {
    try {
        const limit = Math.max(1, Math.min(Number(req.query && req.query.limit || 50), 200));
        const rawType = String((req.query && (req.query.type || req.query.tipo)) || '').trim().toLowerCase();
        const tipo = rawType ? (rawType === 'all' ? null : rawType) : 'announcement';
        const data = await db.intranet.feed({ limit, tipo });
        res.json({ ok: true, items: Array.isArray(data) ? data : [] });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao carregar feed' });
    }
});

router.post('/intranet/posts', portalApiAuth, uploadImg.single('imagem'), async (req, res,next) => {
    try {
        const body = req.body || {};
        const conteudo = String(body.conteudo || '').trim();
        const titulo   = String(body.titulo   || '').trim();
        const tipo     = String(body.tipo     || 'post').trim().toLowerCase();

        if (!conteudo) return res.status(400).json({ ok: false, erro: 'conteudo é obrigatório' });

        const role = String(req.user && req.user.role || '').trim().toLowerCase();
        const isAnnouncement = tipo === 'announcement' || tipo === 'comunicado';
        if (isAnnouncement) {
            const allowed = [ROLES.ADMIN, ROLES.RH, ROLES.RH_GERAL, ROLES.DP, ROLES.TD].includes(role);
            if (!allowed) return res.status(403).json({ ok: false, erro: 'Sem permissão para publicar comunicado' });
        }

        // Monta URL pública da imagem, se enviada
        const imagem_url = req.file
            ? `/uploads/intranet/${req.file.filename}`
            : null;

        const item = {
            id: crypto.randomUUID(),
            tipo: isAnnouncement ? 'announcement' : 'post',
            titulo:        titulo   || null,
            conteudo,
            imagem_url,                          // <-- novo campo
            autor_username: req.user && req.user.username ? String(req.user.username) : null,
            autor_nome:     req.user && (req.user.name || req.user.username) ? String(req.user.name || req.user.username) : null,
            autor_role:     role || null,
            created_at:    new Date().toISOString()
        };
        await db.intranet.createPost(item);

        if (isAnnouncement) {
            try {
                const users = await db.users.getAll();
                const createdAt = new Date().toISOString();
                const notifItems = (users || [])
                    .filter(u => u && u.username)
                    .map(u => ({
                        id: crypto.randomUUID(),
                        username: String(u.username),
                        tipo: 'announcement',
                        titulo: item.titulo || 'Novo comunicado',
                        mensagem: item.conteudo.length > 240 ? item.conteudo.slice(0, 240) + '…' : item.conteudo,
                        link: '/protected/index.html',
                        created_at: createdAt
                    }));
                await db.notifications.createMany(notifItems);
            } catch (_) {}
        }

        res.json({ ok: true, item });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao publicar' });
    }

    console.log('Content-Type:', req.headers['content-type']);
    console.log('req.file:', req.file);
    console.log('req.body:', req.body);
});

router.get('/intranet/events', portalApiAuth, async (req, res) => {
    try {
        const from = req.query && req.query.from ? String(req.query.from) : null;
        const limit = Number(req.query && req.query.limit || 30);
        const items = await db.intranet.listEvents({ from, limit });
        res.json({ ok: true, items: Array.isArray(items) ? items : [] });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao carregar eventos' });
    }
});

router.get('/public/intranet/events', async (req, res) => {
    try {
        const from = req.query && req.query.from ? String(req.query.from) : null;
        const limit = Math.max(1, Math.min(Number(req.query && req.query.limit || 30), 200));
        const items = await db.intranet.listEvents({ from, limit });
        res.json({ ok: true, items: Array.isArray(items) ? items : [] });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao carregar eventos' });
    }
});

router.post('/intranet/events', rhContentAuth, async (req, res) => {
    try {
        const body = req.body || {};
        const titulo = String(body.titulo || '').trim();
        const descricao = String(body.descricao || '').trim();
        const data_inicio = body.data_inicio ? new Date(body.data_inicio) : null;
        const data_fim = body.data_fim ? new Date(body.data_fim) : null;
        const local = String(body.local || '').trim();

        if (!titulo) return res.status(400).json({ ok: false, erro: 'titulo é obrigatório' });
        if (!data_inicio || Number.isNaN(data_inicio.getTime())) return res.status(400).json({ ok: false, erro: 'data_inicio inválida' });
        if (data_fim && Number.isNaN(data_fim.getTime())) return res.status(400).json({ ok: false, erro: 'data_fim inválida' });

        const item = {
            id: crypto.randomUUID(),
            titulo,
            descricao: descricao || null,
            data_inicio: data_inicio.toISOString(),
            data_fim: data_fim ? data_fim.toISOString() : null,
            local: local || null,
            criado_por: req.user && req.user.username ? String(req.user.username) : null,
            created_at: new Date().toISOString()
        };
        await db.intranet.createEvent(item);

        try {
            const users = await db.users.getAll();
            const createdAt = new Date().toISOString();
            const notifItems = (users || [])
                .filter(u => u && u.username)
                .map(u => ({
                    id: crypto.randomUUID(),
                    username: String(u.username),
                    tipo: 'event',
                    titulo: 'Novo evento',
                    mensagem: item.titulo,
                    link: '/protected/index.html',
                    created_at: createdAt
                }));
            await db.notifications.createMany(notifItems);
        } catch (_) {}

        res.json({ ok: true, item });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao criar evento' });
    }
});

router.get('/intranet/birthdays', portalApiAuth, async (req, res) => {
    try {
        const rawTodayOnly = String((req.query && (req.query.todayOnly ?? req.query.today)) || '').trim();
        const todayOnly = rawTodayOnly === '1' || rawTodayOnly.toLowerCase() === 'true';
        const days = todayOnly ? 1 : Math.max(1, Math.min(Number(req.query && req.query.days || 30), 366));
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const end = new Date(today);
        end.setDate(end.getDate() + days);

        const yearWrap = (d) => {
            const out = new Date(d);
            out.setFullYear(today.getFullYear());
            return out;
        };

        const role = String(req.user && req.user.role || '').trim().toLowerCase();
        const username = req.user && req.user.username ? String(req.user.username).trim().toLowerCase() : '';
        const isEquipeScoped = ['gestor', 'supervisor', 'gerente'].includes(role);

        const funcionarios = isEquipeScoped && username && db.gestorEquipes && typeof db.gestorEquipes.getEquipeByGestor === 'function'
            ? await db.gestorEquipes.getEquipeByGestor(username)
            : await db.funcionarios.getAll();
        const items = [];
        for (const f of Array.isArray(funcionarios) ? funcionarios : []) {
            const nasc = parseDateBR(f.nascimento);
            if (!nasc) continue;

            if (todayOnly) {
                if (nasc.getMonth() !== today.getMonth()) continue;
                if (nasc.getDate() !== today.getDate()) continue;
                const d0 = yearWrap(nasc);
                d0.setHours(0, 0, 0, 0);
                items.push({
                    id: f.id,
                    nome: f.nome || '',
                    setor: f.setor || '',
                    data: d0.toISOString()
                });
                continue;
            }

            const thisYear = yearWrap(nasc);
            thisYear.setHours(0, 0, 0, 0);
            let next = thisYear;
            if (next.getTime() < today.getTime()) {
                next = new Date(thisYear);
                next.setFullYear(today.getFullYear() + 1);
            }
            if (next.getTime() > end.getTime()) continue;
            items.push({
                id: f.id,
                nome: f.nome || '',
                setor: f.setor || '',
                data: next.toISOString()
            });
        }

        items.sort((a, b) => new Date(a.data) - new Date(b.data));
        res.json({ ok: true, items });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao carregar aniversariantes' });
    }
});

router.get('/public/intranet/birthdays', async (req, res) => {
    try {
        const rawTodayOnly = String((req.query && (req.query.todayOnly ?? req.query.today)) || '').trim();
        const todayOnly = rawTodayOnly === '1' || rawTodayOnly.toLowerCase() === 'true';
        const days = todayOnly ? 1 : Math.max(1, Math.min(Number(req.query && req.query.days || 30), 366));
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const end = new Date(today);
        end.setDate(end.getDate() + days);

        const yearWrap = (d) => {
            const out = new Date(d);
            out.setFullYear(today.getFullYear());
            return out;
        };

        const funcionarios = await db.funcionarios.getAll();
        const items = [];
        for (const f of Array.isArray(funcionarios) ? funcionarios : []) {
            const nasc = parseDateBR(f.nascimento);
            if (!nasc) continue;
            if (todayOnly) {
                if (nasc.getMonth() !== today.getMonth()) continue;
                if (nasc.getDate() !== today.getDate()) continue;
                const d0 = yearWrap(nasc);
                d0.setHours(0, 0, 0, 0);
                items.push({
                    id: f.id,
                    nome: f.nome || '',
                    setor: f.setor || '',
                    data: d0.toISOString()
                });
                continue;
            }
            const thisYear = yearWrap(nasc);
            thisYear.setHours(0, 0, 0, 0);
            let next = thisYear;
            if (next.getTime() < today.getTime()) {
                next = new Date(thisYear);
                next.setFullYear(today.getFullYear() + 1);
            }
            if (next.getTime() > end.getTime()) continue;
            items.push({
                id: f.id,
                nome: f.nome || '',
                setor: f.setor || '',
                data: next.toISOString()
            });
        }

        items.sort((a, b) => new Date(a.data) - new Date(b.data));
        res.json({ ok: true, items });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao carregar aniversariantes' });
    }
});

router.get('/notifications', portalApiAuth, async (req, res) => {
    try {
        const username = req.user && req.user.username ? String(req.user.username) : '';
        const limit = Number(req.query && req.query.limit || 30);
        const unreadOnly = String(req.query && req.query.unreadOnly || '').trim() === '1';
        const [items, unread] = await Promise.all([
            db.notifications.listByUser(username, { limit, unreadOnly }),
            db.notifications.countUnread(username)
        ]);
        res.json({ ok: true, unread, items: Array.isArray(items) ? items : [] });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao carregar notificações' });
    }
});

router.post('/notifications/read', portalApiAuth, async (req, res) => {
    try {
        const username = req.user && req.user.username ? String(req.user.username) : '';
        const body = req.body || {};
        const all = String(body.all || '') === '1' || body.all === true;
        const ids = Array.isArray(body.ids) ? body.ids : null;
        const result = await db.notifications.marcarLida({ username, ids, all });
        if (!result.ok) return res.status(400).json({ ok: false });
        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao atualizar notificações' });
    }
});

router.get('/rh/alertas', expDashAuth, async (req, res) => {
    try {

        const addMonths = (date, months) => {
            const d = new Date(date);
            const day = d.getDate();
            d.setMonth(d.getMonth() + months);
            if (d.getDate() < day) d.setDate(0);
            return d;
        };

        const diffDays = (a, b) => Math.floor((startOfDay(a).getTime() - startOfDay(b).getTime()) / 86400000);
        const today = startOfDay(new Date());

        const [vagas, avaliacoes, funcionarios] = await Promise.all([
            db.vagas.getAll(),
            db.avaliacoes.getAll(),
            db.funcionarios.getAll()
        ]);

        const vagasAlertItems = [];
        for (const v of Array.isArray(vagas) ? vagas : []) {
            const dataDesl = parseDateBR(v.data_desligamento);
            if (!dataDesl) continue;
            const dd = diffDays(dataDesl, today);
            if (dd > 30) continue;
            vagasAlertItems.push({
                id: v.id,
                cargo: v.cargo || v.titulo || '',
                setor: v.setor || v.departamento || '',
                substituicao_nome: v.substituicao_nome || '',
                email_gestor: v.email_gestor || '',
                data_desligamento: dataDesl.toISOString(),
                dias: dd
            });
        }

        const vagasOverdue = vagasAlertItems.filter(x => x.dias < 0).length;
        const vagasNear = vagasAlertItems.filter(x => x.dias >= 0).length;

        const nearThreshold = 10;
        const expAlert = {
            near45: 0,
            overdue45: 0,
            near90: 0,
            overdue90: 0,
            items: []
        };

        const avsByFunc = new Map();
        for (const a of Array.isArray(avaliacoes) ? avaliacoes : []) {
            if (a.tipo !== 'experiencia') continue;
            const key = String(a.funcionario || '').trim().toLowerCase();
            if (key) avsByFunc.set(key, a);
        }

        for (const f of Array.isArray(funcionarios) ? funcionarios : []) {
            if (f.ativo === 0 || f.status === 'Inativo') continue;
            
            const adm = parseDateBR(f.data_admissao || f.dataAdmissao);
            if (!adm) continue;

            const a = avsByFunc.get(String(f.nome || '').trim().toLowerCase());
            
            const due45 = addMonths(adm, 0);
            due45.setDate(due45.getDate() + 45);
            const due90 = addMonths(adm, 0);
            due90.setDate(due90.getDate() + 90);

            const d45 = diffDays(due45, today);
            const d90 = diffDays(due90, today);
            const ageDays = diffDays(today, adm);

            const status45 = a ? a.status45 : null;
            const status90 = a ? a.status90 : null;

            const needs45 = !status45 && (d45 <= nearThreshold) && ageDays <= 60;
            const needs90 = !status90 && (d90 <= nearThreshold) && ageDays <= 120;

            if (!needs45 && !needs90) continue;

            if (needs45) {
                if (d45 < 0) expAlert.overdue45++;
                else expAlert.near45++;
            }
            if (needs90) {
                if (d90 < 0) expAlert.overdue90++;
                else expAlert.near90++;
            }

            expAlert.items.push({
                id: a ? a.id : null,
                funcionario: f.nome || '',
                cargo: f.cargo || '',
                setor: f.setor || '',
                avaliador: a ? a.avaliador : '',
                dataAdmissao: adm.toISOString(),
                dias45: needs45 ? d45 : null,
                dias90: needs90 ? d90 : null
            });
        }

        const feriasItems = [];
        for (const f of Array.isArray(funcionarios) ? funcionarios : []) {
            const adm = parseDateBR(f.data_admissao || f.dataAdmissao);
            if (!adm) continue;

            let fim = addMonths(adm, 12);
            while (fim.getTime() <= today.getTime()) fim = addMonths(fim, 12);

            const d = diffDays(fim, today);
            if (d > 30) continue;
            feriasItems.push({
                id: f.id,
                nome: f.nome || '',
                setor: f.setor || '',
                cargo: f.cargo || '',
                data_admissao: adm.toISOString(),
                fim_aquisitivo: fim.toISOString(),
                dias: d
            });
        }

        res.json({
            ok: true,
            vagas_desligamento: {
                total: vagasAlertItems.length,
                near: vagasNear,
                overdue: vagasOverdue,
                items: vagasAlertItems.sort((a, b) => a.dias - b.dias)
            },
            experiencia: {
                ...expAlert,
                total: expAlert.near45 + expAlert.overdue45 + expAlert.near90 + expAlert.overdue90
            },
            ferias_aquisitivo: {
                total: feriasItems.length,
                items: feriasItems.sort((a, b) => a.dias - b.dias)
            }
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao carregar alertas' });
    }
});

router.post('/rh/reminders/run', rhAuth, async (req, res) => {
    try {
        const users = await db.users.getAll();
        const allUsers = Array.isArray(users) ? users : [];

        const now = new Date();
        const today = startOfDay(now);
        const since = today.toISOString();

        const [statsRes, alertasRes] = await Promise.all([
            (async () => {
                const [ferias, candidatos, vagas, taxas, movimentacoes] = await Promise.all([
                    db.solicitacoes.getAll(),
                    db.candidatos.getAll(),
                    db.vagas.getAll(),
                    db.taxas.getAll(),
                    db.movimentacoes.getAll()
                ]);
                return {
                    feriasPendentes: (Array.isArray(ferias) ? ferias : []).filter(f => f && f.status === 'pendente_rh').length,
                    candidatosNovos: (Array.isArray(candidatos) ? candidatos : []).filter(c => c && c.status === 'recebido').length,
                    vagasAbertas: (Array.isArray(vagas) ? vagas : []).filter(v => v && v.status === 'aprovada' && (v.ativa === 1 || v.ativa === true)).length,
                    taxasPendentes: (Array.isArray(taxas) ? taxas : []).filter(t => t && String(t.status || '').toLowerCase() === 'pendente').length,
                    movimentacoesPendentes: (Array.isArray(movimentacoes) ? movimentacoes : []).filter(m => m && String(m.status || '').toLowerCase() === 'pendente').length
                };
            })(),
            (async () => {
                const resAlertas = await Promise.resolve(null);
                void resAlertas;
                const startOfDayLocal = startOfDay;
                const addMonths = (date, months) => {
                    const d = new Date(date);
                    const day = d.getDate();
                    d.setMonth(d.getMonth() + months);
                    if (d.getDate() < day) d.setDate(0);
                    return d;
                };
                const diffDays = (a, b) => Math.floor((startOfDayLocal(a).getTime() - startOfDayLocal(b).getTime()) / 86400000);
                const todayLocal = startOfDayLocal(new Date());

                const [vagas, avaliacoes, funcionarios] = await Promise.all([
                    db.vagas.getAll(),
                    db.avaliacoes.getAll(),
                    db.funcionarios.getAll()
                ]);

                const vagasAlertItems = [];
                for (const v of Array.isArray(vagas) ? vagas : []) {
                    const dataDesl = parseDateBR(v.data_desligamento);
                    if (!dataDesl) continue;
                    const dd = diffDays(dataDesl, todayLocal);
                    if (dd > 30) continue;
                    vagasAlertItems.push({ dias: dd });
                }

                const nearThreshold = 10;
                const expAlert = { near45: 0, overdue45: 0, near90: 0, overdue90: 0 };

                const avsByFunc = new Map();
                for (const a of Array.isArray(avaliacoes) ? avaliacoes : []) {
                    if (a.tipo !== 'experiencia') continue;
                    const key = String(a.funcionario || '').trim().toLowerCase();
                    if (key) avsByFunc.set(key, a);
                }

                for (const f of Array.isArray(funcionarios) ? funcionarios : []) {
                    if (f.ativo === 0 || f.status === 'Inativo') continue;
                    const adm = parseDateBR(f.data_admissao || f.dataAdmissao);
                    if (!adm) continue;
                    const a = avsByFunc.get(String(f.nome || '').trim().toLowerCase());
                    const due45 = addMonths(adm, 0);
                    due45.setDate(due45.getDate() + 45);
                    const due90 = addMonths(adm, 0);
                    due90.setDate(due90.getDate() + 90);
                    const d45 = diffDays(due45, todayLocal);
                    const d90 = diffDays(due90, todayLocal);
                    const ageDays = diffDays(todayLocal, adm);
                    const status45 = a ? a.status45 : null;
                    const status90 = a ? a.status90 : null;
                    const needs45 = !status45 && (d45 <= nearThreshold) && ageDays <= 60;
                    const needs90 = !status90 && (d90 <= nearThreshold) && ageDays <= 120;
                    if (needs45) {
                        if (d45 < 0) expAlert.overdue45++;
                        else expAlert.near45++;
                    }
                    if (needs90) {
                        if (d90 < 0) expAlert.overdue90++;
                        else expAlert.near90++;
                    }
                }

                let feriasAq = 0;
                for (const f of Array.isArray(funcionarios) ? funcionarios : []) {
                    const adm = parseDateBR(f.data_admissao || f.dataAdmissao);
                    if (!adm) continue;
                    let fim = addMonths(adm, 12);
                    while (fim.getTime() <= todayLocal.getTime()) fim = addMonths(fim, 12);
                    const d = diffDays(fim, todayLocal);
                    if (d > 30) continue;
                    feriasAq++;
                }

                return {
                    vagasDesligamento: vagasAlertItems.length,
                    experiencia: expAlert.near45 + expAlert.overdue45 + expAlert.near90 + expAlert.overdue90,
                    feriasAquisitivo: feriasAq
                };
            })()
        ]);

        const created = [];
        const createIfNotExists = async ({ username, tipo, titulo, mensagem, link }) => {
            const exists = await db.notifications.existsSince({ username, tipo, titulo, since });
            if (exists) return false;
            const item = {
                id: crypto.randomUUID(),
                username,
                tipo,
                titulo,
                mensagem,
                link,
                created_at: new Date().toISOString()
            };
            await db.notifications.create(item);
            created.push(item);
            return true;
        };

        const dpUsers = allUsers.filter(u => u && String(u.role || '').trim().toLowerCase() === 'dp');
        for (const u of dpUsers) {
            const username = String(u.username || '').trim();
            if (!username) continue;
            if (alertasRes.vagasDesligamento) {
                await createIfNotExists({
                    username,
                    tipo: 'reminder',
                    titulo: 'Alertas DP: desligamentos próximos',
                    mensagem: `Há ${alertasRes.vagasDesligamento} vaga(s) com desligamento em até 30 dias.`,
                    link: '/protected/dashboard-vagas.html'
                });
            }
            if (alertasRes.experiencia) {
                await createIfNotExists({
                    username,
                    tipo: 'reminder',
                    titulo: 'Alertas DP: experiência 45/90',
                    mensagem: `Há ${alertasRes.experiencia} avaliação(ões) de experiência próxima(s) do prazo (45 dias ou 90 dias).`,
                    link: '/protected/dashboard-experiencia.html'
                });
            }
            if (alertasRes.feriasAquisitivo) {
                await createIfNotExists({
                    username,
                    tipo: 'reminder',
                    titulo: 'Alertas DP: aquisitivo de férias',
                    mensagem: `Há ${alertasRes.feriasAquisitivo} colaborador(es) com fim de aquisitivo em até 30 dias.`,
                    link: '/protected/dashboard-rh.html'
                });
            }
        }

        const rhUsers = allUsers.filter(u => {
            const r = String(u && u.role || '').trim().toLowerCase();
            return r === 'rh' || r === 'rh_geral';
        });
        for (const u of rhUsers) {
            const username = String(u.username || '').trim();
            if (!username) continue;
            const total = (statsRes.feriasPendentes || 0) + (statsRes.taxasPendentes || 0) + (statsRes.movimentacoesPendentes || 0) + (statsRes.candidatosNovos || 0);
            if (!total) continue;
            await createIfNotExists({
                username,
                tipo: 'reminder',
                titulo: 'Pendências RH do dia',
                mensagem: `Férias: ${statsRes.feriasPendentes || 0} • Taxas: ${statsRes.taxasPendentes || 0} • Movimentações: ${statsRes.movimentacoesPendentes || 0} • Candidatos: ${statsRes.candidatosNovos || 0}`,
                link: '/protected/index.html'
            });
        }

        res.json({ ok: true, created: created.length });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao gerar lembretes' });
    }
});

router.delete('/intranet/posts/:id', portalApiAuth, async (req, res) => {
    try {
        const id = String(req.params.id || '').trim();
        if (!id) return res.status(400).json({ ok: false, erro: 'id é obrigatório' });

        const role = String(req.user && req.user.role || '').trim().toLowerCase();
        const username = req.user && req.user.username ? String(req.user.username) : null;

        // Busca o post para verificar permissão
        const post = await db.intranet.getPostById(id);
        if (!post) return res.status(404).json({ ok: false, erro: 'Post não encontrado' });

        // Admin/RH pode excluir qualquer post; outros só o próprio
        const canDeleteAny = [ROLES.ADMIN, ROLES.RH, ROLES.RH_GERAL].includes(role);
        if (!canDeleteAny && post.autor_username !== username) {
            return res.status(403).json({ ok: false, erro: 'Sem permissão para excluir este post' });
        }

        await db.intranet.deletePost(id);
        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao excluir post' });
    }
});

// No backend — rota GET /api/rh/funcionarios
router.get('/rh/funcionarios', async (req, res) => {
    try {
        const q = norm(req.query && req.query.q ? String(req.query.q) : '');
        const todos = await db.funcionarios.getAll();

        // Sem q → retorna todos (para o dashboard)
        if (!q || q.length < 2) {
            return res.json(
                (Array.isArray(todos) ? todos : []).filter(f => f && f.ativo !== 0 && f.status !== 'Inativo')
            );
        }

        // Com q → filtra por busca (para o trabalheConosco)
        const filtrados = (Array.isArray(todos) ? todos : [])
            .filter(f => {
                if (!f) return false;
                if (f.ativo === 0 || f.status === 'Inativo') return false;
                const nomeNorm  = norm(f.nome  || '');
                const setorNorm = norm(f.setor || '');
                const cargoNorm = norm(f.cargo || '');
                return nomeNorm.includes(q) || setorNorm.includes(q) || cargoNorm.includes(q);
            })
            .slice(0, 10)
            .map(f => ({ id: f.id, nome: f.nome || '', setor: f.setor || '', cargo: f.cargo || '' }));

        res.json(filtrados);
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao buscar colaboradores' });
    }
});



    return router;
};
