import {
  auth, onAuthStateChanged, signOut,
  ADMIN_EMAILS, apiRequest, toast,
  fmtRS, fmtData, fmtDataHora, escapeHtml
} from "./firebase-config.js";

const params = new URLSearchParams(window.location.search);
const bolaoId = params.get('id');
const senhaInicial = params.get('senha') || '';

let userEmail = '';
let isAdmin = false;
let bolaoAtual = null;
let participantes = [];
let numerosSorteados = '';
let minhaParticipacao = null;
let modoEdicaoJogos = false;
let jogosSelecionados = []; // array de arrays

const MODALIDADES = {
  'Mega-Sena': { min: 1, max: 60, qtd: 6 },
  'Lotofácil': { min: 1, max: 25, qtd: 15 }
};

// ============================================================
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = 'index.html'; return; }
  userEmail = (user.email || '').toLowerCase();
  isAdmin = ADMIN_EMAILS.includes(userEmail);
  document.getElementById('user-email-display').textContent = userEmail;
  const badge = document.getElementById('user-role-badge');
  badge.textContent = isAdmin ? 'ADMIN' : 'PARTICIPANTE';
  badge.className = 'role-badge ' + (isAdmin ? 'admin' : 'visualizador');
  if (!bolaoId) { window.location.href = 'painel.html'; return; }
  await carregarBolao();
});

document.getElementById('btn-logout')?.addEventListener('click', async () => {
  if (!confirm('Sair?')) return;
  await signOut(auth);
  sessionStorage.clear();
  window.location.href = 'index.html';
});

// ============================================================
async function carregarBolao() {
  const container = document.getElementById('bolao-container');
  try {
    const data = await apiRequest('obterBolao', { email: userEmail, isAdmin, id: bolaoId });

    if (data.status === 'blocked') {
      container.innerHTML = renderBloqueado(data.message, data.motivo);
      return;
    }

    bolaoAtual = data.bolao;
    participantes = data.participantes || [];
    numerosSorteados = data.numeros_sorteados || '';
    minhaParticipacao = bolaoAtual.minha_participacao;

    document.getElementById('brand-bolao').innerHTML =
      `<i class="fas fa-dice"></i> ${escapeHtml(bolaoAtual.nome)}`;

    // Se admin e não participa: oferecer "entrar como admin"? Não.
    // Admin sempre pode visualizar. Se não é participante e não é admin → erro.
    if (!minhaParticipacao && !isAdmin) {
      // Precisa entrar
      container.innerHTML = renderEntrarBolao();
      bindEntrarBolao();
      return;
    }

    // Se não tem jogos ainda E é participante pendente → tela de escolha de números
    if (minhaParticipacao && minhaParticipacao.status_pagamento !== 'pago' && minhaParticipacao.ativo
        && jogosDeMinhaParticipacao().length === 0) {
      container.innerHTML = renderEscolherNumeros();
      bindEscolherNumeros();
      return;
    }

    // Tela completa
    container.innerHTML = renderTelaCompleta();
    bindTelaCompleta();
  } catch (e) {
    container.innerHTML = `
      <div class="sheet-empty" style="color:var(--danger)">
        <i class="fas fa-exclamation-triangle"></i>
        <p>${escapeHtml(e.message)}</p>
        <a href="painel.html" class="btn-primary btn-sm" style="margin-top:12px;">Voltar ao painel</a>
      </div>`;
  }
}

function jogosDeMinhaParticipacao() {
  if (!minhaParticipacao) return [];
  const p = participantes.find(x => x.id === minhaParticipacao.id);
  return p?.jogos || [];
}

// ============================================================
// BLOQUEADO
// ============================================================
function renderBloqueado(msg, motivo) {
  return `
    <div class="blocked-card">
      <i class="fas fa-lock"></i>
      <h2>Acesso bloqueado</h2>
      <p>${escapeHtml(msg)}</p>
      <p style="font-size:0.85rem;color:#6a7a8a;margin-top:8px;">
        ${motivo === 'prazo_expirado'
          ? 'O prazo para pagamento já foi encerrado.'
          : 'Sua participação foi desativada pelo administrador.'}
      </p>
      <a href="painel.html" class="btn-primary" style="margin-top:20px;">
        <i class="fas fa-arrow-left"></i> Voltar ao painel
      </a>
    </div>
  `;
}

