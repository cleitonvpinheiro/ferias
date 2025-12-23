const canvas = document.getElementById('assinatura');
const limparBtn = document.getElementById('limpar');
const form = document.getElementById('formVagas');
const feedback = document.getElementById('feedback');
const motivoRadios = document.querySelectorAll('input[name="motivo"]');
const substituicaoArea = document.getElementById('substituicaoArea');

let isDrawing = false;
let isSigned = false;
let ctx;

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

motivoRadios.forEach(r => {
    r.addEventListener('change', () => {
        // Lógica visual se necessário (ex: ocultar campos de substituição)
        // Por enquanto mantemos tudo visível conforme form padrão
    });
});

form.addEventListener('submit', async e => {
  e.preventDefault();
  
  const formData = {
      cargo: document.getElementById('cargo').value,
      numero_vagas: document.getElementById('numero_vagas').value,
      setor: document.getElementById('setor').value,
      data_abertura: document.getElementById('data_abertura').value,
      motivo: document.querySelector('input[name="motivo"]:checked').value,
      substituicao_nome: document.getElementById('substituicao_nome').value,
      sera_desligado: document.querySelector('input[name="sera_desligado"]:checked').value,
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
        showFeedback('Solicitação de vaga enviada com sucesso!');
        form.reset();
        limparBtn.click();
        document.getElementById('data_abertura').valueAsDate = new Date();
    } else {
        showFeedback(j.erro || 'Erro ao enviar solicitação', true);
    }
  } catch (err) {
      console.error(err);
      showFeedback('Erro de comunicação com o servidor', true);
  }
});