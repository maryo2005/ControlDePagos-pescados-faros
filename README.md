# 🐟 Control de Pagos - Pescados y Mariscos

Sistema sencillo para registrar pedidos, despachos y calcular cobros diarios de pescados y mariscos para 3 faros (empresas).

## 🚀 Configuración Rápida

### 1. Crear proyecto en Supabase
1. Ve a [supabase.com](https://supabase.com) y crea una cuenta gratuita
2. Crea un nuevo proyecto
3. Ve al **SQL Editor** y ejecuta todo el contenido del archivo `database/schema.sql`
4. Ve a **Settings > API** y copia:
   - **Project URL** (ej: `https://xxxxx.supabase.co`)
   - **anon public key** (la llave pública)

### 2. Configurar credenciales
Crea un archivo `.env` en la raíz del proyecto (copia `.env.example`):
```
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key-aqui
```

### 3. Instalar y ejecutar
```bash
npm install
npm run dev
```
Se abrirá en `http://localhost:3000`

## 📱 Funcionalidades

- **Inicio**: Resumen del día con totales por faro
- **Registro**: Ingresar pedidos, despachos y precios por faro
- **Cálculo**: Vista de factura con multiplicaciones (como la hoja cuadriculada)
- **Config**: Configurar nombres y RUC de los faros

### Características clave
- ✅ Cálculos automáticos (despacho × precio = subtotal)
- ⚠️ Alertas cuando falta el precio de un producto despachado
- 📤 Compartir cálculos por WhatsApp o copiar al portapapeles
- 🔄 Precios sincronizados entre faros (precio de mercado del día)
- 📱 Diseñado para celular (mobile-first)
- ☁️ Datos en la nube con Supabase

## 🗂️ Estructura
```
ControlDePagos/
├── index.html          # Página principal
├── package.json        # Dependencias
├── vite.config.js      # Configuración de Vite
├── .env                # Credenciales (no subir a git)
├── database/
│   └── schema.sql      # SQL para crear tablas en Supabase
└── src/
    ├── main.js         # Entrada + router
    ├── supabase.js     # Conexión a Supabase
    ├── store.js        # Operaciones de datos
    ├── styles.css      # Estilos
    └── views/
        ├── home.js     # Vista inicio
        ├── registro.js # Vista registro
        ├── calculo.js  # Vista cálculo/factura
        └── config.js   # Vista configuración
```
