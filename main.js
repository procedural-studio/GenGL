
// ── WEBGL SETUP ──
const canvas = document.getElementById('glCanvas');
const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

if (!gl) {
  document.querySelector('.canvas-panel').innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#666;font-size:13px;">WebGL not supported</div>';
}

let program = null;
let animId = null;
let startTime = performance.now();
let pausedAt = 0;
let paused = false;
let elapsedBeforePause = 0;
let frameCount = 0, fpsLast = performance.now();

function resizeCanvas() {
  const panel = canvas.parentElement;
  canvas.width = panel.clientWidth;
  canvas.height = panel.clientHeight;
  gl.viewport(0, 0, canvas.width, canvas.height);
}

window.addEventListener('resize', () => { resizeCanvas(); if (program) setUniforms(); });
resizeCanvas();

function compileShader(type, src) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const err = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(err);
  }
  return shader;
}

function buildProgram(fragSrc) {
  const vs = compileShader(gl.VERTEX_SHADER, VERTEX_SHADER);
  const fs = compileShader(gl.FRAGMENT_SHADER, fragSrc);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(prog));
  }
  return prog;
}

function setupGeometry(prog) {
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'a_position');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
}

let currentProgram = null;

function runShader(fragSrc) {
  try {
    if (animId) cancelAnimationFrame(animId);
    const prog = buildProgram(fragSrc);
    if (currentProgram) gl.deleteProgram(currentProgram);
    currentProgram = prog;
    gl.useProgram(prog);
    setupGeometry(prog);
    elapsedBeforePause = 0;
    startTime = performance.now();
    paused = false;
    document.getElementById('btnPlay').textContent = '⏸';
    document.getElementById('btnPlay').classList.add('active');
    hideError();
    setStatus('ok', 'Shader running');
    animate();
  } catch(e) {
    showError(e.message);
    setStatus('error', 'Compile error');
  }
}

function animate() {
  frameCount++;
  const now = performance.now();
  if (now - fpsLast >= 1000) {
    document.getElementById('fpsCounter').textContent = frameCount + ' fps';
    frameCount = 0;
    fpsLast = now;
  }

  const elapsed = (elapsedBeforePause + (paused ? 0 : (now - startTime))) / 1000;
  document.getElementById('timeDisplay').textContent = 't = ' + elapsed.toFixed(3);

  const prog = currentProgram;
  if (!prog) return;

  const uTime = gl.getUniformLocation(prog, 'u_time');
  const uRes = gl.getUniformLocation(prog, 'u_resolution');
  if (uTime) gl.uniform1f(uTime, elapsed);
  if (uRes) gl.uniform2f(uRes, canvas.width, canvas.height);

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  if (!paused) animId = requestAnimationFrame(animate);
}

function setUniforms() {
  if (!currentProgram) return;
  gl.useProgram(currentProgram);
}

function showError(msg) {
  const ov = document.getElementById('errorOverlay');
  document.getElementById('errorText').textContent = msg;
  ov.style.display = 'flex';
}
function hideError() {
  document.getElementById('errorOverlay').style.display = 'none';
}

// ── STATUS ──
function setStatus(type, msg) {
  const dot = document.getElementById('statusDot');
  dot.className = 'status-dot' + (type === 'error' ? ' error' : type === 'pending' ? ' pending' : '');
  document.getElementById('statusText').textContent = msg;
}

// ── PLAY/PAUSE ──
document.getElementById('btnPlay').addEventListener('click', () => {
  if (paused) {
    paused = false;
    startTime = performance.now();
    document.getElementById('btnPlay').textContent = '⏸';
    document.getElementById('btnPlay').classList.add('active');
    animate();
  } else {
    paused = true;
    elapsedBeforePause += performance.now() - startTime;
    if (animId) cancelAnimationFrame(animId);
    document.getElementById('btnPlay').textContent = '▶';
    document.getElementById('btnPlay').classList.remove('active');
  }
});

document.getElementById('btnRestart').addEventListener('click', () => {
  elapsedBeforePause = 0;
  startTime = performance.now();
  paused = false;
  document.getElementById('btnPlay').textContent = '⏸';
  document.getElementById('btnPlay').classList.add('active');
  if (!animId || paused) animate();
});

// ── RUN BUTTON ──
document.getElementById('btnRun').addEventListener('click', () => {
  const code = document.getElementById('codeEditor').value;
  runShader(code);
});

// ── COPY ──
document.getElementById('btnCopy').addEventListener('click', () => {
  navigator.clipboard.writeText(document.getElementById('codeEditor').value);
  showToast('Copied to clipboard!');
});

// ── TOAST ──
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}

// Render presets
const presetsEl = document.getElementById('presets');
PRESETS.forEach(p => {
  const chip = document.createElement('button');
  chip.className = 'preset-chip';
  chip.textContent = p;
  chip.addEventListener('click', () => {
    document.getElementById('promptInput').value = p;
  });
  presetsEl.appendChild(chip);
});

// Random prompt
document.getElementById('btnRandom').addEventListener('click', () => {
  document.getElementById('promptInput').value = randoms[Math.floor(Math.random() * randoms.length)];
});

async function generateShader(prompt) {
  const btn = document.getElementById('btnGenerate');
  btn.classList.add('loading');
  btn.disabled = true;
  setStatus('pending', 'Generating shader…');

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: claude_model_name,
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: 'user', content: `Create a GLSL fragment shader for: ${prompt}` }]
      })
    });

    const data = await response.json();
    let code = data.content?.map(b => b.text || '').join('').trim();

    // Strip any accidental markdown fences
    code = code.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();

    document.getElementById('codeEditor').value = code;
    runShader(code);
    setStatus('ok', 'Shader generated!');
    showToast('✦ Shader generated!');
  } catch (err) {
    setStatus('error', 'Generation failed');
    showToast('Error: ' + err.message);
    console.error(err);
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

document.getElementById('btnGenerate').addEventListener('click', () => {
  const prompt = document.getElementById('promptInput').value.trim();
  if (!prompt) { showToast('Enter a prompt first'); return; }
  generateShader(prompt);
});

// ── CTRL+ENTER in prompt ──
document.getElementById('promptInput').addEventListener('keydown', e => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    document.getElementById('btnGenerate').click();
  }
});

// ── TAB in code editor ──
document.getElementById('codeEditor').addEventListener('keydown', e => {
  if (e.key === 'Tab') {
    e.preventDefault();
    const ta = e.target;
    const s = ta.selectionStart, end = ta.selectionEnd;
    ta.value = ta.value.substring(0, s) + '  ' + ta.value.substring(end);
    ta.selectionStart = ta.selectionEnd = s + 2;
  }
});

// ── INIT ──
document.getElementById('codeEditor').value = DEFAULT_FRAG;
runShader(DEFAULT_FRAG);
