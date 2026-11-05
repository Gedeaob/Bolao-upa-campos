// ============================================================
// BOLÃO GB CAMPOS — GOOGLE APPS SCRIPT v2.0
// v2.0: obterBolao aceita senha, admin participa, USUARIOS,
//       aba espelho por bolão, 9 modalidades, edição sem duplicar
// ============================================================
const SHEET_ID = '11CFJmhxk9NGVhHa0VHfPtLLS1I7AJtf7jfx9qJf1Ydw';

const ABA_BOLOES        = 'BOLOES';
const ABA_PARTICIPANTES = 'PARTICIPANTES';
const ABA_JOGOS         = 'JOGOS';
const ABA_USUARIOS      = 'USUARIOS';

// ⬇️ pix_chave, pix_nome, pix_banco, comprovante_url adicionados no fim
const CAB_BOLOES = ['id','nome','modalidade','max_participantes','valor_participacao',
  'senha','qtd_jogos','data_sorteio','hora_sorteio','concurso','prazo_pagamento',
  'status','numeros_sorteados','criado_em','criado_por','ativo',
  'valor_premio','qtd_dezenas',
  'pix_chave','pix_nome','pix_banco','comprovante_url'];

const CAB_PARTICIPANTES = ['id','bolao_id','email','nome','status_pagamento',
  'data_entrada','data_pagamento','ativo','motivo_bloqueio','qtd_jogos'];
const CAB_JOGOS = ['id','participante_id','bolao_id','numeros','ordem','criado_em'];
const CAB_USUARIOS = ['email','nome_completo','criado_em'];

const MODALIDADES = {
  'Mega-Sena':       { min: 1, max: 60, qtd: 6,  maxDezenas: 20, precoBase: 6.00 },
  'Lotofácil':       { min: 1, max: 25, qtd: 15, maxDezenas: 20, precoBase: 3.00 },
  'Quina':           { min: 1, max: 80, qtd: 5,  maxDezenas: 15, precoBase: 2.50 },
  'Lotomania':       { min: 0, max: 99, qtd: 50, maxDezenas: 50, precoBase: 3.00 },
  'Timemania':       { min: 1, max: 80, qtd: 10, maxDezenas: 10, precoBase: 3.50 },
  'Dupla Sena':      { min: 1, max: 50, qtd: 6,  maxDezenas: 15, precoBase: 2.50 },
  'Dia de Sorte':    { min: 1, max: 31, qtd: 7,  maxDezenas: 15, precoBase: 2.50 },
  'Super Sete':      { min: 0, max: 9,  qtd: 7,  maxDezenas: 7,  precoBase: 2.50, permiteRepetir: true },
  '+Milionária':     { min: 1, max: 50, qtd: 6,  maxDezenas: 12, precoBase: 6.00 }
};

const CAMPOS_EDITAVEIS = [
  'nome','modalidade','max_participantes','valor_participacao',
  'senha','qtd_jogos','data_sorteio','hora_sorteio','concurso','prazo_pagamento',
  'valor_premio','qtd_dezenas',
  'pix_chave','pix_nome','pix_banco','comprovante_url'   // ⬅️ NOVOS
];
// ============================================================
// ROTEADOR
// ============================================================
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.openById(body.sheetId || SHEET_ID);
    const action = body.action;
    let result;
    switch (action) {
      case 'ping':                 result = { status: 'success', t: Date.now() }; break;
      case 'inicializar':          result = inicializarPlanilha(ss); break;
      case 'listarBoloesAdmin':    result = listarBoloesAdmin(ss); break;
      case 'listarMeusBoloes':     result = listarMeusBoloes(ss, body); break;
      case 'criarBolao':           result = criarBolao(ss, body); break;
      case 'atualizarBolao':       result = atualizarBolao(ss, body); break;
      case 'excluirBolao':         result = excluirBolao(ss, body); break;
      case 'validarSenhaBolao':    result = validarSenhaBolao(ss, body); break;
      case 'obterBolao':           result = obterBolao(ss, body); break;
      case 'entrarNoBolao':        result = entrarNoBolao(ss, body); break;
      case 'salvarJogos':          result = salvarJogos(ss, body); break;
      case 'listarParticipantesBolao': result = listarParticipantesBolao(ss, body); break;
      case 'confirmarPagamento':   result = confirmarPagamento(ss, body); break;
      case 'desativarParticipante':result = desativarParticipante(ss, body); break;
      case 'reativarParticipante': result = reativarParticipante(ss, body); break;
      case 'registrarResultado':   result = registrarResultado(ss, body); break;
      case 'atualizarStatusBolao': result = atualizarStatusBolao(ss, body); break;
      case 'bloquearInadimplentes':result = bloquearInadimplentes(ss, body); break;
      case 'obterNomeUsuario':     result = obterNomeUsuarioApi(ss, body); break;
      case 'gerarSenhaUnica':      result = gerarSenhaUnica(ss, body); break;
      case 'listarCombinacoesUsadas': result = listarCombinacoesUsadas(ss, body); break;
      default: result = { status: 'error', message: 'Ação inválida: ' + action };
    }
    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ status: 'error', message: err.toString() });
  }
}

function doGet() {
  return jsonResponse({ status: 'success', message: 'Bolão UPA API v2.0 ativa' });
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// HELPERS BASE
// ============================================================
function garantirAba(ss, nome, cabecalho) {
  let sheet = ss.getSheetByName(nome);
  if (!sheet) {
    sheet = ss.insertSheet(nome);
    sheet.appendRow(cabecalho);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, cabecalho.length)
      .setFontWeight('bold').setBackground('#0a2f5a').setFontColor('#ffffff');
  }
  return sheet;
}

function lerAba(ss, nome, cabecalho) {
  const sheet = garantirAba(ss, nome, cabecalho);
  const last = sheet.getLastRow();
  if (last < 2) return [];
  return sheet.getRange(2, 1, last - 1, cabecalho.length).getValues()
    .map((row, i) => {
      const obj = { _linha: i + 2 };
      cabecalho.forEach((col, j) => obj[col] = row[j]);
      return obj;
    });
}

function appendBolao(sheet, b) {
  sheet.appendRow(CAB_BOLOES.map(c => b[c] !== undefined ? b[c] : ''));
}
function appendParticipante(sheet, p) {
  sheet.appendRow(CAB_PARTICIPANTES.map(c => p[c] !== undefined ? p[c] : ''));
}
function appendJogo(sheet, j) {
  sheet.appendRow(CAB_JOGOS.map(c => j[c] !== undefined ? j[c] : ''));
}
function appendUsuario(sheet, u) {
  sheet.appendRow(CAB_USUARIOS.map(c => u[c] !== undefined ? u[c] : ''));
}

