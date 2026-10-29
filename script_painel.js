import {
  auth, onAuthStateChanged, signOut,
  ADMIN_EMAILS, apiRequest, toast,
  fmtRS, fmtData, fmtDataHora, escapeHtml
} from "./firebase-config.js";

let userEmail = '';
let isAdmin = false;

// ============================================================
// AUTH
// ============================================================
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = 'index.html'; return; }
  userEmail = (user.email || '').toLowerCase();
  isAdmin = ADMIN_EMAILS.includes(userEmail);

  document.getElementById('user-email-display').textContent = userEmail;
  const badge = document.getElementById('user-role-badge');
  badge.textContent = isAdmin ? 'ADMIN' : 'PARTICIPANTE';
  badge.className = 'role-badge ' + (isAdmin ? 'admin' : 'visualizador');

  document.body.classList.toggle('is-admin', isAdmin);

  await carregarBoloes();
});

document.getElementById('btn-logout')?.addEventListener('click', async () => {
  if (!confirm('Sair do sistema?')) return;
  await signOut(auth);
  sessionStorage.clear();
  window.location.href = 'index.html';
});

// ============================================================
// LISTAR BOLÕES
// ============================================================
async function carregarBoloes() {
  const container = document.getElementById('lista-boloes');
  container.innerHTML = '<p class="loading-text"><i class="fas fa-spinner fa-spin"></i> Carregando...</p>';
  try {
    const data = await apiRequest(isAdmin ? 'listarBoloesAdmin' : 'listarMeusBoloes', {
      email: userEmail, isAdmin
    });
    const boloes = data.boloes || [];
    if (boloes.length === 0) {
      container.innerHTML = `
        <div class="sheet-empty">
          <i class="fas fa-ticket-alt"></i>
          <p>${isAdmin ? 'Nenhum bolão criado ainda.' : 'Você ainda não participa de nenhum bolão.'}</p>
          ${!isAdmin ? '<p style="font-size:0.85rem;">Use "Entrar em um bolão" com a senha recebida.</p>' : ''}
        </div>`;
      return;
    }
    container.innerHTML = boloes.map(b => renderBolaoCard(b)).join('');
  } catch (e) {
    container.innerHTML = `<div class="sheet-empty" style="color:var(--danger)"><i class="fas fa-exclamation-triangle"></i><p>Erro: ${escapeHtml(e.message)}</p></div>`;
  }
}

function renderBolaoCard(b) {
  const pct = b.max_participantes > 0
    ? Math.min(100, Math.round((b.pagos / b.max_participantes) * 100))
    : 0;
  const statusLabel = {
    ativo: 'Aberto',
    sorteado: 'Sorteado',
    encerrado: 'Encerrado'
  }[b.status] || b.status;

  const minha = b.minha_participacao;
  const meuStatus = minha
    ? (minha.status_pagamento === 'pago'
        ? '<span class="tag tag-success">PAGO</span>'
        : !minha.ativo
          ? '<span class="tag tag-danger">BLOQUEADO</span>'
          : '<span class="tag tag-warning">PAGAMENTO PENDENTE</span>')
    : '';

  return `
    <div class="bolao-card">
      <div class="bolao-card-header">
        <div>
          <div class="bolao-card-title">${escapeHtml(b.nome)}</div>
          <div class="bolao-card-sub">
            <span class="tag tag-info">${escapeHtml(b.modalidade)}</span>
            ${b.concurso ? `<span class="tag">Conc. ${escapeHtml(b.concurso)}</span>` : ''}
            <span class="tag tag-${b.status === 'ativo' ? 'success' : b.status === 'sorteado' ? 'purple' : 'danger'}">${statusLabel}</span>
            ${meuStatus}
          </div>
        </div>
        <div class="bolao-card-price">
          <span>R$</span> ${fmtRS(b.valor_participacao)}
          <small>${b.qtd_jogos} jogo${b.qtd_jogos > 1 ? 's' : ''}</small>
        </div>
      </div>

      <div class="bolao-card-body">
        <div class="bolao-info-grid">
          <div class="bolao-info-item">
            <i class="fas fa-users"></i>
            <span><strong>${b.pagos}</strong> / ${b.max_participantes} pagos</span>
          </div>
          <div class="bolao-info-item">
            <i class="fas fa-clock"></i>
            <span>${b.pendentes} pendente${b.pendentes !== 1 ? 's' : ''}</span>
          </div>
          <div class="bolao-info-item">
            <i class="fas fa-calendar"></i>
            <span>${b.data_sorteio ? fmtData(b.data_sorteio) : 'Data a definir'} ${b.hora_sorteio || ''}</span>
          </div>
          <div class="bolao-info-item">
            <i class="fas fa-hourglass-half"></i>
            <span>Prazo: ${b.prazo_pagamento ? fmtDataHora(b.prazo_pagamento) : '-'}</span>
          </div>
        </div>

        <div class="progress-bar">
          <div class="progress-fill" style="width:${pct}%"></div>
        </div>

        <div class="bolao-card-actions">
          <a href="bolao.html?id=${encodeURIComponent(b.id)}" class="btn-primary btn-sm">
            <i class="fas fa-sign-in-alt"></i>
            ${minha ? 'Acessar bolão' : 'Entrar no bolão'}
          </a>
          ${isAdmin ? `
            <button class="btn-secondary btn-sm" onclick="window.abrirEdicao('${b.id}')">
              <i class="fas fa-pen"></i> Editar
            </button>
            <button class="btn-danger btn-sm" onclick="window.excluirBolao('${b.id}', '${escapeHtml(b.nome).replace(/'/g, "\\'")}')">
              <i class="fas fa-trash"></i> Excluir
            </button>
          ` : ''}
        </div>
      </div>
    </div>
  `;
}

