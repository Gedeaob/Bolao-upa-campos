// ============================================================
// firebase-config.js  —  Bolão GB Campos  v3.1
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, signOut,
  onAuthStateChanged, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBUp9ikgwg5Bmb2gEgsTxyvZVXBWxAxLJ4",
  authDomain: "bolao-upa-campos.firebaseapp.com",
  projectId: "bolao-upa-campos",
  storageBucket: "bolao-upa-campos.firebasestorage.app",
  messagingSenderId: "899318189915",
  appId: "1:899318189915:web:7a87772dcdceb6aef8d47e",
  measurementId: "G-BR9WCQFBD4"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);

export const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwjoPXAt--acwjQq8FILG9xFbMuedPYGLOzQbRS5IOwunNFOI4JH1ao-8XmqT9vvy8/exec";
export const SHEET_ID   = "11CFJmhxk9NGVhHa0VHfPtLLS1I7AJtf7jfx9qJf1Ydw";
export const ADMIN_EMAILS = ["gedeaoupacampos@gmail.com"];

export { auth, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail };

// ============================================================
// 🎲 MODALIDADES — valores ATUALIZADOS (Mega-Sena R$ 6,00)
// ============================================================
export const MODALIDADES = {
  'Mega-Sena':       { min: 1, max: 60, qtd: 6,  maxDezenas: 20, precoBase: 6.00,
                       label: 'Mega-Sena (6 a 20 dezenas · 1 a 60)' },
  'Lotofácil':       { min: 1, max: 25, qtd: 15, maxDezenas: 20, precoBase: 3.00,
                       label: 'Lotofácil (15 a 20 dezenas · 1 a 25)' },
  'Quina':           { min: 1, max: 80, qtd: 5,  maxDezenas: 15, precoBase: 2.50,
                       label: 'Quina (5 a 15 dezenas · 1 a 80)' },
  'Lotomania':       { min: 0, max: 99, qtd: 50, maxDezenas: 50, precoBase: 3.00,
                       label: 'Lotomania (50 dezenas fixas · 0 a 99)' },
  'Timemania':       { min: 1, max: 80, qtd: 10, maxDezenas: 10, precoBase: 3.50,
                       label: 'Timemania (10 dezenas fixas · 1 a 80)' },
  'Dupla Sena':      { min: 1, max: 50, qtd: 6,  maxDezenas: 15, precoBase: 2.50,
                       label: 'Dupla Sena (6 a 15 dezenas · 1 a 50)' },
  'Dia de Sorte':    { min: 1, max: 31, qtd: 7,  maxDezenas: 15, precoBase: 2.50,
                       label: 'Dia de Sorte (7 a 15 dezenas · 1 a 31)' },
  'Super Sete':      { min: 0, max: 9,  qtd: 7,  maxDezenas: 7,  precoBase: 2.50,
                       multiCol: true,
                       label: 'Super Sete (7 colunas · 0 a 9)' },
  '+Milionária':     { min: 1, max: 50, qtd: 6,  maxDezenas: 12, precoBase: 6.00,
                       label: '+Milionária (6 a 12 dezenas · 1 a 50)' }
};

// ============================================================
// 📊 FAIXAS DE PREMIAÇÃO + PESOS ESTIMADOS
// ============================================================
const FAIXAS_PREMIACAO = {
  'Mega-Sena':       [4, 5, 6],
  'Lotofácil':       [11, 12, 13, 14, 15],
  'Quina':           [2, 3, 4, 5],
  'Lotomania':       [0, 15, 16, 17, 18, 19, 20],
  'Timemania':       [3, 4, 5, 6, 7],
  'Dupla Sena':      [3, 4, 5, 6],
  'Dia de Sorte':    [4, 5, 6, 7],
  'Super Sete':      [2, 3, 4, 5, 6, 7],
  '+Milionária':     [2, 3, 4, 5, 6]
};

