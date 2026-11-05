import {
  auth, signInWithEmailAndPassword, onAuthStateChanged,
  sendPasswordResetEmail, ADMIN_EMAILS, toast, showLoader, hideLoader
} from "./firebase-config.js";

document.getElementById('toggle-senha')?.addEventListener('click', function() {
  const input = document.getElementById('login-senha');
  const icon = this.querySelector('i');
  if (input.type === 'password') {
    input.type = 'text';
    icon.className = 'fas fa-eye-slash';
  } else {
    input.type = 'password';
    icon.className = 'fas fa-eye';
  }
});

document.getElementById('login-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim().toLowerCase();
  const senha = document.getElementById('login-senha').value;
  const errorBox = document.getElementById('login-error');
  const btn = document.getElementById('btn-login');

  errorBox.style.display = 'none';
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Entrando...';
  showLoader('Entrando...');

  try {
    await signInWithEmailAndPassword(auth, email, senha);
    toast('Login realizado com sucesso!', 'success');
    // redirecionamento via onAuthStateChanged
  } catch (err) {
    let msg = 'E-mail ou senha incorretos.';
    if (err.code === 'auth/user-not-found')      msg = 'Usuário não cadastrado.';
    if (err.code === 'auth/wrong-password')      msg = 'Senha incorreta.';
    if (err.code === 'auth/too-many-requests')   msg = 'Muitas tentativas. Tente mais tarde.';
    if (err.code === 'auth/invalid-email')       msg = 'E-mail inválido.';
    errorBox.textContent = msg;
    errorBox.style.display = 'block';
    toast(msg, 'error');
  } finally {
    hideLoader();
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Entrar';
  }
});

document.getElementById('btn-recuperar')?.addEventListener('click', async () => {
  const email = document.getElementById('login-email').value.trim();
  if (!email) {
    toast('Digite seu e-mail primeiro.', 'warning');
    document.getElementById('login-email').focus();
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    toast('E-mail de recuperação enviado!', 'success');
  } catch (e) {
    toast('Não foi possível enviar. Verifique o e-mail.', 'error');
  }
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    const email = (user.email || '').toLowerCase();
    sessionStorage.setItem('userEmail', email);
    sessionStorage.setItem('isAdmin', ADMIN_EMAILS.includes(email) ? 'true' : 'false');
    window.location.href = 'painel.html';
  }
});