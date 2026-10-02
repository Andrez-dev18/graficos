/**
 * LoadingHelper - Componente reutilizable para gestión de estados de carga (UX) en gráficos
 * 
 * Permite:
 * 1. Overlay de carga inicial de página (mientras se obtienen los filtros iniciales).
 * 2. Spinner y mensajes de carga en el contenedor principal de gráficos.
 * 3. Feedback visual interactivo en botones de consulta / recarga (deshabilitar + animación spinner).
 * 4. Mensajes estandarizados de estados vacíos y errores.
 */
const LoadingHelper = {
    _botonesOriginales: new WeakMap(),
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
                    <div>
                        <h3 class="text-sm font-bold text-slate-800" id="${this._idOverlayInicial}-titulo">${titulo}</h3>
                        <p class="text-xs text-slate-500 mt-1" id="${this._idOverlayInicial}-subtitulo">${subtitulo}</p>
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
    },

    /**
     * Oculta con transición suave el overlay de carga inicial
     */
    ocultarInicial() {
        const overlay = document.getElementById(this._idOverlayInicial);
        if (!overlay) return;

        overlay.classList.add('opacity-0', 'pointer-events-none');
        setTimeout(() => {
            if (overlay.parentNode) {
                overlay.remove();
            }
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

        const htmlLoader = `
            <div id="${idLoader}" class="col-span-full py-16 px-6 flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-200/90 shadow-xs text-center animate-in fade-in duration-200">
                <div class="relative flex items-center justify-center mb-3">
                    <div class="w-10 h-10 rounded-full border-3 border-blue-100 border-t-blue-600 animate-spin"></div>
                </div>
                <h4 class="text-sm font-bold text-slate-800">${titulo}</h4>
                <p class="text-xs text-slate-500 mt-1">${subtitulo}</p>
            </div>
        `;

        if (reemplazar) {
            contenedor.innerHTML = htmlLoader;
        } else {
            // Remueve loader previo si existiese y agrega el nuevo
            this.ocultarEnContenedor(contenedor, idLoader);
            contenedor.insertAdjacentHTML('afterbegin', htmlLoader);
        }
    },

    /**
     * Remueve el elemento loader del contenedor si está presente
     * @param {HTMLElement|string} contenedorOId
     * @param {string} [idLoader] ID del elemento loader
     */
    ocultarEnContenedor(contenedorOId, idLoader = null) {
        const targetId = idLoader || this._idLoaderContenedor;
        const loader = document.getElementById(targetId);
        if (loader) {
            loader.remove();
        }
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
