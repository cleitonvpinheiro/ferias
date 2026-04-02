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

router.get('/rh/alertas', rhAuth, async (req, res) => {
    try {
        const startOfDay = (d) => {
            const x = new Date(d);
            x.setHours(0, 0, 0, 0);
            return x;
        };

        const parseDate = (v) => {
            if (!v) return null;
            const d = new Date(v);
            return Number.isNaN(d.getTime()) ? null : d;
        };

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
            const dataDesl = parseDate(v.data_desligamento);
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

        for (const a of Array.isArray(avaliacoes) ? avaliacoes : []) {
            if (a.tipo !== 'experiencia') continue;
            const adm = parseDate(a.dataAdmissao);
            if (!adm) continue;

            const due45 = addMonths(adm, 0);
            due45.setDate(due45.getDate() + 45);
            const due90 = addMonths(adm, 0);
            due90.setDate(due90.getDate() + 90);

            const d45 = diffDays(due45, today);
            const d90 = diffDays(due90, today);

            const needs45 = !a.status45 && (d45 <= nearThreshold);
            const needs90 = !a.status90 && (d90 <= nearThreshold);
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
                id: a.id,
                funcionario: a.funcionario || '',
                cargo: a.cargo || '',
                setor: a.setor || '',
                avaliador: a.avaliador || '',
                dataAdmissao: adm.toISOString(),
                dias45: needs45 ? d45 : null,
                dias90: needs90 ? d90 : null
            });
        }

        const feriasItems = [];
        for (const f of Array.isArray(funcionarios) ? funcionarios : []) {
            const adm = parseDate(f.data_admissao || f.dataAdmissao);
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

module.exports = router;
