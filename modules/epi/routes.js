const express = require('express');
const rateLimit = require('express-rate-limit');
const controller = require('./controller/epiController');
const router = express.Router();

const epiPublicLimiter = rateLimit({
    windowMs: 2 * 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { ok: false, erro: 'Muitas solicitações. Tente novamente.' }
});

module.exports = (db, auth) => {
    const { portariaAuth, sesmtAuth } = auth;

    router.post('/epi/validar', epiPublicLimiter, controller.postValidar);
    router.post('/epi/movimentacao', epiPublicLimiter, controller.postMovimentacao);
    router.get('/epi/colaborador/:id', portariaAuth, controller.getColaborador);
    router.get('/rh/epi/colaborador/:id', sesmtAuth, controller.getColaborador);

    return router;
};
