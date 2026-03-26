const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
const { SECRET, verifyToken, PUBLIC_PAGE_ACCESS, PROTECTED_PAGE_ACCESS, ROLES } = require('../middleware/auth');
const ldapService = require('../services/ldapService');
const db = require('../services/db');

router.get('/me', verifyToken, (req, res) => {
    res.json({ ok: true, user: req.user });
});

router.get('/access', verifyToken, (req, res) => {
    const role = req.user && req.user.role;
    const allowAll = process.env.SHOW_ALL_DASH === '1';
    const publicPaths = allowAll
        ? Object.keys(PUBLIC_PAGE_ACCESS)
        : Object.entries(PUBLIC_PAGE_ACCESS)
            .filter(([, roles]) => role === 'admin' || roles.includes(role))
            .map(([path]) => path);
    const protectedPaths = allowAll
        ? Object.keys(PROTECTED_PAGE_ACCESS).map(p => `/protected${p}`)
        : Object.entries(PROTECTED_PAGE_ACCESS)
            .filter(([, roles]) => role === 'admin' || roles.includes(role))
            .map(([path]) => `/protected${path}`);

    res.json({
        ok: true,
        user: req.user,
        access: { publicPaths, protectedPaths, allowAll }
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

    // 0. Check Database Users (Priority)
    try {
        const user = await db.users.getByUsername(username);
        if (user) {
            const match = await bcrypt.compare(password, user.password);
            if (match) {
                const token = jwt.sign({ username: user.username, role: user.role, name: user.name }, SECRET, { expiresIn: '8h' });
                
                res.cookie('token', token, { 
                    httpOnly: true, 
                    secure: process.env.NODE_ENV === 'production', 
                    sameSite: 'lax',
                    maxAge: 8 * 60 * 60 * 1000 
                });

                // Redirect based on role
                let redirect = '/protected/index.html';
                if (user.role === 'portaria') redirect = '/protected/dashboard-portaria.html';
                
                return res.json({ ok: true, redirect });
            }
        }
    } catch (err) {
        console.error('Login DB Error:', err);
    }

    // 1. Check Local Admin/System Accounts (Legacy)
    const isDevLoginEnabled = process.env.NODE_ENV !== 'production';

    const rhAccounts = [];
    if (process.env.RH_USER && process.env.RH_PASS) {
        rhAccounts.push({ username: String(process.env.RH_USER).trim().toLowerCase(), password: String(process.env.RH_PASS), role: ROLES.RH_GERAL, redirect: '/protected/index.html' });
    }
    if (isDevLoginEnabled) {
        rhAccounts.push({ username: 'rh', password: 'rh', role: ROLES.RH_GERAL, redirect: '/protected/index.html' });
    }

    const portariaAccounts = [];
    if (process.env.PORTARIA_USER && process.env.PORTARIA_PASS) {
        portariaAccounts.push({ username: String(process.env.PORTARIA_USER).trim().toLowerCase(), password: String(process.env.PORTARIA_PASS), role: ROLES.PORTARIA, redirect: '/protected/dashboard-portaria.html' });
    }
    if (isDevLoginEnabled) {
        portariaAccounts.push({ username: 'portaria', password: 'portaria', role: ROLES.PORTARIA, redirect: '/protected/dashboard-portaria.html' });
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

            const token = jwt.sign({ username: user.username, role: user.role, name: user.name }, SECRET, { expiresIn: '8h' });
            
            res.cookie('token', token, { 
                httpOnly: true, 
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 8 * 60 * 60 * 1000
            });

            // Redirect based on role
            let redirect = '/protected/index.html';
            if (user.role === 'portaria') redirect = '/protected/dashboard-portaria.html';
            if (user.role === ROLES.PENDENTE) redirect = '/login.html?error=pendente';

            return res.json({ ok: true, redirect });
        }
    }

    res.status(401).json({ ok: false, erro: 'Credenciais inválidas' });
});

router.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ ok: true, redirect: '/login.html' });
});

module.exports = router;
