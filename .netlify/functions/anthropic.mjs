/**
 * Netlify Function: generate-shader
 * POST /.netlify/functions/generate-shader
 * Body: { prompt: string }
 * Proxies to Anthropic API using server-side ANTHROPIC_API_KEY env var.
 */

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

const SYSTEM_PROMPT = `You are an expert GLSL fragment shader programmer. 
Generate a beautiful, visually impressive WebGL fragment shader based on the user's description.

STRICT RULES:
- Output ONLY raw GLSL code, NO markdown, NO backticks, NO explanation
- Must use: precision mediump float; at the top
- Must declare: uniform float u_time; uniform vec2 u_resolution;
- Use gl_FragCoord for pixel coordinates
- Animate using u_time
- Set gl_FragColor = vec4(r, g, b, 1.0); at the end
- Make it visually stunning with complex math: sin/cos patterns, fractals, noise, SDFs, ray marching (simple), color palettes
- Keep it under 80 lines but make every line count
- NO textures (no sampler2D)
- Must compile without errors in WebGL 1.0 GLSL ES 1.0`;

exports.handler = async (event) => {
  // ── CORS preflight ──
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders(),
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return respond(405, { error: 'Method Not Allowed' });
  }

  // ── Parse body ──
  let prompt;
  try {
    const body = JSON.parse(event.body || '{}');
    prompt = (body.prompt || '').trim();
  } catch {
    return respond(400, { error: 'Invalid JSON body' });
  }

  if (!prompt) {
    return respond(400, { error: 'Missing required field: prompt' });
  }

  if (prompt.length > 500) {
    return respond(400, { error: 'Prompt too long (max 500 chars)' });
  }

  // ── Check API key ──
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY environment variable is not set');
    return respond(500, { error: 'Server configuration error: missing API key' });
  }

  // ── Call Anthropic ──
  try {
    const upstream = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: `Create a GLSL fragment shader for: ${prompt}` },
        ],
      }),
    });

    if (!upstream.ok) {
      const errBody = await upstream.text();
      console.error('Anthropic API error:', upstream.status, errBody);
      return respond(502, { error: `Upstream API error: ${upstream.status}` });
    }

    const data = await upstream.json();

    // Extract text from content blocks
    let code = (data.content || [])
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('')
      .trim();

    // Strip accidental markdown fences
    code = code.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();

    return respond(200, { code });
  } catch (err) {
    console.error('Fetch error:', err);
    return respond(500, { error: 'Failed to reach Anthropic API' });
  }
};

// ── Helpers ──

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function respond(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
      'x-api-key': Netlify.env.ANTHROPIC_API_KEY,
    },
    body: JSON.stringify(body),
  };
}
