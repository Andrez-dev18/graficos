/* Render de gráficas (Chart.js): tema, bandas de estándar e hitos */
window.PA_CHARTS = (function () {
    var instancias = {};

    function tema() {
        var oscuro = document.documentElement.getAttribute('data-theme') === 'dark';
        return {
            oscuro: oscuro,
            texto: oscuro ? '#cbd5e1' : '#475569',
            grid: oscuro ? 'rgba(148,163,184,0.16)' : 'rgba(148,163,184,0.28)',
            tooltipBg: oscuro ? '#1e293b' : '#ffffff',
            tooltipTexto: oscuro ? '#e2e8f0' : '#0f172a'
        };
    }

    function bandasDe(opciones) {
        if (!opciones) {
            return [];
        }
        if (Array.isArray(opciones.bandas)) {
            return opciones.bandas;
        }
        if (opciones.min !== undefined || opciones.max !== undefined) {
            return [{
                axis: 'y',
                min: opciones.min === undefined ? null : opciones.min,
                max: opciones.max === undefined ? null : opciones.max,
                color: opciones.color,
                borde: opciones.borde
            }];
        }
        return [];
    }

    /* Bandas horizontales min-max por eje (estándar de temperatura/humedad) */
    var bandaEstandar = {
        id: 'paBand',
        beforeDatasetsDraw: function (chart, args, opciones) {
            var area = chart.chartArea;
            if (!area) {
                return;
            }
            bandasDe(opciones).forEach(function (b) {
                var escala = chart.scales[b.axis || 'y'];
                if (!escala) {
                    return;
                }
                var min = b.min === undefined ? null : b.min;
                var max = b.max === undefined ? null : b.max;
                if (min === null && max === null) {
                    return;
                }
                var arriba = max === null ? area.top : escala.getPixelForValue(max);
                var abajo = min === null ? area.bottom : escala.getPixelForValue(min);
                arriba = Math.max(area.top, Math.min(area.bottom, arriba));
                abajo = Math.max(area.top, Math.min(area.bottom, abajo));
                if (abajo - arriba < 1) {
                    return;
                }
                var ctx = chart.ctx;
                ctx.save();
                ctx.fillStyle = b.color || 'rgba(16,185,129,0.12)';
                ctx.fillRect(area.left, arriba, area.right - area.left, abajo - arriba);
                ctx.strokeStyle = b.borde || 'rgba(16,185,129,0.45)';
                ctx.setLineDash([6, 4]);
                ctx.lineWidth = 1;
                if (max !== null) {
                    ctx.beginPath();
                    ctx.moveTo(area.left, arriba);
                    ctx.lineTo(area.right, arriba);
                    ctx.stroke();
                }
                if (min !== null) {
                    ctx.beginPath();
                    ctx.moveTo(area.left, abajo);
                    ctx.lineTo(area.right, abajo);
                    ctx.stroke();
                }
                ctx.restore();
            });
        }
    };

    /* Marcas verticales (hitos del recorrido) */
    var hitos = {
        id: 'paHitos',
        afterDatasetsDraw: function (chart, args, opciones) {
            if (!opciones || !Array.isArray(opciones.marcas) || opciones.marcas.length === 0) {
                return;
            }
            var escala = chart.scales.x;
            var area = chart.chartArea;
            if (!escala || !area) {
                return;
            }
            var ctx = chart.ctx;
            ctx.save();
            opciones.marcas.forEach(function (m) {
                var px = escala.getPixelForValue(m.indice);
                if (px < area.left || px > area.right) {
                    return;
                }
                ctx.strokeStyle = m.color || 'rgba(100,116,139,0.55)';
                ctx.setLineDash([3, 3]);
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(px, area.top);
                ctx.lineTo(px, area.bottom);
                ctx.stroke();
                ctx.setLineDash([]);
                var txt = String(m.label || '');
                if (txt !== '') {
                    ctx.save();
                    ctx.translate(px + 3, area.top + 4);
                    ctx.rotate(-Math.PI / 2);
                    ctx.fillStyle = m.texto || '#64748b';
                    ctx.font = '9px Inter, sans-serif';
                    ctx.textAlign = 'right';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(txt, 0, 0);
                    ctx.restore();
                }
            });
            ctx.restore();
        }
    };

    function fusionar(base, extra) {
        if (!extra) {
            return base;
        }
        Object.keys(extra).forEach(function (clave) {
            var valor = extra[clave];
            if ((clave === 'plugins' || clave === 'scales') && valor && typeof valor === 'object') {
                base[clave] = base[clave] || {};
                Object.keys(valor).forEach(function (sub) {
                    var subValor = valor[sub];
                    if (subValor && typeof subValor === 'object' && base[clave][sub] && typeof base[clave][sub] === 'object') {
                        base[clave][sub] = Object.assign({}, base[clave][sub], subValor);
                    } else {
                        base[clave][sub] = subValor;
                    }
                });
            } else {
                base[clave] = valor;
            }
        });
        return base;
    }

    function opcionesBase(extra) {
        var t = tema();
        var base = {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    labels: {
                        color: t.texto,
                        usePointStyle: true,
                        boxWidth: 10,
                        boxHeight: 10,
                        padding: 14,
                        font: { size: 11 }
                    }
                },
                tooltip: {
                    backgroundColor: t.tooltipBg,
                    titleColor: t.tooltipTexto,
                    bodyColor: t.tooltipTexto,
                    borderColor: t.grid,
                    borderWidth: 1,
                    padding: 10,
                    cornerRadius: 8
                }
            },
            scales: {
                x: {
                    ticks: { color: t.texto, maxRotation: 45, autoSkip: true, font: { size: 10 } },
                    grid: { color: t.grid, drawBorder: false }
                },
                y: {
                    beginAtZero: true,
                    ticks: { color: t.texto, font: { size: 10 } },
                    grid: { color: t.grid, drawBorder: false }
                }
            }
        };

        return fusionar(base, extra);
    }

    function crear(canvas, config) {
        if (!canvas) {
            return null;
        }
        if (instancias[canvas.id]) {
            instancias[canvas.id].destroy();
        }
        instancias[canvas.id] = new Chart(canvas.getContext('2d'), config);
        return instancias[canvas.id];
    }

    function limpiar(canvas) {
        if (canvas && instancias[canvas.id]) {
            instancias[canvas.id].destroy();
            delete instancias[canvas.id];
        }
    }

    function limpiarTodo() {
        Object.keys(instancias).forEach(function (id) {
            instancias[id].destroy();
            delete instancias[id];
        });
    }

    return {
        tema: tema,
        opcionesBase: opcionesBase,
        crear: crear,
        limpiar: limpiar,
        limpiarTodo: limpiarTodo,
        bandaEstandar: bandaEstandar,
        hitos: hitos
    };
})();
