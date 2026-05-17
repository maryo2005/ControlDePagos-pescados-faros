import { store } from '../store.js';
import { showToast, showSaveIndicator } from '../main.js';

// =============================================
// REGISTRO VIEW - Ingreso de pedidos/despachos
// =============================================

let debounceTimers = {};

export function renderRegistro(container) {
  const faros = store.faros;
  const productos = store.productos;
  const currentFaro = faros[store.currentFaroIndex];

  if (!currentFaro) {
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

    <div class="tabs" id="faro-tabs">
      ${faros.map((f, i) => `
        <button class="tab ${i === store.currentFaroIndex ? 'active' : ''}" data-faro="${i}">
          ${f.nombre}
        </button>
      `).join('')}
    </div>

    <div class="product-list" id="product-list">
      ${productos.map(prod => {
        const reg = store.getRegistro(currentFaro.id, prod.id);
        const pedido = reg ? parseFloat(reg.pedido_kg) || '' : '';
        const despacho = reg ? parseFloat(reg.despacho_kg) || '' : '';
        const precio = reg ? parseFloat(reg.precio_kg) || '' : '';
        const hasData = pedido || despacho;
        const missingPrice = despacho && !precio;

        return `
          <div class="product-row ${hasData ? 'has-data' : ''} ${missingPrice ? 'missing-price' : ''}" 
               style="${hasData ? `border-left-color: ${faroColors[store.currentFaroIndex]}` : ''}">
            <div class="product-name">${prod.nombre} ${missingPrice ? '⚠️' : ''}</div>
            <div class="product-inputs">
              <div class="input-group">
                <label class="input-label">Pedido</label>
                <input type="number" class="input-field" inputmode="decimal" step="0.1" min="0"
                  placeholder="0" value="${pedido}"
                  data-faro="${currentFaro.id}" data-prod="${prod.id}" data-field="pedido_kg">
              </div>
              <div class="input-group">
                <label class="input-label">Despacho</label>
                <input type="number" class="input-field" inputmode="decimal" step="0.1" min="0"
                  placeholder="0" value="${despacho}"
                  data-faro="${currentFaro.id}" data-prod="${prod.id}" data-field="despacho_kg">
              </div>
              <div class="input-group">
                <label class="input-label">Precio S/</label>
                <input type="number" class="input-field precio" inputmode="decimal" step="0.5" min="0"
                  placeholder="0" value="${precio}"
                  data-faro="${currentFaro.id}" data-prod="${prod.id}" data-field="precio_kg">
              </div>
            </div>
          </div>
        `;
      }).join('')}
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
    const timerKey = `${faro}-${prod}-${field}`;

    clearTimeout(debounceTimers[timerKey]);
    debounceTimers[timerKey] = setTimeout(async () => {
      await store.upsertRegistro(store.currentDate, faro, prod, field, value);

      // If price changed, sync across all faros
      if (field === 'precio_kg') {
        await store.syncPrecio(store.currentDate, prod, value);
      }

      showSaveIndicator();

      // Update visual state of the row
      const row = input.closest('.product-row');
      const inputs = row.querySelectorAll('.input-field');
      const pedidoVal = parseFloat(inputs[0].value) || 0;
      const despachoVal = parseFloat(inputs[1].value) || 0;
      const precioVal = parseFloat(inputs[2].value) || 0;

      row.classList.toggle('has-data', pedidoVal > 0 || despachoVal > 0);
      row.classList.toggle('missing-price', despachoVal > 0 && precioVal === 0);
      if (pedidoVal > 0 || despachoVal > 0) {
        row.style.borderLeftColor = faroColors[store.currentFaroIndex];
      } else {
        row.style.borderLeftColor = '';
      }

      const nameEl = row.querySelector('.product-name');
      const baseName = nameEl.textContent.replace(' ⚠️', '').trim();
      nameEl.textContent = (despachoVal > 0 && precioVal === 0) ? baseName + ' ⚠️' : baseName;
    }, 400);
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
