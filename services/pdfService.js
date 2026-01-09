const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const LOGO_PATH = path.join(__dirname, '..', 'assets', 'logo.png');

function pdfBufferFromData(payload) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const chunks = [];
  doc.on('data', c => chunks.push(c));
  return new Promise(resolve => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    // Logo
    if (fs.existsSync(LOGO_PATH)) {
        doc.image(LOGO_PATH, 50, 15, { width: 60 });
    }

    const titulo = 'Solicitação de Férias';
    const dataHoje = new Date().toLocaleDateString('pt-BR');
    const inicioFmt = new Date(payload.inicio).toLocaleDateString('pt-BR');
    const inicio2Fmt = payload.inicio2 ? new Date(payload.inicio2).toLocaleDateString('pt-BR') : null;

    doc.rect(50, 50, doc.page.width - 100, 60).fill('#f1f5f9');
    doc.fillColor('#0f172a').fontSize(20).text(titulo, 50, 72, { width: doc.page.width - 100, align: 'center' });
    doc.moveDown(2);

    doc.fillColor('#111827').fontSize(12);
    doc.text(`Data: ${dataHoje}`, { align: 'right' });
    doc.moveDown();

    doc.fontSize(14).fillColor('#0f172a').text('Dados do Colaborador');
    doc.moveTo(50, doc.y + 2).lineTo(doc.page.width - 50, doc.y + 2).stroke('#cbd5e1');
    doc.moveDown();

    doc.fillColor('#111827').fontSize(12);
    doc.text(`Nome`, { continued: true }).text(`: ${payload.nome}`);
    doc.text(`Setor`, { continued: true }).text(`: ${payload.setor}`);

    doc.moveDown();
    doc.fontSize(14).fillColor('#0f172a').text('Solicitação');
    doc.moveTo(50, doc.y + 2).lineTo(doc.page.width - 50, doc.y + 2).stroke('#cbd5e1');
    doc.moveDown();

    doc.fillColor('#111827').fontSize(12);
    doc.text(`Início das férias`, { continued: true }).text(`: ${inicioFmt}`);
    if (inicio2Fmt) doc.text(`Início do segundo período`, { continued: true }).text(`: ${inicio2Fmt}`);
    doc.text(`Período de Férias`, { continued: true }).text(`: ${payload.tipoGozo}`);
    doc.text(`Solicitação de 13º`, { continued: true }).text(`: ${payload.decimo ? 'Sim' : 'Não'}`);
    
    const aprovado = payload.statusRH === 'aprovado';
    doc.text(`Status RH`, { continued: true }).text(`: ${aprovado ? 'APROVADO' : 'REPROVADO'}`);
    if (!aprovado && payload.sugestaoData) {
       const sugFmt = new Date(payload.sugestaoData).toLocaleDateString('pt-BR');
       doc.text(`Sugestão de nova data`, { continued: true }).text(`: ${sugFmt}`);
    }
    
    // Configurações para as assinaturas
    doc.moveDown(2);
    const boxWidth = (doc.page.width - 100 - 20) / 3; // 3 assinaturas com 10px de gap entre elas
    const boxHeight = 100;
    let startY = doc.y;

    // --- Gestor ---
    doc.fontSize(10).fillColor('#0f172a').text('Gestor', 50, startY);
    doc.rect(50, startY + 15, boxWidth, boxHeight).stroke('#94a3b8');

    // Digital Signature Indicator for Gestor
    doc.fillColor('#6b7280').fontSize(8).text('Assinatura Eletrônica (Autentique)', 50 + 5, startY + boxHeight / 2, { width: boxWidth - 10, align: 'center' });

    const nomeGestor = payload.nomeGestor || payload.gestorEmail || 'Gestor';
    doc.fillColor('#111827').fontSize(9).text(nomeGestor, 50, startY + boxHeight + 20, { width: boxWidth, align: 'center' });

    // --- RH ---
    const xRH = 50 + boxWidth + 10;
    doc.fontSize(10).fillColor('#0f172a').text('RH', xRH, startY);
    doc.rect(xRH, startY + 15, boxWidth, boxHeight).stroke('#94a3b8');
    
    // Digital Signature Indicator for RH
    doc.fillColor('#6b7280').fontSize(8).text('Assinatura Eletrônica (Autentique)', xRH + 5, startY + boxHeight / 2, { width: boxWidth - 10, align: 'center' });
    
    doc.fillColor('#111827').fontSize(9).text('Validação RH', xRH, startY + boxHeight + 20, { width: boxWidth, align: 'center' });

    // --- Colaborador ---
    const xColab = xRH + boxWidth + 10;
    doc.fontSize(10).fillColor('#0f172a').text('Colaborador', xColab, startY);
    doc.rect(xColab, startY + 15, boxWidth, boxHeight).stroke('#94a3b8');
    if (payload.assinatura) {
        try {
            const sigBuf = Buffer.from(payload.assinatura.replace(/^data:image\/\w+;base64,/, ''), 'base64');
            doc.image(sigBuf, xColab + 5, startY + 15 + 5, { fit: [boxWidth - 10, boxHeight - 10] });
        } catch(e) { console.error('Erro img colab', e); }
    } else {
        doc.fillColor('#6b7280').fontSize(8).text('Aguardando assinatura...', xColab + 5, startY + boxHeight / 2, { width: boxWidth - 10, align: 'center' });
    }
    doc.fillColor('#111827').fontSize(9).text(payload.nome, xColab, startY + boxHeight + 20, { width: boxWidth, align: 'center' });


    doc.moveDown(12);

    doc.fillColor('#111827').fontSize(11).text('Declaro que as informações acima são verdadeiras.');
    doc.moveDown();
    doc.text('Local e data:', { continued: true }).text(` ${dataHoje}`);

    doc.end();
  });
}

function pdfBufferFromDescontoData(payload) {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    return new Promise(resolve => {
        doc.on('end', () => resolve(Buffer.concat(chunks)));

    // Logo
    if (fs.existsSync(LOGO_PATH)) {
        doc.image(LOGO_PATH, 40, 10, { width: 50 });
    }

    const titulo = 'AUTORIZAÇÃO DE DESCONTO EM FOLHA DE PAGAMENTO';
        
        // Header
        doc.rect(40, 40, doc.page.width - 80, 50).fillAndStroke('#333333', '#000000');
        doc.fillColor('#FFFFFF').fontSize(14).text(titulo, 40, 58, { width: doc.page.width - 80, align: 'center' });
        
        doc.fillColor('#000000').fontSize(12);
        doc.moveDown(4);

        doc.text(`Eu, ${payload.nome_funcionario}, portador(a) do CPF nº ${payload.cpf_funcionario}, autorizo o desconto em minha folha de pagamento referente a:`);
        doc.moveDown();

        const item = payload.itens[0]; // Assumindo 1 item por enquanto
        doc.text(`Item: ${item.nome}`);
        doc.text(`Valor Total: R$ ${item.valor.toFixed(2)}`);
        doc.text(`Parcelamento: ${payload.parcelas}x de R$ ${(item.valor / payload.parcelas).toFixed(2)}`);
        
        doc.moveDown(2);
        doc.text('Declaro estar ciente de que este valor corresponde à reposição de material/equipamento sob minha responsabilidade, conforme política da empresa.');
        
        doc.moveDown(4);
        
        // Assinatura line
        doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke();
        doc.moveDown(0.5);
        doc.text('Assinatura do Funcionário', { align: 'center' });
        
        doc.moveDown();
        doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, { align: 'right' });

        doc.end();
    });
}

