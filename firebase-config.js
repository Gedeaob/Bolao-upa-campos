// ============================================================
// firebase-config.js  —  Bolão UPA Campos  v2.0
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

export const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyXaLzbfwPJpnPyiejFUAxWwxWftu_25gFbXxr_drkGo4zTMTJCnL_Sp-tMkPGVXA5G/exec";
export const SHEET_ID   = "11CFJmhxk9NGVhHa0VHfPtLLS1I7AJtf7jfx9qJf1Ydw";

export const ADMIN_EMAILS = ["gedeaoupacampos@gmail.com"];

export {
  auth, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail
};

// ============================================================
// 🎲 MODALIDADES — todas as Loterias Caixa
// ============================================================
export const MODALIDADES = {
  'Mega-Sena':       { min: 1,  max: 60,  qtd: 6,  label: 'Mega-Sena (6 números · 1 a 60)' },
  'Lotofácil':       { min: 1,  max: 25,  qtd: 15, label: 'Lotofácil (15 números · 1 a 25)' },
  'Quina':           { min: 1,  max: 80,  qtd: 5,  label: 'Quina (5 números · 1 a 80)' },
  'Lotomania':       { min: 0,  max: 99,  qtd: 50, label: 'Lotomania (50 números · 0 a 99)' },
  'Timemania':       { min: 1,  max: 80,  qtd: 10, label: 'Timemania (10 números · 1 a 80)' },
  'Dupla Sena':      { min: 1,  max: 50,  qtd: 6,  label: 'Dupla Sena (6 números · 1 a 50)' },
  'Dia de Sorte':    { min: 1,  max: 31,  qtd: 7,  label: 'Dia de Sorte (7 números · 1 a 31)' },
  'Super Sete':      { min: 0,  max: 9,   qtd: 7,  label: 'Super Sete (7 colunas · 0 a 9)', multiCol: true },
  '+Milionária':     { min: 1,  max: 50,  qtd: 6,  label: '+Milionária (6 números · 1 a 50)' }
};

// ============================================================
// 🔔 TOAST
// ============================================================
export function toast(msg, tipo = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) { alert(msg); return; }
  const el = document.createElement('div');
  el.className = `toast ${tipo}`;
  const icons = {
    success: 'fa-check-circle', error: 'fa-exclamation-circle',
    warning: 'fa-exclamation-triangle', info: 'fa-info-circle'
  };
  el.innerHTML = `<i class="fas ${icons[tipo] || icons.info}"></i> <span>${msg}</span>`;
  container.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 4000);
}

// ============================================================
// ⏳ LOADER — com contador + debounce (elimina o piscamento)
// ============================================================
let __loaderCount = 0;
let __loaderTimer = null;

export function showLoader(msg) {
  const el  = document.getElementById('global-loader');
  const txt = document.getElementById('loader-texto');
  if (txt && msg) txt.textContent = msg;

  __loaderCount++;

  // Se já tem um timer pendente OU já está visível → não reabre
  if (__loaderTimer || el?.classList.contains('active')) return;

  __loaderTimer = setTimeout(() => {
    __loaderTimer = null;
    if (__loaderCount > 0 && el) {
      el.classList.add('active');
      el.setAttribute('aria-hidden', 'false');
    }
  }, 400); // ⬅️ 400 ms de debounce — evita flicker em requests rápidos
}

export function hideLoader() {
  __loaderCount = Math.max(0, __loaderCount - 1);
  if (__loaderCount > 0) return;

  if (__loaderTimer) { clearTimeout(__loaderTimer); __loaderTimer = null; }

  const el = document.getElementById('global-loader');
  if (el) {
    el.classList.remove('active');
    el.setAttribute('aria-hidden', 'true');
  }
}

// ============================================================
// 🌐 API + CACHE FRONTEND
// ============================================================
const _apiCache = new Map();
const TTL_DEFAULT = 30 * 1000;       // 30s
const TTL_LONGO   = 5 * 60 * 1000;   // 5 min

function _cacheKey(action, payload) {
  const keys = Object.keys(payload || {}).sort();
  const sorted = {};
  keys.forEach(k => sorted[k] = payload[k]);
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
  } finally {
    hideLoader();
  }
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
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}