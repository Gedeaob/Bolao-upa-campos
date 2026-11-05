import {
  auth, onAuthStateChanged, signOut,
  ADMIN_EMAILS, MODALIDADES, calcularValorJogo, gerarSenhaAleatoria,
  apiRequest, invalidarCacheApi,
  toast, fmtRS, fmtData, fmtDataHora, escapeHtml,
  horaHHmm                                       // ⬅️ NOVO
} from "./firebase-config.js";

let userEmail = '';
let isAdmin   = false;
let editandoId = null;

// ============================================================
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = 'index.html'; return; }
  userEmail = (user.email || '').toLowerCase();
  isAdmin   = ADMIN_EMAILS.includes(userEmail);

  document.getElementById('user-email-display').textContent = userEmail;
  const badge = document.getElementById('user-role-badge');
  badge.textContent = isAdmin ? 'ADMIN' : 'PARTICIPANTE';
  badge.className   = 'role-badge ' + (isAdmin ? 'admin' : 'visualizador');
  document.body.classList.toggle('is-admin', isAdmin);

  popularModalidades();
  window.atualizarCamposModalidade();
  await carregarBoloes();
});

document.getElementById('btn-logout')?.addEventListener('click', async () => {
  if (!confirm('Sair do sistema?')) return;
  await signOut(auth); sessionStorage.clear();
  window.location.href = 'index.html';
});

// ============================================================
// MODALIDADES + VALOR DINÂMICO + DEZENAS
// ============================================================
function popularModalidades() {
  const sel = document.getElementById('novo-modalidade');
  if (!sel) return;
  sel.innerHTML = Object.entries(MODALIDADES)
    .map(([key, v]) => `<option value="${key}">${v.label}</option>`)
    .join('');
}

window.atualizarCamposModalidade = function() {
  const modalidade = document.getElementById('novo-modalidade').value;
  const m = MODALIDADES[modalidade];
  if (!m) return;

  const dezenasInput = document.getElementById('novo-dezenas');
  dezenasInput.min = m.qtd;
  dezenasInput.max = m.maxDezenas || m.qtd;
  dezenasInput.value = m.qtd;

  const help = document.getElementById('dezenas-help');
  if (m.maxDezenas && m.maxDezenas > m.qtd) {
    help.innerHTML = `Aceita <strong>${m.qtd}</strong> a <strong>${m.maxDezenas}</strong> dezenas. Aposta base: R$ ${m.precoBase.toFixed(2)}`;
  } else {
    help.innerHTML = `${m.qtd} dezenas fixas. Aposta base: R$ ${m.precoBase.toFixed(2)}`;
  }
  window.atualizarValorSugerido();
};

window.atualizarValorSugerido = function() {
  const modalidade = document.getElementById('novo-modalidade').value;
  const dezenas = Number(document.getElementById('novo-dezenas').value) || 6;
  const qtdJogos = Number(document.getElementById('novo-qtd-jogos').value) || 1;
  const valorJogo = calcularValorJogo(modalidade, dezenas);
  const total = +(valorJogo * qtdJogos).toFixed(2);

  const info = document.getElementById('valor-sugerido-info');
  if (info) {
    info.innerHTML = `💡 <strong>Sugerido:</strong> R$ ${valorJogo.toFixed(2)} por jogo × ${qtdJogos} = <strong>R$ ${total.toFixed(2)}</strong>`;
  }

  const valorInput = document.getElementById('novo-valor');
  if (valorInput && !valorInput.dataset.manual) {
    valorInput.value = total.toFixed(2);
  }
};

// Admin editou manualmente → mantém valor mesmo com mudanças
document.getElementById('novo-valor')?.addEventListener('input', function() {
  this.dataset.manual = '1';
});

// ============================================================
// SENHA — geração e validação
// ============================================================
window.gerarNovaSenhaUnica = async function() {
  const statusEl = document.getElementById('senha-status');
  if (statusEl) statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando senha única...';
  try {
    const r = await apiRequest('gerarSenhaUnica', { tamanho: 6 });
    if (r.senha) {
      document.getElementById('novo-senha').value = r.senha;
      if (statusEl) {
        statusEl.innerHTML =
          `<span style="color:var(--accent);">✓ Senha única (${r.tamanho} caracteres${r.tentativas > 1 ? ' · ' + r.tentativas + ' tentativas' : ''})</span>`;
      }
    }
  } catch (e) {
    const senha = gerarSenhaAleatoria(6);
    document.getElementById('novo-senha').value = senha;
    if (statusEl) {
      statusEl.innerHTML =
        `<span style="color:var(--warning);">⚠️ Senha gerada localmente (sem verificação online)</span>`;
    }
  }
};