// ============================================================
// ENTRAR NO BOLÃO
// ============================================================
function renderEntrarBolao() {
  return `
    <div class="card">
      <h2><i class="fas fa-sign-in-alt"></i> Entrar no bolão</h2>
      <p style="color:#6a7a8a;margin-bottom:20px;">
        Para participar, informe seu nome e a senha do bolão.
      </p>
      <div class="form-grid">
        <div class="input-group full-width">
          <label>Seu nome *</label>
          <input type="text" id="entrar-nome" class="input-control" placeholder="Nome completo" required>
        </div>
        <div class="input-group full-width">
          <label>Senha do bolão *</label>
          <input type="password" id="entrar-senha" class="input-control" value="${escapeHtml(senhaInicial)}" required>
        </div>
      </div>
      <div class="form-actions">
        <button class="btn-primary" id="btn-confirmar-entrada">
          <i class="fas fa-check"></i> Entrar no bolão
        </button>
      </div>
    </div>
  `;
}

function bindEntrarBolao() {
  document.getElementById('btn-confirmar-entrada')?.addEventListener('click', async () => {
    const nome = document.getElementById('entrar-nome').value.trim().toUpperCase();
    const senha = document.getElementById('entrar-senha').value;
    if (!nome) { toast('Informe seu nome.', 'warning'); return; }
    if (!senha) { toast('Informe a senha.', 'warning'); return; }
    try {
      await apiRequest('entrarNoBolao', {
        email: userEmail, isAdmin, bolaoId, nome, senha
      });
      toast('Você entrou no bolão!', 'success');
      await carregarBolao();
    } catch (e) {
      toast(e.message, 'error');
    }
  });
}

// ============================================================
// ESCOLHER NÚMEROS
// ============================================================
function renderEscolherNumeros() {
  const modal = MODALIDADES[bolaoAtual.modalidade];
  const qtdJogos = bolaoAtual.qtd_jogos || 1;
  const jogos = Array.from({ length: qtdJogos }, () => []);
  jogosSelecionados = jogos;

  return `
    <div class="card">
      <h2><i class="fas fa-hand-pointer"></i> Escolha seus números</h2>
      <div class="info-box">
        <i class="fas fa-info-circle"></i>
        Modalidade: <strong>${escapeHtml(bolaoAtual.modalidade)}</strong> ·
        Escolha <strong>${modal.qtd} números</strong> por jogo
        (${modal.min} a ${modal.max}) ·
        <strong>${qtdJogos}</strong> jogo${qtdJogos > 1 ? 's' : ''}
      </div>

      <div id="jogos-container">
        ${Array.from({ length: qtdJogos }, (_, i) =>
          renderJogoBlock(i, modal)).join('')}
      </div>

      <div class="form-actions">
        <button class="btn-secondary" id="btn-voltar-sem-salvar">
          <i class="fas fa-times"></i> Cancelar
        </button>
        <button class="btn-primary" id="btn-salvar-jogos">
          <i class="fas fa-save"></i> Salvar jogos
        </button>
      </div>
    </div>
  `;
}

function renderJogoBlock(idx, modal) {
  let botoes = '';
  for (let n = modal.min; n <= modal.max; n++) {
    botoes += `<button type="button" class="numero-btn" data-jogo="${idx}" data-num="${n}">${String(n).padStart(2, '0')}</button>`;
  }
  return `
    <div class="jogo-block" data-jogo="${idx}">
      <div class="jogo-header">
        <h3><i class="fas fa-ticket-alt"></i> Jogo ${idx + 1}</h3>
        <div class="jogo-info">
          <span class="jogo-contador" id="contador-${idx}">0 / ${modal.qtd}</span>
          <button type="button" class="btn-secondary btn-sm btn-auto" data-jogo="${idx}">
            <i class="fas fa-random"></i> Preenchimento automático
          </button>
          <button type="button" class="btn-secondary btn-sm btn-limpar" data-jogo="${idx}">
            <i class="fas fa-eraser"></i> Limpar
          </button>
        </div>
      </div>
      <div class="numeros-grid">
        ${botoes}
      </div>
    </div>
  `;
}

