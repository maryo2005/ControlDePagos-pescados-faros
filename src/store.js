import { supabase } from './supabase.js';

// =============================================
// DATA STORE - Operaciones CRUD con Supabase
// =============================================

export const store = {
  faros: [],
  productos: [],
  registros: [],
  averagePrecios: {},
  currentDate: new Date().toISOString().split('T')[0],
  currentFaroIndex: 0,

  // --- FAROS ---
  async loadFaros() {
    const { data, error } = await supabase
      .from('faros')
      .select('*')
      .order('orden');
    if (error) { console.error('Error cargando faros:', error); return []; }
    this.faros = data || [];
    return this.faros;
  },

  async updateFaro(id, updates) {
    const { error } = await supabase.from('faros').update(updates).eq('id', id);
    if (error) console.error('Error actualizando faro:', error);
    return !error;
  },

  // --- PRODUCTOS ---
  async loadProductos() {
    const { data, error } = await supabase
      .from('productos')
      .select('*')
      .eq('activo', true)
      .order('orden');
    if (error) { console.error('Error cargando productos:', error); return []; }
    this.productos = data || [];
    return this.productos;
  },

  async addProducto(nombre) {
    const maxOrden = this.productos.length > 0
      ? Math.max(...this.productos.map(p => p.orden)) + 1
      : 1;
    const { data, error } = await supabase
      .from('productos')
      .insert({ nombre, orden: maxOrden })
      .select()
      .single();
    if (error) { console.error('Error agregando producto:', error); return null; }
    this.productos.push(data);
    return data;
  },

  // --- PRECIOS PROMEDIO ---
  async loadAveragePrecios() {
    const { data, error } = await supabase
      .from('registros')
      .select('producto_id, precio_kg')
      .gt('precio_kg', 0);
    if (error) { console.error('Error cargando promedios:', error); return {}; }

    // Agrupar por producto y calcular promedio
    const grouped = {};
    (data || []).forEach(r => {
      if (!grouped[r.producto_id]) grouped[r.producto_id] = [];
      grouped[r.producto_id].push(parseFloat(r.precio_kg));
    });

    this.averagePrecios = {};
    for (const [prodId, prices] of Object.entries(grouped)) {
      this.averagePrecios[prodId] = prices.reduce((a, b) => a + b, 0) / prices.length;
    }
    return this.averagePrecios;
  },

  getAveragePrice(productoId) {
    return this.averagePrecios[productoId] || 0;
  },

  // --- REGISTROS ---
  async loadRegistros(fecha) {
    this.currentDate = fecha;
    const { data, error } = await supabase
      .from('registros')
      .select('*')
      .eq('fecha', fecha);
    if (error) { console.error('Error cargando registros:', error); return []; }
    this.registros = data || [];
    return this.registros;
  },

  getRegistro(faroId, productoId) {
    return this.registros.find(
      r => r.faro_id === faroId && r.producto_id === productoId
    );
  },

  async upsertRegistro(fecha, faroId, productoId, field, value) {
    const numValue = parseFloat(value) || 0;
    const existing = this.getRegistro(faroId, productoId);

    if (existing) {
      const updates = { [field]: numValue, updated_at: new Date().toISOString() };
      const { error } = await supabase
        .from('registros')
        .update(updates)
        .eq('id', existing.id);
      if (error) { console.error('Error actualizando registro:', error); return false; }
      existing[field] = numValue;
    } else {
      const newRecord = {
        fecha,
        faro_id: faroId,
        producto_id: productoId,
        pedido_kg: 0,
        despacho_kg: 0,
        precio_kg: 0,
        [field]: numValue
      };
      const { data, error } = await supabase
        .from('registros')
        .insert(newRecord)
        .select()
        .single();
      if (error) { console.error('Error insertando registro:', error); return false; }
      this.registros.push(data);
    }
    return true;
  },

  // Sincronizar precio: cuando cambia en un faro, actualizar en todos
  async syncPrecio(fecha, productoId, precio) {
    const numPrecio = parseFloat(precio) || 0;

    // Update all existing records for this date+product
    const { error } = await supabase
      .from('registros')
      .update({ precio_kg: numPrecio, updated_at: new Date().toISOString() })
      .eq('fecha', fecha)
      .eq('producto_id', productoId);

    if (error) console.error('Error sincronizando precio:', error);

    // Update local cache
    this.registros.forEach(r => {
      if (r.producto_id === productoId) {
        r.precio_kg = numPrecio;
      }
    });

    return !error;
  },

  // --- CÁLCULOS ---
  getCalculoForFaro(faroId) {
    const items = this.registros
      .filter(r => r.faro_id === faroId && r.despacho_kg > 0)
      .map(r => {
        const producto = this.productos.find(p => p.id === r.producto_id);
        const precioRegistrado = parseFloat(r.precio_kg) || 0;
        const sinPrecio = precioRegistrado === 0;
        const precioPromedio = sinPrecio ? this.getAveragePrice(r.producto_id) : 0;
        const precioUsado = sinPrecio ? precioPromedio : precioRegistrado;
        const usaPromedio = sinPrecio && precioPromedio > 0;

        return {
          nombre: producto ? producto.nombre : 'Desconocido',
          despacho_kg: parseFloat(r.despacho_kg) || 0,
          precio_kg: precioUsado,
          precio_original: precioRegistrado,
          subtotal: (parseFloat(r.despacho_kg) || 0) * precioUsado,
          sinPrecio: sinPrecio && !usaPromedio,
          usaPromedio: usaPromedio,
          precioPromedio: precioPromedio
        };
      })
      .sort((a, b) => {
        const ia = this.productos.findIndex(p => p.nombre === a.nombre);
        const ib = this.productos.findIndex(p => p.nombre === b.nombre);
        return ia - ib;
      });

    const total = items.reduce((sum, item) => sum + item.subtotal, 0);
    const tienePreciosFaltantes = items.some(item => item.sinPrecio);
    const tienePromedios = items.some(item => item.usaPromedio);

    return { items, total, tienePreciosFaltantes, tienePromedios };
  },

  getResumenDia() {
    return this.faros.map(faro => {
      const calculo = this.getCalculoForFaro(faro.id);
      const estado = this.getEstado(faro.id);
      return { faro, ...calculo, estado };
    });
  },

  // --- ESTADO DIARIO (Pagos y Facturas) ---
  estados: [],

  async loadEstados(fecha) {
    const { data, error } = await supabase
      .from('estado_diario')
      .select('*')
      .eq('fecha', fecha);
    if (error) { console.error('Error cargando estados:', error); return []; }
    this.estados = data || [];
    return this.estados;
  },

  getEstado(faroId) {
    return this.estados.find(e => e.faro_id === faroId) || {
      pagado: false, monto_pagado: 0, fecha_pago: null, nota_pago: '',
      enviado_factura: false, fecha_envio_factura: null
    };
  },

  async togglePagado(fecha, faroId, pagado, montoPagado = 0, notaPago = '') {
    const existing = this.estados.find(e => e.faro_id === faroId);

    const updates = {
      pagado,
      monto_pagado: parseFloat(montoPagado) || 0,
      nota_pago: notaPago,
      fecha_pago: pagado ? new Date().toISOString() : null
    };

    if (existing) {
      const { error } = await supabase
        .from('estado_diario')
        .update(updates)
        .eq('id', existing.id);
      if (error) { console.error('Error actualizando pago:', error); return false; }
      Object.assign(existing, updates);
    } else {
      const { data, error } = await supabase
        .from('estado_diario')
        .insert({ fecha, faro_id: faroId, ...updates })
        .select()
        .single();
      if (error) { console.error('Error creando estado:', error); return false; }
      this.estados.push(data);
    }
    return true;
  },

  async toggleEnviadoFactura(fecha, faroId, enviado) {
    const existing = this.estados.find(e => e.faro_id === faroId);

    const updates = {
      enviado_factura: enviado,
      fecha_envio_factura: enviado ? new Date().toISOString() : null
    };

    if (existing) {
      const { error } = await supabase
        .from('estado_diario')
        .update(updates)
        .eq('id', existing.id);
      if (error) { console.error('Error actualizando envío:', error); return false; }
      Object.assign(existing, updates);
    } else {
      const { data, error } = await supabase
        .from('estado_diario')
        .insert({ fecha, faro_id: faroId, ...updates })
        .select()
        .single();
      if (error) { console.error('Error creando estado:', error); return false; }
      this.estados.push(data);
    }
    return true;
  },

  // --- HISTORIAL ---
  async getFechasConRegistros() {
    const { data, error } = await supabase
      .from('registros')
      .select('fecha')
      .order('fecha', { ascending: false });
    if (error) { console.error('Error cargando fechas:', error); return []; }
    // Get unique dates
    const fechas = [...new Set((data || []).map(r => r.fecha))];
    return fechas;
  }
};
