import { store } from '../store.js';
import { showToast, showSaveIndicator } from '../main.js';

// =============================================
// REGISTRO VIEW - Ingreso de precios y cantidades
// =============================================

let debounceTimers = {};

export function renderRegistro(container) {
  const faros = store.faros;
  const productos = store.productos;

  // Si no hay faroIndex definido, inicializar a -2 (Precios Diarios) para guiar el flujo normal
  if (store.currentFaroIndex === undefined || store.currentFaroIndex === null) {
    store.currentFaroIndex = -2;
  }

  const isPreciosTab = store.currentFaroIndex === -2;
  const currentFaro = isPreciosTab ? null : faros[store.currentFaroIndex];

  if (!isPreciosTab && !currentFaro) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-text">No hay faros configurados</div></div>';
    return;
  }

  const faroColors = ['var(--faro-1)', 'var(--faro-2)', 'var(--faro-3)'];

  container.innerHTML = `
    <div class="date-section">
      <div class="date-input-wrapper">
        <label class="date-label">📅 Fecha</label>
        <input type="date" class="date-input" id="reg-date" value="${store.currentDate}">
      </div>
    </div>

    <div class="tabs" id="faro-tabs" style="display: flex; flex-wrap: nowrap; overflow-x: auto; gap: 6px;">
      <button class="tab ${isPreciosTab ? 'active' : ''}" data-faro="-2" 
              style="min-width: 120px; font-weight: 700; ${isPreciosTab ? 'border-color: var(--warning); background: rgba(245,158,11,0.1); color: var(--warning); box-shadow: 0 4px 16px rgba(245,158,11,0.25);' : ''}">
        💰 Precios Diarios
      </button>
      ${faros.map((f, i) => `
        <button class="tab ${i === store.currentFaroIndex ? 'active' : ''}" data-faro="${i}">
          ${f.nombre}
        </button>
      `).join('')}
    </div>

    <div class="product-list" id="product-list">
      ${isPreciosTab ? renderPreciosTab(productos) : renderFaroTab(currentFaro, productos, faroColors)}
    </div>

    <div class="add-product-row">
      <input type="text" class="input-field" id="new-product-name" placeholder="Nuevo producto...">
      <button class="btn btn-primary btn-small" id="btn-add-product">+ Agregar</button>
    </div>
  `;

  // --- Event: Change date ---
  document.getElementById('reg-date').addEventListener('change', async (e) => {
    await store.loadRegistros(e.target.value);
    renderRegistro(container);
  });

  // --- Event: Switch faro tabs ---
  document.getElementById('faro-tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    store.currentFaroIndex = parseInt(tab.dataset.faro);
    renderRegistro(container);
  });

  // --- Event: Input change (debounced auto-save) ---
  document.getElementById('product-list').addEventListener('input', (e) => {
    const input = e.target;
    if (!input.classList.contains('input-field')) return;

    const { faro, prod, field } = input.dataset;
    const value = input.value;

    if (field === 'precio_kg') {
      // Edición de precio diario (se sincroniza con todos los faros)
      const timerKey = `precio-${prod}`;
      clearTimeout(debounceTimers[timerKey]);
      debounceTimers[timerKey] = setTimeout(async () => {
        await store.syncPrecio(store.currentDate, prod, value);
        showSaveIndicator();
      }, 450);
    } else {
      // Edición de cantidades de un Faro específico
      const timerKey = `${faro}-${prod}-${field}`;
      clearTimeout(debounceTimers[timerKey]);
      debounceTimers[timerKey] = setTimeout(async () => {
        await store.upsertRegistro(store.currentDate, faro, prod, field, value);
        showSaveIndicator();

        // Actualizar estado visual de la fila
        const row = input.closest('.product-row');
        const inputs = row.querySelectorAll('.input-field');
        const pedidoVal = parseFloat(inputs[0].value) || 0;
        const despachoVal = parseFloat(inputs[1].value) || 0;
        const pesoRealVal = parseFloat(inputs[2].value) || 0;

        const hasData = pedidoVal > 0 || despachoVal > 0 || pesoRealVal > 0;
        row.classList.toggle('has-data', hasData);
        if (hasData) {
          row.style.borderLeftColor = faroColors[store.currentFaroIndex];
        } else {
          row.style.borderLeftColor = '';
        }
      }, 450);
    }
  });

  // --- Event: Add product ---
  document.getElementById('btn-add-product').addEventListener('click', async () => {
    const nameInput = document.getElementById('new-product-name');
    const name = nameInput.value.trim();
    if (!name) return;
    const result = await store.addProducto(name);
    if (result) {
      showToast(`"${name}" agregado ✓`);
      renderRegistro(container);
    }
  });
}

