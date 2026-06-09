const {
    cargoAcimaDoNivel,
    filterFuncionarioByHierarchy,
    getCargoLevel,
    getRoleLevel,
    pertenceAoEscopo,
} = require('../../utils/hierarchy');

describe('hierarchy', () => {
    test('getRoleLevel and getCargoLevel ordering', () => {
        expect(getRoleLevel('gerente')).toBeGreaterThan(getRoleLevel('gestor'));
        expect(getRoleLevel('gestor')).toBeGreaterThan(getRoleLevel('supervisor'));
        expect(getRoleLevel('supervisor')).toBeGreaterThan(getRoleLevel('lider'));
        expect(getCargoLevel('Gerente de Operações')).toBe(4);
        expect(getCargoLevel('Analista')).toBe(0);
    });

    test('gerente sees everyone in sector including other gerentes', () => {
        expect(cargoAcimaDoNivel('Gerente Regional', 'gerente')).toBe(false);
        expect(cargoAcimaDoNivel('Supervisor', 'gerente')).toBe(false);
    });

    test('gestor does not see gerente', () => {
        expect(cargoAcimaDoNivel('Gerente', 'gestor')).toBe(true);
        expect(cargoAcimaDoNivel('Supervisor', 'gestor')).toBe(false);
    });

    test('supervisor does not see gerente or gestor', () => {
        expect(cargoAcimaDoNivel('Gerente', 'supervisor')).toBe(true);
        expect(cargoAcimaDoNivel('Gestor Comercial', 'supervisor')).toBe(true);
        expect(cargoAcimaDoNivel('Coordenador', 'supervisor')).toBe(false);
    });

    test('lider only sees plain collaborators', () => {
        const colaborador = { nome: 'João', cargo: 'Operador', setor: 'Produção' };
        const supervisor = { nome: 'Maria', cargo: 'Supervisor', setor: 'Produção' };
        const user = { name: 'Carlos Lider', email: 'carlos@exemplo.com' };

        expect(filterFuncionarioByHierarchy(colaborador, 'lider', user)).toBe(true);
        expect(filterFuncionarioByHierarchy(supervisor, 'lider', user)).toBe(false);
        expect(filterFuncionarioByHierarchy({ ...user, nome: 'Carlos Lider', cargo: 'Lider' }, 'lider', user)).toBe(false);
    });

    test('pertenceAoEscopo respects cargo hierarchy on setor match', () => {
        const scope = {
            nomes: new Set(['ana']),
            setores: new Set(['producao']),
        };

        expect(pertenceAoEscopo(
            { funcionario: 'Ana', setor: 'Produção', cargo: 'Operador' },
            scope,
            'gestor'
        )).toBe(true);

        expect(pertenceAoEscopo(
            { funcionario: 'Pedro', setor: 'Produção', cargo: 'Gerente' },
            scope,
            'gestor'
        )).toBe(false);
    });

    test('colaborador removido do setor não entra só pelo nome do setor na pendência', () => {
        const scope = {
            ids: new Set(['id-ana']),
            nomes: new Set(['ana']),
            setores: new Set(['fabrica de massas']),
        };

        expect(pertenceAoEscopo(
            { avaliadoId: 'id-ana', funcionario: 'Ana', setor: 'Fabrica de Massas', cargo: 'Operador' },
            scope,
            'supervisor'
        )).toBe(true);

        expect(pertenceAoEscopo(
            { avaliadoId: 'id-luciana', funcionario: 'Luciana', setor: 'Fabrica de Massas', cargo: 'Gerente' },
            scope,
            'supervisor'
        )).toBe(false);
    });
});
