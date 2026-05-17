import { store } from '../store.js';
import { showToast } from '../main.js';

// =============================================
// CALCULO VIEW - Vista de factura/cálculo
// (Replica el formato de la hoja cuadriculada)
// =============================================

export function renderCalculo(container) {
  const faros = store.faros;

  container.innerHTML = `
    <div class="date-section">
      <div class="date-input-wrapper">
        <label class="date-label">📅 Fecha</label>
        <input type="date" class="date-input" id="calc-date" value="${store.currentDate}">
      </div>
    </div>

    <div class="tabs" id="calc-tabs">
      ${faros.map((f, i) => `
        <button class="tab ${i === store.currentFaroIndex ? 'active' : ''}" data-faro="${i}">
          ${f.nombre}
        </button>
      `).join('')}
      <button class="tab ${store.currentFaroIndex === -1 ? 'active' : ''}" data-faro="-1"
        style="${store.currentFaroIndex === -1 ? 'background: linear-gradient(135deg, var(--faro-1), var(--faro-2)); border-color: var(--faro-1);' : 'border-color: var(--text-muted);'}">
        Todos
      </button>
    </div>

    <div id="calculo-content">
      ${store.currentFaroIndex === -1 ? renderAllFaros(faros) : renderSingleFaro(faros[store.currentFaroIndex], store.currentFaroIndex)}
    </div>
  `;

  // --- Event: Change date ---
  document.getElementById('calc-date').addEventListener('change', async (e) => {
    await Promise.all([
      store.loadRegistros(e.target.value),
      store.loadEstados(e.target.value)
    ]);
    renderCalculo(container);
  });

  // --- Event: Switch tabs ---
  document.getElementById('calc-tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    store.currentFaroIndex = parseInt(tab.dataset.faro);
    renderCalculo(container);
  });

  // --- Event: Share buttons ---
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-share');
    if (!btn) return;
    const faroIndex = parseInt(btn.dataset.faroIndex);
    shareCalculo(faroIndex);
  });

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-copy');
    if (!btn) return;
    const faroIndex = parseInt(btn.dataset.faroIndex);
    copyCalculo(faroIndex);
  });

  // --- Event: Toggle pago ---
  container.addEventListener('click', async (e) => {
    const toggle = e.target.closest('.toggle-pago');
    if (!toggle) return;
    const faroId = toggle.dataset.faroId;
    const isActive = toggle.classList.contains('active');
    const montoInput = container.querySelector(`.monto-pago[data-faro-id="${faroId}"]`);
    const notaInput = container.querySelector(`.nota-pago[data-faro-id="${faroId}"]`);
    const monto = montoInput ? parseFloat(montoInput.value) || 0 : 0;
    const nota = notaInput ? notaInput.value : '';
    await store.togglePagado(store.currentDate, faroId, !isActive, monto, nota);
    showToast(!isActive ? 'Pago registrado ✓' : 'Pago desmarcado');
    renderCalculo(container);
  });

  // --- Event: Toggle envío factura ---
  container.addEventListener('click', async (e) => {
    const toggle = e.target.closest('.toggle-factura');
    if (!toggle) return;
    const faroId = toggle.dataset.faroId;
    const isActive = toggle.classList.contains('active');
    await store.toggleEnviadoFactura(store.currentDate, faroId, !isActive);
    showToast(!isActive ? 'Envío registrado ✓' : 'Envío desmarcado');
    renderCalculo(container);
  });

  // --- Event: Update monto pagado ---
  let montoTimer;
  container.addEventListener('input', (e) => {
    const input = e.target.closest('.monto-pago');
    if (!input) return;
    clearTimeout(montoTimer);
    montoTimer = setTimeout(async () => {
      const faroId = input.dataset.faroId;
      const estado = store.getEstado(faroId);
      await store.togglePagado(store.currentDate, faroId, estado.pagado, input.value, estado.nota_pago || '');
      // Update diff display
      const faroIndex = store.faros.findIndex(f => f.id === faroId);
      if (faroIndex >= 0) {
        const calculo = store.getCalculoForFaro(faroId);
        const montoPagado = parseFloat(input.value) || 0;
        const diffEl = container.querySelector(`.monto-diff-display[data-faro-id="${faroId}"]`);
        if (diffEl && montoPagado > 0) {
          const diff = montoPagado - calculo.total;
          if (Math.abs(diff) < 0.01) {
            diffEl.className = 'monto-diff match monto-diff-display';
            diffEl.setAttribute('data-faro-id', faroId);
            diffEl.textContent = '✓ Monto coincide con el total';
          } else {
            diffEl.className = 'monto-diff mismatch monto-diff-display';
            diffEl.setAttribute('data-faro-id', faroId);
            diffEl.textContent = `⚠️ Diferencia: S/ ${diff.toFixed(2)} (${diff > 0 ? 'pagó de más' : 'pagó de menos'})`;
          }
          diffEl.style.display = 'block';
        }
      }
    }, 500);
  });
}

