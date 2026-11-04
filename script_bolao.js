import {
  auth, onAuthStateChanged, signOut,
  ADMIN_EMAILS, MODALIDADES, apiRequest, apiRequestCached, invalidarCacheApi,
  toast, fmtRS, fmtData, fmtDataHora, escapeHtml
} from "./firebase-config.js";

const params      = new URLSearchParams(window.location.search);
const bolaoId     = params.get('id');
const senhaInicial = params.get('senha') || '';

let userEmail = '';
let isAdmin   = false;
let bolaoAtual = null;
let participantes = [];
let numerosSorteados = '';
let minhaParticipacao = null;
let jogosSelecionados = [];

// ============================================================
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = 'index.html'; return; }
  userEmail = (user.email || '').toLowerCase();
  isAdmin   = ADMIN_EMAILS.includes(userEmail);
  document.getElementById('user-email-display').textContent = userEmail;
  const badge = document.getElementById('user-role-badge');
  badge.textContent = isAdmin ? 'ADMIN' : 'PARTICIPANTE';
  badge.className   = 'role-badge ' + (isAdmin ? 'admin' : 'visualizador');
  if (!bolaoId) { window.location.href = 'painel.html'; return; }
  await carregarBolao();
});

document.getElementById('btn-logout')?.addEventListener('click', async () => {
  if (!confirm('Sair?')) return;
  await signOut(auth); sessionStorage.clear();
  window.location.href = 'index.html';
});

