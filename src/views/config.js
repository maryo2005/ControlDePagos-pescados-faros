import { store } from '../store.js';
import { showToast } from '../main.js';

// =============================================
// CONFIG VIEW - Configuración de faros
// =============================================

export function renderConfig(container) {
  const faros = store.faros;

  container.innerHTML = `
    <div class="config-section">
      <div class="config-title">🏢 Configuración de Faros</div>
      <p style="color: var(--text-muted); font-size: 0.82rem; margin-bottom: 16px;">
        Configura el nombre y RUC de cada faro (empresa)
      </p>

      ${faros.map((faro, i) => `
        <div class="config-card" style="border-left: 4px solid ${faro.color}">
          <div class="input-group">
            <label class="input-label">Nombre</label>
            <input type="text" class="config-input" value="${faro.nombre}"
              data-faro-id="${faro.id}" data-field="nombre"
              placeholder="Nombre del faro">
          </div>
          <div class="input-group">
            <label class="input-label">RUC</label>
            <input type="text" class="config-input" value="${faro.ruc || ''}"
              data-faro-id="${faro.id}" data-field="ruc"
              placeholder="Número de RUC" maxlength="11" inputmode="numeric">
          </div>
        </div>
      `).join('')}
    </div>

    <div class="config-section">
      <div class="config-title">🐟 Productos Registrados</div>
      <p style="color: var(--text-muted); font-size: 0.82rem; margin-bottom: 16px;">
        ${store.productos.length} productos en el sistema
      </p>
      <div class="card" style="padding: 12px;">
        ${store.productos.map(p => `
          <div style="padding: 8px 4px; border-bottom: 1px solid var(--border); font-size: 0.88rem; color: var(--text-secondary);">
            ${p.nombre}
          </div>
        `).join('')}
      </div>
      <p style="color: var(--text-muted); font-size: 0.75rem; margin-top: 8px;">
        💡 Puedes agregar más productos desde la vista de Registro
      </p>
    </div>

    <div class="config-section">
      <div class="config-title">ℹ️ Información</div>
      <div class="card">
        <p style="font-size: 0.82rem; color: var(--text-secondary); line-height: 1.6;">
          Los datos se guardan en la nube (Supabase). Puedes acceder desde cualquier dispositivo.
        </p>
      </div>
    </div>
  `;

  // --- Event: Update faro config (debounced + blur) ---
  let configTimers = {};
  container.querySelectorAll('.config-input').forEach(input => {
    const saveField = async (faroId, field, value) => {
      const success = await store.updateFaro(faroId, { [field]: value });
      if (success) {
        // Update local cache
        const faro = store.faros.find(f => f.id === faroId);
        if (faro) faro[field] = value;
        showToast('Guardado ✓');
      }
    };

    input.addEventListener('input', (e) => {
      const { faroId, field } = e.target.dataset;
      const value = e.target.value;
      const key = `${faroId}-${field}`;

      clearTimeout(configTimers[key]);
      configTimers[key] = setTimeout(() => {
        saveField(faroId, field, value);
      }, 600);
    });

    input.addEventListener('blur', (e) => {
      const { faroId, field } = e.target.dataset;
      const value = e.target.value;
      const key = `${faroId}-${field}`;

      clearTimeout(configTimers[key]);
      saveField(faroId, field, value);
    });
  });
}
