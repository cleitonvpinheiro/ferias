'use strict';

const { norm } = require('../../utils/hierarchy');

const pendenciaPeriodoKey = (avaliadoId, tituloCiclo) =>
    `${String(avaliadoId || '').trim().toLowerCase()}_${norm(String(tituloCiclo || ''))}`;

function dedupPendenciasPorPeriodo(items) {
    const seen = new Set();
    const out = [];
    for (const p of items) {
        const key = pendenciaPeriodoKey(p.avaliadoId, p.cicloTitulo);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(p);
    }
    return out;
}

describe('pendencias dedup', () => {
    test('collapses duplicate cycles with same title for same employee', () => {
        const input = [
            { avaliadoId: 'abc', cicloId: 'c1', cicloTitulo: 'Desempenho 1º Sem. 2026 — ANA' },
            { avaliadoId: 'abc', cicloId: 'c2', cicloTitulo: 'Desempenho 1º Sem. 2026 — ANA' },
            { avaliadoId: 'abc', cicloId: 'c3', cicloTitulo: 'Desempenho 2º Sem. 2025 — ANA' },
        ];
        const out = dedupPendenciasPorPeriodo(input);
        expect(out).toHaveLength(2);
        expect(out.map(x => x.cicloId)).toEqual(['c1', 'c3']);
    });
});
