class Dashboard {
    constructor() {
        this.baseUrl = AppConfig.API.BASE_URL;
        this.charts = {};
    }

    ENDPOINTS = {
        BALANZAS: '/ctrl_balanza/balanza_asignacion/getAsignacionesReporte',
        TRABAJADORES: '/trabajadorAsignacion/getTrabajadoresReporte',
        DISTRIBUCION: '/ctrl_balanza/balanza_asignacion/getDistribucionReporte',
        EFECTIVIDAD: '/ctrl_balanza/balanza_asignacion/getEfectividadCargaReporte',
        PAGOS_ENTREGAS: '/reportes/actaReporteValidacionEntregas',

        //zonas
        LISTARZONAS: '/ctrl_balanza/balanza_asignacion/listarZonas',
    };

    async init() {
        // 1. Configurar las fechas por defecto (Ayer y Hoy)
        this.initFechasDefecto();

        // 2. Cargar el Select de Zonas desde el backend
        await this.cargarSelectZonas();

        // 3. Inicializamos los lienzos de los gráficos vacíos
        this.initCharts(); // <--- AGREGAR ESTA LÍNEA AQUÍ

        // 4. Asignar el evento al botón de filtrar
        document.getElementById('dash-btn-filtrar').addEventListener('click', () => {
            this.aplicarFiltros();
        });

        // 5. Ejecutar la primera carga con los valores por defecto
        this.aplicarFiltros();
    }

    initFechasDefecto() {
        // Ajuste de zona horaria para evitar desfases de UTC
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        const localHoy = new Date(now.getTime() - offset);

        const localAyer = new Date(localHoy);
        localAyer.setDate(localAyer.getDate() - 1);

        const hoyStr = localHoy.toISOString().split('T')[0];
        const ayerStr = localAyer.toISOString().split('T')[0];

        document.getElementById('dash-fecha-inicio').value = ayerStr;
        document.getElementById('dash-fecha-fin').value = hoyStr;
    }

    async cargarSelectZonas() {
        try {
            const response = await fetch(`${this.baseUrl}${this.ENDPOINTS.LISTARZONAS}`);
            const zonas = await response.json();

            const selectZona = document.getElementById('dash-zona');
            if (!selectZona) return;

            let arrayZonas = Array.isArray(zonas) ? zonas : (zonas.data || []);
            const zonasPermitidas = ['PACHACUTEC', 'MIGUEL GRAU', 'CONO NORTE', 'MENUDEO'];

            arrayZonas.forEach(zona => {
                // Adaptamos la propiedad según como la devuelve tu backend (tdescripcion usualmente)
                const valor = zona.tdescripcion || zona.zona || zona.nombre;

                if (valor) {
                    const textoValidar = valor.trim().toUpperCase();
                    if (zonasPermitidas.includes(textoValidar)) {
                        const option = document.createElement('option');
                        option.value = valor;
                        option.textContent = valor;
                        selectZona.appendChild(option);
                    }
                }
            });
        } catch (error) {
            console.error('Error al cargar zonas en el dashboard:', error);
        }
    }

    obtenerFiltrosGlobales() {
        return {
            fechaInicio: document.getElementById('dash-fecha-inicio').value,
            fechaFin: document.getElementById('dash-fecha-fin').value,
            zona: document.getElementById('dash-zona').value,
            codcli: '' // Lo enviamos vacío por si los endpoints de reporte lo esperan
        };
    }

