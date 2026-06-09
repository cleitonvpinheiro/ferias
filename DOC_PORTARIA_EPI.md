a# Documentação — Entrega de EPI / Portaria

## Visão Geral
O fluxo de **Entrega/Devolução de EPI** é composto por:
- **Catálogo de EPIs** (com estoque, valor e validade de CA) usado pela Portaria.
- **Solicitações de EPI** (retirada/devolução) criadas pelo colaborador (kiosk) ou pela Portaria.
- **Atendimento na Portaria**, que registra movimentação, ajusta estoque e (quando necessário) gera termo em PDF.
- **Controle de pendências de desconto** em caso de extravio, bloqueando novas movimentações até regularização.

## Perfis e Acessos
- **Solicitação/Devolução (kiosk)**: página pública (sem login) em `/solicitacao-epi.html`, consumindo endpoints públicos `/api/epi/*`.
- **Dashboard Portaria**: página protegida (login) em `/protected/dashboard-portaria.html`.
  - Permissão via `portariaAuth`: perfil `portaria` + perfis administrativos do portal.
- **Cadastro/gestão do catálogo de EPIs**: dashboard protegido `/protected/dashboard-epis.html` (perfil SESMT e/ou administrativos conforme regras do portal).

## Telas
- **Solicitação / Devolução de EPI (kiosk)**: `/solicitacao-epi.html`
- **Portaria (entrega/devolução + fila de solicitações)**: `/protected/dashboard-portaria.html?monitor=1`
- **Gestão de EPIs (catálogo/estoque/CA/valores)**: `/protected/dashboard-epis.html`

## Fluxo 1 — Solicitação/Retirada (Colaborador → Portaria)
### 1) Identificação do colaborador
Na tela `/solicitacao-epi.html`, o colaborador informa **CPF ou matrícula**.
O sistema consulta:
- `GET /api/epi/funcionario/:doc`
  - Retorna dados do colaborador e **itens em posse** (derivados das movimentações atendidas).
  - Se houver **desconto pendente** para o CPF, a operação é bloqueada.

### 2) Seleção de itens
A lista de EPIs é carregada por:
- `GET /api/epi/epis`

O colaborador seleciona os itens e escolhe o modo:
- **Solicitar** → cria solicitação do tipo `retirada`
- **Devolver** → cria solicitação do tipo `devolucao`

### 3) Evidência obrigatória (assinatura ou foto)
Para enviar, é obrigatório informar **assinatura** (canvas) e/ou **evidência (foto)**.

### 4) Criação da solicitação
Ao enviar, a tela chama:
- `POST /api/epi/solicitacoes`

Regras principais:
- Deve conter ao menos 1 item.
- Tipo deve ser `retirada` ou `devolucao`.
- Para `retirada`, valida **estoque** e **CA** (se aplicável) e já abate o estoque.
- Para `devolucao`, valida que os itens selecionados estão **em posse** do colaborador.
- Armazena evidência (assinatura/foto) junto à solicitação.

A solicitação nasce com status:
- `pendente`

## Fluxo 2 — Atendimento na Portaria (Entrega/Devolução)
### 1) Acesso e carregamento
No dashboard da Portaria, o sistema:
- Busca catálogo: `GET /api/portaria/epis`
- Busca colaborador por CPF/matrícula (para operação direta): `GET /api/portaria/funcionario/:doc`
- Abre a fila de solicitações: `GET /api/portaria/solicitacoes?status=pendente`

### 2) Atender solicitação de retirada
Na fila, ao marcar uma solicitação de **retirada** como atendida:
- `POST /api/portaria/solicitacoes/:id/status` com `{ "status": "atendida" }`

Efeitos:
- Registra `atendido_at` e `atendido_por`.
- Garante que exista evidência (assinatura/foto).
- Cria registro em `movimentacoes_epis` (se ainda não existir equivalente), com:
  - itens retirados
  - evidência
  - tipo_evidencia (ex.: `solicitacao_canvas` / `solicitacao_foto`)
- Estoque é ajustado (abatimento) ao registrar movimentação.

### 3) Atender solicitação de devolução
Solicitações do tipo `devolucao` **não são atendidas** via endpoint de status.
A confirmação é feita por:
- `POST /api/portaria/solicitacoes/:id/confirmar-devolucao`

O body define o resultado:
- `{ "resultado": "devolvido" }`
- `{ "resultado": "extraviado", "parcelas": 3 }`
- `{ "resultado": "misto", "itens_devolvidos": [...], "itens_extraviados": [...], "parcelas": 3 }`

Efeitos:
- Para itens devolvidos: registra movimentação com itens devolvidos e incrementa estoque.
- Para itens extraviados:
  - Cria um registro em `descontos_epis` com status `pendente`.
  - Gera um **PDF de autorização de desconto** (base64) e retorna no payload.
  - Mantém bloqueio do colaborador para novas solicitações até o desconto sair de `pendente`.

## Termos/PDFs
### Termo de responsabilidade (EPI)
Ao registrar movimentação (retirada/devolução) com evidência, o sistema pode gerar:
- **TERMO DE RESPONSABILIDADE - EPI** (PDF)
  - Contém colaborador, data e lista de itens retirados/devolvidos
  - Inclui a imagem da assinatura/foto quando disponível

### Termo de desconto (extravio)
Quando ocorre extravio:
- **AUTORIZAÇÃO DE DESCONTO EM FOLHA DE PAGAMENTO** (PDF)
  - Contém colaborador, item(s), valor e parcelamento

## Regras de Bloqueio (Pendência no RH)
Se existir qualquer registro em `descontos_epis` com:
- `cpf_funcionario` do colaborador e `status = "pendente"`

Então o colaborador fica bloqueado para:
- consultar/operar via `/api/epi/funcionario/:doc`
- operar via `/api/portaria/funcionario/:doc`
- criar novas solicitações via `/api/epi/solicitacoes`

## Como o sistema calcula “itens em posse”
O sistema calcula posse com base nas solicitações **atendidas** do colaborador:
- cada solicitação atendida do tipo `retirada` soma +1 por item
- cada solicitação atendida do tipo `devolucao` subtrai −1 por item

O resultado final (itens com saldo > 0) é o que o sistema considera como “em posse”.

## Tabelas/Dados (SQLite)
Principais estruturas usadas neste fluxo:
- `epis`: catálogo (nome, valor, estoque, possui_ca, ca_validade)
- `solicitacoes_epis`: fila de solicitações (tipo, itens, status, atendido_*, evidências)
- `movimentacoes_epis`: log de movimentações (itens retirados/devolvidos, evidência, termo)
- `descontos_epis`: pendências/parcelas em caso de extravio (itens e status)

## Endpoints (Resumo)
### Kiosk (público)
- `GET /api/epi/epis`
- `GET /api/epi/funcionario/:doc`
- `POST /api/epi/solicitacoes`

### Portaria (protegido)
- `GET /api/portaria/funcionario/:doc`
- `GET /api/portaria/epis`
- `GET /api/portaria/solicitacoes`
- `POST /api/portaria/solicitacoes/:id/status`
- `POST /api/portaria/solicitacoes/:id/confirmar-devolucao`
- `POST /api/portaria/movimentacao`
- `POST /api/portaria/termo-desconto`

## Pontos de Atenção Operacionais
- **CA vencido**: não permite retirada do item (valida na criação da solicitação e no registro de movimentação).
- **Estoque insuficiente**: não permite retirada.
- **Sem evidência** (assinatura/foto): não permite enviar solicitação nem concluir atendimento.
- **Extravio**: gera desconto pendente e bloqueia novas solicitações até regularização.

