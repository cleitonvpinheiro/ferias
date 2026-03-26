const nodemailer = require('nodemailer');
const axios = require('axios');
const FormData = require('form-data');
require('dotenv').config();

function resolveBaseUrl(protocol) {
  const raw = String(process.env.BASE_URL || '').trim();
  if (raw) {
    if (/^https?:\/\//i.test(raw)) return raw;
    const p = protocol || 'http';
    return `${p}://${raw}`;
  }
  const port = parseInt(String(process.env.ACTUAL_PORT || process.env.PORT || 8080), 10);
  const safePort = Number.isFinite(port) && port >= 0 && port < 65536 ? port : 8080;
  const p = protocol || 'http';
  return `${p}://localhost:${safePort}`;
}

async function enviarEmailComPDF(buffer, filename, payload) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = String(process.env.SMTP_SECURE || 'false') === 'true';
  const to = process.env.DP_EMAIL;
  const from = process.env.MAIL_FROM || user;

  const subject = `Solicitação de Férias – ${payload.nome} (${payload.statusRH === 'aprovado' ? 'APROVADO' : 'REPROVADO'})`;
  const text = `Nome: ${payload.nome}\nSetor: ${payload.setor}\nInício: ${new Date(payload.inicio).toLocaleDateString('pt-BR')}\nStatus: ${payload.statusRH === 'aprovado' ? 'APROVADO' : 'REPROVADO'}`;

  if (!host || !port || !user || !pass || !to) {
    console.log('--- EMAIL MOCK (PDF) ---');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Text: ${text}`);
    return { ok: true, mock: true };
  }
  const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
  
  try {
     await transporter.sendMail({ from, to, subject, text, attachments: [{ filename, content: buffer }] });
     return { ok: true };
  } catch (e) {
     console.error('Erro ao enviar email real:', e);
     return { ok: false, erro: e.message };
  }
}

async function notificarGestor(payload, protocol) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = String(process.env.SMTP_SECURE || 'false') === 'true';
  const from = process.env.MAIL_FROM || user;
  const emailOk = (e) => typeof e === 'string' && /[^\s@]+@[^\s@]+\.[^\s@]+/.test(e);
  const to = emailOk(payload.gestorEmail) ? payload.gestorEmail : process.env.GESTOR_EMAIL;
  
  const aprovado = payload.statusRH === 'aprovado';
  const subject = `Status Solicitação de Férias – ${payload.nome}`;
  let text = '';
  
  if (aprovado) {
    if (payload.status === 'aguardando_assinatura') {
        const baseUrl = resolveBaseUrl(protocol);
        const linkAssinatura = payload.signatureToken 
            ? `${baseUrl}/ferias.html?token=${payload.signatureToken}` 
            : 'Link indisponível';

        text = `Olá,\n\nA solicitação de férias para ${payload.nome} foi APROVADA pelo RH.\n\n` + 
               `O colaborador deve acessar o link abaixo para realizar a assinatura digital e finalizar o processo:\n\n` +
               `${linkAssinatura}\n\n` +
               `Por favor, encaminhe este link ao colaborador se necessário.`;
    } else {
        text = `Olá,\n\nA solicitação de férias para ${payload.nome} foi APROVADA e ASSINADA.\n\nO processo foi concluído com sucesso.`;
    }
  } else {
    const sug = payload.sugestaoData ? new Date(payload.sugestaoData).toLocaleDateString('pt-BR') : 'A definir';
    
    // Gera link de edição se tivermos ID e protocol
    let linkEdicao = '';
    if (payload.id && protocol) {
        const baseUrl = resolveBaseUrl(protocol);
        linkEdicao = `\n\nPara ajustar a solicitação e reenviar, clique aqui: ${baseUrl}/ferias.html?id=${payload.id}`;
    }

    text = `Olá,\n\nA solicitação de férias para ${payload.nome} foi REPROVADA pelo RH.\n\nSugestão de nova data: ${sug}.`;
    
    if (payload.justificativa) {
        text += `\n\nJustificativa: ${payload.justificativa}`;
    }

    text += `\n\nFavor realizar as alterações necessárias.${linkEdicao}`;
  }

  if (!to) {
    console.error('Email do gestor não informado para notificação', { id: payload.id });
    return { ok: false, erro: 'Email do gestor não informado' };
  }

  if (!host || !port || !user || !pass) {
    console.log('--- EMAIL MOCK (Gestor) ---');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Text: ${text}`);
    return { ok: true, mock: true };
  }

  const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });

  try {
    await transporter.sendMail({ from, to, subject, text });
    return { ok: true };
  } catch (e) {
    console.error('Erro ao enviar email gestor:', e);
    return { ok: false };
  }
}

