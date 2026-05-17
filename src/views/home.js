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

    <button class="btn btn-primary" id="btn-go-registro" style="background: linear-gradient(135deg, var(--faro-1), #059669);">
      📋 Registrar del Día
    </button>

    <div style="height: 10px;"></div>

    <button class="btn btn-secondary" id="btn-go-reparto" style="background: rgba(59, 130, 246, 0.12); border-color: rgba(59, 130, 246, 0.2); color: #60a5fa;">
      🚚 Ver Guía de Reparto
    </button>

    <div style="height: 10px;"></div>

    <button class="btn btn-secondary" id="btn-go-historial">
      📅 Ver Historial de Fechas
    </button>

    <div id="historial-section" style="display:none; margin-top: 20px;">
      <label class="date-label">Días con registros</label>
      <div class="historial-list" id="historial-list">
        <div class="loading"><div class="spinner"></div></div>
      </div>
    </div>

    <!-- MÓDULO INTERACTIVO PONERSE AL DÍA (DESDE ABRIL) -->
    <div class="card" style="margin-top: 20px; border-color: rgba(245, 158, 11, 0.25); background: rgba(245, 158, 11, 0.03);">
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
        <span style="font-size: 1.4rem;">📅</span>
        <div>
          <h3 style="font-size: 0.95rem; font-weight: 700; color: var(--warning); margin: 0 0 2px 0;">Ponerse al Día (Registros Pendientes)</h3>
          <p style="font-size: 0.76rem; color: var(--text-muted); margin: 0;">Completar días sin registro desde el 1 de Abril</p>
        </div>
      </div>
      
      <button class="btn btn-secondary btn-small" id="btn-toggle-al-dia" style="width: 100%; justify-content: space-between; border-color: rgba(245,158,11,0.2); font-weight:600; color: var(--warning);">
        <span>Consultar Días Pendientes</span>
        <span id="al-dia-arrow">▼</span>
      </button>

      <div id="al-dia-section" style="display: none; margin-top: 14px;">
        <div id="al-dia-list">
          <div class="loading"><div class="spinner"></div></div>
        </div>
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

  document.getElementById('btn-go-reparto').addEventListener('click', () => {
    document.querySelector('[data-view="reparto"]').click();
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

  // Evento interactivo para consultar días pendientes
  document.getElementById('btn-toggle-al-dia').addEventListener('click', async () => {
    const section = document.getElementById('al-dia-section');
    const arrow = document.getElementById('al-dia-arrow');
    if (section.style.display === 'none') {
      section.style.display = 'block';
      arrow.textContent = '▲';
      
      const listEl = document.getElementById('al-dia-list');
      listEl.innerHTML = '<div class="loading" style="padding: 12px;"><div class="spinner"></div></div>';
      
      const fechas = await store.getFechasSinRegistros();
      if (fechas.length === 0) {
        listEl.innerHTML = '<div style="text-align: center; padding: 12px; color: var(--success); font-size: 0.85rem; font-weight:600;">✓ ¡Estás al día! No hay registros pendientes desde Abril.</div>';
      } else {
        // Agrupar por mes (Solo Mayo y Abril)
        const groups = {
          '2026-05': { name: 'Mayo 2026', dates: [] },
          '2026-04': { name: 'Abril 2026', dates: [] }
        };
        
        fechas.forEach(f => {
          const monthKey = f.substring(0, 7);
          if (groups[monthKey]) {
            groups[monthKey].dates.push(f);
          }
        });
        
        let html = '';
        for (const [key, group] of Object.entries(groups)) {
          if (group.dates.length > 0) {
            html += `
              <div class="month-group" style="margin-bottom: 12px;">
                <div style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; padding-left: 4px; display: flex; justify-content: space-between;">
                  <span>${group.name}</span>
                  <span style="color: var(--warning);">${group.dates.length} pendientes</span>
                </div>
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;">
                  ${group.dates.map(date => {
                    const day = parseInt(date.split('-')[2]);
                    return `
                      <button class="btn btn-secondary btn-small al-dia-date-btn" data-fecha="${date}" 
                              style="padding: 8px 4px; font-size: 0.82rem; width: 100%; border-color: rgba(245, 158, 11, 0.15); background: rgba(255,255,255,0.01); justify-content: center;">
                        Día ${day}
                      </button>
                    `;
                  }).join('')}
                </div>
              </div>
            `;
          }
        }
        
        listEl.innerHTML = html;
        
        // Agregar manejadores de eventos a los botones de fecha pendiente
        listEl.querySelectorAll('.al-dia-date-btn').forEach(btn => {
          btn.addEventListener('click', async () => {
            const fechaSelected = btn.dataset.fecha;
            store.currentDate = fechaSelected;
            
            const loadingEl = document.createElement('div');
            loadingEl.className = 'loading';
            loadingEl.innerHTML = '<div class="spinner"></div>';
            container.prepend(loadingEl);
            
            await Promise.all([
              store.loadRegistros(fechaSelected),
              store.loadEstados(fechaSelected)
            ]);
            
            // Ir a la vista de registro
            document.querySelector('[data-view="registro"]').click();
          });
        });
      }
    } else {
      section.style.display = 'none';
      arrow.textContent = '▼';
    }
  });

  // Al hacer clic en una tarjeta de Faro → ir al cálculo de ese Faro
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

