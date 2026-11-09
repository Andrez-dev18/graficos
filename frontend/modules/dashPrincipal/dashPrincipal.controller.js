const PALETA_CATEGORIAS = [
    { iconoBg: 'bg-blue-50', iconoTexto: 'text-blue-600', badge: 'bg-blue-50 text-blue-700' },
    { iconoBg: 'bg-emerald-50', iconoTexto: 'text-emerald-600', badge: 'bg-emerald-50 text-emerald-700' },
    { iconoBg: 'bg-amber-50', iconoTexto: 'text-amber-600', badge: 'bg-amber-50 text-amber-700' },
    { iconoBg: 'bg-violet-50', iconoTexto: 'text-violet-600', badge: 'bg-violet-50 text-violet-700' },
    { iconoBg: 'bg-cyan-50', iconoTexto: 'text-cyan-600', badge: 'bg-cyan-50 text-cyan-700' },
    { iconoBg: 'bg-rose-50', iconoTexto: 'text-rose-600', badge: 'bg-rose-50 text-rose-700' }
];

class DashPrincipalController {
    constructor() {
        this.servicioDashboard = new DashPrincipalService();
        this.catalogo = [];
        this.catalogoPorCodigo = {};
        this.categorias = [];
        this.misAccesos12 = [];
        this.modoEdicionActivo = false;
        this.casillaSeleccionadaIndex = null;
        this.categoriaFiltroActual = 'TODOS';
        this.ultimoConsultado = null;
        this.masFrecuente = null;
    }

    async init() {
        try {
            localStorage.removeItem('corebi_accesos_directos_12');
        } catch (error) {
            console.warn('No se pudo limpiar el almacenamiento local:', error);
        }

        const resumenOk = await this.cargarResumen();

        if (resumenOk) {
            await this.cargarAccesos();
        }
    }

    async cargarResumen() {
        try {
            const data = await this.servicioDashboard.obtenerResumen();

            this.aplicarUsuario(data.usuario);

            this.catalogo = Array.isArray(data.catalogo) ? data.catalogo : [];
            this.catalogoPorCodigo = {};

            this.catalogo.forEach(item => {
                this.catalogoPorCodigo[item.cod_mod] = item;
            });

            this.renderizarKpis(data.kpis || {});
            this.renderizarFiltrosCategorias();

            return true;
        } catch (error) {
            console.error('Error cargando el dashboard:', error);
            this.cargarNombreDesdeSesion();

            document.getElementById('kpiTotalModulos').textContent = '—';
            document.getElementById('kpiConsultasHoy').textContent = '—';
            document.getElementById('contenedorCuadricula12').innerHTML = `
                <div class="col-span-full rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                    No se pudieron cargar los módulos. Recarga la página o contacta al administrador.
                </div>
            `;

            return false;
        }
    }

    aplicarUsuario(usuario) {
        const elNombre = document.getElementById('lblNombreUsuario');

        if (elNombre && usuario && usuario.nombre) {
            elNombre.textContent = usuario.nombre;
            return;
        }

        this.cargarNombreDesdeSesion();
    }

    cargarNombreDesdeSesion() {
        try {
            const userRaw = sessionStorage.getItem('usuario');
            const elNombre = document.getElementById('lblNombreUsuario');

            if (userRaw && elNombre) {
                const usuario = JSON.parse(userRaw);
                if (usuario.nombre) {
                    elNombre.textContent = usuario.nombre;
                }
            }
        } catch (error) {
            console.warn('No se pudo leer el usuario de la sesión:', error);
        }
    }

    renderizarKpis(kpis) {
        document.getElementById('kpiTotalModulos').textContent = `${kpis.modulosAsignados || 0} módulos`;
        document.getElementById('kpiConsultasHoy').textContent = `${kpis.consultasHoy || 0} consultas`;

        this.renderizarUltimoConsultado(kpis.ultimoConsultado);
        this.renderizarMasFrecuente(kpis.masFrecuente);
    }

    renderizarUltimoConsultado(item) {
        const nombre = document.getElementById('kpiUltimoNombre');
        const tiempo = document.getElementById('kpiUltimoTiempo');
        const footer = document.getElementById('kpiUltimoFooter');
        const boton = document.getElementById('kpiUltimoBtn');

        if (item && item.cod_mod) {
            this.ultimoConsultado = item;
            nombre.textContent = item.nom_mod || 'Módulo';
            nombre.title = item.nom_mod || '';
            tiempo.textContent = this.formatearTiempoRelativo(item.fechaHora);
            footer.innerHTML = '<i class="fa-solid fa-arrow-rotate-right mr-1 text-[10px]"></i>Continuar donde estabas';
            boton.classList.remove('hidden');
            boton.classList.add('flex');
            return;
        }

        this.ultimoConsultado = null;
        nombre.textContent = 'Sin actividad reciente';
        nombre.title = '';
        tiempo.textContent = '—';
        footer.innerHTML = '<i class="fa-solid fa-arrow-rotate-right mr-1 text-[10px]"></i>Aún no has abierto ningún dashboard';
        boton.classList.add('hidden');
        boton.classList.remove('flex');
    }