async function enviarAutentique(buffer, filename, overrideEmail) {
  const token = process.env.AUTENTIQUE_TOKEN;
  const emailOk = (e) => typeof e === 'string' && /[^\s@]+@[^\s@]+\.[^\s@]+/.test(e);
  const gestorEmail = emailOk(overrideEmail) ? overrideEmail : process.env.GESTOR_EMAIL;
  const rhEmail = process.env.DP_EMAIL;
  const sandbox = String(process.env.AUTENTIQUE_SANDBOX || 'true') === 'true';
  
  if (!token) {
      console.log('--- AUTENTIQUE MOCK ---');
      console.log(`To (Gestor): ${gestorEmail}`);
      console.log(`To (RH): ${rhEmail}`);
      console.log(`Document: ${filename}`);
      const mockLink = 'https://sandbox.autentique.com.br/documento/mock-uuid';
      console.log(`Link: ${mockLink}`);
      return { ok: true, link: mockLink };
  }

  if (!gestorEmail) return { ok: false };
  
  const signers = [{ email: gestorEmail, action: 'SIGN' }];
  if (emailOk(rhEmail)) {
      signers.push({ email: rhEmail, action: 'SIGN' });
  }

  const operations = {
    query:
      'mutation CreateDocument($document: DocumentInput!, $signers: [SignerInput!]!, $file: Upload!) { createDocument(sandbox: ' + (sandbox ? 'true' : 'false') + ', document: $document, signers: $signers, file: $file) { id name signatures { link { short_link } } } }',
    variables: {
      document: { name: filename },
      signers: signers,
      file: null
    }
  };
  const form = new FormData();
  form.append('operations', JSON.stringify(operations));
  form.append('map', JSON.stringify({ file: ['variables.file'] }));
  form.append('file', buffer, { filename, contentType: 'application/pdf' });
  const res = await axios.post('https://api.autentique.com.br/v2/graphql', form, { headers: { Authorization: `Bearer ${token}`, ...form.getHeaders() } });
  const data = res.data;
  const link = data && data.data && data.data.createDocument && data.data.createDocument.signatures && data.data.createDocument.signatures[0] && data.data.createDocument.signatures[0].link && data.data.createDocument.signatures[0].link.short_link;
  return { ok: true, link: link || null };
}

async function enviarLinkRH(payload, protocol, id) {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const secure = String(process.env.SMTP_SECURE || 'false') === 'true';
    const to = process.env.DP_EMAIL;
    const from = process.env.MAIL_FROM || user;

    // Constrói query string com ID
    const params = new URLSearchParams();
    params.append('mode', 'rh');
    params.append('id', id);

    const baseUrl = resolveBaseUrl(protocol);
    const link = `${baseUrl}/ferias.html?${params.toString()}`;

    const subject = `Nova Solicitação de Férias – ${payload.nome}`;
    const text = `Recebida nova solicitação de férias para ${payload.nome} (${payload.setor}).\n\nClique no link abaixo para validar:\n\n${link}`;

    if (!host || !port || !user || !pass || !to) {
     console.log('--- EMAIL MOCK (Link RH) ---');
     console.log(`To: ${to}`);
     console.log(`Subject: ${subject}`);
     console.log(`Text: ${text}`);
     return { ok: true, mock: true, link };
  }
  const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
  
  await transporter.sendMail({ from, to, subject, text });
  return { ok: true, link };
}

async function enviarEmailTaxasRH(payload) {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const secure = String(process.env.SMTP_SECURE || 'false') === 'true';
    const to = process.env.DP_EMAIL;
    const from = process.env.MAIL_FROM || user;

    const subject = `Nova Solicitação de Pagamento de Taxa – ${payload.nome_taxa}`;
    const text = `Recebida nova solicitação de pagamento de taxa para ${payload.nome_taxa} (${payload.funcao}).\n\nDepartamento: ${payload.departamento}\nTotal: R$ ${payload.valores?.total_geral || '0.00'}\n\nAcesse o painel do RH para visualizar.`;

    if (!host || !port || !user || !pass || !to) {
        console.log('--- EMAIL MOCK (Taxas RH) ---');
        console.log(`To: ${to}`);
        console.log(`Subject: ${subject}`);
        console.log(`Text: ${text}`);
        return { ok: true, mock: true };
    }
    const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });

    try {
        await transporter.sendMail({ from, to, subject, text });
        return { ok: true };
    } catch (e) {
        console.error('Erro ao enviar email Taxas RH:', e);
        return { ok: false, erro: e.message };
    }
}

