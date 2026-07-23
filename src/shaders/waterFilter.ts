/**
 * Lightweight water surface shimmer filter for PixiJS v8.
 * Uses a fragment shader for refraction-like ripples — cheap enough for Pi 5.
 */
import { Filter, GlProgram } from 'pixi.js';

const vertex = `
in vec2 aPosition;
out vec2 vTextureCoord;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

vec4 filterVertexPosition(void) {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  return vec4(position, 0.0, 1.0);
}

vec2 filterTextureCoord(void) {
  return aPosition * (uOutputFrame.zw * uInputSize.zw);
}

void main(void) {
  gl_Position = filterVertexPosition();
  vTextureCoord = filterTextureCoord();
}
`;

const fragment = `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform float uTime;
uniform float uIntensity;
uniform float uWaveAmp;

void main(void) {
  vec2 uv = vTextureCoord;
  float t = uTime;

  // Multi-frequency surface ripples
  float wave1 = sin(uv.x * 28.0 + t * 2.1) * cos(uv.y * 18.0 - t * 1.4);
  float wave2 = sin(uv.x * 45.0 - t * 3.0 + uv.y * 12.0) * 0.5;
  float wave3 = cos(uv.y * 32.0 + t * 1.7) * 0.35;

  float distort = (wave1 + wave2 + wave3) * uWaveAmp * uIntensity;
  vec2 sampleUV = uv + vec2(distort * 0.6, distort);

  // Clamp to avoid edge sampling artifacts
  sampleUV = clamp(sampleUV, vec2(0.001), vec2(0.999));

  vec4 color = texture(uTexture, sampleUV);

  // Subtle caustic highlight
  float caustic = sin(uv.x * 40.0 + t * 2.5 + wave1) * sin(uv.y * 35.0 - t * 1.8);
  caustic = max(0.0, caustic) * 0.08 * uIntensity;
  color.rgb += caustic;

  // Slight blue-green water tint on bright areas
  color.rgb = mix(color.rgb, color.rgb * vec3(0.85, 0.95, 1.05), 0.15 * uIntensity);

  finalColor = color;
}
`;

export function createWaterFilter(): Filter {
  const glProgram = GlProgram.from({
    vertex,
    fragment,
    name: 'water-ripple-filter',
  });

  const filter = new Filter({
    glProgram,
    resources: {
      waterUniforms: {
        uTime: { value: 0, type: 'f32' },
        uIntensity: { value: 0.7, type: 'f32' },
        uWaveAmp: { value: 0.004, type: 'f32' },
      },
    },
  });

  return filter;
}

export function updateWaterFilter(filter: Filter, time: number, intensity = 0.7): void {
  const uniforms = filter.resources.waterUniforms?.uniforms;
  if (!uniforms) return;
  uniforms.uTime = time;
  uniforms.uIntensity = intensity;
  // amplify waves slightly when jets are active
  uniforms.uWaveAmp = 0.003 + intensity * 0.004;
}
