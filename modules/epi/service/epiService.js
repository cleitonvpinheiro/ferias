const db = require('../../../services/db');
const repo = require('../repository/epiRepository');

function normalizeTipo(tipo) {
    const t = String(tipo || '').trim().toLowerCase();
    if (t === 'retirada' || t === 'devolucao') return t;
    return null;
}

function normalizeStatus(status) {
    const s = String(status || '').trim().toLowerCase();
    if (s === 'ok' || s === 'avaria' || s === 'extravio') return s;
    return 'ok';
}

function normalizeOrigem(origem) {
    const s = String(origem || '').trim().toLowerCase();
    if (s === 'portaria' || s === 'kiosk') return s;
    return null;
}

function buildLimites({ kitSugerido }) {
    const baseTotal = 8;
    const kitSize = Array.isArray(kitSugerido) ? kitSugerido.length : 0;
    const maxItensTotal = Math.max(baseTotal, Math.min(kitSize + 2, 12));
    const maxPorItem = 3;
    return { maxItensTotal, maxPorItem };
}

async function getPosseLegacyBySolicitacoes(colaboradorId) {
    const solicitacoes = await db.solicitacoesEpis.getAll();
    const atendidas = solicitacoes.filter(s =>
        String(s.funcionario_id) === String(colaboradorId) &&
        String(s.status || 'pendente').toLowerCase() === 'atendida'
    );
    const countById = new Map();
    atendidas.forEach(s => {
        const tipo = String(s.tipo || 'retirada').toLowerCase();
        const itens = Array.isArray(s.itens_solicitados) ? s.itens_solicitados : [];
        const delta = tipo === 'devolucao' ? -1 : 1;
        itens.forEach((raw) => {
            const id = String(raw);
            countById.set(id, Number(countById.get(id) || 0) + delta);
        });
    });
    return Array.from(countById.entries())
        .filter(([, n]) => n > 0)
        .map(([id, quantidade]) => ({ id: String(id), quantidade: Number(quantidade || 0) }));
}

async function getPosseAtual(colaboradorId) {
    const count = await repo.getMovimentacoesCountByColaboradorId(colaboradorId);
    if (count > 0) return await repo.getSaldoEmPosseByColaboradorId(colaboradorId);
    return await getPosseLegacyBySolicitacoes(colaboradorId);
}

async function computeBloqueios({ colaborador }) {
    const descontos = await db.descontosEpis.getAll();
    const cpfColab = String(colaborador && colaborador.cpf || '').replace(/\D/g, '');
    const descontoPendente = descontos.some(d => {
        const cpf = String(d.cpf_funcionario || '').replace(/\D/g, '');
        return cpf && cpf === cpfColab && String(d.status || 'pendente').toLowerCase() === 'pendente';
    });

    const ciclosAbertos = await db.ciclosUniforme.getOpenByFuncionario(String(colaborador.id));
    let cicloAbertoAnterior = false;
    if (Array.isArray(ciclosAbertos) && ciclosAbertos.length > 0) {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const oldest = ciclosAbertos
            .map(c => ({ c, d: c && c.data_retirada ? new Date(c.data_retirada) : null }))
            .filter(x => x.d && !Number.isNaN(x.d.getTime()))
            .sort((a, b) => a.d - b.d)[0];
        cicloAbertoAnterior = !oldest || oldest.d < startOfToday;
    }

    const extraviosPendentes = await db.ocorrenciasUniforme.getPendentesPorFuncionarioETipo({
        funcionarioId: String(colaborador.id),
        tipo: 'extravio'
    });
    const extravioPendente = Array.isArray(extraviosPendentes) && extraviosPendentes.length > 0;

    return { descontoPendente, cicloAbertoAnterior, extravioPendente };
}

async function computeScore({ colaboradorId, bloqueios }) {
    let score = 100;
    if (bloqueios && bloqueios.descontoPendente) score -= 35;
    if (bloqueios && bloqueios.extravioPendente) score -= 60;
    if (bloqueios && bloqueios.cicloAbertoAnterior) score -= 10;
    if (score < 0) score = 0;
    if (score > 100) score = 100;
    return score;
}