    async aplicarFiltros() {
        const filtros = this.obtenerFiltrosGlobales();
        const btn = document.getElementById('dash-btn-filtrar');

        // Efecto visual de carga en el botón
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cargando...';
        btn.disabled = true;

        try {
            await this.cargarEstadoPreOperativo(filtros);
            await this.cargarResultadosOperacion(filtros);

        } catch (e) {
            console.error(e);
        } finally {
            // Restaurar el botón
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }

    async cargarEstadoPreOperativo(filtros) {
        try {
            // Construimos los parámetros para la URL
            const params = new URLSearchParams(filtros).toString();

            // Ejecutamos ambas peticiones en paralelo para que el dashboard cargue rapidísimo
            const [resTrabajadores, resBalanzas] = await Promise.all([
                fetch(`${this.baseUrl}${this.ENDPOINTS.TRABAJADORES}?${params}`).then(r => r.json()),
                fetch(`${this.baseUrl}${this.ENDPOINTS.BALANZAS}?${params}`).then(r => r.json())
            ]);

            // Extraemos la data (Ajusta res.data según cómo responda tu API)
            const trabajadores = resTrabajadores.data || resTrabajadores || [];
            const balanzas = resBalanzas.data || resBalanzas || [];

            this.procesarTrabajadores(trabajadores);
            this.procesarBalanzas(balanzas);

        } catch (error) {
            console.error("Error al cargar el dashboard pre-operativo:", error);
            document.getElementById('lista-alertas-balanzas').innerHTML = `
                <li class="p-4 text-center text-red-500 font-bold">Error de conexión con el servidor.</li>
            `;
        }
    }

    procesarTrabajadores(trabajadores) {
        let totalAsistencias = 0;
        let totalDescansos = 0;
        let zonasUnicas = new Set();

        let countDistribuidor = 0;
        let countFacturador = 0;
        let countSupervisor = 0;

        trabajadores.forEach(t => {
            const estado = (t.asistencia || '').trim().toUpperCase();
            const zonaBase = (t.zona || '').trim().toUpperCase();
            const cargo = (t.asignacion || '').trim().toUpperCase();

            // 1. Contar asistencias y descansos
            if (estado === 'ASISTENCIA') totalAsistencias++;
            else if (estado === 'DESCANSO') totalDescansos++;

            // 2. Extraer zonas reales (Omitimos 'PLANTA' si cuenta como no-zona)
            if (zonaBase && !zonaBase.includes('PLANTA')) {
                const numeral = (t.numeral || '').toString().trim();
                zonasUnicas.add(zonaBase + (numeral ? ` ${numeral}` : ''));
            }

            // 3. Contabilizar Cargos
            if (cargo.includes('DISTRIBUIDOR')) countDistribuidor++;
            else if (cargo.includes('FACTURADOR') || cargo.includes('PESADOR')) countFacturador++;
            else if (cargo.includes('SUPERVIS') || cargo.includes('RESPONSABLE')) countSupervisor++;
        });

        const totalPersonal = totalAsistencias + totalDescansos;
        const pctAsistencia = totalPersonal > 0 ? ((totalAsistencias / totalPersonal) * 100).toFixed(1) : 0;

        // --- PINTAR EN EL DOM ---
        document.getElementById('dash-pct-asistencia').textContent = pctAsistencia;
        document.getElementById('dash-personal-activo').textContent = totalAsistencias;
        document.getElementById('dash-personal-descanso').textContent = totalDescansos;

        document.getElementById('dash-zonas-activas').textContent = zonasUnicas.size;
        document.getElementById('dash-nombres-zonas').textContent = zonasUnicas.size > 0
            ? Array.from(zonasUnicas).join(', ')
            : 'Sin zonas asignadas';

        // Pintar Barras de Cargos
        document.getElementById('dash-count-distribuidor').textContent = countDistribuidor;
        document.getElementById('dash-count-facturador').textContent = countFacturador;
        document.getElementById('dash-count-supervisor').textContent = countSupervisor;

        document.getElementById('dash-bar-distribuidor').style.width = totalAsistencias > 0 ? `${(countDistribuidor / totalAsistencias) * 100}%` : '0%';
        document.getElementById('dash-bar-facturador').style.width = totalAsistencias > 0 ? `${(countFacturador / totalAsistencias) * 100}%` : '0%';
        document.getElementById('dash-bar-supervisor').style.width = totalAsistencias > 0 ? `${(countSupervisor / totalAsistencias) * 100}%` : '0%';
    }

    procesarBalanzas(balanzas) {
        let balanzasOk = 0;
        let balanzasEspera = 0;

        let alertasSinAsignar = [];
        let alertasDescalibradas = [];
        let alertasInoperativas = [];

        balanzas.forEach(b => {
            const nombreBalanza = b.nom_balanza || b.cod_balanza || 'S/N';

            // Lógica de Lecturas (Tu misma lógica de reporte)
            const vCentro = (b.centro == 1 || b.centro == '1');
            const vEsquina = (b.esquina == 1 || b.esquina == '1');
            const vCable = (b.cable == 1 || b.cable == '1');
            const isOk = vCentro && vEsquina && vCable;

            if (b.resultado == 0 || b.resultado === '0') {
                alertasInoperativas.push(nombreBalanza);
            } else {
                if (!b.zona) {
                    balanzasEspera++;
                    alertasSinAsignar.push(nombreBalanza);
                }

                if (isOk) {
                    balanzasOk++;
                } else {
                    alertasDescalibradas.push(nombreBalanza);
                }
            }
        });

        // --- PINTAR EN EL DOM ---
        document.getElementById('dash-balanzas-ok').textContent = balanzasOk;
        document.getElementById('dash-balanzas-total').textContent = balanzas.length;
        document.getElementById('dash-balanzas-espera').textContent = balanzasEspera;

        // --- CONSTRUIR LISTA DE ALERTAS ---
        const listaAlertas = document.getElementById('lista-alertas-balanzas');
        listaAlertas.innerHTML = ''; // Limpiamos el "Cargando..."

        if (alertasInoperativas.length > 0) {
            listaAlertas.innerHTML += this.crearFilaAlerta('red', 'Equipos Inoperativos', alertasInoperativas.join(', '), 'TALLER');
        }

        if (alertasDescalibradas.length > 0) {
            listaAlertas.innerHTML += this.crearFilaAlerta('red', 'Falla de Calibración', alertasDescalibradas.join(', '), 'REVISAR');
        }

        if (alertasSinAsignar.length > 0) {
            listaAlertas.innerHTML += this.crearFilaAlerta('amber', 'Equipos Pendientes', alertasSinAsignar.join(', '), 'SIN ASIGNAR');
        }

        if (alertasInoperativas.length === 0 && alertasDescalibradas.length === 0 && alertasSinAsignar.length === 0) {
            listaAlertas.innerHTML = `
                <li class="p-4 flex items-center justify-center text-gray-500">
                    <i class="fas fa-check-circle text-green-500 mr-2"></i> Todos los equipos operativos y asignados.
                </li>
            `;
        }
    }

    crearFilaAlerta(color, titulo, detalle, tag) {
        return `
            <li class="p-4 flex items-center justify-between hover:bg-gray-50">
                <div class="flex items-center gap-3 w-3/4">
                    <div class="w-2 h-2 rounded-full bg-${color}-500 flex-shrink-0"></div>
                    <div class="truncate">
                        <p class="text-sm font-bold text-gray-800 truncate">${titulo}</p>
                        <p class="text-xs text-gray-500 truncate" title="${detalle}">${detalle}</p>
                    </div>
                </div>
                <span class="bg-${color}-100 text-${color}-700 px-2 py-1 rounded text-[10px] font-bold border border-${color}-200 ml-2 whitespace-nowrap">${tag}</span>
            </li>
        `;
    }


    // =================================================================
    // NUEVA SECCIÓN: RESULTADOS DE OPERACIÓN (DISTRIBUCIÓN Y ENTREGAS)
    // =================================================================

    initCharts() {
        // 1. Gráfico de Barras (Efectividad)
        const ctxBar = document.getElementById('dash-bar-efectividad-zonas').getContext('2d');
        this.charts.barEfectividad = new Chart(ctxBar, {
            type: 'bar',
            data: { labels: [], datasets: [{ label: '% Efectividad', data: [], backgroundColor: ['#f97316', '#06b6d4', '#8b5cf6', '#ef4444', '#a855f7', '#10b981', '#f59e0b', '#3b82f6'], borderRadius: 4 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100 } } }
        });

        // 2. Gráfico de Dona (Participación)
        const ctxPie = document.getElementById('dash-pie-participacion').getContext('2d');
        this.charts.pieParticipacion = new Chart(ctxPie, {
            type: 'pie',
            data: { labels: [], datasets: [{ data: [], backgroundColor: ['#f97316', '#06b6d4', '#ef4444', '#a855f7', '#10b981', '#f59e0b', '#3b82f6'], borderWidth: 2, borderColor: '#ffffff' }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } } } }
        });

