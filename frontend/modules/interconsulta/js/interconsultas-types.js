/**
 * Gestor de Tipos y Estilos de Visualización de Gráficos (Línea, Barras, Dona, Circular)
 */

var tipoVisualizacionGlobal = 'default';

const ICONOS_VISUALIZACION = {
    default: `<svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>`,
    line: `<svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"></path></svg>`,
    bar: `<svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>`,
    doughnut: `<svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>`,
    pie: `<svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"></path></svg>`
};

const NOMBRES_TIPO_VISUALIZACION = {
    default: 'Personalizado',
    line: 'Línea',
    bar: 'Barras',
    doughnut: 'Dona',
    pie: 'Circular (Pie)'
};

function cambiarTipoVisualizacionGlobal(nuevoTipo) {
    if (!['default', 'line', 'bar', 'doughnut', 'pie'].includes(nuevoTipo)) return;
    tipoVisualizacionGlobal = nuevoTipo;

    const iconContainer = document.getElementById('icono-visualizacion-activa');
    if (iconContainer && ICONOS_VISUALIZACION[nuevoTipo]) {
        iconContainer.innerHTML = ICONOS_VISUALIZACION[nuevoTipo];
    }

    // Actualizar el texto del primer option en los selects de gráficos de mortalidad
    const selectsGrafico = document.querySelectorAll('.select-grafico');
    selectsGrafico.forEach(sel => {
        const optLinea = sel.querySelector('option[value="linea"]');
        if (optLinea) {
            optLinea.textContent = NOMBRES_TIPO_VISUALIZACION[nuevoTipo] || 'Línea';
        }
    });

    if (typeof configGraficos !== 'undefined' && Array.isArray(configGraficos)) {
        configGraficos.forEach(item => {
            item.tipoVisualizacion = (nuevoTipo === 'default') ? null : nuevoTipo;
            if (typeof crearGraficoChartJS === 'function') {
                crearGraficoChartJS(item);
            }
        });
    }
}

var sexoGlobal = 'macho';

function cambiarSexoGlobal(nuevoSexo) {
    if (!['macho', 'hembra', 'ambos'].includes(nuevoSexo)) return;
    sexoGlobal = nuevoSexo;

    if (typeof configGraficos !== 'undefined' && Array.isArray(configGraficos)) {
        configGraficos.forEach(item => {
            const soportaSexo = (
                item.tipo === 'mortalidad' ||
                item.tipo === 'consumo_alimento' ||
                item.tipo === 'ganancia_peso' ||
                item.tipo === 'pesaje_pollo' ||
                item.tipo === 'respiratorio' ||
                item.tipo === 'digestivo' ||
                (item.esCombinado && Array.isArray(item.tiposCombinados) && item.tiposCombinados.some(t => t === 'mortalidad' || t === 'consumo_alimento' || t === 'ganancia_peso' || t === 'pesaje_pollo' || t === 'respiratorio' || t === 'digestivo'))
            );

            if (soportaSexo) {
                item.sexoActiva = nuevoSexo;

                const selectLocal = document.querySelector(`.select-sexo[data-chart="${item.canvasId}"]`);
                if (selectLocal) {
                    selectLocal.value = nuevoSexo;
                }

                if (typeof actualizarGraficoEspecifico === 'function') {
                    actualizarGraficoEspecifico(item);
                } else if (typeof crearGraficoChartJS === 'function') {
                    crearGraficoChartJS(item);
                }
            }
        });
    }
}