function renderEstadoSection(faro, faroIndex, totalCalculado) {
  const estado = store.getEstado(faro.id);
  const montoPagado = parseFloat(estado.monto_pagado) || 0;
  const diff = montoPagado - totalCalculado;
  const hasMonto = montoPagado > 0;

  let diffHtml = '';
  if (estado.pagado && hasMonto) {
    if (Math.abs(diff) < 0.01) {
      diffHtml = `<div class="monto-diff match monto-diff-display" data-faro-id="${faro.id}">✓ Monto coincide con el total</div>`;
    } else {
      diffHtml = `<div class="monto-diff mismatch monto-diff-display" data-faro-id="${faro.id}">⚠️ Diferencia: S/ ${diff.toFixed(2)} (${diff > 0 ? 'pagó de más' : 'pagó de menos'})</div>`;
    }
  } else {
    diffHtml = `<div class="monto-diff-display" data-faro-id="${faro.id}" style="display:none;"></div>`;
  }

  return `
    <div class="estado-section">
      <!-- Pago -->
      <div class="estado-card">
        <div class="estado-row">
          <div class="estado-info">
            <span class="estado-label">💰 Pago Recibido</span>
            <span class="estado-detail">${estado.pagado && estado.fecha_pago ? 'Registrado: ' + formatShortDate(estado.fecha_pago) : 'Sin registrar'}</span>
          </div>
          <button class="estado-toggle toggle-pago ${estado.pagado ? 'active' : ''}" data-faro-id="${faro.id}"></button>
        </div>
        <input type="number" class="estado-monto-input monto-pago" data-faro-id="${faro.id}"
          placeholder="Monto de la transferencia (S/)" inputmode="decimal" step="0.01"
          value="${hasMonto ? montoPagado : ''}">
        <input type="text" class="estado-nota-input nota-pago" data-faro-id="${faro.id}"
          placeholder="Nota (ej: captura de yape, nro operación...)"
          value="${estado.nota_pago || ''}">
        ${diffHtml}
      </div>

      <!-- Envío de factura -->
      <div class="estado-card">
        <div class="estado-row">
          <div class="estado-info">
            <span class="estado-label">📄 Enviado para Factura</span>
            <span class="estado-detail">${estado.enviado_factura && estado.fecha_envio_factura ? 'Enviado: ' + formatShortDate(estado.fecha_envio_factura) : 'No enviado aún'}</span>
          </div>
          <button class="estado-toggle toggle-factura ${estado.enviado_factura ? 'active' : ''}" data-faro-id="${faro.id}"></button>
        </div>
      </div>
    </div>
  `;
}

function formatShortDate(dateStr) {
  const d = new Date(dateStr);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const hours = d.getHours().toString().padStart(2, '0');
  const mins = d.getMinutes().toString().padStart(2, '0');
  return `${day}/${month} ${hours}:${mins}`;
}

