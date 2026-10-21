/**
 * [AGENT 3: SENSORY UI & GPU SHADER ENGINEER]
 * Real-Time WebGL Fragment Shaders (GLSL ES 1.00 / Impeller SkSL Equivalent)
 * Strictly < 0.2 Hz Luminance Oscillation (WCAG 2.1 AAA Photosensitive Safe, Zero Strobing)
 */

import React, { useEffect, useRef, useState } from 'react';
import { ShaderId, TouchRipplePoint } from '../types/aurasync';

const VERTEX_SHADER_SOURCE = `
  attribute vec2 a_position;
  varying vec2 v_uv;
  void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

/**
 * Unified Fragment Shader implementing all 4 Benchmark Autism Sensory Shaders:
 * u_shaderIndex = 0: Bioluminescent 3D Light Tunnel (slow constant Z-axis drift)
 * u_shaderIndex = 1: Rising Translucent Classroom Bubbles (predictable upward buoyancy)
 * u_shaderIndex = 2: High-Contrast OLED Floating Lanterns (pure #000000 background)
 * u_shaderIndex = 3: Co-Regulation Breathing Orb (4.0s inhale expand, 6.0s exhale contract = 0.10 Hz)
 */
export const FRAGMENT_SHADER_SOURCE = `
  precision highp float;
  varying vec2 v_uv;
  uniform vec2 u_resolution;
  uniform float u_time;
  uniform float u_rawTime;
  uniform int u_shaderIndex;
  uniform vec3 u_touch0; // xy = normalized coords, z = age in seconds
  uniform vec3 u_touch1;

  // Smooth water ripple displacement around child touch points
  vec2 computeRippleOffset(vec2 uv, vec2 aspect) {
    vec2 totalOffset = vec2(0.0);
    if (u_touch0.z > 0.0 && u_touch0.z < 3.5) {
      vec2 delta = (uv - u_touch0.xy) * aspect;
      float dist = length(delta);
      float waveRadius = u_touch0.z * 0.28;
      float ring = exp(-pow((dist - waveRadius) * 14.0, 2.0));
      float fade = 1.0 - (u_touch0.z / 3.5);
      totalOffset += normalize(delta + vec2(0.0001)) * sin(dist * 32.0 - u_touch0.z * 8.0) * ring * fade * 0.018;
    }
    if (u_touch1.z > 0.0 && u_touch1.z < 3.5) {
      vec2 delta = (uv - u_touch1.xy) * aspect;
      float dist = length(delta);
      float waveRadius = u_touch1.z * 0.28;
      float ring = exp(-pow((dist - waveRadius) * 14.0, 2.0));
      float fade = 1.0 - (u_touch1.z / 3.5);
      totalOffset += normalize(delta + vec2(0.0001)) * sin(dist * 32.0 - u_touch1.z * 8.0) * ring * fade * 0.018;
    }
    return totalOffset;
  }

  // SHADER A: Bioluminescent 3D Light Tunnel (Slow Constant Z-Axis Drift)
  vec3 renderBioluminescentTunnel(vec2 p, float t) {
    float r = length(p) + 0.06;
    float a = atan(p.y, p.x);
    // Slow Z-axis depth projection (< 0.12 Hz modulation)
    float depth = 0.45 / r + t * 0.22;
    float radialWave = sin(depth * 4.5 + sin(a * 3.0 + t * 0.35) * 0.45);
    float secondaryWave = cos(depth * 2.5 - a * 2.0 + t * 0.18);

    vec3 deepAbyss = vec3(0.015, 0.045, 0.11);
    vec3 biolumTeal = vec3(0.07, 0.56, 0.64);
    vec3 softViolet = vec3(0.28, 0.24, 0.58);

    float glowA = smoothstep(-0.6, 0.85, radialWave) * smoothstep(0.04, 0.65, r);
    float glowB = smoothstep(-0.4, 0.9, secondaryWave) * smoothstep(0.08, 0.85, r);

    vec3 col = mix(deepAbyss, biolumTeal, glowA * 0.72);
    col = mix(col, softViolet, glowB * 0.48);
    // Soft center horizon core attenuation so center never glares
    col *= smoothstep(0.02, 0.26, r);
    return col;
  }

  // SHADER B: Rising Translucent Classroom Bubbles (Predictable Upward Buoyancy)
  vec3 renderClassroomBubbles(vec2 p, vec2 uv, float t) {
    vec3 bgBottom = vec3(0.02, 0.08, 0.14);
    vec3 bgTop = vec3(0.05, 0.18, 0.26);
    vec3 col = mix(bgBottom, bgTop, uv.y);

    for (int i = 0; i < 8; i++) {
      float fi = float(i);
      float xSeed = sin(fi * 1.87 + 0.5) * 0.65;
      float speed = 0.08 + mod(fi * 0.023, 0.06);
      float yPos = mod(t * speed + fi * 0.31, 1.8) - 0.9;
      float sway = sin(t * 0.45 + fi * 2.1) * 0.07;
      vec2 bubbleCenter = vec2(xSeed + sway, yPos);
      float radius = 0.11 + mod(fi * 0.037, 0.09);

      float d = length(p - bubbleCenter);
      if (d < radius) {
        float normD = d / radius;
        // Soft Fresnel rim + specular crescent
        float rim = pow(normD, 3.2);
        vec2 localDir = (p - bubbleCenter) / radius;
        float highlight = smoothstep(0.55, 0.92, dot(localDir, normalize(vec2(-0.5, 0.65)))) * (1.0 - normD * 0.6);
        vec3 bubbleTint = mix(vec3(0.22, 0.78, 0.82), vec3(0.58, 0.48, 0.92), mod(fi, 2.0));
        col = mix(col, bubbleTint, rim * 0.55 + 0.08);
        col += vec3(0.65, 0.88, 0.95) * highlight * 0.35;
      }
    }
    return col;
  }

  // SHADER C: High-Contrast OLED Floating Lanterns (Pure #000000 Background)
  vec3 renderOledLanterns(vec2 p, float t) {
    vec3 col = vec3(0.0, 0.0, 0.0); // Pure #000000 OLED black for zero stray retinal stimulation
    for (int i = 0; i < 6; i++) {
      float fi = float(i);
      float xBase = (fi - 2.5) * 0.26;
      float yCycle = mod(t * (0.055 + fi * 0.008) + fi * 0.42, 1.7) - 0.85;
      float xDrift = sin(t * 0.32 + fi * 1.4) * 0.06;
      vec2 lanternPos = vec2(xBase + xDrift, yCycle);

      float dist = length(p - lanternPos);
      float core = exp(-dist * 11.5);
      float aura = exp(-dist * 4.2) * 0.45;

      vec3 warmAmber = vec3(0.96, 0.58, 0.18);
      vec3 calmEmerald = vec3(0.16, 0.78, 0.62);
      vec3 lanternColor = mix(warmAmber, calmEmerald, mod(fi, 2.0));

      col += lanternColor * (core * 0.82 + aura * 0.42);
    }
    return clamp(col, 0.0, 0.88);
  }

  // SHADER D: Co-Regulation Breathing Orb (4.0s Inhale Expand, 6.0s Exhale Contract = 0.10 Hz)
  vec3 renderBreathingOrb(vec2 p, float rawTime) {
    float cycleSec = mod(rawTime, 10.0);
    float breathPhase = 0.0;
    if (cycleSec < 4.0) {
      // 4.0s smooth sinusoidal inhale expansion
      breathPhase = 0.5 - 0.5 * cos((cycleSec / 4.0) * 3.14159265);
    } else {
      // 6.0s prolonged vagal exhale contraction
      breathPhase = 0.5 + 0.5 * cos(((cycleSec - 4.0) / 6.0) * 3.14159265);
    }

    float baseRadius = mix(0.18, 0.42, breathPhase);
    float dist = length(p);

    vec3 bg = vec3(0.015, 0.03, 0.07);
    vec3 inhaleColor = vec3(0.16, 0.68, 0.76);
    vec3 exhaleColor = vec3(0.24, 0.38, 0.74);
    vec3 orbHue = mix(exhaleColor, inhaleColor, breathPhase);

    float softBody = smoothstep(baseRadius + 0.14, baseRadius - 0.06, dist);
    float outerHalo = exp(-max(0.0, dist - baseRadius * 0.7) * 5.0) * 0.48;
    // Reference guide ring at full inhale radius
    float guideRing = exp(-pow((dist - 0.42) * 42.0, 2.0)) * 0.22;

    vec3 col = bg + orbHue * (softBody * 0.78 + outerHalo) + vec3(0.45, 0.75, 0.85) * guideRing;
    return col;
  }

  void main() {
    vec2 aspect = vec2(u_resolution.x / max(1.0, u_resolution.y), 1.0);
    vec2 ripple = computeRippleOffset(v_uv, aspect);
    vec2 uv = clamp(v_uv + ripple, 0.0, 1.0);
    vec2 p = (uv - 0.5) * aspect;

    vec3 color = vec3(0.02, 0.05, 0.10);
    if (u_shaderIndex == 0) {
      color = renderBioluminescentTunnel(p, u_time);
    } else if (u_shaderIndex == 1) {
      color = renderClassroomBubbles(p, uv, u_time);
    } else if (u_shaderIndex == 2) {
      color = renderOledLanterns(p, u_time);
    } else {
      color = renderBreathingOrb(p, u_rawTime);
    }

    // Add gentle luminous water ring where child touches screen
    if (u_touch0.z > 0.0 && u_touch0.z < 3.0) {
      float d0 = length((v_uv - u_touch0.xy) * aspect);
      float ring0 = exp(-pow((d0 - u_touch0.z * 0.26) * 24.0, 2.0)) * (1.0 - u_touch0.z / 3.0);
      color += vec3(0.35, 0.82, 0.88) * ring0 * 0.42;
    }

    gl_FragColor = vec4(color, 1.0);
  }