// ============================================================
// ENTRAR POR SENHA
// ============================================================
document.getElementById('btn-entrar-senha')?.addEventListener('click', () => {
  document.getElementById('modal-senha').classList.add('active');
  document.getElementById('senha-bolao-input').value = '';
  document.getElementById('senha-resultado').innerHTML = '';
});

document.getElementById('btn-validar-senha')?.addEventListener('click', async () => {
  const senha = document.getElementById('senha-bolao-input').value;
  const resultado = document.getElementById('senha-resultado');
  if (!senha) { toast('Informe a senha.', 'warning'); return; }
  resultado.innerHTML = '<p class="loading-text"><i class="fas fa-spinner fa-spin"></i> Verificando...</p>';
  try {
    const data = await apiRequest('validarSenhaBolao', { senha });
    const boloes = data.boloes || [];
    if (boloes.length === 0) {
      resultado.innerHTML = '<p style="color:var(--danger)">Nenhum bolão encontrado com esta senha.</p>';
      return;
    }
    resultado.innerHTML = boloes.map(b => `
      <div class="senha-result-item">
        <div>
          <strong>${escapeHtml(b.nome)}</strong>
          <div style="font-size:0.82rem;color:#6a7a8a;">
            ${escapeHtml(b.modalidade)} · ${b.concurso ? 'Conc. ' + escapeHtml(b.concurso) : 'Sem concurso'} · ${b.data_sorteio ? fmtData(b.data_sorteio) : 'Data a definir'}
          </div>
        </div>
        <a href="bolao.html?id=${encodeURIComponent(b.id)}&senha=${encodeURIComponent(senha)}" class="btn-primary btn-sm">
          Entrar
        </a>
      </div>
    `).join('');
  } catch (e) {
    resultado.innerHTML = `<p style="color:var(--danger)">${escapeHtml(e.message)}</p>`;
  }
});

// ============================================================
// CRIAR BOLÃO
// ============================================================
document.getElementById('btn-criar-bolao')?.addEventListener('click', () => {
  // Pré-preencher prazo com 7 dias
  const daqui7 = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const local = new Date(daqui7.getTime() - daqui7.getTimezoneOffset() * 60000);
  document.getElementById('novo-prazo').value = local.toISOString().slice(0, 16);
  document.getElementById('modal-criar').classList.add('active');
});

