import { store } from '../store.js';

// =============================================
// HOME VIEW - Pantalla principal
// =============================================

export function renderHome(container) {
  const resumen = store.getResumenDia();
  const granTotal = resumen.reduce((sum, r) => sum + r.total, 0);

  container.innerHTML = `
    <div class="welcome-section">
      <div class="welcome-icon">🐟</div>
      <h2 class="welcome-title">Control de Pagos</h2>
      <p class="welcome-sub">Pescados y Mariscos</p>
    </div>

    <div class="date-section">
      <div class="date-input-wrapper">
        <label class="date-label">📅 Fecha del Registro</label>
        <input type="date" class="date-input" id="home-date" value="${store.currentDate}">
      </div>
    </div>

    <div class="gran-total-card">
      <div class="gran-total-label">Total del Día</div>
      <div class="gran-total-value">S/ ${granTotal.toFixed(2)}</div>
    </div>

    <div class="faro-summary-grid">
      ${resumen.map((r, i) => `
        <div class="faro-summary-card faro-${i}" data-faro-index="${i}">
          <div class="faro-summary-info">
            <div class="faro-summary-name">${r.faro.nombre}</div>
            <div class="faro-summary-items">${r.items.length} productos despachados</div>
            ${r.tienePreciosFaltantes ? '<div class="warning-badge">⚠️ Faltan precios</div>' : ''}
          </div>
          <div class="faro-summary-total faro-${i}">S/ ${r.total.toFixed(2)}</div>
        </div>
      `).join('')}
    </div>

    <button class="btn btn-primary" id="btn-go-registro">
      📋 Registrar Pedidos
    </button>

    <div style="height: 12px;"></div>

    <button class="btn btn-secondary" id="btn-go-historial">
      📅 Ver Historial
    </button>

    <div id="historial-section" style="display:none; margin-top: 20px;">
      <label class="date-label">Días con registros</label>
      <div class="historial-list" id="historial-list">
        <div class="loading"><div class="spinner"></div></div>
      </div>
    </div>
  `;

  // --- Event Listeners ---
  document.getElementById('home-date').addEventListener('change', async (e) => {
    const loadingEl = document.createElement('div');
    loadingEl.className = 'loading';
    loadingEl.innerHTML = '<div class="spinner"></div>';
    container.prepend(loadingEl);
    await store.loadRegistros(e.target.value);
    renderHome(container);
  });

  document.getElementById('btn-go-registro').addEventListener('click', () => {
    document.querySelector('[data-view="registro"]').click();
  });

  document.getElementById('btn-go-historial').addEventListener('click', async () => {
    const section = document.getElementById('historial-section');
    if (section.style.display === 'none') {
      section.style.display = 'block';
      const fechas = await store.getFechasConRegistros();
      const listEl = document.getElementById('historial-list');
      if (fechas.length === 0) {
        listEl.innerHTML = '<div class="empty-state"><div class="empty-state-text">No hay registros aún</div></div>';
      } else {
        listEl.innerHTML = fechas.map(f => `
          <div class="historial-item" data-fecha="${f}">
            <span class="historial-fecha">${formatDate(f)}</span>
            <span class="historial-arrow">→</span>
          </div>
        `).join('');
        listEl.querySelectorAll('.historial-item').forEach(item => {
          item.addEventListener('click', async () => {
            document.getElementById('home-date').value = item.dataset.fecha;
            await store.loadRegistros(item.dataset.fecha);
            renderHome(container);
          });
        });
      }
    } else {
      section.style.display = 'none';
    }
  });

  // Click on faro card → go to calculo for that faro
  container.querySelectorAll('.faro-summary-card').forEach(card => {
    card.addEventListener('click', () => {
      store.currentFaroIndex = parseInt(card.dataset.faroIndex);
      document.querySelector('[data-view="calculo"]').click();
    });
  });
}

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-');
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y}`;
}