// ============================================================
// 🎯 CARREGAR BOLÃO — a correção principal está aqui
// ============================================================
async function carregarBolao() {
  const container = document.getElementById('bolao-container');
  try {
    // ⬇️⬇️⬇️ A CHAVE DA CORREÇÃO: envia a senha no payload
    const data = await apiRequest('obterBolao', {
      email: userEmail,
      isAdmin,
      id: bolaoId,
      senha: senhaInicial          // <-- NOVO
    });

    if (data.status === 'blocked') {
      container.innerHTML = renderBloqueado(data.message, data.motivo);
      return;
    }

    bolaoAtual       = data.bolao;
    participantes    = data.participantes || [];
    numerosSorteados = data.numeros_sorteados || '';
    minhaParticipacao = bolaoAtual.minha_participacao;

    document.getElementById('brand-bolao').innerHTML =
      `<i class="fas fa-dice"></i> ${escapeHtml(bolaoAtual.nome)}`;

    // Se NÃO é participante e NÃO é admin → mostra tela de "Entrar no bolão"
    // (o backend deve retornar isso em vez de lançar erro)
    if (!minhaParticipacao && !isAdmin) {
      container.innerHTML = renderEntrarBolao();
      bindEntrarBolao();
      return;
    }

    // Se é participante e ainda não escolheu os jogos → escolher números
    if (minhaParticipacao
        && minhaParticipacao.status_pagamento !== 'pago'
        && minhaParticipacao.ativo
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
// ⛔ BLOQUEADO
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
    </div>`;
}

// ============================================================
// 🚪 ENTRAR NO BOLÃO (nome + senha)
// ============================================================
function renderEntrarBolao() {
  return `
    <div class="card">
      <h2><i class="fas fa-sign-in-alt"></i> Entrar no bolão</h2>
      <p style="color:#6a7a8a;margin-bottom:20px;">
        Para participar, informe seu <strong>nome completo</strong> e a senha do bolão.
      </p>
      <div class="form-grid">
        <div class="input-group full-width">
          <label>Seu nome completo *</label>
          <input type="text" id="entrar-nome" class="input-control" placeholder="Nome completo" required>
          <small style="color:#6a7a8a; font-size:0.78rem; margin-top:4px;">
            ⚠️ Este nome será cadastrado uma única vez e ficará visível para todos os participantes.
          </small>
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
    </div>`;
}

function bindEntrarBolao() {
  document.getElementById('btn-confirmar-entrada')?.addEventListener('click', async () => {
    const nome  = document.getElementById('entrar-nome').value.trim().toUpperCase();
    const senha = document.getElementById('entrar-senha').value;
    if (!nome)  { toast('Informe seu nome.', 'warning'); return; }
    if (!senha) { toast('Informe a senha.', 'warning'); return; }

    try {
      await apiRequest('entrarNoBolao', {
        email: userEmail, isAdmin, bolaoId, nome, senha
      });
      toast('Você entrou no bolão!', 'success');
      invalidarCacheApi('obterBolao');
      // Recarrega mantendo a senha para que o backend não peça novamente
      window.location.href = `bolao.html?id=${encodeURIComponent(bolaoId)}&senha=${encodeURIComponent(senha)}`;
    } catch (e) {
      toast(e.message, 'error');
    }
  });
}

// ============================================================
// 🎯 ESCOLHER NÚMEROS
// ============================================================
function renderEscolherNumeros() {
  const modal  = MODALIDADES[bolaoAtual.modalidade];
  const qtdJogos = bolaoAtual.qtd_jogos || 1;
  jogosSelecionados = Array.from({ length: qtdJogos }, () => []);

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
        ${Array.from({ length: qtdJogos }, (_, i) => renderJogoBlock(i, modal)).join('')}
      </div>
      <div class="form-actions">
        <button class="btn-secondary" id="btn-voltar-sem-salvar">
          <i class="fas fa-times"></i> Cancelar
        </button>
        <button class="btn-primary" id="btn-salvar-jogos">
          <i class="fas fa-save"></i> Salvar jogos
        </button>
      </div>
    </div>`;
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
            <i class="fas fa-random"></i> Automático
          </button>
          <button type="button" class="btn-secondary btn-sm btn-limpar" data-jogo="${idx}">
            <i class="fas fa-eraser"></i> Limpar
          </button>
        </div>
      </div>
      <div class="numeros-grid">${botoes}</div>
    </div>`;
}

function bindEscolherNumeros() {
  document.querySelectorAll('.numero-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const j = Number(btn.dataset.jogo);
      const n = Number(btn.dataset.num);
      const arr = jogosSelecionados[j];
      const i = arr.indexOf(n);
      if (i >= 0) { arr.splice(i, 1); btn.classList.remove('selected'); }
      else {
        const modal = MODALIDADES[bolaoAtual.modalidade];
        if (arr.length >= modal.qtd) { toast(`Máximo de ${modal.qtd} números.`, 'warning'); return; }
        arr.push(n); btn.classList.add('selected');
      }
      atualizarContador(j);
    });
  });

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
      syncJogoUI(j); atualizarContador(j);
    });
  });

  document.querySelectorAll('.btn-limpar').forEach(btn => {
    btn.addEventListener('click', () => {
      const j = Number(btn.dataset.jogo);
      jogosSelecionados[j] = [];
      syncJogoUI(j); atualizarContador(j);
    });
  });

  document.getElementById('btn-voltar-sem-salvar')?.addEventListener('click', () => {
    window.location.href = 'painel.html';
  });

  document.getElementById('btn-salvar-jogos')?.addEventListener('click', async () => {
    const modal = MODALIDADES[bolaoAtual.modalidade];
    for (let i = 0; i < jogosSelecionados.length; i++) {
      if (jogosSelecionados[i].length !== modal.qtd) {
        toast(`Jogo ${i + 1}: escolha ${modal.qtd} números.`, 'warning'); return;
      }
    }
    try {
      await apiRequest('salvarJogos', {
        email: userEmail, bolaoId,
        jogos: jogosSelecionados.map(arr => arr.join(','))
      });
      toast('Jogos salvos! Aguarde a confirmação do pagamento.', 'success');
      invalidarCacheApi('obterBolao');
      await carregarBolao();
    } catch (e) { toast('Erro: ' + e.message, 'error'); }
  });
}

function syncJogoUI(j) {
  const arr = jogosSelecionados[j];
  document.querySelectorAll(`.numero-btn[data-jogo="${j}"]`).forEach(btn => {
    btn.classList.toggle('selected', arr.includes(Number(btn.dataset.num)));
  });
}
function atualizarContador(j) {
  const modal = MODALIDADES[bolaoAtual.modalidade];
  const el = document.getElementById(`contador-${j}`);
  if (el) el.textContent = `${jogosSelecionados[j].length} / ${modal.qtd}`;
}

// ============================================================
// 🖥️ TELA COMPLETA
// ============================================================
function renderTelaCompleta() {
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
          <span><i class="fas fa-hourglass-half"></i> Prazo: ${bolaoAtual.prazo_pagamento ? fmtDataHora(bolaoAtual.prazo_pagamento) : '-'}</span>
          <span><i class="fas fa-ticket-alt"></i> ${bolaoAtual.qtd_jogos} jogo(s)</span>
          <span><i class="fas fa-money-bill-wave"></i> R$ ${fmtRS(bolaoAtual.valor_participacao)}</span>
        </div>
      </div>

      <div class="bolao-actions-top">
        ${isAdmin && !minhaParticipacao ? `
          <button class="btn-primary btn-sm" id="btn-admin-participar">
            <i class="fas fa-user-plus"></i> Participar também
          </button>
        ` : ''}
        <button class="btn-secondary btn-sm" id="btn-export-pdf">
          <i class="fas fa-file-pdf"></i> PDF
        </button>
        <button class="btn-secondary btn-sm" id="btn-export-excel">
          <i class="fas fa-file-excel"></i> Excel
        </button>
      </div>
    </div>

    ${renderAlertaStatus()}
    ${meusJogos.length > 0 ? renderMeusJogos(meusJogos, podeEditarJogos) : ''}
    ${podeVerTudo || isAdmin ? renderParticipantes() : renderAvisoPendente()}
    ${numerosSorteados ? renderRanking() : ''}
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
      Sua participação está <strong>em andamento</strong>. Aguarde a confirmação do pagamento.
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
            <i class="fas fa-edit"></i> Editar
          </button>
        ` : ''}
      </div>
      <div class="jogos-list">
        ${jogos.map((j, i) => renderJogoView(j.numeros, i + 1, modal)).join('')}
      </div>
    </div>`;
}

function renderJogoView(numerosStr, idx) {
  const sorteados = numerosSorteados
    ? numerosSorteados.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n))
    : [];
  const numeros = String(numerosStr).split(',').map(s => Number(s.trim())).filter(n => !isNaN(n));
  const acertos = sorteados.length ? numeros.filter(n => sorteados.includes(n)).length : null;
  const bolinhas = numeros.map(n => {
    const acertou = sorteados.includes(n);
    return `<span class="${acertou ? 'bolinha bolinha-acerto' : 'bolinha'}">${String(n).padStart(2, '0')}</span>`;
  }).join('');
  return `
    <div class="jogo-view">
      <div class="jogo-view-header">
        <strong>Jogo ${idx}</strong>
        ${acertos !== null ? `<span class="acertos-badge">${acertos} acerto${acertos !== 1 ? 's' : ''}</span>` : ''}
      </div>
      <div class="bolinhas-grid">${bolinhas}</div>
    </div>`;
}

function renderAvisoPendente() {
  return `
    <div class="card">
      <div class="aviso-pendente">
        <i class="fas fa-lock"></i>
        <h3>Área completa bloqueada</h3>
        <p>Você verá todos os participantes e jogos após o pagamento ser confirmado.</p>
      </div>
    </div>`;
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
                    </div>`).join('')}
                </div>` : '<div class="participante-sem-jogos">Sem jogos enviados</div>'}
            </div>`;
        }).join('')}
      </div>
    </div>`;
}

// ============================================================
// 🏆 RANKING DE ACERTOS
// ============================================================
function renderRanking() {
  const sorteados = numerosSorteados.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n));
  if (sorteados.length === 0) return '';

  const rankingPorMedico = {};
  participantes.forEach(p => {
    if (!p.ativo) return;
    let melhor = 0;
    (p.jogos || []).forEach(j => {
      const numeros = String(j.numeros).split(',').map(s => Number(s.trim()));
      const acertos = numeros.filter(n => sorteados.includes(n)).length;
      if (acertos > melhor) melhor = acertos;
    });
    const nome = p.nome || '(sem nome)';
    if (!rankingPorMedico[nome] || melhor > rankingPorMedico[nome]) {
      rankingPorMedico[nome] = melhor;
    }
  });

  const ordenado = Object.entries(rankingPorMedico)
    .sort((a, b) => b[1] - a[1]);

  const comAcerto = ordenado.filter(([, n]) => n > 0);
  const semAcerto = ordenado.filter(([, n]) => n === 0);

  return `
    <div class="card ranking-card">
      <h2><i class="fas fa-trophy"></i> Ranking de Acertos</h2>
      ${comAcerto.length > 0 ? `
        <table class="ranking-tabela">
          <thead>
            <tr>
              <th>#</th>
              <th>Participante</th>
              <th class="num">Acertos</th>
            </tr>
          </thead>
          <tbody>
            ${comAcerto.map(([nome, acertos], i) => `
              <tr class="${i === 0 ? 'ranking-primeiro' : ''}">
                <td class="rank-pos">${i + 1}º</td>
                <td>${escapeHtml(nome)}</td>
                <td class="num"><strong>${acertos}</strong></td>
              </tr>`).join('')}
          </tbody>
        </table>
      ` : ''}
      ${semAcerto.length > 0 ? `
        <div class="ranking-sem-acerto">
          <p>😊 <strong>Participantes que não acertaram nenhum número:</strong> não desanimem, a próxima pode ser a sua!</p>
          <div class="ranking-sem-acerto-lista">
            ${semAcerto.map(([nome]) => `<span class="tag">${escapeHtml(nome)}</span>`).join('')}
          </div>
        </div>
      ` : ''}
    </div>`;
}

function renderResultadoSorteio() {
  const nums = numerosSorteados.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n));
  return `
    <div class="card resultado-sorteio">
      <h2><i class="fas fa-star"></i> Números sorteados</h2>
      <div class="bolinhas-grid bolinhas-grandes">
        ${nums.map(n => `<span class="bolinha bolinha-sorteada">${String(n).padStart(2, '0')}</span>`).join('')}
      </div>
    </div>`;
}

// ============================================================
// ⚙️ PAINEL ADMIN
// ============================================================
function renderAdminPanel() {
  const pendentes  = participantes.filter(p => p.status_pagamento !== 'pago' && p.ativo);
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
                  <i class="fas fa-check"></i> Confirmar
                </button>
                <button class="btn-danger btn-sm" onclick="window.bloquearParticipante('${p.id}')">
                  <i class="fas fa-ban"></i> Bloquear
                </button>
              </div>
            </div>`).join('')}
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
            </div>`).join('')}
      </div>

      <div class="admin-tab-content" id="adm-resultado">
        <h3>Registrar resultado do sorteio</h3>
        <p style="color:#6a7a8a;margin-bottom:12px;">
          Informe os números sorteados separados por vírgula.
          Modalidade: <strong>${escapeHtml(bolaoAtual.modalidade)}</strong>
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
    </div>`;
}

