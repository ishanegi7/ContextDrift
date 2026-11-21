import { useEffect, useRef } from 'react';

/**
 * GradientASCII - Interactive ASCII gradient background component (React Bits inspired)
 *
 * @param {string[]} colors - Palette array of hex colors
 * @param {string} backgroundColor - Canvas background color (defaults to UI canvas '#FEFCF3')
 * @param {string} shape - Preset light shape ("horizon", "rise", "eclipse", "linear")
 * @param {string} characters - String of ASCII characters ordered by density/brightness
 * @param {number} cellSize - Pixel dimensions of each character cell
 * @param {number} density - Sampling density threshold (0 to 1)
 */
export default function GradientASCII({
  colors = ['#FEFCF3', '#F0DBDB', '#DBA39A', '#786864', '#2C2220'],
  backgroundColor = '#FEFCF3',
  shape = 'horizon',
  characters = ' =+xX0S8#@',
  cellSize = 18,
  density = 0.8,
  className = '',
  style = {},
}) {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: -1000, y: -1000, active: false });
  const animFrameRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const isTransparent = backgroundColor === 'transparent';
    const ctx = canvas.getContext('2d', { alpha: isTransparent });
    if (!ctx) return;

    // Helper: parse hex color to [r, g, b]
    const hexToRgb = (hex) => {
      let c = hex.replace('#', '');
      if (c.length === 3) c = c.split('').map((x) => x + x).join('');
      const num = parseInt(c, 16);
      return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
    };

    const parsedColors = (colors && colors.length > 0 ? colors : ['#DBA39A', '#2C2220']).map(hexToRgb);

    // Color interpolation across the palette
    const sampleColor = (t) => {
      const clamped = Math.max(0, Math.min(1, t));
      const scaled = clamped * (parsedColors.length - 1);
      const idx = Math.floor(scaled);
      const frac = scaled - idx;
      const c1 = parsedColors[idx];
      const c2 = parsedColors[Math.min(idx + 1, parsedColors.length - 1)];
      const r = Math.round(c1[0] + frac * (c2[0] - c1[0]));
      const g = Math.round(c1[1] + frac * (c2[1] - c1[1]));
      const b = Math.round(c1[2] + frac * (c2[2] - c1[2]));
      return [r, g, b];
    };

    let width = 0;
    let height = 0;

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect() || {
        width: canvas.offsetWidth || 800,
        height: canvas.offsetHeight || 600,
      };
      width = Math.floor(rect.width);
      height = Math.floor(rect.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }

    // Mouse listeners on container
    const parent = canvas.parentElement || canvas;
    const handleMouseMove = (e) => {
      const rect = parent.getBoundingClientRect();
      mouseRef.current.x = e.clientX - rect.left;
      mouseRef.current.y = e.clientY - rect.top;
      mouseRef.current.active = true;
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
      mouseRef.current.x = -1000;
      mouseRef.current.y = -1000;
    };

    parent.addEventListener('mousemove', handleMouseMove);
    parent.addEventListener('mouseleave', handleMouseLeave);

    let startTime = performance.now();
    const charLen = characters.length;

    // Animation loop
    const render = (now) => {
      if (width === 0 || height === 0) {
        animFrameRef.current = requestAnimationFrame(render);
        return;
      }

      const elapsed = (now - startTime) * 0.001;

      // Fill canvas background
      if (isTransparent) {
        ctx.clearRect(0, 0, width, height);
      } else {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, width, height);
      }

      ctx.font = `${Math.floor(cellSize * 0.88)}px "Geist Mono", "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const cols = Math.ceil(width / cellSize);
      const rows = Math.ceil(height / cellSize);

      const mouse = mouseRef.current;
      const mouseRadius = 140;

      for (let r = 0; r < rows; r++) {
        const y = r * cellSize + cellSize / 2;

        for (let c = 0; c < cols; c++) {
          const x = c * cellSize + cellSize / 2;

          let intensity = 0;

          if (shape === 'horizon') {
            // Horizon curve: subtle arc across the width with undulating dynamic wave
            const horizonBase = height * 0.65;
            const curve = Math.sin((x / width) * Math.PI) * (height * 0.12);
            const wave = Math.sin(elapsed * 1.2 + (x / width) * 4.5) * (height * 0.025);
            const horizonY = horizonBase - curve + wave;
            const dist = y - horizonY;

            if (dist < 0) {
              // Above horizon: atmospheric gradient glow fading up
              const norm = Math.abs(dist) / (height * 0.5);
              intensity = Math.exp(-norm * 2.1);
            } else {
              // Below horizon: ground reflection
              const norm = dist / (height * 0.35);
              intensity = Math.exp(-norm * 3.2) * 0.65;
            }
          } else if (shape === 'rise') {
            // Glow rising up from bottom
            const norm = (height - y) / height;
            intensity = Math.pow(norm, 1.4);
          } else if (shape === 'eclipse') {
            // Radial ring around center
            const cx = width / 2;
            const cy = height / 2;
            const dist = Math.hypot(x - cx, y - cy);
            const radius = Math.min(width, height) * 0.3;
            intensity = Math.exp(-Math.pow((dist - radius) / (radius * 0.4), 2));
          } else {
            // Default linear
            intensity = 1 - y / height;
          }

          // Mouse cursor proximity boost and scrambling
          let isHovered = false;
          if (mouse.active) {
            const dx = x - mouse.x;
            const dy = y - mouse.y;
            const distToMouse = Math.hypot(dx, dy);
            if (distToMouse < mouseRadius) {
              const boost = (1 - distToMouse / mouseRadius);
              intensity = Math.min(1, intensity + boost * 0.55);
              if (boost > 0.4) {
                isHovered = true;
              }
            }
          }

          // Density threshold test
          const pseudoRandom = Math.abs(Math.sin(c * 12.9898 + r * 78.233 + Math.floor(elapsed * 2) * 0.05));
          if (pseudoRandom > density && intensity < 0.85) {
            continue;
          }

          if (intensity <= 0.05) {
            continue;
          }

          // Sample color from palette
          const [cr, cg, cb] = sampleColor(intensity);
          const alpha = Math.min(1, Math.max(0.2, intensity * 1.15));

          // Pick character based on luminance
          let charIdx = Math.floor(intensity * (charLen - 1));
          if (isHovered && Math.random() < 0.4) {
            // Scramble on cursor hover
            charIdx = Math.floor(Math.random() * charLen);
          }

          const char = characters[Math.min(charLen - 1, Math.max(0, charIdx))] || ' ';

          if (char !== ' ') {
            ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${alpha.toFixed(2)})`;
            ctx.fillText(char, x, y);
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      resizeObserver.disconnect();
      parent.removeEventListener('mousemove', handleMouseMove);
      parent.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [colors, backgroundColor, shape, characters, cellSize, density]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 block h-full w-full pointer-events-auto ${className}`}
      style={{ display: 'block', width: '100%', height: '100%', ...style }}
    />
  );
}
