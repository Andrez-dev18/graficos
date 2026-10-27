class CorrelacionGralController {
    constructor() {
        this.service = new CorrelacionGralService();
        this.seleccionVentas = { fecha: '', placa: '' };
        this.msTdoc = null;
        this.msZona = null;
        this.msRuta = null;
        this.msPlaca = null;
        this.searchLinea = null;
        this.paginas = { ventas: 1, transportes: 1, agcausal: 1, mermas: 1 };
        this.paginando = { ventas: false, transportes: false, agcausal: false, mermas: false };
        this.datos = null;
        this.filasCompletas = null;
        this.modoMemoria = false;
        this.cacheSeleccion = {};
        this.snapshotPreSeleccion = null;
        this.seleccionFilas = { transportes: null, agcausal: null, mermas: null };
        this.seleccionServidor = { transportes: false, agcausal: false, mermas: false };
        this.seleccionSeq = 0;
        this.precargaSeq = 0;
        this.init();
    }

    async init() {
        this.setupPeriodo();
        this.setupListeners();
        await this.cargarFiltros();
        await this.cargar(false);
    }

    setupPeriodo() {
        const sel = document.getElementById('select-tipo-periodo');
        if (sel && !sel.value) sel.value = 'entre_fechas';
        if (typeof PeriodoHelper !== 'undefined') PeriodoHelper.renderizarInputs();
    }

    setupListeners() {
        const selectVista = document.getElementById('select-tipo-grafico');
        if (selectVista) {
            selectVista.value = 'CorrelacionGral';
            selectVista.addEventListener('change', () => {
                if (selectVista.value === 'LiquidacionPlacas') {
                    window.location.href = 'analisisTransporte.html';
                }
            });
        }

        document.getElementById('select-tipo-periodo')?.addEventListener('change', () => {
            if (typeof PeriodoHelper !== 'undefined') PeriodoHelper.renderizarInputs();
        });
        document.getElementById('btn-cargar')?.addEventListener('click', () => this.cargar(false));
        document.getElementById('btn-limpiar')?.addEventListener('click', () => this.limpiar());

        document.getElementById('btn-toggle-filtros')?.addEventListener('click', () => {
            const panel = document.getElementById('contenedor-filtros-contenido');
            const label = document.getElementById('label-toggle-filtros');
            const icon = document.getElementById('icon-toggle-filtros');
            if (!panel) return;
            const oculto = panel.classList.toggle('hidden');
            if (label) label.textContent = oculto ? 'Mostrar filtros' : 'Ocultar filtros';
            if (icon) icon.style.transform = oculto ? 'rotate(180deg)' : 'rotate(0deg)';
        });
    }

    async cargarFiltros() {
        const data = await this.service.obtenerFiltros();
        this.searchLinea = new SearchableSelect({
            containerId: 'searchable-linea',
            title: 'Línea',
            options: (data.lineas || []).map(v => ({ value: v, label: v }))
        });
        const lineaDefault = data.linea_default && (data.lineas || []).includes(data.linea_default)
            ? data.linea_default
            : '';
        this.searchLinea.setValue(lineaDefault, false);

        this.msTdoc = this.crearMulti('tdoc', data.tdocs || []);
        this.msZona = this.crearMulti('zona', data.zonas || []);
        this.msRuta = this.crearMulti('ruta', data.rutas || []);
        this.msPlaca = this.crearMulti('placa', data.placas || []);

        const defaultsTdoc = (data.tdoc_default || []).filter(v => (data.tdocs || []).includes(v));
        if (defaultsTdoc.length) this.msTdoc.setSelectedValues(defaultsTdoc);
    }

    crearMulti(nombre, valores) {
        return new CustomMultiSelect({
            btnId: `ms-${nombre}-btn`,
            labelId: `ms-${nombre}-label`,
            dropdownId: `ms-${nombre}-dropdown`,
            searchId: `ms-${nombre}-search`,
            optionsContainerId: `ms-${nombre}-options`,
            title: nombre,
            options: valores.map(v => ({ id: v, label: v, selected: true }))
        });
    }

    obtenerFiltros() {
        const rango = (typeof PeriodoHelper !== 'undefined' && PeriodoHelper.obtenerRangoFechas)
            ? PeriodoHelper.obtenerRangoFechas() : {};

        const zonasSel = this.msZona ? this.msZona.getSelectedValues() : [];
        const rutasSel = this.msRuta ? this.msRuta.getSelectedValues() : [];
        const placasSel = this.msPlaca ? this.msPlaca.getSelectedValues() : [];
        const zonasTodas = !this.msZona || zonasSel.length === this.msZona.options.length;
        const rutasTodas = !this.msRuta || rutasSel.length === this.msRuta.options.length;
        const placasTodas = !this.msPlaca || placasSel.length === this.msPlaca.options.length;

        return {
            fecha_inicio: rango.fechaInicio || rango.inicio || '',
            fecha_fin: rango.fechaFin || rango.fin || '',
            linea: this.searchLinea ? this.searchLinea.getValue() : '',
            tdocs: this.msTdoc ? this.msTdoc.getSelectedValues() : [],
            zonas: zonasTodas ? [] : zonasSel,
            rutas: rutasTodas ? [] : rutasSel,
            placas: placasTodas ? [] : placasSel,
            placas_todas: placasTodas,
            seleccion_fecha: this.seleccionVentas.fecha,
            seleccion_placa: this.seleccionVentas.placa,
            page_ventas: this.paginas.ventas,
            page_transportes: this.paginas.transportes,
            page_agcausal: this.paginas.agcausal,
            page_mermas: this.paginas.mermas,
            page_size: 100
        };
    }

    setBotonCargando(estado) {
        const btn = document.getElementById('btn-cargar');
        if (!btn) return;
        if (estado) {
            btn.dataset.html = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>Cargando...</span>';
        } else {
            btn.disabled = false;
            if (btn.dataset.html) btn.innerHTML = btn.dataset.html;
        }
    }

    async cargar(conservarSeleccion = false) {
        if (!conservarSeleccion) {
            this.reiniciarEstadoSeleccion();
            this.paginas = { ventas: 1, transportes: 1, agcausal: 1, mermas: 1 };
        }
        const contenedor = document.getElementById('contenedor-correlacion');
        if (!contenedor) return;
        this.setBotonCargando(true);
        contenedor.innerHTML = '<div class="p-10 text-center bg-white border border-slate-200 rounded-2xl text-slate-500"><i class="fa-solid fa-spinner fa-spin text-blue-600 text-2xl mb-2"></i><p class="text-sm font-semibold">Consultando correlación...</p></div>';
        try {
            const data = await this.service.obtenerDashboard(this.obtenerFiltros());
            this.datos = data;
            window.CorrelacionGralView.render(this, data, 'contenedor-correlacion');
            if (!this.seleccionVentas.fecha) this.precargarSiAplica();
        } catch (error) {
            console.error('Error Correlación General:', error);
            contenedor.innerHTML = `<div class="p-8 text-center bg-white border border-rose-200 rounded-xl text-rose-700 font-semibold">${error.message || 'No se pudo cargar la información.'}</div>`;
        } finally {
            this.setBotonCargando(false);
        }
    }

    setTablaCargando(tabla, estado) {
        const wrapper = document.getElementById('corr-card-' + tabla);
        if (!wrapper) return;
        wrapper.classList.toggle('opacity-60', !!estado);
        if (estado) {
            wrapper.querySelectorAll('[data-page-key]').forEach(btn => { btn.disabled = true; });
        }
    }

    restaurarPaginacion(tabla) {
        const wrapper = document.getElementById('corr-card-' + tabla);
        const seccion = this.datos ? this.datos[tabla] : null;
        if (!wrapper || !seccion) return;
        const size = Number(seccion.page_size) || 100;
        const pages = Math.max(1, Math.ceil((Number(seccion.total) || 0) / size));
        const page = Number(seccion.page) || 1;
        wrapper.querySelectorAll('[data-page-key]').forEach(btn => {
            const destino = Number(btn.getAttribute('data-page'));
            btn.disabled = destino < 1 || destino > pages || destino === page;
        });
    }

    reiniciarEstadoSeleccion() {
        this.seleccionVentas = { fecha: '', placa: '' };
        this.filasCompletas = null;
        this.modoMemoria = false;
        this.cacheSeleccion = {};
        this.snapshotPreSeleccion = null;
        this.seleccionFilas = { transportes: null, agcausal: null, mermas: null };
        this.seleccionServidor = { transportes: false, agcausal: false, mermas: false };
        this.seleccionSeq++;
        this.precargaSeq++;
    }

    firmaFiltros(filtros) {
        return [
            filtros.fecha_inicio,
            filtros.fecha_fin,
            filtros.linea,
            (filtros.tdocs || []).join(','),
            (filtros.zonas || []).join(','),
            (filtros.rutas || []).join(','),
            filtros.placas_todas ? 'TODO' : (filtros.placas || []).join(',')
        ].join('|');
    }

    limitarCacheSeleccion() {
        const claves = Object.keys(this.cacheSeleccion);
        while (claves.length > 10) {
            delete this.cacheSeleccion[claves.shift()];
        }
    }

    async precargarSiAplica() {
        if (!this.datos || this.seleccionVentas.fecha) return;
        const tablas = ['transportes', 'agcausal', 'mermas'];
        const aplica = tablas.every(t => Number(this.datos[t]?.total || 0) <= 1000);
        if (!aplica) {
            this.filasCompletas = null;
            this.modoMemoria = false;
            return;
        }

        const seq = ++this.precargaSeq;
        try {
            const filtros = this.obtenerFiltros();
            filtros.seleccion_fecha = '';
            filtros.seleccion_placa = '';
            const data = await this.service.obtenerSeleccion(filtros);
            if (seq !== this.precargaSeq) return;
            const completo = tablas.every(t => data[t] && data[t].completo);
            if (!completo) {
                this.filasCompletas = null;
                this.modoMemoria = false;
                return;
            }
            this.filasCompletas = {
                transportes: data.transportes.rows || [],
                agcausal: data.agcausal.rows || [],
                mermas: data.mermas.rows || []
            };
            this.modoMemoria = true;
        } catch (error) {
            if (seq === this.precargaSeq) {
                this.filasCompletas = null;
                this.modoMemoria = false;
            }
            console.warn('No se pudo precargar la selección cruzada:', error);
        }
    }

    guardarSnapshotSeleccion() {
        if (this.snapshotPreSeleccion || !this.datos) return;
        const snapshot = { datos: {}, paginas: {} };
        ['transportes', 'agcausal', 'mermas'].forEach(tabla => {
            snapshot.datos[tabla] = this.datos[tabla] || null;
            snapshot.paginas[tabla] = this.paginas[tabla] || 1;
        });
        this.snapshotPreSeleccion = snapshot;
    }

    async obtenerDatosSeleccion(fecha, placa) {
        const tablas = ['transportes', 'agcausal', 'mermas'];

        if (this.modoMemoria && this.filasCompletas) {
            const resultado = {};
            const placaSel = String(placa || '').replace(/-/g, '');
            tablas.forEach(tabla => {
                const filas = (this.filasCompletas[tabla] || []).filter(r => {
                    const placaFila = String(r.placa || '').replace(/-/g, '');
                    return r.fecha === fecha && placaFila === placaSel;
                });
                resultado[tabla] = { rows: filas, total: filas.length, completo: true };
            });
            return resultado;
        }

        const filtros = this.obtenerFiltros();
        const clave = this.firmaFiltros(filtros) + '||' + fecha + '|' + placa;
        if (this.cacheSeleccion[clave]) return this.cacheSeleccion[clave];

        filtros.seleccion_fecha = fecha;
        filtros.seleccion_placa = placa;
        const data = await this.service.obtenerSeleccion(filtros);

        const resultado = {};
        tablas.forEach(tabla => {
            const seccion = data[tabla] || { rows: [], total: 0, completo: true };
            resultado[tabla] = {
                rows: seccion.rows || [],
                total: Number(seccion.total) || 0,
                completo: seccion.completo !== false
            };
        });

        this.cacheSeleccion[clave] = resultado;
        this.limitarCacheSeleccion();
        return resultado;
    }

    aplicarDatosSeleccion(datos) {
        const tablas = ['transportes', 'agcausal', 'mermas'];
        if (!this.datos) this.datos = {};

        tablas.forEach(tabla => {
            const seccion = datos[tabla] || { rows: [], total: 0, completo: true };
            const size = Number(this.datos[tabla]?.page_size) || 100;
            const filas = Array.isArray(seccion.rows) ? seccion.rows : [];
            const completo = seccion.completo !== false;
            const total = completo ? filas.length : (Number(seccion.total) || filas.length);

            this.paginas[tabla] = 1;
            this.seleccionFilas[tabla] = completo ? filas : null;
            this.seleccionServidor[tabla] = !completo;
            this.datos[tabla] = {
                rows: filas.slice(0, size),
                total: total,
                page: 1,
                page_size: size
            };
            window.CorrelacionGralView.actualizarTabla(this, tabla, this.datos[tabla], this.datos);
        });
    }

    async seleccionarVenta(fecha, placa) {
        if (!fecha || !placa) return;

        if (this.seleccionVentas.fecha === fecha && this.seleccionVentas.placa === placa) {
            await this.limpiarSeleccion();
            return;
        }

        const tablas = ['transportes', 'agcausal', 'mermas'];
        const previa = { ...this.seleccionVentas };
        const estadoPrevio = {
            datos: {},
            paginas: {},
            filas: { ...this.seleccionFilas },
            servidor: { ...this.seleccionServidor }
        };
        tablas.forEach(tabla => {
            estadoPrevio.datos[tabla] = this.datos ? this.datos[tabla] : null;
            estadoPrevio.paginas[tabla] = this.paginas[tabla] || 1;
        });

        if (!previa.fecha) this.guardarSnapshotSeleccion();
        this.seleccionVentas = { fecha, placa };
        this.seleccionFilas = { transportes: null, agcausal: null, mermas: null };
        this.seleccionServidor = { transportes: false, agcausal: false, mermas: false };

        const seq = ++this.seleccionSeq;
        tablas.forEach(tabla => {
            this.paginas[tabla] = 1;
            this.setTablaCargando(tabla, true);
        });

        try {
            const datos = await this.obtenerDatosSeleccion(fecha, placa);
            if (seq !== this.seleccionSeq) return;
            this.aplicarDatosSeleccion(datos);
            window.CorrelacionGralView.actualizarSeleccionVentas(this);
        } catch (error) {
            if (seq !== this.seleccionSeq) return;
            console.error('Error en selección cruzada:', error);
            this.seleccionVentas = previa;
            this.seleccionFilas = estadoPrevio.filas;
            this.seleccionServidor = estadoPrevio.servidor;
            tablas.forEach(tabla => {
                if (estadoPrevio.datos[tabla]) this.datos[tabla] = estadoPrevio.datos[tabla];
                this.paginas[tabla] = estadoPrevio.paginas[tabla];
            });
            if (!previa.fecha) this.snapshotPreSeleccion = null;
            window.CorrelacionGralView.actualizarSeleccionVentas(this);
        } finally {
            if (seq === this.seleccionSeq) {
                tablas.forEach(tabla => this.setTablaCargando(tabla, false));
            }
        }
    }

    async limpiarSeleccion() {
        const tablas = ['transportes', 'agcausal', 'mermas'];
        this.seleccionVentas = { fecha: '', placa: '' };
        this.seleccionSeq++;
        this.seleccionFilas = { transportes: null, agcausal: null, mermas: null };
        this.seleccionServidor = { transportes: false, agcausal: false, mermas: false };
        window.CorrelacionGralView.actualizarSeleccionVentas(this);

        const snapshot = this.snapshotPreSeleccion;
        if (!snapshot) {
            tablas.forEach(tabla => this.setTablaCargando(tabla, false));
            return;
        }

        tablas.forEach(tabla => {
            if (snapshot.datos[tabla]) this.datos[tabla] = snapshot.datos[tabla];
            this.paginas[tabla] = snapshot.paginas[tabla] || 1;
            this.setTablaCargando(tabla, false);
            if (this.datos[tabla]) {
                window.CorrelacionGralView.actualizarTabla(this, tabla, this.datos[tabla], this.datos);
            }
        });
        this.snapshotPreSeleccion = null;
    }

    async cambiarPagina(tabla, pagina) {
        if (!tabla || !(tabla in this.paginas) || pagina < 1) return;
        if (this.paginando[tabla]) return;

        if (this.seleccionVentas.fecha && this.seleccionFilas[tabla]) {
            const size = Number(this.datos?.[tabla]?.page_size) || 100;
            const filas = this.seleccionFilas[tabla];
            const pages = Math.max(1, Math.ceil(filas.length / size));
            const destino = Math.min(Math.max(1, pagina), pages);
            this.paginas[tabla] = destino;
            this.datos[tabla] = {
                rows: filas.slice((destino - 1) * size, destino * size),
                total: filas.length,
                page: destino,
                page_size: size
            };
            window.CorrelacionGralView.actualizarTabla(this, tabla, this.datos[tabla], this.datos);
            return;
        }

        const wrapper = document.getElementById('corr-card-' + tabla);
        if (!wrapper) return;

        this.paginando[tabla] = true;
        this.setTablaCargando(tabla, true);
        try {
            const filtros = this.obtenerFiltros();
            filtros.page = pagina;
            const seccion = await this.service.obtenerTabla(tabla, filtros);
            this.paginas[tabla] = Number(seccion.page) || pagina;
            if (!this.datos) this.datos = {};
            this.datos[tabla] = seccion;
            window.CorrelacionGralView.actualizarTabla(this, tabla, seccion, this.datos);
        } catch (error) {
            console.error('Error paginando ' + tabla + ':', error);
            this.restaurarPaginacion(tabla);
        } finally {
            this.paginando[tabla] = false;
            this.setTablaCargando(tabla, false);
        }
    }

    async limpiar() {
        const sel = document.getElementById('select-tipo-periodo');
        if (sel) sel.value = 'entre_fechas';
        this.setupPeriodo();
        this.seleccionVentas = { fecha: '', placa: '' };
        this.searchLinea?.setValue('', false);
        this.msTdoc?.selectAll();
        this.msZona?.selectAll();
        this.msRuta?.selectAll();
        this.msPlaca?.selectAll();
        await this.cargar(false);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.correlacionGralController = new CorrelacionGralController();
});
