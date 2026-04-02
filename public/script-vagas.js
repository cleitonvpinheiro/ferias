const canvas = document.getElementById('assinatura');
const limparBtn = document.getElementById('limpar');
const form = document.getElementById('formVagas');
const feedback = document.getElementById('feedback');
const motivoRadios = document.querySelectorAll('input[name="motivo"]');
const substituicaoArea = document.getElementById('substituicaoArea');
const setorSelect = document.getElementById('setor');
const cargoSelect = document.getElementById('cargo');
const substituicaoSelect = document.getElementById('substituicao_nome');
const emailGestorInput = document.getElementById('email_gestor');
const dataDesligamentoArea = document.getElementById('dataDesligamentoArea');
const dataDesligamentoInput = document.getElementById('data_desligamento');
const seraDesligadoRadios = document.querySelectorAll('input[name="sera_desligado"]');
const seraDesligadoArea = document.getElementById('seraDesligadoArea');

let isDrawing = false;
let isSigned = false;
let ctx;
let funcionariosCache = [];
let currentRole = '';

// Configurar data de abertura para hoje
document.getElementById('data_abertura').valueAsDate = new Date();

function resizeCanvas() {
  const ratio = Math.max(window.devicePixelRatio || 1, 1);
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * ratio;
  canvas.height = rect.height * ratio;
  ctx = canvas.getContext('2d');
  ctx.scale(ratio, ratio);
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#111827';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, rect.width, rect.height);
}

function pointerPos(e) {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
  const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;
  return { x, y };
}

canvas.addEventListener('pointerdown', e => {
  isDrawing = true;
  isSigned = true;
  const { x, y } = pointerPos(e);
  ctx.beginPath();
  ctx.moveTo(x, y);
});

canvas.addEventListener('pointermove', e => {
  if (!isDrawing) return;
  const { x, y } = pointerPos(e);
  ctx.lineTo(x, y);
  ctx.stroke();
});

canvas.addEventListener('pointerup', () => { isDrawing = false; });
canvas.addEventListener('pointerleave', () => { isDrawing = false; });

limparBtn.addEventListener('click', () => {
  const rect = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, rect.width, rect.height);
  isSigned = false;
});

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function showFeedback(msg, isError = false) {
  feedback.textContent = msg;
  feedback.style.color = isError ? 'var(--error)' : 'var(--success)';
  feedback.hidden = false;
}

async function getMe() {
  const r = await fetch('/api/me');
  if (!r.ok) throw new Error('not-authenticated');
  const data = await r.json();
  return data && data.user ? data.user : data;
}

async function loadFuncionariosByRole(role) {
  const r0 = String(role || '').trim().toLowerCase();
  const endpoint = ['gestor', 'supervisor', 'gerente'].includes(r0) ? '/api/gestor/equipe' : '/api/funcionarios';
  const r = await fetch(endpoint);
  if (!r.ok) {
    const j = await r.json().catch(() => null);
    const msg = (j && (j.erro || j.message)) ? (j.erro || j.message) : 'Erro ao carregar funcionários';
    throw new Error(msg);
  }
  const data = await r.json();
  return Array.isArray(data) ? data : (Array.isArray(data.equipe) ? data.equipe : []);
}

