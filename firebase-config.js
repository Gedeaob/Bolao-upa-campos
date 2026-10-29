import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail
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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// ⚠️ TROQUE PELA URL DO SEU DEPLOY DO APPS SCRIPT
export const SCRIPT_URL = "COLE_AQUI_A_URL_DO_WEB_APP_DO_APPS_SCRIPT";

export const SHEET_ID = "11CFJmhxk9NGVhHa0VHfPtLLS1I7AJtf7jfx9qJf1Ydw";

export const ADMIN_EMAILS = [
  "gedeaoupacampos@gmail.com"
];

export {
  auth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail
};

// ============================================================
// UTILITÁRIOS COMPARTILHADOS
// ============================================================
export function toast(msg, tipo = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) { alert(msg); return; }
  const el = document.createElement('div');
  el.className = `toast ${tipo}`;
  const icons = {
    success: 'fa-check-circle',
    error: 'fa-exclamation-circle',
    warning: 'fa-exclamation-triangle',
    info: 'fa-info-circle'
  };
  el.innerHTML = `<i class="fas ${icons[tipo] || icons.info}"></i> <span>${msg}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 300);
  }, 4000);
}

let _loaderCount = 0;
export function showLoader(msg) {
  const el = document.getElementById('global-loader');
  const txt = document.getElementById('loader-texto');
  if (txt && msg) txt.textContent = msg;
  if (!el) return;
  _loaderCount++;
  el.classList.add('active');
  el.setAttribute('aria-hidden', 'false');
}
export function hideLoader() {
  const el = document.getElementById('global-loader');
  if (!el) return;
  _loaderCount = Math.max(0, _loaderCount - 1);
  if (_loaderCount === 0) {
    el.classList.remove('active');
    el.setAttribute('aria-hidden', 'true');
  }
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

export function fmtRS(n) {
  return (Math.round((n || 0) * 100) / 100)
    .toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtData(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('pt-BR');
}

export function fmtDataHora(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('pt-BR');
}

export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}