function bindTelaCompleta() {
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.tab)?.classList.add('active');
    });
  });

  document.getElementById('btn-editar-meus-jogos')?.addEventListener('click', () => {
    const meus = jogosDeMinhaParticipacao();
    jogosSelecionados = meus.map(j =>
      String(j.numeros).split(',').map(n => Number(n.trim()))
    );
    document.getElementById('bolao-container').innerHTML = renderEscolherNumeros();
    jogosSelecionados.forEach((arr, i) => {
      arr.forEach(n => {
        document.querySelector(`.numero-btn[data-jogo="${i}"][data-num="${n}"]`)?.classList.add('selected');
      });
      atualizarContador(i);
    });
    bindEscolherNumeros();
  });

  // Admin também pode participar
  document.getElementById('btn-admin-participar')?.addEventListener('click', async () => {
    const nome = prompt('Digite seu nome completo para participar deste bolão:');
    if (!nome || !nome.trim()) return;
    try {
      // Admin já tem a senha? Não precisamos dela — backend autoriza por isAdmin
      await apiRequest('entrarNoBolao', {
        email: userEmail, isAdmin: true, bolaoId,
        nome: nome.trim().toUpperCase(),
        senha: ''  // backend deve aceitar quando isAdmin === true
      });
      toast('Você entrou no bolão!', 'success');
      invalidarCacheApi('obterBolao');
      await carregarBolao();
    } catch (e) { toast('Erro: ' + e.message, 'error'); }
  });

  document.getElementById('btn-salvar-resultado')?.addEventListener('click', async () => {
    const nums = document.getElementById('input-sorteados').value;
    if (!nums) { toast('Informe os números.', 'warning'); return; }
    try {
      await apiRequest('registrarResultado', { isAdmin: true, bolaoId, numeros: nums });
      toast('Resultado registrado!', 'success');
      invalidarCacheApi('obterBolao');
      await carregarBolao();
    } catch (e) { toast('Erro: ' + e.message, 'error'); }
  });

  document.getElementById('btn-export-pdf')?.addEventListener('click', () => {
    window.abrirModalPdfBolao();
  });
  document.getElementById('btn-export-excel')?.addEventListener('click', () => {
    window.exportarExcelBolao();
  });
}

