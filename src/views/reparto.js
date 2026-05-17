import { store } from '../store.js';

// =============================================
// REPARTO VIEW - Guía de Distribución/Reparto
// =============================================

export function renderReparto(container) {
  const faros = store.faros;
  const productos = store.productos;

  // Calcular totales por producto y por faro para la fecha seleccionada
  const { totalPorProducto, repartoPorFaro, totalGlobalPedidos } = getRepartoCalculations();

  container.innerHTML = `
    <div class="date-section">
      <div class="date-input-wrapper">
        <label class="date-label">📅 Fecha de Reparto</label>
        <input type="date" class="date-input" id="reparto-date" value="${store.currentDate}">
      </div>
    </div>

    <div class="gran-total-card" style="background: linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(16, 185, 129, 0.08)); border-color: rgba(59, 130, 246, 0.2);">
      <div class="gran-total-label">Total Pedido a Repartir</div>
      <div class="gran-total-value" style="background: linear-gradient(135deg, #60a5fa, #34d399); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
        ${totalGlobalPedidos.toFixed(1)} kg
      </div>
    </div>

    <!-- Pestañas de Tipo de Consulta -->
    <div class="tabs" id="reparto-subtabs" style="margin-bottom: 20px; display: flex; gap: 6px;">
      <button class="tab active" data-subtab="productos" style="flex: 1; font-weight: 600;">
        📦 Por Producto
      </button>
      <button class="tab" data-subtab="faros" style="flex: 1; font-weight: 600;">
        🚚 Por Faro / Cliente
      </button>
    </div>

    <!-- Contenedor dinámico de reparto -->
    <div id="reparto-view-content">
      ${renderPorProductoView(totalPorProducto)}
    </div>
  `;

  // --- Event: Change date ---
  document.getElementById('reparto-date').addEventListener('change', async (e) => {
    store.currentDate = e.target.value;
    const loadingEl = document.createElement('div');
    loadingEl.className = 'loading';
    loadingEl.innerHTML = '<div class="spinner"></div>';
    container.prepend(loadingEl);

    await Promise.all([
      store.loadRegistros(store.currentDate),
      store.loadEstados(store.currentDate)
    ]);
    renderReparto(container);
  });

  // --- Event: Switch Sub-tabs ---
  let activeSubtab = 'productos';
  document.getElementById('reparto-subtabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (!tab) return;

    // Toggle active state
    container.querySelectorAll('#reparto-subtabs .tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    activeSubtab = tab.dataset.subtab;
    const contentEl = document.getElementById('reparto-view-content');

    if (activeSubtab === 'productos') {
      contentEl.innerHTML = renderPorProductoView(totalPorProducto);
    } else {
      contentEl.innerHTML = renderPorFarosView(repartoPorFaro);
    }
  });
}

// Lógica para agrupar y calcular pedidos del día
function getRepartoCalculations() {
  const faros = store.faros;
  const productos = store.productos;
  const registros = store.registros;

  const totalPorProducto = [];
  const repartoPorFaro = faros.map(f => ({ faro: f, items: [], totalKg: 0 }));
  let totalGlobalPedidos = 0;

  productos.forEach(prod => {
    let sumProducto = 0;
    const desglose = [];

    faros.forEach((faro, fIndex) => {
      const reg = store.getRegistro(faro.id, prod.id);
      const pedidoKg = reg ? parseFloat(reg.pedido_kg) || 0 : 0;

      if (pedidoKg > 0) {
        sumProducto += pedidoKg;
        totalGlobalPedidos += pedidoKg;
        desglose.push({
          faroNombre: faro.nombre,
          faroColor: faro.color,
          faroIndex: fIndex,
          cantidad: pedidoKg
        });

        // Asignar al desglose del Faro
        repartoPorFaro[fIndex].items.push({
          prodNombre: prod.nombre,
          cantidad: pedidoKg
        });
        repartoPorFaro[fIndex].totalKg += pedidoKg;
      }
    });

    if (sumProducto > 0) {
      totalPorProducto.push({
        producto: prod,
        total: sumProducto,
        desglose
      });
    }
  });

  return { totalPorProducto, repartoPorFaro, totalGlobalPedidos };
}

// Vista organizada agrupada por Producto (Total consolidado de pescado a preparar)
function renderPorProductoView(totalPorProducto) {
  if (totalPorProducto.length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">🐟</div>
        <div class="empty-state-text">No hay pedidos registrados para esta fecha.</div>
      </div>
    `;
  }

  return `
    <div style="display: flex; flex-direction: column; gap: 12px;">
      ${totalPorProducto.map(item => `
        <div class="card" style="padding: 16px; border-left: 4px solid var(--warning); background: var(--bg-card);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid var(--border); padding-bottom: 8px;">
            <span style="font-weight: 700; font-size: 1.05rem; color: var(--text-primary);">
              🐟 ${item.producto.nombre}
            </span>
            <span style="font-weight: 800; font-size: 1.15rem; color: var(--warning);">
              ${item.total.toFixed(1)} kg
            </span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            ${item.desglose.map(d => `
              <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.88rem; padding: 4px 0;">
                <span style="display: flex; align-items: center; gap: 8px; color: var(--text-secondary);">
                  <span style="width: 8px; height: 8px; border-radius: 50%; background-color: ${d.faroColor};"></span>
                  ${d.faroNombre}
                </span>
                <span style="font-weight: 700; color: var(--text-primary); font-size: 0.92rem;">
                  ${d.cantidad.toFixed(1)} kg
                </span>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// Vista organizada agrupada por Faro (Lo que lleva cada repartidor a cada restaurante)
function renderPorFarosView(repartoPorFaro) {
  const farosActivos = repartoPorFaro.filter(rf => rf.items.length > 0);

  if (farosActivos.length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">🚚</div>
        <div class="empty-state-text">No hay pedidos asignados a ningún Faro.</div>
      </div>
    `;
  }

  return `
    <div style="display: flex; flex-direction: column; gap: 16px;">
      ${farosActivos.map(rf => `
        <div class="card" style="padding: 0; overflow: hidden; border-left: 4px solid ${rf.faro.color}; background: var(--bg-card);">
          <div style="padding: 14px 18px; background: rgba(255,255,255,0.02); border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: 700; font-size: 1.05rem; color: ${rf.faro.color};">
              🏢 ${rf.faro.nombre}
            </span>
            <span style="font-weight: 800; font-size: 1.1rem; color: var(--text-primary);">
              ${rf.totalKg.toFixed(1)} kg totales
            </span>
          </div>
          <div style="padding: 8px 18px 16px 18px; display: flex; flex-direction: column;">
            ${rf.items.map(item => `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.03);">
                <span style="font-size: 0.9rem; color: var(--text-secondary); font-weight: 500;">
                  🐟 ${item.prodNombre}
                </span>
                <span style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary);">
                  ${item.cantidad.toFixed(1)} kg
                </span>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}
