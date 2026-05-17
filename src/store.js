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
        peso_real_kg: 0,
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

  // Sincronizar precio: cuando cambia el precio, actualizar o crear en todos los faros
  async syncPrecio(fecha, productoId, precio) {
    const numPrecio = parseFloat(precio) || 0;

    for (const faro of this.faros) {
      const existing = this.registros.find(
        r => r.fecha === fecha && r.faro_id === faro.id && r.producto_id === productoId
      );

      if (existing) {
        const { error } = await supabase
          .from('registros')
          .update({ precio_kg: numPrecio, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (!error) {
          existing.precio_kg = numPrecio;
        }
      } else {
        const newRecord = {
          fecha,
          faro_id: faro.id,
          producto_id: productoId,
          pedido_kg: 0,
          despacho_kg: 0,
          peso_real_kg: 0,
          precio_kg: numPrecio
        };
        const { data, error } = await supabase
          .from('registros')
          .insert(newRecord)
          .select()
          .single();
        if (!error && data) {
          this.registros.push(data);
        }
      }
    }
    return true;
  },

  // --- CÁLCULOS ---
  getCalculoForFaro(faroId) {
    const items = this.registros
      .filter(r => r.faro_id === faroId && (parseFloat(r.despacho_kg) > 0 || parseFloat(r.peso_real_kg) > 0))
      .map(r => {
        const producto = this.productos.find(p => p.id === r.producto_id);
        const precioRegistrado = parseFloat(r.precio_kg) || 0;
        const sinPrecio = precioRegistrado === 0;
        const precioPromedio = sinPrecio ? this.getAveragePrice(r.producto_id) : 0;
        const precioUsado = sinPrecio ? precioPromedio : precioRegistrado;
        const usaPromedio = sinPrecio && precioPromedio > 0;

        const pesoReal = parseFloat(r.peso_real_kg) || 0;
        const despachoVal = parseFloat(r.despacho_kg) || 0;
        const pedidoVal = parseFloat(r.pedido_kg) || 0;

        // Regla: si se tiene peso real, se usa peso real; si no, se usa el despacho.
        const tienePesoReal = pesoReal > 0;
        const qtyUsada = tienePesoReal ? pesoReal : despachoVal;
        const subtotal = qtyUsada * precioUsado;

        return {
          id: r.id,
          producto_id: r.producto_id,
          nombre: producto ? producto.nombre : 'Desconocido',
          pedido_kg: pedidoVal,
          despacho_kg: despachoVal,
          peso_real_kg: pesoReal,
          tienePesoReal: tienePesoReal,
          precio_kg: precioUsado,
          precio_original: precioRegistrado,
          subtotal: subtotal,
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
    try {
      const { data, error } = await supabase
        .from('estado_diario')
        .select('*')
        .eq('fecha', fecha);
        
      if (error) { 
        console.warn('Error cargando estados de Supabase, usando respaldo local:', error); 
        // Cargar desde localStorage como respaldo
        const backups = JSON.parse(localStorage.getItem('backup_estados') || '{}');
        this.estados = backups[fecha] || [];
        return this.estados;
      }
      
      this.estados = data || [];
      // Guardar caché en localStorage
      const backups = JSON.parse(localStorage.getItem('backup_estados') || '{}');
      backups[fecha] = this.estados;
      localStorage.setItem('backup_estados', JSON.stringify(backups));
      return this.estados;
    } catch (e) {
      console.warn('Excepción cargando estados, usando respaldo local:', e);
      const backups = JSON.parse(localStorage.getItem('backup_estados') || '{}');
      this.estados = backups[fecha] || [];
      return this.estados;
    }
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
      fecha_pago: pagado ? (existing && existing.fecha_pago ? existing.fecha_pago : new Date().toISOString()) : null
    };

    let success = false;
    
    try {
      if (existing && existing.id && !existing.id.toString().startsWith('local_')) {
        const { error } = await supabase
          .from('estado_diario')
          .update(updates)
          .eq('id', existing.id);
        if (!error) {
          Object.assign(existing, updates);
          success = true;
        } else {
          console.error('Error actualizando pago en Supabase:', error);
        }
      } else {
        // Intentar insertar
        const { data, error } = await supabase
          .from('estado_diario')
          .insert({ fecha, faro_id: faroId, ...updates })
          .select()
          .single();
        if (!error && data) {
          if (existing) {
            Object.assign(existing, data);
          } else {
            this.estados.push(data);
          }
          success = true;
        } else {
          console.error('Error creando pago en Supabase:', error);
        }
      }
    } catch (e) {
      console.error('Excepción guardando pago en Supabase:', e);
    }

    // Si falló Supabase (por ejemplo, porque la tabla no existe aún), guardamos localmente en localStorage
    if (!success) {
      console.warn('Guardando cobro localmente en localStorage (Respaldado)');
      if (existing) {
        Object.assign(existing, updates);
      } else {
        const newEstado = {
          id: 'local_' + Math.random().toString(36).substr(2, 9),
          fecha,
          faro_id: faroId,
          ...updates
        };
        this.estados.push(newEstado);
      }
    }

    // Actualizar localStorage
    const backups = JSON.parse(localStorage.getItem('backup_estados') || '{}');
    backups[fecha] = this.estados;
    localStorage.setItem('backup_estados', JSON.stringify(backups));
    return true;
  },

  async toggleEnviadoFactura(fecha, faroId, enviado) {
    const existing = this.estados.find(e => e.faro_id === faroId);

    const updates = {
      enviado_factura: enviado,
      fecha_envio_factura: enviado ? new Date().toISOString() : null
    };

    let success = false;

    try {
      if (existing && existing.id && !existing.id.toString().startsWith('local_')) {
        const { error } = await supabase
          .from('estado_diario')
          .update(updates)
          .eq('id', existing.id);
        if (!error) {
          Object.assign(existing, updates);
          success = true;
        } else {
          console.error('Error actualizando envío en Supabase:', error);
        }
      } else {
        // Intentar insertar
        const { data, error } = await supabase
          .from('estado_diario')
          .insert({ fecha, faro_id: faroId, ...updates })
          .select()
          .single();
        if (!error && data) {
          if (existing) {
            Object.assign(existing, data);
          } else {
            this.estados.push(data);
          }
          success = true;
        } else {
          console.error('Error creando envío en Supabase:', error);
        }
      }
    } catch (e) {
      console.error('Excepción guardando envío en Supabase:', e);
    }

    // Si falló Supabase, guardamos localmente en localStorage
    if (!success) {
      console.warn('Guardando envío de factura localmente en localStorage (Respaldado)');
      if (existing) {
        Object.assign(existing, updates);
      } else {
        const newEstado = {
          id: 'local_' + Math.random().toString(36).substr(2, 9),
          fecha,
          faro_id: faroId,
          pagado: false,
          monto_pagado: 0,
          nota_pago: '',
          ...updates
        };
        this.estados.push(newEstado);
      }
    }

    // Actualizar localStorage
    const backups = JSON.parse(localStorage.getItem('backup_estados') || '{}');
    backups[fecha] = this.estados;
    localStorage.setItem('backup_estados', JSON.stringify(backups));
    return true;
  },

  // --- HISTORIAL ---
  async getFechasConRegistros() {
    const { data, error } = await supabase
      .from('registros')
      .select('fecha')
      .order('fecha', { ascending: false });
    if (error) { console.error('Error cargando fechas:', error); return []; }
    const fechas = [...new Set((data || []).map(r => r.fecha))];
    return fechas;
  },

  // Obtener fechas sin registros para "Ponerse al día" (desde el 1 de Abril)
  async getFechasSinRegistros() {
    try {
      const { data, error } = await supabase
        .from('registros')
        .select('fecha')
        .gte('fecha', '2026-04-01');
      if (error) { console.error('Error cargando fechas con registros:', error); return []; }

      const fechasConData = new Set((data || []).map(r => r.fecha));

      const start = new Date('2026-04-01T12:00:00');
      const today = new Date();
      today.setHours(23, 59, 59, 999);

      const fechasFaltantes = [];
      let current = new Date(start);

      while (current <= today) {
        const dateStr = current.toISOString().split('T')[0];
        if (!fechasConData.has(dateStr)) {
          fechasFaltantes.push(dateStr);
        }
        current.setDate(current.getDate() + 1);
      }

      return fechasFaltantes.reverse();
    } catch (e) {
      console.error('Error en getFechasSinRegistros:', e);
      return [];
    }
  }
};
