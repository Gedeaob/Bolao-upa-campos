# 🎲 Bolão UPA Campos — Guia de Deployment

## 📋 Pré-requisitos

- Conta Google (mesma que gerencia a planilha)
- Firebase Console (já configurado)
- Conta no Vercel/Netlify (ou similar) para hospedar o frontend

---

## 1️⃣ Configurar Google Apps Script

1. Abra a planilha:  
   `https://docs.google.com/spreadsheets/d/11CFJmhxk9NGVhHa0VHfPtLLS1I7AJtf7jfx9qJf1Ydw`
2. Menu **Extensões → Apps Script**
3. Apague o conteúdo padrão e cole o conteúdo de `AppScript_bolao.js`
4. Clique em **Configurações do projeto** (engrenagem ⚙️ na barra lateral)
5. Marque **"Mostrar arquivo de manifesto appsscript.json"**
6. Volte ao editor e edite `appsscript.json` com o conteúdo fornecido
7. Salve (Ctrl+S)
8. Execute a função `menuInicializar` para criar as abas automaticamente:
   - No editor, selecione a função `menuInicializar` e clique em **Executar**
   - Autorize as permissões na primeira execução

### Deploy como Web App

1. **Implantar → Nova implantação**
2. Tipo: **Aplicativo da Web**
3. Configurações:
   - **Executar como**: `Eu (seu-email@gmail.com)`
   - **Quem pode acessar**: `Qualquer pessoa`
4. Clique em **Implantar**
5. Copie a URL gerada (termina com `/exec`)

---

## 2️⃣ Configurar o Frontend

1. Abra `firebase-config.js`
2. Substitua:
   ```js
   export const SCRIPT_URL = "COLE_AQUI_A_URL_DO_WEB_APP_DO_APPS_SCRIPT";