const $ = (id) => document.getElementById(id);
const store = {
  get: (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

const SYSTEM = `You are J.A.R.V.I.S., a witty, loyal, highly capable personal AI assistant, speaking to the user through their phone.
Your replies are read aloud, so keep them short and conversational (usually 1-3 sentences), with no markdown, lists, or emojis unless asked.
Address the user as "sir" occasionally, with dry British humour. Today is ${new Date().toDateString()}.`;

let history = store.get('history', []);
let busy = false;

const core = $('core'), state = $('state'), log = $('log');
function setState(mode, text) { core.className = mode; state.textContent = text; }
function add(role, text) {
  const div = document.createElement('div');
  div.className = 'msg ' + role;
  div.textContent = text;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
  return div;
}
history.forEach(m => add(m.role === 'user' ? 'user' : 'bot', m.content));
if (!history.length) add('bot', 'Good day. Tap the core and speak, or open settings to add your API key.');

// ---- Settings
const settings = $('settings');
function openSettings() {
  $('key').value = store.get('key', '');
  $('model').value = store.get('model', 'claude-sonnet-5-5');
  $('speak').checked = store.get('speak', true);
  $('handsfree').checked = store.get('handsfree', false);
  settings.showModal();
}
$('settingsBtn').onclick = openSettings;
settings.addEventListener('close', () => {
  store.set('key', $('key').value.trim());
  store.set('model', $('model').value);
  store.set('speak', $('speak').checked);
  store.set('handsfree', $('handsfree').checked);
});
$('clear').onclick = () => { history = []; store.set('history', history); log.innerHTML = ''; };
if (!store.get('key', '')) setTimeout(openSettings, 400);

// ---- Claude
async function ask(text) {
  const key = store.get('key', '');
  if (!key) { openSettings(); return; }
  busy = true;
  add('user', text);
  history.push({ role: 'user', content: text });
  setState('thinking', 'Thinking…');
  const bubble = add('bot', '');
  let reply = '';
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: store.get('model', 'claude-sonnet-5-5'),
        max_tokens: 1024,
        system: SYSTEM,
        messages: history.slice(-30),
        stream: true,
      }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error?.message || res.statusText);
    const reader = res.body.getReader(), dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n'); buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const ev = JSON.parse(line.slice(5));
        if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') {
          reply += ev.delta.text; bubble.textContent = reply; log.scrollTop = log.scrollHeight;
        } else if (ev.type === 'error') throw new Error(ev.error.message);
      }
    }
    history.push({ role: 'assistant', content: reply });
    store.set('history', history);
    speak(reply);
  } catch (e) {
    history.pop();
    bubble.remove();
    add('err', 'Error: ' + e.message);
    setState('idle', 'Tap the core and speak');
    busy = false;
  }
}

// ---- Voice out
function speak(text) {
  if (!store.get('speak', true) || !('speechSynthesis' in window)) return done();
  const u = new SpeechSynthesisUtterance(text);
  const voices = speechSynthesis.getVoices();
  u.voice = voices.find(v => /en-GB/i.test(v.lang) && /male|daniel|arthur/i.test(v.name))
         || voices.find(v => /en-GB/i.test(v.lang)) || null;
  u.rate = 1.05;
  u.onend = u.onerror = done;
  setState('speaking', 'Speaking… tap to stop');
  speechSynthesis.speak(u);
}
function done() {
  busy = false;
  setState('idle', 'Tap the core and speak');
  if (store.get('handsfree', false)) listen();
}
speechSynthesis?.getVoices();

// ---- Voice in
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null;
function listen() {
  if (!SR) { state.textContent = 'Voice input not supported in this browser. Type instead.'; return; }
  rec = new SR();
  rec.lang = navigator.language || 'en-US';
  rec.interimResults = true;
  let final = '';
  rec.onresult = (e) => {
    final = Array.from(e.results).map(r => r[0].transcript).join('');
    state.textContent = final;
  };
  rec.onerror = (e) => setState('idle', e.error === 'not-allowed' ? 'Microphone permission denied' : 'Tap the core and speak');
  rec.onend = () => { rec = null; final.trim() ? ask(final.trim()) : setState('idle', 'Tap the core and speak'); };
  setState('listening', 'Listening…');
  rec.start();
}
core.onclick = () => {
  if (speechSynthesis?.speaking) { speechSynthesis.cancel(); return; }
  if (rec) { rec.stop(); return; }
  if (!busy) listen();
};

$('composer').onsubmit = (e) => {
  e.preventDefault();
  const t = $('text').value.trim();
  if (t && !busy) { $('text').value = ''; ask(t); }
};

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