function renderSingleFaro(faro, faroIndex) {
  if (!faro) return '<div class="empty-state"><div class="empty-state-text">Selecciona un faro</div></div>';

  const calculo = store.getCalculoForFaro(faro.id);

  if (calculo.items.length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">📦</div>
        <div class="empty-state-text">No hay despachos registrados para ${faro.nombre} en esta fecha</div>
      </div>
    `;
  }

  return `
    <div class="calculo-card">
      <div class="calculo-header faro-${faroIndex}">
        ${faro.nombre}
        ${faro.ruc ? `<br><span style="font-size:0.72rem; font-weight:400; opacity:0.7;">RUC: ${faro.ruc}</span>` : ''}
        <div class="calculo-date">${formatDateLong(store.currentDate)}</div>
      </div>
      <div class="calculo-body">
        ${calculo.items.map(item => `
          <div class="calculo-row ${item.sinPrecio ? 'warning' : ''} ${item.usaPromedio ? 'promedio' : ''}">
            <span class="calculo-producto">${item.nombre}${item.usaPromedio ? ' <span style="font-size:0.65rem; color:#06b6d4;">~prom</span>' : ''}</span>
            <span class="calculo-qty">${item.despacho_kg} kg</span>
            <span class="calculo-x">×</span>
            <span class="calculo-price">${item.sinPrecio ? '⚠️ S/?' : (item.usaPromedio ? '<span style="color:#06b6d4">~S/' + item.precio_kg.toFixed(2) + '</span>' : 'S/' + item.precio_kg.toFixed(2))}</span>
            <span class="calculo-subtotal">${item.sinPrecio ? '---' : 'S/' + item.subtotal.toFixed(2)}</span>
          </div>
        `).join('')}
      </div>
      <div class="calculo-divider"></div>
      <div class="calculo-total-row">
        <span class="calculo-total-label">Total</span>
        <span class="calculo-total-value faro-${faroIndex}">S/ ${calculo.total.toFixed(2)}</span>
      </div>
    </div>

    ${calculo.tienePromedios ? `
      <div class="warning-badge" style="display: flex; margin-bottom: 8px; background: rgba(6,182,212,0.15); border-color: rgba(6,182,212,0.3); color: #06b6d4;">
        📊 Los precios marcados con ~ son promedios históricos (falta precio del día)
      </div>
    ` : ''}
    ${calculo.tienePreciosFaltantes ? `
      <div class="warning-badge" style="display: flex; margin-bottom: 12px;">
        ⚠️ Hay productos sin precio y sin historial — no se pueden calcular
      </div>
    ` : ''}

    <div class="btn-row">
      <button class="btn btn-share" data-faro-index="${faroIndex}">
        📤 Compartir
      </button>
      <button class="btn btn-secondary btn-copy" data-faro-index="${faroIndex}">
        📋 Copiar
      </button>
    </div>

    ${renderEstadoSection(faro, faroIndex, calculo.total)}
  `;
}

function renderAllFaros(faros) {
  const resumen = store.getResumenDia();
  const granTotal = resumen.reduce((sum, r) => sum + r.total, 0);

  let html = '';

  resumen.forEach((r, i) => {
    if (r.items.length > 0) {
      html += renderSingleFaro(r.faro, i);
      html += '<div style="height: 16px;"></div>';
    }
  });

  html += `
    <div class="gran-total-card">
      <div class="gran-total-label">Gran Total del Día</div>
      <div class="gran-total-value">S/ ${granTotal.toFixed(2)}</div>
    </div>
  `;

  if (html.indexOf('calculo-card') === -1) {
    html = `
      <div class="empty-state">
        <div class="empty-state-icon">📦</div>
        <div class="empty-state-text">No hay despachos registrados para esta fecha</div>
      </div>
    `;
  }

  return html;
}

// --- Generar texto para compartir ---
function generateShareText(faroIndex) {
  const faro = store.faros[faroIndex];
  const calculo = store.getCalculoForFaro(faro.id);

  let text = `═══════════════════\n`;
  text += `${faro.nombre}\n`;
  if (faro.ruc) text += `RUC: ${faro.ruc}\n`;
  text += `Fecha: ${formatDateLong(store.currentDate)}\n`;
  text += `═══════════════════\n\n`;

  calculo.items.forEach(item => {
    const nombre = item.nombre.padEnd(14);
    const qty = `${item.despacho_kg} kg`.padStart(7);
    let price, sub;
    if (item.sinPrecio) {
      price = '  S/???  ';
      sub = '    ---';
    } else if (item.usaPromedio) {
      price = `~S/${item.precio_kg.toFixed(2)}`.padStart(9);
      sub = `S/${item.subtotal.toFixed(2)}`.padStart(10);
    } else {
      price = `S/${item.precio_kg.toFixed(2)}`.padStart(9);
      sub = `S/${item.subtotal.toFixed(2)}`.padStart(10);
    }
    text += `${nombre} ${qty} × ${price} = ${sub}\n`;
  });

  text += `───────────────────\n`;
  text += `TOTAL: S/ ${calculo.total.toFixed(2)}\n`;
  text += `═══════════════════`;

  return text;
}

function shareCalculo(faroIndex) {
  const text = generateShareText(faroIndex);

  if (navigator.share) {
    navigator.share({
      title: `${store.faros[faroIndex].nombre} - ${store.currentDate}`,
      text: text
    }).catch(() => {});
  } else {
    // Fallback: open WhatsApp
    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  }
}

function copyCalculo(faroIndex) {
  const text = generateShareText(faroIndex);
  navigator.clipboard.writeText(text).then(() => {
    showToast('Copiado al portapapeles ✓');
  }).catch(() => {
    // Fallback
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showToast('Copiado ✓');
  });
}

function formatDateLong(dateStr) {
  const [y, m, d] = dateStr.split('-');
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return `${parseInt(d)} de ${months[parseInt(m) - 1]} ${y}`;
}
