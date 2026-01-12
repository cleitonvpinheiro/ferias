const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
require('dotenv').config();
const { SECRET, verifyToken } = require('../middleware/auth');
const ldapService = require('../services/ldapService');
const db = require('../services/db');

router.get('/me', verifyToken, (req, res) => {
    res.json({ ok: true, user: req.user });
});

router.post('/login', async (req, res) => {
    const { username, password } = req.body;

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
    const rhUser = process.env.RH_USER || (process.env.NODE_ENV !== 'production' ? 'rh' : null);
    const rhPass = process.env.RH_PASS || (process.env.NODE_ENV !== 'production' ? 'rh' : null);
    const portariaUser = process.env.PORTARIA_USER || (process.env.NODE_ENV !== 'production' ? 'portaria' : null);
    const portariaPass = process.env.PORTARIA_PASS || (process.env.NODE_ENV !== 'production' ? 'portaria' : null);

    if (rhUser && rhPass && username === rhUser && password === rhPass) {
        // Upgrade legacy RH to rh_geral role
        const token = jwt.sign({ username, role: 'rh_geral' }, SECRET, { expiresIn: '8h' });
        res.cookie('token', token, { 
            httpOnly: true, 
            secure: process.env.NODE_ENV === 'production', 
            maxAge: 8 * 60 * 60 * 1000 
        });
        return res.json({ ok: true, redirect: '/protected/index.html' });
    }

    if (portariaUser && portariaPass && username === portariaUser && password === portariaPass) {
        const token = jwt.sign({ username, role: 'portaria' }, SECRET, { expiresIn: '8h' });
        res.cookie('token', token, { 
            httpOnly: true, 
            secure: process.env.NODE_ENV === 'production',
            maxAge: 8 * 60 * 60 * 1000
        });
        return res.json({ ok: true, redirect: '/protected/dashboard-portaria.html' }); 
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
                const newUser = {
                    username,
                    password: crypto.randomBytes(16).toString('hex'), // Random password, auth is via LDAP
                    role: 'rh_geral', // Default role for new users
                    name: ldapResult.user.name || username
                };
                await db.users.create(newUser);
                user = newUser;
            }

            const token = jwt.sign({ username: user.username, role: user.role, name: user.name }, SECRET, { expiresIn: '8h' });
            
            res.cookie('token', token, { 
                httpOnly: true, 
                secure: process.env.NODE_ENV === 'production',
                maxAge: 8 * 60 * 60 * 1000
            });

            // Redirect based on role
            let redirect = '/protected/index.html';
            if (user.role === 'portaria') redirect = '/protected/dashboard-portaria.html';

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
