const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const ldapService = require('../services/ldapService');
const fs = require('fs');

// #region debug-point A:ldap-import-route
const __dbgUsers = (hypothesisId, msg, data = {}) => {
    try {
        const envRaw = fs.readFileSync('/home/administrador/projetos-nodejs/portal-formularios/.dbg/ldap-import-refused.env', 'utf8');
        const url = envRaw.match(/DEBUG_SERVER_URL=(.+)/)?.[1] || 'http://127.0.0.1:7777/event';
        const sessionId = envRaw.match(/DEBUG_SESSION_ID=(.+)/)?.[1] || 'ldap-import-refused';
        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId,
                runId: 'pre-fix',
                hypothesisId,
                location: 'routes/users.js',
                msg: `[DEBUG] ${msg}`,
                data,
                ts: Date.now()
            })
        }).catch(() => {});
    } catch (_) {}
};
// #endregion

// Middleware: Only Admin and RH Geral can manage users

// GET /users - List all users

module.exports = (db, auth) => {
    const { verifyToken, checkRole, ROLES, getProtectedPages, getEffectiveProtectedPathsForRole, reloadRolePermissions, auditLog } = auth;
    const userManageAuth = [verifyToken, checkRole([ROLES.ADMIN, ROLES.RH_GERAL, ROLES.RH])];
    const rolePermAuth = [verifyToken, checkRole([ROLES.ADMIN, ROLES.RH_GERAL])];

router.get('/users', userManageAuth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        
        const result = await db.users.listPaginated({ page, limit, search });
        res.json(result);
    } catch (e) {
        console.error('Erro ao listar usuários:', e);
        res.status(500).json({ ok: false, erro: 'Erro ao listar usuários' });
    }
});

// POST /users - Create new user
router.post('/users', [userManageAuth, auditLog('CREATE', 'user')], async (req, res) => {
    try {
        const { username, password, role, name, email, blocked_paths, ativo } = req.body;
        
        if (!username || !password || !role) {
            return res.status(400).json({ ok: false, erro: 'Campos obrigatórios ausentes' });
        }

        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ ok: false, erro: 'Formato de e-mail inválido' });
        }

        if (password.length < 6) {
            return res.status(400).json({ ok: false, erro: 'A senha deve ter ao menos 6 caracteres' });
        }

        // Check if exists
        const existing = await db.users.getByUsername(username);
        if (existing) {
            return res.status(400).json({ ok: false, erro: 'Usuário já existe' });
        }

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        await db.users.create({
            username: String(username).trim().toLowerCase(),
            password: hash,
            role,
            name: name || username,
            email: email || null,
            blocked_paths: blocked_paths || null,
            ativo: Object.prototype.hasOwnProperty.call(req.body || {}, 'ativo') ? !!ativo : true
        });

        res.json({ ok: true });
    } catch (e) {
        console.error('Erro ao criar usuário:', e);
        res.status(500).json({ ok: false, erro: 'Erro ao criar usuário' });
    }
});

// PUT /users/:username - Update user
router.put('/users/:username', [userManageAuth, auditLog('UPDATE', 'user')], async (req, res) => {
    try {
        const { username } = req.params;
        const { password, role, name, email, blocked_paths, ativo } = req.body;
        
        if (username === 'admin' && role && role !== 'admin') {
            return res.status(403).json({ ok: false, erro: 'Não é possível alterar o perfil do admin principal' });
        }

        const existing = await db.users.getByUsername(username);
        if (!existing) {
            return res.status(404).json({ ok: false, erro: 'Usuário não encontrado' });
        }

        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ ok: false, erro: 'Formato de e-mail inválido' });
        }

        const updates = {};
        if (password) {
            if (password.length < 6) {
                return res.status(400).json({ ok: false, erro: 'A senha deve ter ao menos 6 caracteres' });
            }
            const salt = await bcrypt.genSalt(10);
            updates.password = await bcrypt.hash(password, salt);
        }
        if (role) updates.role = role;
        if (name) updates.name = name;
        if (Object.prototype.hasOwnProperty.call(req.body || {}, 'email')) updates.email = email;
        if (Object.prototype.hasOwnProperty.call(req.body || {}, 'blocked_paths')) updates.blocked_paths = blocked_paths;
        if (Object.prototype.hasOwnProperty.call(req.body || {}, 'ativo')) updates.ativo = !!ativo;
        
        await db.users.update(username, updates);
        
        res.json({ ok: true });
    } catch (e) {
        console.error('Erro ao atualizar usuário:', e);
        res.status(500).json({ ok: false, erro: 'Erro ao atualizar usuário' });
    }
});

router.put('/users/:username/ativo', [userManageAuth, auditLog('UPDATE', 'user_status')], async (req, res) => {
    try {
        const { username } = req.params;
        const ativo = !!(req.body && req.body.ativo);
        if (String(username).trim().toLowerCase() === 'admin' && !ativo) {
            return res.status(403).json({ ok: false, erro: 'Não é possível inativar o admin principal' });
        }

        const existing = await db.users.getByUsername(username);
        if (!existing) {
            return res.status(404).json({ ok: false, erro: 'Usuário não encontrado' });
        }

        await db.users.setAtivo(username, ativo);
        return res.json({ ok: true, username, ativo });
    } catch (e) {
        console.error('Erro ao atualizar status do usuário:', e);
        return res.status(500).json({ ok: false, erro: 'Erro ao atualizar status do usuário' });
    }
});