// Sub-render para la pestaña de Precios Diarios
function renderPreciosTab(productos) {
  return productos.map(prod => {
    // Buscar precio registrado en cualquier faro para este día (ya que están sincronizados)
    const reg = store.registros.find(r => r.producto_id === prod.id);
    const precio = reg ? parseFloat(reg.precio_kg) || '' : '';

    return `
      <div class="product-row has-data" style="border-left: 4px solid var(--warning); display: flex; align-items: center; justify-content: space-between; padding: 16px;">
        <div class="product-name" style="margin: 0; font-size: 0.95rem; font-weight: 600;">
          🐟 ${prod.nombre}
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500;">Precio del día:</span>
          <div style="position: relative; width: 110px;">
            <span style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); font-size: 0.88rem; color: var(--warning); font-weight: 600;">S/</span>
            <input type="number" class="input-field" inputmode="decimal" step="0.1" min="0"
              placeholder="0.00" value="${precio}"
              style="padding-left: 28px; text-align: left; color: var(--warning); font-weight: 700; border-color: rgba(245,158,11,0.25);"
              data-prod="${prod.id}" data-field="precio_kg">
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Sub-render para la pestaña de un Faro específico
function renderFaroTab(currentFaro, productos, faroColors) {
  return productos.map(prod => {
    const reg = store.getRegistro(currentFaro.id, prod.id);
    const pedido = reg ? parseFloat(reg.pedido_kg) || '' : '';
    const despacho = reg ? parseFloat(reg.despacho_kg) || '' : '';
    const pesoReal = reg ? parseFloat(reg.peso_real_kg) || '' : '';
    const precio = reg ? parseFloat(reg.precio_kg) || 0 : 0;

    const hasData = pedido || despacho || pesoReal;

    return `
      <div class="product-row ${hasData ? 'has-data' : ''}" 
           style="${hasData ? `border-left-color: ${faroColors[store.currentFaroIndex]}` : ''}">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <div class="product-name" style="margin: 0;">${prod.nombre}</div>
          ${precio > 0 ? `
            <span style="font-size: 0.72rem; font-weight: 600; color: var(--warning); background: rgba(245,158,11,0.08); padding: 2px 8px; border-radius: 20px; border: 1px solid rgba(245,158,11,0.2);">
              S/ ${precio.toFixed(2)} /kg
            </span>
          ` : `
            <span style="font-size: 0.68rem; font-weight: 500; color: var(--text-muted); font-style: italic;">
              Sin precio asignado
            </span>
          `}
        </div>
        <div class="product-inputs" style="grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
          <div class="input-group">
            <label class="input-label">Pedido</label>
            <input type="number" class="input-field" inputmode="decimal" step="0.1" min="0"
              placeholder="0" value="${pedido}"
              data-faro="${currentFaro.id}" data-prod="${prod.id}" data-field="pedido_kg">
          </div>
          <div class="input-group">
            <label class="input-label">Entregado</label>
            <input type="number" class="input-field" inputmode="decimal" step="0.1" min="0"
              placeholder="0" value="${despacho}"
              data-faro="${currentFaro.id}" data-prod="${prod.id}" data-field="despacho_kg">
          </div>
          <div class="input-group">
            <label class="input-label">Peso Real (Rest.)</label>
            <input type="number" class="input-field" inputmode="decimal" step="0.1" min="0"
              placeholder="0" value="${pesoReal}"
              style="color: #60a5fa; border-color: rgba(96,165,250,0.2);"
              data-faro="${currentFaro.id}" data-prod="${prod.id}" data-field="peso_real_kg">
          </div>
        </div>
      </div>
    `;
  }).join('');
}