function novoId() { return Utilities.getUuid(); }
function agoraISO() {
  return Utilities.formatDate(new Date(), 'America/Sao_Paulo', "yyyy-MM-dd'T'HH:mm:ss");
}
function agoraBR() {
  return Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm:ss');
}

function normalizarData(v) {
  if (!v) return '';
  if (v instanceof Date) return Utilities.formatDate(v, 'America/Sao_Paulo', "yyyy-MM-dd'T'HH:mm:ss");
  return String(v);
}

function normalizarHora(v) {
  if (v === null || v === undefined || v === '') return '';
  // Date (Google Sheets pode ter convertido "20:00" em Date)
  if (v instanceof Date) {
    return Utilities.formatDate(v, 'America/Sao_Paulo', 'HH:mm');
  }
  const s = String(v).trim();
  if (!s) return '';
  // ISO com 1899 (base date do Google Sheets) → "14:06:28.000Z"
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      return Utilities.formatDate(d, 'America/Sao_Paulo', 'HH:mm');
    }
  }
  // "HH:mm" ou "HH:mm:ss"
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (m) return String(m[1]).padStart(2, '0') + ':' + m[2];
  return s;
}

function parseDataFlex(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  const s = String(v).trim();
  let d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (m) {
    return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]),
                    Number(m[4] || 0), Number(m[5] || 0));
  }
  return null;
}

// ============================================================
// 👤 USUÁRIOS — nome completo cadastrado UMA ÚNICA VEZ
// ============================================================
function garantirAbaUsuarios(ss) {
  return garantirAba(ss, ABA_USUARIOS, CAB_USUARIOS);
}

function obterNomeUsuario(ss, email) {
  if (!email) return '';
  const rows = lerAba(ss, ABA_USUARIOS, CAB_USUARIOS);
  const row = rows.find(r => String(r.email || '').toLowerCase() === String(email).toLowerCase());
  return row ? String(row.nome_completo || '') : '';
}

function salvarNomeUsuario(ss, email, nome) {
  const emailLower = String(email || '').toLowerCase();
  if (!emailLower || !nome) return '';
  const existente = obterNomeUsuario(ss, emailLower);
  if (existente) return existente;

  const sheet = garantirAbaUsuarios(ss);
  appendUsuario(sheet, {
    email: emailLower,
    nome_completo: String(nome).trim().toUpperCase(),
    criado_em: agoraISO()
  });
  return String(nome).trim().toUpperCase();
}

function obterNomeUsuarioApi(ss, p) {
  const email = String(p.email || '').toLowerCase();
  if (!email) return { status: 'error', message: 'Email obrigatório' };
  return { status: 'success', nome: obterNomeUsuario(ss, email) };
}

// ============================================================
// 📁 ABA ESPELHO POR BOLÃO (BOLAO-{id8})
// ============================================================
function _nomeAbaBolao(bolaoId) {
  const short = String(bolaoId || '').replace(/-/g, '').slice(0, 8).toUpperCase();
  return `BOLAO-${short}`.slice(0, 31);
}

function garantirAbaDoBolao(ss, bolaoId, nomeBolao) {
  const nome = _nomeAbaBolao(bolaoId);
  let sheet = ss.getSheetByName(nome);
  if (!sheet) {
    sheet = ss.insertSheet(nome);
    const cab = ['Nome','Email','StatusPagamento','Ativo','Jogo','Numeros',
                 'DataEntrada','DataPagamento'];
    sheet.appendRow(cab);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, cab.length)
      .setFontWeight('bold').setBackground('#1e3a8a').setFontColor('#ffffff');
    sheet.setColumnWidth(1, 220);
    sheet.setColumnWidth(2, 260);
    sheet.setColumnWidth(3, 140);
    sheet.setColumnWidth(4, 80);
    sheet.setColumnWidth(5, 60);
    sheet.setColumnWidth(6, 320);
    sheet.setColumnWidth(7, 150);
    sheet.setColumnWidth(8, 150);
    // Nota informativa no cabeçalho
    try {
      sheet.getRange(1, 1).setNote(
        `Bolão: ${nomeBolao || '(sem nome)'}\nID: ${bolaoId}\n\n` +
        `Esta aba é um ESPELHO automático da aba PARTICIPANTES/JOGOS ` +
        `para facilitar a consulta e a exportação.`
      );
    } catch (e) {}
  }
  return sheet;
}

function sincronizarAbaBolao(ss, bolaoId, nomeBolao) {
  try {
    const sheet = garantirAbaDoBolao(ss, bolaoId, nomeBolao);
    const last = sheet.getLastRow();
    if (last > 1) {
      sheet.getRange(2, 1, last - 1, 8).clearContent();
    }

    const particips = lerAba(ss, ABA_PARTICIPANTES, CAB_PARTICIPANTES)
      .filter(x => String(x.bolao_id) === String(bolaoId));
    const jogos = lerAba(ss, ABA_JOGOS, CAB_JOGOS)
      .filter(x => String(x.bolao_id) === String(bolaoId));

    const rows = [];
    particips.forEach(p => {
      const meusJogos = jogos
        .filter(j => String(j.participante_id) === String(p.id))
        .sort((a, b) => Number(a.ordem) - Number(b.ordem));

      const ativo = String(p.ativo) !== 'false' ? 'SIM' : 'NÃO';
      const dataEntrada = normalizarData(p.data_entrada);
      const dataPagto   = normalizarData(p.data_pagamento);

      if (meusJogos.length === 0) {
        rows.push([p.nome, p.email, p.status_pagamento, ativo, '-',
                   'Sem jogos', dataEntrada, dataPagto]);
      } else {
        meusJogos.forEach((j, i) => {
          rows.push([p.nome, p.email, p.status_pagamento, ativo,
                     'J' + (i + 1), String(j.numeros || ''),
                     dataEntrada, dataPagto]);
        });
      }
    });

    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, 8).setValues(rows);
    }
  } catch (e) {
    console.warn('sincronizarAbaBolao falhou:', e);
  }
}

// ============================================================
// INICIALIZAÇÃO
// ============================================================
function inicializarPlanilha(ss) {
  garantirAba(ss, ABA_BOLOES, CAB_BOLOES);
  garantirAba(ss, ABA_PARTICIPANTES, CAB_PARTICIPANTES);
  garantirAba(ss, ABA_JOGOS, CAB_JOGOS);
  garantirAbaUsuarios(ss);
  return { status: 'success', message: 'Planilha inicializada com sucesso' };
}

