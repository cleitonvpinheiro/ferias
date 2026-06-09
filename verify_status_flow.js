const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const baseURL = 'http://localhost:8080/api';
const SECRET = process.env.JWT_SECRET || 'dev-jwt-secret';

async function testFlow() {
    console.log('1. Generating token locally...');
    const token = jwt.sign({ username: 'rh', role: 'rh' }, SECRET, { expiresIn: '1h' });
    console.log('Token generated.');

    const headers = {
        'Cookie': `token=${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    };

    // 2. Create Request via API
    console.log('2. Creating request via API (via /encaminhar)...');
    let id;
    const uniqueName = `Test User ${Date.now()}`;
    try {
        await axios.post(`${baseURL}/encaminhar`, {
            nome: uniqueName,
            setor: 'Test Setor',
            inicio: '2025-02-01',
            tipoGozo: '30',
            decimo: false,
            gestorEmail: 'gestor@test.com'
        }); // Public
        console.log('Request created via /encaminhar (ID unknown).');
    } catch (e) {
        console.error('Create failed:', e.message, e.response?.data);
        return;
    }

    // 2.5 Find the ID
    console.log('2.5 Finding ID...');
    try {
        const listRes = await axios.get(`${baseURL}/rh/solicitacoes`, { headers });
        const list = listRes.data;
        if (!Array.isArray(list)) {
            console.error('List response is not array:', list);
            return;
        }
        // Find by name
        const item = list.find(i => i.nome === uniqueName);
        if (!item) throw new Error('Created item not found in list');
        id = item.id;
        console.log(`ID found: ${id}`);
    } catch (e) {
        console.error('Find ID failed:', e.message);
        return;
    }

    // 3. Approve by RH (to generate signature token)
    console.log('3. Approving by RH...');
    try {
        await axios.post(`${baseURL}/solicitacao/rh-aprovar`, {
            id,
            statusRH: 'aprovado',
            justificativa: 'Approved by Test'
        }, { headers });
        console.log('Approved.');
    } catch (e) {
        console.error('Approval failed:', e.message, e.response?.data);
        return;
    }

    // 4. Get Token
    console.log('4. Fetching request to get signature token...');
    let signatureToken;
    try {
        // Need to use a route that returns the full item including token.
        // GET /solicitacao/:id is public?
        const getRes = await axios.get(`${baseURL}/solicitacao/${id}`);
        const item = getRes.data;
        console.log('Item fetched:', JSON.stringify(item, null, 2));
        signatureToken = item.signatureToken;
        if (!signatureToken) throw new Error('No signature token found');
        console.log('Token found.');
    } catch (e) {
        console.error('Fetch failed:', e.message);
        return;
    }

    // 5. Sign
    console.log('5. Signing...');
    try {
        await axios.post(`${baseURL}/solicitacao/assinar`, {
            token: signatureToken,
            assinatura: 'base64sig...'
        });
        console.log('Signed.');
    } catch (e) {
        console.error('Sign failed:', e.message, e.response?.data);
        return;
    }

    // Verify status 'assinado'
    let itemRes = await axios.get(`${baseURL}/solicitacao/${id}`);
    if (itemRes.data.status === 'assinado') {
        console.log('✅ Status is assinado (CORRECT)');
    } else {
        console.error(`❌ Status is ${itemRes.data.status} (EXPECTED: assinado)`);
    }

    // 6. Change to 'concluido'
    console.log('6. Changing to Resolvido (concluido)...');
    try {
        await axios.post(`${baseURL}/solicitacao/definir-status`, {
            id,
            status: 'concluido'
        }, { headers });
        console.log('Status change requested.');
    } catch (e) {
        console.error('Status change failed:', e.message);
    }

    itemRes = await axios.get(`${baseURL}/solicitacao/${id}`);
    if (itemRes.data.status === 'concluido') {
        console.log('✅ Status is concluido (CORRECT)');
    } else {
        console.error(`❌ Status is ${itemRes.data.status} (EXPECTED: concluido)`);
    }

    // 7. Change back to 'assinado'
    console.log('7. Changing back to Pendente (assinado)...');
    try {
        await axios.post(`${baseURL}/solicitacao/definir-status`, {
            id,
            status: 'assinado'
        }, { headers });
        console.log('Status change requested.');
    } catch (e) {
        console.error('Status change failed:', e.message);
    }

    itemRes = await axios.get(`${baseURL}/solicitacao/${id}`);
    if (itemRes.data.status === 'assinado') {
        console.log('✅ Status is assinado (CORRECT)');
    } else {
        console.error(`❌ Status is ${itemRes.data.status} (EXPECTED: assinado)`);
    }
}

testFlow();