function pdfBufferFromTaxaData(payload) {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  const chunks = [];
  doc.on('data', c => chunks.push(c));
  return new Promise(resolve => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    // Logo
    if (fs.existsSync(LOGO_PATH)) {
        doc.image(LOGO_PATH, 40, 10, { width: 50 });
    }

    const titulo = 'FORMULÁRIO DE PAGAMENTO DE TAXAS';
    
    // Header
    doc.rect(40, 40, doc.page.width - 80, 50).fillAndStroke('#333333', '#000000');
    doc.fillColor('#FFFFFF').fontSize(16).text(titulo, 40, 58, { width: doc.page.width - 80, align: 'center' });
    
    doc.fillColor('#000000').fontSize(10);
    let y = 100;

    const drawBox = (label, value, x, y, w, h) => {
        doc.rect(x, y, w, h).stroke();
        doc.font('Helvetica-Bold').text(label, x + 5, y + 5);
        doc.font('Helvetica').text(value || '', x + 5, y + 20);
    };

    // Nome da Taxa
    drawBox('NOME DA TAXA:', payload.nome_taxa, 40, y, doc.page.width - 80, 40);
    y += 40;

    // CPF
    drawBox('CPF:', payload.cpf, 40, y, doc.page.width - 80, 40);
    y += 40;

    // Forma de Pagamento
    const formaPagamentoText = payload.forma_pagamento === 'transferencia' ? 'TRANSFERÊNCIA BANCÁRIA' : 
                               payload.forma_pagamento === 'pix' ? 'PIX' : '';
    drawBox('FORMA DE PAGAMENTO:', formaPagamentoText, 40, y, doc.page.width - 80, 40);
    y += 40;

    // Banco | Agencia | Conta | Tipo
    const w4 = (doc.page.width - 80) / 4;
    drawBox('BANCO:', payload.banco, 40, y, w4, 40);
    drawBox('AGÊNCIA:', payload.agencia, 40 + w4, y, w4, 40);
    drawBox('CONTA:', payload.conta, 40 + w4 * 2, y, w4, 40);
    
    // Tipo de Conta Checkboxes
    doc.rect(40 + w4 * 3, y, w4, 40).stroke();
    doc.font('Helvetica-Bold').text('TIPO DE CONTA:', 40 + w4 * 3 + 5, y + 5);
    const ccCheck = payload.tipo_conta === 'corrente' ? '(X)' : '( )';
    const cpCheck = payload.tipo_conta === 'poupanca' ? '(X)' : '( )';
    doc.font('Helvetica').fontSize(8).text(`Conta Corrente ${ccCheck}`, 40 + w4 * 3 + 5, y + 20);
    doc.font('Helvetica').fontSize(8).text(`Conta Poupança ${cpCheck}`, 40 + w4 * 3 + 5, y + 30);
    doc.fontSize(10);
    y += 40;

    // PIX
    drawBox('PIX VINCULADO A CONTA:', payload.pix, 40, y, doc.page.width - 80, 40);
    y += 40;

    // Departamento | Funcao
    const w2 = (doc.page.width - 80) / 2;
    drawBox('DEPARTAMENTO:', payload.departamento, 40, y, w2, 40);
    drawBox('FUNÇÃO:', payload.funcao, 40 + w2, y, w2, 40);
    y += 40;

    // Motivo
    doc.rect(40, y, doc.page.width - 80, 30).stroke();
    doc.font('Helvetica-Bold').text('MOTIVO:', 45, y + 10);
    const motivos = payload.motivo || [];
    const mDemanda = motivos.includes('aumento_demanda') ? '(X)' : '( )';
    const mEvento = motivos.includes('evento') ? '(X)' : '( )';
    const mVaga = motivos.includes('vaga_aberta') ? '(X)' : '( )';
    
    doc.font('Helvetica').text(`${mDemanda} AUMENTO DE DEMANDA   ${mEvento} EVENTO   ${mVaga} VAGA ABERTA (ANTECESSOR): ${payload.antecessor || '________________'}`, 100, y + 10);
    y += 30;

    // Table Header
    doc.rect(40, y, doc.page.width - 80, 20).fill('#555555');
    doc.fillColor('#FFFFFF').font('Helvetica-Bold');
    doc.text('ITEM', 40, y + 5, { width: w4, align: 'center' });
    doc.text('VALOR', 40 + w4, y + 5, { width: w4, align: 'center' });
    doc.text('QUANTIDADE', 40 + w4 * 2, y + 5, { width: w4, align: 'center' });
    doc.text('TOTAL', 40 + w4 * 3, y + 5, { width: w4, align: 'center' });
    y += 20;

    // Table Rows
    const drawRow = (item, valor, qtd, total) => {
        doc.fillColor('#000000').font('Helvetica');
        doc.rect(40, y, w4, 20).stroke();
        doc.text(item, 40, y + 5, { width: w4, align: 'center' });
        
        doc.rect(40 + w4, y, w4, 20).stroke();
        doc.text(valor, 40 + w4, y + 5, { width: w4, align: 'center' });
        
        doc.rect(40 + w4 * 2, y, w4, 20).stroke();
        doc.text(qtd, 40 + w4 * 2, y + 5, { width: w4, align: 'center' });
        
        doc.rect(40 + w4 * 3, y, w4, 20).stroke();
        doc.text(total, 40 + w4 * 3, y + 5, { width: w4, align: 'center' });
        y += 20;
    };

    drawRow('TAXA', payload.valores?.taxa?.valor || '', payload.valores?.taxa?.qtd || '', payload.valores?.taxa?.total || '');
    drawRow('VT', payload.valores?.vt?.valor || '', payload.valores?.vt?.qtd || '', payload.valores?.vt?.total || '');
    
    // Total Geral
    doc.fillColor('#000000').font('Helvetica-Bold');
    doc.rect(40, y, w4, 20).stroke();
    doc.text('TOTAL', 40, y + 5, { width: w4, align: 'center' });
    doc.rect(40 + w4, y, w4 * 3, 20).stroke(); // Empty middle
    doc.rect(40 + w4 * 3, y, w4, 20).stroke();
    doc.text(payload.valores?.total_geral || '', 40 + w4 * 3, y + 5, { width: w4, align: 'center' });
    y += 30;

    // Dias Trabalhados
    doc.font('Helvetica-Bold').text('Marque os dias o mês e o a semana em que foram realizados a taxa', 40, y);
    y += 15;
    
    const dias = payload.dias_trabalhados || [];
    // Print in rows of 2
    for(let i=0; i<dias.length; i+=2) {
        const d1 = dias[i];
        const d2 = dias[i+1];
        
        let textLine = `Data: ${d1.data ? new Date(d1.data).toLocaleDateString('pt-BR') : '___/___/___'}   Dia da Semana: ${d1.dia || '_________'}`;
        if (d2) {
            textLine += `          Data: ${d2.data ? new Date(d2.data).toLocaleDateString('pt-BR') : '___/___/___'}   Dia da Semana: ${d2.dia || '_________'}`;
        }
        doc.font('Helvetica').text(textLine, 40, y);
        doc.moveTo(40, y+12).lineTo(doc.page.width - 40, y+12).stroke(); // Underline look
        y += 20;
    }
    if (dias.length === 0) {
        // Empty lines if no dates
         doc.font('Helvetica').text('Data: ___/___/___   Dia da Semana: _________          Data: ___/___/___   Dia da Semana: _________', 40, y);
         y+=20;
         doc.font('Helvetica').text('Data: ___/___/___   Dia da Semana: _________          Data: ___/___/___   Dia da Semana: _________', 40, y);
         y+=20;
    }
    y += 10;

    // Observacoes
    doc.font('Helvetica-Bold').text('Observações de pagamento:', 40, y);
    y += 15;
    doc.font('Helvetica').fontSize(9);
    
    const obsWidth = doc.page.width - 80;
    const obs1 = '• Os formulários devem serem entregues na segunda feira até as 12:00 e serão pagas na terça feira e na quinta feita até as 12:00 que serão pagas na sexta feira.';
    const h1 = doc.heightOfString(obs1, { width: obsWidth });
    doc.text(obs1, 40, y, { width: obsWidth });
    y += h1 + 5;

    const obs2 = '• Os formulários não entregues no prazo, ou em caso de falta de dados cadastrais, ou com letras ilegíveis, a taxa só será paga no prazo seguinte.';
    const h2 = doc.heightOfString(obs2, { width: obsWidth });
    doc.text(obs2, 40, y, { width: obsWidth });
    y += h2 + 60; // Garante espaço suficiente para a assinatura (que é desenhada com y-50)

    // Assinaturas
    const sigW = (doc.page.width - 80) / 2 - 20;
    
    // Taxa
    doc.moveTo(40, y).lineTo(40 + sigW, y).stroke();
    doc.font('Helvetica').fontSize(10).text('Assinatura do Taxa', 40, y + 5, { width: sigW, align: 'center' });
    if (payload.assinatura_taxa) {
        try {
            const sigBuf = Buffer.from(payload.assinatura_taxa.replace(/^data:image\/\w+;base64,/, ''), 'base64');
            // Mantendo y - 50, mas como y desceu, a assinatura sobe em relação à linha, mas fica longe do texto acima
            doc.image(sigBuf, 40 + (sigW/2) - 50, y - 50, { fit: [100, 40] });
        } catch(e) {}
    }

    // Gestor
    doc.moveTo(doc.page.width - 40 - sigW, y).lineTo(doc.page.width - 40, y).stroke();
    doc.text('Assinatura Líder/Gestor', doc.page.width - 40 - sigW, y + 5, { width: sigW, align: 'center' });
    if (payload.assinatura_gestor) {
        try {
            const sigBuf = Buffer.from(payload.assinatura_gestor.replace(/^data:image\/\w+;base64,/, ''), 'base64');
            doc.image(sigBuf, doc.page.width - 40 - sigW + (sigW/2) - 50, y - 50, { fit: [100, 40] });
        } catch(e) {}
    }
    
    y += 40;
    // Data RH
    doc.moveTo(doc.page.width - 200, y).lineTo(doc.page.width - 40, y).stroke();
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}   RH/DP`, doc.page.width - 200, y + 5, { width: 160, align: 'right' });

    doc.end();
  });
}

function pdfBufferFromVagaData(payload) {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  const chunks = [];
  doc.on('data', c => chunks.push(c));
  return new Promise(resolve => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    // Logo
    if (fs.existsSync(LOGO_PATH)) {
        doc.image(LOGO_PATH, 40, 10, { width: 50 });
    }

    const titulo = 'FORMULÁRIO ABERTURA DE VAGA DE TRABALHO';
    
    // Header Box
    doc.rect(40, 40, doc.page.width - 80, 50).fillAndStroke('#333333', '#000000');
    doc.fillColor('#FFFFFF').fontSize(16).text(titulo, 40, 58, { width: doc.page.width - 80, align: 'center' });
    
    // Reset colors for body
    doc.fillColor('#000000').fontSize(10);
    let y = 100;

    // Helper to draw labeled box
    const drawBox = (label, value, x, y, w, h) => {
        doc.rect(x, y, w, h).stroke();
        doc.font('Helvetica-Bold').text(label, x + 5, y + 5);
        doc.font('Helvetica').text(value || '', x + 5, y + 20);
    };

    // Dados Gerais Header
    doc.rect(40, y, doc.page.width - 80, 20).fill('#555555');
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').text('DADOS GERAIS', 40, y + 5, { width: doc.page.width - 80, align: 'center' });
    y += 20;

    doc.fillColor('#000000');
    // Cargo | Num Vagas
    drawBox('CARGO:', payload.cargo, 40, y, (doc.page.width - 80) * 0.7, 40);
    drawBox('NÚMERO DE VAGAS:', payload.numero_vagas, 40 + (doc.page.width - 80) * 0.7, y, (doc.page.width - 80) * 0.3, 40);
    y += 40;
    // Setor | Data
    drawBox('SETOR:', payload.setor, 40, y, (doc.page.width - 80) * 0.7, 40);
    drawBox('DATA:', new Date(payload.data_abertura).toLocaleDateString('pt-BR'), 40 + (doc.page.width - 80) * 0.7, y, (doc.page.width - 80) * 0.3, 40);
    y += 40;

    // Motivo Header
    doc.rect(40, y, doc.page.width - 80, 20).fill('#555555');
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').text('MOTIVO DA CONTRATAÇÃO', 40, y + 5, { width: doc.page.width - 80, align: 'center' });
    y += 20;

    doc.fillColor('#000000');
    // Left side: Substituicao details
    const leftW = (doc.page.width - 80) * 0.65;
    const rightW = (doc.page.width - 80) * 0.35;
    
    doc.rect(40, y, leftW, 80).stroke();
    doc.font('Helvetica-Bold').text('SUBSTITUIÇÃO (nome):', 45, y + 10);
    doc.font('Helvetica').text(payload.substituicao_nome || '__________________________', 160, y + 10);
    
    doc.font('Helvetica-Bold').text('SERÁ DESLIGADO:', 45, y + 35);
    const simCheck = payload.sera_desligado === 'sim' ? '( X )' : '(   )';
    const naoCheck = payload.sera_desligado === 'nao' ? '( X )' : '(   )';
    doc.font('Helvetica').text(`${simCheck} SIM   ${naoCheck} NÃO`, 150, y + 35);

    doc.font('Helvetica-Bold').text('REPORTARÁ A QUEM:', 45, y + 60);
    doc.font('Helvetica').text(payload.reportara_a || '__________________________', 170, y + 60);

    // Right side: Checkboxes
    doc.rect(40 + leftW, y, rightW, 80).stroke();
    const substCheck = payload.motivo === 'substituicao' ? '( X )' : '(   )';
    const aumCheck = payload.motivo === 'aumento_quadro' ? '( X )' : '(   )';
    
    doc.font('Helvetica-Bold').text(`SUBSTITUIÇÃO ${substCheck}`, 40 + leftW + 10, y + 25);
    doc.font('Helvetica-Bold').text(`AUMENTO DE QUADRO ${aumCheck}`, 40 + leftW + 10, y + 55);
    y += 80;

    // Escala / Tipo
    doc.rect(40, y, leftW, 20).fill('#555555');
    doc.fillColor('#FFFFFF').text('ESCALA / HORÁRIO DE TRABALHO', 40, y + 5, { width: leftW, align: 'center' });
    
    doc.rect(40 + leftW, y, rightW, 20).fill('#555555');
    doc.text('TIPO DE CONTRATAÇÃO', 40 + leftW, y + 5, { width: rightW, align: 'center' });
    y += 20;

    doc.fillColor('#000000');
    // Escala content
    doc.rect(40, y, leftW, 50).stroke();
    doc.font('Helvetica').text(payload.escala_horario || '', 45, y + 15, { width: leftW - 10 });

    // Tipo content
    doc.rect(40 + leftW, y, rightW, 50).stroke();
    const menCheck = payload.tipo_contratacao === 'mensalista' ? '( X )' : '(   )';
    const horCheck = payload.tipo_contratacao === 'horista' ? '( X )' : '(   )';
    doc.font('Helvetica-Bold').text(`MENSALISTA ${menCheck}`, 40 + leftW + 10, y + 15);
    doc.font('Helvetica-Bold').text(`HORISTA       ${horCheck}`, 40 + leftW + 10, y + 35);
    y += 50;

    // Salario Header
    doc.rect(40, y, doc.page.width - 80, 20).fill('#555555');
    doc.fillColor('#FFFFFF').text('SALÁRIO E BENEFÍCIOS:', 40, y + 5, { width: doc.page.width - 80, align: 'center' });
    y += 20;

    doc.fillColor('#000000');
    doc.rect(40, y, doc.page.width - 80, 40).stroke();
    doc.font('Helvetica').text(payload.salario_beneficios || '', 45, y + 10);
    y += 40;

    // Faixa Etaria | Sexo
    doc.rect(40, y, leftW, 20).fill('#555555');
    doc.fillColor('#FFFFFF').text('FAIXA ETÁRIA | IDADE', 40, y + 5, { width: leftW, align: 'center' });
    
    doc.rect(40 + leftW, y, rightW, 20).fill('#555555');
    doc.text('SEXO', 40 + leftW, y + 5, { width: rightW, align: 'center' });
    y += 20;

    doc.fillColor('#000000');
    doc.rect(40, y, leftW, 30).stroke();
    doc.font('Helvetica').text(payload.faixa_etaria || '', 45, y + 10);

    doc.rect(40 + leftW, y, rightW, 30).stroke();
    doc.font('Helvetica').text(payload.sexo || '', 40 + leftW + 10, y + 10);
    y += 30;

    // Detalhamento Header
    doc.rect(40, y, doc.page.width - 80, 35).fill('#555555');
    doc.fillColor('#FFFFFF').text('DETALHAMENTO DA FUNÇÃO (Competências Técnicas e Comportamentais):', 40, y + 5, { width: doc.page.width - 80, align: 'center' });
    y += 35;

    doc.fillColor('#000000');
    doc.rect(40, y, doc.page.width - 80, 80).stroke();
    doc.font('Helvetica').text(payload.detalhamento_funcao || '', 45, y + 10, { width: doc.page.width - 90 });
    y += 80;

    // Assinaturas
    y += 20;
    const wSig = (doc.page.width - 80) / 3;
    
    // Solicitante
    doc.moveTo(40, y).lineTo(40 + wSig - 10, y).stroke();
    doc.text('SOLICITANTE', 40, y + 5, { width: wSig - 10, align: 'center' });
    
    // Gerente
    doc.moveTo(40 + wSig, y).lineTo(40 + wSig * 2 - 10, y).stroke();
    doc.text('GERENTE DA ÁREA', 40 + wSig, y + 5, { width: wSig - 10, align: 'center' });
    
    // Diretoria
    doc.moveTo(40 + wSig * 2, y).lineTo(doc.page.width - 40, y).stroke();
    doc.text('DIRETORIA', 40 + wSig * 2, y + 5, { width: wSig, align: 'center' });

    doc.end();
  });
}

function pdfBufferFromEntrevistaDesligamentoData(payload) {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    return new Promise(resolve => {
        doc.on('end', () => resolve(Buffer.concat(chunks)));

        // Logo
        if (fs.existsSync(LOGO_PATH)) {
            doc.image(LOGO_PATH, 40, 10, { width: 50 });
        }

        const titulo = 'FORMULÁRIO ENTREVISTA DE DESLIGAMENTO';
        
        // Header Box
        doc.rect(40, 40, doc.page.width - 80, 50).fillAndStroke('#333333', '#000000');
        doc.fillColor('#FFFFFF').fontSize(16).text(titulo, 40, 58, { width: doc.page.width - 80, align: 'center' });
        
        doc.fillColor('#000000').fontSize(10);
        let y = 100;

        const drawBox = (label, value, x, y, w, h) => {
            doc.rect(x, y, w, h).stroke();
            doc.font('Helvetica-Bold').text(label, x + 5, y + 5);
            doc.font('Helvetica').text(value || '', x + 5, y + 20);
        };

        // Line 1: Nome, Data
        const wDate = 100;
        const wName = (doc.page.width - 80) - wDate;
        drawBox('NOME:', payload.nome, 40, y, wName, 40);
        drawBox('DATA:', new Date(payload.createdAt).toLocaleDateString('pt-BR'), 40 + wName, y, wDate, 40);
        y += 40;

        // Line 2: Cargo, Admissão
        drawBox('CARGO:', payload.cargo, 40, y, wName, 40);
        drawBox('DATA ADMISSÃO:', new Date(payload.data_admissao).toLocaleDateString('pt-BR'), 40 + wName, y, wDate, 40);
        y += 40;

        // Line 3: Setor, Chefe
        const wHalf = (doc.page.width - 80) / 2;
        drawBox('SETOR:', payload.setor, 40, y, wHalf, 40);
        drawBox('CHEFE IMEDIATO:', payload.chefe, 40 + wHalf, y, wHalf, 40);
        y += 40;

        // Line 4: Armário
        drawBox('ARMÁRIO:', payload.armario, 40, y, doc.page.width - 80, 40);
        y += 50;

        // TIPO DE DESLIGAMENTO
        doc.font('Helvetica-Bold').fontSize(11).text('TIPO DE DESLIGAMENTO:', 40, y);
        y += 15;
        doc.font('Helvetica').fontSize(10);
        
        const tipos = [
            'Sem justa causa', 'Por justa causa', 'Pedido do colaborador', 'Distrato',
            'Término do estágio', 'Aposentadoria', 'Outros'
        ];
        
        let xPos = 40;
        tipos.forEach((t, i) => {
            const checked = payload.tipo_desligamento === t ? '(X)' : '( )';
            doc.text(`${checked} ${t}`, xPos, y);
            if (i === 3) { // Break line
                y += 15;
                xPos = 40;
            } else {
                xPos += 130;
            }
        });
        y += 25;

        // MOTIVO
        doc.font('Helvetica-Bold').fontSize(11).text('MOTIVO DO DESLIGAMENTO:', 40, y);
        y += 15;
        
        // Two columns
        const col1X = 40;
        const col2X = 300;
        
        doc.font('Helvetica-Bold').fontSize(10).text('- POR PEDIDO', col1X, y);
        doc.text('- POR DISPENSA', col2X, y);
        y += 15;

        const motivosPedido = [
            'Salário', 'Oportunidade de trabalho', 'Horário de trabalho', 'Ambiente de trabalho',
            'Desmotivação', 'Problemas pessoais / familiares', 'Distrato', 'Outros'
        ];
        const motivosDispensa = [
            'Baixo desempenho', 'Pontualidade, assiduidade', 'Não cumprimento de normas',
            'Redução do quadro', 'Relacionamento com chefia', 'Relacionamento com colegas', 'Outros'
        ];

        doc.font('Helvetica').fontSize(9);
        let yStart = y;
        motivosPedido.forEach(m => {
            const checked = payload.motivo_desligamento === m ? '(X)' : '( )';
            doc.text(`${checked} ${m}`, col1X, y);
            y += 12;
        });

        let yMax = y;
        y = yStart;
        motivosDispensa.forEach(m => {
            const checked = payload.motivo_desligamento === m ? '(X)' : '( )';
            doc.text(`${checked} ${m}`, col2X, y);
            y += 12;
        });

        y = Math.max(y, yMax) + 10;

        // AVALIAÇÕES (Tables)
        const drawEvaluationTable = (title, items, keyPrefix) => {
             if (y > 700) { doc.addPage(); y = 50; }
             
             doc.font('Helvetica-Bold').fontSize(11).text(title, 40, y);
             doc.fontSize(9).text('Graus: Ótimo (O) Bom (B) Regular (Rg) Ruim (Ru)', 300, y);
             y += 15;

             // Header
             const wLabel = 250;
             const wOpt = 40;
             doc.rect(40, y, wLabel, 20).fillAndStroke('#e5e7eb', '#000000');
             doc.fillColor('#000000').text('ITEM', 45, y + 5);
             
             ['O', 'B', 'Rg', 'Ru'].forEach((h, i) => {
                 doc.rect(40 + wLabel + (i * wOpt), y, wOpt, 20).fillAndStroke('#e5e7eb', '#000000');
                 doc.fillColor('#000000').text(h, 40 + wLabel + (i * wOpt) + 10, y + 5);
             });
             y += 20;

             // Rows
             items.forEach(item => {
                 doc.rect(40, y, wLabel, 20).stroke();
                 doc.text(item.label, 45, y + 5);
                 
                 const val = payload.avaliacoes ? payload.avaliacoes[keyPrefix + '_' + item.id] : null;
                 
                 ['O', 'B', 'Rg', 'Ru'].forEach((opt, i) => {
                     doc.rect(40 + wLabel + (i * wOpt), y, wOpt, 20).stroke();
                     if (val === opt) {
                         doc.font('Helvetica-Bold').text('X', 40 + wLabel + (i * wOpt) + 15, y + 5);
                         doc.font('Helvetica');
                     }
                 });
                 y += 20;
             });
             y += 10;
        };

        drawEvaluationTable('BENEFÍCIOS', [
            { id: 'alim_var', label: 'Alimentação - Variedade' },
            { id: 'alim_qual', label: 'Alimentação - Qualidade' },
            { id: 'alim_qtd', label: 'Alimentação - Quantidade' },
            { id: 'conv_parana', label: 'Convênio Paraná Clínica' },
            { id: 'conv_odonto', label: 'Convênio OdontoPrev' },
            { id: 'card_alim', label: 'Cartão Alimentação Senff' },
            { id: 'card_cred', label: 'Cartão Crédito Senff' },
            { id: 'emp_itau', label: 'Empréstimo Consignado Itaú' },
            { id: 'treinamentos', label: 'Treinamentos' }
        ], 'beneficios');

        doc.addPage(); 
        y = 50;

        drawEvaluationTable('COMUNICAÇÃO', [
            { id: 'recursos', label: 'Recursos de comunicação' },
            { id: 'qualidade', label: 'Qualidade das informações' },
            { id: 'periodicidade', label: 'Periodicidade das informações' },
            { id: 'variedade', label: 'Variedade das informações' }
        ], 'comunicacao');

        drawEvaluationTable('AMBIENTE DE TRABALHO', [
            { id: 'ilum', label: 'Iluminação' },
            { id: 'ruido', label: 'Ruído' },
            { id: 'vent', label: 'Ventilação' },
            { id: 'espaco', label: 'Espaço físico' },
            { id: 'sanit', label: 'Sanitários' },
            { id: 'limpeza', label: 'Organização / Limpeza' },
            { id: 'seguranca', label: 'Segurança' }
        ], 'ambiente');

        drawEvaluationTable('RELACIONAMENTOS', [
            { id: 'chefia', label: 'Chefia' },
            { id: 'colegas', label: 'Colegas' },
            { id: 'diretoria', label: 'Gerência / Empresa / Diretoria' },
            { id: 'clientes', label: 'Clientes' }
        ], 'relacionamento');

        // Open Questions
        doc.font('Helvetica-Bold').text('Como você percebia o atendimento do setor de RH?', 40, y);
        y += 15;
        doc.font('Helvetica').text(payload.percepcao_rh || '', 40, y);
        y += 30;

        doc.font('Helvetica-Bold').text('Você indicaria o Madalosso como uma boa empresa para se trabalhar?', 40, y);
        y += 15;
        doc.font('Helvetica').text(`${payload.indicaria_empresa === 'sim' ? 'Sim' : 'Não'}. Por quê: ${payload.indicaria_porque || ''}`, 40, y);
        y += 30;

        doc.font('Helvetica-Bold').text('Você voltaria a trabalhar no Madalosso?', 40, y);
        y += 15;
        doc.font('Helvetica').text(`${payload.voltaria_trabalhar === 'sim' ? 'Sim' : 'Não'}. Condições: ${payload.voltaria_condicoes || ''}`, 40, y);
        y += 30;

        doc.font('Helvetica-Bold').text('De 0 a 10, que nota você daria ao Madalosso?', 40, y);
        y += 15;
        doc.font('Helvetica').text(payload.nota_empresa || '-', 40, y);
        y += 30;

        doc.font('Helvetica-Bold').text('COMENTÁRIOS:', 40, y);
        y += 15;
        doc.font('Helvetica').text(payload.comentarios || '', 40, y, { width: doc.page.width - 80 });

        doc.end();
    });
}

function pdfBufferFromOnTheJobData(payload) {
    const doc = new PDFDocument({ size: 'A4', margin: 30 });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    return new Promise(resolve => {
        doc.on('end', () => resolve(Buffer.concat(chunks)));

        // Logo
        if (fs.existsSync(LOGO_PATH)) {
            doc.image(LOGO_PATH, 40, 20, { width: 50 });
        }

        const titulo = 'FORMULÁRIO ON THE JOB';
        
        // Header Box
        doc.rect(30, 20, doc.page.width - 60, 60).fillAndStroke('#1f1f1f', '#000000');
        doc.fillColor('#FFFFFF').fontSize(16).text(titulo, 30, 45, { width: doc.page.width - 60, align: 'center' });
        
        // Info Right
        doc.fontSize(8).text('Código: FORM-RH-051', doc.page.width - 150, 25, { width: 110, align: 'right' });
        doc.text('Elaboração: 16/05/2025', doc.page.width - 150, 35, { width: 110, align: 'right' });
        doc.text('Revisão: 00', doc.page.width - 150, 45, { width: 110, align: 'right' });
        doc.text('Data de revisão: 16/05/2025', doc.page.width - 150, 55, { width: 110, align: 'right' });

        let y = 90;
        doc.fillColor('#000000').fontSize(10);

        const drawField = (label, value, x, y, w, h) => {
             doc.rect(x, y, w, h).stroke();
             doc.font('Helvetica-Bold').text(label, x + 5, y + 5);
             doc.font('Helvetica').text(value || '', x + 5, y + 18);
        }

        const wFull = doc.page.width - 60;
        
        drawField('Colaborador:', payload.colaborador, 30, y, wFull, 35);
        y += 35;
        drawField('Empresa:', payload.empresa, 30, y, wFull, 35);
        y += 35;
        drawField('Data da Proposta:', payload.dataProposta ? new Date(payload.dataProposta).toLocaleDateString('pt-BR') : '', 30, y, wFull, 35);
        y += 35;
        
        const wHalf = wFull / 2;
        drawField('Vigorar a partir de:', payload.vigorarInicio ? new Date(payload.vigorarInicio).toLocaleDateString('pt-BR') : '', 30, y, wHalf, 35);
        drawField('Até:', payload.vigorarFim ? new Date(payload.vigorarFim).toLocaleDateString('pt-BR') : '', 30 + wHalf, y, wHalf, 35);
        y += 45;

        // Comparison Table
        const wCol1 = wFull * 0.3;
        const wCol2 = wFull * 0.35;
        const wCol3 = wFull * 0.35;
        
        doc.font('Helvetica-Bold');
        doc.rect(30, y, wCol1, 20).stroke();
        doc.text('Informações', 30, y+5, { width: wCol1, align: 'center' });
        doc.rect(30+wCol1, y, wCol2, 20).stroke();
        doc.text('Atual', 30+wCol1, y+5, { width: wCol2, align: 'center' });
        doc.rect(30+wCol1+wCol2, y, wCol3, 20).stroke();
        doc.text('Proposta', 30+wCol1+wCol2, y+5, { width: wCol3, align: 'center' });
        y += 20;

        const drawCompRow = (label, v1, v2) => {
             doc.font('Helvetica');
             doc.rect(30, y, wCol1, 25).stroke();
             doc.text(label, 30, y+8, { width: wCol1, align: 'center' });
             
             doc.rect(30+wCol1, y, wCol2, 25).stroke();
             doc.text(v1 || '', 30+wCol1, y+8, { width: wCol2, align: 'center' });
             
             doc.rect(30+wCol1+wCol2, y, wCol3, 25).stroke();
             doc.text(v2 || '', 30+wCol1+wCol2, y+8, { width: wCol3, align: 'center' });
             y += 25;
        }

        const c = payload.comparativo || {};
        drawCompRow('Cargo:', c.cargo?.atual, c.cargo?.proposta);
        drawCompRow('Horário:', c.horario?.atual, c.horario?.proposta);
        drawCompRow('Setor:', c.setor?.atual, c.setor?.proposta);
        drawCompRow('Observação:', c.obs?.atual, c.obs?.proposta);

        y += 20;

        // Radios
        const drawRadioGroup = (title, options, selected) => {
            doc.font('Helvetica-Bold').text(title, 30, y);
            y += 15;
            doc.font('Helvetica');
            let x = 30;
            options.forEach(opt => {
                const isSelected = opt.value === selected;
                const mark = isSelected ? '( X )' : '(   )';
                const text = `${mark} ${opt.label}   `;
                doc.text(text, x, y);
                x += doc.widthOfString(text);
            });
            y += 20;
        };

        const m = payload.movimentacao || {};
        drawRadioGroup('Nível da Movimentação/Promoção:', [
            {l: 'Júnior', v: 'junior'}, {l: 'Pleno', v: 'pleno'}, {l: 'Sênior', v: 'senior'}
        ].map(x => ({label: x.l, value: x.v})), m.nivel);

        // Faixa
        doc.font('Helvetica-Bold').text('Faixa de Enquadramento salário:', 30, y);
        y += 15;
        doc.font('Helvetica');
        let line = '';
        for(let i=1; i<=10; i++) {
             const mark = String(m.faixa) === String(i) ? '( X )' : '(   )';
             line += `${mark} ${i}  `;
        }
        doc.text(line, 30, y);
        y += 20;

        drawRadioGroup('O Processo de ON THE JOB se encaixa:', [
            {l: 'Promoção', v: 'promocao'}, {l: 'Mudança de Função', v: 'mudanca'}, {l: 'Enquadramento', v: 'enquadramento'}
        ].map(x => ({label: x.l, value: x.v})), m.processo);

        drawRadioGroup('Jornada semanal:', [
            {l: 'Flexível', v: 'flexivel'}, {l: '44h', v: '44h'}, {l: 'Cargo de Confiança', v: 'confianca'}, {l: 'Horista', v: 'horista'}
        ].map(x => ({label: x.l, value: x.v})), m.jornada);

        drawRadioGroup('Será necessário realizar exame de mudança de função:', [
            {l: 'Sim', v: 'sim'}, {l: 'Não', v: 'nao'}, {l: 'N/A', v: 'na'}
        ].map(x => ({label: x.l, value: x.v})), m.exame);
        
        y += 10;

        // Salary Table
        const wS1 = wFull * 0.2;
        const wS2 = wFull * 0.2;
        const wS3 = wFull * 0.3;
        const wS4 = wFull * 0.3;

        doc.font('Helvetica-Bold');
        doc.rect(30, y, wS1, 20).stroke(); doc.text('Informações', 30, y+5, {width: wS1, align:'center'});
        doc.rect(30+wS1, y, wS2, 20).stroke(); doc.text('Data', 30+wS1, y+5, {width: wS2, align:'center'});
        doc.rect(30+wS1+wS2, y, wS3, 20).stroke(); doc.text('De: Atual', 30+wS1+wS2, y+5, {width: wS3, align:'center'});
        doc.rect(30+wS1+wS2+wS3, y, wS4, 20).stroke(); doc.text('Para: Proposta', 30+wS1+wS2+wS3, y+5, {width: wS4, align:'center'});
        y+=20;

        const salarios = payload.salarios || [];
        salarios.forEach(s => {
             doc.font('Helvetica');
             doc.rect(30, y, wS1, 25).stroke(); doc.text('Salário:', 30, y+8, {width: wS1, align:'center'});
             doc.rect(30+wS1, y, wS2, 25).stroke(); doc.text(s.data ? new Date(s.data).toLocaleDateString('pt-BR') : '', 30+wS1, y+8, {width: wS2, align:'center'});
             doc.rect(30+wS1+wS2, y, wS3, 25).stroke(); doc.text(`R$ ${s.de || ''}`, 30+wS1+wS2, y+8, {width: wS3, align:'center'});
             doc.rect(30+wS1+wS2+wS3, y, wS4, 25).stroke(); doc.text(`R$ ${s.para || ''}`, 30+wS1+wS2+wS3, y+8, {width: wS4, align:'center'});
             y+=25;
        });

        doc.addPage();
        
        // Header Repeated
        doc.rect(30, 20, doc.page.width - 60, 60).fillAndStroke('#1f1f1f', '#000000');
        doc.fillColor('#FFFFFF').fontSize(16).text(titulo, 30, 45, { width: doc.page.width - 60, align: 'center' });
        y = 100;

        doc.fillColor('#000000').fontSize(10);
        
        // Benefits Table
        const wB1 = wFull * 0.4;
        const wB2 = wFull * 0.2;
        const wB3 = wFull * 0.2;
        const wB4 = wFull * 0.2;

        doc.font('Helvetica-Bold');
        doc.rect(30, y, wB1, 20).stroke(); doc.text('Benefício', 30, y+5, {width: wB1, align:'center'});
        doc.rect(30+wB1, y, wB2, 20).stroke(); doc.text('Imediato', 30+wB1, y+5, {width: wB2, align:'center'});
        doc.rect(30+wB1+wB2, y, wB3, 20).stroke(); doc.text('Após 90 dias', 30+wB1+wB2, y+5, {width: wB3, align:'center'});
        doc.rect(30+wB1+wB2+wB3, y, wB4, 20).stroke(); doc.text('Após 180 dias', 30+wB1+wB2+wB3, y+5, {width: wB4, align:'center'});
        y+=20;

        doc.font('Helvetica');
        const beneficios = payload.beneficios || [];
        for(let i=0; i<Math.max(6, beneficios.length); i++) {
             const b = beneficios[i] || {};
             doc.rect(30, y, wB1, 25).stroke(); doc.text(b.beneficio || '', 30, y+8, {width: wB1, align:'center'});
             doc.rect(30+wB1, y, wB2, 25).stroke(); doc.text(b.imediato || '', 30+wB1, y+8, {width: wB2, align:'center'});
             doc.rect(30+wB1+wB2, y, wB3, 25).stroke(); doc.text(b.apos90 || '', 30+wB1+wB2, y+8, {width: wB3, align:'center'});
             doc.rect(30+wB1+wB2+wB3, y, wB4, 25).stroke(); doc.text(b.apos180 || '', 30+wB1+wB2+wB3, y+8, {width: wB4, align:'center'});
             y+=25;
        }

        doc.end();
    });
}

function pdfBufferFromRecrutamentoInternoData(payload) {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    return new Promise(resolve => {
        doc.on('end', () => resolve(Buffer.concat(chunks)));

        // Logo
        if (fs.existsSync(LOGO_PATH)) {
            doc.image(LOGO_PATH, 40, 10, { width: 50 });
        }

        const titulo = 'FORMULÁRIO RECRUTAMENTO INTERNO';
        
        // Header Box
        doc.rect(40, 40, doc.page.width - 80, 50).fillAndStroke('#333333', '#000000');
        doc.fillColor('#FFFFFF').fontSize(16).text(titulo, 40, 58, { width: doc.page.width - 80, align: 'center' });
        
        // Header Info (Right side)
        doc.fontSize(8).text('Código: FORM-RH-029', doc.page.width - 150, 45, { width: 100, align: 'right' });
        doc.text('Revisão: 00', doc.page.width - 150, 55, { width: 100, align: 'right' });
        doc.text('Data de revisão: 14/05/2025', doc.page.width - 150, 65, { width: 100, align: 'right' });

        doc.fillColor('#000000').fontSize(10);
        let y = 100;

        const drawBox = (label, value, x, y, w, h) => {
            doc.rect(x, y, w, h).stroke();
            doc.font('Helvetica-Bold').text(label, x + 5, y + 5);
            doc.font('Helvetica').text(value || '', x + 5, y + 20);
        };

        const wFull = doc.page.width - 80;
        const wHalf = wFull / 2;

        drawBox('NOME DO CANDIDATO:', payload.nome, 40, y, wFull, 40);
        y += 40;

        drawBox('CARGO ATUAL:', payload.cargo_atual, 40, y, wHalf, 40);
        drawBox('SETOR:', payload.setor, 40 + wHalf, y, wHalf, 40);
        y += 40;

        drawBox('CARGO PRETENDIDO:', payload.cargo_pretendido, 40, y, wHalf, 40);
        drawBox('GESTOR ATUAL:', payload.gestor_atual, 40 + wHalf, y, wHalf, 40);
        y += 40;

        drawBox('DATA DA SOLICITAÇÃO:', new Date(payload.created_at || payload.createdAt).toLocaleDateString('pt-BR'), 40, y, wFull, 40);
        y += 50;

        // RH Evaluation Section
        doc.font('Helvetica-Bold').fontSize(12).text('AVALIAÇÃO DO RH', 40, y);
        y += 20;

        doc.font('Helvetica-Bold').fontSize(10).text('Status:', 40, y);
        doc.font('Helvetica').text(payload.status || 'Pendente', 100, y);
        y += 20;

        doc.font('Helvetica-Bold').text('Observações:', 40, y);
        y += 15;
        doc.rect(40, y, wFull, 100).stroke();
        doc.font('Helvetica').text(payload.observacao_rh || '', 45, y + 5, { width: wFull - 10 });
        y += 110;

        // Signatures
        y += 30;
        const sigW = wFull / 3;

        doc.moveTo(40, y).lineTo(40 + sigW - 10, y).stroke();
        doc.text('Candidato', 40, y + 5, { width: sigW - 10, align: 'center' });

        doc.moveTo(40 + sigW, y).lineTo(40 + sigW * 2 - 10, y).stroke();
        doc.text('Gestor Atual', 40 + sigW, y + 5, { width: sigW - 10, align: 'center' });

        doc.moveTo(40 + sigW * 2, y).lineTo(doc.page.width - 40, y).stroke();
        doc.text('RH', 40 + sigW * 2, y + 5, { width: sigW, align: 'center' });

        doc.end();
    });
}

function pdfBufferFromAvaliacaoData(payload) {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    return new Promise(resolve => {
        doc.on('end', () => resolve(Buffer.concat(chunks)));

        if (fs.existsSync(LOGO_PATH)) {
            doc.image(LOGO_PATH, 40, 10, { width: 50 });
        }

        const titulo = 'RELATÓRIO DE AVALIAÇÃO DE DESEMPENHO';
        
        doc.rect(40, 40, doc.page.width - 80, 50).fillAndStroke('#333333', '#000000');
        doc.fillColor('#FFFFFF').fontSize(16).text(titulo, 40, 58, { width: doc.page.width - 80, align: 'center' });
        
        doc.fillColor('#000000').fontSize(10);
        let y = 100;

        const wFull = doc.page.width - 80;
        
        doc.font('Helvetica-Bold').text(`Avaliado: ${payload.avaliado}`, 40, y);
        y += 15;
        doc.text(`Avaliador: ${payload.avaliador}`, 40, y);
        y += 15;
        doc.text(`Data: ${new Date(payload.createdAt).toLocaleDateString('pt-BR')}`, 40, y);
        y += 15;
        doc.text(`Tipo: ${payload.tipo}`, 40, y);
        y += 30;

        // Scores
        if (payload.notas) {
            doc.font('Helvetica-Bold').fontSize(12).text('Notas por Competência', 40, y);
            y += 20;
            
            doc.font('Helvetica').fontSize(10);
            Object.entries(payload.notas).forEach(([key, val]) => {
                doc.text(`${key}: ${val}`, 40, y);
                y += 15;
            });
            y += 10;
        }

        // Comments
        if (payload.comentarios) {
            doc.font('Helvetica-Bold').fontSize(12).text('Comentários', 40, y);
            y += 20;
            doc.font('Helvetica').fontSize(10);
            doc.text(payload.comentarios, 40, y, { width: wFull });
            y += doc.heightOfString(payload.comentarios, { width: wFull }) + 20;
        }

        doc.end();
    });
}

function pdfBufferFromMovimentacao(payload) {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    return new Promise(resolve => {
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        
        if (fs.existsSync(LOGO_PATH)) {
            doc.image(LOGO_PATH, 40, 10, { width: 50 });
        }

        const titulo = 'SOLICITAÇÃO DE MOVIMENTAÇÃO DE PESSOAL';
        doc.rect(40, 40, doc.page.width - 80, 50).fillAndStroke('#333333', '#000000');
        doc.fillColor('#FFFFFF').fontSize(16).text(titulo, 40, 58, { width: doc.page.width - 80, align: 'center' });
        
        doc.fillColor('#000000').fontSize(10);
        let y = 100;
        const wFull = doc.page.width - 80;

        // Common fields
        const fields = [
            { label: 'Nome do Colaborador', value: payload.nome || payload.nome_colaborador || payload.colaborador },
            { label: 'Data da Solicitação', value: new Date(payload.createdAt).toLocaleDateString('pt-BR') },
            { label: 'Tipo de Movimentação', value: payload.tipo_movimentacao || payload.tipo || 'N/A' },
            { label: 'Empresa', value: payload.empresa },
            { label: 'Filial', value: payload.filial },
            { label: 'Centro de Custo', value: payload.centro_custo },
        ];

        fields.forEach(f => {
            if (f.value) {
                doc.font('Helvetica-Bold').text(`${f.label}:`, 40, y);
                doc.font('Helvetica').text(String(f.value), 180, y);
                y += 20;
            }
        });

        y += 20;
        doc.font('Helvetica-Bold').fontSize(12).text('Detalhes da Movimentação', 40, y);
        y += 20;
        doc.font('Helvetica').fontSize(10);

        // Dynamic fields for "De" -> "Para"
        const changes = [
            { label: 'Cargo', from: payload.cargo_atual, to: payload.novo_cargo },
            { label: 'Setor', from: payload.setor_atual, to: payload.novo_setor },
            { label: 'Salário', from: payload.salario_atual, to: payload.novo_salario },
            { label: 'Horário', from: payload.horario_atual, to: payload.novo_horario },
            { label: 'Gestor', from: payload.gestor_atual, to: payload.novo_gestor },
        ];

        changes.forEach(c => {
            if (c.from || c.to) {
                doc.font('Helvetica-Bold').text(c.label, 40, y);
                y += 15;
                doc.font('Helvetica').text(`Atual: ${c.from || '-'}`, 60, y);
                doc.text(`Novo: ${c.to || '-'}`, 300, y);
                y += 20;
            }
        });

        if (payload.justificativa) {
            y += 20;
            doc.font('Helvetica-Bold').text('Justificativa:', 40, y);
            y += 15;
            doc.font('Helvetica').text(payload.justificativa, 40, y, { width: wFull });
            y += doc.heightOfString(payload.justificativa, { width: wFull }) + 20;
        }

        // Signatures
        y += 50;
        if (y > doc.page.height - 100) {
            doc.addPage();
            y = 50;
        }

        const sigW = wFull / 3;
        doc.moveTo(40, y).lineTo(40 + sigW - 10, y).stroke();
        doc.text('Solicitante', 40, y + 5, { width: sigW - 10, align: 'center' });

        doc.moveTo(40 + sigW, y).lineTo(40 + sigW * 2 - 10, y).stroke();
        doc.text('Gerência', 40 + sigW, y + 5, { width: sigW - 10, align: 'center' });

        doc.moveTo(40 + sigW * 2, y).lineTo(doc.page.width - 40, y).stroke();
        doc.text('RH', 40 + sigW * 2, y + 5, { width: sigW, align: 'center' });

        doc.end();
    });
}

function pdfBufferFromUniformeData(payload) {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    return new Promise(resolve => {
        doc.on('end', () => resolve(Buffer.concat(chunks)));

        if (fs.existsSync(LOGO_PATH)) {
            doc.image(LOGO_PATH, 40, 10, { width: 50 });
        }

        const titulo = 'RECIBO DE ENTREGA DE UNIFORMES';
        doc.rect(40, 40, doc.page.width - 80, 50).fillAndStroke('#333333', '#000000');
        doc.fillColor('#FFFFFF').fontSize(16).text(titulo, 40, 58, { width: doc.page.width - 80, align: 'center' });
        
        doc.fillColor('#000000').fontSize(10);
        let y = 100;
        const wFull = doc.page.width - 80;

        doc.font('Helvetica-Bold').text(`Colaborador: ${payload.nome}`, 40, y);
        y += 20;
        doc.text(`Data da Solicitação: ${new Date(payload.createdAt).toLocaleDateString('pt-BR')}`, 40, y);
        y += 20;
        doc.text(`Setor: ${payload.setor || 'N/A'}`, 40, y);
        y += 20;
        doc.text(`Cargo: ${payload.cargo || 'N/A'}`, 40, y);
        y += 40;

        doc.font('Helvetica-Bold').fontSize(12).text('Itens Solicitados', 40, y);
        y += 20;
        doc.font('Helvetica').fontSize(10);

        if (Array.isArray(payload.itens)) {
            payload.itens.forEach(item => {
                doc.circle(50, y + 5, 2).fill();
                doc.text(typeof item === 'string' ? item : `${item.item} (Qtd: ${item.quantidade || 1}) - Tam: ${item.tamanho || 'U'}`, 60, y);
                y += 20;
            });
        } else if (typeof payload.itens === 'string') {
             doc.text(payload.itens, 40, y, { width: wFull });
             y += 30;
        }

        y += 30;
        doc.font('Helvetica-Oblique').fontSize(8).text('Declaro que recebi os uniformes acima descritos em perfeito estado de conservação e me comprometo a utilizá-los conforme as normas da empresa.', 40, y, { width: wFull });
        
        y += 60;
        
        // Signatures
        const sigW = wFull / 2;
        doc.moveTo(40, y).lineTo(40 + sigW - 20, y).stroke();
        doc.text('Colaborador', 40, y + 5, { width: sigW - 20, align: 'center' });

        doc.moveTo(40 + sigW, y).lineTo(doc.page.width - 40, y).stroke();
        doc.text('Responsável Entrega', 40 + sigW, y + 5, { width: sigW, align: 'center' });

        doc.end();
    });
}

function pdfBufferFromCandidato(payload) {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    return new Promise(resolve => {
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        
        if (fs.existsSync(LOGO_PATH)) {
            doc.image(LOGO_PATH, 40, 10, { width: 50 });
        }

        const titulo = 'FICHA DE CANDIDATO';
        doc.rect(40, 40, doc.page.width - 80, 50).fillAndStroke('#333333', '#000000');
        doc.fillColor('#FFFFFF').fontSize(16).text(titulo, 40, 58, { width: doc.page.width - 80, align: 'center' });
        
        doc.fillColor('#000000').fontSize(10);
        let y = 100;
        const wFull = doc.page.width - 80;

        doc.font('Helvetica-Bold').text('Nome:', 40, y);
        doc.font('Helvetica').text(payload.nome, 100, y);
        y += 20;

        doc.font('Helvetica-Bold').text('Email:', 40, y);
        doc.font('Helvetica').text(payload.email, 100, y);
        y += 20;

        doc.font('Helvetica-Bold').text('Telefone:', 40, y);
        doc.font('Helvetica').text(payload.telefone, 100, y);
        y += 20;

        if (payload.vaga_interesse) {
             doc.font('Helvetica-Bold').text('Vaga:', 40, y);
             doc.font('Helvetica').text(payload.vaga_interesse, 100, y);
             y += 20;
        }

        doc.font('Helvetica-Bold').text('Data Cadastro:', 40, y);
        doc.font('Helvetica').text(new Date(payload.createdAt).toLocaleDateString('pt-BR'), 140, y);
        y += 20;

        doc.font('Helvetica-Bold').text('Status:', 40, y);
        doc.font('Helvetica').text(payload.status, 100, y);
        y += 40;

        if (payload.historico && payload.historico.length > 0) {
            doc.font('Helvetica-Bold').fontSize(12).text('Histórico', 40, y);
            y += 20;
            doc.font('Helvetica').fontSize(10);
            
            payload.historico.forEach(h => {
                doc.text(`${new Date(h.data).toLocaleDateString('pt-BR')} - ${h.acao}: ${h.detalhe}`, 40, y, { width: wFull });
                y += 20;
                if (h.observacao) {
                    doc.font('Helvetica-Oblique').text(`Obs: ${h.observacao}`, 60, y, { width: wFull - 20 });
                    y += 20;
                    doc.font('Helvetica');
                }
            });
        }

        doc.end();
    });
}

module.exports = {
    pdfBufferFromData,
    pdfBufferFromDescontoData,
    pdfBufferFromTaxaData,
    pdfBufferFromVagaData,
    pdfBufferFromEntrevistaDesligamentoData,
    pdfBufferFromRecrutamentoInternoData,
    pdfBufferFromOnTheJobData,
    pdfBufferFromAvaliacaoData,
    pdfBufferFromMovimentacao,
    pdfBufferFromUniformeData,
    pdfBufferFromCandidato
};