const PESOS_FAIXAS = {
  'Mega-Sena':       { 4: 0.20, 5: 0.20, 6: 0.60 },
  'Lotofácil':       { 11: 0.08, 12: 0.10, 13: 0.12, 14: 0.20, 15: 0.50 },
  'Quina':           { 2: 0.10, 3: 0.15, 4: 0.25, 5: 0.50 },
  'Lotomania':       { 0: 0.35, 15: 0.05, 16: 0.10, 17: 0.15, 18: 0.15, 19: 0.10, 20: 0.10 },
  'Timemania':       { 3: 0.10, 4: 0.15, 5: 0.20, 6: 0.25, 7: 0.30 },
  'Dupla Sena':      { 3: 0.10, 4: 0.20, 5: 0.30, 6: 0.40 },
  'Dia de Sorte':    { 4: 0.10, 5: 0.15, 6: 0.25, 7: 0.50 },
  'Super Sete':      { 2: 0.10, 3: 0.15, 4: 0.20, 5: 0.20, 6: 0.15, 7: 0.20 },
  '+Milionária':     { 2: 0.10, 3: 0.15, 4: 0.20, 5: 0.25, 6: 0.30 }
};

/**
 * Estima o valor de cada faixa de acertos, proporcionalmente ao prêmio total.
 * ⚠️ É uma ESTIMATIVA. Se houver ganhadores fora do bolão, o valor real pode diferir.
 */
export function estimarPremios(modalidade, valorPremio) {
  const faixas = FAIXAS_PREMIACAO[modalidade];
  const pesos  = PESOS_FAIXAS[modalidade];
  if (!faixas || !pesos || !valorPremio || valorPremio <= 0) return [];
  return faixas.map(acertos => ({
    acertos,
    valor: Math.round(valorPremio * (pesos[acertos] || 0) * 100) / 100,
    percentual: pesos[acertos] || 0
  })).filter(f => f.valor > 0);
}

// ============================================================
// 🧮 CÁLCULO DE COMBINAÇÕES E VALOR DO JOGO
// ============================================================
export function combinacoes(n, k) {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  let r = 1;
  for (let i = 1; i <= k; i++) r = r * (n - i + 1) / i;
  return Math.round(r);
}
export function calcularValorJogo(modalidade, qtdDezenas) {
  const m = MODALIDADES[modalidade];
  if (!m) return 0;
  const qtd = Math.max(m.qtd, Math.min(m.maxDezenas || m.qtd, Number(qtdDezenas) || m.qtd));
  return +(combinacoes(qtd, m.qtd) * m.precoBase).toFixed(2);
}
export function gerarSenhaAleatoria(tamanho = 6) {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz';
  const numeros = '23456789';
  const especiais = '!@#$%&*';
  const todos = letras + numeros + especiais;
  let s = letras[Math.floor(Math.random()*letras.length)];
  s += numeros[Math.floor(Math.random()*numeros.length)];
  s += especiais[Math.floor(Math.random()*especiais.length)];
  for (let i = 3; i < tamanho; i++) s += todos[Math.floor(Math.random()*todos.length)];
  return s.split('').sort(() => Math.random()-0.5).join('');
}

// ============================================================
// 💰 VALOR POR EXTENSO (pt-BR)
// ============================================================
const EXT_UNIDADES = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove',
  'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const EXT_DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const EXT_CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

function extensoInteiro(n) {
  if (n === 0) return 'zero';
  if (n === 100) return 'cem';
  if (n < 20) return EXT_UNIDADES[n];
  if (n < 100) {
    const d = Math.floor(n / 10), u = n % 10;
    return EXT_DEZENAS[d] + (u > 0 ? ' e ' + EXT_UNIDADES[u] : '');
  }
  if (n < 1000) {
    const c = Math.floor(n / 100), resto = n % 100;
    return EXT_CENTENAS[c] + (resto > 0 ? ' e ' + extensoInteiro(resto) : '');
  }
  if (n < 1000000) {
    const mil = Math.floor(n / 1000), resto = n % 1000;
    let s = mil === 1 ? 'mil' : extensoInteiro(mil) + ' mil';
    if (resto > 0) s += (resto < 100 ? ' e ' : ' ') + extensoInteiro(resto);
    return s;
  }
  if (n < 1000000000) {
    const mi = Math.floor(n / 1000000), resto = n % 1000000;
    let s = mi === 1 ? 'um milhão' : extensoInteiro(mi) + ' milhões';
    if (resto > 0) s += (resto < 100 ? ' e ' : ' ') + extensoInteiro(resto);
    return s;
  }
  const bi = Math.floor(n / 1000000000), resto = n % 1000000000;
  let s = bi === 1 ? 'um bilhão' : extensoInteiro(bi) + ' bilhões';
  if (resto > 0) s += (resto < 100 ? ' e ' : ' ') + extensoInteiro(resto);
  return s;
}