// ============================================================
// BOLÕES — LISTAR
// ============================================================
function listarBoloesAdmin(ss) {
  const bolas = lerAba(ss, ABA_BOLOES, CAB_BOLOES).filter(b => String(b.ativo) !== 'false');
  const particips = lerAba(ss, ABA_PARTICIPANTES, CAB_PARTICIPANTES);
  const result = bolas.map(b => {
    const ps = particips.filter(p => String(p.bolao_id) === String(b.id));
    const pagos     = ps.filter(p => String(p.status_pagamento) === 'pago'     && String(p.ativo) !== 'false').length;
    const pendentes = ps.filter(p => String(p.status_pagamento) === 'pendente' && String(p.ativo) !== 'false').length;
    const bloqueados= ps.filter(p => String(p.ativo) === 'false').length;
    return normalizarBolao(b, pagos, pendentes, bloqueados);
  });
  return { status: 'success', boloes: result };
}

function listarMeusBoloes(ss, p) {
  const email = String(p.email || '').toLowerCase();
  const isAdmin = !!p.isAdmin;
  if (!email) return { status: 'error', message: 'Email obrigatório' };

  const todas = lerAba(ss, ABA_BOLOES, CAB_BOLOES).filter(b => String(b.ativo) !== 'false');
  const particips = lerAba(ss, ABA_PARTICIPANTES, CAB_PARTICIPANTES);
  const meusIds = new Set(
    particips.filter(x => String(x.email || '').toLowerCase() === email)
            .map(x => String(x.bolao_id))
  );

  const filtradas = isAdmin ? todas : todas.filter(b => meusIds.has(String(b.id)));

  const result = filtradas.map(b => {
    const ps = particips.filter(p => String(p.bolao_id) === String(b.id));
    const pagos     = ps.filter(p => String(p.status_pagamento) === 'pago'     && String(p.ativo) !== 'false').length;
    const pendentes = ps.filter(p => String(p.status_pagamento) === 'pendente' && String(p.ativo) !== 'false').length;
    const bloqueados= ps.filter(p => String(p.ativo) === 'false').length;
    const minha = ps.find(p => String(p.email || '').toLowerCase() === email) || null;
    return normalizarBolao(b, pagos, pendentes, bloqueados, minha);
  });

  return { status: 'success', boloes: result };
}

function normalizarBolao(b, pagos, pendentes, bloqueados, minha) {
  return {
    id: b.id, nome: b.nome, modalidade: b.modalidade,
    max_participantes: Number(b.max_participantes) || 0,
    valor_participacao: Number(b.valor_participacao) || 0,
    qtd_jogos: Number(b.qtd_jogos) || 1,
    valor_premio: Number(b.valor_premio) || 0,
    qtd_dezenas:  Number(b.qtd_dezenas) || 0,
    pix_chave:        String(b.pix_chave || ''),
    pix_nome:         String(b.pix_nome || ''),
    pix_banco:        String(b.pix_banco || ''),
    comprovante_url:  String(b.comprovante_url || ''),
    data_sorteio: normalizarData(b.data_sorteio),
    hora_sorteio: normalizarHora(b.hora_sorteio), concurso: b.concurso,
    prazo_pagamento: normalizarData(b.prazo_pagamento),
    status: b.status || 'ativo', 
    numeros_sorteados: String(b.numeros_sorteados || ''),
    criado_em: normalizarData(b.criado_em), criado_por: b.criado_por,
    pagos, pendentes, bloqueados,
    vagas_disponiveis: Math.max(0, (Number(b.max_participantes) || 0) - pagos),
    minha_participacao: minha ? {
      id: minha.id, nome: minha.nome,
      status_pagamento: minha.status_pagamento,
      ativo: String(minha.ativo) !== 'false',
      motivo_bloqueio: minha.motivo_bloqueio || '',
      data_pagamento: normalizarData(minha.data_pagamento),
      qtd_jogos: Number(minha.qtd_jogos) || 0
    } : null
  };
}

// ============================================================
// 🔐 GERADOR DE SENHA ÚNICA
// ============================================================
function _gerarSenhaInterna(tamanho) {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz';
  const numeros = '23456789';
  const especiais = '!@#$%&*';
  const todos = letras + numeros + especiais;

  // Garante 1 de cada tipo
  let senha = '';
  senha += letras[Math.floor(Math.random() * letras.length)];
  senha += numeros[Math.floor(Math.random() * numeros.length)];
  senha += especiais[Math.floor(Math.random() * especiais.length)];
  for (let i = 3; i < tamanho; i++) {
    senha += todos[Math.floor(Math.random() * todos.length)];
  }
  // Embaralha
  return senha.split('').sort(() => Math.random() - 0.5).join('');
}

function verificarSenhaUnica(ss, senha, idIgnorar) {
  if (!senha) return false;
  const bolas = lerAba(ss, ABA_BOLOES, CAB_BOLOES)
    .filter(b => String(b.ativo) !== 'false');
  return !bolas.some(b =>
    String(b.senha) === String(senha) &&
    String(b.id) !== String(idIgnorar || '')
  );
}

function gerarSenhaUnica(ss, p) {
  const baseTamanho = Math.max(6, Math.min(20, Number(p.tamanho) || 6));
  for (let t = 0; t < 20; t++) {
    const tamanho = baseTamanho + Math.floor(t / 5);   // 6, 6, 6, 6, 6, 7, 7, 7, 7, 8...
    const senha = _gerarSenhaInterna(tamanho);
    if (verificarSenhaUnica(ss, senha)) {
      return { status: 'success', senha, tamanho, tentativas: t + 1 };
    }
  }
  return { status: 'error', message: 'Não foi possível gerar senha única. Tente novamente.' };
}


