class LogController {
    constructor() {
        this.table = null;
        this.init();
    }

    async init() {
        // Inicializar tu lógica de fechas primero
        this.initFiltersUI();
        // Cargar los selects desde backend
        await this.cargarFiltrosDinamicos();
        // Vincular los otros botones (Toggle, Limpiar, Consultar)
        this.vincularEventosUI();
        // Inicializar la tabla
        this.inicializarDataTable();
    }

    // ==========================================
    // 1. TUS FUNCIONES DE FILTRO DE FECHAS
    // ==========================================
    initFiltersUI() {
        const selectTipo = document.getElementById('periodoTipo');
        if (!selectTipo) return;

        const contenedores = {
            'POR_FECHA': document.getElementById('periodoPorFecha'),
            'ENTRE_FECHAS': document.getElementById('periodoEntreFechas'),
            'POR_MES': document.getElementById('periodoPorMes'),
            'ENTRE_MESES': document.getElementById('periodoEntreMeses')
        };

        const actualizarInputs = () => {
            const tipo = selectTipo.value;
            Object.values(contenedores).forEach(div => {
                if (div) div.classList.add('hidden');
            });
            if (contenedores[tipo]) {
                contenedores[tipo].classList.remove('hidden');
            }
        };

        selectTipo.addEventListener('change', actualizarInputs);

        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        const localDate = new Date(now.getTime() - offset);

        const fechaPorDefecto = localDate.toISOString().split('T')[0];
        const mesActual = localDate.toISOString().slice(0, 7);

        // Forzar inicio
        selectTipo.value = 'ULTIMA_SEMANA';

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val;
        };

        setVal('fechaUnica', fechaPorDefecto);
        setVal('fechaInicio', fechaPorDefecto);
        setVal('fechaFin', fechaPorDefecto);
        setVal('mesUnico', mesActual);
        setVal('mesInicio', mesActual);
        setVal('mesFin', mesActual);

