// Draws one scene to a 2D canvas context. Leans on gradients/typography/
// shapes rather than external images by default (zero-cost, no CORS risk);
// the user's own profile/project images are used as a bonus when they load
// cleanly, and silently skipped otherwise rather than breaking the scene.

import { tokenizeForWrap, joinTokens } from "../../utils/textMetrics.js";

const imageCache = new Map();

function loadImage(src) {
  if (!src) return Promise.resolve(null);
  if (imageCache.has(src)) return imageCache.get(src);
  const promise = new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
  imageCache.set(src, promise);
  return promise;
}

function ease(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// alpha fades in over the first 20% of the scene and out over the last 15%
function sceneAlpha(t) {
  if (t < 0.2) return ease(t / 0.2);
  if (t > 0.85) return 1 - ease((t - 0.85) / 0.15);
  return 1;
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight, align = "left") {
  // Tokenised rather than split on spaces: Japanese has no spaces, so a
  // whitespace split yields one unbreakable token that overflows the canvas.
  const tokens = tokenizeForWrap(text);
  let current = [];
  const lines = [];
  for (const token of tokens) {
    const test = joinTokens([...current, token]);
    if (ctx.measureText(test).width > maxWidth && current.length) {
      lines.push(joinTokens(current));
      current = [token];
    } else {
      current.push(token);
    }
  }
  if (current.length) lines.push(joinTokens(current));
  lines.forEach((l, i) => {
    const drawX = align === "center" ? x : x;
    ctx.textAlign = align;
    ctx.fillText(l, drawX, y + i * lineHeight);
  });
  return lines.length * lineHeight;
}

function drawBackground(ctx, w, h, theme) {
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, "#050611");
  grad.addColorStop(0.55, "#0b0d1c");
  grad.addColorStop(1, shade(theme.secondary, -0.75));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  const glow = ctx.createRadialGradient(w * 0.8, h * 0.15, 0, w * 0.8, h * 0.15, w * 0.5);
  glow.addColorStop(0, hexToRgba(theme.primary, 0.25));
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  const glow2 = ctx.createRadialGradient(w * 0.15, h * 0.9, 0, w * 0.15, h * 0.9, w * 0.4);
  glow2.addColorStop(0, hexToRgba(theme.secondary, 0.2));
  glow2.addColorStop(1, "transparent");
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, w, h);
}

function shade(hex, amt) {
  const { r, g, b } = hexToRgb(hex);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c + (amt < 0 ? -c : 255 - c) * Math.abs(amt))));
  return `rgb(${f(r)}, ${f(g)}, ${f(b)})`;
}

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "#00c9ff");
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : { r: 0, g: 201, b: 255 };
}