function bindEscolherNumeros() {
  // Clique em números
  document.querySelectorAll('.numero-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const j = Number(btn.dataset.jogo);
      const n = Number(btn.dataset.num);
      const arr = jogosSelecionados[j];
      const i = arr.indexOf(n);
      if (i >= 0) {
        arr.splice(i, 1);
        btn.classList.remove('selected');
      } else {
        const modal = MODALIDADES[bolaoAtual.modalidade];
        if (arr.length >= modal.qtd) {
          toast(`Máximo de ${modal.qtd} números neste jogo.`, 'warning');
          return;
        }
        arr.push(n);
        btn.classList.add('selected');
      }
      atualizarContador(j);
    });
  });

  // Preenchimento automático
  document.querySelectorAll('.btn-auto').forEach(btn => {
    btn.addEventListener('click', () => {
      const j = Number(btn.dataset.jogo);
      const modal = MODALIDADES[bolaoAtual.modalidade];
      const arr = jogosSelecionados[j];
      const usados = new Set(arr);
      while (arr.length < modal.qtd) {
        const n = modal.min + Math.floor(Math.random() * (modal.max - modal.min + 1));
        if (!usados.has(n)) { usados.add(n); arr.push(n); }
      }
      arr.sort((a, b) => a - b);
      syncJogoUI(j);
      atualizarContador(j);
    });
  });

  // Limpar
  document.querySelectorAll('.btn-limpar').forEach(btn => {
    btn.addEventListener('click', () => {
      const j = Number(btn.dataset.jogo);
      jogosSelecionados[j] = [];
      syncJogoUI(j);
      atualizarContador(j);
    });
  });

  // Cancelar
  document.getElementById('btn-voltar-sem-salvar')?.addEventListener('click', () => {
    window.location.href = 'painel.html';
  });

  // Salvar
  document.getElementById('btn-salvar-jogos')?.addEventListener('click', async () => {
    const modal = MODALIDADES[bolaoAtual.modalidade];
    for (let i = 0; i < jogosSelecionados.length; i++) {
      if (jogosSelecionados[i].length !== modal.qtd) {
        toast(`Jogo ${i + 1}: escolha ${modal.qtd} números.`, 'warning');
        return;
      }
    }
    try {
      await apiRequest('salvarJogos', {
        email: userEmail,
        bolaoId,
        jogos: jogosSelecionados.map(arr => arr.join(','))
      });
      toast('Jogos salvos! Aguarde a confirmação do pagamento.', 'success');
      await carregarBolao();
    } catch (e) {
      toast('Erro: ' + e.message, 'error');
    }
  });
}

function syncJogoUI(j) {
  const arr = jogosSelecionados[j];
  document.querySelectorAll(`.numero-btn[data-jogo="${j}"]`).forEach(btn => {
    const n = Number(btn.dataset.num);
    btn.classList.toggle('selected', arr.includes(n));
  });
}

function atualizarContador(j) {
  const modal = MODALIDADES[bolaoAtual.modalidade];
  const el = document.getElementById(`contador-${j}`);
  if (el) el.textContent = `${jogosSelecionados[j].length} / ${modal.qtd}`;
}