        actualizarInputs();
    }

    getFechasFiltro() {
        const tipo = document.getElementById('periodoTipo').value;
        let fInicio = '';
        let fFin = '';

        const hoy = new Date();

        switch (tipo) {
            case 'TODOS':
                break;
            case 'ULTIMA_SEMANA':
                fFin = hoy.toISOString().split('T')[0];
                const hace7dias = new Date(hoy);
                hace7dias.setDate(hoy.getDate() - 7);
                fInicio = hace7dias.toISOString().split('T')[0];
                break;
            case 'POR_FECHA':
                const valFecha = document.getElementById('fechaUnica').value;
                fInicio = valFecha;
                fFin = valFecha;
                break;
            case 'ENTRE_FECHAS':
                fInicio = document.getElementById('fechaInicio').value;
                fFin = document.getElementById('fechaFin').value;
                break;
            case 'POR_MES':
                const valMes = document.getElementById('mesUnico').value;
                if (valMes) {
                    fInicio = `${valMes}-01`;
                    const [year, month] = valMes.split('-');
                    const ultimoDia = new Date(year, month, 0).getDate();
                    fFin = `${valMes}-${ultimoDia}`;
                }
                break;
            case 'ENTRE_MESES':
                const mesIni = document.getElementById('mesInicio').value;
                const mesFinVal = document.getElementById('mesFin').value;
                if (mesIni) fInicio = `${mesIni}-01`;
                if (mesFinVal) {
                    const [y, m] = mesFinVal.split('-');
                    const uDia = new Date(y, m, 0).getDate();
                    fFin = `${mesFinVal}-${uDia}`;
                }
                break;
        }
        return { inicio: fInicio, fin: fFin };
    }

    resetPeriodoFiltro() {
        const selectPeriodo = document.getElementById('periodoTipo');
        if (selectPeriodo) {
            selectPeriodo.value = 'ULTIMA_SEMANA';
            selectPeriodo.dispatchEvent(new Event('change'));
        }

        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        const localDate = new Date(now.getTime() - offset);

        const fechaPorDefecto = localDate.toISOString().split('T')[0];
        const mesActual = localDate.toISOString().slice(0, 7);

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val;
        };

        setVal('fechaUnica', fechaPorDefecto);
        setVal('fechaInicio', fechaPorDefecto);
        setVal('fechaFin', fechaPorDefecto);
        setVal('mesUnico', mesActual);
        setVal('mesInicio', mesActual);
        setVal('mesFin', mesActual);

        // Reseteamos los selects de este módulo específico
        setVal('filtro_accion', '');
        setVal('filtro_tabla', '');
        setVal('filtro_dispositivo', '');
        setVal('filtro_so', '');
        setVal('filtro_navegador', '');

        if (this.table) {
            this.table.search(''); // Limpia la búsqueda global
            this.table.ajax.reload();
        }
    }

    // ==========================================
    // 2. OTROS EVENTOS Y SELECTS
    // ==========================================
    vincularEventosUI() {
        const btnToggle = document.getElementById('btnToggleFiltros');
        const filterContent = document.getElementById('filterContent');

        if (btnToggle && filterContent) {
            btnToggle.addEventListener('click', () => {
                filterContent.classList.toggle('show');
                const icon = btnToggle.querySelector('i');
                if (filterContent.classList.contains('show')) {
                    icon.classList.remove('fa-chevron-down');
                    icon.classList.add('fa-chevron-up');
                } else {
                    icon.classList.remove('fa-chevron-up');
                    icon.classList.add('fa-chevron-down');
                }
            });
        }

        const btnLimpiar = document.getElementById('btnLimpiarFiltros');
        if (btnLimpiar) {
            btnLimpiar.addEventListener('click', () => this.resetPeriodoFiltro());
        }

        const btnAplicar = document.getElementById('btnAplicarFiltros');
        if (btnAplicar) {
            btnAplicar.addEventListener('click', () => {
                if (this.table) this.table.ajax.reload();
            });
        }
    }

    async cargarFiltrosDinamicos() {
        try {
            const response = await window.LogService.getFiltros();
            if (response.success) {
                this.poblarSelect('filtro_accion', response.data.accion);
                this.poblarSelect('filtro_tabla', response.data.tabla_afectada);
                this.poblarSelect('filtro_dispositivo', response.data.dispositivo);
                this.poblarSelect('filtro_so', response.data.sistema_operativo);
                this.poblarSelect('filtro_navegador', response.data.navegador);
            }
        } catch (error) {
            console.error("No se pudieron cargar los filtros dinámicos:", error);
        }
    }

    poblarSelect(idSelect, datos) {
        const select = document.getElementById(idSelect);
        if (!select || !datos) return;
        datos.forEach(item => {
            const option = document.createElement('option');
            option.value = item;
            option.textContent = item;
            select.appendChild(option);
        });
    }

    // ==========================================
    // 3. DATATABLES
    // ==========================================
    inicializarDataTable() {
        this.table = $('#dataTableRoles').DataTable({
            serverSide: true,
            processing: true,
            responsive: false,
            scrollX: true,
            order: [[11, 'desc']], 
            language: { url: '//cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json' },
            ajax: async (data, callback, settings) => {

                // 1. Extraemos las fechas de tu función
                const fechas = this.getFechasFiltro();

                // 2. Extraemos los selectores manuales
                const filtros = {
                    id_programa: document.getElementById('filtro_programa')?.value || '',
                    accion: document.getElementById('filtro_accion')?.value || '',
                    tabla_afectada: document.getElementById('filtro_tabla')?.value || '',
                    dispositivo: document.getElementById('filtro_dispositivo')?.value || '',
                    sistema_operativo: document.getElementById('filtro_so')?.value || '',
                    navegador: document.getElementById('filtro_navegador')?.value || '',
                    fecha_inicio: fechas.inicio,
                    fecha_fin: fechas.fin
                };

                const dtData = { ...data, ...filtros };

                try {
                    const resultado = await window.LogService.getFiltered(dtData);
                    callback(resultado);
                } catch (error) {
                    console.error("Error al cargar la tabla de logs", error);
                    callback({ data: [], recordsTotal: 0, recordsFiltered: 0 });
                }
            },
            drawCallback: function(settings) {
                // Mantenemos el ajustador por seguridad después de que AJAX termine
                setTimeout(() => {
                    $($.fn.dataTable.tables(true)).DataTable().columns.adjust();
                }, 50);
            },
            columns: [
                {
                    //Contador Secuencial en lugar del ID
                    data: null,
                    orderable: false,
                    className: 'text-center font-bold',
                    render: function (data, type, row, meta) {
                        return meta.row + meta.settings._iDisplayStart + 1;
                    }
                },
                {
                    data: 'nombre_programa',
                    render: function (data) { return data ? `<span class="font-semibold text-purple-700">${data}</span>` : `<span class="text-gray-400">N/A</span>`; }
                },
                { data: 'id_programa', className: 'text-center' },
                { data: 'cod_usuario', className: 'text-center' },
                { data: 'nom_usuario' },
                {
                    data: 'accion',
                    className: 'text-center',
                    render: function (data) {
                        let colorClass = 'bg-gray-100 text-gray-800';
                        if (data && data.includes('LOGIN')) colorClass = 'bg-blue-100 text-blue-800';
                        if (data && (data.includes('INSERT') || data.includes('CREAR'))) colorClass = 'bg-green-100 text-green-800';
                        if (data && (data.includes('UPDATE') || data.includes('EDITAR'))) colorClass = 'bg-yellow-100 text-yellow-800';
                        if (data && (data.includes('DELETE') || data.includes('ELIMINAR'))) colorClass = 'bg-red-100 text-red-800';
                        return `<span class="px-2 py-1 rounded-full text-xs font-bold ${colorClass}">${data || ''}</span>`;
                    }
                },
                { data: 'tabla_afectada', className: 'text-center' },
                { data: 'registro_id', className: 'text-center', defaultContent: '' },
                {
                    data: 'datos_previos',
                    orderable: false,
                    className: 'text-center',
                    render: (data) => this.renderBotonJSON(data)
                },
                {
                    data: 'datos_nuevos',
                    orderable: false,
                    className: 'text-center',
                    render: (data) => this.renderBotonJSON(data)
                },
                { data: 'descripcion', orderable: false, defaultContent: '' },
                { data: 'fechaHora', className: 'text-center' },
                { data: 'ip', className: 'text-center', defaultContent: '' },
                { data: 'ubicacion_gps', className: 'text-center', defaultContent: '' },
                { data: 'dispositivo', className: 'text-center', defaultContent: '' },
                { data: 'sistema_operativo', className: 'text-center', defaultContent: '' },
                { data: 'navegador', className: 'text-center', defaultContent: '' }
            ]
        });
        $('#dataTableRoles tbody').on('click', '.btn-ver-json', (e) => {
            const btn = e.currentTarget;
            const rawData = decodeURIComponent(btn.getAttribute('data-json'));
            this.mostrarModalJSON(rawData);
        });
    }

    renderBotonJSON(data) {
        // Si viene vacío o literal dice "null"
        if (!data || data === 'null' || data.trim() === '') {
            return '<span class="text-gray-400 italic text-xs">Vacío</span>';
        }

        // Codificamos el texto para que las comillas no rompan el atributo HTML 'data-json'
        const encodedData = encodeURIComponent(data);

        return `
            <button type="button" 
                    class="btn-ver-json bg-indigo-100 text-indigo-600 hover:bg-indigo-600 hover:text-white px-3 py-1.5 rounded-full transition-all shadow-sm" 
                    data-json="${encodedData}" 
                    title="Ver detalle JSON">
                <i class="fas fa-eye"></i>
            </button>
        `;
    }

    mostrarModalJSON(data) {
        let formattedJson = '';
        try {
            // Intentamos parsearlo para ver si es un JSON real
            const obj = JSON.parse(data);
            // Lo convertimos de nuevo a texto, pero con 4 espacios de sangría
            formattedJson = JSON.stringify(obj, null, 4);
        } catch (e) {
            // Si por algún motivo no es JSON, mostramos el texto tal cual
            formattedJson = data;
        }

        Swal.fire({
            title: '<div class="text-lg font-bold text-gray-700 flex items-center justify-center gap-2"><i class="fas fa-code text-purple-600"></i> Detalle del Registro</div>',
            html: `
                <div class="text-left bg-gray-900 text-orange-500 p-4 rounded-xl overflow-auto max-h-[60vh] text-sm font-mono shadow-inner border border-gray-700 mt-2">
                    <pre><code>${this.escapeHTML(formattedJson)}</code></pre>
                </div>
            `,
            width: '800px',
            showCloseButton: true,
            showConfirmButton: false,
            customClass: {
                popup: 'rounded-2xl shadow-2xl border-0'
            }
        });
    }

    // Seguridad: Evita que etiquetas HTML dentro del JSON se ejecuten en el modal
    escapeHTML(str) {
        return str.replace(/[&<>'"]/g,
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag)
        );
    }

}

document.addEventListener('DOMContentLoaded', () => {
    window.logController = new LogController();
});