function hexToRgba(hex, a) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function drawChips(ctx, items, x, y, maxWidth, theme) {
  ctx.font = "600 22px 'Inter', sans-serif";
  let cx = x;
  let cy = y;
  const chipH = 42;
  const gap = 12;
  items.forEach((label) => {
    const textW = ctx.measureText(label).width;
    const chipW = textW + 36;
    if (cx + chipW > x + maxWidth) {
      cx = x;
      cy += chipH + gap;
    }
    ctx.fillStyle = hexToRgba(theme.primary, 0.15);
    ctx.strokeStyle = hexToRgba(theme.primary, 0.5);
    ctx.lineWidth = 1.5;
    roundRect(ctx, cx, cy, chipW, chipH, 21);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#e2f6ff";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(label, cx + 18, cy + chipH / 2 + 1);
    cx += chipW + gap;
  });
  ctx.textBaseline = "alphabetic";
  return cy + chipH;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawAvatar(ctx, img, cx, cy, radius, name, theme) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.closePath();
  if (img) {
    ctx.clip();
    ctx.drawImage(img, cx - radius, cy - radius, radius * 2, radius * 2);
  } else {
    ctx.fillStyle = hexToRgba(theme.primary, 0.25);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `700 ${radius}px 'Space Grotesk', sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText((name || "?").slice(0, 1).toUpperCase(), cx, cy + radius * 0.05);
  }
  ctx.restore();
  ctx.strokeStyle = theme.primary;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
}

const RENDERERS = {
  intro(ctx, { w, h, brief, theme, images, t }) {
    drawAvatar(ctx, images.profile, w / 2, h * 0.32, 90, brief.name, theme);
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.font = "800 64px 'Space Grotesk', sans-serif";
    ctx.fillText(brief.name || "", w / 2, h * 0.55);
    ctx.font = "500 28px 'Inter', sans-serif";
    ctx.fillStyle = hexToRgba(theme.primary, 0.9);
    ctx.fillText(brief.roles || "", w / 2, h * 0.61);
    if (brief.tagline) {
      ctx.fillStyle = "#94a3b8";
      ctx.font = "400 22px 'Inter', sans-serif";
      wrapText(ctx, brief.tagline, w / 2, h * 0.68, w * 0.6, 30, "center");
    }
    if (brief.location) {
      ctx.fillStyle = "#64748b";
      ctx.font = "400 18px 'Inter', sans-serif";
      ctx.fillText(`📍 ${brief.location}`, w / 2, h * 0.78);
    }
  },

  about(ctx, { w, h, text, theme }) {
    heading(ctx, "About", w, theme);
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "400 30px 'Inter', sans-serif";
    wrapText(ctx, text, w * 0.12, h * 0.4, w * 0.76, 42, "left");
  },

  skills(ctx, { w, h, brief, theme }) {
    heading(ctx, "Skills", w, theme);
    drawChips(ctx, brief.topSkills.slice(0, 10), w * 0.12, h * 0.38, w * 0.76, theme);
  },

  experience(ctx, { w, h, brief, theme }) {
    heading(ctx, "Experience", w, theme);
    let y = h * 0.38;
    brief.items.forEach((item) => {
      ctx.fillStyle = "#fff";
      ctx.font = "700 30px 'Space Grotesk', sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(item.role, w * 0.12, y);
      ctx.fillStyle = hexToRgba(theme.primary, 0.9);
      ctx.font = "500 22px 'Inter', sans-serif";
      ctx.fillText(`${item.company} · ${item.duration}`, w * 0.12, y + 34);
      y += 110;
    });
  },

  project(ctx, { w, h, brief, theme, images, scene }) {
    const img = scene.projectId ? images.project?.[scene.projectId] : null;
    heading(ctx, brief.name, w, theme);
    const textX = img ? w * 0.12 : w * 0.12;
    const textW = img ? w * 0.42 : w * 0.76;
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "400 26px 'Inter', sans-serif";
    let y = wrapText(ctx, brief.shortDesc || brief.fullDesc || "", textX, h * 0.42, textW, 36, "left") + h * 0.42 + 20;
    if (brief.tech?.length) drawChips(ctx, brief.tech.slice(0, 6), textX, y, textW, theme);
    if (brief.metrics) {
      ctx.fillStyle = hexToRgba(theme.primary, 0.9);
      ctx.font = "600 22px 'Inter', sans-serif";
      ctx.fillText(brief.metrics, textX, h * 0.85);
    }
    if (img) {
      const boxW = w * 0.36;
      const boxH = boxW * (img.height / img.width);
      const bx = w * 0.58;
      const by = h * 0.42;
      roundRect(ctx, bx, by, boxW, Math.min(boxH, h * 0.4), 16);
      ctx.save();
      ctx.clip();
      ctx.drawImage(img, bx, by, boxW, boxW * (img.height / img.width));
      ctx.restore();
    }
  },

  education(ctx, { w, h, brief, theme }) {
    heading(ctx, "Education", w, theme);
    let y = h * 0.38;
    ctx.textAlign = "left";
    brief.degrees?.forEach((d) => {
      ctx.fillStyle = "#fff";
      ctx.font = "700 28px 'Space Grotesk', sans-serif";
      ctx.fillText(d.degree, w * 0.12, y);
      ctx.fillStyle = "#94a3b8";
      ctx.font = "400 20px 'Inter', sans-serif";
      ctx.fillText(`${d.institution}${d.year ? ` · ${d.year}` : ""}`, w * 0.12, y + 30);
      y += 80;
    });
    brief.certifications?.forEach((c) => {
      ctx.fillStyle = hexToRgba(theme.primary, 0.9);
      ctx.font = "600 22px 'Inter', sans-serif";
      ctx.fillText(`🎓 ${c.name}`, w * 0.12, y);
      y += 46;
    });
  },

  achievements(ctx, { w, h, brief, theme }) {
    heading(ctx, "Achievements", w, theme);
    let y = h * 0.4;
    brief.awards?.forEach((a) => {
      ctx.fillStyle = "#fff";
      ctx.font = "600 26px 'Inter', sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`🏆 ${a.name}`, w * 0.12, y);
      ctx.fillStyle = "#64748b";
      ctx.font = "400 18px 'Inter', sans-serif";
      ctx.fillText(`${a.issuer || ""}${a.year ? ` · ${a.year}` : ""}`, w * 0.12, y + 28);
      y += 78;
    });
  },

  testimonial(ctx, { w, h, brief, theme }) {
    ctx.textAlign = "center";
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "italic 400 32px 'Inter', sans-serif";
    wrapText(ctx, `"${brief.quote}"`, w / 2, h * 0.42, w * 0.7, 44, "center");
    ctx.fillStyle = hexToRgba(theme.primary, 0.9);
    ctx.font = "600 22px 'Inter', sans-serif";
    ctx.fillText(`${brief.name}${brief.role ? `, ${brief.role}` : ""}${brief.company ? ` at ${brief.company}` : ""}`, w / 2, h * 0.68);
  },

  closing(ctx, { w, h, brief, theme, images }) {
    drawAvatar(ctx, images.profile, w / 2, h * 0.36, 80, brief.name, theme);
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.font = "700 42px 'Space Grotesk', sans-serif";
    ctx.fillText("Thanks for watching", w / 2, h * 0.55);
    if (brief.email) {
      ctx.fillStyle = hexToRgba(theme.primary, 0.9);
      ctx.font = "500 24px 'Inter', sans-serif";
      ctx.fillText(brief.email, w / 2, h * 0.62);
    }
  },
};

function heading(ctx, text, w, theme) {
  ctx.textAlign = "left";
  ctx.fillStyle = "#fff";
  ctx.font = "800 46px 'Space Grotesk', sans-serif";
  ctx.fillText(text, w * 0.12, h_TOP);
  ctx.fillStyle = theme.primary;
  ctx.fillRect(w * 0.12, h_TOP + 14, 60, 5);
}
const h_TOP = 200; // fixed top offset for section headings across 720px-tall canvases

export function drawScene(ctx, { width, height, scene, data, theme, images, captionText, t }) {
  ctx.clearRect(0, 0, width, height);
  drawBackground(ctx, width, height, theme);

  ctx.save();
  ctx.globalAlpha = sceneAlpha(t);
  const renderer = RENDERERS[scene.type] || RENDERERS.about;
  renderer(ctx, { w: width, h: height, brief: scene.brief, text: scene.text, theme, images, scene, t });
  ctx.restore();

  if (captionText) {
    const barH = 90;
    ctx.fillStyle = "rgba(5,6,17,0.72)";
    ctx.fillRect(0, height - barH, width, barH);
    ctx.fillStyle = "#f8fafc";
    ctx.font = "500 26px 'Inter', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(captionText, width / 2, height - barH / 2 + 9);
  }
}

export async function buildImageBundle(scenePlan, data) {
  const profile = await loadImage(data.profile?.photo);
  const project = {};
  for (const scene of scenePlan.scenes) {
    if (scene.type === "project" && scene.projectId) {
      const p = data.projects.find((pr) => pr.id === scene.projectId);
      if (p?.images?.[0]) project[scene.projectId] = await loadImage(p.images[0]);
    }
  }
  return { profile, project };
}
