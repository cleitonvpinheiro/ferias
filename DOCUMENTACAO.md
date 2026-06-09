# Documentação do Projeto: Portal de Formulários e Gestão de RH - Família Madalosso

## 1. Visão Geral
O **Portal de Formulários** é uma plataforma integrada de gestão de Recursos Humanos desenvolvida para a Família Madalosso. O sistema centraliza processos de recrutamento, avaliações de desempenho, gestão de vagas, controle de benefícios e registros disciplinares.

## 2. Arquitetura Técnica
- **Backend**: Node.js com Express.
- **Frontend**: HTML5, CSS3 (Custom Properties) e JavaScript Vanilla.
- **Banco de Dados**: MySQL (MariaDB).
- **Autenticação**: JWT (JSON Web Tokens) com Refresh Tokens e rotação de sessão.
- **Segurança**: Criptografia AES-256 para dados sensíveis e Auditoria de Acessos.
- **Integrações**: OpenAI API (para análise de dados e criação de formulários).

## 3. Módulos Principais

### 3.1 Gestão de Funcionários
Centraliza os dados dos colaboradores.
- **Importação**: Suporta sincronização via Excel com mapeamento inteligente de colunas.
- **Aniversariantes**: Sistema de alertas com tratamento robusto para datas no formato brasileiro (DD/MM/AAAA).
- **Segurança**: Dados sensíveis como CPF são armazenados criptografados no banco de dados.

### 3.2 Avaliação de Experiência (45/90 Dias)
Fluxo especializado para novos colaboradores.
- **Estágios**: Avaliações distintas aos 45 e 90 dias.
- **Assinaturas Digitais**: Suporte a assinaturas de gestor e colaborador por período, com trilha de auditoria.
- **Dashboard**: Acompanhamento visual de pendências de avaliação e assinatura por etapa.

### 3.3 Gestão de Vagas e Recrutamento
Workflow completo de contratação.
- **Vagas**: Criação, aprovação e publicação de vagas.
- **Importação**: Cadastro em massa via Excel com modelo de download disponível.
- **Matching Inteligente (IA)**: Algoritmo que pontua candidatos (Matching Score) com base em:
    - Candidatura direta (100%)
    - Cargo pretendido (50%)
    - Experiência recente (40%)
    - Termos no currículo (15%)
- **Busca Externa Integrada**: Botão "Busca Ext." que automatiza consultas em LinkedIn, Indeed e Catho com base no perfil da vaga aberta.

### 3.4 Banco de Talentos (Trabalhe Conosco)
Portal público para captação de currículos.
- **Formulário Dinâmico**: Multilíngue (PT, ES, EN).
- **Segurança de Upload**: Validação rigorosa de MIME type e limite de tamanho (10MB) para currículos.
- **Rate Limiting**: Proteção contra excesso de envios de candidaturas.

### 3.5 Gestão de Formulários Dinâmicos
Construtor de formulários flexível (Pesquisas de Clima, Checklists, etc).
- **Importação via Excel**: Criação de formulários estruturados via planilha.
- **Importação via IA**: Permite colar texto bruto (Word/Forms) e utiliza IA para estruturar perguntas, tipos e categorias automaticamente.

### 3.6 Benefícios e Disciplinar
- **Benefícios**: Registro de compras de VT e outros auxílios com importação de histórico e consolidação automática.
- **Disciplinar**: Gestão de advertências e suspensões com geração automática de documentos e importação via Excel.

## 4. Segurança e Auditoria

### 4.1 Autenticação e Sessão
- **Rotação de Token**: Uso de Refresh Tokens com validade de 7 dias e rotação a cada renovação.
- **Access Tokens**: Tokens JWT de curta duração (1 hora) para maior segurança.
- **Rate Limiting**: Limites específicos para Login (15/15min) e Global para API.

### 4.2 Proteção de Dados
- **Criptografia AES-256**: Utilizada para CPF de funcionários e E-mail de usuários.
- **Auditoria (Audit Logs)**: Registro permanente de ações críticas (Login, Visualização de RH, Importações, Criação de Vagas) com IP e User Agent.

### 4.3 Proteção de Servidor
- **Helmet.js**: Cabeçalhos de segurança HTTP configurados.
- **Sanitização**: Filtros para nomes de arquivos e prevenção de XSS/Injeção.

## 5. Funcionalidades de IA (Inteligência Artificial)
O projeto utiliza a API da OpenAI para:
- **Resumo de Respostas**: Analisa feedbacks e gera insights.
- **Parse de Formulários**: Transforma textos do Word/Forms em estruturas JSON para o sistema.
- **Triagem de Candidatos**: Cálculo de Matching Score automatizado.

## 6. Testes Automatizados
O projeto utiliza **Jest** e **Supertest** para garantir a qualidade do código.
- **Unitários**: Testam funções isoladas (criptografia, validação de CPF). Localizados em `tests/unit/`.
- **Integração**: Testam o fluxo entre rotas e banco de dados (Autenticação). Localizados em `tests/integration/`.
- **Como rodar**:
    ```bash
    npm test          # Roda todos os testes
    npm run test:watch # Roda em modo observação
    ```

## 7. Procedimentos de Manutenção
- **Limpeza de Dados**: Script `clear_data.js` permite resetar o sistema preservando usuários e permissões.
- **Modelos**: Botões "Baixar Modelo" em todos os módulos de importação.

---
*Documentação atualizada em: 01/06/2026*
