(function () {
  "use strict";

  const MAX_EDGE = 4096;
  const TOAST_MS = 2800;

  const els = {
    fileInput: document.getElementById("file-input"),
    btnPick: document.getElementById("btn-pick"),
    fileName: document.getElementById("file-name"),
    subtitleHeight: document.getElementById("subtitle-height"),
    subtitleHeightHint: document.getElementById("subtitle-height-hint"),
    fontSize: document.getElementById("font-size"),
    fontSizeScale: document.getElementById("font-size-scale"),
    fontScalePct: document.getElementById("font-scale-pct"),
    fontSizeHint: document.getElementById("font-size-hint"),
    fontColor: document.getElementById("font-color"),
    fontColorHex: document.getElementById("font-color-hex"),
    outlineColor: document.getElementById("outline-color"),
    outlineColorHex: document.getElementById("outline-color-hex"),
    fontFamily: document.getElementById("font-family"),
    fontWeight: document.getElementById("font-weight"),
    subtitleText: document.getElementById("subtitle-text"),
    btnGenerate: document.getElementById("btn-generate"),
    btnSave: document.getElementById("btn-save"),
    previewCanvas: document.getElementById("preview-canvas"),
    previewPlaceholder: document.getElementById("preview-placeholder"),
    toast: document.getElementById("toast"),
  };

  /** @type {HTMLImageElement | null} */
  let loadedImage = null;
  /** @type {string | null} */
  let loadedObjectUrl = null;
  let hasOutput = false;

  function getSliceH() {
    const req = parseInt(els.subtitleHeight.value, 10);
    const safeReq = Number.isNaN(req) || req < 1 ? 40 : req;
    if (!loadedImage) return safeReq;
    const h = loadedImage.naturalHeight;
    return Math.min(safeReq, h);
  }

  function updateFontHints() {
    const sliceH = getSliceH();
    const px = parseInt(els.fontSize.value, 10);
    const scale = els.fontSizeScale ? parseInt(els.fontSizeScale.value, 10) : NaN;
    if (els.fontScalePct && els.fontSizeScale) {
      els.fontScalePct.textContent = (Number.isNaN(scale) ? 52 : scale) + "%";
    }
    if (els.fontSizeScale) {
      els.fontSizeScale.setAttribute(
        "aria-valuetext",
        (Number.isNaN(scale) ? 52 : scale) + "%，约 " + (Number.isNaN(px) ? "—" : px) + " 像素"
      );
    }
    if (els.fontSizeHint) {
      if (sliceH > 0 && !Number.isNaN(px)) {
        els.fontSizeHint.textContent =
          "字幕条有效高度 " +
          sliceH +
          "px · 字号约为其 " +
          Math.round((px / sliceH) * 100) +
          "%（" +
          px +
          "px）";
      } else {
        els.fontSizeHint.textContent = "上传图片后按条带高度自动换算为像素";
      }
    }
  }

  function updateSubtitleHeightHint(w, h, stripPx) {
    if (!els.subtitleHeightHint) return;
    if (!w || !h) {
      els.subtitleHeightHint.textContent = "上传图片后将按图高自动匹配";
      return;
    }
    const pct = Math.round((stripPx / h) * 1000) / 10;
    els.subtitleHeightHint.textContent =
      "图高 " + h + "px · 当前条带 " + stripPx + "px（约图高 " + pct + "%）";
  }

  function syncFontPxFromScale() {
    if (!els.fontSizeScale || !els.fontSize) return;
    const sliceH = getSliceH();
    let scale = parseInt(els.fontSizeScale.value, 10);
    if (Number.isNaN(scale)) scale = 52;
    scale = Math.max(28, Math.min(78, scale));
    els.fontSizeScale.value = String(scale);
    let px = Math.round(sliceH * (scale / 100));
    const maxPx = Math.max(8, Math.floor(sliceH * 0.92));
    px = Math.max(8, Math.min(maxPx, px));
    els.fontSize.value = String(px);
    updateFontHints();
  }

  function syncScaleFromFontPx() {
    if (!els.fontSizeScale || !els.fontSize) return;
    const sliceH = getSliceH();
    if (sliceH <= 0) return;
    let px = parseInt(els.fontSize.value, 10);
    if (Number.isNaN(px)) px = 12;
    const maxPx = Math.max(8, Math.floor(sliceH * 0.92));
    px = Math.max(8, Math.min(maxPx, px));
    els.fontSize.value = String(px);
    let scale = Math.round((px / sliceH) * 100);
    scale = Math.max(28, Math.min(78, scale));
    els.fontSizeScale.value = String(scale);
    updateFontHints();
  }

  /** 按图片尺寸写入字幕条高度与字号（字号 = 条高 × 滑块比例） */
  function applyAutoLayoutFromImage(img) {
    const I = img.naturalHeight;
    const W = img.naturalWidth;
    if (I < 1 || W < 1) return;
    const strip = Math.max(36, Math.min(Math.min(240, I), Math.round(I * 0.072)));
    els.subtitleHeight.value = String(strip);
    const sliceH = Math.min(strip, I);
    let scale = parseInt(els.fontSizeScale.value, 10);
    if (Number.isNaN(scale)) scale = 52;
    scale = Math.max(28, Math.min(78, scale));
    els.fontSizeScale.value = String(scale);
    let px = Math.round(sliceH * (scale / 100));
    const maxPx = Math.max(12, Math.floor(sliceH * 0.9));
    px = Math.max(12, Math.min(maxPx, px));
    els.fontSize.value = String(px);
    const adjScale = Math.round((px / sliceH) * 100);
    els.fontSizeScale.value = String(Math.max(28, Math.min(78, adjScale)));
    updateFontHints();
    updateSubtitleHeightHint(W, I, strip);
  }

  const FONT_STACK = {
    system:
      'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif',
    sans: '"Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif',
    hei: '"Microsoft YaHei","PingFang SC","Heiti SC","Noto Sans SC",SimHei,sans-serif',
    song: '"Songti SC","SimSun","NSimSun","Noto Serif SC",serif',
    kai: '"KaiTi","Kaiti SC","STKaiti","Noto Serif SC",serif',
    fang: '"FangSong","STFangsong","Noto Serif SC",serif',
    yuan: '"Yuanti SC","YouYuan","Hiragino Maru Gothic ProN","Microsoft YaHei UI",sans-serif',
    xingkai: '"STXingkai","Xingkai SC","KaiTi",cursive',
    serif: 'Georgia, "Times New Roman", "Songti SC", "SimSun", serif',
    mono: 'ui-monospace, "Cascadia Code", Consolas, "Noto Sans SC", monospace',
  };

  function parseHexColor(hex) {
    let s = String(hex).trim();
    if (!s.startsWith("#")) s = "#" + s;
    if (!/^#[0-9a-fA-F]{6}$/.test(s)) return { r: 255, g: 255, b: 255 };
    return {
      r: parseInt(s.slice(1, 3), 16),
      g: parseInt(s.slice(3, 5), 16),
      b: parseInt(s.slice(5, 7), 16),
    };
  }

  function rgbToHex(r, g, b) {
    function c(n) {
      const x = Math.max(0, Math.min(255, Math.round(n)));
      return x.toString(16).padStart(2, "0");
    }
    return "#" + c(r) + c(g) + c(b);
  }

  function mixHexColors(a, b, t) {
    const A = parseHexColor(a);
    const B = parseHexColor(b);
    return rgbToHex(
      A.r + (B.r - A.r) * t,
      A.g + (B.g - A.g) * t,
      A.b + (B.b - A.b) * t
    );
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   */
  function drawFancySubtitle(ctx, text, cx, cy, style, fillHex, outlineHex, sw, fontPx) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;

    const metrics = ctx.measureText(text);
    const tw = metrics.width;
    const halfW = tw / 2;
    const top = cy - fontPx * 0.52;
    const bot = cy + fontPx * 0.52;

    switch (style) {
      case "thick_pop": {
        // 加粗漫画：白字 + 外白描边 + 内黑描边（双重描边，无渐变）
        const wOut = Math.max(sw * 2.75, fontPx * 0.2);
        const wIn = Math.max(sw * 1.2, fontPx * 0.09);
        ctx.lineWidth = wOut;
        ctx.strokeStyle = "#ffffff";
        ctx.strokeText(text, cx, cy);
        ctx.lineWidth = wIn;
        ctx.strokeStyle = "#000000";
        ctx.strokeText(text, cx, cy);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(text, cx, cy);
        break;
      }
      case "neon_cyan": {
        // 霓虹青：高亮青色字 + 同色光晕（用户若改色易误判为「未生效」）
        ctx.save();
        ctx.shadowColor = "rgba(0, 255, 255, 0.85)";
        ctx.shadowBlur = Math.max(10, Math.round(fontPx * 0.55));
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.fillStyle = "#22d3ee";
        ctx.fillText(text, cx, cy);
        ctx.shadowBlur = Math.max(6, Math.round(fontPx * 0.35));
        ctx.shadowColor = "rgba(34, 211, 238, 0.6)";
        ctx.fillText(text, cx, cy);
        ctx.shadowBlur = 0;
        ctx.lineWidth = Math.max(1.5, sw * 0.45);
        ctx.strokeStyle = "#0891b2";
        ctx.strokeText(text, cx, cy);
        ctx.restore();
        break;
      }
      case "neon_gold": {
        // 金光晕：纵向渐变填充 + 黄色描边 + 暖黄外发光
        const gg = ctx.createLinearGradient(cx - halfW, top, cx + halfW, bot);
        gg.addColorStop(0, "#fffbeb");
        gg.addColorStop(0.4, "#fde047");
        gg.addColorStop(0.75, "#facc15");
        gg.addColorStop(1, "#ca8a04");
        ctx.save();
        ctx.shadowColor = "rgba(250, 204, 21, 0.88)";
        ctx.shadowBlur = Math.max(14, Math.round(fontPx * 0.58));
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.fillStyle = gg;
        ctx.fillText(text, cx, cy);
        ctx.shadowBlur = Math.max(8, Math.round(fontPx * 0.38));
        ctx.fillText(text, cx, cy);
        ctx.shadowBlur = 0;
        ctx.lineWidth = Math.max(2, sw * 0.52);
        ctx.strokeStyle = "#facc15";
        ctx.strokeText(text, cx, cy);
        ctx.restore();
        break;
      }
      case "grad_warm": {
        // 暖阳渐变：上黄下橙 + 深褐描边
        const g = ctx.createLinearGradient(cx - halfW, top, cx + halfW, bot);
        g.addColorStop(0, "#fef08a");
        g.addColorStop(0.55, "#fdba74");
        g.addColorStop(1, "#ea580c");
        ctx.lineWidth = Math.max(sw * 1.05, fontPx * 0.12);
        ctx.strokeStyle = "#431407";
        ctx.strokeText(text, cx, cy);
        ctx.fillStyle = g;
        ctx.fillText(text, cx, cy);
        break;
      }
      case "grad_purple": {
        // 魅紫渐变：上浅紫粉 → 下深紫
        const g = ctx.createLinearGradient(cx - halfW, top, cx + halfW, bot);
        g.addColorStop(0, "#fae8ff");
        g.addColorStop(0.35, "#e879f9");
        g.addColorStop(0.7, "#9333ea");
        g.addColorStop(1, "#4c1d95");
        ctx.lineWidth = Math.max(sw * 0.95, fontPx * 0.11);
        ctx.strokeStyle = "#312e81";
        ctx.strokeText(text, cx, cy);
        ctx.fillStyle = g;
        ctx.fillText(text, cx, cy);
        break;
      }
      case "shadow_3d": {
        // 立体阴影：仅黄字 + 右下纯黑错位阴影（不再给黄字加黑描边）
        const depth = Math.min(14, Math.max(5, Math.round(fontPx * 0.22)));
        for (let i = depth; i >= 1; i--) {
          ctx.fillStyle = "#000000";
          ctx.fillText(text, cx + i, cy + i);
        }
        ctx.fillStyle = "#fde047";
        ctx.fillText(text, cx, cy);
        break;
      }
      case "double_outline": {
        // 双层轮廓：外白 → 内黑 → 黄字（与参考「白圈+深色内圈+黄心」一致）
        ctx.lineWidth = Math.max(sw * 2.2, fontPx * 0.16);
        ctx.strokeStyle = "#ffffff";
        ctx.strokeText(text, cx, cy);
        ctx.lineWidth = Math.max(sw * 0.95, fontPx * 0.075);
        ctx.strokeStyle = "#1e3a8a";
        ctx.strokeText(text, cx, cy);
        ctx.fillStyle = "#fde047";
        ctx.fillText(text, cx, cy);
        break;
      }
      case "ice_blue": {
        // 冰霜亮边：浅蓝字 + 白/青高光光晕，不用双层深蓝描边压扁层次
        ctx.save();
        ctx.shadowColor = "rgba(255, 255, 255, 0.95)";
        ctx.shadowBlur = Math.max(8, Math.round(fontPx * 0.45));
        ctx.fillStyle = "#e0f2fe";
        ctx.fillText(text, cx, cy);
        ctx.shadowColor = "rgba(56, 189, 248, 0.75)";
        ctx.shadowBlur = Math.max(5, Math.round(fontPx * 0.3));
        ctx.fillText(text, cx, cy);
        ctx.shadowBlur = 0;
        ctx.lineWidth = Math.max(1.2, sw * 0.42);
        ctx.strokeStyle = "#0284c7";
        ctx.strokeText(text, cx, cy);
        ctx.restore();
        break;
      }
      case "pop_red": {
        // 醒目红边：红字 + 白描边 + 黑外描边（先白后黑，黑线更宽在外侧）
        ctx.fillStyle = "#dc2626";
        ctx.fillText(text, cx, cy);
        ctx.lineWidth = Math.max(sw * 1.35, fontPx * 0.1);
        ctx.strokeStyle = "#ffffff";
        ctx.strokeText(text, cx, cy);
        ctx.lineWidth = Math.max(sw * 2.35, fontPx * 0.18);
        ctx.strokeStyle = "#000000";
        ctx.strokeText(text, cx, cy);
        break;
      }
      case "soft_white": {
        // 柔光白字：仅柔光，不再套用户黑色轮廓（避免与标准描边雷同）
        ctx.save();
        ctx.fillStyle = "#ffffff";
        ctx.shadowColor = "rgba(255, 255, 255, 0.9)";
        ctx.shadowBlur = Math.max(4, Math.round(fontPx * 0.28));
        ctx.fillText(text, cx, cy);
        ctx.shadowColor = "rgba(148, 163, 184, 0.55)";
        ctx.shadowBlur = Math.max(10, Math.round(fontPx * 0.5));
        ctx.fillText(text, cx, cy);
        ctx.shadowBlur = Math.max(16, Math.round(fontPx * 0.65));
        ctx.shadowColor = "rgba(255, 255, 255, 0.35)";
        ctx.fillText(text, cx, cy);
        ctx.shadowBlur = 0;
        ctx.restore();
        break;
      }
      case "metal": {
        const g = ctx.createLinearGradient(cx - halfW, top, cx + halfW, bot);
        g.addColorStop(0, "#f8fafc");
        g.addColorStop(0.35, "#cbd5e1");
        g.addColorStop(0.65, "#64748b");
        g.addColorStop(1, "#e2e8f0");
        ctx.lineWidth = Math.max(sw * 1.05, fontPx * 0.1);
        ctx.strokeStyle = "#020617";
        ctx.strokeText(text, cx, cy);
        ctx.fillStyle = g;
        ctx.fillText(text, cx, cy);
        break;
      }
      case "classic":
      default: {
        ctx.lineWidth = sw;
        ctx.strokeStyle = outlineHex;
        ctx.fillStyle = fillHex;
        ctx.strokeText(text, cx, cy);
        ctx.fillText(text, cx, cy);
        break;
      }
    }
  }

  function getSelectedFancyStyle() {
    const grid = document.getElementById("fancy-grid");
    if (!grid) return "classic";
    const t = grid.querySelector(".fancy-tile.selected");
    return (t && t.dataset.fancy) || "classic";
  }

  function showToast(message, type) {
    els.toast.textContent = message;
    els.toast.hidden = false;
    els.toast.className = "toast visible toast--" + (type === "error" ? "error" : "success");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () {
      els.toast.classList.remove("visible");
      setTimeout(function () {
        els.toast.hidden = true;
      }, 300);
    }, TOAST_MS);
  }

  function normalizeHex(value) {
    let s = String(value).trim();
    if (!s.startsWith("#")) s = "#" + s;
    if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
    return null;
  }

  function bindColorPair(colorInput, hexInput) {
    colorInput.addEventListener("input", function () {
      hexInput.value = colorInput.value.toLowerCase();
    });
    hexInput.addEventListener("change", function () {
      const hex = normalizeHex(hexInput.value);
      if (hex) {
        colorInput.value = hex;
        hexInput.value = hex;
      }
    });
    hexInput.addEventListener("blur", function () {
      const hex = normalizeHex(hexInput.value);
      if (hex) {
        colorInput.value = hex;
        hexInput.value = hex;
      } else {
        hexInput.value = colorInput.value.toLowerCase();
      }
    });
  }

  bindColorPair(els.fontColor, els.fontColorHex);
  bindColorPair(els.outlineColor, els.outlineColorHex);

  els.btnPick.addEventListener("click", function () {
    els.fileInput.click();
  });

  els.fileInput.addEventListener("change", function () {
    const file = els.fileInput.files && els.fileInput.files[0];
    if (!file) return;

    if (loadedObjectUrl) {
      URL.revokeObjectURL(loadedObjectUrl);
      loadedObjectUrl = null;
    }
    loadedImage = null;
    hasOutput = false;
    els.btnSave.disabled = true;
    els.previewCanvas.classList.add("hidden");
    els.previewPlaceholder.classList.remove("hidden");

    els.fileName.textContent = file.name;
    els.fileName.title = file.name;

    const url = URL.createObjectURL(file);
    loadedObjectUrl = url;
    const img = new Image();
    img.onload = function () {
      loadedImage = img;
      els.btnGenerate.disabled = false;
      applyAutoLayoutFromImage(img);
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      loadedObjectUrl = null;
      showToast("图片加载失败，请换一张图试试", "error");
      els.fileName.textContent = "未选择文件";
      els.fileName.title = "";
      els.btnGenerate.disabled = true;
      updateSubtitleHeightHint(0, 0, 0);
    };
    img.src = url;
  });

  function parseSubtitleLines(text) {
    return text
      .split(/\r?\n/)
      .map(function (line) {
        return line.trim();
      })
      .filter(function (line) {
        return line.length > 0;
      });
  }

  function strokeWidthForFontSize(px) {
    return Math.max(2, Math.round(px * 0.12));
  }

  function renderSubtitleCanvas(img, options) {
    const W = img.naturalWidth;
    const I = img.naturalHeight;
    const H_req = options.subtitleHeight;
    const lines = options.lines;

    if (W <= 0 || I <= 0) throw new Error("图片尺寸无效");
    if (H_req <= 0) throw new Error("字幕高度须大于 0");

    const sliceH = Math.min(H_req, I);
    const stripH = sliceH;
    const N = lines.length;

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = I + N * stripH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("无法创建画布上下文");

    ctx.drawImage(img, 0, 0, W, I);

    const sx = 0;
    const sy = I - sliceH;
    for (let k = 0; k < N; k++) {
      const dy = I + k * stripH;
      ctx.drawImage(img, sx, sy, W, sliceH, 0, dy, W, stripH);

      ctx.strokeStyle = "rgba(0,0,0,0.18)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, dy + stripH - 0.5);
      ctx.lineTo(W, dy + stripH - 0.5);
      ctx.stroke();

      const cx = W / 2;
      const cy = dy + stripH / 2;
      const fontPx = options.fontSize;
      const stack = FONT_STACK[options.fontFamilyKey] || FONT_STACK.system;
      const fw = options.fontWeight === "700" ? "bold" : "normal";
      ctx.font = fw + " " + fontPx + "px " + stack;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      ctx.miterLimit = 2;

      const line = lines[k];
      const sw = strokeWidthForFontSize(fontPx);
      drawFancySubtitle(
        ctx,
        line,
        cx,
        cy,
        options.fancyStyle || "classic",
        options.fontColor,
        options.outlineColor,
        sw,
        fontPx
      );
    }

    return canvas;
  }

  function copyCanvasToPreview(source) {
    const c = els.previewCanvas;
    c.width = source.width;
    c.height = source.height;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(source, 0, 0);
    c.classList.remove("hidden");
    els.previewPlaceholder.classList.add("hidden");
  }

  /** @type {HTMLCanvasElement | null} */
  let lastExportCanvas = null;

  els.btnGenerate.addEventListener("click", function () {
    if (!loadedImage) {
      showToast("请先选择图片", "error");
      return;
    }

    const lines = parseSubtitleLines(els.subtitleText.value);
    if (lines.length === 0) {
      showToast("请输入至少一行字幕", "error");
      return;
    }

    const subtitleHeight = parseInt(els.subtitleHeight.value, 10);
    let fontSize = parseInt(els.fontSize.value, 10);

    if (Number.isNaN(subtitleHeight) || subtitleHeight <= 0) {
      showToast("字幕高度须为大于 0 的数字", "error");
      return;
    }
    if (Number.isNaN(fontSize) || fontSize < 8) {
      showToast("字体大小至少为 8px", "error");
      return;
    }

    const w = loadedImage.naturalWidth;
    const h = loadedImage.naturalHeight;
    const sliceHGen = Math.min(subtitleHeight, h);
    const maxFont = Math.max(8, Math.floor(sliceHGen * 0.92));
    if (fontSize > maxFont) {
      fontSize = maxFont;
      els.fontSize.value = String(fontSize);
      syncScaleFromFontPx();
    }
    if (w > MAX_EDGE || h > MAX_EDGE) {
      showToast(
        "图片边长超过 " + MAX_EDGE + "px，请缩小后再试",
        "error"
      );
      return;
    }

    const sliceH = Math.min(subtitleHeight, h);
    const outH = h + lines.length * sliceH;
    if (w > MAX_EDGE || outH > MAX_EDGE * 2) {
      showToast("生成结果过高，请减少字幕行数或换较小的图", "error");
      return;
    }

    try {
      const canvas = renderSubtitleCanvas(loadedImage, {
        subtitleHeight: subtitleHeight,
        fontSize: fontSize,
        fontColor: els.fontColor.value,
        outlineColor: els.outlineColor.value,
        fontFamilyKey: els.fontFamily.value,
        fontWeight: els.fontWeight.value,
        fancyStyle: getSelectedFancyStyle(),
        lines: lines,
      });
      lastExportCanvas = canvas;
      copyCanvasToPreview(canvas);
      hasOutput = true;
      els.btnSave.disabled = false;
      showToast("字幕图片生成成功!", "success");
    } catch (e) {
      lastExportCanvas = null;
      hasOutput = false;
      els.btnSave.disabled = true;
      showToast(e.message || "生成失败", "error");
    }
  });

  els.btnSave.addEventListener("click", function () {
    if (!hasOutput || !lastExportCanvas) {
      showToast("请先生成字幕图片", "error");
      return;
    }

    lastExportCanvas.toBlob(
      function (blob) {
        if (!blob) {
          showToast("导出失败", "error");
          return;
        }
        const a = document.createElement("a");
        const stamp = new Date()
          .toISOString()
          .replace(/[:.]/g, "-")
          .slice(0, 19);
        a.download = "subtitle-" + stamp + ".png";
        a.href = URL.createObjectURL(blob);
        a.click();
        URL.revokeObjectURL(a.href);
        showToast("图片已保存", "success");
      },
      "image/png",
      1
    );
  });

  if (els.fontSizeScale) {
    els.fontSizeScale.addEventListener("input", syncFontPxFromScale);
  }
  if (els.subtitleHeight) {
    els.subtitleHeight.addEventListener("input", function () {
      syncFontPxFromScale();
      if (loadedImage) {
        var sh = parseInt(els.subtitleHeight.value, 10);
        if (!Number.isNaN(sh)) {
          updateSubtitleHeightHint(
            loadedImage.naturalWidth,
            loadedImage.naturalHeight,
            Math.min(sh, loadedImage.naturalHeight)
          );
        }
      }
    });
  }
  if (els.fontSize) {
    els.fontSize.addEventListener("input", syncScaleFromFontPx);
  }
  syncFontPxFromScale();

  var fancyGrid = document.getElementById("fancy-grid");
  if (fancyGrid) {
    fancyGrid.addEventListener("click", function (e) {
      var btn = e.target && e.target.closest && e.target.closest(".fancy-tile");
      if (!btn || !fancyGrid.contains(btn)) return;
      fancyGrid.querySelectorAll(".fancy-tile").forEach(function (b) {
        b.classList.remove("selected");
        b.setAttribute("aria-selected", "false");
      });
      btn.classList.add("selected");
      btn.setAttribute("aria-selected", "true");
      fancyGrid.setAttribute("aria-activedescendant", btn.id || "fancy-classic");
    });
  }
})();
