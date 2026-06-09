const repo = require('../repository/epiRepository');
const service = require('../service/epiService');

function getReqContext(req) {
    const actorUsername = req.user && req.user.username ? String(req.user.username) : null;
    const actorRole = req.user && req.user.role ? String(req.user.role) : null;
    const requestId = req.requestId ? String(req.requestId) : null;
    return { actorUsername, actorRole, requestId };
}

async function postValidar(req, res) {
    try {
        const payload = req.body || {};
        const tipo = service.normalizeTipo(payload.tipo || 'retirada');
        if (!tipo) return res.status(400).json({ ok: false, erro: 'Tipo inválido' });

        let colaborador = null;
        if (payload.colaborador_id) {
            colaborador = await repo.getColaboradorById(payload.colaborador_id);
        } else if (payload.doc) {
            colaborador = await repo.findColaboradorByDoc(payload.doc);
        }
        if (!colaborador) return res.status(404).json({ ok: false, erro: 'Colaborador não encontrado' });

        const itens = Array.isArray(payload.itens) ? payload.itens : [];
        const validacao = await service.validar({ colaborador, tipo, itensIds: itens.map(x => String(x)) });

        return res.json({
            ok: true,
            colaborador: {
                id: colaborador.id,
                nome: colaborador.nome,
                cpf: colaborador.cpf,
                matricula: colaborador.matricula,
                cargo: colaborador.cargo,
                setor: colaborador.setor,
                ativo: colaborador.ativo === undefined || colaborador.ativo === null ? true : !!colaborador.ativo
            },
            validacao
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao validar' });
    }
}

async function getColaborador(req, res) {
    try {
        const id = String(req.params.id || '').trim();
        if (!id) return res.status(400).json({ ok: false, erro: 'ID inválido' });
        const colaborador = await repo.getColaboradorById(id);
        if (!colaborador) return res.status(404).json({ ok: false, erro: 'Colaborador não encontrado' });

        const validacao = await service.validar({ colaborador, tipo: 'retirada', itensIds: [] });
        res.json({
            ok: true,
            colaborador: {
                id: colaborador.id,
                nome: colaborador.nome,
                cpf: colaborador.cpf,
                matricula: colaborador.matricula,
                cargo: colaborador.cargo,
                setor: colaborador.setor,
                ativo: colaborador.ativo === undefined || colaborador.ativo === null ? true : !!colaborador.ativo
            },
            itensEmPosse: validacao.itensEmPosse,
            itensEmPosseDetalhado: validacao.itensEmPosseDetalhado,
            bloqueios: validacao.bloqueios,
            score: validacao.score,
            limites: validacao.limites,
            kitSugerido: validacao.kitSugerido,
            liberadoRetirada: validacao.liberado,
            motivosBloqueio: validacao.motivos
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao buscar colaborador' });
    }
}

async function postMovimentacao(req, res) {
    try {
        const payload = req.body || {};
        const tipo = service.normalizeTipo(payload.tipo);
        if (!tipo) return res.status(400).json({ ok: false, erro: 'Tipo inválido' });
        const origem = service.normalizeOrigem(payload.origem);
        if (!origem) return res.status(400).json({ ok: false, erro: 'Origem inválida' });

        const status = service.normalizeStatus(payload.status || 'ok');
        const observacao = payload.observacao ? String(payload.observacao) : null;
        const evidenciaRaw = payload.evidencia ? String(payload.evidencia) : null;
        const evidencia = evidenciaRaw && evidenciaRaw.length > 200000 ? evidenciaRaw.slice(0, 200000) : evidenciaRaw;
        const evidencia_tipo = payload.evidencia_tipo ? String(payload.evidencia_tipo) : null;

        let colaborador = null;
        if (payload.colaborador_id) {
            colaborador = await repo.getColaboradorById(payload.colaborador_id);
        } else if (payload.doc) {
            colaborador = await repo.findColaboradorByDoc(payload.doc);
        }
        if (!colaborador) return res.status(404).json({ ok: false, erro: 'Colaborador não encontrado' });

        const itens = Array.isArray(payload.itens) ? payload.itens : [];
        const out = await service.registrarMovimentacao({
            reqContext: getReqContext(req),
            colaborador,
            tipo,
            origem,
            status,
            observacao,
            itens,
            evidencia,
            evidencia_tipo
        });
        if (!out.ok) return res.status(403).json(out);
        res.json(out);
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, erro: 'Erro ao registrar movimentação' });
    }
}

module.exports = {
    postValidar,
    getColaborador,
    postMovimentacao
};
