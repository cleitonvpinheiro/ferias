const db = require('../services/db');

const forms = [
    {
        id: 'avaliacao-adm',
        titulo: 'Avaliação de Performance - Administrativo',
        tipo: 'avaliacao',
        ativo: true,
        questoes: [
            { category: "RESOLUÇÃO DE PROBLEMAS", question: "BUSCA A IMPARCIALIDADE E A JUSTIÇA QUANDO HÁ DESAVENÇA DE OPINIÕES?", type: "rating", required: true },
            { category: "COMUNICAÇÃO", question: "COMUNICA-SE COM LEALDADE, SEM ESCONDER FATOS OU OMITIR INFORMAÇÕES / RECONHECE QUE ERROU", type: "rating", required: true },
            { category: "INTELIGENCIA EMOCIONAL", question: "MANTEM A COMPOSTURA E CONTROLA O EMOCIONAL MESMO EM MOMENTOS DE DIFICULDADES", type: "rating", required: true },
            { category: "COMPROMETIMENTO", question: "CUMPRE COM PRECISÃO E EFICIÊNCIA AS ATRIBUIÇÕES QUE LHE SÃO CONFIADAS E/OU ATIVIDADES QUE LHE SÃO DELEGADAS;", type: "rating", required: true },
            { category: "PLANEJAMENTO", question: "É ORGANIZADO(A) EM SUAS ATIVIDADES, PREZANDO PELO RETORNO SEM ESPERAR SER COBRADO(A)", type: "rating", required: true },
            { category: "INICIATIVA", question: "PROPÕE MELHORIAS CONTINUAS PARA AS ATIVIDADES DO SETOR", type: "rating", required: true },
            { category: "VISÃO SISTEMICA", question: "TEM VISÃO MACRO, SAINDO DO SEU SETOR BUSCANDO SAIR DA ZONA DE CONFORTO PARA RESOLVER PROBLEMAS OU CONHECER OUTROS SETORES", type: "rating", required: true },
            { category: "TRABALHO EM EQUIPE", question: "PERCEBE A IMPORTANCIA DE SE CONECTAR COM OS OUTROS DEPARTAMENTOS DA ORGANIZAÇÃO PARA CUMPRIR SUAS TAREFAS?", type: "rating", required: true },
            { category: "DISCIPLINA", question: "SEGUE FIELMENTE OS PROCEDIMENTOS INTERNOS", type: "rating", required: true },
            { category: "EFICIENCIA", question: "SABE DEFINIR PRIORIDADES PARA ALOCAR SEU TEMPO DE FORMA A DESEMPENHAR VÁRIAS TAREFAS AO MESMO TEMPO DE FORMA EFICIENTE?", type: "rating", required: true },
            { category: "ORIENTAÇÃO AOS RESULTADOS", question: "NÃO FOGE DE NOVAS RESPONSABILIDADES", type: "rating", required: true },
            { category: "FLEXIBILIDADE", question: "É ABERTO A MUDANÇAS, CULTIVA A TRANSFORMAÇÃO", type: "rating", required: true },
            { category: "GESTÃO DO TEMPO", question: "CUMPRE PRAZOS, ENTREGANDO OS RESULTADOS NO PRAZO PROPOSTO", type: "rating", required: true },
            
            // Custom Fields mapped to questions
            { category: "AVALIAÇÃO FINAL", question: "Indicador de Status Profissional", type: "select", options: ["Desmotivado", "Pouco Motivado", "Neutro", "Motivado", "Muito Motivado"], required: true },
            { category: "AVALIAÇÃO FINAL", question: "Comentário sobre o status profissional", type: "textarea", required: false },
            { category: "FEEDBACK", question: "01. Após avaliação, cite 02 pontos positivos que lhe destacam como profissional", type: "textarea", required: true },
            { category: "FEEDBACK", question: "02. Cite 05 pontos a melhorar", type: "textarea", required: true },
            { category: "COMPROMISSO", question: "Estou ciente pela pontuação e sinalizações acima e me comprometo a desenvolver e melhorar todos os pontos acima.", type: "yesno", required: true }
        ]
    },
    {
        id: 'avaliacao-lideranca',
        titulo: 'Avaliação de Performance - Liderança',
        tipo: 'avaliacao',
        ativo: true,
        questoes: [
            { category: "PLANEJAMENTO ESTRATÉGICO", question: "POSSUI CAPACIDADE DE PLANEJAMENTO ESTRATÉGICO, OU SEJA, CONSEGUE IDENTIFICAR OS RESULTADOS DESEJADOS E O QUE PRECISA SER FEITO PARA ALCANÇA-LOS", type: "rating", required: true },
            { category: "LIDERANÇA", question: "CONSEGUE DELEGAR TAREFAS, OU SEJA, IDENTIFICA QUEM ESTÁ APTO PARA CADA ATIVIDADE E DA AUTONOMIA PARA OS SEUS LIDERADOS", type: "rating", required: true },
            { category: "BUSCA POR CONHECIMENTO", question: "DEMONSTRA VONTADE DE DESENVOLVER-SE BUSCANDO MEIOS MELHORES PARA ALCANÇAR OS RESULTADOS;", type: "rating", required: true },
            { category: "EFICIENCIA", question: "CUMPRE COM PRECISÃO E EFICIENCIA AS ATRIBUIÇÕES QUE LHE SÃO CONFIADAS E/OU ATIVIDADES QUE LHE SÃO DELEGADAS;", type: "rating", required: true },
            { category: "FLEXIBILIDADE", question: "DEMONSTRA FLEXIBILIDADE E CONSEGUE SE ADAPTAR BEM AS MUDANÇAS PROPOSTAS;", type: "rating", required: true },
            { category: "MOTIVAÇÃO", question: "DEMONSTRA SER UM GESTOR(A) INSPIRADO ESTIMULANDO CRESCIMENTO PROFISSIONAL DA SUA EQUIPE, ESTANDO ABERTO AO DIALOGO E A SER UM EXEMPLO DE CONDUTA, CONHECIMENTO E ENGAJAMENTO COM O PROPOSITO DA EMPRESA", type: "rating", required: true },
            { category: "INCENTIVO AO CRESCIMENTO", question: "POSSUI FACILIDADE EM TRANSMITIR SEU CONHECIMENTO E TREINAR SEUS LIDERADOS", type: "rating", required: true },
            { category: "EMPATIA", question: "PROCURA MANTER UM BOM CLIMA DE TRABALHO, LEVANDO EM CONSIDERAÇÃO OS VALORES E SENTIMENTOS DAS DEMAIS PESSOAS", type: "rating", required: true },
            { category: "COMUNICAÇÃO", question: "POSSUI COMUNICAÇÃO CLARA, PERSUASIVA E ESTÁ PRONTO A OUVIR E TROCAR IDEIAS COM SUA EQUIPE", type: "rating", required: true },
            { category: "ORGANIZAÇÃO", question: "MANTEM O POSTO DE TRABALHO LIMPO E ORGANIZADO (5S)", type: "rating", required: true },
            { category: "INOVAÇÃO", question: "APRESENTA IDEIAS INOVADORAS RELATIVAS AO TRABALHO COM OBJETIVO DE MELHORAR O SEU DESEMPENHO, ANALISANDO AS SITUAÇÕES DE MANEIRA FLEXÍVEL E PROPONDO ALTERNATIVAS PARA SOLUÇÃO DOS PROBLEMAS", type: "rating", required: true },
            { category: "COMPROMETIMENTO", question: "REALIZA O TRABALHO COM AGILIDADE, QUALIDADE E ENTUSIASMO", type: "rating", required: true },
            { category: "INTELIGENCIA EMOCIONAL", question: "POSSUI AUTROCONTROLE E EQUILIBRIO EMOCIONAL DIANTE DAS SITUAÇÕES PROBLEMÁTICAS, IMPREVISTAS E PRESSÕES.", type: "rating", required: true },

            { category: "AVALIAÇÃO FINAL", question: "Indicador de Status Profissional", type: "select", options: ["Desmotivado", "Pouco Motivado", "Neutro", "Motivado", "Muito Motivado"], required: true },
            { category: "AVALIAÇÃO FINAL", question: "Comentário sobre o status profissional", type: "textarea", required: false },
            { category: "FEEDBACK", question: "01. Após avaliação, cite 02 pontos positivos que lhe destacam como profissional", type: "textarea", required: true },
            { category: "FEEDBACK", question: "02. Cite 05 pontos a melhorar", type: "textarea", required: true },
            { category: "COMPROMISSO", question: "Estou ciente pela pontuação e sinalizações acima e me comprometo a desenvolver e melhorar todos os pontos acima.", type: "yesno", required: true }
        ]
    },
    {
        id: 'avaliacao-operacional',
        titulo: 'Avaliação de Performance - Operacional',
        tipo: 'avaliacao',
        ativo: true,
        questoes: [
            { category: "COMPROMETIMENTO", question: "PROMOVE FORTE APOIO A IDEOLOGIA DA EMPRESA;", type: "rating", required: true },
            { category: "RESPONSABILIDADE", question: "CUMPRE O HORÁRIO - POSSUI FALTAS E/OU ATRASOS FREQUENTES SEM JUSTIFICATIVAS;", type: "rating", required: true },
            { category: "CRESCIMENTO E DESENVOLVIMENTO", question: "DEMONSTRA VONTADE DE DESENVOLVER-SE, BUSCANDO MEIOS MELHORES PARA ALCANÇAR OS RESULTADOS;", type: "rating", required: true },
            { category: "PRO ATIVIDADE", question: "SE DISPÕE A AUXILIAR OS DEMAIS SETORES CONFORME DEMANDA (POLIVALÊNCIA);", type: "rating", required: true },
            { category: "INICIATIVA", question: "PARTICIPA DAS INICIATIVAS PROPOSTAS PELA EMPRESA;", type: "rating", required: true },
            { category: "COMPROMETIMENTO", question: "POSSUI OCORRÊNCIAS (ADVERTENCIAS VERBAIS/ESCRITAS E/OU SUSPENSÃO)", type: "rating", required: true },
            { category: "COMPROMETIMENTO", question: "UNIFORME - MANTEM LIMPO E CONSERVADO", type: "rating", required: true },
            { category: "RESPONSABILIDADE", question: "CUMPRE AS NORMAS DE SEGURANÇA - UTILIZANDO CORRETAMENTE OS EPI'S", type: "rating", required: true },
            { category: "ATENÇÃO", question: "SEGUE FIELMENTE AS INSTRUÇÕES OPERACIONAIS DE SALÃO E/OU FICHAS TECNICAS", type: "rating", required: true },
            { category: "ORGANIZAÇÃO", question: "MANTEM OS POSTOS DE TRABALHO, LIMPOS E ORGANIZADOS", type: "rating", required: true },
            { category: "COMPROMETIMENTO", question: "DEMONSTRA COMPROMETIMENTO COM A QUALIDADE - SEGUINDO CORRETAMENTE OS PROCEDIMENTOS DE HIGIENE E SEGURANÇA ALIMENTAR", type: "rating", required: true },
            { category: "RESPONSABILIDADE", question: "ATENDE O PROCEDIMENTO DE DESPERDICIO (COZINHA/SALÃO)", type: "rating", required: true },
            { category: "FOCO", question: "ATENDE AS METAS ESTABELECIDAS DIARIAMENTE", type: "rating", required: true },

            { category: "AVALIAÇÃO FINAL", question: "Indicador de Status Profissional", type: "select", options: ["Desmotivado", "Pouco Motivado", "Neutro", "Motivado", "Muito Motivado"], required: true },
            { category: "AVALIAÇÃO FINAL", question: "Comentário sobre o status profissional", type: "textarea", required: false },
            { category: "FEEDBACK", question: "01. Após avaliação, cite 02 pontos positivos que lhe destacam como profissional", type: "textarea", required: true },
            { category: "FEEDBACK", question: "02. Cite 05 pontos a melhorar", type: "textarea", required: true },
            { category: "COMPROMISSO", question: "Estou ciente pela pontuação e sinalizações acima e me comprometo a desenvolver e melhorar todos os pontos acima.", type: "yesno", required: true }
        ]
    }
];

async function migrate() {
    console.log('Iniciando migração de formulários...');
    
    for (const form of forms) {
        try {
            const existing = await db.formularios.getById(form.id);
            if (existing) {
                console.log(`Atualizando formulário: ${form.id}`);
                await db.formularios.update(form.id, form);
            } else {
                console.log(`Criando formulário: ${form.id}`);
                // Ensure createdAt is set
                form.createdAt = new Date().toISOString();
                form.updatedAt = new Date().toISOString();
                await db.formularios.create(form);
            }
        } catch (e) {
            console.error(`Erro ao processar ${form.id}:`, e.message);
        }
    }
    
    console.log('Migração concluída!');
}

migrate();