async function enviarEmailAprovacaoTaxa(payload, token) {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const secure = String(process.env.SMTP_SECURE || 'false') === 'true';
    const to = payload.email_gestor;
    const from = process.env.MAIL_FROM || user;

    const baseUrl = resolveBaseUrl('http');
    const linkAprovar = `${baseUrl}/api/taxas/responder-aprovacao?token=${token}&acao=aprovar`;
    const linkReprovar = `${baseUrl}/api/taxas/responder-aprovacao?token=${token}&acao=reprovar`;

    const subject = `Aprovação Necessária: Taxa - ${payload.nome_taxa}`;
    const text = `Olá,\n\nUma solicitação de taxa requer sua aprovação.\n\n` +
                 `Colaborador: ${payload.nome_taxa}\n` +
                 `Motivo: ${payload.motivo.join(', ')}\n` +
                 `Total: R$ ${payload.valores.total_geral}\n\n` +
                 `Clique abaixo para responder:\n` +
                 `APROVAR: ${linkAprovar}\n` +
                 `REPROVAR: ${linkReprovar}`;

    if (!host || !port || !user || !pass || !to) {
        console.log('--- EMAIL MOCK (Aprovação Taxa) ---');
        console.log(`To: ${to}`);
        console.log(`Subject: ${subject}`);
        console.log(`Text: ${text}`);
        return { ok: true, mock: true };
    }

    const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
    try {
        await transporter.sendMail({ from, to, subject, text });
        return { ok: true };
    } catch (e) {
        console.error('Erro ao enviar email aprovação taxa:', e);
        return { ok: false };
    }
}

async function enviarEmailResultadoTaxa(payload, aprovado) {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const secure = String(process.env.SMTP_SECURE || 'false') === 'true';
    const to = payload.email_solicitante;
    const from = process.env.MAIL_FROM || user;

    const status = aprovado ? 'APROVADA' : 'REPROVADA';
    const subject = `Solicitação de Taxa ${status} - ${payload.nome_taxa}`;
    const text = `Olá,\n\nSua solicitação de taxa para ${payload.nome_taxa} foi ${status} pelo gestor.\n\n` +
                 (aprovado ? 'Ela foi encaminhada para o RH.' : 'O processo foi encerrado.');

    if (!host || !port || !user || !pass || !to) {
        console.log('--- EMAIL MOCK (Resultado Taxa) ---');
        console.log(`To: ${to}`);
        console.log(`Subject: ${subject}`);
        console.log(`Text: ${text}`);
        return { ok: true, mock: true };
    }

    const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
    try {
        await transporter.sendMail({ from, to, subject, text });
        return { ok: true };
    } catch (e) {
        console.error('Erro ao enviar email resultado taxa:', e);
        return { ok: false };
    }
}

async function notificarGestorVaga(vaga, status, justificativa) {
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM || '"RH Madalosso" <rh@familiamadalosso.com.br>';

    const to = vaga.email_gestor;
    if (!to) {
        console.log('Sem email de gestor para notificar na vaga', vaga.id);
        return { ok: false, erro: 'Email não informado' };
    }

    const isAprovado = status === 'aprovada';
    const subject = isAprovado 
        ? `Vaga Aprovada – ${vaga.cargo}` 
        : `Vaga Rejeitada – ${vaga.cargo}`;
        
    let text = `Olá,\n\nA solicitação de vaga para o cargo de ${vaga.cargo} foi analisada pelo RH.\n\n`;
    text += `Status: ${status.toUpperCase()}\n`;
    
    if (justificativa) {
        text += `Justificativa/Observação: ${justificativa}\n`;
    }

    if (isAprovado) {
        text += `\nPróximos passos serão alinhados em breve.`;
    }

    if (!host || !port || !user || !pass) {
        console.log('--- EMAIL MOCK (Vagas) ---');
        console.log(`To: ${to}`);
        console.log(`Subject: ${subject}`);
        console.log(`Text: ${text}`);
        return { ok: true, mock: true };
    }

    try {
        const transporter = nodemailer.createTransport({ host, port, secure: false, auth: { user, pass } });
        await transporter.sendMail({ from, to, subject, text });
        return { ok: true };
    } catch (e) {
        console.error('Erro ao enviar email vaga:', e);
        return { ok: false, erro: e.message };
    }
}

