# Portal RH - Sistema de Gestão Integrada

Este projeto é uma plataforma web completa para o departamento de Recursos Humanos, centralizando diversos processos como solicitação de férias, gestão de EPIs, recrutamento, avaliações e controle de portaria.

## 🚀 Funcionalidades e Módulos

O sistema é dividido em módulos integrados:

### 1. 🏖️ Gestão de Férias
- Formulário de solicitação pelo colaborador.
- Fluxo de aprovação (Gestor -> RH).
- Assinatura eletrônica via **Autentique**.
- Geração automática de PDF.

### 2. 🦺 Gestão de EPIs e Uniformes
- Cadastro e controle de estoque de itens.
- Dashboard da Portaria para registro de retiradas e devoluções.
- Controle por ciclos de uso (retirada → devolução) com inspeção obrigatória na devolução.
- Ocorrências (avaria/extravio) encaminhadas para decisão do RH e geração de termo/desconto quando aplicável.
- Controle de descontos em folha com status (Pendente/Resolvido).

### 3. 👥 Recrutamento e Seleção
- **Vagas:** Abertura e gestão de vagas (internas e externas).
- **Candidatos:** Banco de talentos e triagem de currículos.
- **Kanban:** Visualização do fluxo de processos seletivos.

### 4. 🚀 Onboarding e Treinamento (On The Job)
- Listas de verificação para novos colaboradores.
- Acompanhamento de treinamentos iniciais.

### 5. 📊 Avaliações (Performance)
- Card “Avaliações” na tela inicial do portal do colaborador com seleção de tipo:
  - **ADM** (`/avaliacao-adm.html`)
  - **Gestores** (`/avaliacao-lideranca.html`)
  - **Atendimento** (usa o formulário operacional com `tipo=atendimento`)
  - **Operacional** (`/avaliacao-operacional.html`)
- Dashboard restrito para acompanhamento/relatórios: `/protected/dashboard-avaliacao.html`

### 6. 📊 Avaliação de Experiência
- Formulários dinâmicos para avaliação (45 e 90 dias).
- Dashboards específicos para liderança e RH.

### 7. 🚪 Processo de Desligamento
- Agendamento e registro de entrevistas de desligamento.
- Checklist de devolução de ativos.

### 8. 👮 Controle de Portaria
- Interface dedicada para a portaria.
- Registro rápido de entrega de EPIs.
- Consulta de itens autorizados.

### 9. 📝 Gestão de Formulários
- Criação e edição dinâmica de formulários (Pesquisa/Avaliação).
- Editor visual com suporte a múltiplos tipos de questões.
- API para distribuição e coleta de respostas.

## 🛠️ Tecnologias Utilizadas

- **Backend:** Node.js, Express
- **Banco de Dados:** SQLite (migração de arquivos JSON para maior robustez)
- **Frontend:** HTML5, CSS3 (Variáveis CSS, Flexbox/Grid), JavaScript (Vanilla)
- **Segurança:** 
  - Autenticação baseada em Sessão/Cookies.
  - Middlewares de proteção (`helmet`, `rate-limit`).
  - Controle de acesso por rotas (`rhAuth`, `portariaAuth`).
- **PDF:** `pdfkit` para geração dinâmica de documentos.
- **Integrações:** API Autentique (GraphQL) para assinaturas legais.
- **Outros:** `multer` (upload de arquivos), `xlsx` (importação/exportação Excel).

## 📋 Pré-requisitos

