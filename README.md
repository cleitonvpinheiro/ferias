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
- Termos de responsabilidade gerados automaticamente (PDF).
- Controle de descontos em folha com status (Pendente/Resolvido).
- Assinatura digital no ato da retirada.

### 3. 👥 Recrutamento e Seleção
- **Vagas:** Abertura e gestão de vagas (internas e externas).
- **Candidatos:** Banco de talentos e triagem de currículos.
- **Kanban:** Visualização do fluxo de processos seletivos.

### 4. 🚀 Onboarding e Treinamento (On The Job)
- Listas de verificação para novos colaboradores.
- Acompanhamento de treinamentos iniciais.

### 5. 📊 Avaliação de Experiência
- Formulários dinâmicos para avaliação (45 e 90 dias).
- Dashboards específicos para liderança e RH.

### 6. 🚪 Processo de Desligamento
- Agendamento e registro de entrevistas de desligamento.
- Checklist de devolução de ativos.

### 7. 👮 Controle de Portaria
- Interface dedicada para a portaria.
- Registro rápido de entrega de EPIs.
- Consulta de itens autorizados.

### 8. 📝 Gestão de Formulários
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

- **Portal do Colaborador:** `/` (Menu principal)
- **Login:** `/login.html`
- **Portal RH (restrito):** `/protected/index.html`
- **Painel do RH:** `/protected/dashboard-rh.html` (Requer login)
- **Painel da Portaria:** `/protected/dashboard-portaria.html` (Requer login Portaria)
- **Solicitação de Férias:** `/ferias.html`

## 🔐 Autenticação e Perfis

- **Login:** `POST /api/login` (retorna `{ ok, redirect }` e grava cookie `token`)
- **Usuário logado:** `GET /api/me`
- **Logout:** `POST /api/logout`
- **Perfis (roles) principais:** `admin`, `rh_geral`, `dp`, `recrutamento`, `td`, `sesmt`, `portaria`, `gestor`, `endomarketing`
- **Observação (legado):** também existe login via `.env` (`RH_USER`/`RH_PASS`, `PORTARIA_USER`/`PORTARIA_PASS`) e opcionalmente via LDAP, mas o padrão atual é via tabela `users` no SQLite.

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