// ============================================================
// BOLÕES — CRUD
// ============================================================
function criarBolao(ss, p) {
  if (!p.isAdmin) return { status: 'error', message: 'Apenas administradores podem criar bolões' };
  const d = p.dados || {};
  if (!d.nome || !d.modalidade) {
    return { status: 'error', message: 'Nome e modalidade são obrigatórios' };
  }
  const modal = MODALIDADES[d.modalidade];
  if (!modal) return { status: 'error', message: 'Modalidade inválida' };

  // Validar dezenas
  const qtdDezenas = Number(d.qtd_dezenas) || modal.qtd;
  if (qtdDezenas < modal.qtd || qtdDezenas > (modal.maxDezenas || modal.qtd)) {
    return {
      status: 'error',
      message: `Dezenas por jogo deve estar entre ${modal.qtd} e ${modal.maxDezenas || modal.qtd}.`
    };
  }

  // Senha: usa a fornecida OU gera única (6→7→8...) automaticamente
  let senhaFinal = String(d.senha || '').trim();
  if (!senhaFinal) {
    const r = gerarSenhaUnica(ss, { tamanho: 6 });
    if (r.status !== 'success') {
      return { status: 'error', message: 'Falha ao gerar senha única.' };
    }
    senhaFinal = r.senha;
  } else if (!verificarSenhaUnica(ss, senhaFinal)) {
    return { status: 'error', message: 'Esta senha já está em uso. Escolha outra.' };
  }

  const sheet = garantirAba(ss, ABA_BOLOES, CAB_BOLOES);
  const bolao = {
    id: novoId(),
    nome: String(d.nome).trim(),
    modalidade: d.modalidade,
    max_participantes: Number(d.max_participantes) || 10,
    valor_participacao: Number(d.valor_participacao) || 0,
    senha: senhaFinal,
    qtd_jogos: Math.max(1, Number(d.qtd_jogos) || 1),
    data_sorteio: d.data_sorteio || '',
    hora_sorteio: d.hora_sorteio || '',
    concurso: d.concurso || '',
    prazo_pagamento: d.prazo_pagamento || '',
    status: 'ativo',
    numeros_sorteados: '',
    criado_em: agoraISO(),
    criado_por: p.email || '',
    ativo: true,
    valor_premio: Number(d.valor_premio) || 0,
    qtd_dezenas: qtdDezenas,
    pix_chave:        String(d.pix_chave || '').trim(),
    pix_nome:         String(d.pix_nome || '').trim(),
    pix_banco:        String(d.pix_banco || '').trim(),
    comprovante_url:  String(d.comprovante_url || '').trim()
  };
  appendBolao(sheet, bolao);

  garantirAbaDoBolao(ss, bolao.id, bolao.nome);
  return { status: 'success', id: bolao.id, bolao };
}

function atualizarBolao(ss, p) {
  if (!p.isAdmin) return { status: 'error', message: 'Sem permissão' };
  const sheet = garantirAba(ss, ABA_BOLOES, CAB_BOLOES);
  const rows  = lerAba(ss, ABA_BOLOES, CAB_BOLOES);
  const alvo  = rows.find(r => String(r.id) === String(p.id));
  if (!alvo) return { status: 'error', message: 'Bolão não encontrado' };

  const d = p.dados || {};

  // ── Validações ──
  if (d.modalidade && !MODALIDADES[d.modalidade]) {
    return { status: 'error', message: 'Modalidade inválida' };
  }
  const novaModalidade = d.modalidade || alvo.modalidade;
  if (d.qtd_dezenas !== undefined) {
    const modal = MODALIDADES[novaModalidade];
    const qtdDez = Number(d.qtd_dezenas);
    if (!modal || qtdDez < modal.qtd || qtdDez > (modal.maxDezenas || modal.qtd)) {
      return {
        status: 'error',
        message: `Dezenas por jogo deve estar entre ${modal.qtd} e ${modal.maxDezenas || modal.qtd}.`
      };
    }
  }
  if (d.senha !== undefined && String(d.senha).trim() !== '') {
    if (!verificarSenhaUnica(ss, String(d.senha).trim(), alvo.id)) {
      return { status: 'error', message: 'Esta senha já está em uso em outro bolão.' };
    }
  }

  // ── Aplicar campos editáveis ──
  const novos = { ...alvo };
  CAMPOS_EDITAVEIS.forEach(col => {
    if (col === 'senha') {
      if (d.senha !== undefined && String(d.senha).trim() !== '') {
        novos.senha = String(d.senha).trim();
      }
    } else if (d[col] !== undefined) {
      novos[col] = d[col];
    }
  });

  const linhaValores = CAB_BOLOES.map(c => novos[c] !== undefined ? novos[c] : '');
  sheet.getRange(alvo._linha, 1, 1, CAB_BOLOES.length).setValues([linhaValores]);

  sincronizarAbaBolao(ss, alvo.id, novos.nome);
  return { status: 'success', message: 'Bolão atualizado' };
}

function excluirBolao(ss, p) {
  if (!p.isAdmin) return { status: 'error', message: 'Sem permissão' };
  const sheet = garantirAba(ss, ABA_BOLOES, CAB_BOLOES);
  const rows  = lerAba(ss, ABA_BOLOES, CAB_BOLOES);
  const alvo  = rows.find(r => String(r.id) === String(p.id));
  if (!alvo) return { status: 'error', message: 'Bolão não encontrado' };

  const colAtivo = CAB_BOLOES.indexOf('ativo') + 1;
  sheet.getRange(alvo._linha, colAtivo).setValue(false);
  return { status: 'success', message: 'Bolão desativado' };
}

function atualizarStatusBolao(ss, p) {
  if (!p.isAdmin) return { status: 'error', message: 'Sem permissão' };
  const sheet = garantirAba(ss, ABA_BOLOES, CAB_BOLOES);
  const rows  = lerAba(ss, ABA_BOLOES, CAB_BOLOES);
  const alvo  = rows.find(r => String(r.id) === String(p.id));
  if (!alvo) return { status: 'error', message: 'Bolão não encontrado' };
  const col = CAB_BOLOES.indexOf('status') + 1;
  sheet.getRange(alvo._linha, col).setValue(p.status || 'ativo');
  return { status: 'success' };
}

// ============================================================
// VALIDAR SENHA / OBTER BOLÃO (correção principal)
// ============================================================
function validarSenhaBolao(ss, p) {
  const senha = String(p.senha || '');
  if (!senha) return { status: 'error', message: 'Informe a senha' };
  const bolas = lerAba(ss, ABA_BOLOES, CAB_BOLOES)
    .filter(b => String(b.ativo) !== 'false' && String(b.senha) === senha);
  if (!bolas.length) return { status: 'error', message: 'Senha inválida' };
  return { status: 'success', boloes: bolas.map(b => ({
    id: b.id, nome: b.nome, modalidade: b.modalidade,
    concurso: b.concurso, data_sorteio: normalizarData(b.data_sorteio),
    hora_sorteio: b.hora_sorteio, status: b.status
  }))};
}