- [Node.js](https://nodejs.org/) (versão 18 ou superior recomendada)
- [NPM](https://www.npmjs.com/)

## 🔧 Instalação

1.  Clone o repositório:
    ```bash
    git clone <url-do-repositorio>
    cd FormFerias
    ```

2.  Instale as dependências:
    ```bash
    npm install
    ```
    O pacote `sqlite3` inclui código nativo compilado para o sistema operacional em que o `npm install` roda. Ao migrar de Windows para Linux (ou copiar `node_modules` entre SOs), execute na raiz do projeto:
    ```bash
    npm rebuild sqlite3
    ```
    O script `postinstall` tenta fazer isso automaticamente após cada `npm install`.

3.  Configure as variáveis de ambiente:
    Crie um arquivo `.env` na raiz do projeto (use `.env.example` como base). O sistema funciona sem integrações externas, mas exige `JWT_SECRET` em produção.

4.  Inicialize o banco de dados (se necessário):
    O sistema cria/migra as tabelas automaticamente ao iniciar (`database/init.js`), mas você pode verificar o schema em `database/schema.sql`.

## ▶️ Como Executar

Para iniciar o servidor:

```bash
npm start
```

A aplicação estará disponível em `http://localhost:8080` (ou a porta definida no `.env`).

### Principais Rotas de Acesso:

- **Intranet (pública):** `/` (Comunicados, aniversariantes e eventos)
- **Portal de Formulários (público):** `/formularios` (Menu principal de formulários)
- **Login:** `/login.html`
- **Área protegida (restrita):** `/protected/*` (Requer login)
- **Landing do Portal RH (pública):** `/protected/index.html` (mesma tela da rota `/`)
- **Painel do RH:** `/protected/dashboard-rh.html` (Requer login)
- **Painel da Portaria:** `/protected/dashboard-portaria.html` (Requer login Portaria)
- **Solicitação de Férias:** `/ferias.html`
- **Dashboard de Avaliações (restrito):** `/protected/dashboard-avaliacao.html`

### Intranet (Comunicados / Eventos / Aniversariantes)

- **Leitura pública (sem login):**
  - `GET /api/public/intranet/feed` (por padrão retorna comunicados RH)
  - `GET /api/public/intranet/events`
  - `GET /api/public/intranet/birthdays`
- **Gestão (com login):**
  - `GET /api/intranet/feed|events|birthdays`
  - `POST /api/intranet/posts` (publicar)
  - `POST /api/intranet/events` (criar evento)

## 🔐 Autenticação e Perfis

- **Login:** `POST /api/login` (retorna `{ ok, redirect }` e grava cookie `token`)
- **Usuário logado:** `GET /api/me`
- **Logout:** `POST /api/logout`
- **Perfis (roles) principais:** `admin`, `rh`, `rh_geral`, `dp`, `recrutamento`, `td`, `sesmt`, `portaria`, `gestor`, `supervisor`, `gerente`, `endomarketing`
- **Gestor/Supervisor/Gerente:** visualizam e registram avaliações apenas para a equipe vinculada (por colaboradores e/ou setores associados).
- **Observação (legado):** também existe login via `.env` (`RH_USER`/`RH_PASS`, `PORTARIA_USER`/`PORTARIA_PASS`) e opcionalmente via LDAP, mas o padrão atual é via tabela `users` no SQLite.

### Alertas DP (pop-up)

- Para usuários com perfil **dp**, ao entrar na área protegida, o sistema exibe um **pop-up** com alertas de:
  - **Período de experiência (45/90)** (itens próximos do vencimento e vencidos)
  - **Fim do aquisitivo de férias** (até 30 dias, incluindo vencidos)
- Os dados são obtidos por `GET /api/rh/alertas` e o pop-up aparece no máximo **1 vez por dia** (controle via `localStorage` no navegador).

### Idiomas (i18n)

- O idioma é controlado pelo `lang-switcher.js` e aplica tradução:
  - Por chaves em elementos com `data-translate`
  - Em textos dinâmicos (ex.: estados de “carregando/erro/vazio”) quando gerados via i18n no JS da página

## 🧪 Usuários de teste (ambiente dev)

Por padrão, o script [setup_auth.js](file:///c:/FormFerias/scripts/setup_auth.js) cria/atualiza os usuários abaixo com a senha `123456`:

- `admin`, `rh`, `dp`, `recrutamento`, `td`, `sesmt`, `portaria`, `gestor`, `endomkt`

Para recriar/resetar os usuários padrão:

```bash
node scripts/setup_auth.js
```

## 🧩 Variáveis de ambiente

- **Obrigatórias (produção):**
  - `JWT_SECRET`: segredo do JWT (sem isso o servidor encerra em produção)
- **Básicas:**
  - `PORT`: porta do servidor (default: `8080`)
  - `BASE_URL`: usado em links de e-mail (default: `localhost:8080`)
- **E-mail (opcional):**
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`, `MAIL_FROM`
  - `DP_EMAIL`, `GESTOR_EMAIL`
- **Autentique (opcional):**
  - `AUTENTIQUE_TOKEN`, `AUTENTIQUE_SANDBOX`
- **LDAP (opcional):**
  - `LDAP_URL`, `LDAP_DN_FORMAT`, `LDAP_SEARCH_BASE`, `LDAP_ADMIN_DN`, `LDAP_ADMIN_PASSWORD`
- **Questor (opcional):**
  - `QUESTOR_API_URL`, `QUESTOR_API_TOKEN`

## 🧯 Solução de problemas

- **“Credenciais inválidas” em usuários padrão:** rode `node scripts/setup_auth.js` para resetar a senha para `123456`.
- **“EADDRINUSE: 8080” (porta em uso):** encerre o processo que está usando a porta ou altere `PORT` no `.env`.

## 📂 Estrutura do Projeto

- `server.js`: Ponto de entrada da aplicação.
- `routes/`: Rotas da API separadas por módulo (`epis.js`, `rh.js`, `ferias.js`, etc.).
- `services/`: Lógica de negócios e serviços externos (`db.js`, `pdfService.js`, `email.js`).
- `middleware/`: Middlewares de autenticação e upload.
- `database/`: Scripts de inicialização e definição do banco SQLite.
- `protected/`: Páginas HTML restritas (Dashboards RH e Portaria).
- `public/`: Páginas e arquivos estáticos públicos.
- `data/`: Arquivos JSON (legado/backup).