async function enviarSolicitacaoAssinaturaTaxa(payload, token) {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const secure = String(process.env.SMTP_SECURE || 'false') === 'true';
    const to = payload.email_solicitante;
    const from = process.env.MAIL_FROM || user;

    const baseUrl = resolveBaseUrl('http');
    const linkAssinatura = `${baseUrl}/taxas.html?token=${token}`;

    const subject = `Assinatura Pendente: Taxa - ${payload.nome_taxa}`;
    const text = `Olá,\n\nSua solicitação de taxa foi aprovada pelo RH e aguarda sua assinatura.\n\n` +
                 `Colaborador: ${payload.nome_taxa}\n` +
                 `Total: R$ ${payload.valores?.total_geral || '0.00'}\n\n` +
                 `Clique no link abaixo para assinar e finalizar o processo:\n` +
                 `${linkAssinatura}`;

    if (!host || !port || !user || !pass || !to) {
        console.log('--- EMAIL MOCK (Assinatura Taxa) ---');
        console.log(`To: ${to}`);
        console.log(`Subject: ${subject}`);
        console.log(`Text: ${text}`);
        return { ok: true, mock: true };
    }

    const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
    try {
        await transporter.sendMail({ from, to, subject, text });
        return { ok: true };
    } catch (e) {
        console.error('Erro ao enviar email assinatura taxa:', e);
        return { ok: false };
    }
}

async function enviarEmailRecrutamentoRH(payload) {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const secure = String(process.env.SMTP_SECURE || 'false') === 'true';
    const to = process.env.DP_EMAIL;
    const from = process.env.MAIL_FROM || user;

    const subject = `Novo Recrutamento Interno – ${payload.nome}`;
    const text = `Recebida nova candidatura interna para ${payload.cargoPretendido}.\n\n` +
                 `Candidato: ${payload.nome}\n` +
                 `Setor Atual: ${payload.setor}\n` +
                 `Acesse o painel do RH para visualizar os detalhes.`;

    if (!host || !port || !user || !pass || !to) {
        console.log('--- EMAIL MOCK (Recrutamento RH) ---');
        console.log(`To: ${to}`);
        console.log(`Subject: ${subject}`);
        console.log(`Text: ${text}`);
        return { ok: true, mock: true };
    }

    const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
    try {
        await transporter.sendMail({ from, to, subject, text });
        return { ok: true };
    } catch (e) {
        console.error('Erro ao enviar email Recrutamento RH:', e);
        return { ok: false, erro: e.message };
    }
}

async function notificarRHCandidatura(payload) {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const secure = String(process.env.SMTP_SECURE || 'false') === 'true';
    const to = process.env.DP_EMAIL;
    const from = process.env.MAIL_FROM || user;

    const subject = `Nova Candidatura Recebida – ${payload.nome}`;
    const text = `Recebida nova candidatura para a vaga: ${payload.vaga_interesse || 'Geral'}.\n\nNome: ${payload.nome}\nEmail: ${payload.email}\nTelefone: ${payload.telefone}\n\nAcesse o painel do RH para visualizar o currículo e gerenciar a candidatura.`;

    if (!host || !port || !user || !pass || !to) {
        console.log('--- EMAIL MOCK (Candidatura RH) ---');
        console.log(`To: ${to}`);
        console.log(`Subject: ${subject}`);
        console.log(`Text: ${text}`);
        return { ok: true, mock: true };
    }
    const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });

    try {
        await transporter.sendMail({ from, to, subject, text });
        return { ok: true };
    } catch (e) {
        console.error('Erro ao enviar email candidatura:', e);
        return { ok: false };
    }
}

module.exports = {
    enviarEmailComPDF,
    notificarGestor,
    enviarAutentique,
    enviarLinkRH,
    enviarEmailTaxasRH,
    enviarEmailAprovacaoTaxa,
    enviarEmailResultadoTaxa,
    notificarGestorVaga,
    enviarEmailRecrutamentoRH,
    enviarSolicitacaoAssinaturaTaxa,
    notificarRHCandidatura,
    enviarEmailResultadoSolicitacaoTaxa
};

async function enviarEmailResultadoSolicitacaoTaxa(payload, aprovado) {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const secure = String(process.env.SMTP_SECURE || 'false') === 'true';
    const to = payload.email_solicitante;
    const from = process.env.MAIL_FROM || user;

    const status = aprovado ? 'APROVADA' : 'REPROVADA';
    const subject = `Solicitação de Mão de Obra ${status} - ${payload.funcao_necessaria}`;
    const text = `Olá ${payload.solicitante},\n\nSua solicitação de mão de obra (taxa) para a função ${payload.funcao_necessaria} foi ${status} pelo RH.\n\n` +
                 (aprovado ? 'O processo de contratação será iniciado.' : 'Motivo: O pedido não foi aceito neste momento.');

    if (!host || !port || !user || !pass || !to) {
        console.log('--- EMAIL MOCK (Resultado Solicitação Taxa) ---');
        console.log(`To: ${to}`);
        console.log(`Subject: ${subject}`);
        console.log(`Text: ${text}`);
        return { ok: true, mock: true };
    }

    const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
    try {
        await transporter.sendMail({ from, to, subject, text });
        return { ok: true };
    } catch (e) {
        console.error('Erro ao enviar email resultado solicitação taxa:', e);
        return { ok: false };
    }
}