// ============================================================
// TELA COMPLETA
// ============================================================
function renderTelaCompleta() {
  const modal = MODALIDADES[bolaoAtual.modalidade];
  const meusJogos = jogosDeMinhaParticipacao();

  const statusMinha = minhaParticipacao
    ? (minhaParticipacao.status_pagamento === 'pago'
        ? '<span class="tag tag-success">PAGO</span>'
        : '<span class="tag tag-warning">PAGAMENTO PENDENTE</span>')
    : '<span class="tag tag-info">ADMIN</span>';

  const podeVerTudo = isAdmin || minhaParticipacao?.status_pagamento === 'pago';
  const podeEditarJogos = minhaParticipacao
    && minhaParticipacao.status_pagamento !== 'pago'
    && minhaParticipacao.ativo;

  return `
    <div class="bolao-header-card">
      <div>
        <h1>${escapeHtml(bolaoAtual.nome)}</h1>
        <div class="bolao-meta">
          <span class="tag tag-info">${escapeHtml(bolaoAtual.modalidade)}</span>
          ${bolaoAtual.concurso ? `<span class="tag">Conc. ${escapeHtml(bolaoAtual.concurso)}</span>` : ''}
          <span class="tag tag-purple">${bolaoAtual.pagos} / ${bolaoAtual.max_participantes} pagos</span>
          ${statusMinha}
        </div>
        <div class="bolao-detalhes">
          <span><i class="fas fa-calendar"></i> Sorteio: ${bolaoAtual.data_sorteio ? fmtData(bolaoAtual.data_sorteio) : '-'} ${bolaoAtual.hora_sorteio || ''}</span>
          <span><i class="fas fa-hourglass-half"></i> Prazo pagamento: ${bolaoAtual.prazo_pagamento ? fmtDataHora(bolaoAtual.prazo_pagamento) : '-'}</span>
          <span><i class="fas fa-ticket-alt"></i> ${bolaoAtual.qtd_jogos} jogo(s) por participante</span>
          <span><i class="fas fa-money-bill-wave"></i> R$ ${fmtRS(bolaoAtual.valor_participacao)}</span>
        </div>
      </div>
    </div>

    ${renderAlertaStatus()}

    ${meusJogos.length > 0 ? renderMeusJogos(meusJogos, podeEditarJogos) : ''}

    ${podeVerTudo || isAdmin ? renderParticipantes() : renderAvisoPendente()}

    ${numerosSorteados ? renderResultadoSorteio() : ''}

    ${isAdmin ? renderAdminPanel() : ''}
  `;
}

function renderAlertaStatus() {
  if (!minhaParticipacao) {
    return `<div class="alerta alerta-info">
      <i class="fas fa-user-shield"></i>
      Você está visualizando como <strong>administrador</strong>.
    </div>`;
  }
  if (minhaParticipacao.status_pagamento === 'pago') {
    return `<div class="alerta alerta-success">
      <i class="fas fa-check-circle"></i>
      Pagamento confirmado! Você pode visualizar todos os jogos e participantes.
    </div>`;
  }
  if (minhaParticipacao.ativo) {
    return `<div class="alerta alerta-warning">
      <i class="fas fa-clock"></i>
      Sua participação está <strong>em andamento</strong>. Aguarde a confirmação do pagamento pelo administrador.
      Enquanto isso, você só visualiza seus próprios jogos.
    </div>`;
  }
  return '';
}

function renderMeusJogos(jogos, podeEditar) {
  const modal = MODALIDADES[bolaoAtual.modalidade];
  return `
    <div class="card">
      <div class="card-header-actions">
        <h2><i class="fas fa-ticket-alt"></i> Meus jogos</h2>
        ${podeEditar ? `
          <button class="btn-secondary btn-sm" id="btn-editar-meus-jogos">
            <i class="fas fa-edit"></i> Editar meus jogos
          </button>
        ` : ''}
      </div>
      <div class="jogos-list">
        ${jogos.map((j, i) => renderJogoView(j.numeros, i + 1, modal)).join('')}
      </div>
    </div>
  `;
}

function renderJogoView(numerosStr, idx, modal) {
  const sorteados = numerosSorteados
    ? numerosSorteados.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n))
    : [];
  const numeros = String(numerosStr).split(',').map(s => Number(s.trim())).filter(n => !isNaN(n));
  const acertos = sorteados.length ? numeros.filter(n => sorteados.includes(n)).length : null;

  const bolinhas = numeros.map(n => {
    const acertou = sorteados.includes(n);
    const cls = acertou ? 'bolinha bolinha-acerto' : 'bolinha';
    return `<span class="${cls}">${String(n).padStart(2, '0')}</span>`;
  }).join('');

  return `
    <div class="jogo-view">
      <div class="jogo-view-header">
        <strong>Jogo ${idx}</strong>
        ${acertos !== null ? `<span class="acertos-badge">${acertos} acerto${acertos !== 1 ? 's' : ''}</span>` : ''}
      </div>
      <div class="bolinhas-grid">${bolinhas}</div>
    </div>
  `;
}

