const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'database', 'formularios.db');
const db = new sqlite3.Database(DB_PATH);

const run = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this);
    });
});

const get = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
    });
});

const createRecrutamentoForm = async () => {
    const id = 'recrutamento-interno';
    const title = 'Recrutamento Interno';
    
    const existing = await get('SELECT id FROM formularios WHERE id = ?', [id]);
    if (existing) {
        console.log(`Formulário ${id} já existe. Pulando.`);
        return;
    }

    const questoes = [];
    
    // Dados da Vaga
    questoes.push({ type: 'text', text: 'Cargo Pretendido', required: true });

    // Dados do Colaborador
    questoes.push({ type: 'text', text: 'Nome Completo', required: true });
    questoes.push({ type: 'text', text: 'Cargo Atual', required: true });
    questoes.push({ type: 'text', text: 'Setor', required: true });
    questoes.push({ type: 'date', text: 'Data Admissão', required: true });
    questoes.push({ type: 'text', text: 'Tempo no cargo', required: true, placeholder: 'Ex: 1 ano e 2 meses' });
    questoes.push({ type: 'number', text: 'Salário Atual (R$)', required: true });
    questoes.push({ type: 'tel', text: 'Telefone', required: true });

    // Formação
    questoes.push({ type: 'textarea', text: 'Formação Acadêmica (Descreva)', required: true, placeholder: 'Graduação, Pós-graduação, etc.' });
    questoes.push({ type: 'textarea', text: 'Cursos Complementares (Descreva)', required: true, placeholder: 'Cursos técnicos, workshops, idiomas, etc.' });

    // Expectativas
    questoes.push({ type: 'textarea', text: 'Quais são suas expectativas para o novo cargo?', required: true });

    // Disponibilidade
    questoes.push({ 
        type: 'select', 
        text: 'Você tem disponibilidade para trabalhar em qualquer turno?', 
        options: ['Sim', 'Não'], 
        required: true 
    });
    questoes.push({ type: 'text', text: 'Por quê? (Justifique se necessário)', required: false });

    await run(`INSERT INTO formularios (id, titulo, tipo, questoes, ativo, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, title, 'recrutamento', JSON.stringify(questoes), 1, new Date().toISOString(), new Date().toISOString()]);
    
    console.log(`Criado formulário: ${title}`);
};

const createDesligamentoForm = async () => {
    const id = 'entrevista-desligamento';
    const title = 'Entrevista de Desligamento';

    const existing = await get('SELECT id FROM formularios WHERE id = ?', [id]);
    if (existing) {
        console.log(`Formulário ${id} já existe. Pulando.`);
        return;
    }

    const questoes = [];

    // Header Info
    questoes.push({ type: 'text', text: 'Nome', required: true });
    questoes.push({ type: 'text', text: 'Cargo', required: true });
    questoes.push({ type: 'date', text: 'Data Admissão', required: true });
    questoes.push({ type: 'text', text: 'Setor', required: true });
    questoes.push({ type: 'text', text: 'Chefe Imediato', required: false });
    questoes.push({ type: 'text', text: 'Armário', required: false });

    // Tipo Desligamento
    questoes.push({ 
        type: 'select', 
        text: 'TIPO DE DESLIGAMENTO', 
        options: [
            'Sem justa causa', 
            'Por justa causa', 
            'Pedido do colaborador', 
            'Distrato', 
            'Término do estágio', 
            'Aposentadoria', 
            'Outros'
        ],
        required: true 
    });

    // Motivo Desligamento
    questoes.push({ 
        type: 'select', 
        text: 'MOTIVO DO DESLIGAMENTO', 
        options: [
            // Por Pedido
            'Salário (Pedido)', 'Oportunidade de trabalho (Pedido)', 'Horário de trabalho (Pedido)', 
            'Ambiente de trabalho (Pedido)', 'Desmotivação (Pedido)', 'Problemas pessoais / familiares (Pedido)',
            // Por Dispensa
            'Baixo desempenho (Dispensa)', 'Pontualidade, assiduidade (Dispensa)', 'Não cumprimento de normas (Dispensa)',
            'Redução do quadro (Dispensa)', 'Relacionamento com chefia (Dispensa)', 'Relacionamento com colegas (Dispensa)',
            'Outros'
        ],
        required: true 
    });

    // Avaliações (Matrix expanded to questions)
    const ratingOptions = ['Ótimo', 'Bom', 'Regular', 'Ruim'];
    
    // Benefícios
    const beneficios = [
        'Alimentação - Variedade', 'Alimentação - Qualidade', 'Alimentação - Quantidade',
        'Convênio Paraná Clínica', 'Convênio OdontoPrev', 'Cartão Alimentação Senff',
        'Cartão Crédito Senff', 'Empréstimo Consignado Itaú', 'Treinamentos'
    ];
    beneficios.forEach(item => {
        questoes.push({ type: 'select', text: `BENEFÍCIOS - ${item}`, options: ratingOptions, required: false });
    });

    // Comunicação
    const comunicacao = [
        'Recursos de comunicação', 'Qualidade das informações', 
        'Periodicidade das informações', 'Variedade das informações'
    ];
    comunicacao.forEach(item => {
        questoes.push({ type: 'select', text: `COMUNICAÇÃO - ${item}`, options: ratingOptions, required: false });
    });

    // Ambiente
    const ambiente = [
        'Iluminação', 'Ruído', 'Ventilação', 'Espaço físico', 
        'Sanitários', 'Organização / Limpeza', 'Segurança'
    ];
    ambiente.forEach(item => {
        questoes.push({ type: 'select', text: `AMBIENTE - ${item}`, options: ratingOptions, required: false });
    });

    // Relacionamentos
    const relacionamentos = [
        'Chefia', 'Colegas', 'Gerência / Empresa / Diretoria', 'Clientes'
    ];
    relacionamentos.forEach(item => {
        questoes.push({ type: 'select', text: `RELACIONAMENTOS - ${item}`, options: ratingOptions, required: false });
    });

    // Perguntas Finais
    questoes.push({ type: 'text', text: 'Como você percebia o atendimento do setor de RH?', required: false });
    
    questoes.push({ type: 'select', text: 'Indicaria a empresa?', options: ['Sim', 'Não'], required: false });
    questoes.push({ type: 'text', text: 'Por quê (Indicaria)?', required: false });
    
    questoes.push({ type: 'select', text: 'Voltaria a trabalhar?', options: ['Sim', 'Não'], required: false });
    questoes.push({ type: 'text', text: 'Em que condições (Voltaria)?', required: false });
    
    questoes.push({ type: 'number', text: 'Nota para a empresa (0 a 10)', required: false });
    questoes.push({ type: 'textarea', text: 'Comentários finais', required: false });

    await run(`INSERT INTO formularios (id, titulo, tipo, questoes, ativo, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, title, 'desligamento', JSON.stringify(questoes), 1, new Date().toISOString(), new Date().toISOString()]);

    console.log(`Criado formulário: ${title}`);
};

const main = async () => {
    try {
        await createRecrutamentoForm();
        await createDesligamentoForm();
        console.log("Importação extra concluída com sucesso!");
    } catch (e) {
        console.error("Erro na importação extra:", e);
    } finally {
        db.close();
    }
};

main();
