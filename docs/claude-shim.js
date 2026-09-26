/*
 * 獨立網站版的執行環境。
 *
 * 概念拆卡機原本是 Claude artifact，透過 window.claude.use(...) 取得 AI、資料庫、圖片儲存與下載功能。
 * 這個檔案在一般網頁（例如 GitHub Pages）上提供同樣的介面：
 *   sample    → 用你自己的 Anthropic API 金鑰呼叫 Claude（官方 @anthropic-ai/sdk，瀏覽器直連）
 *   db / user → 存在這個瀏覽器的 IndexedDB
 *   assets    → 圖片也存在 IndexedDB
 *   downloads → 一般的檔案下載
 * 金鑰只存在這個瀏覽器的 localStorage，請求直接送到 api.anthropic.com，不經過任何其他伺服器。
 */
(() => {
  if (window.claude) return; // running inside Claude: use the real runtime

  const SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.128.0/+esm';
  const MODELS = [
    ['claude-opus-5', 'Claude Opus 5（預設，品質最好）'],
    ['claude-sonnet-5', 'Claude Sonnet 5（較便宜、較快）'],
    ['claude-haiku-4-5', 'Claude Haiku 4.5（最便宜，不建議用於拆解）'],
  ];
  const EFFORT = {quick: 'low', default: 'high', complex: 'xhigh'};
  const LS_KEY = 'ccm-api-key', LS_MODEL = 'ccm-model';
  const ls = {
    get: k => { try { return localStorage.getItem(k) || ''; } catch { return ''; } },
    set: (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch {} },
  };

  /* ---------- IndexedDB ---------- */
  const dbp = new Promise((ok, bad) => {
    const r = indexedDB.open('concept-canvas', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('docs'); r.result.createObjectStore('blobs'); };
    r.onsuccess = () => ok(r.result); r.onerror = () => bad(r.error);
  });
  const tx = async (store, mode, fn) => { const db = await dbp; return new Promise((ok, bad) => { const t = db.transaction(store, mode); const req = fn(t.objectStore(store)); t.oncomplete = () => ok(req?.result); t.onerror = () => bad(t.error); }); };
  const idb = {
    get: (s, k) => tx(s, 'readonly', o => o.get(k)),
    put: (s, k, v) => tx(s, 'readwrite', o => o.put(v, k)),
    del: (s, k) => tx(s, 'readwrite', o => o.delete(k)),
    keys: s => tx(s, 'readonly', o => o.getAllKeys()),
    all: s => tx(s, 'readonly', o => o.getAll()),
  };

  /* ---------- assets (images) ---------- */
  const blobURLs = {};
  window.__ccmBlobURL = id => blobURLs[id];
  window.__ccmLocal = true;
  const blobsReady = (async () => {
    try { const keys = await idb.keys('blobs'); for (const k of keys) { const b = await idb.get('blobs', k); if (b) blobURLs[k] = URL.createObjectURL(b); } } catch (e) { console.warn(e); }
  })();
  const hex = () => [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');
  const assets = Object.freeze({
    async upload(blob) { const id = hex(); await idb.put('blobs', id, blob); blobURLs[id] = URL.createObjectURL(blob); return {id, url: blobURLs[id], sizeBytes: blob.size, contentType: blob.type}; },
    async delete(id) { await idb.del('blobs', id); if (blobURLs[id]) URL.revokeObjectURL(blobURLs[id]); delete blobURLs[id]; return {deleted: true}; },
    async list() { const keys = await idb.keys('blobs'); return {assets: keys.map(id => ({id, url: blobURLs[id]})), usage: {files: keys.length}}; },
  });

  /* ---------- db (only the calls the app makes) ---------- */
  const db = Object.freeze({
    collection(path) {
      const pre = path.replace(/\/$/, '') + '/';
      return {
        async get() {
          const keys = (await idb.keys('docs')).filter(k => k.startsWith(pre) && !k.slice(pre.length).includes('/'));
          const docs = await Promise.all(keys.map(async k => { const v = await idb.get('docs', k); return {id: k.slice(pre.length), exists: true, data: () => v}; }));
          return {docs, size: docs.length, empty: !docs.length};
        },
        doc(id) {
          const k = pre + id;
          return {
            id, path: k,
            set: data => idb.put('docs', k, JSON.parse(JSON.stringify(data))),
            update: async data => idb.put('docs', k, {...(await idb.get('docs', k)), ...data}),
            delete: () => idb.del('docs', k),
            get: async () => { const v = await idb.get('docs', k); return {id, exists: v != null, data: () => v}; },
          };
        },
      };
    },
  });
  const user = Object.freeze({id: async () => 'local', me: async () => ({id: 'local', name: '', isMe: true}), isOwner: async () => true, canEdit: async () => true, can: async () => true});

  /* ---------- downloads ---------- */
  const downloads = Object.freeze({
    async save({filename, data}) {
      const blob = data instanceof Blob ? data : new Blob([data], {type: typeof data === 'string' ? 'text/plain;charset=utf-8' : 'application/octet-stream'});
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename || 'download';
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 30000);
      return {saved: true};
    },
  });

  /* ---------- sample: Claude via the official SDK ---------- */
  let clientP = null, clientKey = '';
  async function getClient() {
    const key = ls.get(LS_KEY);
    if (!key) { openSettings('請先輸入你的 Anthropic API 金鑰，AI 功能才能使用。'); throw fail('not_granted', '尚未設定 API 金鑰：請按右上角「API 設定」輸入後再試一次。'); }
    if (!clientP || clientKey !== key) {
      clientKey = key;
      clientP = import(SDK_URL).then(m => { const Anthropic = m.default; return {Anthropic, client: new Anthropic({apiKey: key, dangerouslyAllowBrowser: true})}; });
    }
    return clientP;
  }
  function fail(code, userMessage, text) { const e = {code, message: userMessage, userMessage}; if (text) e.text = text; return e; }
  async function toImageBlock(blob) {
    // downscale to <=1568px on the long side, like the Claude runtime does, to keep requests small
    const bmp = await createImageBitmap(blob); const sc = Math.min(1, 1568 / Math.max(bmp.width, bmp.height));
    const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * sc); cv.height = Math.round(bmp.height * sc);
    const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(bmp, 0, 0, cv.width, cv.height); bmp.close?.();
    const b64 = cv.toDataURL('image/jpeg', 0.88).split(',')[1];
    return {type: 'image', source: {type: 'base64', media_type: 'image/jpeg', data: b64}};
  }
  async function toMessages(input, images) {
    const turns = typeof input === 'string' ? [{role: 'user', content: input}] : input.map(t => ({role: t.role, content: t.content}));
    const merged = [];
    for (const t of turns) { const last = merged[merged.length - 1]; if (last && last.role === t.role) last.content += '\n\n' + t.content; else merged.push({...t}); }
    const imgs = images ? [...(images instanceof Blob ? [images] : images)] : [];
    if (imgs.length) { const last = merged[merged.length - 1]; last.content = [...await Promise.all(imgs.map(toImageBlock)), {type: 'text', text: last.content}]; }
    return merged;
  }
  async function run(input, opts = {}) {
    const {Anthropic, client} = await getClient();
    const messages = await toMessages(input, opts.images);
    const model = ls.get(LS_MODEL) || MODELS[0][0];
    const params = {model, max_tokens: 64000, messages};
    if (model !== 'claude-haiku-4-5') params.output_config = {effort: EFFORT[opts.modelTier] || 'high'};
    if (model === 'claude-opus-5') { params.betas = ['server-side-fallback-2026-07-01']; params.fallbacks = 'default'; }
    let text = '';
    try {
      const stream = client.beta.messages.stream(params, opts.signal ? {signal: opts.signal} : undefined);
      stream.on('text', delta => { text += delta; try { opts.onText?.({text, delta}); } catch (e) { console.error(e); } });
      const msg = await stream.finalMessage();
      if (msg.stop_reason === 'refusal') throw fail('refused', 'Claude 拒絕處理這段內容。', text);
      if (!text.trim()) throw fail('empty_completion', 'Claude 沒有產生內容，請再試一次。');
      return {text, truncated: msg.stop_reason === 'max_tokens', modelTierApplied: opts.modelTier || 'default'};
    } catch (e) {
      if (e && e.code && e.userMessage) throw e;
      if (e instanceof Anthropic.APIUserAbortError || opts.signal?.aborted) throw fail('cancelled', '已停止。', text);
      if (e instanceof Anthropic.AuthenticationError) { openSettings('API 金鑰無效或已被撤銷，請重新輸入。'); throw fail('not_granted', 'API 金鑰無效：請按「API 設定」重新輸入。', text); }
      if (e instanceof Anthropic.PermissionDeniedError) throw fail('not_granted', '這把 API 金鑰沒有使用此模型的權限，請在「API 設定」換一個模型。', text);
      if (e instanceof Anthropic.RateLimitError) throw fail('rate_limited', '已達 API 速率上限，請稍候一分鐘再試。', text);
      if (e instanceof Anthropic.BadRequestError) {
        const tooLong = /too long|too large|context|maximum/i.test(e.message || '');
        throw fail(tooLong ? 'prompt_too_large' : 'invalid_request', tooLong ? '資料太長，請拆成兩張畫布。' : 'API 請求錯誤：' + (e.message || ''), text);
      }
      if (e instanceof Anthropic.APIError) throw fail('upstream_error', `Claude API 錯誤（${e.status ?? '連線'}）：${e.message || ''}`, text);
      throw fail('upstream_error', '連線失敗：' + (e?.message || e), text);
    }
  }
  function parseLoose(t) {
    const tryParse = s => { try { return {ok: true, v: JSON.parse(s)}; } catch { return {ok: false}; } };
    let r = tryParse(t.trim()); if (r.ok) return r.v;
    const f = t.match(/```(?:json)?\s*([\s\S]*?)```/); if (f && (r = tryParse(f[1].trim())).ok) return r.v;
    const a = t.search(/[{[]/), b = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
    if (a >= 0 && b > a && (r = tryParse(t.slice(a, b + 1))).ok) return r.v;
    throw fail('invalid_json', 'AI 回覆格式無法解析，請再試一次。', t);
  }
  const sample = Object.assign((input, opts) => run(input, opts), {
    async json(input, opts = {}) {
      const note = '\n\n（你的回覆會被程式解析：只輸出一個 JSON 值，不要其他文字。）';
      const inp = typeof input === 'string' ? input + note : input.map((t, i) => i === input.length - 1 ? {...t, content: t.content + note} : t);
      const {text, truncated} = await run(inp, opts);
      if (truncated) throw fail('invalid_json', 'AI 回覆太長被截斷，請減少資料量再試。', text);
      return parseLoose(text);
    },
    async limits() { return {maxInputBytes: 900000, images: {maxCount: 20, maxInputBytes: 30 * 1024 * 1024, mediaTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']}}; },
  });

  const caps = {sample, db, user, assets, downloads};
  window.claude = Object.freeze({use: async name => { if (name === 'assets') await blobsReady; return caps[name] || null; }});

  /* ---------- settings + backup UI ---------- */
  let dlg = null;
  function openSettings(msg) {
    if (!dlg) buildSettings();
    dlg.querySelector('#ccmKey').value = ls.get(LS_KEY);
    dlg.querySelector('#ccmModel').value = ls.get(LS_MODEL) || MODELS[0][0];
    dlg.querySelector('#ccmMsg').textContent = msg || '';
    if (!dlg.open) dlg.showModal();
  }
  function buildSettings() {
    dlg = document.createElement('dialog');
    dlg.innerHTML = `<form class="dlg" method="dialog">
      <h2>API 設定</h2>
      <p class="note" id="ccmMsg" style="color:var(--bad)"></p>
      <div class="f"><label class="lbl" for="ccmKey">Anthropic API 金鑰</label>
        <input id="ccmKey" type="password" autocomplete="off" spellcheck="false" placeholder="sk-ant-...">
        <span class="note">到 console.anthropic.com → API Keys 建立。金鑰只存在這個瀏覽器，請求直接送到 api.anthropic.com。費用由你的 API 帳戶支付。</span></div>
      <div class="f"><label class="lbl" for="ccmModel">模型</label>
        <select id="ccmModel">${MODELS.map(([v, n]) => `<option value="${v}">${n}</option>`).join('')}</select></div>
      <hr class="divider">
      <div class="f"><div class="lbl">備份</div>
        <span class="note">畫布和圖片都存在這個瀏覽器。換電腦或清除瀏覽器資料前，請先備份。</span>
        <div class="row"><button class="btn" type="button" id="ccmExport">下載全部備份</button><button class="btn" type="button" id="ccmImport">從備份還原</button><input type="file" id="ccmImportFile" accept=".json,application/json" hidden></div>
        <span class="note" id="ccmBackupMsg"></span></div>
      <div class="row" style="justify-content:flex-end"><button class="btn ghost" type="button" id="ccmClear">清除金鑰</button><button class="btn ghost" value="cancel">取消</button><button class="btn primary" id="ccmSave" value="save">儲存</button></div>
    </form>`;
    document.body.append(dlg);
    dlg.querySelector('#ccmSave').onclick = () => { ls.set(LS_KEY, dlg.querySelector('#ccmKey').value.trim()); ls.set(LS_MODEL, dlg.querySelector('#ccmModel').value); clientP = null; };
    dlg.querySelector('#ccmClear').onclick = () => { ls.set(LS_KEY, ''); dlg.querySelector('#ccmKey').value = ''; clientP = null; };
    const bmsg = t => { dlg.querySelector('#ccmBackupMsg').textContent = t; };
    dlg.querySelector('#ccmExport').onclick = async () => {
      bmsg('整理中…');
      const docs = {}; for (const k of await idb.keys('docs')) docs[k] = await idb.get('docs', k);
      const blobs = {};
      for (const k of await idb.keys('blobs')) { const b = await idb.get('blobs', k); blobs[k] = {type: b.type, data: await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(',')[1]); fr.readAsDataURL(b); })}; }
      await downloads.save({filename: `概念拆卡機備份-${new Date().toISOString().slice(0, 10)}.json`, data: JSON.stringify({app: 'concept-canvas', v: 1, docs, blobs})});
      bmsg(`已下載：${Object.keys(docs).length} 張畫布、${Object.keys(blobs).length} 張圖片。`);
    };
    dlg.querySelector('#ccmImport').onclick = () => dlg.querySelector('#ccmImportFile').click();
    dlg.querySelector('#ccmImportFile').onchange = async e => {
      const f = e.target.files[0]; e.target.value = ''; if (!f) return;
      try {
        const d = JSON.parse(await f.text()); if (d.app !== 'concept-canvas') throw new Error('不是概念拆卡機的備份檔');
        for (const [k, v] of Object.entries(d.docs || {})) await idb.put('docs', k, v);
        for (const [k, v] of Object.entries(d.blobs || {})) { const bin = Uint8Array.from(atob(v.data), c => c.charCodeAt(0)); await idb.put('blobs', k, new Blob([bin], {type: v.type})); }
        bmsg('已還原，重新整理頁面後生效。');
      } catch (err) { bmsg('還原失敗：' + (err.message || err)); }
    };
  }
  function addButton() {
    const zoom = document.querySelector('.top .zoom'); if (!zoom || document.getElementById('ccmBtn')) return;
    const b = document.createElement('button'); b.id = 'ccmBtn'; b.type = 'button'; b.className = 'btn'; b.textContent = 'API 設定';
    b.onclick = () => openSettings(ls.get(LS_KEY) ? '' : '尚未設定金鑰。');
    zoom.append(b);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addButton); else addButton();
})();
