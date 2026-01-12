const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../services/db');
const ldapService = require('../services/ldapService');
const { verifyToken, checkRole, ROLES } = require('../middleware/auth');

// Middleware: Only Admin and RH Geral can manage users
const userManageAuth = [verifyToken, checkRole([ROLES.ADMIN, ROLES.RH_GERAL, ROLES.RH])];

// GET /users - List all users
router.get('/users', userManageAuth, async (req, res) => {
    try {
        const users = await db.users.getAll();
        res.json(users);
    } catch (e) {
        console.error('Erro ao listar usuários:', e);
        res.status(500).json({ ok: false, erro: 'Erro ao listar usuários' });
    }
});

// POST /users - Create new user
router.post('/users', userManageAuth, async (req, res) => {
    try {
        const { username, password, role, name } = req.body;
        
        if (!username || !password || !role) {
            return res.status(400).json({ ok: false, erro: 'Campos obrigatórios ausentes' });
        }

        // Check if exists
        const existing = await db.users.getByUsername(username);
        if (existing) {
            return res.status(400).json({ ok: false, erro: 'Usuário já existe' });
        }

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        await db.users.create({
            username,
            password: hash,
            role,
            name: name || username
        });

        res.json({ ok: true });
    } catch (e) {
        console.error('Erro ao criar usuário:', e);
        res.status(500).json({ ok: false, erro: 'Erro ao criar usuário' });
    }
});

// PUT /users/:username - Update user
router.put('/users/:username', userManageAuth, async (req, res) => {
    try {
        const { username } = req.params;
        const { password, role, name } = req.body;
        
        const existing = await db.users.getByUsername(username);
        if (!existing) {
            return res.status(404).json({ ok: false, erro: 'Usuário não encontrado' });
        }

        const updates = {};
        if (password) {
            const salt = await bcrypt.genSalt(10);
            updates.password = await bcrypt.hash(password, salt);
        }
        if (role) updates.role = role;
        if (name) updates.name = name;
        
        await db.users.update(username, updates);
        
        res.json({ ok: true });
    } catch (e) {
        console.error('Erro ao atualizar usuário:', e);
        res.status(500).json({ ok: false, erro: 'Erro ao atualizar usuário' });
    }
});

// DELETE /users/:username - Delete user
router.delete('/users/:username', userManageAuth, async (req, res) => {
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

// POST /users/import-ldap - Bulk import from LDAP
router.post('/users/import-ldap', userManageAuth, async (req, res) => {
    try {
        if (!process.env.LDAP_URL) {
            return res.status(400).json({ ok: false, erro: 'LDAP não configurado (LDAP_URL)' });
        }

        const users = await ldapService.searchUsers('*');
        let importedCount = 0;
        const errors = [];

        for (const u of users) {
            const username = u.uid || u.sAMAccountName || u.cn;
            if (!username) continue;

            try {
                const exists = await db.users.getByUsername(username);
                if (!exists) {
                    await db.users.create({
                        username,
                        password: crypto.randomBytes(16).toString('hex'), // Random pass
                        role: 'rh_geral', // Default role
                        name: u.displayName || u.cn || username
                    });
                    importedCount++;
                }
            } catch (err) {
                console.error(`Failed to import ${username}:`, err);
                errors.push(username);
            }
        }

        res.json({ ok: true, imported: importedCount, totalFound: users.length, errors });
    } catch (e) {
        console.error('LDAP Import Error:', e);
        res.status(500).json({ ok: false, erro: 'Erro ao importar do LDAP: ' + e.message });
    }
});

module.exports = router;