/**
 * ✅ CORREÇÃO PRINCIPAL DO BUG "Você não participa desse bolão"
 *
 * Regras de acesso:
 *  - Se é participante (email bate)     → libera (com as regras de pagamento)
 *  - Se é admin                          → libera (acesso total)
 *  - Se a SENHA enviada confere          → libera (tela de entrada, sem jogos)
 *  - Caso contrário                      → bloqueia
 */
function obterBolao(ss, p) {
  const email   = String(p.email || '').toLowerCase();
  const isAdmin = !!p.isAdmin;
  const senha   = String(p.senha || '');

  const bolas = lerAba(ss, ABA_BOLOES, CAB_BOLOES);
  const bolao = bolas.find(b => String(b.id) === String(p.id) && String(b.ativo) !== 'false');
  if (!bolao) return { status: 'error', message: 'Bolão não encontrado' };

  const particips = lerAba(ss, ABA_PARTICIPANTES, CAB_PARTICIPANTES)
    .filter(x => String(x.bolao_id) === String(bolao.id));
  const jogos = lerAba(ss, ABA_JOGOS, CAB_JOGOS)
    .filter(x => String(x.bolao_id) === String(bolao.id));

  const minha = particips.find(x => String(x.email || '').toLowerCase() === email) || null;

  // ── 1) Admin: cria aba espelho se ainda não existir ──
  if (isAdmin) {
    try { garantirAbaDoBolao(ss, bolao.id, bolao.nome); } catch (e) {}
  }

  // ── 2) Se não é participante e não é admin, a SENHA precisa conferir ──
  if (!minha && !isAdmin) {
    const senhaOK = senha && String(senha) === String(bolao.senha);
    if (!senhaOK) {
      return { status: 'error', message: 'Você não participa deste bolão.' };
    }
    // Senha OK → segue adiante com minha = null
  }

  // ── 3) Auto-bloqueio por prazo (participante não pago; admin nunca é bloqueado) ──
  if (minha && !isAdmin
      && String(minha.ativo) !== 'false'
      && String(minha.status_pagamento) !== 'pago') {
    const prazo = parseDataFlex(bolao.prazo_pagamento);
    if (prazo && new Date() > prazo) {
      const sheetP   = ss.getSheetByName(ABA_PARTICIPANTES);
      const colAtivo = CAB_PARTICIPANTES.indexOf('ativo') + 1;
      const colMotivo= CAB_PARTICIPANTES.indexOf('motivo_bloqueio') + 1;
      sheetP.getRange(minha._linha, colAtivo).setValue(false);
      sheetP.getRange(minha._linha, colMotivo).setValue('prazo_expirado');
      minha.ativo = false;
      minha.motivo_bloqueio = 'prazo_expirado';
    }
  }

  // ── 4) Bloqueio por ativação ──
  if (minha && String(minha.ativo) === 'false') {
    return {
      status: 'blocked',
      message: minha.motivo_bloqueio === 'prazo_expirado'
        ? 'O prazo para pagamento terminou e não foi identificado o pagamento. Procure o administrador.'
        : 'Seu acesso a este bolão está desativado. Procure o administrador.',
      motivo: minha.motivo_bloqueio || 'manual'
    };
  }

  const pagos      = particips.filter(x => String(x.status_pagamento) === 'pago'     && String(x.ativo) !== 'false').length;
  const pendentes  = particips.filter(x => String(x.status_pagamento) === 'pendente' && String(x.ativo) !== 'false').length;
  const bloqueados = particips.filter(x => String(x.ativo) === 'false').length;

  const bolaoNorm = normalizarBolao(bolao, pagos, pendentes, bloqueados, minha);

  // ── 5) Permissão de visualização ──
  const podeVerTudo = isAdmin || (minha && String(minha.status_pagamento) === 'pago');

  const participantesPub = particips
    .filter(x => String(x.ativo) !== 'false' || isAdmin)
    .map(x => {
      const meusJogos = jogos
        .filter(j => String(j.participante_id) === String(x.id))
        .sort((a, b) => Number(a.ordem) - Number(b.ordem))
        .map(j => ({ numeros: String(j.numeros || ''), ordem: Number(j.ordem) || 1 }));

      const base = {
        id: x.id,
        nome: x.nome,
        email: isAdmin ? x.email : '',
        status_pagamento: x.status_pagamento,
        ativo: String(x.ativo) !== 'false',
        motivo_bloqueio: x.motivo_bloqueio || '',
        data_pagamento: normalizarData(x.data_pagamento),
        jogos: meusJogos
      };

      // Pendente + não admin + não é eu → esconde os jogos
      if (!podeVerTudo && String(x.email || '').toLowerCase() !== email) {
        return { ...base, jogos: [], oculto: true };
      }
      return base;
    });

  const resposta = {
    status: 'success',
    bolao: bolaoNorm,
    participantes: participantesPub,
    numeros_sorteados: String(bolao.numeros_sorteados || ''),
    nome_cadastrado: obterNomeUsuario(ss, email) || ''   // ✅ NOVO
  };

   // ✅ Admin pode ver a senha (para exibir no formulário de edição)
  if (isAdmin) {
    resposta.bolao.senha = String(bolao.senha || '');
  }

  // ✅ DEFESA EM PROFUNDIDADE: comprovante só para pagos/admin
  const ehPagoOuAdmin = isAdmin || (minha && String(minha.status_pagamento) === 'pago');
  if (!ehPagoOuAdmin && resposta.bolao) {
    resposta.bolao.comprovante_url = '';
  }

  return resposta;
}

