/**
 * LoadingHelper - Componente reutilizable para gestión de estados de carga (UX) en gráficos
 * 
 * Permite:
 * 1. Overlay de carga inicial de página con barra y porcentaje de progreso.
 * 2. Spinner, barra de progreso y mensajes de carga en el contenedor principal de gráficos.
 * 3. Feedback visual interactivo en botones de consulta / recarga (deshabilitar + animación spinner).
 * 4. Mensajes estandarizados de estados vacíos y errores.
 *
 * El progreso es estimado por defecto y se puede sobrescribir por etapas con
 * actualizarProgreso() / actualizarProgresoInicial().
 */
const LoadingHelper = {
    _botonesOriginales: new WeakMap(),
    _progresos: new Map(),
    _overlayHideTimer: null,
    _idOverlayInicial: 'loader-inicial-pagina',
    _idLoaderContenedor: 'loader-graficos',

    /**
     * Resuelve un elemento DOM o lo busca por su ID si es string
     * @private
     */
    _resolverElemento(elementoOId) {
        if (!elementoOId) return null;
        if (typeof elementoOId === 'string') {
            return document.getElementById(elementoOId.replace(/^#/, ''));
        }
        return elementoOId instanceof HTMLElement ? elementoOId : null;
    },

    _detenerProgreso(id) {
        const entrada = this._progresos.get(id);
        if (!entrada) return;

        if (entrada.interval) clearInterval(entrada.interval);
        this._progresos.delete(id);
    },

    _detenerProgresosEn(contenedor) {
        if (!contenedor) return;

        for (const [id, entrada] of this._progresos) {
            const loader = entrada.loader;
            if (!loader || loader === contenedor || contenedor.contains(loader)) {
                if (entrada.interval) clearInterval(entrada.interval);
                this._progresos.delete(id);
            }
        }
    },

    _fijarProgreso(loader, porcentaje, mensaje = null) {
        if (!loader) return 0;

        const numero = Number(porcentaje);
        const pct = Number.isFinite(numero) ? Math.max(0, Math.min(100, numero)) : 0;
        const redondeado = Math.round(pct);
        const barra = loader.querySelector('[data-loading-bar]');
        const textoPct = loader.querySelector('[data-loading-pct]');
        const textoMsg = loader.querySelector('[data-loading-msg]');
        const progressbar = loader.querySelector('[role="progressbar"]');

        if (barra) barra.style.width = `${pct}%`;
        if (textoPct) textoPct.textContent = `${redondeado}%`;
        if (textoMsg && mensaje) textoMsg.textContent = mensaje;
        if (progressbar) progressbar.setAttribute('aria-valuenow', String(redondeado));

        return pct;
    },

    _asegurarProgresoInicial(overlay) {
        if (!overlay) return;

        if (overlay.querySelector('[data-loading-progress]')) return;

        const card = overlay.querySelector('.max-w-xs') || overlay.firstElementChild;
        if (!card) return;

        const bloque = document.createElement('div');
        bloque.className = 'w-full max-w-[220px]';
        bloque.setAttribute('data-loading-progress', '');
        bloque.innerHTML = `
            <div class="flex items-center justify-between text-[10px] font-semibold text-slate-500 mb-1.5">
                <span data-loading-msg>Preparando...</span>
                <span data-loading-pct>0%</span>
            </div>
            <div class="h-1.5 w-full bg-blue-100 rounded-full overflow-hidden" role="progressbar"
                aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
                <div data-loading-bar class="h-full bg-blue-600 rounded-full transition-all duration-300 ease-out" style="width: 0%;"></div>
            </div>
        `;

        card.appendChild(bloque);
    },

    _iniciarProgreso(id, loader, options = {}) {
        if (!loader) return;

        this._detenerProgreso(id);

        const inicial = Number.isFinite(Number(options.progreso)) ? Number(options.progreso) : 0;
        let actual = this._fijarProgreso(loader, inicial, options.mensaje || null);

        if (options.simularProgreso === false || actual >= 100) {
            this._progresos.set(id, { loader, interval: null, actual });
            return;
        }

        const duracion = Number(options.duracionEstimada) > 0
            ? Number(options.duracionEstimada)
            : (id === this._idOverlayInicial ? 5000 : 9000);
        const pasoBase = Math.max(0.35, Math.min(2.2, 9000 / duracion));

        const interval = setInterval(() => {
            actual = Math.min(94, actual + Math.max(pasoBase, (94 - actual) * 0.035));
            actual = this._fijarProgreso(loader, actual);
            const entrada = this._progresos.get(id);

            if (entrada) entrada.actual = actual;
            if (actual >= 93.5 && entrada) {
                clearInterval(interval);
                entrada.interval = null;
            }
        }, 150);

        this._progresos.set(id, { loader, interval, actual });
    },

    /**
     * Actualiza manualmente el progreso de un loader de contenedor.
     * Al usarse, se detiene la simulación automática de ese loader.
     */
    actualizarProgreso(contenedorOId, porcentaje, mensaje = null, idLoader = null) {
        const contenedor = this._resolverElemento(contenedorOId);
        let loader = idLoader ? document.getElementById(idLoader) : null;

        if (!loader && contenedor) {
            loader = contenedor.querySelector('[data-loading-progress]');
        }
        if (!loader) {
            loader = document.getElementById(this._idLoaderContenedor);
        }
        if (!loader) return;

        const id = loader.id || this._idLoaderContenedor;
        this._detenerProgreso(id);
        this._fijarProgreso(loader, porcentaje, mensaje);
    },

    /**
     * Actualiza manualmente el progreso del overlay inicial.
     */
    actualizarProgresoInicial(porcentaje, mensaje = null) {
        const overlay = document.getElementById(this._idOverlayInicial);
        if (!overlay) return;

        this._asegurarProgresoInicial(overlay);
        this._detenerProgreso(this._idOverlayInicial);
        this._fijarProgreso(overlay, porcentaje, mensaje);
    },

    // =========================================================================
    // 1. OVERLAY DE CARGA INICIAL (PÁGINA COMPLETA / FILTROS)
    // =========================================================================

    /**
     * Muestra o genera dinámicamente el overlay de carga inicial de página
     * @param {Object} options
     * @param {string} options.titulo Título del loader (ej: 'Cargando Saldos por Cobrar')
     * @param {string} options.subtitulo Mensaje explicativo (ej: 'Obteniendo filtros y configuración...')
     */
    mostrarInicial(options = {}) {
        const titulo = options.titulo || 'Cargando módulo';
        const subtitulo = options.subtitulo || 'Obteniendo filtros y configuración inicial...';

        if (this._overlayHideTimer) {
            clearTimeout(this._overlayHideTimer);
            this._overlayHideTimer = null;
        }

        let overlay = document.getElementById(this._idOverlayInicial);

        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = this._idOverlayInicial;
            overlay.className = 'fixed inset-0 z-50 bg-slate-50/90 backdrop-blur-xs flex flex-col items-center justify-center transition-opacity duration-300';
            overlay.innerHTML = `
                <div class="flex flex-col items-center gap-4 bg-white p-6 sm:p-8 rounded-2xl shadow-xl border border-slate-200/90 text-center max-w-xs mx-4">
                    <div class="relative flex items-center justify-center">
                        <div class="w-12 h-12 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin"></div>
                        <div class="absolute inset-0 flex items-center justify-center text-blue-600">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z">
                                </path>
                            </svg>
                        </div>
                    </div>
                    <div class="w-full">
                        <h3 class="text-sm font-bold text-slate-800" id="${this._idOverlayInicial}-titulo">${titulo}</h3>
                        <p class="text-xs text-slate-500 mt-1" id="${this._idOverlayInicial}-subtitulo">${subtitulo}</p>
                    </div>
                    <div class="w-full max-w-[220px]" data-loading-progress>
                        <div class="flex items-center justify-between text-[10px] font-semibold text-slate-500 mb-1.5">
                            <span data-loading-msg>Preparando...</span>
                            <span data-loading-pct>0%</span>
                        </div>
                        <div class="h-1.5 w-full bg-blue-100 rounded-full overflow-hidden" role="progressbar"
                            aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
                            <div data-loading-bar class="h-full bg-blue-600 rounded-full transition-all duration-300 ease-out" style="width: 0%;"></div>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);
        } else {
            const elTitulo = document.getElementById(`${this._idOverlayInicial}-titulo`) || overlay.querySelector('h3');
            const elSubtitulo = document.getElementById(`${this._idOverlayInicial}-subtitulo`) || overlay.querySelector('p');
            if (elTitulo && options.titulo) elTitulo.textContent = options.titulo;
            if (elSubtitulo && options.subtitulo) elSubtitulo.textContent = options.subtitulo;
            overlay.classList.remove('opacity-0', 'pointer-events-none', 'hidden');
        }

        this._asegurarProgresoInicial(overlay);
        this._iniciarProgreso(this._idOverlayInicial, overlay, options);
    },

    /**
     * Oculta con transición suave el overlay de carga inicial
     */
    ocultarInicial() {
        const overlay = document.getElementById(this._idOverlayInicial);
        if (!overlay) return;

        this._detenerProgreso(this._idOverlayInicial);
        this._fijarProgreso(overlay, 100);

        overlay.classList.add('opacity-0', 'pointer-events-none');
        this._overlayHideTimer = setTimeout(() => {
            if (overlay.parentNode) {
                overlay.remove();
            }
            this._overlayHideTimer = null;
        }, 300);
    },

    // =========================================================================
    // 2. LOADING EN CONTENEDOR DE GRÁFICOS
    // =========================================================================

    /**
     * Muestra una tarjeta estilizada de carga dentro del contenedor especificado
     * @param {HTMLElement|string} contenedorOId Contenedor DOM o su ID
     * @param {Object} options
     * @param {string} options.titulo Título del estado de carga (ej: 'Cargando gráficos...')
     * @param {string} options.subtitulo Mensaje secundario (ej: 'Consultando datos del servidor...')
     * @param {boolean} options.reemplazarContenido Si es true (default), reemplaza el contenido interno del contenedor
     */
    mostrarEnContenedor(contenedorOId, options = {}) {
        const contenedor = this._resolverElemento(contenedorOId);
        if (!contenedor) return;

        const titulo = options.titulo || 'Cargando gráficos...';
        const subtitulo = options.subtitulo || 'Consultando y procesando la información del servidor';
        const idLoader = options.id || this._idLoaderContenedor;
        const reemplazar = options.reemplazarContenido !== false;

        this._detenerProgresosEn(contenedor);

        const htmlLoader = `
            <div id="${idLoader}" data-loading-progress class="col-span-full py-16 px-6 flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-200/90 shadow-xs text-center animate-in fade-in duration-200">
                <div class="relative flex items-center justify-center mb-3">
                    <div class="w-10 h-10 rounded-full border-3 border-blue-100 border-t-blue-600 animate-spin"></div>
                </div>
                <h4 class="text-sm font-bold text-slate-800">${titulo}</h4>
                <p class="text-xs text-slate-500 mt-1">${subtitulo}</p>
                <div class="w-full max-w-[280px] mt-3" data-loading-progress>
                    <div class="flex items-center justify-between text-[10px] font-semibold text-slate-500 mb-1.5">
                        <span data-loading-msg>Procesando...</span>
                        <span data-loading-pct>0%</span>
                    </div>
                    <div class="h-1.5 w-full bg-blue-100 rounded-full overflow-hidden" role="progressbar"
                        aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
                        <div data-loading-bar class="h-full bg-blue-600 rounded-full transition-all duration-300 ease-out" style="width: 0%;"></div>
                    </div>
                </div>
            </div>
        `;

        if (reemplazar) {
            contenedor.innerHTML = htmlLoader;
        } else {
            // Remueve loader previo si existiese y agrega el nuevo
            const previo = document.getElementById(idLoader);
            if (previo) previo.remove();
            contenedor.insertAdjacentHTML('afterbegin', htmlLoader);
        }

        const loader = document.getElementById(idLoader);
        this._iniciarProgreso(idLoader, loader, options);
    },

    /**
     * Remueve el elemento loader del contenedor si está presente
     * @param {HTMLElement|string} contenedorOId
     * @param {string} [idLoader] ID del elemento loader
     */
    ocultarEnContenedor(contenedorOId, idLoader = null) {
        const targetId = idLoader || this._idLoaderContenedor;
        const loader = document.getElementById(targetId);

        this._detenerProgreso(targetId);
        if (!loader) return;

        this._fijarProgreso(loader, 100);
        setTimeout(() => {
            if (loader.parentNode && document.getElementById(targetId) === loader) {
                loader.remove();
            }
        }, 180);
    },

    // =========================================================================
    // 3. ESTADO DE CARGA EN BOTONES (CARGAR / RECARGA / ACCIÓN)
    // =========================================================================

    /**
     * Activa el estado de carga en un botón (deshabilita, gira icono y cambia texto)
     * @param {HTMLElement|string} botonOId Botón DOM o su ID (ej: 'btn-cargar')
     * @param {Object} options
     * @param {string} options.texto Texto temporal (default: 'Cargando...')
     */
    iniciarBoton(botonOId, options = {}) {
        const btn = this._resolverElemento(botonOId);
        if (!btn) return;

        const textoCarga = options.texto || 'Cargando...';
        const icono = btn.querySelector('svg, i');
        const spanTexto = btn.querySelector('span');

        // Guardar estado original si aún no ha sido guardado
        if (!this._botonesOriginales.has(btn)) {
            this._botonesOriginales.set(btn, {
                texto: spanTexto ? spanTexto.textContent : btn.textContent,
                disabled: btn.disabled
            });
        }

        btn.disabled = true;
        btn.classList.add('opacity-75', 'cursor-not-allowed');

        if (icono) {
            icono.classList.add('animate-spin');
        }

        if (spanTexto) {
            spanTexto.textContent = textoCarga;
        }
    },

    /**
     * Restaura el botón a su estado normal interactivo
     * @param {HTMLElement|string} botonOId
     */
    restaurarBoton(botonOId) {
        const btn = this._resolverElemento(botonOId);
        if (!btn) return;

        const estadoPrevio = this._botonesOriginales.get(btn);
        const icono = btn.querySelector('svg, i');
        const spanTexto = btn.querySelector('span');

        btn.disabled = estadoPrevio ? estadoPrevio.disabled : false;
        btn.classList.remove('opacity-75', 'cursor-not-allowed');

        if (icono) {
            icono.classList.remove('animate-spin');
        }

        if (spanTexto && estadoPrevio) {
            spanTexto.textContent = estadoPrevio.texto;
        }

        this._botonesOriginales.delete(btn);
    },

    // =========================================================================
    // 4. MENSAJES DE ESTADOS VACÍOS O ERRORES
    // =========================================================================

    /**
     * Muestra un mensaje amigable cuando no hay datos seleccionados o encontrados
     * @param {HTMLElement|string} contenedorOId
     * @param {Object} options
     * @param {string} options.mensaje Mensaje principal
     * @param {string} options.subtitulo Mensaje secundario opcional
     */
    mostrarVacio(contenedorOId, options = {}) {
        const contenedor = this._resolverElemento(contenedorOId);
        if (!contenedor) return;

        const mensaje = options.mensaje || 'No hay datos seleccionados para consultar.';
        const subtitulo = options.subtitulo || '';

        this._detenerProgresosEn(contenedor);
        contenedor.innerHTML = `
            <div class="col-span-full p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 font-medium shadow-xs animate-in fade-in duration-200">
                <div class="flex flex-col items-center justify-center gap-1.5">
                    <svg class="w-8 h-8 text-slate-300 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4">
                        </path>
                    </svg>
                    <span class="text-sm text-slate-600 font-semibold">${mensaje}</span>
                    ${subtitulo ? `<span class="text-xs text-slate-400">${subtitulo}</span>` : ''}
                </div>
            </div>
        `;
    },

    /**
     * Muestra un mensaje de error estilizado dentro del contenedor
     * @param {HTMLElement|string} contenedorOId
     * @param {Object} options
     * @param {string} options.mensaje Mensaje de error
     * @param {string} options.detalle Detalle técnico opcional
     */
    mostrarError(contenedorOId, options = {}) {
        const contenedor = this._resolverElemento(contenedorOId);
        if (!contenedor) return;

        const mensaje = options.mensaje || 'Ocurrió un error al consultar el servidor.';
        const detalle = options.detalle || 'Por favor, verifique su conexión o intente nuevamente.';

        this._detenerProgresosEn(contenedor);
        contenedor.innerHTML = `
            <div class="col-span-full p-8 text-center bg-white rounded-2xl border border-rose-100 bg-rose-50/20 text-rose-600 font-medium shadow-xs animate-in fade-in duration-200">
                <div class="flex flex-col items-center justify-center gap-1.5">
                    <svg class="w-8 h-8 text-rose-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z">
                        </path>
                    </svg>
                    <span class="text-sm font-bold text-rose-700">${mensaje}</span>
                    <span class="text-xs text-rose-500">${detalle}</span>
                </div>
            </div>
        `;
    }
};

window.LoadingHelper = LoadingHelper;
