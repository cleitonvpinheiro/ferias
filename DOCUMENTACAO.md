# Documentação do Sistema: Portal de Formulários e Gestão de RH

Este documento descreve os módulos do sistema, suas telas, fluxos e principais endpoints.

## 1. Visão Geral
O Portal de Formulários é uma aplicação web para o departamento de RH e perfis de gestão (gestor/líder/supervisor/gerente), centralizando:
- Intranet (comunicados/eventos/aniversariantes)
- Solicitação de férias (com fluxo e geração de PDF)
- Solicitações e aprovações (taxas, recrutamento, EPIs/uniformes, etc.)
- Avaliações (experiência e performance)
- Gestão de formulários dinâmicos e dashboards de respostas
- Cadastros administrativos (usuários, permissões, setores/equipes)

## 2. Arquitetura e Estrutura
- Backend: Node.js + Express (arquivo de entrada: `portalFormularios.js`)
- Frontend: HTML/CSS/JavaScript (páginas em `public/` e `protected/`)
- Banco de dados: MySQL/MariaDB (via `mysql2/promise`, repositórios em `services/db.js`)
- Autenticação: JWT em cookie (e, em algumas rotas, suporte opcional a Bearer token)
- Segurança: Helmet, rate limiting, validações e sanitização de dados

Estrutura de pastas:
- `portalFormularios.js`: bootstrap do servidor, middlewares e montagem das rotas
- `routes/`: API do sistema, separada por módulo
- `services/`: integrações e serviços (DB, LDAP, e-mail, PDF, etc.)
- `middleware/`: autenticação/ACL e upload
- `utils/`: funções utilitárias (normalização, escopo de equipe, validações)
- `public/`: páginas públicas (com controle de acesso por perfil)
- `protected/`: páginas protegidas (dashboards e páginas administrativas)

## 3. Acesso, Perfis e Permissões

### 3.1 Perfis (roles)
Perfis definidos em `middleware/auth.js`:
- Administrativos: `admin`, `rh`, `rh_geral`, `dp`, `recrutamento`, `td`, `sesmt`, `endomarketing`
- Operacionais/gestão: `portaria`, `gestor`, `lider`, `supervisor`, `gerente`
- Estado intermediário: `pendente`

### 3.2 Páginas públicas x protegidas
O sistema separa:
- Páginas públicas (em `public/`): acessadas por URL direta, mas com checagem por perfil via `PUBLIC_PAGE_ACCESS`
- Páginas protegidas (em `protected/`): acessadas via `/protected/*` e controladas por `PROTECTED_PAGE_ACCESS`

### 3.3 Override de permissões por banco
Além das permissões padrão, existe override em banco (tabela `role_permissions`) carregado periodicamente. Isso permite ajustar quais dashboards um perfil vê sem alterar código.

### 3.4 Escopo de equipe (gestor/líder/supervisor/gerente)
Para módulos que dependem de “time” (ex.: férias e avaliações), o sistema usa:
- equipe direta por vínculo (colaboradores vinculados ao gestor)
- e/ou vínculo por setor (um gestor pode estar associado a múltiplos setores)
O cálculo do escopo é feito em `utils/hierarchy.js` e consultando tabelas como `gestor_equipes` e `gestor_setores`.

## 4. Módulos do Sistema (descrição completa)

### 4.1 Autenticação, Sessão e Identidade
Objetivo: login, sessão, logout e descoberta de acessos do usuário.

Telas principais:
- `public/login.html`
- `protected/gerenciar-usuarios.html` (admin/RH)

Principais endpoints:
- `POST /api/login`: autentica e grava cookie `token`
- `GET /api/me`: retorna usuário logado
- `GET /api/access`: retorna páginas liberadas (públicas e protegidas) + formulários dinâmicos liberados
- `POST /api/logout`: encerra sessão
- `PUT /api/me/password`: troca senha (quando aplicável)
- `GET /api/me/foto`: resolve e serve a foto do colaborador associado ao usuário

LDAP (opcional):
- Usado para autenticação/importação de usuários do AD/LDAP, via `services/ldapService.js` e rotas em `routes/users.js`

### 4.2 Intranet (Comunicados, Eventos e Aniversariantes)
Objetivo: comunicação interna na home e no painel do gestor.