function buildDecisao({ tipo, status, epi }) {
    if (tipo !== 'devolucao') return { acao: 'registrar', geraDesconto: false };
    if (status === 'ok') return { acao: 'registrar', geraDesconto: false };
    if (status === 'avaria') {
        const valor = epi && epi.valor ? Number(epi.valor) : 0;
        if (Number.isFinite(valor) && valor <= 50) return { acao: 'registrar', geraDesconto: false };
        return { acao: 'registrar', geraDesconto: true, motivo: 'avaria' };
    }
    if (status === 'extravio') return { acao: 'registrar', geraDesconto: true, motivo: 'extravio' };
    return { acao: 'registrar', geraDesconto: false };
}

function countById(ids) {
    const map = new Map();
    for (const raw of ids) {
        const id = String(raw);
        map.set(id, Number(map.get(id) || 0) + 1);
    }
    return map;
}

async function validar({ colaborador, tipo, itensIds }) {
    const bloqueios = await computeBloqueios({ colaborador });
    const kit = await db.kitsUniforme.findBestMatch({ setor: colaborador.setor, cargo: colaborador.cargo });
    const kitSugerido = kit && Array.isArray(kit.itens) ? kit.itens.map(x => String(x)) : [];
    const limites = buildLimites({ kitSugerido });
    const posseAtual = await getPosseAtual(colaborador.id);
    const score = await computeScore({ colaboradorId: colaborador.id, bloqueios });

    const motivos = [];
    const ativo = colaborador && (colaborador.ativo === undefined || colaborador.ativo === null) ? true : !!colaborador.ativo;
    if (!ativo) motivos.push('colaborador_inativo');

    if (tipo === 'retirada') {
        if (bloqueios.descontoPendente) motivos.push('pendencia_rh');
        if (bloqueios.extravioPendente) motivos.push('extravio_pendente');
        if (bloqueios.cicloAbertoAnterior) motivos.push('ciclo_em_aberto');
        if (score < 60) motivos.push('score_baixo');
    }

    const posseTotal = posseAtual.reduce((acc, x) => acc + Number(x.quantidade || 0), 0);
    const posseMap = new Map(posseAtual.map(x => [String(x.id), Number(x.quantidade || 0)]));

    if (tipo === 'retirada' && Array.isArray(itensIds) && itensIds.length > 0) {
        const reqCount = countById(itensIds);
        let projectedTotal = posseTotal;
        for (const [id, qty] of reqCount.entries()) {
            const cur = Number(posseMap.get(id) || 0);
            projectedTotal += qty;
            const projectedPerItem = cur + qty;
            if (projectedPerItem > limites.maxPorItem) motivos.push(`limite_item:${id}`);
        }
        if (projectedTotal > limites.maxItensTotal) motivos.push('limite_total');
    }

    const liberado = motivos.length === 0;
    return {
        liberado,
        motivos,
        score,
        limites,
        bloqueios,
        itensEmPosseDetalhado: posseAtual,
        itensEmPosse: posseAtual.flatMap(x => Array.from({ length: Number(x.quantidade || 0) }, () => String(x.id))),
        kitSugerido
    };
}

async function resolveItensInput(itensInput) {
    const rawList = Array.isArray(itensInput) ? itensInput : [];
    const itemIds = [];
    const unknown = [];
    for (const raw of rawList) {
        const token = String(raw || '').trim();
        if (!token) continue;
        const byQr = await repo.getEpiByQr(token);
        if (byQr && byQr.id) {
            itemIds.push(String(byQr.id));
            continue;
        }
        const byId = await repo.getEpiById(token);
        if (byId && byId.id) {
            itemIds.push(String(byId.id));
            continue;
        }
        unknown.push(token);
    }
    return { itemIds, unknown };
}

