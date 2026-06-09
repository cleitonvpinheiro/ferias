'use strict';

/**
 * Hierarquia de visualização por perfil (do mais amplo ao mais restrito):
 *
 *   rh_geral / admin / dp / rh  →  base inteira
 *   gerente                     →  todo o setor vinculado
 *   gestor                      →  setor, exceto cargos acima (gerente)
 *   supervisor / coordenador    →  setor, exceto gerente e gestor
 *   lider / encarregado         →  colaboradores (sem cargo de liderança)
 *
 * A expansão por setor usa `gestor_setores`; vínculos diretos usam `gestor_equipes`.
 */

const norm = (s) =>
    String(s || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

const normSetor = (v) => String(v || '').trim().toUpperCase();

const EQUIPE_SCOPED_ROLES = new Set([
    'gerente', 'gestor', 'supervisor', 'coordenador', 'lider', 'encarregado',
]);

/** Perfis que expandem a equipe pelos setores vinculados em gestor_setores */
const SETOR_EXPAND_ROLES = new Set([
    'gerente', 'gestor', 'supervisor', 'coordenador', 'lider', 'encarregado',
]);

const RH_FULL_ACCESS_ROLES = new Set([
    'admin', 'rh', 'rh_geral', 'dp', 'td', 'recrutamento',
]);

function getCargoLevel(cargo) {
    const c = norm(cargo || '');
    if (c.includes('gerente')) return 4;
    if (c.includes('gestor')) return 3;
    if (c.includes('supervisor') || c.includes('coordenador')) return 2;
    if (c.includes('lider') || c.includes('encarreg')) return 1;
    return 0;
}

function getRoleLevel(roleNorm) {
    const r = norm(roleNorm || '');
    if (r.includes('gerente')) return 4;
    if (r.includes('gestor')) return 3;
    if (r.includes('supervisor') || r.includes('coordenador')) return 2;
    if (r.includes('lider') || r.includes('encarreg')) return 1;
    return 0;
}

/** Retorna true se o cargo do colaborador está acima do nível do perfil logado */
function cargoAcimaDoNivel(fCargo, roleNorm) {
    const roleLevel = getRoleLevel(roleNorm);
    if (roleLevel >= 4) return false;
    return getCargoLevel(fCargo) > roleLevel;
}

function isEquipeScopedRole(role) {
    return EQUIPE_SCOPED_ROLES.has(norm(role || ''));
}

function hasFullRhAccess(role) {
    return RH_FULL_ACCESS_ROLES.has(norm(role || ''));
}

function canExpandBySetor(role) {
    return SETOR_EXPAND_ROLES.has(norm(role || ''));
}

function isSelfFuncionario(f, { name, email, username } = {}) {
    const fNome = norm(f && f.nome);
    const fEmail = String(f && f.email || '').trim().toLowerCase();
    const fMatricula = String(f && f.matricula || '').trim().toLowerCase();
    const fCpf = String(f && f.cpf || '').replace(/\D/g, '');
    const userName = norm(name);
    const userEmail = String(email || '').trim().toLowerCase();
    const userLogin = String(username || '').trim().toLowerCase();

    if (userName && fNome && fNome === userName) return true;
    if (userEmail && fEmail && fEmail === userEmail) return true;
    if (userLogin && (fMatricula === userLogin || fCpf === userLogin)) return true;
    return false;
}

function filterFuncionarioByHierarchy(f, roleNorm, currentUser = {}) {
    if (!f) return false;
    if (isSelfFuncionario(f, currentUser)) return false;
    if (cargoAcimaDoNivel(f.cargo, roleNorm)) return false;

    const roleLevel = getRoleLevel(roleNorm);
    if (roleLevel <= 1) {
        return getCargoLevel(f.cargo) === 0;
    }
    return true;
}

function mergeFuncionariosUnique(...lists) {
    const out = [];
    const ids = new Set();
    for (const list of lists) {
        for (const f of (Array.isArray(list) ? list : [])) {
            const id = String(f && f.id || '').trim();
            if (!id || ids.has(id)) continue;
            ids.add(id);
            out.push(f);
        }
    }
    return out;
}

/**
 * Monta a lista de colaboradores visíveis para o usuário logado.
 */
async function resolveEquipeForUser(db, { username, role, name, email }) {
    const roleNorm = norm(role);
    const currentUser = { username, name, email };

    if (hasFullRhAccess(roleNorm)) {
        return db.funcionarios.getAll();
    }

    if (!isEquipeScopedRole(roleNorm) || !username) {
        return [];
    }

    const [equipeMembros, setoresGestor] = await Promise.all([
        db.gestorEquipes.getEquipeByGestor(username),
        canExpandBySetor(roleNorm)
            ? db.gestorSetores.getSetoresByGestor(username)
            : Promise.resolve([]),
    ]);

    const porEquipe = (equipeMembros || []).filter(f =>
        filterFuncionarioByHierarchy(f, roleNorm, currentUser)
    );

    let porSetor = [];
    if (Array.isArray(setoresGestor) && setoresGestor.length > 0) {
        const gSetores = new Set(setoresGestor.map(s => normSetor(s && s.setor)).filter(Boolean));
        const todos = await db.funcionarios.getAll();
        porSetor = (Array.isArray(todos) ? todos : []).filter(f =>
            gSetores.has(normSetor(f && f.setor)) &&
            filterFuncionarioByHierarchy(f, roleNorm, currentUser)
        );
    }

    return mergeFuncionariosUnique(porEquipe, porSetor);
}

/**
 * Escopo usado em avaliações: conjuntos de nomes e setores normalizados.
 */
async function buildEquipeScope(db, { username, role, name, email }) {
    const roleNorm = norm(role);
    const currentUser = { username, name, email };
    const nomes = new Set();
    const setores = new Set();
    const ids = new Set();

    const equipe = await resolveEquipeForUser(db, { username, role, name, email });
    for (const f of equipe) {
        const id = String(f && f.id || '').trim();
        const n = norm(f && f.nome);
        const s = norm(f && f.setor);
        if (id) ids.add(id);
        if (n) nomes.add(n);
        if (s) setores.add(s);
    }

    return { nomes, setores, ids, roleNorm, currentUser };
}

/** Verifica se um registro (avaliação, pendência etc.) pertence ao escopo da equipe */
function pertenceAoEscopo(item, scope, roleNorm) {
    const avaliadoId = String(
        item.avaliadoId || item.avaliado_id || item.funcionarioId || item.funcionario_id || ''
    ).trim();
    const funcionario = norm(item.funcionario || item.avaliado || item.nome || item.avaliadoNome || item.avaliado_nome);
    const setor = norm(item.setor || item.departamento || item.avaliadoSetor || item.avaliado_setor);
    const cargo = item.cargo || item.avaliadoCargo || item.avaliado_cargo || item.funcao || null;
    const effectiveRole = norm(roleNorm || (scope && scope.roleNorm));

    if (avaliadoId && scope.ids && scope.ids.has(avaliadoId)) return true;

    if (funcionario && scope.nomes && scope.nomes.has(funcionario)) return true;

    // Com colaborador identificado, não entra só pelo setor (evita snapshot antigo ou ex-membro do setor)
    if (funcionario) return false;

    if (setor && scope.setores && scope.setores.has(setor)) {
        if (effectiveRole && cargoAcimaDoNivel(cargo, effectiveRole)) return false;
        return true;
    }

    return false;
}

async function assertCanAccessFuncionario(db, req, funcionarioId) {
    const id = String(funcionarioId || '').trim();
    if (!id) return { ok: false, status: 400, erro: 'ID inválido' };

    const role = norm(req.user && req.user.role);
    if (hasFullRhAccess(role)) return { ok: true };

    if (!isEquipeScopedRole(role)) return { ok: true };

    const username = req.user && req.user.username ? String(req.user.username).trim().toLowerCase() : '';
    if (!username) return { ok: false, status: 401, erro: 'Usuário não autenticado' };

    const equipe = await resolveEquipeForUser(db, {
        username,
        role,
        name: req.user && req.user.name,
        email: req.user && req.user.email,
    });

    const allowed = equipe.some(f => String(f && f.id || '').trim() === id);
    if (allowed) return { ok: true };

    return { ok: false, status: 403, erro: 'Acesso proibido para este colaborador' };
}

module.exports = {
    norm,
    normSetor,
    getCargoLevel,
    getRoleLevel,
    cargoAcimaDoNivel,
    isEquipeScopedRole,
    hasFullRhAccess,
    canExpandBySetor,
    isSelfFuncionario,
    filterFuncionarioByHierarchy,
    mergeFuncionariosUnique,
    resolveEquipeForUser,
    buildEquipeScope,
    pertenceAoEscopo,
    assertCanAccessFuncionario,
};