        // 3. Gráficos de Pastel por Zona (IDÉNTICOS A TU CAPTURA)
        const crearPieZona = (id) => {
            return new Chart(document.getElementById(id).getContext('2d'), {
                type: 'pie',
                data: {
                    labels: ['OPORTUNO', 'ADELANTADO', 'RETRASADO'],
                    datasets: [{
                        data: [0, 0, 0],
                        // Colores extraídos de tu imagen: Azul, Rojo, Verde
                        backgroundColor: ['#3b82f6', '#e11d48', '#10b981'],
                        borderWidth: 1,
                        borderColor: '#ffffff'
                    }]
                },
                // Es vital activar el plugin de dataLabels para que dibuje las letras encima
                plugins: [window.ChartDataLabels],
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: { padding: 5 },
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: { usePointStyle: true, boxWidth: 8, font: { size: 9 } }
                        },
                        datalabels: {
                            color: '#ffffff',
                            font: { weight: 'bold', size: 10 },
                            textAlign: 'center',
                            formatter: (value, context) => {
                                if (value > 0) {
                                    return context.chart.data.labels[context.dataIndex] + '\n' + value + '%';
                                }
                                return '';
                            }
                        },
                        tooltip: {
                            enabled: true, // Reactivamos los tooltips al hacer hover
                            backgroundColor: 'rgba(0,0,0,0.8)',
                            callbacks: {
                                label: (context) => ` ${context.label}: ${context.raw}%`
                            }
                        }
                    }
                }
            });
        };

        this.charts.miniNorte = crearPieZona('dash-dona-norte');
        this.charts.miniPachacutec = crearPieZona('dash-dona-pachacutec');
        this.charts.miniGrau = crearPieZona('dash-dona-grau');
        this.charts.miniMenudeo = crearPieZona('dash-dona-menudeo');

        // --- NUEVO GRÁFICO: BARRAS DOBLES (Pagos vs Entregas) ---
        const ctxPagosEntregas = document.getElementById('dash-chart-pagos-entregas').getContext('2d');
        this.charts.barPagosEntregas = new Chart(ctxPagosEntregas, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [
                    { label: 'Efectividad Pagos (%)', data: [], backgroundColor: '#22c55e', borderRadius: 4 },
                    { label: 'Efectividad Entregas (%)', data: [], backgroundColor: '#3b82f6', borderRadius: 4 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: { legend: { position: 'top', labels: { boxWidth: 12, usePointStyle: true, font: { weight: 'bold' } } } },
                scales: { y: { beginAtZero: true, max: 100, ticks: { stepSize: 20 } }, x: { grid: { display: false } } }
            }
        });
    }

    async cargarResultadosOperacion(filtros) {
        try {
            const params = new URLSearchParams(filtros).toString();

            // Solo llamamos al de Distribución, ahí está toda la data necesaria para esta vista
            const [resDistribucion, resPagosEntregas] = await Promise.all([
                fetch(`${this.baseUrl}${this.ENDPOINTS.DISTRIBUCION}?${params}`).then(r => r.json()),
                fetch(`${this.baseUrl}${this.ENDPOINTS.PAGOS_ENTREGAS}?${params}`).then(r => r.json())
            ]);

            this.procesarDistribucion(resDistribucion);
            this.procesarCierreFinanciero(resPagosEntregas);

        } catch (error) {
            console.error("Aviso en cargarResultadosOperacion:", error);
        }
    }

    procesarDistribucion(resOriginal) {
        const res = resOriginal.data ? resOriginal.data : resOriginal;

        if (!res || !res.zonas || res.zonas.length === 0) {
            this.actualizarGraficoPrincipal([], [], []);
            this.actualizarMiniDonas({}); // Pasamos un objeto vacío
            return;
        }

        const zonas = res.zonas;

        let labelsZonas = [];
        let dataEfectividad = [];
        let dataParticipacion = [];

        zonas.forEach(z => {
            labelsZonas.push(z.nombre);
            dataEfectividad.push(parseFloat(z.pctEntrega) || 0);
            dataParticipacion.push(parseInt(z.clientes) || 0);
        });

        this.actualizarGraficoPrincipal(labelsZonas, dataEfectividad, dataParticipacion);

        // ¡Aquí está la magia! Le pasamos a las donas el resumen exacto que manda el backend
        const resumenEntregas = res.resumenEntregas || {};
        this.actualizarMiniDonas(resumenEntregas);
    }

    actualizarGraficoPrincipal(labels, dataEfectividad, dataParticipacion) {
        // Actualizamos Bar Chart
        this.charts.barEfectividad.data.labels = labels;
        this.charts.barEfectividad.data.datasets[0].data = dataEfectividad;
        this.charts.barEfectividad.update();

        // Actualizamos Pie Chart
        this.charts.pieParticipacion.data.labels = labels;
        this.charts.pieParticipacion.data.datasets[0].data = dataParticipacion;
        this.charts.pieParticipacion.update();
    }

    actualizarMiniDonas(resumenEntregas) {
        const resumen = resumenEntregas || {};

        const actualizarPie = (chart, zonaKey) => {
            // Obtenemos los totales directos de la llave enviada por PHP
            const dataZona = resumen[zonaKey] || { oportuno: 0, adelantado: 0, retrasado: 0, total: 0 };

            // Calculamos el porcentaje igual que en tu código viejo
            const pOp = dataZona.total > 0 ? Math.round((dataZona.oportuno / dataZona.total) * 100) : 0;
            const pAd = dataZona.total > 0 ? Math.round((dataZona.adelantado / dataZona.total) * 100) : 0;
            const pRe = dataZona.total > 0 ? Math.round((dataZona.retrasado / dataZona.total) * 100) : 0;

            if (dataZona.total > 0) {
                chart.data.datasets[0].data = [pOp, pAd, pRe];
            } else {
                chart.data.datasets[0].data = [0, 0, 0]; // Si no hay datos, se queda en blanco
            }

            chart.update();
        };

        actualizarPie(this.charts.miniNorte, 'CONO NORTE');
        actualizarPie(this.charts.miniPachacutec, 'PACHACUTEC');
        actualizarPie(this.charts.miniGrau, 'MIGUEL GRAU');
        actualizarPie(this.charts.miniMenudeo, 'MENUDEO');
    }


    // =================================================================
    // ÚLTIMA SECCIÓN: CIERRE FINANCIERO Y LOGÍSTICO (PAGOS VS ENTREGAS)
    // =================================================================
    procesarCierreFinanciero(resOriginal) {
        // Extraer la data
        const res = resOriginal.data ? resOriginal.data : resOriginal;
        const detalle = res.detalle || [];

        // Si no hay datos, ponemos todo a cero
        if (detalle.length === 0) {
            document.getElementById('dash-pagos-efectividad').textContent = '0';
            document.getElementById('dash-pagos-evaluados').textContent = '0';
            document.getElementById('dash-pagos-tarde').textContent = '0';
            document.getElementById('dash-entregas-efectividad').textContent = '0';
            document.getElementById('dash-entregas-retrasadas').textContent = '0';

            // Limpiar gráfico y barras
            this.charts.barPagosEntregas.data.labels = [];
            this.charts.barPagosEntregas.update();
            ['bar-perfecto', 'bar-cuello-caja', 'bar-cuello-ruta'].forEach(id => {
                const el = document.getElementById(id);
                // CORRECCIÓN: Agregamos .parentElement antes de retroceder
                if (el) {
                    el.style.width = '0%';
                    el.parentElement.previousElementSibling.previousElementSibling.querySelector('span:last-child').textContent = '0%';
                }
            });
            return;
        }

        // --- VARIABLES GLOBALES ---
        let totalClientesCaja = 0; let oportunosCaja = 0; let tardeCaja = 0;
        let totalClientesRuta = 0; let oportunasRuta = 0; let tardeRuta = 0;

        // --- VARIABLES PARA EL RESUMEN CONSOLIDADO (LAS 3 BARRITAS) ---
        let casoPerfecto = 0;   // Caja OK, Ruta OK
        let cuelloCaja = 0;     // Caja Tarde, Ruta OK
        let cuelloRuta = 0;     // Caja OK, Ruta Tarde
        let casosEvaluablesDoble = 0; // Clientes que tienen BOTH (Pago y Entrega)

        // --- AGRUPACIÓN PARA EL GRÁFICO DE BARRAS DOBLE ---
        let mapZonasCorrecto = {};

        detalle.forEach(cli => {
            const zona = (cli.zona || 'SIN ZONA').toUpperCase();
            if (!mapZonasCorrecto[zona]) {
                mapZonasCorrecto[zona] = { evalC: 0, okC: 0, evalR: 0, okR: 0 };
            }

            let esOkCaja = false;
            let esOkRuta = false;

            // EVALUAR CAJA
            if (cli.resultado_pago === 'OPORTUNO') {
                oportunosCaja++; mapZonasCorrecto[zona].evalC++; mapZonasCorrecto[zona].okC++; totalClientesCaja++; esOkCaja = true;
            } else if (cli.resultado_pago === 'PAGO TARDE') {
                tardeCaja++; mapZonasCorrecto[zona].evalC++; totalClientesCaja++;
            }

            // EVALUAR RUTA
            if (cli.req_entrega) {
                totalClientesRuta++;
                mapZonasCorrecto[zona].evalR++;
                if (cli.resultado_entrega === 'Oportuna' || cli.resultado_entrega === 'Adelantada') {
                    oportunasRuta++; mapZonasCorrecto[zona].okR++; esOkRuta = true;
                } else if (cli.resultado_entrega === 'Retrasada') {
                    tardeRuta++;
                }
            }

            // EVALUAR CRUCE (Para las 3 barritas de "Cuello de botella")
            if ((cli.resultado_pago === 'OPORTUNO' || cli.resultado_pago === 'PAGO TARDE') && cli.req_entrega) {
                casosEvaluablesDoble++;
                if (esOkCaja && esOkRuta) casoPerfecto++;
                if (!esOkCaja && esOkRuta) cuelloCaja++;
                if (esOkCaja && !esOkRuta) cuelloRuta++;
            }
        });

        // --- 1. PINTAR LAS 4 TARJETAS SUPERIORES ---
        const pctCaja = totalClientesCaja > 0 ? Math.round((oportunosCaja / totalClientesCaja) * 100) : 0;
        const pctRuta = totalClientesRuta > 0 ? Math.round((oportunasRuta / totalClientesRuta) * 100) : 0;

        document.getElementById('dash-pagos-efectividad').textContent = pctCaja;
        document.getElementById('dash-pagos-evaluados').textContent = totalClientesCaja;
        document.getElementById('dash-pagos-tarde').textContent = tardeCaja;

        document.getElementById('dash-entregas-efectividad').textContent = pctRuta;
        document.getElementById('dash-entregas-retrasadas').textContent = tardeRuta;

        // --- 2. PINTAR GRÁFICO DOBLE (Pagos vs Entregas por Zona) ---
        let labelsBar = []; let dataCajaBar = []; let dataRutaBar = [];

        Object.keys(mapZonasCorrecto).forEach(z => {
            labelsBar.push(z);
            const d = mapZonasCorrecto[z];
            dataCajaBar.push(d.evalC > 0 ? Math.round((d.okC / d.evalC) * 100) : 0);
            dataRutaBar.push(d.evalR > 0 ? Math.round((d.okR / d.evalR) * 100) : 0);
        });

        this.charts.barPagosEntregas.data.labels = labelsBar;
        this.charts.barPagosEntregas.data.datasets[0].data = dataCajaBar;
        this.charts.barPagosEntregas.data.datasets[1].data = dataRutaBar;
        this.charts.barPagosEntregas.update();

        // --- 3. PINTAR LAS 3 BARRITAS HORIZONTALES (Resumen Global) ---
        const pctPerfecto = casosEvaluablesDoble > 0 ? Math.round((casoPerfecto / casosEvaluablesDoble) * 100) : 0;
        const pctCuelloCaja = casosEvaluablesDoble > 0 ? Math.round((cuelloCaja / casosEvaluablesDoble) * 100) : 0;
        const pctCuelloRuta = casosEvaluablesDoble > 0 ? Math.round((cuelloRuta / casosEvaluablesDoble) * 100) : 0;

        const updateBarra = (id, pct) => {
            const barra = document.getElementById(id);
            // CORRECCIÓN: Agregamos .parentElement antes de retroceder
            if (barra) {
                barra.style.width = pct + '%';
                barra.parentElement.previousElementSibling.previousElementSibling.querySelector('span:last-child').textContent = pct + '%';
            }
        };

        updateBarra('bar-perfecto', pctPerfecto);
        updateBarra('bar-cuello-caja', pctCuelloCaja);
        updateBarra('bar-cuello-ruta', pctCuelloRuta);
    }

}

window.dashboard = new Dashboard();