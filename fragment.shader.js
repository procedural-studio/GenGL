// ── DEFAULT SHADER ──
const DEFAULT_FRAG = `precision mediump float;
uniform float u_time;
uniform vec2 u_resolution;

// Classic palette function
vec3 palette(float t) {
  vec3 a = vec3(0.5, 0.5, 0.5);
  vec3 b = vec3(0.5, 0.5, 0.5);
  vec3 c = vec3(1.0, 1.0, 1.0);
  vec3 d = vec3(0.00, 0.33, 0.67);
  return a + b * cos(6.28318 * (c * t + d));
}

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution) / u_resolution.y;
  vec2 uv0 = uv;
  vec3 col = vec3(0.0);

  for (float i = 0.0; i < 4.0; i++) {
    uv = fract(uv * 1.5) - 0.5;
    float d = length(uv) * exp(-length(uv0));
    vec3 c = palette(length(uv0) + i * 0.4 + u_time * 0.4);
    d = sin(d * 8.0 + u_time) / 8.0;
    d = abs(d);
    d = pow(0.01 / d, 1.2);
    col += c * d;
  }

  gl_FragColor = vec4(col, 1.0);
}`;