    renderizarMasFrecuente(item) {
        const nombre = document.getElementById('kpiFrecuenteNombre');
        const detalle = document.getElementById('kpiFrecuenteDetalle');
        const actividad = document.getElementById('kpiFrecuenteActividad');
        const boton = document.getElementById('kpiFrecuenteBtn');

        if (item && item.cod_mod) {
            this.masFrecuente = item;
            nombre.textContent = item.nom_mod || 'Módulo';
            nombre.title = item.nom_mod || '';
            detalle.textContent = `${item.total || 0} consultas este mes`;
            actividad.innerHTML = `<i class="fa-solid fa-chart-pie mr-1 text-[10px]"></i>${item.porcentaje || 0}% de tu actividad`;
            boton.classList.remove('hidden');
            boton.classList.add('flex');
            return;
        }

        this.masFrecuente = null;
        nombre.textContent = 'Sin actividad este mes';
        nombre.title = '';
        detalle.textContent = '—';
        actividad.innerHTML = '<i class="fa-solid fa-chart-pie mr-1 text-[10px]"></i>Sin visitas registradas';
        boton.classList.add('hidden');
        boton.classList.remove('flex');
    }

    formatearTiempoRelativo(fechaHora) {
        if (!fechaHora) return '—';

        const fecha = new Date(String(fechaHora).replace(' ', 'T'));

        if (isNaN(fecha.getTime())) return '—';

        const segundos = Math.floor((Date.now() - fecha.getTime()) / 1000);

        if (segundos < 60) {
            return 'Hace menos de un minuto';
        }

        const minutos = Math.floor(segundos / 60);
        if (minutos < 60) {
            return `Hace ${minutos} minuto${minutos === 1 ? '' : 's'}`;
        }

        const horas = Math.floor(minutos / 60);
        if (horas < 24) {
            return `Hace ${horas} hora${horas === 1 ? '' : 's'}`;
        }

        const dias = Math.floor(horas / 24);
        if (dias < 7) {
            return `Hace ${dias} día${dias === 1 ? '' : 's'}`;
        }

        return fecha.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    }

    abrirUltimoConsultado() {
        if (!this.ultimoConsultado) return;
        this.navegarPorCodigo(this.ultimoConsultado.cod_mod, this.ultimoConsultado.url, this.ultimoConsultado.nom_mod);
    }

    abrirMasFrecuente() {
        if (!this.masFrecuente) return;
        this.navegarPorCodigo(this.masFrecuente.cod_mod, this.masFrecuente.url, this.masFrecuente.nom_mod);
    }

    navegarPorCodigo(codMod, urlFallback, tituloFallback) {
        const item = this.catalogoPorCodigo[codMod];

        this.navegarAModulo(
            item ? item.url : urlFallback,
            item ? (item.titulo || item.nom_mod) : tituloFallback,
            codMod,
            item ? item.tipo_param : ''
        );
    }

    async cargarAccesos() {
        try {
            const accesos = await this.servicioDashboard.obtenerAccesos();
            this.misAccesos12 = this.normalizarAccesos(accesos);
        } catch (error) {
            console.error('No se pudieron cargar los accesos directos:', error);
            this.misAccesos12 = this.normalizarAccesos([]);
        }

        this.renderizarCuadricula();
    }

    normalizarAccesos(lista) {
        const resultado = [];
        const vistos = {};

        if (!Array.isArray(lista)) {
            lista = [];
        }

        for (let i = 0; i < 12; i++) {
            const slot = lista[i];
            let codMod = null;

            if (typeof slot === 'string') {
                codMod = slot;
            } else if (slot && typeof slot === 'object' && slot.cod_mod) {
                codMod = slot.cod_mod;
            }

            const item = codMod ? this.catalogoPorCodigo[codMod] : null;

            if (item && !vistos[codMod]) {
                vistos[codMod] = true;
                resultado.push(this.crearObjetoAcceso(item));
            } else {
                resultado.push(null);
            }
        }

        return resultado;
    }