document.getElementById('form-criar-bolao')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.submitter || e.target.querySelector('button[type="submit"]');
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Criando...';

  const dados = {
    nome: document.getElementById('novo-nome').value.trim(),
    modalidade: document.getElementById('novo-modalidade').value,
    max_participantes: Number(document.getElementById('novo-max').value),
    valor_participacao: Number(document.getElementById('novo-valor').value),
    qtd_jogos: Number(document.getElementById('novo-qtd-jogos').value),
    concurso: document.getElementById('novo-concurso').value.trim(),
    senha: document.getElementById('novo-senha').value,
    data_sorteio: document.getElementById('novo-data-sorteio').value,
    hora_sorteio: document.getElementById('novo-hora-sorteio').value,
    prazo_pagamento: document.getElementById('novo-prazo').value
  };

  try {
    await apiRequest('criarBolao', { isAdmin: true, email: userEmail, dados });
    toast('Bolão criado com sucesso!', 'success');
    document.getElementById('modal-criar').classList.remove('active');
    document.getElementById('form-criar-bolao').reset();
    await carregarBoloes();
  } catch (err) {
    toast('Erro: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = original;
  }
});

// ============================================================
// AÇÕES ADMIN
// ============================================================
window.excluirBolao = async (id, nome) => {
  if (!confirm(`Excluir o bolão "${nome}"? (Será apenas desativado, os dados ficam preservados.)`)) return;
  try {
    await apiRequest('excluirBolao', { isAdmin: true, id });
    toast('Bolão excluído.', 'success');
    await carregarBoloes();
  } catch (e) {
    toast('Erro: ' + e.message, 'error');
  }
};

window.abrirEdicao = async (id) => {
  // Carregar dados do bolão e abrir modal de edição (reuso o form de criação, adaptando)
  try {
    const data = await apiRequest('obterBolao', { email: userEmail, isAdmin: true, id });
    const b = data.bolao;
    document.getElementById('novo-nome').value = b.nome;
    document.getElementById('novo-modalidade').value = b.modalidade;
    document.getElementById('novo-max').value = b.max_participantes;
    document.getElementById('novo-valor').value = b.valor_participacao;
    document.getElementById('novo-qtd-jogos').value = b.qtd_jogos;
    document.getElementById('novo-concurso').value = b.concurso || '';
    document.getElementById('novo-senha').value = '';
    document.getElementById('novo-senha').placeholder = '(deixe vazio para manter)';
    document.getElementById('novo-data-sorteio').value = (b.data_sorteio || '').slice(0, 10);
    document.getElementById('novo-hora-sorteio').value = b.hora_sorteio || '';
    document.getElementById('novo-prazo').value = (b.prazo_pagamento || '').slice(0, 16);

    // Substituir submit por edição
    const form = document.getElementById('form-criar-bolao');
    const btn = form.querySelector('button[type="submit"]');
    btn.innerHTML = '<i class="fas fa-save"></i> Salvar Alterações';
    const handler = async (ev) => {
      ev.preventDefault();
      const dados = {
        nome: document.getElementById('novo-nome').value.trim(),
        modalidade: document.getElementById('novo-modalidade').value,
        max_participantes: Number(document.getElementById('novo-max').value),
        valor_participacao: Number(document.getElementById('novo-valor').value),
        qtd_jogos: Number(document.getElementById('novo-qtd-jogos').value),
        concurso: document.getElementById('novo-concurso').value.trim(),
        data_sorteio: document.getElementById('novo-data-sorteio').value,
        hora_sorteio: document.getElementById('novo-hora-sorteio').value,
        prazo_pagamento: document.getElementById('novo-prazo').value
      };
      const novaSenha = document.getElementById('novo-senha').value;
      if (novaSenha) dados.senha = novaSenha;
      try {
        await apiRequest('atualizarBolao', { isAdmin: true, id, dados });
        toast('Bolão atualizado!', 'success');
        document.getElementById('modal-criar').classList.remove('active');
        form.removeEventListener('submit', handler);
        location.reload();
      } catch (err) {
        toast('Erro: ' + err.message, 'error');
      }
    };
    form.addEventListener('submit', handler, { once: true });
    document.getElementById('modal-criar').classList.add('active');
  } catch (e) {
    toast('Erro: ' + e.message, 'error');
  }
};