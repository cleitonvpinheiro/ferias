const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database/formularios.db');

const run = (query, params = []) => new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
        if (err) reject(err);
        else resolve(this);
    });
});

const get = (query, params = []) => new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
    });
});

const importFerias = async () => {
    const id = 'solicitacao-ferias';
    const title = 'Solicitação de Férias';
    
    const existing = await get('SELECT id FROM formularios WHERE id = ?', [id]);
    if (existing) {
        console.log(`Formulário ${id} já existe. Pulando.`);
        return;
    }

    const questoes = [
        { type: 'text', text: 'Nome do Colaborador', required: true, category: 'Dados do Colaborador' },
        { type: 'text', text: 'Setor', required: true, category: 'Dados do Colaborador' },
        { type: 'date', text: 'Início das Férias', required: true, category: 'Solicitação' },
        { 
            type: 'select', 
            text: 'Período de Férias', 
            required: true, 
            options: ['30 dias', '20 dias + 10 dias abono', '15 dias + 15 dias'],
            category: 'Solicitação' 
        },
        { type: 'date', text: 'Início do segundo período (se houver)', required: false, category: 'Solicitação' },
        { 
            type: 'select', 
            text: 'Solicitação adiantamento 1ª parcela de 13º', 
            required: true, 
            options: ['Sim', 'Não'],
            category: 'Solicitação' 
        },
        { type: 'email', text: 'E-mail do Gestor', required: false, category: 'Aprovação' },
        { type: 'text', text: 'Nome do Gestor (para assinatura)', required: false, category: 'Aprovação' },
        { type: 'yesno', text: 'Declaro que as informações acima são verdadeiras (Assinatura Digital)', required: true, category: 'Assinatura' }
    ];

    await run(`INSERT INTO formularios (id, titulo, tipo, questoes, ativo, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, title, 'solicitacao', JSON.stringify(questoes), 1, new Date().toISOString(), new Date().toISOString()]);
    
    console.log(`Criado formulário: ${title}`);
};

const importTaxas = async () => {
    const id = 'pagamento-taxas';
    const title = 'Pagamento de Taxas';
    
    const existing = await get('SELECT id FROM formularios WHERE id = ?', [id]);
    if (existing) {
        console.log(`Formulário ${id} já existe. Pulando.`);
        return;
    }

    const questoes = [
        { type: 'text', text: 'Nome Completo', required: true, category: 'Dados da Taxa' },
        { type: 'text', text: 'CPF', required: true, category: 'Dados da Taxa' },
        { type: 'text', text: 'Função', required: true, category: 'Dados da Taxa' },
        { type: 'text', text: 'Departamento', required: true, category: 'Dados da Taxa' },
        
        { 
            type: 'select', 
            text: 'Forma de Pagamento', 
            required: true, 
            options: ['Transferência Bancária', 'PIX'],
            category: 'Dados Bancários' 
        },
        { type: 'text', text: 'Banco (se transferência)', required: false, category: 'Dados Bancários' },
        { type: 'text', text: 'Agência (se transferência)', required: false, category: 'Dados Bancários' },
        { type: 'text', text: 'Conta com Dígito (se transferência)', required: false, category: 'Dados Bancários' },
        { 
            type: 'select', 
            text: 'Tipo de Conta', 
            required: false, 
            options: ['Corrente', 'Poupança'],
            category: 'Dados Bancários' 
        },
        { type: 'text', text: 'Chave PIX (se PIX)', required: false, category: 'Dados Bancários' },

        { 
            type: 'multi', 
            text: 'Motivo', 
            required: true, 
            options: ['Aumento de Demanda', 'Evento', 'Vaga Aberta (Antecessor)'],
            category: 'Motivo' 
        },
        { type: 'text', text: 'Nome do Antecessor (se Vaga Aberta)', required: false, category: 'Motivo' },

        { type: 'number', text: 'Valor Unitário da Taxa (R$)', required: false, category: 'Valores' },
        { type: 'number', text: 'Quantidade de Dias (Taxa)', required: false, category: 'Valores' },
        { type: 'number', text: 'Valor Unitário VT (R$)', required: false, category: 'Valores' },
        { type: 'number', text: 'Quantidade de Dias (VT)', required: false, category: 'Valores' },
        
        { type: 'textarea', text: 'Dias Trabalhados (Descreva as datas e dias da semana)', required: true, category: 'Dias Trabalhados' }
    ];

    await run(`INSERT INTO formularios (id, titulo, tipo, questoes, ativo, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, title, 'financeiro', JSON.stringify(questoes), 1, new Date().toISOString(), new Date().toISOString()]);
    
    console.log(`Criado formulário: ${title}`);
};

const importVagas = async () => {
    const id = 'abertura-vaga';
    const title = 'Abertura de Vaga';
    
    const existing = await get('SELECT id FROM formularios WHERE id = ?', [id]);
    if (existing) {
        console.log(`Formulário ${id} já existe. Pulando.`);
        return;
    }

    const questoes = [
        { type: 'text', text: 'Cargo', required: true, category: 'Dados Gerais' },
        { type: 'number', text: 'Número de Vagas', required: true, category: 'Dados Gerais' },
        { type: 'text', text: 'Setor', required: true, category: 'Dados Gerais' },
        { type: 'date', text: 'Data de Abertura', required: true, category: 'Dados Gerais' },
        { type: 'email', text: 'Email do Gestor', required: true, category: 'Dados Gerais' },

        { 
            type: 'select', 
            text: 'Motivo da Contratação', 
            required: true, 
            options: ['Substituição', 'Aumento de Quadro'],
            category: 'Motivo da Contratação' 
        },
        { type: 'text', text: 'Substituição a (Nome)', required: false, category: 'Motivo da Contratação' },
        { 
            type: 'select', 
            text: 'Será desligado?', 
            required: false, 
            options: ['Sim', 'Não'],
            category: 'Motivo da Contratação' 
        },

        { type: 'text', text: 'Reportará a quem?', required: true, category: 'Detalhes' },
        { type: 'text', text: 'Escala / Horário de Trabalho', required: true, category: 'Detalhes' },
        { 
            type: 'select', 
            text: 'Tipo de Contratação', 
            required: true, 
            options: ['Mensalista', 'Horista'],
            category: 'Detalhes' 
        },
        { type: 'text', text: 'Salário e Benefícios', required: true, category: 'Perfil da Vaga' },
        { type: 'text', text: 'Faixa Etária Preferencial', required: false, category: 'Perfil da Vaga' }
    ];

    await run(`INSERT INTO formularios (id, titulo, tipo, questoes, ativo, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, title, 'recrutamento', JSON.stringify(questoes), 1, new Date().toISOString(), new Date().toISOString()]);
    
    console.log(`Criado formulário: ${title}`);
};

const main = async () => {
    try {
        await importFerias();
        await importTaxas();
        await importVagas();
        console.log('Importação concluída com sucesso!');
    } catch (error) {
        console.error('Erro na importação:', error);
    } finally {
        db.close();
    }
};

main();