// ============================================================
// ENTRAR NO BOLÃO (admin participa; nome cadastrado UMA vez)
// ============================================================
function entrarNoBolao(ss, p) {
  const email   = String(p.email || '').toLowerCase();
  const isAdmin = !!p.isAdmin;
  const nomeProvido = String(p.nome || '').trim().toUpperCase();

  if (!email) return { status: 'error', message: 'Email obrigatório' };
  if (!nomeProvido && !isAdmin) return { status: 'error', message: 'Informe seu nome' };

  const bolas = lerAba(ss, ABA_BOLOES, CAB_BOLOES);
  const bolao = bolas.find(b => String(b.id) === String(p.bolaoId) && String(b.ativo) !== 'false');
  if (!bolao) return { status: 'error', message: 'Bolão não encontrado' };

  if (bolao.status === 'sorteado' || bolao.status === 'encerrado') {
    return { status: 'error', message: 'Este bolão não aceita mais participantes' };
  }

  // ✅ Admin não precisa de senha; demais usuários sim
  if (!isAdmin && String(bolao.senha) !== String(p.senha || '')) {
    return { status: 'error', message: 'Senha do bolão incorreta' };
  }

  // Prazo expirado? (admin pode entrar a qualquer momento)
  const prazo = parseDataFlex(bolao.prazo_pagamento);
  if (prazo && new Date() > prazo && !isAdmin) {
    return { status: 'error', message: 'O prazo para entrar neste bolão já terminou.' };
  }

  const particips = lerAba(ss, ABA_PARTICIPANTES, CAB_PARTICIPANTES)
    .filter(x => String(x.bolao_id) === String(bolao.id));
  const existente = particips.find(x => String(x.email || '').toLowerCase() === email);

  // ✅ Nome único: se já existe em USUARIOS, reutiliza
  const nomeCadastrado = obterNomeUsuario(ss, email);
  const nomeFinal = nomeCadastrado || salvarNomeUsuario(ss, email, nomeProvido);

  // Se já participa, só atualiza o nome (se estiver vazio) e retorna
  if (existente) {
    if (!existente.nome && nomeFinal) {
      const sheet = ss.getSheetByName(ABA_PARTICIPANTES);
      const colNome = CAB_PARTICIPANTES.indexOf('nome') + 1;
      sheet.getRange(existente._linha, colNome).setValue(nomeFinal);
    }
    sincronizarAbaBolao(ss, bolao.id, bolao.nome);
    return {
      status: 'success',
      participanteId: existente.id,
      jaExistia: true,
      nome_usado: nomeFinal,
      nome_novo: false
    };
  }

  // Verificar vagas (apenas pagos contam; admin não ocupa vaga paga)
  const pagos = particips.filter(x => String(x.status_pagamento) === 'pago' && String(x.ativo) !== 'false').length;
  if (pagos >= Number(bolao.max_participantes) && !isAdmin) {
    return { status: 'error', message: 'Não há mais vagas neste bolão.' };
  }

  const sheet = ss.getSheetByName(ABA_PARTICIPANTES);
  const id = novoId();
  const row = {
    id,
    bolao_id: bolao.id,
    email,
    nome: nomeFinal || nomeProvido || email,
    // ✅ Admin já entra como pago (não paga a si mesmo)
    status_pagamento: isAdmin ? 'pago' : 'pendente',
    data_entrada: agoraISO(),
    data_pagamento: isAdmin ? agoraISO() : '',
    ativo: true,
    motivo_bloqueio: '',
    qtd_jogos: 0
  };
  appendParticipante(sheet, row);

  // ✅ Atualiza aba espelho
  sincronizarAbaBolao(ss, bolao.id, bolao.nome);

  return {
    status: 'success',
    participanteId: id,
    jaExistia: false,
    nome_usado: row.nome,
    nome_novo: !nomeCadastrado
  };
}

// ============================================================
// SALVAR JOGOS
// ============================================================
function salvarJogos(ss, p) {
  const email = String(p.email || '').toLowerCase();
  if (!email) return { status: 'error', message: 'Email obrigatório' };

  const particips = lerAba(ss, ABA_PARTICIPANTES, CAB_PARTICIPANTES);
  const eu = particips.find(x =>
    String(x.bolao_id) === String(p.bolaoId) &&
    String(x.email || '').toLowerCase() === email
  );
  if (!eu) return { status: 'error', message: 'Você não participa deste bolão' };
  if (String(eu.ativo) === 'false') {
    return { status: 'error', message: 'Seu acesso está bloqueado.' };
  }
  if (String(eu.status_pagamento) === 'pago' && !p.isAdmin) {
    return { status: 'error', message: 'Pagamento já confirmado. Não é possível editar os jogos.' };
  }

  const bolas = lerAba(ss, ABA_BOLOES, CAB_BOLOES);
  const bolao = bolas.find(b => String(b.id) === String(p.bolaoId));
  if (!bolao) return { status: 'error', message: 'Bolão não encontrado' };

  const prazo = parseDataFlex(bolao.prazo_pagamento);
  if (prazo && new Date() > prazo && !p.isAdmin) {
    return { status: 'error', message: 'O prazo para envio dos jogos já terminou.' };
  }

  const modal = MODALIDADES[bolao.modalidade];
  if (!modal) return { status: 'error', message: 'Modalidade inválida' };

  const qtdDezenas = Number(bolao.qtd_dezenas) || modal.qtd;
  const qtdJogos = Math.max(1, Number(bolao.qtd_jogos) || 1);
  const jogos = Array.isArray(p.jogos) ? p.jogos : [];
  if (jogos.length !== qtdJogos) {
    return { status: 'error', message: `Você deve enviar exatamente ${qtdJogos} jogo(s).` };
  }

  // ⬇️ Validação de cada jogo — SEM duplicação de bloco
  const limpos = [];
  for (let i = 0; i < jogos.length; i++) {
    const numeros = String(jogos[i] || '').split(',').map(s => s.trim()).filter(Boolean).map(Number);
    if (numeros.length !== qtdDezenas) {
      return { status: 'error', message: `Jogo ${i + 1}: escolha exatamente ${qtdDezenas} dezenas.` };
    }
    if (numeros.some(n => isNaN(n) || n < modal.min || n > modal.max)) {
      return { status: 'error', message: `Jogo ${i + 1}: números fora do intervalo permitido (${modal.min}-${modal.max}).` };
    }
    if (!modal.permiteRepetir && new Set(numeros).size !== numeros.length) {
      return { status: 'error', message: `Jogo ${i + 1}: números repetidos.` };
    }
    limpos.push(modal.permiteRepetir
      ? numeros.join(',')
      : numeros.sort((a, b) => a - b).join(',')
    );
  }

  // ⬇️ Verificação de duplicidade ENTRE os próprios jogos
  const combosDoSave = limpos.map(c => c.split(',').map(Number).sort((a,b)=>a-b).join(','));
  const seenSave = new Set();
  for (let i = 0; i < combosDoSave.length; i++) {
    if (seenSave.has(combosDoSave[i])) {
      return {
        status: 'error',
        message: `Jogo ${i + 1}: tem os mesmos números que outro jogo seu. Escolha uma combinação diferente.`,
        code: 'combinacao_duplicada_propria'
      };
    }
    seenSave.add(combosDoSave[i]);
  }

  // ⬇️ Verificação de duplicidade com OUTROS participantes
  const outros = particips.filter(x =>
    String(x.bolao_id) === String(bolao.id) &&
    String(x.id) !== String(eu.id) &&
    String(x.ativo) !== 'false'
  );
  const outrosIds = new Set(outros.map(x => String(x.id)));
  const combosOutros = new Set();
  lerAba(ss, ABA_JOGOS, CAB_JOGOS)
    .filter(j => outrosIds.has(String(j.participante_id)))
    .forEach(j => {
      const nums = String(j.numeros || '').split(',').map(n => Number(n.trim())).filter(n => !isNaN(n))
        .sort((a,b) => a-b);
      combosOutros.add(nums.join(','));
    });

  for (let i = 0; i < combosDoSave.length; i++) {
    if (combosOutros.has(combosDoSave[i])) {
      return {
        status: 'error',
        message: `Jogo ${i + 1}: outro participante já escolheu esta mesma combinação. Escolha outra.`,
        code: 'combinacao_duplicada',
        jogoDuplicado: i + 1
      };
    }
  }

  // Apagar jogos antigos deste participante
  const sheetJogos = ss.getSheetByName(ABA_JOGOS);
  const jogosExistentes = lerAba(ss, ABA_JOGOS, CAB_JOGOS)
    .filter(j => String(j.participante_id) === String(eu.id))
    .sort((a, b) => b._linha - a._linha);
  jogosExistentes.forEach(j => sheetJogos.deleteRow(j._linha));

  // Inserir novos
  limpos.forEach((nums, i) => {
    appendJogo(sheetJogos, {
      id: novoId(),
      participante_id: eu.id,
      bolao_id: bolao.id,
      numeros: nums,
      ordem: i + 1,
      criado_em: agoraISO()
    });
  });

  // Atualizar qtd_jogos no participante
  const sheetP = ss.getSheetByName(ABA_PARTICIPANTES);
  const colQtd = CAB_PARTICIPANTES.indexOf('qtd_jogos') + 1;
  sheetP.getRange(eu._linha, colQtd).setValue(limpos.length);

  sincronizarAbaBolao(ss, bolao.id, bolao.nome);
  return { status: 'success', jogos: limpos };
}

