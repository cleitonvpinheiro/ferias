const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
require('dotenv').config(); // Mantenha para JWT_SECRET e outras variáveis de ambiente

// --- Remova estas linhas ---
// --- Fim da remoção ---

const ldapService = require('../services/ldapService'); // ldapService não depende de db/auth diretamente, pode ficar aqui
const path = require('path');
const fs = require('fs');

// O módulo auth.js agora exporta uma função que recebe 'db' e 'auth'
module.exports = (db, auth) => { // <--- AQUI! 'db' e 'auth' são injetados

    // Desestruture as variáveis de 'auth' que você precisa
    const { SECRET, verifyToken, PUBLIC_PAGE_ACCESS, PROTECTED_PAGE_ACCESS, ROLES } = auth;

    router.get('/me', verifyToken, async (req, res) => {
        try {
            const normRole = (v) => String(v || '').trim().toLowerCase();
            const username = req.user && req.user.username;
            const dbUser = username ? await db.users.getByUsername(username) : null;
            const user = dbUser
                ? { username: dbUser.username, role: normRole(dbUser.role), name: dbUser.name, email: dbUser.email || null }
                : req.user;
            res.json({ ok: true, user });
        } catch (e) {
            res.json({ ok: true, user: req.user });
        }
    });

    router.get('/me/foto', verifyToken, async (req, res) => {
        try {
            const username = req.user && req.user.username ? String(req.user.username).trim().toLowerCase() : '';
            const dbUser = username ? await db.users.getByUsername(username) : null;
            const effectiveName = String((dbUser && (dbUser.name || dbUser.username)) || (req.user && (req.user.name || req.user.username)) || '').trim();
            if (!effectiveName) return res.status(404).send('Not found');

            const norm = (v) => String(v || '')
                .trim()
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '');

            const allFuncs = await db.funcionarios.getAll();
            const key = norm(effectiveName);
            const funcs = Array.isArray(allFuncs) ? allFuncs : [];
            let matches = funcs.filter(f => norm(f && f.nome) === key);
            if (matches.length === 0) {
                matches = funcs.filter(f => {
                    const n = norm(f && f.nome);
                    return n && (n.includes(key) || key.includes(n));
                });
            }
            const chosen = matches.find(f => f && f.foto) || matches[0];
            if (!chosen || !chosen.foto) return res.status(404).send('Not found');

            const foto = String(chosen.foto || '').trim();
            const safe = path.basename(foto);
            if (!safe || safe !== foto) return res.status(404).send('Not found');
            if (!/^[a-zA-Z0-9.\-_]+$/.test(safe)) return res.status(404).send('Not found');

            const filePath = path.join(__dirname, '..', 'uploads', safe);
            if (!fs.existsSync(filePath)) return res.status(404).send('Not found');
            res.setHeader('Cache-Control', 'no-store');
            return res.sendFile(filePath);
        } catch (_) {
            return res.status(404).send('Not found');
        }
    });

    router.put('/me/password', verifyToken, async (req, res) => {
        try {
            const username = req.user && req.user.username ? String(req.user.username).trim().toLowerCase() : '';
            if (!username) return res.status(401).json({ ok: false, erro: 'Usuário não autenticado' });

            const currentPassword = req.body && typeof req.body.currentPassword === 'string' ? req.body.currentPassword : '';
            const newPassword = req.body && typeof req.body.newPassword === 'string' ? req.body.newPassword : '';

            if (!currentPassword || !newPassword) {
                return res.status(400).json({ ok: false, erro: 'Informe a senha atual e a nova senha' });
            }
            if (newPassword.length < 6) {
                return res.status(400).json({ ok: false, erro: 'A nova senha deve ter ao menos 6 caracteres' });
            }

            const user = await db.users.getByUsername(username);
            if (!user || !user.password) {
                return res.status(400).json({ ok: false, erro: 'Usuário inválido para alteração de senha' });
            }

            const match = await bcrypt.compare(currentPassword, user.password);
            if (!match) return res.status(403).json({ ok: false, erro: 'Senha atual incorreta' });

            const hash = await bcrypt.hash(newPassword, 10);
            await db.users.update(username, { password: hash });

            res.json({ ok: true });
        } catch (e) {
            console.error(e);
            res.status(500).json({ ok: false, erro: 'Erro ao alterar senha' });
        }
    });

    router.get('/access', verifyToken, async (req, res) => {
        let effectiveUser = req.user;
        const normRole = (v) => String(v || '').trim().toLowerCase();
        try {
            const username = req.user && req.user.username;
            const dbUser = username ? await db.users.getByUsername(username) : null;
            if (dbUser) {
                effectiveUser = {
                    username: dbUser.username,
                    role: normRole(dbUser.role),
                    name: dbUser.name,
                    email: dbUser.email || null,
                    blocked_paths: dbUser.blocked_paths ? JSON.parse(dbUser.blocked_paths) : []
                };
            }
        } catch (_) { }
        const role = effectiveUser && effectiveUser.role;
        const blocked = Array.isArray(effectiveUser && effectiveUser.blocked_paths) ? effectiveUser.blocked_paths : [];
        const isBlocked = (p) => blocked.includes(p);

        const allowAll = process.env.SHOW_ALL_DASH === '1';
        let publicPaths = allowAll
            ? Object.keys(PUBLIC_PAGE_ACCESS)
            : Object.entries(PUBLIC_PAGE_ACCESS)
                .filter(([path, roles]) => (role === 'admin' || roles.includes(role)) && !isBlocked(path))
                .map(([path]) => path);
        const protectedPaths = allowAll
            ? Object.keys(PROTECTED_PAGE_ACCESS).map(p => `/protected${p}`)
            : Object.entries(PROTECTED_PAGE_ACCESS)
                .filter(([path, roles]) => (role === 'admin' || roles.includes(role)) && !isBlocked(`/protected${path}`))
                .map(([path]) => `/protected${path}`);

        const roleNorm = normRole(role);
        const isGestor = [ROLES.GESTOR, ROLES.LIDER, ROLES.SUPERVISOR, ROLES.GERENTE].includes(roleNorm);
        let dynamicForms = [];

        try {
            const allForms = await db.formularios.getAll();
            dynamicForms = allForms.filter(f => {
                if (!f.ativo) return false;
                if (f.publico) return true;
                if (role === 'admin') return true;
                const allowed = Array.isArray(f.allowed_roles) ? f.allowed_roles.map(normRole) : [];
                return allowed.includes(roleNorm) && !isBlocked(`/responder-formulario.html?id=${f.id}`);
            }).map(f => ({
                id: f.id,
                titulo: f.titulo,
                tipo: f.tipo,
                href: `/responder-formulario.html?id=${f.id}`


            }));
        } catch (e) {
            console.error('Erro ao buscar formulários dinâmicos para acesso:', e);
        }

        const normalize = (v) => String(v || '')
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');

        if (isGestor && !allowAll) {
            const pset = new Set(protectedPaths);
            const allow = new Set();
            const username = effectiveUser && effectiveUser.username ? String(effectiveUser.username).trim().toLowerCase() : '';
            function inferTipoAvaliacaoFromFuncionario({ cargo, setor }) {
                // usa "norm" que já existe no backend, não "normalizeFuncionarioKey"
                const hay = `${normalize(cargo)} ${normalize(setor)}`.trim();
                if (/(gerent|supervis|coorden|lider|encarreg)/.test(hay)) return 'lideranca';
                if (/(^|\s)cozinha(\s|$)|\bbar\b/.test(hay)) return 'operacional';
                if (/(eventos h|eventos e espaco kids|recepcao|recepcion|salao|equipe[\s-]*(1|2|3)\b|atendimento|atendente|call.?center|sac|helpdesk|teleatendimento|balcao|caixa|balconista)/.test(hay)) return 'atendimento';
                if (/(adm|administr|\brh\b|\bdp\b|financ|contab|compras|\bti\b|fiscal|jurid|almox|aprendiz|eventos|comercial|qualidade|\bpcp\b|processos|controlador|controladoria)/.test(hay)) return 'adm';

                return 'operacional';
            }

            if (pset.has('/protected/dashboard-rh.html')) {
                allow.add('/ferias.html');
            }
            if (pset.has('/protected/dashboard-taxas.html') || pset.has('/protected/dashboard-solicitacoes-taxa.html')) {
                allow.add('/taxas.html');
                allow.add('/solicitacao-taxa.html');
            }
            if (pset.has('/protected/dashboard-vagas.html') || pset.has('/protected/dashboard-recrutamento.html') || pset.has('/protected/dashboard-candidatos.html')) {
                allow.add('/vagas.html');
                allow.add('/recrutamentoInterno.html');
                allow.add('/trabalheConosco.html');
            }
            if (pset.has('/protected/dashboard-onthejob.html')) {
                allow.add('/onTheJob.html');
            }
            if (pset.has('/protected/dashboard-avaliacao.html')) {
                try {
                    const equipe = username ? await db.gestorEquipes.getEquipeByGestor(username) : [];

                    // estava: .map(inferAvaliacaoTipo)  ← função inexistente
                    const tipos = new Set((Array.isArray(equipe) ? equipe : []).map(f =>
                        inferTipoAvaliacaoFromFuncionario({ cargo: f.cargo, setor: f.setor })
                    ));

                    if (tipos.has('lideranca') && !isBlocked('/avaliacao-lideranca.html')) allow.add('/avaliacao-lideranca.html');
                    if (tipos.has('adm') && !isBlocked('/avaliacao-adm.html')) allow.add('/avaliacao-adm.html');
                    if (tipos.has('atendimento') && !isBlocked('/avaliacao-atendimento.html')) allow.add('/avaliacao-atendimento.html'); // ← faltava
                    if (tipos.has('operacional') && !isBlocked('/avaliacao-operacional.html')) allow.add('/avaliacao-operacional.html');
                } catch (_) { }
            }
            if (pset.has('/protected/dashboard-experiencia.html')) {
                allow.add('/form-avaliacao-experiencia.html');
            }

            publicPaths = publicPaths.filter(p => allow.has(p));
        }

        if ((role === 'admin' || [ROLES.ADMIN, ROLES.RH, ROLES.RH_GERAL, ROLES.DP].includes(role)) && !protectedPaths.includes('/protected/dashboard-disciplinar.html')) {
            protectedPaths.push('/protected/dashboard-disciplinar.html');
        }

        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.json({
            ok: true,
            user: effectiveUser,
            access: { publicPaths, protectedPaths, allowAll, dynamicForms }
        });
    });

    const loginLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 30,
        standardHeaders: true,
        legacyHeaders: false,
        message: { ok: false, erro: 'Muitas tentativas de login. Tente novamente mais tarde.' }
    });

    router.post('/login', loginLimiter, async (req, res) => {
        const rawUsername = req.body && typeof req.body.username === 'string' ? req.body.username : '';
        const rawPassword = req.body && typeof req.body.password === 'string' ? req.body.password : '';
        const username = rawUsername.trim().toLowerCase();
        const password = rawPassword;

        if (!username || !password) {
            return res.status(400).json({ ok: false, erro: 'Dados de login inválidos' });
        }

        const loginSuccess = async (user, redirect) => {
            const sessionId = crypto.randomUUID();
            const refreshToken = crypto.randomBytes(64).toString('hex');
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 7); // Refresh token válido por 7 dias

            await db.sessionTokens.create(sessionId, user.id || user.username, refreshToken, expiresAt);

            const token = jwt.sign({
                username: user.username,
                role: user.role,
                name: user.name,
                email: user.email || null,
                sessionId
            }, SECRET, { expiresIn: '1h' }); // Access token curto: 1 hora

            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 1 * 60 * 60 * 1000
            });

            res.cookie('refreshToken', refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 7 * 24 * 60 * 60 * 1000
            });

            res.cookie('sessionId', sessionId, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 7 * 24 * 60 * 60 * 1000
            });

            // Auditoria
            await db.auditLogs.log({
                user_id: user.id || user.username,
                username: user.username,
                action: 'login',
                resource: 'auth',
                ip_address: req.ip,
                user_agent: req.headers['user-agent']
            });

            return res.json({ ok: true, redirect });
        };

        // 0. Check Database Users (Priority)
        try {
            const user = await db.users.getByUsername(username);
            if (user) {
                if (Number(user.ativo) === 0) {
                    return res.status(403).json({ ok: false, erro: 'Usuário inativo. Procure o administrador do sistema.' });
                }
                const match = await bcrypt.compare(password, user.password);
                if (match) {
                    let redirect = '/protected/dashboard-gestor.html';
                    if (user.role === 'portaria') redirect = '/protected/dashboard-portaria.html?monitor=1';
                    const normRole = String(user.role || '').trim().toLowerCase();
                    if (['gestor', 'supervisor', 'gerente'].includes(normRole)) redirect = '/protected/dashboard-gestor.html';

                    return await loginSuccess(user, redirect);
                }
            }
        } catch (err) {
            console.error('Login DB Error:', err);
        }

        // 1. Check Local Admin/System Accounts (Legacy)
        const isDevLoginEnabled = process.env.NODE_ENV !== 'production';

        const rhAccounts = [];
        if (process.env.RH_USER && process.env.RH_PASS) {
            rhAccounts.push({ username: String(process.env.RH_USER).trim().toLowerCase(), password: String(process.env.RH_PASS), role: ROLES.RH_GERAL, redirect: '/protected/dashboard-gestor.html' });
        }
        if (isDevLoginEnabled) {
            rhAccounts.push({ username: 'rh', password: 'rh', role: ROLES.RH_GERAL, redirect: '/protected/index.html' });
        }

        const portariaAccounts = [];
        if (process.env.PORTARIA_USER && process.env.PORTARIA_PASS) {
            portariaAccounts.push({ username: String(process.env.PORTARIA_USER).trim().toLowerCase(), password: String(process.env.PORTARIA_PASS), role: ROLES.PORTARIA, redirect: '/protected/dashboard-portaria.html?monitor=1' });
        }
        if (isDevLoginEnabled) {
            portariaAccounts.push({ username: 'portaria', password: 'portaria', role: ROLES.PORTARIA, redirect: '/protected/dashboard-portaria.html?monitor=1' });
        }

        const matchedLegacy = [...rhAccounts, ...portariaAccounts].find(a => username === a.username && password === a.password);
        if (matchedLegacy) {
            const token = jwt.sign({ username, role: matchedLegacy.role }, SECRET, { expiresIn: '8h' });
            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 8 * 60 * 60 * 1000
            });
            return res.json({ ok: true, redirect: matchedLegacy.redirect });
        }

        // 2. Try LDAP
        if (process.env.LDAP_URL) {
            const ldapResult = await ldapService.authenticate(username, password);
            if (ldapResult.success) {
                // Check if user exists in DB to get their role
                let user = await db.users.getByUsername(username);

                if (!user) {
                    // JIT Provisioning: Create user in DB on first login
                    console.log(`JIT Provisioning for LDAP user: ${username}`);
                    const randomPassword = crypto.randomBytes(32).toString('hex');
                    const passwordHash = await bcrypt.hash(randomPassword, 10);
                    const newUser = {
                        username,
                        password: passwordHash,
                        role: ROLES.PENDENTE,
                        name: ldapResult.user.name || username
                    };
                    await db.users.create(newUser);
                    user = newUser;
                }

                const token = jwt.sign({ username: user.username, role: user.role, name: user.name, email: user.email || null }, SECRET, { expiresIn: '8h' });

                res.cookie('token', token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'lax',
                    maxAge: 8 * 60 * 60 * 1000
                });

                // Redirect based on role
                let redirect = '/protected/dashboard-gestor.html';
                if (user.role === 'portaria') redirect = '/protected/dashboard-portaria.html?monitor=1';
                const normRole = String(user.role || '').trim().toLowerCase();
                if (['gestor', 'lider', 'supervisor', 'gerente'].includes(normRole)) redirect = '/protected/dashboard-gestor.html';
                if (user.role === ROLES.PENDENTE) redirect = '/login.html?error=pendente';

                return res.json({ ok: true, redirect });
            }
        }

        res.status(401).json({ ok: false, erro: 'Credenciais inválidas' });
    });

    router.post('/refresh-token', async (req, res) => {
        try {
            const { refreshToken, sessionId } = req.cookies;
            if (!refreshToken || !sessionId) return res.status(401).json({ ok: false, erro: 'Sessão inválida' });

            const session = await db.sessionTokens.getValid(sessionId);
            if (!session || session.refresh_token !== refreshToken) {
                return res.status(401).json({ ok: false, erro: 'Token inválido ou expirado' });
            }

            const user = await db.users.getByUsername(session.user_id) || { username: session.user_id };

            // Rotação de Refresh Token
            const newRefreshToken = crypto.randomBytes(64).toString('hex');
            await run('UPDATE session_tokens SET refresh_token = ? WHERE id = ?', [newRefreshToken, sessionId]);

            const newToken = jwt.sign({
                username: user.username,
                role: user.role,
                name: user.name,
                email: user.email || null,
                sessionId
            }, SECRET, { expiresIn: '1h' });

            res.cookie('token', newToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 1 * 60 * 60 * 1000
            });

            res.cookie('refreshToken', newRefreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 7 * 24 * 60 * 60 * 1000
            });

            res.json({ ok: true });
        } catch (e) {
            console.error('Refresh Token Error:', e);
            res.status(500).json({ ok: false, erro: 'Erro interno' });
        }
    });

    router.post('/logout', verifyToken, async (req, res) => {
        const { sessionId } = req.cookies;
        if (sessionId) await db.sessionTokens.revoke(sessionId);

        res.clearCookie('token');
        res.clearCookie('refreshToken');
        res.clearCookie('sessionId');
        res.json({ ok: true, redirect: '/login.html' });
    });

    return router; // Retorna o router configurado
};
