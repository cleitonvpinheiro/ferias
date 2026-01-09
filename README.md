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
    Crie um arquivo `.env` na raiz do projeto (use `.env.example` como base) e configure as chaves necessárias (SMTP, Autentique, Credenciais RH/Portaria).

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
- **Painel do RH:** `/protected/dashboard-rh.html` (Requer login RH)
- **Painel da Portaria:** `/protected/dashboard-portaria.html` (Requer login Portaria)
- **Solicitação de Férias:** `/public/ferias.html`

## 📂 Estrutura do Projeto

- `server.js`: Ponto de entrada da aplicação.
- `routes/`: Rotas da API separadas por módulo (`epis.js`, `rh.js`, `ferias.js`, etc.).
- `services/`: Lógica de negócios e serviços externos (`db.js`, `pdfService.js`, `email.js`).
- `middleware/`: Middlewares de autenticação e upload.
- `database/`: Scripts de inicialização e definição do banco SQLite.
- `protected/`: Páginas HTML restritas (Dashboards RH e Portaria).
- `public/`: Páginas e arquivos estáticos públicos.
- `data/`: Arquivos JSON (legado/backup).