// ============================================================
// LISTAR COMBINAÇÕES USADAS
// ============================================================
function listarCombinacoesUsadas(ss, p) {
  const bolaoId = String(p.bolaoId || '');
  const email   = String(p.email || '').toLowerCase();
  if (!bolaoId || !email) return { status: 'error', message: 'Dados incompletos' };

  const particips = lerAba(ss, ABA_PARTICIPANTES, CAB_PARTICIPANTES);
  const eu = particips.find(x =>
    String(x.bolao_id) === bolaoId &&
    String(x.email || '').toLowerCase() === email
  );
  if (!eu) return { status: 'error', message: 'Você não participa deste bolão' };

  const participMap = {};
  particips.forEach(pr => { participMap[String(pr.id)] = pr; });

  const usadas = [];
  lerAba(ss, ABA_JOGOS, CAB_JOGOS)
    .filter(j => String(j.bolao_id) === bolaoId)
    .forEach(j => {
      const dono = participMap[String(j.participante_id)];
      if (!dono) return;
      // Ignora os próprios jogos e participantes bloqueados
      if (String(dono.email || '').toLowerCase() === email) return;
      if (String(dono.ativo) === 'false') return;
      const nums = String(j.numeros || '').split(',').map(n => Number(n.trim()))
        .filter(n => !isNaN(n)).sort((a,b) => a-b);
      if (nums.length) usadas.push(nums.join(','));
    });

  return { status: 'success', combinacoes: usadas };
}


// ============================================================
// LISTAR PARTICIPANTES (ADMIN)
// ============================================================
function listarParticipantesBolao(ss, p) {
  if (!p.isAdmin) return { status: 'error', message: 'Sem permissão' };
  const particips = lerAba(ss, ABA_PARTICIPANTES, CAB_PARTICIPANTES)
    .filter(x => String(x.bolao_id) === String(p.bolaoId));
  const jogos = lerAba(ss, ABA_JOGOS, CAB_JOGOS)
    .filter(x => String(x.bolao_id) === String(p.bolaoId));

  const lista = particips.map(x => ({
    id: x.id,
    email: x.email,
    nome: x.nome,
    status_pagamento: x.status_pagamento,
    ativo: String(x.ativo) !== 'false',
    motivo_bloqueio: x.motivo_bloqueio || '',
    data_entrada: normalizarData(x.data_entrada),
    data_pagamento: normalizarData(x.data_pagamento),
    jogos: jogos
      .filter(j => String(j.participante_id) === String(x.id))
      .sort((a, b) => Number(a.ordem) - Number(b.ordem))
      .map(j => ({ numeros: String(j.numeros || ''), ordem: Number(j.ordem) || 1 }))
  }));
  return { status: 'success', participantes: lista };
}

// ============================================================
// PAGAMENTO / BLOQUEIO
// ============================================================
function confirmarPagamento(ss, p) {
  if (!p.isAdmin) return { status: 'error', message: 'Sem permissão' };
  const sheet = ss.getSheetByName(ABA_PARTICIPANTES);
  const rows  = lerAba(ss, ABA_PARTICIPANTES, CAB_PARTICIPANTES);
  const alvo  = rows.find(r => String(r.id) === String(p.participanteId));
  if (!alvo) return { status: 'error', message: 'Participante não encontrado' };

  const colStatus = CAB_PARTICIPANTES.indexOf('status_pagamento') + 1;
  const colData   = CAB_PARTICIPANTES.indexOf('data_pagamento') + 1;
  const colAtivo  = CAB_PARTICIPANTES.indexOf('ativo') + 1;
  const colMotivo = CAB_PARTICIPANTES.indexOf('motivo_bloqueio') + 1;
  sheet.getRange(alvo._linha, colStatus).setValue('pago');
  sheet.getRange(alvo._linha, colData).setValue(agoraISO());
  sheet.getRange(alvo._linha, colAtivo).setValue(true);
  sheet.getRange(alvo._linha, colMotivo).setValue('');

  // Sincroniza aba espelho
  const bolas = lerAba(ss, ABA_BOLOES, CAB_BOLOES);
  const bolao = bolas.find(b => String(b.id) === String(alvo.bolao_id));
  if (bolao) sincronizarAbaBolao(ss, bolao.id, bolao.nome);

  return { status: 'success' };
}