function uniqueSorted(values) {
  return [...new Set(values.map(v => String(v).trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
}

function setOptions(selectEl, options, { placeholder = 'Selecione...', value = '' } = {}) {
  if (!selectEl) return;
  selectEl.innerHTML = '';
  const opt0 = document.createElement('option');
  opt0.value = value;
  opt0.textContent = placeholder;
  selectEl.appendChild(opt0);

  options.forEach(o => {
    const opt = document.createElement('option');
    opt.value = o;
    opt.textContent = o;
    selectEl.appendChild(opt);
  });
}

function formatCpf(v) {
  const cpf = String(v || '').replace(/\D/g, '');
  if (cpf.length !== 11) return '';
  return cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
}

function setSubstituicaoOptions(funcionarios) {
  if (!substituicaoSelect) return;
  substituicaoSelect.innerHTML = '';
  const opt0 = document.createElement('option');
  opt0.value = '';
  opt0.textContent = 'Selecione...';
  substituicaoSelect.appendChild(opt0);

  const items = Array.isArray(funcionarios) ? funcionarios.slice() : [];
  items
    .filter(f => f && f.nome)
    .sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR', { sensitivity: 'base' }))
    .forEach(f => {
      const opt = document.createElement('option');
      const id = f.id ? String(f.id) : String(f.nome);
      const cpfFmt = formatCpf(f.cpf);
      opt.value = id;
      opt.textContent = cpfFmt ? `${f.nome} (${cpfFmt})` : String(f.nome);
      opt.dataset.nome = String(f.nome);
      if (f.cpf) opt.dataset.cpf = String(f.cpf).replace(/\D/g, '');
      if (f.matricula) opt.dataset.matricula = String(f.matricula).replace(/\D/g, '');
      substituicaoSelect.appendChild(opt);
    });
}

function filterEquipeForSubstituicao() {
  const setor = String(setorSelect && setorSelect.value || '').trim();
  const cargo = String(cargoSelect && cargoSelect.value || '').trim();

  const bySetor = setor
    ? funcionariosCache.filter(f => String(f && f.setor || '').trim() === setor)
    : [];

  if (!cargo) return bySetor;

  return bySetor.filter(f => String(f && f.cargo || '').trim() === cargo);
}

function refreshCargoAndSubstituicaoBySetor() {
  const setor = String(setorSelect.value || '').trim();
  const filtered = setor
    ? funcionariosCache.filter(f => String(f.setor || '').trim() === setor)
    : [];

  const cargos = uniqueSorted(filtered.map(f => f.cargo));
  const prevCargo = cargoSelect ? String(cargoSelect.value || '').trim() : '';
  setOptions(cargoSelect, cargos);
  if (cargoSelect && prevCargo && cargos.includes(prevCargo)) {
    cargoSelect.value = prevCargo;
  }

  setSubstituicaoOptions(filterEquipeForSubstituicao());
}

function refreshSetores() {
  const setores = uniqueSorted(funcionariosCache.map(f => f.setor));
  setOptions(setorSelect, setores);
  refreshCargoAndSubstituicaoBySetor();
}

function toggleSubstituicaoArea() {
  const motivo = document.querySelector('input[name="motivo"]:checked')?.value || '';
  const isSub = motivo === 'substituicao';
  substituicaoArea.style.display = isSub ? '' : 'none';
  if (!isSub) {
    if (substituicaoSelect) substituicaoSelect.value = '';
    if (dataDesligamentoInput) dataDesligamentoInput.value = '';
    if (substituicaoSelect) substituicaoSelect.required = false;
    if (dataDesligamentoInput) dataDesligamentoInput.required = false;
    seraDesligadoRadios.forEach(r => {
      r.disabled = false;
    });
    if (seraDesligadoArea) seraDesligadoArea.style.display = 'none';
  } else {
    if (substituicaoSelect) substituicaoSelect.required = true;
    if (dataDesligamentoInput) dataDesligamentoInput.required = true;
    const sim = document.querySelector('input[name="sera_desligado"][value="sim"]');
    if (sim) sim.checked = true;
    seraDesligadoRadios.forEach(r => {
      r.disabled = true;
    });
    if (seraDesligadoArea) seraDesligadoArea.style.display = 'none';
  }
  toggleDataDesligamento();
}

function toggleDataDesligamento() {
  const motivo = document.querySelector('input[name="motivo"]:checked')?.value || '';
  const isSub = motivo === 'substituicao';
  const show = isSub;
  if (dataDesligamentoArea) dataDesligamentoArea.style.display = show ? '' : 'none';
  if (!show && dataDesligamentoInput) dataDesligamentoInput.value = '';
}

async function init() {
  try {
    const me = await getMe();
    currentRole = me && me.role ? String(me.role).trim().toLowerCase() : '';

    const username = me && me.username ? String(me.username) : '';
    const email = me && me.email ? String(me.email) : (username ? `${username}@familiamadalosso.com.br` : '');
    if (emailGestorInput) {
      emailGestorInput.value = email;
      emailGestorInput.readOnly = true;
    }

    funcionariosCache = await loadFuncionariosByRole(currentRole);
    refreshSetores();

    if (setorSelect) {
      setorSelect.addEventListener('change', () => {
        refreshCargoAndSubstituicaoBySetor();
      });
    }
    if (cargoSelect) {
      cargoSelect.addEventListener('change', () => {
        setSubstituicaoOptions(filterEquipeForSubstituicao());
      });
    }
  } catch (_) {
    window.location.href = '/login.html';
  }
}

motivoRadios.forEach(r => {
    r.addEventListener('change', () => {
        toggleSubstituicaoArea();
    });
});

seraDesligadoRadios.forEach(r => {
  r.addEventListener('change', () => {
    toggleDataDesligamento();
  });
});

toggleSubstituicaoArea();
init();

form.addEventListener('submit', async e => {
  e.preventDefault();

  const motivo = document.querySelector('input[name="motivo"]:checked')?.value || '';
  const substituicaoOpt = substituicaoSelect && substituicaoSelect.selectedOptions ? substituicaoSelect.selectedOptions[0] : null;
  const substituicao_id = substituicaoSelect ? String(substituicaoSelect.value || '').trim() : '';
  const substituicao_nome = substituicaoOpt && substituicaoOpt.dataset && substituicaoOpt.dataset.nome
    ? String(substituicaoOpt.dataset.nome)
    : '';
  const substituicao_cpf = substituicaoOpt && substituicaoOpt.dataset && substituicaoOpt.dataset.cpf
    ? String(substituicaoOpt.dataset.cpf).replace(/\D/g, '')
    : '';
  
  const formData = {
      cargo: document.getElementById('cargo').value,
      numero_vagas: document.getElementById('numero_vagas').value,
      setor: document.getElementById('setor').value,
      data_abertura: document.getElementById('data_abertura').value,
      motivo,
      substituicao_id,
      substituicao_nome,
      substituicao_cpf,
      sera_desligado: motivo === 'substituicao' ? 'sim' : (document.querySelector('input[name="sera_desligado"]:checked')?.value || 'nao'),
      data_desligamento: document.getElementById('data_desligamento') ? document.getElementById('data_desligamento').value : '',
      reportara_a: document.getElementById('reportara_a').value,
      escala_horario: document.getElementById('escala_horario').value,
      tipo_contratacao: document.querySelector('input[name="tipo_contratacao"]:checked').value,
      salario_beneficios: document.getElementById('salario_beneficios').value,
      faixa_etaria: document.getElementById('faixa_etaria').value,
      sexo: document.getElementById('sexo').value,
      detalhamento_atividades: document.getElementById('detalhamento_atividades').value,
      experiencia: document.getElementById('experiencia').value,
      formacao: document.getElementById('formacao').value,
      requisitos: document.getElementById('requisitos').value,
      observacao: document.getElementById('observacao').value,
      email_gestor: document.getElementById('email_gestor').value,
      assinatura: isSigned ? canvas.toDataURL('image/png') : null
  };

  if (!formData.cargo || !formData.setor || !formData.numero_vagas || !formData.data_abertura || !formData.reportara_a || !formData.salario_beneficios || !formData.email_gestor) {
      showFeedback('Preencha todos os campos obrigatórios (*)', true);
      return;
  }

  if (motivo === 'substituicao' && !String(formData.substituicao_id || '').trim()) {
    showFeedback('Selecione o colaborador que será desligado.', true);
    return;
  }
  if (motivo === 'substituicao' && !String(formData.data_desligamento || '').trim()) {
    showFeedback('Informe a data prevista de desligamento.', true);
    return;
  }
  
  if (!isSigned) {
      showFeedback('Por favor, assine no campo indicado.', true);
      return;
  }

  try {
    const r = await fetch('/api/vagas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    const j = await r.json();
    
    if (j.ok) {
        const msg = currentRole === 'supervisor'
          ? 'Solicitação enviada para aprovação do gerente.'
          : 'Solicitação de vaga enviada com sucesso!';
        showFeedback(msg);
        form.reset();
        limparBtn.click();
        document.getElementById('data_abertura').valueAsDate = new Date();
        toggleSubstituicaoArea();
    } else {
        showFeedback(j.erro || 'Erro ao enviar solicitação', true);
    }
  } catch (err) {
      console.error(err);
      showFeedback('Erro de comunicação com o servidor', true);
  }
});
