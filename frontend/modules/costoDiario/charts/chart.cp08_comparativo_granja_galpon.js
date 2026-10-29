/**
 * Componente: CP08 Comparativo Granja Galpón
 * Módulo: Costo Diario
 * 
 * 3 Paneles interactivos con Filtro Cruzado y Tooltips idénticos a Tableau:
 * 1. Datos Productivos (histodatosprodcompa) -> Clic en Galpón filtra Paneles 2 y 3 a ese galpón.
 * 2. Comparación Línea (histodatosalmalineacompa) -> Clic en Línea filtra Panel 3 a esa línea.
 * 3. Comparativo Detalle Productos (histodatosalmacompa) -> Matriz pivotada interactiva.
 */

window.ChartCP08ComparativoGranjaGalpon = {
    datosBackend: null,
    catalogoGranjas: null,
    cencosActivo: null,
    nomcencosActivo: null,
    galponActivo: null,
    lineaSeleccionada: null,
    multiGranja: null,
    multiClasif: null,

    render(controller, data) {
        if (!data && controller && controller.tabla1_datos_productivos) {
            data = controller;
        }
        this.datosBackend = data || {};
        if (data && data.filtros_disponibles && data.filtros_disponibles.granjas_catalogo) {
            this.catalogoGranjas = data.filtros_disponibles.granjas_catalogo;
        }
        this.cencosActivo = data.cencos_activo || (data.tabla1_datos_productivos?.granjas?.[0]?.cencos) || null;
        this.nomcencosActivo = data.nomcencos_activo || (data.tabla1_datos_productivos?.granjas?.[0]?.nomcencos) || '';
        this.galponActivo = null;
        this.lineaSeleccionada = null;

        // 1. Ocultar contenedores estándar
        const headerPrincipal = document.getElementById('card-header-grafica-principal');
        if (headerPrincipal) headerPrincipal.classList.add('hidden');

        const cardTabla = document.getElementById('card-tabla-metricas');
        if (cardTabla) cardTabla.classList.add('hidden');

        // 2. Configurar Filtros Superiores
        this.setupFilters(data);

        // 3. Renderizar Layout Visual
        this.renderLayout();
    },

    getSelectedFilters() {
        const filters = {};
        if (this.multiGranja) {
            const granjas = this.multiGranja.getSelectedValues();
            if (granjas.length > 0 && granjas.length < this.multiGranja.options.length) {
                filters.cencos = granjas;
            }
        }
        if (this.multiClasif) {
            const clasifs = this.multiClasif.getSelectedValues();
            if (clasifs.length > 0 && clasifs.length < this.multiClasif.options.length) {
                filters.clasificacion = clasifs;
            }
        }
        return filters;
    },

    aplicarOpcionesGranja(cencosList) {
        const optGranja = (cencosList || []).map(c => {
            const id = String(c.cencos).trim();
            const label = `${c.cencos} ${c.nomcencos || ''}`.trim();
            return { id: id, label: label, selected: true };
        });

        if (!this.multiGranja && typeof CustomMultiSelect !== 'undefined') {
            this.multiGranja = new CustomMultiSelect({
                btnId: 'btn-dropdown-granja-cp08',
                dropdownId: 'dropdown-granja-cp08',
                optionsContainerId: 'container-options-granja-cp08',
                labelId: 'label-granja-cp08',
                searchId: 'search-granja-cp08',
                title: 'Granja',
                options: optGranja,
                onChange: () => {
                    this.filtrarLocalmente();
                }
            });
        } else if (this.multiGranja) {
            this.multiGranja.setOptions(optGranja);
        }

        const labelGranja = document.getElementById('label-granja-cp08');
        if (optGranja.length === 0 && labelGranja) {
            labelGranja.textContent = '(Sin granjas en este período)';
            labelGranja.className = 'truncate text-slate-400 font-normal';
        }
    },

    actualizarGranjasDesdeCatalogo(fIni, fFin) {
        if (!this.catalogoGranjas || !Array.isArray(this.catalogoGranjas) || this.catalogoGranjas.length === 0) {
            return false;
        }

        const fIniStr = fIni.substring(0, 10);
        const fFinStr = fFin.substring(0, 10);
        const mIni = fIni.substring(0, 7);
        const mFin = fFin.substring(0, 7);

        const cencosFiltrados = this.catalogoGranjas.filter(g => {
            if (g.fechas_histo) {
                const arr = g.fechas_histo.split(',');
                for (let i = 0; i < arr.length; i++) {
                    const f = arr[i].trim();
                    const fm = f.substring(0, 7);
                    if ((f >= fIniStr && f <= fFinStr) || (fm >= mIni && fm <= mFin)) {
                        return true;
                    }
                }
            }
            if (g.f_min && g.f_max) {
                if (!(g.f_max < fIniStr || g.f_min > fFinStr)) return true;
            }
            return false;
        });

        this.aplicarOpcionesGranja(cencosFiltrados);
        return true;
    },

    setupFilters(data) {
        // Filtro Granja
        const contGranja = document.getElementById('contenedor-filtro-granja-cp08');
        if (contGranja) contGranja.classList.remove('hidden');

        const cencosDisp = (data && data.filtros_disponibles && data.filtros_disponibles.cencos) || [];
        this.aplicarOpcionesGranja(cencosDisp);

        // Filtro Clasificación
        const contClasif = document.getElementById('contenedor-filtro-clasificacion-cp08');
        if (contClasif) contClasif.classList.remove('hidden');

        const clasifsDisp = (data.filtros_disponibles && data.filtros_disponibles.clasificaciones) || [];
        if (typeof CustomMultiSelect !== 'undefined' && clasifsDisp.length > 0) {
            const optClasif = clasifsDisp.map(c => {
                const id = (c.clasificacion || `${c.linea} ${c.nomlinea}`).trim();
                return { id: id, label: id, selected: true };
            });

            if (!this.multiClasif) {
                this.multiClasif = new CustomMultiSelect({
                    btnId: 'btn-dropdown-clasificacion-cp08',
                    dropdownId: 'dropdown-clasificacion-cp08',
                    optionsContainerId: 'container-options-clasificacion-cp08',
                    labelId: 'label-clasificacion-cp08',
                    searchId: 'search-clasificacion-cp08',
                    title: 'Clasificación',
                    options: optClasif,
                    onChange: () => {
                        this.filtrarLocalmente();
                    }
                });
            } else {
                this.multiClasif.setOptions(optClasif);
            }
        }
    },

    async onFechasChanged(rango) {
        if (!rango || (!rango.fechaInicio && !rango.fechaFin)) return;

        const fIni = rango.fechaInicio || rango.inicio;
        const fFin = rango.fechaFin || rango.fin;
        if (!fIni || !fFin) return;

        // 1. Filtrado instantáneo (0ms) en cliente si ya tenemos el catálogo
        const filtradoInstantaneo = this.actualizarGranjasDesdeCatalogo(fIni, fFin);

        const labelGranja = document.getElementById('label-granja-cp08');
        const prevText = labelGranja ? labelGranja.textContent : '';

        // Solo mostrar indicador sutil si no tenemos catálogo aún
        if (!filtradoInstantaneo && labelGranja) {
            labelGranja.textContent = 'Actualizando...';
        }

        try {
            const baseUrl = (typeof AppConfig !== 'undefined' && AppConfig.API && AppConfig.API.BASE_URL) 
                ? AppConfig.API.BASE_URL 
                : (window.costoDiarioController?.service?.baseUrl || '../../backend');
            const url = `${baseUrl}/costoDiario/dashboard`;

            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tipo_grafico: 'CP08 ComparativoGranjaGalpon',
                    fecha_inicio: fIni,
                    fecha_fin: fFin,
                    solo_filtros: true
                })
            });

            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            const dataRes = await res.json();
            const data = dataRes.payload || dataRes.data || dataRes;

            if (data && data.filtros_disponibles) {
                if (data.filtros_disponibles.granjas_catalogo) {
                    this.catalogoGranjas = data.filtros_disponibles.granjas_catalogo;
                }

                const cencosDisp = data.filtros_disponibles.cencos || [];
                this.aplicarOpcionesGranja(cencosDisp);

                const clasifsDisp = data.filtros_disponibles.clasificaciones || [];
                if (typeof CustomMultiSelect !== 'undefined' && clasifsDisp.length > 0 && this.multiClasif) {
                    const optClasif = clasifsDisp.map(c => {
                        const id = (c.clasificacion || `${c.linea} ${c.nomlinea}`).trim();
                        return { id: id, label: id, selected: true };
                    });
                    this.multiClasif.setOptions(optClasif);
                }
            }
        } catch (err) {
            console.error('Error al actualizar opciones de granja en CP08:', err);
            if (!filtradoInstantaneo && labelGranja) {
                labelGranja.textContent = prevText || '(Todo)';
            }
        }
    },

    filtrarLocalmente() {
        this.renderPanel1();
        this.renderPanel2();
        this.renderPanel3();
    },

    renderLayout() {
        const contenedor = document.getElementById('contenedor-grafica-costo');
        if (!contenedor) return;

        contenedor.className = "flex flex-col w-full p-2 bg-slate-50/50 gap-6";
        contenedor.innerHTML = `
            <div class="w-full flex flex-col gap-5 text-slate-800 font-sans">

                <!-- FILA SUPERIOR: Panel 1 (Datos Productivos) y Panel 2 (Comparación Línea) -->
                <div class="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
                    
                    <!-- PANEL 1: Datos Productivos -->
                    <div class="xl:col-span-5 flex flex-col bg-white border border-slate-300 rounded-xl shadow-xs overflow-hidden">
                        <div class="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                            <h3 class="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wide">Datos Productivos</h3>
                            <div class="flex items-center gap-2">
                                <span id="cp08-badge-p1" class="text-[11px] font-semibold text-slate-500 bg-white px-2.5 py-1 rounded border border-slate-200 whitespace-nowrap">
                                    0 Granjas
                                </span>
                                <button id="cp08-btn-export-p1" type="button"
                                    class="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 border border-emerald-300 rounded-lg transition-all cursor-pointer shadow-2xs">
                                    <svg class="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
                                        <path d="M8.5 17.5l2.25-3.5L8.5 10.5h1.75l1.375 2.25 1.375-2.25h1.75l-2.25 3.5 2.25 3.5h-1.75L11.625 15.25 10.25 17.5z"/>
                                    </svg>
                                    <span>Excel</span>
                                </button>
                            </div>
                        </div>

                        <div class="w-full overflow-x-auto max-h-[460px] custom-scrollbar">
                            <table id="cp08-tabla-p1" class="w-full text-xs border-collapse select-none">
                                <thead class="sticky top-0 z-20 bg-blue-600 text-white border-b border-slate-300 font-bold text-center shadow-xs">
                                    <tr>
                                        <th class="px-2 py-2 border-r border-slate-200">cencos</th>
                                        <th class="px-1.5 py-2 border-r border-slate-200">galpon</th>
                                        <th class="px-2.5 py-2 text-right border-r border-slate-200">UnidadesVen..</th>
                                        <th class="px-2.5 py-2 text-right border-r border-slate-200">KilosVendidos</th>
                                        <th class="px-2 py-2 text-right border-r border-slate-200">PesoPromedio</th>
                                        <th class="px-2 py-2 text-right border-r border-slate-200">ICA</th>
                                        <th class="px-2 py-2 text-right border-r border-slate-200">PromEdadVen..</th>
                                        <th class="px-2 py-2 text-right border-r border-slate-200">%Mortalidad</th>
                                        <th class="px-2 py-2 text-right">PGD</th>
                                    </tr>
                                </thead>
                                <tbody id="cp08-tbody-p1" class="divide-y divide-slate-100 text-slate-800"></tbody>
                                <tfoot id="cp08-tfoot-p1" class="sticky bottom-0 z-20 bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900 shadow-md"></tfoot>
                            </table>
                        </div>
                    </div>

                    <!-- PANEL 2: Comparación Línea -->
                    <div class="xl:col-span-7 flex flex-col bg-white border border-slate-300 rounded-xl shadow-xs overflow-hidden">
                        <div class="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                            <h3 class="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wide">Comparacion Linea</h3>
                            <div class="flex items-center gap-2">
                                <span id="cp08-badge-p2" class="text-[11px] font-semibold text-slate-500 bg-white px-2.5 py-1 rounded border border-slate-200 whitespace-nowrap">
                                    0 Líneas
                                </span>
                                <button id="cp08-btn-export-p2" type="button"
                                    class="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 border border-emerald-300 rounded-lg transition-all cursor-pointer shadow-2xs">
                                    <svg class="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
                                        <path d="M8.5 17.5l2.25-3.5L8.5 10.5h1.75l1.375 2.25 1.375-2.25h1.75l-2.25 3.5 2.25 3.5h-1.75L11.625 15.25 10.25 17.5z"/>
                                    </svg>
                                    <span>Excel</span>
                                </button>
                            </div>
                        </div>

                        <div class="w-full overflow-x-auto max-h-[460px] custom-scrollbar" id="cp08-container-tabla-p2">
                            <!-- Tabla 2 se renderiza dinámicamente con cabeceras pivotadas de galpones -->
                        </div>
                    </div>

                </div>

                <!-- FILA INFERIOR: Panel 3 (Comparativo Detalle Productos) -->
                <div class="w-full flex flex-col bg-white border border-slate-300 rounded-xl shadow-xs overflow-hidden">
                    <div class="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                        <div class="flex items-center gap-3">
                            <h3 class="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wide">Comparativo Detalle Productos</h3>
                            <span id="cp08-badge-linea-filtro" class="hidden text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300 cursor-pointer" title="Clic para quitar filtro">
                                Línea: - ✕
                            </span>
                        </div>
                        <div class="flex items-center gap-2">
                            <span id="cp08-badge-p3" class="text-[11px] font-semibold text-slate-500 bg-white px-2.5 py-1 rounded border border-slate-200 whitespace-nowrap">
                                0 Productos
                            </span>
                            <button id="cp08-btn-export-p3" type="button"
                                class="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 border border-emerald-300 rounded-lg transition-all cursor-pointer shadow-2xs">
                                <svg class="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
                                    <path d="M8.5 17.5l2.25-3.5L8.5 10.5h1.75l1.375 2.25 1.375-2.25h1.75l-2.25 3.5 2.25 3.5h-1.75L11.625 15.25 10.25 17.5z"/>
                                </svg>
                                <span>Excel</span>
                            </button>
                        </div>
                    </div>

                    <div class="w-full overflow-x-auto max-h-[500px] custom-scrollbar" id="cp08-container-tabla-p3">
                        <!-- Tabla 3 se renderiza dinámicamente con cabeceras pivotadas de galpones -->
                    </div>
                </div>

            </div>
        `;

        document.getElementById('cp08-badge-linea-filtro')?.addEventListener('click', () => {
            this.lineaSeleccionada = null;
            this.renderPanel2();
            this.renderPanel3();
        });

        // Configuración de exportación a Excel para las 3 tablas de CP08
        const fechaNom = (this.datosBackend.fecha_formateada || this.datosBackend.fecha || 'general').replace(/[^a-zA-Z0-9]/g, '_');

        const btnP1 = document.getElementById('cp08-btn-export-p1');
        if (btnP1) {
            btnP1.onclick = () => {
                if (typeof ExcelExportHelper !== 'undefined') {
                    ExcelExportHelper.exportarTabla('cp08-tabla-p1', `CP08_Datos_Productivos_${fechaNom}`);
                }
            };
        }

        const btnP2 = document.getElementById('cp08-btn-export-p2');
        if (btnP2) {
            btnP2.onclick = () => {
                if (typeof ExcelExportHelper !== 'undefined') {
                    const sufijoCencos = this.cencosActivo ? `_${this.cencosActivo}` : '';
                    const sufijoGalp = this.galponActivo ? `_G${this.galponActivo}` : '';
                    ExcelExportHelper.exportarTabla('cp08-tabla-p2', `CP08_Comparacion_Linea${sufijoCencos}${sufijoGalp}_${fechaNom}`);
                }
            };
        }

        const btnP3 = document.getElementById('cp08-btn-export-p3');
        if (btnP3) {
            btnP3.onclick = () => {
                if (typeof ExcelExportHelper !== 'undefined') {
                    const sufijoCencos = this.cencosActivo ? `_${this.cencosActivo}` : '';
                    const sufijoGalp = this.galponActivo ? `_G${this.galponActivo}` : '';
                    const sufijoLinea = this.lineaSeleccionada ? `_L${this.lineaSeleccionada}` : '';
                    ExcelExportHelper.exportarTabla('cp08-tabla-p3', `CP08_Comparativo_Detalle_Productos${sufijoCencos}${sufijoGalp}${sufijoLinea}_${fechaNom}`);
                }
            };
        }

        this.renderPanel1();
        this.renderPanel2();
        this.renderPanel3();
    },

    renderPanel1() {
        const tbody = document.getElementById('cp08-tbody-p1');
        const tfoot = document.getElementById('cp08-tfoot-p1');
        const badge = document.getElementById('cp08-badge-p1');
        if (!tbody || !tfoot) return;

        const allGranjas = (this.datosBackend.tabla1_datos_productivos && this.datosBackend.tabla1_datos_productivos.granjas) || [];
        const selectedGranjas = this.multiGranja ? this.multiGranja.getSelectedValues() : [];
        const isFilteringGranja = selectedGranjas && selectedGranjas.length > 0 && selectedGranjas.length < (this.multiGranja.options ? this.multiGranja.options.length : 999);

        let granjasFiltradas = allGranjas.filter(g => {
            if (isFilteringGranja && !selectedGranjas.includes(g.cencos)) return false;
            return true;
        });

        if (badge) badge.textContent = `${granjasFiltradas.length} Granjas`;

        if (granjasFiltradas.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" class="py-8 text-center text-slate-400 italic">No hay datos productivos para los filtros seleccionados</td></tr>`;
            tfoot.innerHTML = '';
            return;
        }

        let rowsHtml = '';

        granjasFiltradas.forEach(g => {
            const isGranjaActiva = this.cencosActivo === g.cencos;
            const galpones = g.galpones || [];

            galpones.forEach((r, idx) => {
                const isFirstRow = idx === 0;
                const cencosDisplay = isFirstRow ? `<span class="font-bold text-slate-800 font-mono">${r.cencos}</span>` : '';
                
                // Resaltado de selección cruzada
                const isRowSelected = (this.cencosActivo === r.cencos && this.galponActivo === r.galpon);
                const rowBgClass = isRowSelected 
                    ? 'bg-sky-200 font-bold text-blue-950 border-l-4 border-l-blue-600' 
                    : (isGranjaActiva && this.galponActivo === null ? 'bg-blue-50/60 hover:bg-blue-100/60' : 'hover:bg-slate-50');

                rowsHtml += `
                    <tr class="cp08-row-p1 ${rowBgClass} cursor-pointer transition-colors border-t border-slate-100"
                        data-cencos="${r.cencos}" data-nomcencos="${r.nomcencos}" data-galpon="${r.galpon}"
                        data-und="${r.unidades_ven}" data-kilos="${r.kilos_vendidos}" data-peso="${r.peso_promedio}"
                        data-ica="${r.ica}" data-edad="${r.prom_edad_ven}" data-mort="${r.porc_mort}" data-pgd="${r.pgd}">
                        <td class="px-2 py-1 text-center font-mono border-r border-slate-100 select-none">${cencosDisplay}</td>
                        <td class="px-1.5 py-1 text-center font-mono text-slate-700 border-r border-slate-100">${r.galpon}</td>
                        <td class="px-2.5 py-1 text-right font-mono border-r border-slate-100" data-metric="UnidadesVendidas" data-val="${this.formatNum(r.unidades_ven, 0)}">${this.formatNum(r.unidades_ven, 0)}</td>
                        <td class="px-2.5 py-1 text-right font-mono border-r border-slate-100" data-metric="KilosVendidos" data-val="${this.formatNum(r.kilos_vendidos, 2)}">${this.formatNum(r.kilos_vendidos, 2)}</td>
                        <td class="px-2 py-1 text-right font-mono border-r border-slate-100 font-medium" data-metric="PesoPromedio" data-val="${this.formatNum(r.peso_promedio, 3)}">${this.formatNum(r.peso_promedio, 3)}</td>
                        <td class="px-2 py-1 text-right font-mono border-r border-slate-100" data-metric="ICA" data-val="${this.formatNum(r.ica, 3)}">${this.formatNum(r.ica, 3)}</td>
                        <td class="px-2 py-1 text-right font-mono border-r border-slate-100" data-metric="PromEdadVen" data-val="${this.formatNum(r.prom_edad_ven, 3)}">${this.formatNum(r.prom_edad_ven, 3)}</td>
                        <td class="px-2 py-1 text-right font-mono border-r border-slate-100 text-slate-700" data-metric="%Mortalidad" data-val="${this.formatNum(r.porc_mort, 3)}%">${this.formatNum(r.porc_mort, 3)}</td>
                        <td class="px-2 py-1 text-right font-mono text-slate-900 font-semibold" data-metric="PGD" data-val="${this.formatNum(r.pgd, 3)}">${this.formatNum(r.pgd, 3)}</td>
                    </tr>
                `;
            });

            // Subtotal de la Granja
            const sub = g.subtotal || {};
            const isSubSelected = (isGranjaActiva && this.galponActivo === null);
            const subBgClass = isSubSelected 
                ? 'bg-sky-100 font-bold text-blue-900 border-t border-b border-blue-300' 
                : 'bg-slate-50 font-bold hover:bg-slate-100';

            rowsHtml += `
                <tr class="${subBgClass} border-t border-b border-slate-300 text-slate-900 text-[11px] select-none cursor-pointer cp08-row-p1-total"
                    data-cencos="${g.cencos}" data-nomcencos="${g.nomcencos}">
                    <td class="px-2 py-1 text-center font-mono border-r border-slate-200"></td>
                    <td class="px-1.5 py-1 text-center font-bold border-r border-slate-200 uppercase">Total</td>
                    <td class="px-2.5 py-1 text-right font-mono border-r border-slate-200" data-metric="Total Unidades" data-val="${this.formatNum(sub.unidades_ven, 0)}">${this.formatNum(sub.unidades_ven, 0)}</td>
                    <td class="px-2.5 py-1 text-right font-mono border-r border-slate-200" data-metric="Total Kilos" data-val="${this.formatNum(sub.kilos_vendidos, 2)}">${this.formatNum(sub.kilos_vendidos, 2)}</td>
                    <td class="px-2 py-1 text-right font-mono border-r border-slate-200" data-metric="Peso Promedio Total" data-val="${this.formatNum(sub.peso_promedio, 3)}">${this.formatNum(sub.peso_promedio, 3)}</td>
                    <td class="px-2 py-1 text-right font-mono border-r border-slate-200" data-metric="ICA Total" data-val="${this.formatNum(sub.ica, 3)}">${this.formatNum(sub.ica, 3)}</td>
                    <td class="px-2 py-1 text-right font-mono border-r border-slate-200" data-metric="Prom Edad Total" data-val="${this.formatNum(sub.prom_edad_ven, 3)}">${this.formatNum(sub.prom_edad_ven, 3)}</td>
                    <td class="px-2 py-1 text-right font-mono border-r border-slate-200" data-metric="Mortalidad Total" data-val="${this.formatNum(sub.porc_mort, 3)}%">${this.formatNum(sub.porc_mort, 3)}</td>
                    <td class="px-2 py-1 text-right font-mono font-bold" data-metric="PGD Total" data-val="${this.formatNum(sub.pgd, 3)}">${this.formatNum(sub.pgd, 3)}</td>
                </tr>
            `;
        });

        tbody.innerHTML = rowsHtml;

        // Total General
        const totGen = this.datosBackend.tabla1_datos_productivos?.total_general || {};
        tfoot.innerHTML = `
            <tr class="border-t-2 border-slate-300">
                <td class="px-2 py-1.5 text-center border-r border-slate-200 font-bold uppercase" colspan="2">Total General</td>
                <td class="px-2.5 py-1.5 text-right font-mono font-bold text-slate-800 border-r border-slate-200">${this.formatNum(totGen.unidades_ven, 0)}</td>
                <td class="px-2.5 py-1.5 text-right font-mono font-bold text-slate-800 border-r border-slate-200">${this.formatNum(totGen.kilos_vendidos, 2)}</td>
                <td class="px-2 py-1.5 text-right font-mono font-bold text-slate-800 border-r border-slate-200">${this.formatNum(totGen.peso_promedio, 3)}</td>
                <td class="px-2.5 py-1.5 text-right font-mono font-bold text-slate-800 border-r border-slate-200">${this.formatNum(totGen.ica, 3)}</td>
                <td class="px-2.5 py-1.5 text-right font-mono font-bold text-slate-800 border-r border-slate-200">${this.formatNum(totGen.prom_edad_ven, 3)}</td>
                <td class="px-2.5 py-1.5 text-right font-mono font-bold text-slate-800 border-r border-slate-200">${this.formatNum(totGen.porc_mort, 3)}</td>
                <td class="px-2.5 py-1.5 text-right font-mono font-bold text-blue-700">${this.formatNum(totGen.pgd, 3)}</td>
            </tr>
        `;

        this.bindPanel1Events();
    },

    bindPanel1Events() {
        const self = this;
        const rows = document.querySelectorAll('.cp08-row-p1');

        rows.forEach(tr => {
            tr.addEventListener('click', function() {
                const cencos = this.getAttribute('data-cencos');
                const galpon = this.getAttribute('data-galpon');
                const nomcencos = this.getAttribute('data-nomcencos');

                if (self.cencosActivo === cencos && self.galponActivo === galpon) {
                    // Deseleccionar galpón (mostrar todos los galpones de esa granja)
                    self.galponActivo = null;
                    self.renderPanel1();
                    self.renderPanel2();
                    self.renderPanel3();
                } else {
                    const cencosCambio = self.cencosActivo !== cencos;
                    self.cencosActivo = cencos;
                    self.nomcencosActivo = nomcencos;
                    self.galponActivo = galpon;

                    if (cencosCambio) {
                        self.lineaSeleccionada = null;
                        self.recargarDatosGranjaActiva();
                    } else {
                        self.renderPanel1();
                        self.renderPanel2();
                        self.renderPanel3();
                    }
                }
            });

            tr.addEventListener('mouseenter', function(e) {
                const cencos = this.getAttribute('data-cencos');
                const nomcencos = this.getAttribute('data-nomcencos');
                const galpon = this.getAttribute('data-galpon');
                const und = this.getAttribute('data-und');

                self.showTooltip(e, {
                    'cencos': cencos,
                    'galpon': galpon,
                    'fecha': self.datosBackend.fecha_formateada || self.datosBackend.fecha,
                    'nomcencos': nomcencos,
                    'UnidadesVendidas': self.formatNum(und, 0)
                });
            });

            tr.addEventListener('mousemove', function(e) {
                self.moveTooltip(e);
            });

            tr.addEventListener('mouseleave', function() {
                self.hideTooltip();
            });
        });

        // Click en fila de Total de la Granja
        const rowsTotal = document.querySelectorAll('.cp08-row-p1-total');
        rowsTotal.forEach(tr => {
            tr.addEventListener('click', function() {
                const cencos = this.getAttribute('data-cencos');
                const nomcencos = this.getAttribute('data-nomcencos');

                const cencosCambio = self.cencosActivo !== cencos;
                self.cencosActivo = cencos;
                self.nomcencosActivo = nomcencos;
                self.galponActivo = null;

                if (cencosCambio) {
                    self.lineaSeleccionada = null;
                    self.recargarDatosGranjaActiva();
                } else {
                    self.renderPanel1();
                    self.renderPanel2();
                    self.renderPanel3();
                }
            });
        });
    },

    recargarDatosGranjaActiva() {
        let rango = {};
        if (typeof PeriodoHelper !== 'undefined' && PeriodoHelper.obtenerRangoFechas) {
            rango = PeriodoHelper.obtenerRangoFechas();
        }

        const payload = {
            tipo_grafico: 'CP08 ComparativoGranjaGalpon',
            fecha_inicio: rango.fechaInicio || rango.inicio,
            fecha_fin: rango.fechaFin || rango.fin,
            fechahisto: this.datosBackend.fecha,
            cencos_seleccionado: this.cencosActivo
        };

        if (this.multiGranja) {
            const granjas = this.multiGranja.getSelectedValues();
            if (granjas.length > 0 && granjas.length < this.multiGranja.options.length) {
                payload.cencos = granjas.join(',');
            }
        }

        if (this.multiClasif) {
            const clasifs = this.multiClasif.getSelectedValues();
            if (clasifs.length > 0 && clasifs.length < this.multiClasif.options.length) {
                payload.clasificacion = clasifs.join(',');
            }
        }

        const baseUrl = (typeof AppConfig !== 'undefined' && AppConfig.API && AppConfig.API.BASE_URL) 
            ? AppConfig.API.BASE_URL 
            : '../../backend';
        const url = `${baseUrl}/costoDiario/dashboard`;

        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(res => {
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            return res.json();
        })
        .then(res => {
            const data = res.payload || res.data || res;
            if (res.success || data.status === 'success' || data.tabla2_comparacion_linea) {
                if (data.tabla2_comparacion_linea) this.datosBackend.tabla2_comparacion_linea = data.tabla2_comparacion_linea;
                if (data.tabla3_comparativo_detalle) this.datosBackend.tabla3_comparativo_detalle = data.tabla3_comparativo_detalle;
                if (data.cencos_activo) this.datosBackend.cencos_activo = data.cencos_activo;
                if (data.nomcencos_activo) this.datosBackend.nomcencos_activo = data.nomcencos_activo;

                this.renderPanel1();
                this.renderPanel2();
                this.renderPanel3();
            }
        })
        .catch(err => {
            console.error('Error al recargar datos de granja CP08:', err);
        });
    },

    renderPanel2() {
        const container = document.getElementById('cp08-container-tabla-p2');
        const badgeP2 = document.getElementById('cp08-badge-p2');
        if (!container) return;

        const t2Data = this.datosBackend.tabla2_comparacion_linea || {};
        let galpones = t2Data.galpones_headers || [];
        const allFilas = t2Data.filas || [];
        const totalesGalpon = t2Data.totales_galpon || {};

        // Filtro cruzado de galpón desde Panel 1
        if (this.galponActivo !== null) {
            galpones = galpones.filter(g => String(g) === String(this.galponActivo));
        }

        const selectedClasif = this.multiClasif ? this.multiClasif.getSelectedValues() : [];
        const isFilteringClasif = selectedClasif && selectedClasif.length > 0 && selectedClasif.length < (this.multiClasif.options ? this.multiClasif.options.length : 999);

        let filas = allFilas.filter(r => {
            if (isFilteringClasif) {
                const clasifStr = `${r.linea} ${r.nomlinea}`.trim();
                const match = selectedClasif.some(sel => sel === r.linea || sel === clasifStr || sel.startsWith(r.linea));
                if (!match) return false;
            }
            return true;
        });

        if (badgeP2) badgeP2.textContent = `${filas.length} Líneas`;

        if (filas.length === 0 || galpones.length === 0) {
            container.innerHTML = `<div class="p-8 text-center text-slate-400 italic">No hay datos de líneas para la granja seleccionada</div>`;
            return;
        }

        // Construir cabeceras exactamente como Tableau (2 filas: Fila 1 = linea, nomlinea, galpones; Fila 2 = métricas)
        let headerRow1 = `
            <tr>
                <th class="px-2 py-2 border-r border-slate-200" rowspan="2">linea</th>
                <th class="px-2.5 py-2 text-left border-r border-slate-200" rowspan="2">nomlinea</th>
        `;
        let headerRow2 = `<tr>`;

        galpones.forEach(g => {
            headerRow1 += `<th class="px-2 py-1 border-r border-slate-200 bg-blue-700 text-center font-bold" colspan="4">${g}</th>`;
            headerRow2 += `
                <th class="px-2 py-1 text-right border-r border-slate-200 text-[11px]">valor</th>
                <th class="px-2 py-1 text-right border-r border-slate-200 text-[11px]">Kilos Producid..</th>
                <th class="px-2 py-1 text-right border-r border-slate-200 text-[11px]">CU</th>
                <th class="px-2 py-1 text-right border-r border-slate-200 text-[11px]">Dif en CU</th>
            `;
        });

        headerRow1 += `</tr>`;
        headerRow2 += `</tr>`;

        // Filas del cuerpo
        let rowsHtml = '';
        filas.forEach(r => {
            const isSelected = this.lineaSeleccionada === r.linea;
            const rowClass = isSelected 
                ? 'bg-sky-200 font-bold text-blue-950 border-l-4 border-l-blue-600' 
                : 'hover:bg-slate-50 cursor-pointer';

            rowsHtml += `
                <tr class="cp08-row-p2 ${rowClass} transition-colors border-t border-slate-100" 
                    data-linea="${r.linea}" data-nomlinea="${r.nomlinea || ''}">
                    <td class="px-2 py-1 text-center font-mono font-bold text-slate-700 border-r border-slate-100">${r.linea}</td>
                    <td class="px-2.5 py-1 text-left font-mono border-r border-slate-100 whitespace-nowrap text-[11px]">${r.nomlinea || ''}</td>
            `;

            galpones.forEach(g => {
                const gData = (r.galpones && r.galpones[g]) || null;
                if (gData) {
                    const difCuClass = gData.dif_cu > 0 ? 'text-rose-600' : (gData.dif_cu < 0 ? 'text-emerald-600' : 'text-slate-400');
                    rowsHtml += `
                        <td class="px-2 py-1 text-right font-mono border-r border-slate-100 cp08-cell-p2"
                            data-galpon="${g}" data-metric="valor" data-val="${this.formatNum(gData.valor, 2)}">${this.formatNum(gData.valor, 2)}</td>
                        <td class="px-2 py-1 text-right font-mono border-r border-slate-100 text-slate-600 cp08-cell-p2"
                            data-galpon="${g}" data-metric="Kilos Producidos" data-val="${this.formatNum(gData.kilos, 2)}">${this.formatNum(gData.kilos, 2)}</td>
                        <td class="px-2 py-1 text-right font-mono border-r border-slate-100 font-bold text-slate-900 cp08-cell-p2"
                            data-galpon="${g}" data-metric="CU" data-val="${this.formatNum(gData.cu, 3)}">${this.formatNum(gData.cu, 3)}</td>
                        <td class="px-2 py-1 text-right font-mono border-r border-slate-100 ${difCuClass} cp08-cell-p2"
                            data-galpon="${g}" data-metric="Dif en CU" data-val="${gData.dif_cu !== 0 ? this.formatNum(gData.dif_cu, 3) : '-'}">${gData.dif_cu !== 0 ? this.formatNum(gData.dif_cu, 3) : '-'}</td>
                    `;
                } else {
                    rowsHtml += `
                        <td class="px-2 py-1 text-right font-mono border-r border-slate-100 text-slate-300">-</td>
                        <td class="px-2 py-1 text-right font-mono border-r border-slate-100 text-slate-300">-</td>
                        <td class="px-2 py-1 text-right font-mono border-r border-slate-100 text-slate-300">-</td>
                        <td class="px-2 py-1 text-right font-mono border-r border-slate-100 text-slate-300">-</td>
                    `;
                }
            });

            rowsHtml += `</tr>`;
        });

        // Totales por Galpón
        let tfootHtml = `
            <tr class="border-t-2 border-slate-300 font-bold text-slate-900">
                <td class="px-2 py-1.5 text-center border-r border-slate-200" colspan="2">Total General</td>
        `;

        galpones.forEach(g => {
            const totG = totalesGalpon[g] || {};
            tfootHtml += `
                <td class="px-2 py-1.5 text-right font-mono border-r border-slate-200 text-blue-900">${this.formatNum(totG.valor, 2)}</td>
                <td class="px-2 py-1.5 text-right font-mono border-r border-slate-200 text-slate-700">${this.formatNum(totG.kilos, 2)}</td>
                <td class="px-2 py-1.5 text-right font-mono border-r border-slate-200 text-blue-900">${this.formatNum(totG.cu, 3)}</td>
                <td class="px-2 py-1.5 text-right border-r border-slate-200"></td>
            `;
        });
        tfootHtml += `</tr>`;

        container.innerHTML = `
            <table id="cp08-tabla-p2" class="w-full text-xs border-collapse select-none">
                <thead class="sticky top-0 z-20 bg-blue-600 text-white border-b border-slate-300 font-bold text-center shadow-xs">
                    ${headerRow1}
                    ${headerRow2}
                </thead>
                <tbody class="divide-y divide-slate-100 text-slate-800">
                    ${rowsHtml}
                </tbody>
                <tfoot class="sticky bottom-0 z-20 bg-slate-100 border-t-2 border-slate-300 shadow-md">
                    ${tfootHtml}
                </tfoot>
            </table>
        `;

        this.bindPanel2Events();
    },

    bindPanel2Events() {
        const self = this;
        const rows = document.querySelectorAll('.cp08-row-p2');

        rows.forEach(tr => {
            tr.addEventListener('click', function() {
                const lin = this.getAttribute('data-linea');
                if (self.lineaSeleccionada === lin) {
                    self.lineaSeleccionada = null;
                } else {
                    self.lineaSeleccionada = lin;
                }
                self.renderPanel2();
                self.renderPanel3();
            });

            tr.addEventListener('mouseenter', function(e) {
                const linea = this.getAttribute('data-linea');
                const nomlinea = this.getAttribute('data-nomlinea');

                self.showTooltip(e, {
                    'cencos': self.cencosActivo,
                    'fecha': self.datosBackend.fecha_formateada || self.datosBackend.fecha,
                    'nomcencos': self.nomcencosActivo,
                    'linea': `${linea} ${nomlinea}`
                });
            });

            tr.addEventListener('mousemove', function(e) {
                self.moveTooltip(e);
            });

            tr.addEventListener('mouseleave', function() {
                self.hideTooltip();
            });
        });
    },

    renderPanel3() {
        const container = document.getElementById('cp08-container-tabla-p3');
        const badgeLinea = document.getElementById('cp08-badge-linea-filtro');
        const badgeP3 = document.getElementById('cp08-badge-p3');
        if (!container) return;

        const t3Data = this.datosBackend.tabla3_comparativo_detalle || {};
        let galpones = t3Data.galpones_headers || [];
        const allFilas = t3Data.filas || [];
        const subtotalesLinea = t3Data.subtotales_linea || {};
        const totalesGenerales = t3Data.totales_generales || {};

        // Filtro cruzado de galpón desde Panel 1
        if (this.galponActivo !== null) {
            galpones = galpones.filter(g => String(g) === String(this.galponActivo));
        }

        if (badgeLinea) {
            badgeLinea.classList.toggle('hidden', !this.lineaSeleccionada);
            if (this.lineaSeleccionada) {
                badgeLinea.textContent = `Línea: ${this.lineaSeleccionada} ✕`;
            }
        }

        const selectedClasif = this.multiClasif ? this.multiClasif.getSelectedValues() : [];
        const isFilteringClasif = selectedClasif && selectedClasif.length > 0 && selectedClasif.length < (this.multiClasif.options ? this.multiClasif.options.length : 999);

        let filas = allFilas.filter(r => {
            // Filtro cruzado de línea desde Panel 2
            if (this.lineaSeleccionada && r.linea !== this.lineaSeleccionada) return false;

            if (isFilteringClasif) {
                const match = selectedClasif.some(sel => sel === r.linea || sel.startsWith(r.linea));
                if (!match) return false;
            }
            return true;
        });

        if (badgeP3) badgeP3.textContent = `${filas.length} Productos`;

        if (filas.length === 0 || galpones.length === 0) {
            container.innerHTML = `<div class="p-8 text-center text-slate-400 italic">No hay productos para la granja y filtros seleccionados</div>`;
            return;
        }

        // Construir cabeceras pivotadas exactamente como Tableau
        const totalGalpCols = galpones.length * 3;
        let headerRow0 = `
            <tr>
                <th class="px-2 py-2 border-r border-slate-200" rowspan="3">linea</th>
                <th class="px-2.5 py-2 text-left border-r border-slate-200" rowspan="3">codigo</th>
                <th class="px-3 py-2 text-left border-r border-slate-200" rowspan="3">nomcodigo</th>
                <th class="px-1.5 py-2 text-center border-r border-slate-200" rowspan="3">trans..</th>
                <th class="px-2 py-1 border-r border-slate-200 bg-blue-800 text-center font-bold tracking-wide" colspan="${totalGalpCols}">
                    <div class="text-[10px] text-blue-200 font-normal">cencos / galpon</div>
                    <div>${this.cencosActivo || ''}</div>
                </th>
            </tr>
        `;

        let headerRow1 = `<tr>`;
        let headerRow2 = `<tr>`;

        galpones.forEach(g => {
            headerRow1 += `<th class="px-2 py-1 border-r border-slate-200 bg-blue-700 text-center font-bold" colspan="3">${g}</th>`;
            headerRow2 += `
                <th class="px-2 py-1 text-right border-r border-slate-200 text-[11px]">cantidad</th>
                <th class="px-2 py-1 text-right border-r border-slate-200 text-[11px]">peso</th>
                <th class="px-2 py-1 text-right border-r border-slate-200 text-[11px]">valor</th>
            `;
        });

        headerRow1 += `</tr>`;
        headerRow2 += `</tr>`;

        // Agrupar filas por línea para colocar fila de Total por cada línea
        let gruposPorLinea = {};
        filas.forEach(r => {
            if (!gruposPorLinea[r.linea]) {
                gruposPorLinea[r.linea] = [];
            }
            gruposPorLinea[r.linea].push(r);
        });

        let rowsHtml = '';
        Object.keys(gruposPorLinea).forEach(lin => {
            const items = gruposPorLinea[lin];

            items.forEach((r, idx) => {
                const lineaDisplay = idx === 0 ? `<span class="font-bold text-slate-800 font-mono">${r.linea}</span>` : '';

                rowsHtml += `
                    <tr class="hover:bg-slate-50 transition-colors border-t border-slate-100 cp08-row-p3"
                        data-linea="${r.linea}" data-codigo="${r.codigo}" data-nomcodigo="${r.nomcodigo}" data-transaccion="${r.transaccion}">
                        <td class="px-2 py-1 text-center font-mono border-r border-slate-100 select-none">${lineaDisplay}</td>
                        <td class="px-2.5 py-1 text-left font-mono font-semibold text-blue-900 border-r border-slate-100">${r.codigo}</td>
                        <td class="px-3 py-1 text-left font-mono text-slate-700 border-r border-slate-100 whitespace-nowrap text-[11px] truncate max-w-[200px]" title="${r.nomcodigo}">${r.nomcodigo}</td>
                        <td class="px-1.5 py-1 text-center font-mono font-bold text-slate-600 border-r border-slate-100">${r.transaccion}</td>
                `;

                galpones.forEach(g => {
                    const gData = (r.galpones && r.galpones[g]) || null;
                    if (gData) {
                        rowsHtml += `
                            <td class="px-2 py-1 text-right font-mono border-r border-slate-100">${gData.cantidad !== 0 ? this.formatNum(gData.cantidad, 2) : '0'}</td>
                            <td class="px-2 py-1 text-right font-mono border-r border-slate-100">${gData.peso !== 0 ? this.formatNum(gData.peso, 2) : '0,00'}</td>
                            <td class="px-2 py-1 text-right font-mono border-r border-slate-100 font-medium">${this.formatNum(gData.valor, 2)}</td>
                        `;
                    } else {
                        rowsHtml += `
                            <td class="px-2 py-1 text-right font-mono border-r border-slate-100 text-slate-300"></td>
                            <td class="px-2 py-1 text-right font-mono border-r border-slate-100 text-slate-300"></td>
                            <td class="px-2 py-1 text-right font-mono border-r border-slate-100 text-slate-300"></td>
                        `;
                    }
                });

                rowsHtml += `</tr>`;
            });

            // Fila de Total de la Línea
            const subL = subtotalesLinea[lin] || {};
            rowsHtml += `
                <tr class="bg-slate-50 font-bold border-t border-b border-slate-200 select-none text-[11px]">
                    <td class="border-r border-slate-200"></td>
                    <td class="px-2.5 py-1 text-left text-slate-600 font-semibold border-r border-slate-200" colspan="3">Total</td>
            `;

            galpones.forEach(g => {
                const sG = subL[g] || {};
                rowsHtml += `
                    <td class="px-2 py-1 text-right font-mono text-slate-800 border-r border-slate-200">${sG.cantidad ? this.formatNum(sG.cantidad, 2) : ''}</td>
                    <td class="px-2 py-1 text-right font-mono text-slate-800 border-r border-slate-200">${sG.peso ? this.formatNum(sG.peso, 2) : ''}</td>
                    <td class="px-2 py-1 text-right font-mono text-slate-900 border-r border-slate-200 font-bold">${sG.valor ? this.formatNum(sG.valor, 2) : ''}</td>
                `;
            });

            rowsHtml += `</tr>`;
        });

        // Fila de Total General
        let tfootHtml = `
            <tr class="border-t-2 border-slate-300 font-bold text-slate-900">
                <td class="px-2 py-1.5 text-center border-r border-slate-200" colspan="4">Total general</td>
        `;

        galpones.forEach(g => {
            const totG = totalesGenerales[g] || {};
            tfootHtml += `
                <td class="px-2 py-1.5 text-right font-mono border-r border-slate-200 text-slate-800">${totG.cantidad ? this.formatNum(totG.cantidad, 2) : '0,00'}</td>
                <td class="px-2 py-1.5 text-right font-mono border-r border-slate-200 text-slate-800">${totG.peso ? this.formatNum(totG.peso, 2) : '0,00'}</td>
                <td class="px-2 py-1.5 text-right font-mono border-r border-slate-200 text-blue-900 font-bold">${totG.valor ? this.formatNum(totG.valor, 2) : '0,00'}</td>
            `;
        });
        tfootHtml += `</tr>`;

        container.innerHTML = `
            <table id="cp08-tabla-p3" class="w-full text-xs border-collapse select-none">
                <thead class="sticky top-0 z-20 bg-blue-600 text-white border-b border-slate-300 font-bold text-center shadow-xs">
                    ${headerRow0}
                    ${headerRow1}
                    ${headerRow2}
                </thead>
                <tbody class="divide-y divide-slate-100 text-slate-800">
                    ${rowsHtml}
                </tbody>
                <tfoot class="sticky bottom-0 z-20 bg-slate-100 border-t-2 border-slate-300 shadow-md">
                    ${tfootHtml}
                </tfoot>
            </table>
        `;

        this.bindPanel3Events();
    },

    bindPanel3Events() {
        const self = this;
        const rows = document.querySelectorAll('.cp08-row-p3');

        rows.forEach(tr => {
            tr.addEventListener('mouseenter', function(e) {
                const linea = this.getAttribute('data-linea');
                const codigo = this.getAttribute('data-codigo');
                const nomcodigo = this.getAttribute('data-nomcodigo');
                const transaccion = this.getAttribute('data-transaccion');

                self.showTooltip(e, {
                    'cencos': self.cencosActivo,
                    'fecha': self.datosBackend.fecha_formateada || self.datosBackend.fecha,
                    'nomcencos': self.nomcencosActivo,
                    'linea': linea,
                    'codigo': `${codigo} ${nomcodigo}`,
                    'transaccion': transaccion
                });
            });

            tr.addEventListener('mousemove', function(e) {
                self.moveTooltip(e);
            });

            tr.addEventListener('mouseleave', function() {
                self.hideTooltip();
            });
        });
    },

    showTooltip(e, fields) {
        const tt = document.getElementById('tooltip-tableau-costos');
        if (!tt) return;

        let rowsHtml = '';
        Object.entries(fields).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== '') {
                rowsHtml += `
                    <div class="flex items-center justify-between gap-4 py-0.5 border-b border-slate-100 last:border-0">
                        <span class="text-slate-500 font-medium">${k}:</span>
                        <span class="text-slate-900 font-semibold font-mono text-right">${v}</span>
                    </div>
                `;
            }
        });

        tt.innerHTML = `
            <div class="flex flex-col gap-1 text-[11px] font-sans">
                ${rowsHtml}
            </div>
        `;

        tt.classList.remove('hidden');
        this.moveTooltip(e);
    },

    moveTooltip(e) {
        const tt = document.getElementById('tooltip-tableau-costos');
        if (!tt || tt.classList.contains('hidden')) return;

        const pad = 15;
        let x = e.clientX + pad;
        let y = e.clientY + pad;

        const ttWidth = tt.offsetWidth || 260;
        const ttHeight = tt.offsetHeight || 140;
        const winWidth = window.innerWidth;
        const winHeight = window.innerHeight;

        if (x + ttWidth > winWidth - 10) {
            x = e.clientX - ttWidth - pad;
        }
        if (y + ttHeight > winHeight - 10) {
            y = e.clientY - ttHeight - pad;
        }

        tt.style.left = `${Math.max(10, x)}px`;
        tt.style.top = `${Math.max(10, y)}px`;
    },

    hideTooltip() {
        const tt = document.getElementById('tooltip-tableau-costos');
        if (tt) tt.classList.add('hidden');
    },

    formatNum(num, decimals = 2) {
        if (num === null || num === undefined || isNaN(num)) return '-';
        return Number(num).toLocaleString('es-PE', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    }
};

// Registro modular
if (!window.ChartRegistry) window.ChartRegistry = {};
window.ChartRegistry['CP08 ComparativoGranjaGalpon'] = window.ChartCP08ComparativoGranjaGalpon;
window.ChartRegistry['CP08ComparativoGranjaGalpon'] = window.ChartCP08ComparativoGranjaGalpon;
window.ChartRegistry['CP08 Comparativo Granja Galpon'] = window.ChartCP08ComparativoGranjaGalpon;
window.ChartRegistry['CP08'] = window.ChartCP08ComparativoGranjaGalpon;
window.ChartRegistry['CP08 ComparativoGranjaGalpón'] = window.ChartCP08ComparativoGranjaGalpon;