Telas principais:
- `protected/index.html` (home/intranet)
- `protected/dashboard-gestor.html` (feed também aparece no painel do gestor)

Funcionalidades:
- Feed de posts (com opcional de imagem)
- Eventos (agenda)
- Aniversariantes

Uploads:
- Imagens de posts da intranet são salvas em `public/uploads/intranet` e servidas por `/uploads/intranet/...`

### 4.3 Gestão de Funcionários e Cadastros RH
Objetivo: centralizar dados de colaboradores e suportar funcionalidades transversais (buscas, fotos, escopo, etc.).

Telas principais:
- `protected/dashboard-funcionarios.html` (DP/RH)
- `protected/gerenciar-usuarios.html` (vínculos equipe/setor e importações)

Principais endpoints (variam por perfil):
- Rotas em `routes/funcionarios.js` e `routes/rh.js` para listagens, vínculos e operações administrativas
- Busca pública de colaboradores: `GET /api/public/funcionarios/busca?busca=...` (mínimo 3 chars)

### 4.4 Solicitação de Férias
Objetivo: registrar solicitações, fazer aprovação e gerar documentação.

Tela principal:
- `public/ferias.html`

Fluxo típico:
1) Colaborador preenche solicitação e encaminha ao RH
2) RH aprova/reprova e pode solicitar ajuste
3) Quando aprovado, o fluxo pode entrar em etapa de assinatura (token de assinatura)
4) PDF pode ser gerado/baixado

Principais endpoints (resumo):
- `GET /api/solicitacao/:id`: consulta solicitação
- `GET /api/rh/solicitacoes`: lista solicitações para DP/RH
- `GET /api/gestor/solicitacoes`: lista solicitações no escopo do gestor/líder
- `POST /api/encaminhar`: cria/atualiza e encaminha solicitação
- `GET /api/pdf/:id`: gera/baixa PDF da solicitação

Serviços relacionados:
- `services/pdfService.js` (PDF)
- `services/email.js` (notificações por e-mail, quando configurado)

### 4.5 Taxas (Solicitações e Aprovações)
Objetivo: registrar solicitações de taxa e permitir acompanhamento/decisão conforme perfil.

Telas principais:
- `public/taxas.html`
- `public/solicitacao-taxa.html`
- `protected/dashboard-taxas.html`
- `protected/dashboard-solicitacoes-taxa.html`

Endpoints e regras ficam em:
- `routes/taxas.js`
- `routes/solicitacaoTaxa.js`

### 4.6 Recrutamento e Seleção (Vagas, Candidatos e Banco de Talentos)
Objetivo: abrir vagas, receber candidaturas, fazer triagem e acompanhar etapas.

Telas principais:
- `public/vagas.html`
- `public/trabalheConosco.html`
- `public/recrutamentoInterno.html`
- `protected/dashboard-vagas.html`
- `protected/dashboard-candidatos.html`
- `protected/dashboard-recrutamento.html`

Principais submódulos:
- Vagas: abertura/gestão e status da vaga
- Candidatos: banco de talentos e detalhes do candidato
- Recrutamento: pipeline/kanban e acompanhamento de etapas

Serviços relacionados:
- `services/externalTalentService.js` (buscas/atalhos externos)

### 4.7 On The Job (Onboarding/Treinamento)
Objetivo: checklists e acompanhamento inicial de onboarding.

Telas:
- `public/onTheJob.html`
- `protected/dashboard-onthejob.html`

Rotas:
- `routes/onthejob.js`

### 4.8 EPIs e Uniformes
Objetivo: controle de estoque, solicitações e ciclo de entrega/devolução (com papel da Portaria).

Telas principais:
- `public/solicitacao-epi.html`
- `protected/dashboard-epis.html` (SESMT/RH)
- `protected/dashboard-portaria.html` (Portaria)
- `protected/dashboard-funcionarios.html` (apoio administrativo)

Rotas:
- `routes/epis.js`
- `routes/uniformes.js`
- Módulo EPI adicional: `modules/epi/*` (rotas próprias)

Conceitos do módulo:
- Cadastro e estoque de itens
- Solicitações
- Movimentações (retirada/devolução)
- Ocorrências/decisões e registros (quando aplicável)

### 4.9 Controle de Portaria
Objetivo: interface de operação da portaria, com permissões específicas.