    crearObjetoAcceso(item) {
        const titulo = item.titulo || item.nom_mod || '';
        const url = item.url || '';
        const tipoParam = item.tipo_param || '';

        return {
            titulo: titulo,
            icon: item.icono || 'fa-solid fa-chart-line',
            actionArgs: `('${this.escaparComillaSimple(url)}', '${this.escaparComillaSimple(tipoParam)}', '${this.escaparComillaSimple(titulo)}')`,
            cod_mod: item.cod_mod
        };
    }

    escaparComillaSimple(valor) {
        return String(valor || '').replace(/'/g, "\\'");
    }

    obtenerEstiloCategoria(categoriaCod) {
        const index = this.categorias.findIndex(categoria => categoria.cod === categoriaCod);
        const posicion = index >= 0 ? index : 0;

        return PALETA_CATEGORIAS[posicion % PALETA_CATEGORIAS.length];
    }

    normalizarIcono(icono) {
        const prefijos = ['fas', 'far', 'fab', 'fa-solid', 'fa-regular', 'fa-brands'];

        const partes = String(icono || '')
            .split(/\s+/)
            .filter(clase => clase && !prefijos.includes(clase));

        return partes.length ? partes.join(' ') : '';
    }

    iconoModulo(item) {
        if (!item) return 'fa-chart-line';

        const icono = this.normalizarIcono(item.icono);

        if (icono && icono !== 'fa-circle') {
            return icono;
        }

        const iconoCategoria = this.normalizarIcono(item.categoria_icono);

        return iconoCategoria || 'fa-chart-line';
    }

    renderizarCuadricula() {
        const contenedor = document.getElementById('contenedorCuadricula12');
        if (!contenedor) return;

        let html = '';
        let conteoAsignados = 0;

        this.misAccesos12.forEach((acceso, index) => {
            const numeroCasilla = index + 1;
            const item = acceso && acceso.cod_mod ? this.catalogoPorCodigo[acceso.cod_mod] : null;

            if (item) {
                conteoAsignados++;
                const estilo = this.obtenerEstiloCategoria(item.categoria_cod);

                html += `
                    <div onclick="window.dashPrincipalController.clickEnCasilla(${index})"
                        class="group relative flex min-h-[104px] cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5 transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-sm">
                        <button type="button"
                            onclick="event.stopPropagation(); window.dashPrincipalController.quitarAccesoDirecto(${index})"
                            class="acceso-eliminar absolute -right-2 -top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow-sm hover:bg-red-600"
                            title="Quitar acceso"
                            aria-label="Quitar acceso">
                            <i class="fa-solid fa-xmark text-[10px]"></i>
                        </button>
                        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${estilo.iconoBg} ${estilo.iconoTexto}">
                            <i class="fa-solid ${this.iconoModulo(item)}"></i>
                        </div>
                        <div class="min-w-0 flex-1">
                            <div class="flex items-center justify-between gap-2">
                                <span class="text-[10px] font-medium text-slate-400">#${numeroCasilla}</span>
                                <span class="max-w-[120px] truncate rounded-full px-2 py-0.5 text-[10px] font-medium ${estilo.badge}">
                                    ${item.categoria_nom || 'Módulo'}
                                </span>
                            </div>
                            <h4 class="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-slate-800">
                                ${item.nom_mod}
                            </h4>
                            <div class="mt-2 flex items-center gap-1 text-[11px] font-medium text-slate-400 transition group-hover:text-blue-600">
                                <span>${this.modoEdicionActivo ? 'Cambiar módulo' : 'Abrir módulo'}</span>
                                <i class="fa-solid ${this.modoEdicionActivo ? 'fa-pen' : 'fa-arrow-right'} text-[9px]"></i>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                html += `
                    <div onclick="window.dashPrincipalController.abrirModalSeleccion(${index})"
                        class="group flex min-h-[104px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-3 text-center transition hover:border-blue-300 hover:bg-blue-50/40">
                        <div class="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-400 ring-1 ring-slate-200 transition group-hover:bg-blue-600 group-hover:text-white group-hover:ring-blue-600">
                            <i class="fa-solid fa-plus text-xs"></i>
                        </div>
                        <span class="mt-2 text-sm font-medium text-slate-500 transition group-hover:text-blue-700">Asignar módulo</span>
                        <span class="mt-0.5 text-[11px] text-slate-400">Espacio #${numeroCasilla}</span>
                    </div>
                `;
            }
        });

        contenedor.innerHTML = html;

        const badge = document.getElementById('badgeConteoAsignados');
        if (badge) {
            badge.textContent = `${conteoAsignados} de 12 asignados`;
        }
    }

    clickEnCasilla(index) {
        if (this.modoEdicionActivo) {
            this.abrirModalSeleccion(index);
            return;
        }

        const acceso = this.misAccesos12[index];

        if (!acceso || !acceso.cod_mod) {
            this.abrirModalSeleccion(index);
            return;
        }

        const item = this.catalogoPorCodigo[acceso.cod_mod];

        if (item) {
            this.navegarAModulo(item.url, item.titulo || item.nom_mod, item.cod_mod, item.tipo_param);
        }
    }

    toggleModoEdicion() {
        this.modoEdicionActivo = !this.modoEdicionActivo;

        const boton = document.getElementById('btnModoEdicion');
        const etiqueta = document.getElementById('lblModoEdicion');

        if (this.modoEdicionActivo) {
            boton.classList.remove('border-slate-300', 'bg-white', 'text-slate-600', 'hover:bg-slate-50');
            boton.classList.add('border-blue-600', 'bg-blue-600', 'text-white', 'hover:bg-blue-700');
            etiqueta.textContent = 'Listo';
        } else {
            boton.classList.remove('border-blue-600', 'bg-blue-600', 'text-white', 'hover:bg-blue-700');
            boton.classList.add('border-slate-300', 'bg-white', 'text-slate-600', 'hover:bg-slate-50');
            etiqueta.textContent = 'Editar';
        }

        this.renderizarCuadricula();
    }

    abrirModalSeleccion(index) {
        this.casillaSeleccionadaIndex = index;
        document.getElementById('lblModalNumeroCasilla').textContent = `#${index + 1}`;

        const botonQuitar = document.getElementById('btnQuitarAsignacion');

        if (this.misAccesos12[index]) {
            botonQuitar.classList.remove('hidden');
        } else {
            botonQuitar.classList.add('hidden');
        }

        document.getElementById('inputBuscarDashboardModal').value = '';
        this.categoriaFiltroActual = 'TODOS';

        this.renderizarFiltrosCategorias();
        this.renderizarCatalogoEnModal();
        document.getElementById('modalSeleccionarDashboard').classList.remove('hidden');
    }

    cerrarModalSeleccion() {
        document.getElementById('modalSeleccionarDashboard').classList.add('hidden');
        this.casillaSeleccionadaIndex = null;
    }

    renderizarFiltrosCategorias() {
        const contenedor = document.getElementById('filtrosCategoriasModal');
        if (!contenedor) return;

        this.categorias = [];
        const vistas = {};

        this.catalogo.forEach(item => {
            if (item.categoria_cod && !vistas[item.categoria_cod]) {
                vistas[item.categoria_cod] = true;
                this.categorias.push({
                    cod: item.categoria_cod,
                    nom: item.categoria_nom
                });
            }
        });

        let html = `
            <button type="button" onclick="window.dashPrincipalController.filtrarPorCategoriaModal('TODOS', this)"
                class="cat-pill active rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white transition">
                Todos
            </button>
        `;

        this.categorias.forEach(categoria => {
            html += `
                <button type="button" onclick="window.dashPrincipalController.filtrarPorCategoriaModal('${categoria.cod}', this)"
                    class="cat-pill rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-200">
                    ${categoria.nom}
                </button>
            `;
        });

        contenedor.innerHTML = html;
    }

    filtrarCatalogoModulos() {
        this.renderizarCatalogoEnModal();
    }

    filtrarPorCategoriaModal(categoriaCod, boton) {
        this.categoriaFiltroActual = categoriaCod;

        document.querySelectorAll('#filtrosCategoriasModal .cat-pill').forEach(pill => {
            pill.classList.remove('bg-blue-600', 'text-white', 'active');
            pill.classList.add('bg-slate-100', 'text-slate-600');
        });

        if (boton) {
            boton.classList.add('bg-blue-600', 'text-white', 'active');
            boton.classList.remove('bg-slate-100', 'text-slate-600');
        }

        this.renderizarCatalogoEnModal();
    }

    renderizarCatalogoEnModal() {
        const contenedor = document.getElementById('listaDashboardsModal');
        const busqueda = (document.getElementById('inputBuscarDashboardModal').value || '').toLowerCase().trim();

        const filtrados = this.catalogo.filter(item => {
            const coincideCategoria = this.categoriaFiltroActual === 'TODOS' || item.categoria_cod === this.categoriaFiltroActual;
            const texto = `${item.nom_mod || ''} ${item.titulo || ''} ${item.categoria_nom || ''}`.toLowerCase();
            const coincideBusqueda = busqueda === '' || texto.includes(busqueda);

            return coincideCategoria && coincideBusqueda;
        });

        if (filtrados.length === 0) {
            contenedor.innerHTML = `
                <div class="py-8 text-center text-xs text-slate-400">
                    <i class="fa-solid fa-magnifying-glass mb-2 text-lg text-slate-300"></i>
                    <p>No se encontraron módulos.</p>
                </div>
            `;
            return;
        }

        let html = '';

        filtrados.forEach(item => {
            const casillaOcupadaIndex = this.misAccesos12.findIndex(slot => slot && slot.cod_mod === item.cod_mod);
            const slotActual = this.casillaSeleccionadaIndex !== null ? this.misAccesos12[this.casillaSeleccionadaIndex] : null;
            const estaAsignadoAqui = slotActual && slotActual.cod_mod === item.cod_mod;
            const detalle = item.titulo && item.titulo !== item.nom_mod ? item.titulo : 'Disponible para tu perfil';

            html += `
                <div onclick="window.dashPrincipalController.asignarModuloACasilla('${item.cod_mod}')"
                    class="group flex cursor-pointer items-center justify-between gap-3 rounded-md border border-transparent px-2 py-2 transition hover:bg-slate-50">
                    <div class="flex min-w-0 items-center gap-3">
                        <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-100 text-blue-600">
                            <i class="fa-solid ${this.iconoModulo(item)}"></i>
                        </div>
                        <div class="min-w-0">
                            <div class="flex items-center gap-2">
                                <p class="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">${item.nom_mod}</p>
                                <span class="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                                    ${item.categoria_nom || 'Módulo'}
                                </span>
                            </div>
                            <p class="truncate text-xs text-slate-400">${detalle}</p>
                        </div>
                    </div>
                    <div class="shrink-0">
                        ${estaAsignadoAqui ? `
                            <span class="text-[11px] font-medium text-emerald-600">Asignado aquí</span>
                        ` : casillaOcupadaIndex !== -1 ? `
                            <span class="text-[11px] text-slate-400">Casilla #${casillaOcupadaIndex + 1}</span>
                        ` : `
                            <button type="button" class="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 transition group-hover:border-blue-500 group-hover:text-blue-600">
                                Asignar
                            </button>
                        `}
                    </div>
                </div>
            `;
        });

        contenedor.innerHTML = html;
    }

    asignarModuloACasilla(codMod) {
        if (this.casillaSeleccionadaIndex === null) return;

        const item = this.catalogoPorCodigo[codMod];

        if (!item) return;

        const existente = this.misAccesos12.findIndex(slot => slot && slot.cod_mod === codMod);

        if (existente !== -1 && existente !== this.casillaSeleccionadaIndex) {
            this.misAccesos12[existente] = null;
        }

        this.misAccesos12[this.casillaSeleccionadaIndex] = this.crearObjetoAcceso(item);
        this.renderizarCuadricula();
        this.guardarAccesosDirectos();
        this.cerrarModalSeleccion();
    }

    quitarAsignacionCasillaActual() {
        if (this.casillaSeleccionadaIndex === null) return;

        this.misAccesos12[this.casillaSeleccionadaIndex] = null;
        this.renderizarCuadricula();
        this.guardarAccesosDirectos();
        this.cerrarModalSeleccion();
    }

    quitarAccesoDirecto(index) {
        if (index < 0 || index >= this.misAccesos12.length) return;

        this.misAccesos12[index] = null;
        this.renderizarCuadricula();
        this.guardarAccesosDirectos();
    }

    async guardarAccesosDirectos() {
        try {
            const accesos = await this.servicioDashboard.guardarAccesos(this.misAccesos12);
            this.misAccesos12 = this.normalizarAccesos(accesos);
            this.renderizarCuadricula();
        } catch (error) {
            console.error('No se pudieron guardar los accesos directos:', error);
        }
    }

    navegarAModulo(url, titulo, codMod, tipoParam) {
        if (window.parent && typeof window.parent.loadDashboardAndData === 'function') {
            window.parent.loadDashboardAndData(url, tipoParam || '', titulo, codMod || null);

            if (window.parent.menuPrincipal) {
                window.parent.menuPrincipal.seleccionarModuloPorUrl(url);
            }
        } else {
            window.location.href = `../../${url}`;
        }
    }
}

window.dashPrincipalController = new DashPrincipalController();

document.addEventListener('DOMContentLoaded', () => {
    window.dashPrincipalController.init();
});