// ============================================================
// 📄 PDF (com opções de orientação, fonte, tamanho A4)
// ============================================================
window.abrirModalPdfBolao = function () {
  const modal = document.getElementById('modal-pdf-opcoes');
  if (!modal) { toast('Modal de PDF não encontrado.', 'error'); return; }
  window.__pdfContexto = 'bolao';
  modal.classList.add('active');
};

window.gerarPdfBolao = function (fonte = 10, orient = 'portrait') {
  if (!window.jspdf?.jsPDF) { toast('Biblioteca PDF não carregada.', 'error'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF(orient === 'landscape' ? 'l' : 'p', 'mm', 'a4');
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 12;

  // Cabeçalho
  doc.setFontSize(fonte + 5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 138);
  doc.text('BOLÃO UPA CAMPOS', pageW / 2, 18, { align: 'center' });
  doc.setFontSize(fonte + 1);
  doc.setFont('helvetica', 'normal');
  doc.text(bolaoAtual.nome, pageW / 2, 25, { align: 'center' });
  doc.setFontSize(fonte - 1);
  doc.setTextColor(100);
  doc.text(
    `${bolaoAtual.modalidade} · Conc. ${bolaoAtual.concurso || '-'} · ${bolaoAtual.pagos}/${bolaoAtual.max_participantes} pagos · Gerado em ${new Date().toLocaleString('pt-BR')}`,
    pageW / 2, 30, { align: 'center' }
  );
  doc.setDrawColor(30, 58, 138);
  doc.setLineWidth(0.4);
  doc.line(margin, 33, pageW - margin, 33);

  let y = 39;

  // Resultado (se houver)
  if (numerosSorteados) {
    doc.setFontSize(fonte + 1);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 138);
    doc.text('Números sorteados', margin, y);
    y += 3;
    doc.setFontSize(fonte);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0);
    doc.text(numerosSorteados.split(',').map(n => n.trim().padStart(2, '0')).join(' · '), margin, y);
    y += 8;
  }

  // Tabela de participantes + jogos
  const body = [];
  participantes.forEach(p => {
    const nome = p.nome || '(sem nome)';
    const status = p.status_pagamento === 'pago' ? 'PAGO'
                 : !p.ativo ? 'BLOQUEADO' : 'PENDENTE';
    (p.jogos || []).forEach((j, i) => {
      const numeros = String(j.numeros).split(',').map(n => n.trim().padStart(2, '0')).join(' ');
      const sorteados = numerosSorteados
        ? numerosSorteados.split(',').map(s => Number(s.trim()))
        : [];
      const acertos = sorteados.length
        ? String(j.numeros).split(',').filter(n => sorteados.includes(Number(n.trim()))).length
        : '-';
      body.push([nome, status, `J${i + 1}`, numeros, String(acertos)]);
    });
    if (!p.jogos || p.jogos.length === 0) {
      body.push([nome, status, '-', 'Sem jogos', '-']);
    }
  });

  doc.autoTable({
    startY: y,
    head: [['Participante', 'Status', 'Jogo', 'Números', 'Acertos']],
    body,
    theme: 'grid',
    styles: { fontSize: fonte, cellPadding: 2 },
    headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold', halign: 'center' },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'center', cellWidth: 24 },
      2: { halign: 'center', cellWidth: 18 },
      3: { cellWidth: orient === 'landscape' ? 110 : 70, fontFamily: 'courier' },
      4: { halign: 'center', cellWidth: 20 }
    },
    margin: { left: margin, right: margin }
  });

  // Rodapé
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120);
    doc.text(`Página ${i} de ${totalPages}`, pageW - margin, doc.internal.pageSize.getHeight() - 5, { align: 'right' });
  }

  doc.save(`bolao_${bolaoAtual.nome.replace(/\s+/g, '_')}_${bolaoAtual.concurso || ''}.pdf`);
};

