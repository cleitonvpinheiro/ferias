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

const categories = [
    {
        name: "1. COMPROMETIMENTO",
        items: [
            "Comprimento de regras",
            "Realização de atividades estipuladas pela liderança",
            "Pontualidade",
            "Resolução de problemas"
        ]
    },
    {
        name: "2. COMUNICAÇÃO",
        items: [
            "Comunicação com colegas, líderes e demais envolvidos",
            "Comunicação escrita",
            "Entendimento sobre preocupações e necessidades",
            "Objetividade",
            "Profissionalismo",
            "Adaptação a diferentes ambientes",
            "Simpatia"
        ]
    },
    {
        name: "3. ORGANIZAÇÃO E PLANEJAMENTO",
        items: [
            "Organização com execução de atividades",
            "Planejamento de atividades, com definição e gerenciamento de prioridades"
        ]
    },
    {
        name: "4. RELACIONAMENTO INTERPESSOAL",
        items: [
            "Relacionamento interpessoal (colegas e líderes)",
            "Mantém ambiente favorável ao convívio e à execução do trabalho"
        ]
    },
    {
        name: "5. TRABALHO EM EQUIPE",
        items: [
            "Cooperação e interação com os demais membros da equipe",
            "Sabe ouvir e respeitar posições contrárias",
            "Estabelecimento de credibilidade ao interagir com funcionários, clientes internos e externos"
        ]
    },
    {
        name: "6. CONHECIMENTO TÉCNICO",
        items: [
            "Aplicação de conhecimento técnico com necessidade de supervisão",
            "Aplicação de conhecimento técnico sem necessidade de supervisão"
        ]
    },
    {
        name: "7. DESENVOLVIMENTO PROFISSIONAL",
        items: [
            "Proativo com atividades não designadas",
            "Busca aperfeiçoamento de competências por meio de treinamentos",
            "Busca constante de desenvolvimento pessoal e profissional"
        ]
    },
    {
        name: "8. DISCIPLINA",
        items: [
            "Demonstra ser disciplinado com regras ou ordens",
            "Cumprimento regras e respeita as diretrizes",
            "Perfil receptivo, entendendo a necessidade do direcionamento e das regras",
            "Aceita bem as regras, recebe com presteza as orientações"
        ]
    },
    {
        name: "9. HÁBITOS DE SEGURANÇA",
        items: [
            "Respeita as normas de segurança e utilização dos EPIS",
            "Conhecimento com as normas básicas de segurança e age de forma a evitar acidentes"
        ]
    },
    {
        name: "10. SOLUÇÃO DE PROBLEMAS",
        items: [
            "Identificação de problemas",
            "Apresentação de ideias para solução de problemas",
            "Apresentação de novas ideias e recursos para aprimorar técnicas"
        ]
    }
];

const ratingOptions = ["N - Não se aplica", "NA - Não atende", "M - Melhorar", "R - Regular", "B - Bom", "E - Excelente"];