// DELETE /users/:username - Delete user
router.delete('/users/:username', [userManageAuth, auditLog('DELETE', 'user')], async (req, res) => {
    try {
        const { username } = req.params;
        if (username === 'admin') {
            return res.status(403).json({ ok: false, erro: 'Não é possível remover o admin principal' });
        }
        
        await db.users.delete(username);
        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao remover usuário' });
    }
});

router.get('/roles/protected-pages', rolePermAuth, async (req, res) => {
    res.json({ ok: true, pages: getProtectedPages() });
});

router.get('/roles/permissions/:role', rolePermAuth, async (req, res) => {
    const role = String(req.params.role || '').trim().toLowerCase();
    res.json({ ok: true, role, protectedPaths: getEffectiveProtectedPathsForRole(role) });
});

router.put('/roles/permissions/:role', rolePermAuth, async (req, res) => {
    try {
        const role = String(req.params.role || '').trim().toLowerCase();
        if (!role) return res.status(400).json({ ok: false, erro: 'Perfil inválido' });
        if (role === ROLES.ADMIN) return res.status(403).json({ ok: false, erro: 'Não é permitido alterar permissões do admin' });
        if (role === ROLES.PENDENTE) return res.status(403).json({ ok: false, erro: 'Não é permitido alterar permissões do perfil pendente' });

        const protectedPaths = Array.isArray(req.body && req.body.protectedPaths) ? req.body.protectedPaths : [];
        const allowedPages = new Set(getProtectedPages());
        const sanitized = Array.from(new Set(protectedPaths.filter(p => allowedPages.has(p)))).sort((a, b) => a.localeCompare(b));

        await db.rolePermissions.upsert({ role, protected_paths: sanitized });
        await reloadRolePermissions();

        res.json({ ok: true, role, protectedPaths: sanitized });
    } catch (e) {
        console.error('Erro ao salvar permissões:', e);
        res.status(500).json({ ok: false, erro: 'Erro ao salvar permissões' });
    }
});

// POST /users/import-ldap - Bulk import from LDAP
router.post('/users/import-ldap', userManageAuth, async (req, res) => {
    try {
        // #region debug-point A:ldap-import-entry
        __dbgUsers('A', 'import route entered', {
            username: req.user && req.user.username,
            role: req.user && req.user.role,
            hasLdapUrl: !!process.env.LDAP_URL
        });
        // #endregion
        if (!process.env.LDAP_URL) {
            return res.status(400).json({ ok: false, erro: 'LDAP não configurado (LDAP_URL)' });
        }

        // #region debug-point B:before-search
        __dbgUsers('B', 'calling ldapService.searchUsers', { query: '*' });
        // #endregion
        const users = await ldapService.searchUsers('*');
        // #region debug-point B:after-search
        __dbgUsers('B', 'ldapService.searchUsers resolved', { count: Array.isArray(users) ? users.length : -1 });
        // #endregion
        let importedCount = 0;
        let updatedCount = 0;
        const errors = [];

        const randomPassword = crypto.randomBytes(32).toString('hex');
        const passwordHash = await bcrypt.hash(randomPassword, 10);

        const safeUsers = Array.isArray(users) ? users : [];
        const firstVal = (v) => Array.isArray(v) ? v[0] : v;
        for (const u of safeUsers) {
            if (!u || typeof u !== 'object') continue;
            const rawUser =
                firstVal(u.sAMAccountName) ||
                firstVal(u.samaccountname) ||
                firstVal(u.userPrincipalName) ||
                firstVal(u.userprincipalname) ||
                firstVal(u.uid) ||
                firstVal(u.cn) ||
                '';
            const username = String(rawUser || '').trim().toLowerCase().split('@')[0];
            if (!username) continue;

            try {
                const exists = await db.users.getByUsername(username);
                const ldapName = firstVal(u.displayName) || firstVal(u.displayname) || firstVal(u.cn) || username;
                const ldapEmail = firstVal(u.mail) || firstVal(u.email) || null;

                if (!exists) {
                    await db.users.create({
                        username,
                        password: passwordHash,
                        role: 'rh_geral', // Default role
                        name: ldapName,
                        email: ldapEmail
                    });
                    importedCount++;
                } else {
                    const updates = {
                        password: passwordHash,
                        name: ldapName,
                        email: ldapEmail
                    };
                    await db.users.update(username, updates);
                    updatedCount++;
                }
            } catch (err) {
                console.error(`Failed to import ${username}:`, err);
                errors.push(username);
            }
        }

        // #region debug-point C:import-success
        __dbgUsers('C', 'import route success', {
            importedCount,
            updatedCount,
            errorsCount: errors.length,
            totalFound: Array.isArray(users) ? users.length : -1
        });
        // #endregion
        res.json({ ok: true, imported: importedCount, updated: updatedCount, totalFound: safeUsers.length, errors });
    } catch (e) {
        // #region debug-point D:import-error
        __dbgUsers('D', 'import route error', {
            message: e && e.message,
            code: e && e.code,
            stackTop: e && e.stack ? String(e.stack).split('\n').slice(0, 3).join(' | ') : null
        });
        // #endregion
        console.error('LDAP Import Error:', e);
        res.status(500).json({ ok: false, erro: 'Erro ao importar do LDAP: ' + e.message });
    }
});


    return router;
};
