(function () {
    if (window.AnalisisPT0Tooltip) return;

    const DELAY = 500;
    const ETIQUETAS = {
        tran: 'Tran',
        talm: 'talm',
        cliente: 'Cliente',
        tnumfac: 'tnumfac',
        codigo: 'Código ítem',
        descri: 'Descripción',
        dia: 'Día de tfectra',
        mes: 'Mes de tfectra'
    };

    const estado = {
        tooltip: null,
        celda: null,
        timer: null,
        visible: false,
        x: 0,
        y: 0,
        raf: 0
    };

    function esc(valor) {
        if (valor === null || valor === undefined) return '';
        return String(valor)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function crearTooltip() {
        if (estado.tooltip) return;

        const el = document.createElement('div');
        el.id = 'tooltip-analisispt0';
        el.style.cssText = [
            'position:fixed',
            'top:0',
            'left:0',
            'z-index:99999',
            'display:none',
            'visibility:hidden',
            'opacity:0',
            'pointer-events:none',
            'min-width:250px',
            'max-width:420px',
            'padding:14px 16px',
            'background:rgba(255,255,255,0.98)',
            'border:1px solid #cbd5e1',
            'border-radius:10px',
            'box-shadow:0 12px 30px rgba(15,23,42,0.18)',
            'font-family:Segoe UI, Arial, sans-serif',
            'font-size:12px',
            'color:#475569',
            'line-height:1.55',
            'transition:opacity 120ms ease',
            'will-change:transform'
        ].join(';');
        document.body.appendChild(el);
        estado.tooltip = el;
    }

    function contenido(celda) {
        const fila = celda.closest('tr');
        if (!fila) return '';

        const meta = (celda.getAttribute('data-tt') || '').split('|');
        const talm = meta[0] || '';
        const tipo = meta[1] || '';
        const medida = meta[2] || '';
        const valor = (celda.textContent || '').trim();

        if (!valor) return '';

        const campos = [
            ['tran', tipo],
            ['talm', talm],
            ['cliente', fila.getAttribute('data-tt-cliente') || ''],
            ['tnumfac', fila.getAttribute('data-tt-tnumfac') || ''],
            ['tran_codigo', fila.getAttribute('data-tt-tran') || ''],
            ['codigo', fila.getAttribute('data-tt-codigo') || ''],
            ['descri', fila.getAttribute('data-tt-descri') || ''],
            ['dia', fila.getAttribute('data-tt-dia') || ''],
            ['mes', fila.getAttribute('data-tt-mes') || '']
        ];

        let html = '';

        campos.forEach(([clave, dato]) => {
            if (!dato) return;

            if (clave === 'tran_codigo') {
                html += `<div style="display:flex;gap:12px;margin:1px 0;"><span style="width:112px;flex:0 0 112px;color:#8a94a6;">tcodtra:</span><span style="font-weight:600;color:#374151;">${esc(dato)}</span></div>`;
                return;
            }

            const etiqueta = ETIQUETAS[clave] || clave;
            html += `<div style="display:flex;gap:12px;margin:1px 0;"><span style="width:112px;flex:0 0 112px;color:#8a94a6;">${esc(etiqueta)}:</span><span style="font-weight:600;color:#374151;">${esc(dato)}</span></div>`;
        });

        let valorFinal = valor;
        if (medida === 'Pes' && !/kg/i.test(valorFinal)) {
            valorFinal += ' Kg';
        }

        html += `<div style="display:flex;gap:12px;margin-top:7px;padding-top:7px;border-top:1px solid #e5e7eb;"><span style="width:112px;flex:0 0 112px;color:#64748b;font-weight:600;">${esc(medida)}:</span><span style="font-weight:700;color:#1d4ed8;">${esc(valorFinal)}</span></div>`;

        return html;
    }

    function posicionar(x, y) {
        if (!estado.tooltip) return;

        const el = estado.tooltip;
        const margen = 8;
        const offset = 16;
        const rect = el.getBoundingClientRect();

        let left = x + offset;
        let top = y + offset;

        if (left + rect.width > window.innerWidth - margen) {
            left = x - rect.width - offset;
        }
        if (top + rect.height > window.innerHeight - margen) {
            top = y - rect.height - offset;
        }

        left = Math.max(margen, left);
        top = Math.max(margen, top);

        el.style.transform = `translate3d(${left}px, ${top}px, 0)`;
        el.style.left = '0';
        el.style.top = '0';
    }

    function programarPosicion() {
        if (!estado.visible) return;
        if (estado.raf) return;

        estado.raf = window.requestAnimationFrame(() => {
            estado.raf = 0;
            posicionar(estado.x, estado.y);
        });
    }

    function mostrar(celda) {
        if (!estado.tooltip || !celda || !celda.isConnected) return;

        const html = contenido(celda);
        if (!html) return;

        estado.tooltip.innerHTML = html;
        estado.tooltip.style.display = 'block';
        estado.tooltip.style.visibility = 'hidden';
        estado.tooltip.style.opacity = '0';
        posicionar(estado.x, estado.y);
        estado.tooltip.style.visibility = 'visible';
        estado.tooltip.style.opacity = '1';
        estado.visible = true;
    }

    function ocultar() {
        if (estado.timer) {
            clearTimeout(estado.timer);
            estado.timer = null;
        }

        estado.celda = null;
        estado.visible = false;

        if (estado.tooltip) {
            estado.tooltip.style.opacity = '0';
            estado.tooltip.style.visibility = 'hidden';
            estado.tooltip.style.display = 'none';
        }
    }

    function salirDeCelda(event) {
        if (!estado.celda) return;
        if (event.relatedTarget && estado.celda.contains(event.relatedTarget)) return;
        ocultar();
    }

    function iniciar() {
        if (estado.tooltip) return;

        crearTooltip();

        document.addEventListener('mouseover', (event) => {
            const celda = event.target.closest('.celda-tooltip');
            if (!celda) return;

            if (estado.celda === celda) return;

            ocultar();
            estado.celda = celda;
            estado.x = event.clientX;
            estado.y = event.clientY;

            estado.timer = setTimeout(() => {
                estado.timer = null;
                mostrar(celda);
            }, DELAY);
        });

        document.addEventListener('mouseout', (event) => {
            const celda = event.target.closest('.celda-tooltip');
            if (!celda || celda !== estado.celda) return;
            salirDeCelda(event);
        });

        document.addEventListener('mousemove', (event) => {
            if (!estado.celda) return;
            estado.x = event.clientX;
            estado.y = event.clientY;
            programarPosicion();
        });

        document.addEventListener('scroll', ocultar, true);
        window.addEventListener('resize', ocultar);
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') ocultar();
        });
    }

    window.AnalisisPT0Tooltip = {
        init: iniciar,
        hide: ocultar
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciar);
    } else {
        iniciar();
    }
})();