const createExperienciaForm = async (days) => {
    const id = `avaliacao-experiencia-${days}d`;
    const title = `Avaliação de Experiência - ${days} Dias`;
    
    // Check if exists
    const existing = await get('SELECT id FROM formularios WHERE id = ?', [id]);
    if (existing) {
        console.log(`Formulário ${id} já existe. Pulando.`);
        return;
    }

    const questoes = [];
    
    // Header Info
    questoes.push({ type: 'text', text: 'Colaborador (Nome)', required: true });
    questoes.push({ type: 'text', text: 'Avaliador (Nome)', required: true });
    questoes.push({ type: 'text', text: 'Cargo', required: false }); // Usually readonly/auto
    questoes.push({ type: 'text', text: 'Setor', required: false });
    questoes.push({ type: 'date', text: 'Data de Admissão', required: true });

    // Status Section
    if (days === 45) {
        questoes.push({ 
            type: 'select', 
            text: 'Parecer da Avaliação (45 Dias)', 
            options: ['REPROVADO', 'PRORROGADO/APROVADO'],
            required: true 
        });
    } else {
        questoes.push({ 
            type: 'select', 
            text: 'Parecer da Avaliação (90 Dias)', 
            options: ['APROVADO', 'REPROVADO'],
            required: true 
        });
    }

    // Criteria
    categories.forEach(cat => {
        questoes.push({ type: 'section', text: cat.name }); // Using text as section header proxy if possible, but my schema uses flat questions.
        // I will add [SECTION] prefix or just bold text if markdown supported.
        // My current renderer renders questions sequentially.
        // I'll add a "header" type question later or just use text questions.
        // For now, let's prefix the first question of category with category name?
        // Or just add questions.
        
        cat.items.forEach(item => {
            questoes.push({
                type: 'select',
                text: `${cat.name} - ${item}`,
                options: ratingOptions,
                required: true
            });
        });
    });

    // Metas
    questoes.push({ type: 'textarea', text: 'Metas: Conhecimentos e habilidades a serem desenvolvidas', required: false });
    questoes.push({ type: 'textarea', text: 'Indicação de treinamento', required: false });
    questoes.push({ type: 'textarea', text: 'Comentários', required: false });

    await run(`INSERT INTO formularios (id, titulo, tipo, questoes, ativo, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, title, 'avaliacao', JSON.stringify(questoes), 1, new Date().toISOString(), new Date().toISOString()]);
    
    console.log(`Criado formulário: ${title}`);
};

const createOnTheJobForm = async () => {
    const id = 'on-the-job';
    const title = 'Formulário On The Job';

    const existing = await get('SELECT id FROM formularios WHERE id = ?', [id]);
    if (existing) {
        console.log(`Formulário ${id} já existe. Pulando.`);
        return;
    }

    const questoes = [];

    // Dados Iniciais
    questoes.push({ type: 'text', text: 'Colaborador', required: true });
    questoes.push({ type: 'text', text: 'Empresa', required: true });
    questoes.push({ type: 'date', text: 'Data da Proposta', required: true });
    questoes.push({ type: 'date', text: 'Vigorar a partir de', required: true });
    questoes.push({ type: 'date', text: 'Até', required: true });

    // Comparativo
    questoes.push({ type: 'text', text: 'Cargo (Atual)', required: false });
    questoes.push({ type: 'text', text: 'Cargo (Proposta)', required: false });
    questoes.push({ type: 'text', text: 'Horário (Atual)', required: false });
    questoes.push({ type: 'text', text: 'Horário (Proposta)', required: false });
    questoes.push({ type: 'text', text: 'Setor (Atual)', required: false });
    questoes.push({ type: 'text', text: 'Setor (Proposta)', required: false });
    questoes.push({ type: 'text', text: 'Observação (Atual)', required: false });
    questoes.push({ type: 'text', text: 'Observação (Proposta)', required: false });

    // Detalhes Movimentação
    questoes.push({ 
        type: 'select', 
        text: 'Nível da Movimentação/Promoção', 
        options: ['Júnior', 'Pleno', 'Sênior'],
        required: true 
    });

    questoes.push({ 
        type: 'select', 
        text: 'Faixa de Enquadramento salário', 
        options: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
        required: true 
    });

    questoes.push({ 
        type: 'select', 
        text: 'O Processo de ON THE JOB se encaixa', 
        options: ['Promoção', 'Mudança de Função', 'Enquadramento'],
        required: true 
    });

    questoes.push({ 
        type: 'select', 
        text: 'Jornada semanal', 
        options: ['Flexível', '44h', 'Cargo de Confiança', 'Horista'],
        required: true 
    });

    questoes.push({ 
        type: 'select', 
        text: 'Será necessário realizar exame de mudança de função', 
        options: ['Sim', 'Não', 'N/A'],
        required: true 
    });

    // Alteração Salarial
    questoes.push({ type: 'date', text: 'Alteração Salarial 1 - Data', required: false });
    questoes.push({ type: 'text', text: 'Alteração Salarial 1 - De (R$)', required: false });
    questoes.push({ type: 'text', text: 'Alteração Salarial 1 - Para (R$)', required: false });
    
    questoes.push({ type: 'date', text: 'Alteração Salarial 2 - Data', required: false });
    questoes.push({ type: 'text', text: 'Alteração Salarial 2 - De (R$)', required: false });
    questoes.push({ type: 'text', text: 'Alteração Salarial 2 - Para (R$)', required: false });

    // Benefícios (Simplified to 3 slots)
    for(let i=1; i<=3; i++) {
        questoes.push({ type: 'text', text: `Benefício ${i} - Nome`, required: false });
        questoes.push({ type: 'text', text: `Benefício ${i} - Imediato`, required: false });
        questoes.push({ type: 'text', text: `Benefício ${i} - Após 90 dias`, required: false });
        questoes.push({ type: 'text', text: `Benefício ${i} - Após 180 dias`, required: false });
    }

    await run(`INSERT INTO formularios (id, titulo, tipo, questoes, ativo, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, title, 'onthejob', JSON.stringify(questoes), 1, new Date().toISOString(), new Date().toISOString()]);

    console.log(`Criado formulário: ${title}`);
};

const main = async () => {
    try {
        await createExperienciaForm(45);
        await createExperienciaForm(90);
        await createOnTheJobForm();
        console.log("Importação concluída com sucesso!");
    } catch (e) {
        console.error("Erro na importação:", e);
    } finally {
        db.close();
    }
};

main();
