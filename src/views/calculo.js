import { store } from '../store.js';
import { showToast, showSaveIndicator } from '../main.js';

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

  // --- Función auxiliar para agregar una nota al historial ---
  const addNota = async (faroId) => {
    const input = container.querySelector(`.nota-pago[data-faro-id="${faroId}"]`);
    if (!input) return;
    const newNota = input.value.trim();
    if (newNota === '') return;

    const estado = store.getEstado(faroId);
    const currentNotes = estado.nota_pago ? estado.nota_pago.split('\n').filter(n => n.trim() !== '') : [];
    currentNotes.push(newNota);
    const combinedNota = currentNotes.join('\n');

    const montoInput = container.querySelector(`.monto-pago[data-faro-id="${faroId}"]`);
    const monto = montoInput ? parseFloat(montoInput.value) || 0 : 0;

    await store.togglePagado(store.currentDate, faroId, true, monto, combinedNota);
    input.value = ''; // Limpiar la caja de texto para otra nota
    showSaveIndicator();
    
    // Volver a renderizar para mostrar la nueva nota en el historial
    renderCalculo(container);

    // Mantener foco en el input para comodidad del usuario
    setTimeout(() => {
      const newInput = container.querySelector(`.nota-pago[data-faro-id="${faroId}"]`);
      if (newInput) newInput.focus();
    }, 50);
  };

  // --- Event: Enter key on nota input ---
  container.addEventListener('keydown', async (e) => {
    const input = e.target.closest('.nota-pago');
    if (!input || e.key !== 'Enter') return;
    e.preventDefault();
    const faroId = input.dataset.faroId;
    await addNota(faroId);
  });

  // --- Event: Click on ➕ button ---
  container.addEventListener('click', async (e) => {
    const btn = e.target.closest('.add-nota-btn');
    if (!btn) return;
    const faroId = btn.dataset.faroId;
    await addNota(faroId);
  });

  // --- Event: Delete nota ---
  container.addEventListener('click', async (e) => {
    const deleteBtn = e.target.closest('.delete-nota-btn');
    if (!deleteBtn) return;
    
    const faroId = deleteBtn.dataset.faroId;
    const indexToDelete = parseInt(deleteBtn.dataset.index);
    
    const estado = store.getEstado(faroId);
    const currentNotes = estado.nota_pago ? estado.nota_pago.split('\n').filter(n => n.trim() !== '') : [];
    
    if (indexToDelete >= 0 && indexToDelete < currentNotes.length) {
      currentNotes.splice(indexToDelete, 1);
      const combinedNota = currentNotes.join('\n');
      
      const montoInput = container.querySelector(`.monto-pago[data-faro-id="${faroId}"]`);
      const monto = montoInput ? parseFloat(montoInput.value) || 0 : 0;
      
      await store.togglePagado(store.currentDate, faroId, estado.pagado, monto, combinedNota);
      showSaveIndicator();
      renderCalculo(container);
    }
  });

  // --- Event: Activar pago automáticamente al hacer clic/enfocar en los inputs ---
  container.addEventListener('focusin', async (e) => {
    const input = e.target.closest('.monto-pago, .nota-pago');
    if (!input) return;
    const faroId = input.dataset.faroId;
    const estado = store.getEstado(faroId);
    
    // Si no está registrado como pagado, activarlo automáticamente
    if (!estado.pagado) {
      const currentMontoInput = container.querySelector(`.monto-pago[data-faro-id="${faroId}"]`);
      const currentNotaInput = container.querySelector(`.nota-pago[data-faro-id="${faroId}"]`);
      const monto = currentMontoInput ? parseFloat(currentMontoInput.value) || 0 : 0;
      const nota = currentNotaInput ? currentNotaInput.value : '';
      
      await store.togglePagado(store.currentDate, faroId, true, monto, estado.nota_pago);
      
      // Actualizar visualmente la palanca (toggle) a activo
      const togglePago = container.querySelector(`.toggle-pago[data-faro-id="${faroId}"]`);
      if (togglePago) {
        togglePago.classList.add('active');
        const detailEl = togglePago.closest('.estado-row').querySelector('.estado-detail');
        if (detailEl) {
          const updatedEstado = store.getEstado(faroId);
          detailEl.textContent = updatedEstado.fecha_pago ? 'Registrado: ' + formatShortDate(updatedEstado.fecha_pago) : 'Registrado: Ahora';
        }
      }
    }
  });

  // --- Event: Update monto pagado en tiempo real ---
  let saveTimer;
  container.addEventListener('input', (e) => {
    const montoInput = e.target.closest('.monto-pago');
    if (!montoInput) return;

    const faroId = montoInput.dataset.faroId;

    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      const currentMontoInput = container.querySelector(`.monto-pago[data-faro-id="${faroId}"]`);
      const monto = currentMontoInput ? parseFloat(currentMontoInput.value) || 0 : 0;
      
      const estado = store.getEstado(faroId);
      
      // Al escribir monto, se asume que se está especificando el pago, por lo tanto pagado = true
      const pagado = true;
      
      await store.togglePagado(store.currentDate, faroId, pagado, monto, estado.nota_pago);
      showSaveIndicator();

      // Asegurar que el switch se mantenga o pase a activo visualmente
      const togglePago = container.querySelector(`.toggle-pago[data-faro-id="${faroId}"]`);
      if (togglePago) {
        togglePago.classList.add('active');
        const detailEl = togglePago.closest('.estado-row').querySelector('.estado-detail');
        if (detailEl) {
          const updatedEstado = store.getEstado(faroId);
          detailEl.textContent = updatedEstado.fecha_pago ? 'Registrado: ' + formatShortDate(updatedEstado.fecha_pago) : 'Registrado: Ahora';
        }
      }

      // Actualizar visualmente la diferencia del monto
      const faroIndex = store.faros.findIndex(f => f.id === faroId);
      if (faroIndex >= 0) {
        const calculo = store.getCalculoForFaro(faroId);
        const diffEl = container.querySelector(`.monto-diff-display[data-faro-id="${faroId}"]`);
        if (diffEl && monto > 0) {
          const diff = monto - calculo.total;
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
        } else if (diffEl) {
          diffEl.style.display = 'none';
        }
      }
    }, 600);
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

  // Separar las notas por saltos de línea para renderizar cada una por separado
  const notesList = estado.nota_pago ? estado.nota_pago.split('\n').filter(n => n.trim() !== '') : [];
  let notesHtml = '';
  if (notesList.length > 0) {
    notesHtml = `
      <div class="notas-lista-container" data-faro-id="${faro.id}" style="margin-top: 8px; display: flex; flex-direction: column; gap: 6px;">
        ${notesList.map((n, index) => `
          <div class="nota-item" data-index="${index}" style="display: flex; align-items: center; justify-content: space-between; font-size: 0.78rem; padding: 6px 10px; background: rgba(16, 185, 129, 0.06); border-radius: var(--radius-xs); border: 1px solid rgba(16, 185, 129, 0.15); transition: var(--transition);">
            <span style="color: var(--text-primary); word-break: break-all; flex: 1; text-align: left;">📌 ${n}</span>
            <button class="delete-nota-btn" data-faro-id="${faro.id}" data-index="${index}" style="background: none; border: none; color: var(--danger); cursor: pointer; padding: 2px 6px; font-size: 0.85rem; font-weight: bold; transition: var(--transition); -webkit-tap-highlight-color: transparent;">✕</button>
          </div>
        `).join('')}
      </div>
    `;
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
        
        <div style="position: relative; display: flex; gap: 8px; margin-top: 6px; width: 100%;">
          <input type="text" class="estado-nota-input nota-pago" data-faro-id="${faro.id}"
            placeholder="Agregar nota (ej. Op. 4392 / Yape de S/ 180...)"
            style="margin-top: 0; flex: 1; padding-right: 10px;">
          <button class="btn btn-primary add-nota-btn" data-faro-id="${faro.id}" 
                  style="width: auto; padding: 10px 14px; border-radius: var(--radius-xs); flex-shrink: 0; margin-top: 0; font-size: 0.8rem;">
            ➕
          </button>
        </div>
        
        <!-- Lista de notas guardadas -->
        ${notesHtml}

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
        ${calculo.items.map(item => {
          const qty = item.tienePesoReal ? item.peso_real_kg : item.despacho_kg;
          const labelQty = item.tienePesoReal 
            ? `${qty.toFixed(1)} kg <span style="font-size: 0.65rem; color: #60a5fa; font-weight: 600;">(Rest.)</span>`
            : `${qty.toFixed(1)} kg <span style="font-size: 0.65rem; color: var(--text-muted); font-weight: 500;">(Entr.)</span>`;

          return `
            <div class="calculo-row ${item.sinPrecio ? 'warning' : ''} ${item.usaPromedio ? 'promedio' : ''}">
              <span class="calculo-producto" style="display: flex; flex-direction: column;">
                <span style="font-weight: 600;">${item.nombre}</span>
                ${item.usaPromedio ? '<span style="font-size:0.65rem; color:#06b6d4;">~ usando promedio</span>' : ''}
              </span>
              <span class="calculo-qty">${labelQty}</span>
              <span class="calculo-x">×</span>
              <span class="calculo-price">${item.sinPrecio ? '⚠️ S/?' : (item.usaPromedio ? '<span style="color:#06b6d4">~S/' + item.precio_kg.toFixed(2) + '</span>' : 'S/' + item.precio_kg.toFixed(2))}</span>
              <span class="calculo-subtotal">${item.sinPrecio ? '---' : 'S/' + item.subtotal.toFixed(2)}</span>
            </div>
          `;
        }).join('')}
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
    const qtyVal = item.tienePesoReal ? item.peso_real_kg : item.despacho_kg;
    const suffix = item.tienePesoReal ? ' (Rest)' : ' (Entr)';
    const qty = `${qtyVal.toFixed(1)} kg${suffix}`.padStart(13);
    
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

