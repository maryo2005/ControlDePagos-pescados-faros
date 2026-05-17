import './styles.css';
import { store } from './store.js';
import { renderHome } from './views/home.js';
import { renderRegistro } from './views/registro.js';
import { renderCalculo } from './views/calculo.js';
import { renderConfig } from './views/config.js';

// =============================================
// MAIN - Router & Initialization
// =============================================

const views = {
  home: renderHome,
  registro: renderRegistro,
  calculo: renderCalculo,
  config: renderConfig
};

let currentView = 'home';

// --- Toast ---
export function showToast(message) {
  const toast = document.getElementById('toast');
  const msgEl = document.getElementById('toast-message');
  msgEl.textContent = message;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 2000);
}

// --- Save indicator ---
let saveTimeout;
export function showSaveIndicator() {
  let indicator = document.querySelector('.save-indicator');
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.className = 'save-indicator';
    indicator.textContent = '✓ Guardado';
    document.body.appendChild(indicator);
  }
  indicator.classList.add('show');
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => indicator.classList.remove('show'), 1500);
}

// --- Navigation ---
function navigateTo(view) {
  currentView = view;
  const container = document.getElementById('main-content');
  const titleEl = document.getElementById('page-title');

  // Update nav buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });

  // Update title
  const titles = {
    home: 'Control de Pagos',
    registro: 'Registro del Día',
    calculo: 'Cálculo / Factura',
    config: 'Configuración'
  };
  titleEl.textContent = titles[view] || 'Control de Pagos';

  // Animate content
  container.style.animation = 'none';
  container.offsetHeight; // trigger reflow
  container.style.animation = 'fadeIn 0.3s ease';

  // Render view
  views[view](container);
}

// --- Init ---
async function init() {
  const container = document.getElementById('main-content');
  container.innerHTML = `
    <div class="loading" style="min-height: 60vh; flex-direction: column; gap: 16px;">
      <div class="spinner"></div>
      <p style="color: var(--text-muted); font-size: 0.85rem;">Cargando datos...</p>
    </div>
  `;

  try {
    // Load base data
    await Promise.all([
      store.loadFaros(),
      store.loadProductos(),
      store.loadAveragePrecios()
    ]);

    // Load today's registros and estados
    await Promise.all([
      store.loadRegistros(store.currentDate),
      store.loadEstados(store.currentDate)
    ]);

    // Setup navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        navigateTo(btn.dataset.view);
      });
    });

    // Render home
    navigateTo('home');

  } catch (err) {
    console.error('Error initializing:', err);
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <div class="empty-state-text">
          Error al conectar con la base de datos.<br><br>
          Verifica tu archivo <strong>.env</strong> con las credenciales de Supabase.
          <br><br>
          <code style="font-size: 0.75rem; color: var(--text-muted);">${err.message || 'Error desconocido'}</code>
        </div>
      </div>
    `;
  }
}

// Start app
document.addEventListener('DOMContentLoaded', init);