function desativarParticipante(ss, p) {
  if (!p.isAdmin) return { status: 'error', message: 'Sem permissão' };
  const sheet = ss.getSheetByName(ABA_PARTICIPANTES);
  const rows  = lerAba(ss, ABA_PARTICIPANTES, CAB_PARTICIPANTES);
  const alvo  = rows.find(r => String(r.id) === String(p.participanteId));
  if (!alvo) return { status: 'error', message: 'Participante não encontrado' };

  const colAtivo  = CAB_PARTICIPANTES.indexOf('ativo') + 1;
  const colMotivo = CAB_PARTICIPANTES.indexOf('motivo_bloqueio') + 1;
  sheet.getRange(alvo._linha, colAtivo).setValue(false);
  sheet.getRange(alvo._linha, colMotivo).setValue('manual');

  const bolas = lerAba(ss, ABA_BOLOES, CAB_BOLOES);
  const bolao = bolas.find(b => String(b.id) === String(alvo.bolao_id));
  if (bolao) sincronizarAbaBolao(ss, bolao.id, bolao.nome);

  return { status: 'success' };
}

function reativarParticipante(ss, p) {
  if (!p.isAdmin) return { status: 'error', message: 'Sem permissão' };
  const sheet = ss.getSheetByName(ABA_PARTICIPANTES);
  const rows  = lerAba(ss, ABA_PARTICIPANTES, CAB_PARTICIPANTES);
  const alvo  = rows.find(r => String(r.id) === String(p.participanteId));
  if (!alvo) return { status: 'error', message: 'Participante não encontrado' };

  const colAtivo  = CAB_PARTICIPANTES.indexOf('ativo') + 1;
  const colMotivo = CAB_PARTICIPANTES.indexOf('motivo_bloqueio') + 1;
  sheet.getRange(alvo._linha, colAtivo).setValue(true);
  sheet.getRange(alvo._linha, colMotivo).setValue('');

  const bolas = lerAba(ss, ABA_BOLOES, CAB_BOLOES);
  const bolao = bolas.find(b => String(b.id) === String(alvo.bolao_id));
  if (bolao) sincronizarAbaBolao(ss, bolao.id, bolao.nome);

  return { status: 'success' };
}

// ============================================================
// REGISTRAR RESULTADO
// ============================================================
function registrarResultado(ss, p) {
  if (!p.isAdmin) return { status: 'error', message: 'Sem permissão' };
  const bolas = lerAba(ss, ABA_BOLOES, CAB_BOLOES);
  const bolao = bolas.find(b => String(b.id) === String(p.bolaoId));
  if (!bolao) return { status: 'error', message: 'Bolão não encontrado' };

  const modal = MODALIDADES[bolao.modalidade];
// ⬇️ NOVO: sorteio deve ter o mesmo qtd_dezenas do bolão
const qtdDezenas = Number(bolao.qtd_dezenas) || modal.qtd;

const nums = String(p.numeros || '').split(',').map(s => s.trim()).filter(Boolean).map(Number);
if (nums.length !== qtdDezenas) {
  return { status: 'error', message: `Informe exatamente ${qtdDezenas} números sorteados.` };
}
  if (nums.some(n => isNaN(n) || n < modal.min || n > modal.max)) {
    return { status: 'error', message: `Números devem estar entre ${modal.min} e ${modal.max}.` };
  }
  if (!modal.permiteRepetir && new Set(nums).size !== nums.length) {
    return { status: 'error', message: 'Não pode haver números repetidos.' };
  }

  const sheet = ss.getSheetByName(ABA_BOLOES);
  const colNums   = CAB_BOLOES.indexOf('numeros_sorteados') + 1;
  const colStatus = CAB_BOLOES.indexOf('status') + 1;
  const numsFinal = modal.permiteRepetir ? nums : nums.sort((a, b) => a - b);
  sheet.getRange(bolao._linha, colNums).setValue(numsFinal.join(','));
  sheet.getRange(bolao._linha, colStatus).setValue('sorteado');

  return { status: 'success', numeros: numsFinal };
}

// ============================================================
// BLOQUEIO EM MASSA
// ============================================================
function bloquearInadimplentes(ss, p) {
  if (!p.isAdmin) return { status: 'error', message: 'Sem permissão' };
  const bolas = lerAba(ss, ABA_BOLOES, CAB_BOLOES).filter(b => String(b.ativo) !== 'false');
  const sheetP = ss.getSheetByName(ABA_PARTICIPANTES);
  const particips = lerAba(ss, ABA_PARTICIPANTES, CAB_PARTICIPANTES);
  let bloqueados = 0;
  const agora = new Date();

  bolas.forEach(bolao => {
    const prazo = parseDataFlex(bolao.prazo_pagamento);
    if (!prazo || agora <= prazo) return;

    const alvos = particips.filter(x =>
      String(x.bolao_id) === String(bolao.id) &&
      String(x.status_pagamento) !== 'pago' &&
      String(x.ativo) !== 'false'
    );
    alvos.forEach(x => {
      const colAtivo  = CAB_PARTICIPANTES.indexOf('ativo') + 1;
      const colMotivo = CAB_PARTICIPANTES.indexOf('motivo_bloqueio') + 1;
      sheetP.getRange(x._linha, colAtivo).setValue(false);
      sheetP.getRange(x._linha, colMotivo).setValue('prazo_expirado');
      bloqueados++;
    });

    if (alvos.length > 0) {
      try { sincronizarAbaBolao(ss, bolao.id, bolao.nome); } catch (e) {}
    }
  });

  return { status: 'success', bloqueados, message: `${bloqueados} participante(s) bloqueado(s)` };
}

// ============================================================
// MENU AUXILIAR
// ============================================================
function onOpen() {
  SpreadsheetApp.getUi().createMenu('🎲 Bolão')
    .addItem('🔄 Inicializar Planilha', 'menuInicializar')
    .addItem('🚫 Bloquear Inadimplentes Agora', 'menuBloquear')
    .addItem('🧹 Sincronizar Abas dos Bolões', 'menuSincronizarAbas')
    .addToUi();
}

function menuInicializar() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  inicializarPlanilha(ss);
  SpreadsheetApp.getUi().alert('✅ Abas criadas/verificadas!');
}

function menuBloquear() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const r = bloquearInadimplentes(ss, { isAdmin: true });
  SpreadsheetApp.getUi().alert('✅ ' + r.message);
}

function menuSincronizarAbas() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const bolas = lerAba(ss, ABA_BOLOES, CAB_BOLOES);
  let n = 0;
  bolas.forEach(b => {
    try {
      sincronizarAbaBolao(ss, b.id, b.nome);
      n++;
    } catch (e) { console.warn('Falha ao sincronizar', b.nome, e); }
  });
  SpreadsheetApp.getUi().alert(`✅ ${n} aba(s) de bolão sincronizada(s).`);
}