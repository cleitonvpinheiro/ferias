const express = require('express');
const router = express.Router();
const db = require('../services/db');
const { rhAuth } = require('../middleware/auth');

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

module.exports = router;