export function valorPorExtenso(n) {
  if (n == null || isNaN(n) || n === 0) return 'zero reais';
  const numero = Math.floor(Math.abs(n));
  const centavos = Math.round((Math.abs(n) - numero) * 100);
  let texto = '';
  if (numero > 0) texto = extensoInteiro(numero) + (numero === 1 ? ' real' : ' reais');
  if (centavos > 0) {
    if (texto) texto += ' e ';
    texto += extensoInteiro(centavos) + (centavos === 1 ? ' centavo' : ' centavos');
  }
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// ============================================================
// 🔔 TOAST
// ============================================================
export function toast(msg, tipo = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) { alert(msg); return; }
  const el = document.createElement('div');
  el.className = `toast ${tipo}`;
  const icons = { success:'fa-check-circle', error:'fa-exclamation-circle',
                  warning:'fa-exclamation-triangle', info:'fa-info-circle' };
  el.innerHTML = `<i class="fas ${icons[tipo] || icons.info}"></i> <span>${msg}</span>`;
  container.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 4000);
}

// ============================================================
// ⏳ LOADER (contador + debounce)
// ============================================================
let __loaderCount = 0;
let __loaderTimer = null;
export function showLoader(msg) {
  const el  = document.getElementById('global-loader');
  const txt = document.getElementById('loader-texto');
  if (txt && msg) txt.textContent = msg;
  __loaderCount++;
  if (__loaderTimer || el?.classList.contains('active')) return;
  __loaderTimer = setTimeout(() => {
    __loaderTimer = null;
    if (__loaderCount > 0 && el) {
      el.classList.add('active');
      el.setAttribute('aria-hidden', 'false');
    }
  }, 400);
}
export function hideLoader() {
  __loaderCount = Math.max(0, __loaderCount - 1);
  if (__loaderCount > 0) return;
  if (__loaderTimer) { clearTimeout(__loaderTimer); __loaderTimer = null; }
  const el = document.getElementById('global-loader');
  if (el) { el.classList.remove('active'); el.setAttribute('aria-hidden', 'true'); }
}

// ============================================================
// 🌐 API + CACHE
// ============================================================
const _apiCache = new Map();
const TTL_DEFAULT = 30 * 1000;
function _cacheKey(action, payload) {
  const keys = Object.keys(payload || {}).sort();
  const sorted = {}; keys.forEach(k => sorted[k] = payload[k]);
  return action + '|' + JSON.stringify(sorted);
}
export async function apiRequest(action, payload = {}) {
  showLoader();
  try {
    const resp = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action, sheetId: SHEET_ID, ...payload })
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    if (data.status === 'error') throw new Error(data.message || 'Erro');
    return data;
  } finally { hideLoader(); }
}
export async function apiRequestCached(action, payload = {}, ttl = TTL_DEFAULT) {
  const key = _cacheKey(action, payload);
  const hit = _apiCache.get(key);
  if (hit && Date.now() - hit.ts < ttl) return hit.data;
  const data = await apiRequest(action, payload);
  _apiCache.set(key, { ts: Date.now(), data });
  return data;
}
export function invalidarCacheApi(prefixo) {
  for (const k of [..._apiCache.keys()]) {
    if (!prefixo || k.startsWith(prefixo)) _apiCache.delete(k);
  }
}

// ============================================================
// 🧰 HELPERS
// ============================================================
export function fmtRS(n) {
  return (Math.round((n || 0) * 100) / 100)
    .toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function fmtData(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString('pt-BR');
}
export function fmtDataHora(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? String(iso) : d.toLocaleString('pt-BR');
}
export function escapeHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;')
                        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ============================================================
// 🕐 HORA — normaliza para "HH:mm"
// ============================================================
export function horaHHmm(raw) {
  if (!raw) return '';
  const s = String(raw).trim();
  if (!s) return '';
  // ISO ("1899-12-30T14:06:28.000Z" ou "2025-12-15T20:00:00")
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      return String(d.getHours()).padStart(2, '0') + ':' +
             String(d.getMinutes()).padStart(2, '0');
    }
  }
  // "HH:mm" ou "HH:mm:ss"
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (m) return String(m[1]).padStart(2, '0') + ':' + m[2];
  return s;
}