window.verificarSenhaLocal = function() {
  const senha = document.getElementById('novo-senha').value;
  const status = document.getElementById('senha-status');
  if (!status) return;
  if (!senha) { status.textContent = ''; return; }

  const problemas = [];
  if (senha.length < 6) problemas.push('mín. 6 caracteres');
  if (!/[A-Za-z]/.test(senha)) problemas.push('letras');
  if (!/\d/.test(senha)) problemas.push('números');
  if (!/[!@#$%&*]/.test(senha)) problemas.push('caracteres especiais');

  if (problemas.length === 0) {
    status.innerHTML = `<span style="color:var(--accent);">✓ Senha válida</span>`;
  } else {
    status.innerHTML = `<span style="color:var(--warning);">⚠️ Falta: ${problemas.join(', ')}</span>`;
  }
};

// ============================================================
// LISTAR BOLÕES
// ============================================================
async function carregarBoloes() {
  const container = document.getElementById('lista-boloes');
  container.innerHTML = '<p class="loading-text"><i class="fas fa-spinner fa-spin"></i> Carregando...</p>';
  try {
    const data = await apiRequest(
      isAdmin ? 'listarBoloesAdmin' : 'listarMeusBoloes',
      { email: userEmail, isAdmin }
    );
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
  const statusLabel = { ativo:'Aberto', sorteado:'Sorteado', encerrado:'Encerrado' }[b.status] || b.status;
  const minha = b.minha_participacao;
  const meuStatus = minha
    ? (minha.status_pagamento === 'pago'
        ? '<span class="tag tag-success">PAGO</span>'
        : !minha.ativo
          ? '<span class="tag tag-danger">BLOQUEADO</span>'
          : '<span class="tag tag-warning">PENDENTE</span>')
    : '';

  return `
    <div class="bolao-card">
      <div class="bolao-card-header">
        <div>
          <div class="bolao-card-title">${escapeHtml(b.nome)}</div>
          ${b.valor_premio > 0 ? `
            <div class="bolao-card-premio">
              <i class="fas fa-trophy"></i>
              <span>Prêmio estimado:</span>
              <strong>R$ ${fmtRS(b.valor_premio)}</strong>
            </div>
          ` : ''}
          <div class="bolao-card-sub">
            <span class="tag tag-info">${escapeHtml(b.modalidade)}</span>
            ${b.qtd_dezenas ? `<span class="tag">${b.qtd_dezenas} dezenas</span>` : ''}
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
          <div class="bolao-info-item"><i class="fas fa-users"></i><span><strong>${b.pagos}</strong> / ${b.max_participantes} pagos</span></div>
          <div class="bolao-info-item"><i class="fas fa-clock"></i><span>${b.pendentes} pendente${b.pendentes !== 1 ? 's' : ''}</span></div>
          <div class="bolao-info-item"><i class="fas fa-calendar"></i><span>${b.data_sorteio ? fmtData(b.data_sorteio) : 'Data a definir'} ${horaHHmm(b.hora_sorteio) || ''}</span></div>
          <div class="bolao-info-item"><i class="fas fa-hourglass-half"></i><span>Prazo: ${b.prazo_pagamento ? fmtDataHora(b.prazo_pagamento) : '-'}</span></div>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
        <div class="bolao-card-actions">
          <a href="bolao.html?id=${encodeURIComponent(b.id)}" class="btn-primary btn-sm">
            <i class="fas fa-sign-in-alt"></i> ${minha ? 'Acessar bolão' : 'Entrar no bolão'}
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
    </div>`;
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
      </div>`).join('');
  } catch (e) {
    resultado.innerHTML = `<p style="color:var(--danger)">${escapeHtml(e.message)}</p>`;
  }
});

// ============================================================
// CRIAR / EDITAR
// ============================================================
document.getElementById('btn-criar-bolao')?.addEventListener('click', async () => {
  editandoId = null;
  const form = document.getElementById('form-criar-bolao');
  form.reset();
  document.getElementById('novo-valor').removeAttribute('data-manual');
  document.getElementById('novo-senha').placeholder = 'Senha de acesso';
  document.getElementById('novo-senha').readOnly = false;

  popularModalidades();
  window.atualizarCamposModalidade();

  const daqui7 = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const local = new Date(daqui7.getTime() - daqui7.getTimezoneOffset() * 60000);
  document.getElementById('novo-prazo').value = local.toISOString().slice(0, 16);

  document.getElementById('modal-criar').querySelector('h3').innerHTML =
    '<i class="fas fa-plus-circle"></i> Criar novo bolão';
  form.querySelector('button[type="submit"]').innerHTML =
    '<i class="fas fa-save"></i> Criar Bolão';

  document.getElementById('modal-criar').classList.add('active');

  // Gera a senha única ao abrir
  await window.gerarNovaSenhaUnica();
});

document.getElementById('form-criar-bolao')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.submitter || e.target.querySelector('button[type="submit"]');
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';

    const dados = {
    nome: document.getElementById('novo-nome').value.trim(),
    modalidade: document.getElementById('novo-modalidade').value,
    qtd_dezenas: Number(document.getElementById('novo-dezenas').value) || 6,
    valor_premio: Number(document.getElementById('novo-premio').value) || 0,
    max_participantes: Number(document.getElementById('novo-max').value),
    valor_participacao: Number(document.getElementById('novo-valor').value),
    qtd_jogos: Number(document.getElementById('novo-qtd-jogos').value),
    concurso: document.getElementById('novo-concurso').value.trim(),
    data_sorteio: document.getElementById('novo-data-sorteio').value,
    hora_sorteio: document.getElementById('novo-hora-sorteio').value,
    prazo_pagamento: document.getElementById('novo-prazo').value,
    // ⬇️ NOVOS
    pix_chave:        document.getElementById('novo-pix-chave').value.trim(),
    pix_nome:         document.getElementById('novo-pix-nome').value.trim(),
    pix_banco:        document.getElementById('novo-pix-banco').value.trim(),
    comprovante_url:  document.getElementById('novo-comprovante-url').value.trim()
  };
  const senhaInput = document.getElementById('novo-senha').value;
  if (senhaInput) dados.senha = senhaInput;

  try {
    if (editandoId) {
      await apiRequest('atualizarBolao', { isAdmin: true, id: editandoId, dados });
      toast('Bolão atualizado!', 'success');
      editandoId = null;
    } else {
      if (!dados.senha) { toast('Informe a senha do bolão.', 'warning'); return; }
      await apiRequest('criarBolao', { isAdmin: true, email: userEmail, dados });
      toast('Bolão criado com sucesso!', 'success');
    }
    document.getElementById('modal-criar').classList.remove('active');
    document.getElementById('form-criar-bolao').reset();
    invalidarCacheApi('listarBoloes');
    await carregarBoloes();
  } catch (err) {
    toast('Erro: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = original;
  }
});

// ============================================================
// EDIÇÃO
// ============================================================
window.abrirEdicao = async (id) => {
  try {
    const data = await apiRequest('obterBolao', { email: userEmail, isAdmin: true, id });
    const b = data.bolao;

    editandoId = id;
    document.getElementById('novo-nome').value = b.nome;
    document.getElementById('novo-modalidade').value = b.modalidade;
    window.atualizarCamposModalidade();

    // Sobrescreve dezenas/valor depois (pois atualizarCamposModalidade seta padrão)
    if (b.qtd_dezenas) {
      document.getElementById('novo-dezenas').value = b.qtd_dezenas;
    }
    document.getElementById('novo-premio').value = b.valor_premio || '';

    document.getElementById('novo-max').value = b.max_participantes;
    const valorInput = document.getElementById('novo-valor');
    valorInput.value = b.valor_participacao;
    valorInput.dataset.manual = '1';   // preserva valor ao editar

    document.getElementById('novo-qtd-jogos').value = b.qtd_jogos;
    document.getElementById('novo-concurso').value = b.concurso || '';
    document.getElementById('novo-senha').value = b.senha || '';   // ⬅️ mostra senha atual
    document.getElementById('novo-senha').placeholder = 'Senha atual — edite para alterar';
    document.getElementById('senha-status').textContent = '';
    document.getElementById('novo-data-sorteio').value = (b.data_sorteio || '').slice(0, 10);
    document.getElementById('novo-hora-sorteio').value = horaHHmm(b.hora_sorteio) || '';   // ⬅️ normaliza
    document.getElementById('novo-prazo').value = (b.prazo_pagamento || '').slice(0, 16);

    // ⬇️ NOVOS
    document.getElementById('novo-pix-chave').value       = b.pix_chave || '';
    document.getElementById('novo-pix-nome').value        = b.pix_nome || '';
    document.getElementById('novo-pix-banco').value       = b.pix_banco || '';
    document.getElementById('novo-comprovante-url').value = b.comprovante_url || '';

    document.getElementById('modal-criar').querySelector('h3').innerHTML =
      '<i class="fas fa-pen"></i> Editar bolão';
    document.getElementById('form-criar-bolao')
      .querySelector('button[type="submit"]').innerHTML =
      '<i class="fas fa-save"></i> Salvar Alterações';

    document.getElementById('modal-criar').classList.add('active');
  } catch (e) {
    toast('Erro: ' + e.message, 'error');
  }
};

document.getElementById('modal-criar')?.addEventListener('click', (e) => {
  if (e.target === e.currentTarget) editandoId = null;
});

// ============================================================
// EXCLUIR
// ============================================================
window.excluirBolao = async (id, nome) => {
  if (!confirm(`Excluir o bolão "${nome}"? (Será apenas desativado, os dados ficam preservados.)`)) return;
  try {
    await apiRequest('excluirBolao', { isAdmin: true, id });
    toast('Bolão excluído.', 'success');
    invalidarCacheApi('listarBoloes');
    await carregarBoloes();
  } catch (e) { toast('Erro: ' + e.message, 'error'); }
};