function renderAvisoPendente() {
  return `
    <div class="card">
      <div class="aviso-pendente">
        <i class="fas fa-lock"></i>
        <h3>Área completa bloqueada</h3>
        <p>Você verá todos os participantes e jogos após o pagamento ser confirmado pelo administrador.</p>
      </div>
    </div>
  `;
}

function renderParticipantes() {
  return `
    <div class="card">
      <h2><i class="fas fa-users"></i> Participantes (${participantes.length})</h2>
      <div class="participantes-list">
        ${participantes.map(p => {
          const status = p.status_pagamento === 'pago'
            ? '<span class="tag tag-success">PAGO</span>'
            : !p.ativo
              ? '<span class="tag tag-danger">BLOQUEADO</span>'
              : '<span class="tag tag-warning">PENDENTE</span>';
          const modal = MODALIDADES[bolaoAtual.modalidade];
          return `
            <div class="participante-card ${!p.ativo ? 'participante-bloqueado' : ''}">
              <div class="participante-header">
                <div>
                  <strong>${escapeHtml(p.nome || '(sem nome)')}</strong>
                  ${isAdmin && p.email ? `<div class="participante-email">${escapeHtml(p.email)}</div>` : ''}
                </div>
                ${status}
              </div>
              ${p.jogos.length > 0 ? `
                <div class="participante-jogos">
                  ${p.jogos.map((j, i) => `
                    <div class="jogo-mini">
                      <span class="jogo-mini-num">J${i + 1}</span>
                      ${String(j.numeros).split(',').map(n => {
                        const num = Number(n.trim());
                        const acertou = numerosSorteados && numerosSorteados.split(',').map(x => Number(x.trim())).includes(num);
                        return `<span class="bolinha-sm ${acertou ? 'bolinha-acerto' : ''}">${String(num).padStart(2, '0')}</span>`;
                      }).join('')}
                    </div>
                  `).join('')}
                </div>
              ` : '<div class="participante-sem-jogos">Sem jogos enviados</div>'}
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderResultadoSorteio() {
  const nums = numerosSorteados.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n));
  return `
    <div class="card resultado-sorteio">
      <h2><i class="fas fa-trophy"></i> Resultado do sorteio</h2>
      <div class="bolinhas-grid bolinhas-grandes">
        ${nums.map(n => `<span class="bolinha bolinha-sorteada">${String(n).padStart(2, '0')}</span>`).join('')}
      </div>
    </div>
  `;
}

// ============================================================
// PAINEL ADMIN
// ============================================================
function renderAdminPanel() {
  const pendentes = participantes.filter(p => p.status_pagamento !== 'pago' && p.ativo);
  const bloqueados = participantes.filter(p => !p.ativo);

  return `
    <div class="card admin-panel-bolao">
      <h2><i class="fas fa-cogs"></i> Painel do administrador</h2>

      <div class="admin-tabs">
        <button class="admin-tab active" data-tab="adm-pagamentos">Pagamentos</button>
        <button class="admin-tab" data-tab="adm-bloqueados">Bloqueados</button>
        <button class="admin-tab" data-tab="adm-resultado">Registrar sorteio</button>
      </div>

      <div class="admin-tab-content active" id="adm-pagamentos">
        <h3>Participantes aguardando pagamento (${pendentes.length})</h3>
        ${pendentes.length === 0
          ? '<p style="color:#6a7a8a;">Nenhum pagamento pendente.</p>'
          : pendentes.map(p => `
            <div class="admin-linha">
              <div>
                <strong>${escapeHtml(p.nome)}</strong>
                <div style="font-size:0.8rem;color:#6a7a8a;">${escapeHtml(p.email || '')} · ${p.jogos.length} jogo(s)</div>
              </div>
              <div class="admin-actions">
                <button class="btn-primary btn-sm" onclick="window.confirmarPagamento('${p.id}')">
                  <i class="fas fa-check"></i> Confirmar pagamento
                </button>
                <button class="btn-danger btn-sm" onclick="window.bloquearParticipante('${p.id}')">
                  <i class="fas fa-ban"></i> Bloquear
                </button>
              </div>
            </div>
          `).join('')
        }
      </div>

      <div class="admin-tab-content" id="adm-bloqueados">
        <h3>Participantes bloqueados (${bloqueados.length})</h3>
        ${bloqueados.length === 0
          ? '<p style="color:#6a7a8a;">Nenhum participante bloqueado.</p>'
          : bloqueados.map(p => `
            <div class="admin-linha">
              <div>
                <strong>${escapeHtml(p.nome)}</strong>
                <div style="font-size:0.8rem;color:#6a7a8a;">
                  ${escapeHtml(p.email || '')} · Motivo: ${p.motivo_bloqueio || '-'}
                </div>
              </div>
              <div class="admin-actions">
                <button class="btn-primary btn-sm" onclick="window.reativarParticipante('${p.id}')">
                  <i class="fas fa-unlock"></i> Reativar
                </button>
              </div>
            </div>
          `).join('')
        }
      </div>

      <div class="admin-tab-content" id="adm-resultado">
        <h3>Registrar resultado do sorteio</h3>
        <p style="color:#6a7a8a;margin-bottom:12px;">
          Informe os números sorteados separados por vírgula.
          Modalidade: <strong>${escapeHtml(bolaoAtual.modalidade)}</strong>
          (${MODALIDADES[bolaoAtual.modalidade].qtd} números).
        </p>
        <div class="input-group">
          <label>Números sorteados</label>
          <input type="text" id="input-sorteados" class="input-control"
                 value="${escapeHtml(numerosSorteados)}"
                 placeholder="Ex: 03,15,22,34,45,60">
        </div>
        <div class="form-actions">
          <button class="btn-primary" id="btn-salvar-resultado">
            <i class="fas fa-save"></i> Salvar resultado
          </button>
        </div>
      </div>
    </div>
  `;
}

