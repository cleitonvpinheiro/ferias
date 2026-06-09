#!/usr/bin/env bash
# fix_destruct.sh
# Garante que toda rota no padrão (db, auth) => { ... }
# tenha a desestruturação correta de auth logo no início da função.
# Uso: bash fix_destruct.sh  (rodar na raiz do projeto)

set -euo pipefail

ALL_SYMBOLS="verifyToken checkRole ROLES dpAuth rhAuth portalAuth portariaAuth recrutamentoAuth tdAuth onTheJobAuth disciplinarAuth sesmtAuth adminAuth expDashAuth SECRET ALL_RH_ROLES PORTAL_ROLES PUBLIC_PAGE_ACCESS PROTECTED_PAGE_ACCESS"

fix_file() {
  local FILE="$1"

  # Detecta quais símbolos o arquivo usa
  local NEEDED=()
  for sym in $ALL_SYMBOLS; do
    if grep -q "\b${sym}\b" "$FILE"; then
      NEEDED+=("$sym")
    fi
  done

  if [ ${#NEEDED[@]} -eq 0 ]; then
    echo "  $FILE — nenhum símbolo necessário, pulando"
    return
  fi

  local DESTRUCT="    const { $(IFS=', '; echo "${NEEDED[*]}") } = auth;"

  # Se já tem a desestruturação correta, pula
  if grep -q "const {.*} = auth" "$FILE"; then
    # Remove a linha antiga e reinsere a correta
    sed -i "/const {.*} = auth/d" "$FILE"
  fi

  # Insere a desestruturação na primeira linha após "module.exports = (db, auth) => {"
  python3 - "$FILE" "$DESTRUCT" << 'PY'
import sys

path = sys.argv[1]
destruct = sys.argv[2]

with open(path, 'r') as f:
    lines = f.readlines()

inserted = False
new_lines = []
for i, line in enumerate(lines):
    new_lines.append(line)
    if not inserted and 'module.exports' in line and '(db' in line and 'auth' in line and '=>' in line:
        # Próxima linha não-vazia recebe a desestruturação
        new_lines.append(destruct + '\n')
        inserted = True

if not inserted:
    print(f"  AVISO: não encontrou module.exports em {path}")
else:
    with open(path, 'w') as f:
        f.writelines(new_lines)
    print(f"  OK: {path}")
PY
}

TARGETS=(
  routes/ferias.js
  routes/funcionarios.js
  routes/vagas.js
  routes/taxas.js
  routes/solicitacaoTaxa.js
  routes/movimentacao.js
  routes/portaria.js
  routes/rh.js
  routes/avaliacao.js
  routes/formularios.js
  routes/users.js
)

for f in "${TARGETS[@]}"; do
  if [ -f "$f" ]; then
    echo "→ $f"
    fix_file "$f"
  else
    echo "  AVISO: $f não encontrado"
  fi
done

echo ""
echo "✅ Concluído. Rode o teste de rotas para confirmar."