Tela:
- `protected/dashboard-portaria.html`

Rotas:
- `routes/portaria.js`

### 4.10 Avaliações (Performance e Experiência)
Objetivo: ciclos de avaliação, pendências, preenchimento, consolidação e assinaturas (quando aplicável).

Telas principais:
- Formulários públicos por tipo:
  - `public/avaliacao-adm.html`
  - `public/avaliacao-operacional.html`
  - `public/avaliacao-atendimento.html`
  - `public/avaliacao-lideranca.html`
- Dashboard:
  - `protected/dashboard-avaliacao.html`
  - `protected/dashboard-experiencia.html`

Regras principais:
- Tipos de avaliação podem ser inferidos por cargo/setor
- Perfis de gestão enxergam pendências apenas do seu escopo (equipe/setor)

Rotas:
- `routes/avaliacao.js`

### 4.11 Disciplinar
Objetivo: registrar ocorrências disciplinares e manter modelos.

Telas:
- `protected/dashboard-disciplinar.html`

Rotas:
- `routes/disciplinar.js`

### 4.12 Desligamento
Objetivo: registrar e acompanhar entrevistas de desligamento e dados do processo.

Telas:
- `protected/dashboard-desligamento.html`
- `protected/entrevista-desligamento.html`

Rotas:
- `routes/desligamento.js`

### 4.13 Formulários Dinâmicos (Construtor + Dashboards)
Objetivo: criar formulários customizados (pesquisa/checklist), distribuir e coletar respostas, e analisar resultados.

Telas principais:
- `public/responder-formulario.html` (responder formulário)
- `protected/dashboard-formularios.html` (gestão)
- `protected/dashboard-formulario-respostas.html` (análise de respostas)

Rotas:
- Base: `/api/rh/formularios` (em `routes/formularios.js`)
- Definição pública do formulário: `GET /api/rh/formularios/public/:id`
- Envio de resposta: `POST /api/rh/formularios/public/:id/responder`
- Gestão RH/TD: CRUD de formulários, dashboards e listagem de respostas

IA (OpenAI) no módulo:
- Resumo de respostas por formulário: `POST /api/rh/formularios/:id/ai-resumo`
- Resumo de respostas por dashboard/modelo: `POST /api/rh/formularios/dashboards/:id/ai-resumo`
- Variáveis:
  - `OPENAI_API_KEY`
  - `OPENAI_MODEL` (default: `gpt-4o-mini`)

## 5. Configuração (variáveis de ambiente)

### 5.1 Obrigatórias em produção
- `NODE_ENV=production`
- `JWT_SECRET`
- MySQL:
  - `MYSQL_HOST`, `MYSQL_PORT`
  - `MYSQL_USER` (ou `MYSQL_USERNAME`)
  - `MYSQL_PASS` (ou `MYSQL_PASSWORD`)
  - `MYSQL_DB` (ou `MYSQL_NAME`/`MYSQL_DATABASE`)

### 5.2 Integrações opcionais
- E-mail (SMTP): `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`, `MAIL_FROM`
- Autentique: `AUTENTIQUE_TOKEN`, `AUTENTIQUE_SANDBOX`
- LDAP: `LDAP_URL`, `LDAP_DN_FORMAT`, `LDAP_SEARCH_BASE`, `LDAP_ADMIN_DN`, `LDAP_ADMIN_PASSWORD`
- Questor: `QUESTOR_API_URL`, `QUESTOR_API_TOKEN`
- OpenAI: `OPENAI_API_KEY`, `OPENAI_MODEL`

## 6. Operação e Rotina (como rodar)
- Instalação:
  ```bash
  npm install
  ```
- Execução:
  ```bash
  npm start
  ```

Rotas úteis:
- `/health` e `/ready` para healthcheck
- `/login.html` para autenticação
- `/protected` para home protegida (redireciona conforme o perfil)

## 7. Testes
O projeto usa Jest e Supertest:
```bash
npm test
```

## 8. Observações e materiais auxiliares
- Existe documentação específica já existente em:
  - `README.md` (visão de uso e rotas principais)
  - `DOC_PORTARIA_EPI.md` (detalhes operacionais do módulo Portaria/EPI)

---
Documentação atualizada em: 09/06/2026