function bindTelaCompleta() {
  // Admin tabs
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.tab)?.classList.add('active');
    });
  });

  // Editar meus jogos
  document.getElementById('btn-editar-meus-jogos')?.addEventListener('click', () => {
    const meus = jogosDeMinhaParticipacao();
    jogosSelecionados = meus.map(j =>
      String(j.numeros).split(',').map(n => Number(n.trim()))
    );
    document.getElementById('bolao-container').innerHTML = renderEscolherNumeros();
    // Pré-marcar
    jogosSelecionados.forEach((arr, i) => {
      arr.forEach(n => {
        document.querySelector(`.numero-btn[data-jogo="${i}"][data-num="${n}"]`)?.classList.add('selected');
      });
      atualizarContador(i);
    });
    bindEscolherNumeros();
  });

  // Salvar resultado
  document.getElementById('btn-salvar-resultado')?.addEventListener('click', async () => {
    const nums = document.getElementById('input-sorteados').value;
    if (!nums) { toast('Informe os números.', 'warning'); return; }
    try {
      await apiRequest('registrarResultado', {
        isAdmin: true, bolaoId, numeros: nums
      });
      toast('Resultado registrado!', 'success');
      await carregarBolao();
    } catch (e) {
      toast('Erro: ' + e.message, 'error');
    }
  });
}

// ============================================================
// AÇÕES ADMIN (globais)
// ============================================================
window.confirmarPagamento = async (id) => {
  if (!confirm('Confirmar pagamento deste participante?')) return;
  try {
    await apiRequest('confirmarPagamento', { isAdmin: true, participanteId: id });
    toast('Pagamento confirmado!', 'success');
    await carregarBolao();
  } catch (e) { toast('Erro: ' + e.message, 'error'); }
};

window.bloquearParticipante = async (id) => {
  if (!confirm('Bloquear este participante?')) return;
  try {
    await apiRequest('desativarParticipante', { isAdmin: true, participanteId: id });
    toast('Participante bloqueado.', 'success');
    await carregarBolao();
  } catch (e) { toast('Erro: ' + e.message, 'error'); }
};

window.reativarParticipante = async (id) => {
  if (!confirm('Reativar o acesso deste participante?')) return;
  try {
    await apiRequest('reativarParticipante', { isAdmin: true, participanteId: id });
    toast('Participante reativado.', 'success');
    await carregarBolao();
  } catch (e) { toast('Erro: ' + e.message, 'error'); }
};