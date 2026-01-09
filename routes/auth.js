const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { SECRET } = require('../middleware/auth');
const ldapService = require('../services/ldapService');

router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    const rhUser = process.env.RH_USER || (process.env.NODE_ENV !== 'production' ? 'rh' : null);
    const rhPass = process.env.RH_PASS || (process.env.NODE_ENV !== 'production' ? 'rh' : null);
    const portariaUser = process.env.PORTARIA_USER || (process.env.NODE_ENV !== 'production' ? 'portaria' : null);
    const portariaPass = process.env.PORTARIA_PASS || (process.env.NODE_ENV !== 'production' ? 'portaria' : null);

    // 1. Check Local Admin/System Accounts
    if (rhUser && rhPass && username === rhUser && password === rhPass) {
        const token = jwt.sign({ username, role: 'rh' }, SECRET, { expiresIn: '8h' });
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
            // Default LDAP role to 'rh' for now (or configurable)
            // In a real scenario, you might check LDAP groups here
            const token = jwt.sign({ username, role: 'rh' }, SECRET, { expiresIn: '8h' });
            
            res.cookie('token', token, { 
                httpOnly: true, 
                secure: process.env.NODE_ENV === 'production',
                maxAge: 8 * 60 * 60 * 1000
            });

            return res.json({ ok: true, redirect: '/protected/index.html' });
        }
    }

    res.status(401).json({ ok: false, erro: 'Credenciais inválidas' });
});

router.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ ok: true, redirect: '/login.html' });
});

module.exports = router;
