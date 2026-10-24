# Surtigas S.A. E.S.P. - Sistema de Optimización de Turnos (Pantallas v2)

Sistema web integral para la optimización, simulación, análisis de demanda y gestión operativa de turnos y personal para **Surtigas S.A. E.S.P.**

---

## 🚀 Tecnologías

- **React 19** + **TypeScript**
- **Vite 6** (Bundler & Dev Server)
- **Tailwind CSS v4**
- **React Router v7** (Enrutamiento SPA)
- **Lucide React** (Iconografía)
- **Recharts** (Gráficos interactivos)
- **Zustand** (Gestión de estado global)
- **Canvas Confetti**

---

## 📋 Vistas del Sistema

1. **Login & Autenticación** (`/login`)
2. **Dashboard Operativo** (`/dashboard`)
3. **Plan del Día** (`/plan-dia`)
4. **Malla de Turnos** (`/malla`)
5. **Redistribución de Personal** (`/redistribucion`)
6. **Detalle de Oficina** (`/oficina/:id`)
7. **Análisis de Demanda** (`/demanda`)
8. **Simulador de Escenarios** (`/simulador`)
9. **Gestión de Ausencias** (`/ausencias`)
10. **Reportes y Analítica** (`/reportes`)
11. **Configuración del Sistema** (`/configuracion`)

---

## 🛠️ Instalación y Ejecución Local

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Ejecutar en modo de desarrollo:**
   ```bash
   npm run dev
   ```

3. **Construir para producción:**
   ```bash
   npm run build
   ```

4. **Previsualizar la compilación de producción:**
   ```bash
   npm run preview
   ```

---

## ☁️ Despliegue en Vercel

Este repositorio está preconfigurado para desplegarse automáticamente en [Vercel](https://vercel.com):

1. Conecta tu cuenta de GitHub en Vercel.
2. Importa el repositorio `pantallas-v2`.
3. Vercel detectará automáticamente la configuración a través de `vercel.json`:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Haz clic en **Deploy**. Todas las rutas de `react-router-dom` funcionarán sin problemas de recarga gracias a las reglas de rewrite en `vercel.json`.