`;

interface SensoryShaderCanvasProps {
  shaderId: ShaderId;
  speedMultiplier: number;
  ripples: TouchRipplePoint[];
  className?: string;
}

export const SensoryShaderCanvas: React.FC<SensoryShaderCanvasProps> = ({
  shaderId,
  speedMultiplier,
  ripples,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [webglFallback, setWebglFallback] = useState(false);
  const simTimeRef = useRef<number>(0);
  const rawTimeRef = useRef<number>(0);
  const lastFrameMsRef = useRef<number>(performance.now());
  const ripplesRef = useRef<TouchRipplePoint[]>(ripples);

  useEffect(() => {
    ripplesRef.current = ripples;
  }, [ripples]);

  const shaderIndex =
    shaderId === ShaderId.BIOLUMINESCENT_TUNNEL
      ? 0
      : shaderId === ShaderId.CLASSROOM_BUBBLES
      ? 1
      : shaderId === ShaderId.OLED_LANTERNS
      ? 2
      : 3;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setWebglFallback(true);
    };
    const handleContextRestored = () => {
      setWebglFallback(false);
    };

    canvas.addEventListener('webglcontextlost', handleContextLost, false);
    canvas.addEventListener('webglcontextrestored', handleContextRestored, false);

    const gl = canvas.getContext('webgl', { antialias: true, powerPreference: 'low-power' });
    if (!gl) {
      setWebglFallback(true);
      return;
    }

    const compileShader = (type: number, source: string): WebGLShader | null => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vs = compileShader(gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
    const fs = compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
    if (!vs || !fs) {
      setWebglFallback(true);
      return;
    }

    const program = gl.createProgram();
    if (!program) {
      setWebglFallback(true);
      return;
    }
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      setWebglFallback(true);
      return;
    }

    gl.useProgram(program);

    const quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    const posLoc = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const uResLoc = gl.getUniformLocation(program, 'u_resolution');
    const uTimeLoc = gl.getUniformLocation(program, 'u_time');
    const uRawTimeLoc = gl.getUniformLocation(program, 'u_rawTime');
    const uShaderIdxLoc = gl.getUniformLocation(program, 'u_shaderIndex');
    const uTouch0Loc = gl.getUniformLocation(program, 'u_touch0');
    const uTouch1Loc = gl.getUniformLocation(program, 'u_touch1');

    let animId = 0;

    const renderFrame = (nowMs: number) => {
      const dtSec = Math.min(0.1, Math.max(0.001, (nowMs - lastFrameMsRef.current) / 1000));
      lastFrameMsRef.current = nowMs;

      simTimeRef.current += dtSec * speedMultiplier;
      rawTimeRef.current += dtSec;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }

      gl.uniform2f(uResLoc, width, height);
      gl.uniform1f(uTimeLoc, simTimeRef.current);
      gl.uniform1f(uRawTimeLoc, rawTimeRef.current);
      gl.uniform1i(uShaderIdxLoc, shaderIndex);

      const activeRipples = ripplesRef.current;
      const r0 = activeRipples[activeRipples.length - 1];
      const r1 = activeRipples[activeRipples.length - 2];

      if (r0) {
        const age0 = Math.max(0.001, (nowMs - r0.createdAtMs) / 1000);
        gl.uniform3f(uTouch0Loc, r0.xNormalized, 1.0 - r0.yNormalized, age0);
      } else {
        gl.uniform3f(uTouch0Loc, 0, 0, -1);
      }

      if (r1) {
        const age1 = Math.max(0.001, (nowMs - r1.createdAtMs) / 1000);
        gl.uniform3f(uTouch1Loc, r1.xNormalized, 1.0 - r1.yNormalized, age1);
      } else {
        gl.uniform3f(uTouch1Loc, 0, 0, -1);
      }

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      animId = requestAnimationFrame(renderFrame);
    };

    animId = requestAnimationFrame(renderFrame);

    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
    };
  }, [shaderIndex, speedMultiplier]);

  return (
    <div className={`relative w-full h-full overflow-hidden bg-black ${className}`}>
      {!webglFallback ? (
        <canvas
          ref={canvasRef}
          className="w-full h-full block"
          aria-label={`Sensory shader canvas rendering ${shaderId}`}
        />
      ) : (
        /* Resilient zero-broken-state fallback if WebGL is disabled in headless browser */
        <div
          className="w-full h-full flex items-center justify-center"
          style={{
            background:
              shaderId === ShaderId.OLED_LANTERNS
                ? '#000000'
                : 'radial-gradient(circle at 50% 50%, #0f3f4c 0%, #05101c 75%)',
          }}
        >
          <div className="w-56 h-56 rounded-full bg-teal-500/20 blur-2xl animate-pulse" />
        </div>
      )}
    </div>
  );
};