// ============================================================
// 📊 EXCEL
// ============================================================
window.exportarExcelBolao = function () {
  if (!window.XLSX) { toast('Biblioteca Excel não carregada.', 'error'); return; }

  const aoa = [
    ['BOLÃO UPA CAMPOS'],
    [bolaoAtual.nome],
    [bolaoAtual.modalidade, 'Conc. ' + (bolaoAtual.concurso || '-')],
    [],
    ['Participante', 'E-mail', 'Status', 'Jogo', 'Números', 'Acertos']
  ];

  const sorteados = numerosSorteados
    ? numerosSorteados.split(',').map(s => Number(s.trim()))
    : [];

  participantes.forEach(p => {
    const status = p.status_pagamento === 'pago' ? 'PAGO'
                 : !p.ativo ? 'BLOQUEADO' : 'PENDENTE';
    (p.jogos || []).forEach((j, i) => {
      const numeros = String(j.numeros).split(',').map(n => n.trim().padStart(2, '0')).join(' ');
      const acertos = sorteados.length
        ? String(j.numeros).split(',').filter(n => sorteados.includes(Number(n.trim()))).length
        : '-';
      aoa.push([p.nome || '', p.email || '', status, 'J' + (i + 1), numeros, acertos]);
    });
    if (!p.jogos || p.jogos.length === 0) {
      aoa.push([p.nome || '', p.email || '', status, '-', 'Sem jogos', '-']);
    }
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 32 }, { wch: 28 }, { wch: 12 }, { wch: 8 }, { wch: 40 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws, bolaoAtual.nome.slice(0, 28) || 'Bolão');

  XLSX.writeFile(wb, `bolao_${bolaoAtual.nome.replace(/\s+/g, '_')}.xlsx`);
  toast('Excel exportado!', 'success');
};

// ============================================================
// AÇÕES ADMIN (globais)
// ============================================================
window.confirmarPagamento = async (id) => {
  if (!confirm('Confirmar pagamento deste participante?')) return;
  try {
    await apiRequest('confirmarPagamento', { isAdmin: true, participanteId: id });
    toast('Pagamento confirmado!', 'success');
    invalidarCacheApi('obterBolao');
    await carregarBolao();
  } catch (e) { toast('Erro: ' + e.message, 'error'); }
};

window.bloquearParticipante = async (id) => {
  if (!confirm('Bloquear este participante?')) return;
  try {
    await apiRequest('desativarParticipante', { isAdmin: true, participanteId: id });
    toast('Participante bloqueado.', 'success');
    invalidarCacheApi('obterBolao');
    await carregarBolao();
  } catch (e) { toast('Erro: ' + e.message, 'error'); }
};

window.reativarParticipante = async (id) => {
  if (!confirm('Reativar o acesso deste participante?')) return;
  try {
    await apiRequest('reativarParticipante', { isAdmin: true, participanteId: id });
    toast('Participante reativado.', 'success');
    invalidarCacheApi('obterBolao');
    await carregarBolao();
  } catch (e) { toast('Erro: ' + e.message, 'error'); }
};