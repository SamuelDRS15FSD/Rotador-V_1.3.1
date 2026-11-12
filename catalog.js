/* Rotador · interpretación de catálogos (texto de PDF / imagen / CSV). Sin dependencias, probable en Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RotCatalog = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const norm = (s) => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  /* Convierte los fragmentos de texto de pdf.js en líneas (de arriba abajo, de izquierda a derecha).
     Dos espacios entre fragmentos = salto de columna. */
  function itemsToLines(items) {
    const rows = [];
    items.forEach((it) => {
      if (!it || !it.str || !it.str.trim()) return;
      const x = it.transform[4], y = it.transform[5];
      let row = rows.find((r) => Math.abs(r.y - y) <= 3);
      if (!row) { row = { y: y, parts: [] }; rows.push(row); }
      row.parts.push({ x: x, w: it.width || 0, s: it.str });
    });
    rows.sort((a, b) => b.y - a.y);
    return rows.map((r) => {
      r.parts.sort((a, b) => a.x - b.x);
      let out = '', end = null;
      r.parts.forEach((p) => {
        if (end !== null) { const gap = p.x - end; out += gap > 12 ? '  ' : gap > 1.2 ? ' ' : ''; }
        out += p.s.trim(); end = p.x + p.w;
      });
      return out;
    }).join('\n');
  }

  const CODE_RE = /(?<![\d.,$])\d{3,14}(?![\d]|[.,]\d)/g;
  const MONEY_RE = /\$\s?[\d.,]+|\b\d{1,3}(?:[.,]\d{3})+(?:[.,]\d+)?\b|\b\d+[.,]\d{1,2}\b/g;
  const HEADER_RE = /^(c[oó]digo|codigo|nombre|producto|descripci[oó]n|descripcion|proveedor|precio|p[aá]gina|page|cat[aá]logo|plu|ean|item|art[ií]culo)\b/i;

  function pickCode(line) {
    const toks = line.match(CODE_RE) || [];
    if (!toks.length) return '';
    const long = toks.find((t) => t.length >= 8);
    return long || toks.find((t) => t.length <= 7) || toks[0];
  }

  function cleanName(line, code) {
    let s = line.replace(/[;|\t]+/g, '  ');
    if (code) s = s.replace(code, ' ');
    s = s.replace(MONEY_RE, ' ');
    s = s.replace(/\s{2,}\d+\s*$/, ' ');                    // última columna solo numérica (precio sin formato)
    s = s.replace(/^\s*\d{1,3}\s*[.)\-]\s+/, ' ');         // numeración "12. " o "12) "
    s = s.replace(/(^|\s)[$€]+(?=\s|$)/g, ' ');
    s = s.replace(/\s{2,}/g, ' ').replace(/^[\s\-–—.,:]+|[\s\-–—.,:]+$/g, '');
    return s.trim();
  }

  function parseText(text) {
    const lines = String(text || '').split(/\r?\n/);
    const rows = [], seenCode = new Set(), seenName = new Set();
    lines.forEach((raw) => {
      const line = raw.replace(/ /g, ' ').trim();
      if (line.length < 3) return;
      const code = pickCode(line);
      const name = cleanName(line, code);
      const letters = (name.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g) || []).length;
      if (letters < 3) return;
      if (HEADER_RE.test(name) && !code) return;
      if (HEADER_RE.test(name) && /^(c[oó]digo|nombre|producto|descripci)/i.test(name) && name.split(/\s+/).length <= 4) return;
      const nk = norm(name);
      if (code) { if (seenCode.has(code)) return; seenCode.add(code); }
      else { if (seenName.has(nk)) return; seenName.add(nk); }
      const unit = /\b(kg|kilo|kilos|granel)\b/i.test(name) ? 'kg' : 'und';
      rows.push({ code: code, name: name, unit: unit, checked: true });
    });
    // Si el documento sí trae códigos, las líneas sin código suelen ser títulos o ruido: quedan desmarcadas.
    const anyCode = rows.some((r) => r.code);
    if (anyCode) rows.forEach((r) => { if (!r.code) r.checked = false; });
    return rows;
  }

  return { itemsToLines, parseText, pickCode, cleanName };
});