async function registrarMovimentacao({ reqContext, colaborador, tipo, origem, status, observacao, itens, evidencia, evidencia_tipo }) {
    const t = normalizeTipo(tipo);
    if (!t) return { ok: false, erro: 'Tipo inválido' };
    const o = normalizeOrigem(origem);
    if (!o) return { ok: false, erro: 'Origem inválida' };

    const { itemIds, unknown } = await resolveItensInput(itens);
    if (unknown.length > 0) return { ok: false, erro: `Itens inválidos/QR não reconhecido: ${unknown.join(', ')}` };
    if (itemIds.length === 0) return { ok: false, erro: 'Informe ao menos 1 item' };

    const validacao = await validar({ colaborador, tipo: t, itensIds: itemIds });
    if (!validacao.liberado) {
        return { ok: false, erro: `Bloqueado: ${validacao.motivos.join(', ')}`, validacao };
    }

    const epis = await repo.listEpis();
    const epiMap = new Map((Array.isArray(epis) ? epis : []).map(e => [String(e.id), e]));

    const qtyById = countById(itemIds);
    const posseAtual = await getPosseAtual(colaborador.id);
    const posseMap = new Map(posseAtual.map(x => [String(x.id), Number(x.quantidade || 0)]));

    if (t === 'devolucao') {
        for (const [id, qty] of qtyById.entries()) {
            const cur = Number(posseMap.get(String(id)) || 0);
            if (cur < qty) return { ok: false, erro: 'Devolução inválida: quantidade maior que a posse atual' };
        }
    }

    if (t === 'retirada') {
        const now = new Date();
        for (const [id, qty] of qtyById.entries()) {
            const epi = epiMap.get(String(id));
            if (!epi) return { ok: false, erro: `Item inexistente: ${id}` };
            if (String(epi.status || 'ativo').toLowerCase() !== 'ativo') return { ok: false, erro: `Item bloqueado: ${epi.nome || id}` };
            if ((epi.estoque || 0) < qty) return { ok: false, erro: `Sem estoque para ${epi.nome || id}` };
            if (epi.ca_validade) {
                const caDate = new Date(epi.ca_validade);
                if (!Number.isNaN(caDate.getTime()) && caDate < now) return { ok: false, erro: `CA vencido para ${epi.nome || id}` };
            }
        }
    }

    const createdAt = new Date().toISOString();
    await db.sql.run('BEGIN TRANSACTION');
    try {
        const movimentoIds = await repo.insertMovimentacoes({
            colaboradorId: colaborador.id,
            tipo: t,
            origem: o,
            status: normalizeStatus(status),
            observacao,
            itemIds,
            createdAt
        });

        for (const [id, qty] of qtyById.entries()) {
            if (t === 'retirada') {
                await repo.applyEstoqueDelta({ itemId: id, delta: -Number(qty || 0) });
            } else {
                const st = normalizeStatus(status);
                if (st === 'ok') {
                    await repo.applyEstoqueDelta({ itemId: id, delta: Number(qty || 0) });
                }
            }
        }

        const descontosGerados = [];
        if (t === 'devolucao') {
            const st = normalizeStatus(status);
            if (st === 'avaria' || st === 'extravio') {
                for (const [id, qty] of qtyById.entries()) {
                    const epi = epiMap.get(String(id));
                    const decisao = buildDecisao({ tipo: t, status: st, epi });
                    if (decisao.geraDesconto) {
                        const itensDesconto = Array.from({ length: Number(qty || 0) }, () => ({
                            id: String(id),
                            nome: epi && epi.nome ? String(epi.nome) : String(id),
                            valor: epi && epi.valor !== undefined ? Number(epi.valor) : null,
                            motivo: decisao.motivo || st
                        }));
                        const descontoId = await repo.createDescontoEpi({
                            nomeFuncionario: colaborador.nome,
                            cpfFuncionario: colaborador.cpf,
                            itens: itensDesconto,
                            parcelas: 1,
                            status: 'pendente',
                            createdAt,
                            updatedAt: createdAt
                        });
                        descontosGerados.push(descontoId);
                    }
                }
            }
        }

        await repo.appendAuditoriaLog({
            requestId: reqContext && reqContext.requestId,
            actorUsername: reqContext && reqContext.actorUsername,
            actorRole: reqContext && reqContext.actorRole,
            origem: o,
            acao: 'epi_movimentacao',
            dados: {
                colaborador_id: String(colaborador.id),
                tipo: t,
                status: normalizeStatus(status),
                origem: o,
                observacao: observacao || null,
                evidencia: evidencia || null,
                evidencia_tipo: evidencia_tipo || null,
                itens: itemIds,
                movimento_ids: movimentoIds,
                descontos_gerados: descontosGerados
            }
        });

        await db.sql.run('COMMIT');

        const posseDepois = await getPosseAtual(colaborador.id);
        return {
            ok: true,
            movimentacoes: movimentoIds,
            descontosGerados,
            itensEmPosseDetalhado: posseDepois,
            itensEmPosse: posseDepois.flatMap(x => Array.from({ length: Number(x.quantidade || 0) }, () => String(x.id)))
        };
    } catch (e) {
        try { await db.sql.run('ROLLBACK'); } catch (_) {}
        throw e;
    }
}

module.exports = {
    normalizeTipo,
    normalizeOrigem,
    normalizeStatus,
    getPosseAtual,
    validar,
    registrarMovimentacao
};
