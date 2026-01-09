const axios = require('axios');

async function test() {
    try {
        const payload = {
            tipo: 'experiencia',
            funcionario: 'Teste Funcionario',
            avaliador: 'Teste Avaliador',
            cargo: 'Dev',
            setor: 'IT',
            dataAdmissao: '2025-01-01',
            metas: 'Meta teste',
            treinamentos: 'Treino teste',
            comentarios: 'Comentario teste',
            answers45: { 'q_0_0_45': 'B' },
            status45: 'aprovado'
        };

        const res = await axios.post('http://localhost:8080/api/avaliacao', payload);

        console.log('Status:', res.status);
        console.log('Response:', res.data);

    } catch (e) {
        console.error('Error:', e.response ? e.response.data : e.message);
    }
}

test();
