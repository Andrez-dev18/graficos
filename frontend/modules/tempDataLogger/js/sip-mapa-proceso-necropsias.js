/**
 * Selector de proceso (árbol estándar) reutilizable entre módulos.
 * Necropsias: default «Necropsias en granja» + contexto IX2 al cargar.
 * Evidencias y similares: sin preselección; el usuario elige en el mapa.
 */
(function (global) {
    'use strict';

    var DEFAULT_LEAF_NAME = 'necropsias en granja';
    var DEFAULT_TAREA_KEY = 'SANIDAD_NECROPSIAS_EN_GRANJA';

    function escaparHtml(s) {
        return String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function normalizarNombre(s) {
        return String(s || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\./g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function normalizarTareaKey(s) {
        return String(s || '')
            .trim()
            .toUpperCase()
            .replace(/\s+/g, '_');
    }

    function tareaKeyCoincide(nodoKey, objetivo) {
        var ak = normalizarTareaKey(nodoKey);
        var obj = normalizarTareaKey(objetivo);
        if (!ak || !obj) return false;
        if (ak === obj) return true;
        if (ak.endsWith('_' + obj)) return true;
        if (obj.endsWith('_' + ak)) return true;
        return false;
    }

    function esArbolMapaValido(ar) {
        return !!(ar && typeof ar === 'object' && Array.isArray(ar.children));
    }

    /**
     * @param {{
     *   treeUrl?: string,
     *   defaultLeafName?: string,
     *   defaultTareaKey?: string,
     *   aplicarDefaultInicial?: boolean,
     *   aplicarIx2Inicial?: boolean,
     *   ids?: Record<string,string>,
     *   onSelect?: function,
     *   permitirSeleccion?: boolean
     * }} options
     */
    function init(options) {
        options = options || {};
        var ids = options.ids || {};
        var treeUrl = options.treeUrl || '../planificacion/cronograma/get_estandares_necropsia_tree.php';
        var defaultLeafName = ('defaultLeafName' in options) ? options.defaultLeafName : DEFAULT_LEAF_NAME;
        var defaultTareaKey = ('defaultTareaKey' in options) ? options.defaultTareaKey : DEFAULT_TAREA_KEY;
        var aplicarDefaultInicial = options.aplicarDefaultInicial !== false;
        var aplicarIx2Inicial = options.aplicarIx2Inicial === true;
        var permitirSeleccion = options.permitirSeleccion === true;
        var onSelect = typeof options.onSelect === 'function' ? options.onSelect : function () {};

        var MAPA_PROCESO_DATA = { name: 'Proceso Productivo', children: [] };
        var _rutaDescPath = '';
        var _multiActivePaths = [];
        var _multiActiveTareaKeys = [];
        var _expandedPaths = [];
        var _arbolCargado = false;
        var _arbolEnCurso = null;

        function id(key, fallback) {
            return ids[key] || fallback;
        }

        function el(key, fallback) {
            var domId = id(key, fallback);
            return domId ? document.getElementById(domId) : null;
        }

        function setDisplayText(dispEl, text) {
            if (!dispEl) {
                return;
            }
            var t = String(text || '').trim();
            if ('value' in dispEl && String(dispEl.tagName || '').toUpperCase() === 'INPUT') {
                dispEl.value = t;
            } else {
                dispEl.textContent = t;
            }
            dispEl.setAttribute('title', t);
        }

        function construirPathCodigoDesdePath(path) {
            return String(path || '')
                .split('.')
                .filter(Boolean)
                .map(function (p) {
                    var idx = parseInt(p, 10);
                    return isNaN(idx) || idx < 0 ? '' : String(idx + 1);
                })
                .filter(Boolean)
                .join('-');
        }

        function cargarArbol() {
            if (_arbolCargado) return Promise.resolve();
            if (_arbolEnCurso) return _arbolEnCurso;
            _arbolEnCurso = fetch(treeUrl, { credentials: 'same-origin' })
                .then(function (r) { return r.json(); })
                .then(function (res) {
                    if (!res || !res.success || !res.data || typeof res.data !== 'object') return;
                    var ar = res.data.arbol;
                    if (esArbolMapaValido(ar)) {
                        MAPA_PROCESO_DATA = ar;
                        _arbolCargado = true;
                    }
                })
                .catch(function () {})
                .finally(function () { _arbolEnCurso = null; });
            return _arbolEnCurso;
        }

        function obtenerRutaRawDesdePath(path) {
            var ruta = [MAPA_PROCESO_DATA];
            var cur = MAPA_PROCESO_DATA;
            var parts = String(path || '').split('.').filter(function (p) { return p !== ''; });
            for (var i = 0; i < parts.length; i++) {
                var idx = parseInt(parts[i], 10);
                if (!cur || !Array.isArray(cur.children) || isNaN(idx) || idx < 0 || idx >= cur.children.length) {
                    break;
                }
                cur = cur.children[idx];
                ruta.push(cur);
            }
            return ruta;
        }

        function esHojaNodo(node) {
            return !!(node && (!Array.isArray(node.children) || node.children.length === 0));
        }

        function nombreHoja(node) {
            return node && node.name != null ? String(node.name).trim() : '';
        }

        function actividadKeyDeNodo(node) {
            if (!node) return '';
            return String(node.actividadKey || node.tareaKey || '').trim();
        }

        function buscarHojaPorNombre(node, pathBase, nombreBuscado) {
            if (!node || !Array.isArray(node.children)) return null;
            var objetivo = normalizarNombre(nombreBuscado);
            if (!objetivo) return null;
            var mejor = null;
            function dfs(n, pb) {
                if (!n || !Array.isArray(n.children)) return;
                n.children.forEach(function (ch, idx) {
                    var path = pb === '' ? String(idx) : pb + '.' + idx;
                    var esHoja = !Array.isArray(ch.children) || ch.children.length === 0;
                    if (esHoja) {
                        var nom = normalizarNombre(ch.name || '');
                        if (nom === objetivo || nom.indexOf(objetivo) !== -1 || objetivo.indexOf(nom) !== -1) {
                            if (!mejor) mejor = { path: path, node: ch };
                        }
                    } else {
                        dfs(ch, path);
                    }
                });
            }
            dfs(node, pathBase || '');
            return mejor;
        }

        function buscarHojaPorTareaKey(node, pathBase, tareaKeyBuscado) {
            if (!node || !Array.isArray(node.children)) return null;
            var objetivo = normalizarTareaKey(tareaKeyBuscado);
            if (!objetivo) return null;
            var mejor = null;
            function dfs(n, pb) {
                if (!n || !Array.isArray(n.children)) return;
                n.children.forEach(function (ch, idx) {
                    var path = pb === '' ? String(idx) : pb + '.' + idx;
                    var esHoja = !Array.isArray(ch.children) || ch.children.length === 0;
                    if (esHoja) {
                        if (tareaKeyCoincide(actividadKeyDeNodo(ch), objetivo)) {
                            if (!mejor) mejor = { path: path, node: ch };
                        }
                    } else {
                        dfs(ch, path);
                    }
                });
            }
            dfs(node, pathBase || '');
            return mejor;
        }

        /** Prioridad: tareaKey → nombre visible. */
        function resolverHojaDefecto() {
            if (defaultTareaKey) {
                var hitTk = buscarHojaPorTareaKey(MAPA_PROCESO_DATA, '', defaultTareaKey);
                if (hitTk && hitTk.path) return hitTk;
            }
            if (defaultLeafName) {
                return buscarHojaPorNombre(MAPA_PROCESO_DATA, '', defaultLeafName);
            }
            return null;
        }

        function resolverHojaPorTareaKeyOTexto(tareaKey, textoNombre) {
            var tk = String(tareaKey || '').trim();
            if (tk) {
                var hitK = buscarHojaPorTareaKey(MAPA_PROCESO_DATA, '', tk);
                if (hitK && hitK.path) return hitK;
            }
            var txt = String(textoNombre || '').trim();
            if (txt) {
                return buscarHojaPorNombre(MAPA_PROCESO_DATA, '', txt);
            }
            return null;
        }

        function aplicarSeleccion(path, cerrarModal) {
            var rutaRaw = obtenerRutaRawDesdePath(path);
            var leaf = rutaRaw.length ? rutaRaw[rutaRaw.length - 1] : null;
            if (!esHojaNodo(leaf)) return false;
            var hojaNombre = nombreHoja(leaf);
            var pc = construirPathCodigoDesdePath(path);
            var ak = actividadKeyDeNodo(leaf);
            var disp = el('display', 'necroProcesoDisplay');
            var hidPath = el('pathCodigo', 'necroPathCodigo');
            var hidIdx = el('procIdx', 'necroProcIdx');
            var hidTk = el('tareaKey', 'necroTareaKey');
            if (hidPath) hidPath.value = pc;
            if (hidIdx) hidIdx.value = String(path || '').trim();
            if (hidTk) hidTk.value = ak;
            if (disp) {
                setDisplayText(disp, hojaNombre);
            }
            _rutaDescPath = String(path || '').trim();
            onSelect({
                leafName: hojaNombre,
                idxPath: _rutaDescPath,
                pathCodigo: pc,
                tareaKey: ak,
            });
            if (cerrarModal !== false) close();
            return true;
        }

        function estaRutaActiva(path) {
            if (_rutaDescPath === path) return true;
            for (var i = 0; i < _multiActivePaths.length; i++) {
                if (_multiActivePaths[i] === path) return true;
            }
            return false;
        }

        function estaTareaKeyActiva(ak) {
            if (!ak || _multiActiveTareaKeys.length === 0) return false;
            for (var i = 0; i < _multiActiveTareaKeys.length; i++) {
                if (tareaKeyCoincide(ak, _multiActiveTareaKeys[i])) return true;
            }
            return false;
        }

        function esModoReadonly() {
            return _multiActivePaths.length > 0 || _multiActiveTareaKeys.length > 0;
        }

        /* Recorre el arbol y recolecta los paths de nodos no-hoja que son
           antepasados de nodos cuyo tareaKey coincida con _multiActiveTareaKeys. */
        function computeExpandedPaths() {
            var keys = _multiActiveTareaKeys;
            if (keys.length === 0) return [];
            var result = [];
            function dfs(n, pb) {
                if (!n || !Array.isArray(n.children)) return;
                n.children.forEach(function (ch, idx) {
                    var path = pb ? pb + '.' + idx : String(idx);
                    var ak = actividadKeyDeNodo(ch);
                    var esHoja = !Array.isArray(ch.children) || ch.children.length === 0;
                    var coincide = keys.some(function (tk) { return tareaKeyCoincide(ak, tk); });
                    if (coincide) {
                        /* Marcar todos los antepasados de este nodo para expandirlos */
                        var parts = path.split('.');
                        var acc = '';
                        for (var i = 0; i < parts.length - 1; i++) {
                            var seg = parts.slice(0, i + 1).join('.');
                            if (result.indexOf(seg) === -1) result.push(seg);
                        }
                        if (pb && result.indexOf(pb) === -1) result.push(pb);
                    }
                    if (!esHoja) {
                        dfs(ch, path);
                    }
                });
            }
            dfs(MAPA_PROCESO_DATA, '');
            return result;
        }

        function renderArbolConRamas(node, pathBase) {
            if (!node || !Array.isArray(node.children) || node.children.length === 0) return '';
            var html = '<ul class="ncr-tree-ramas">';
            var esReadonly = esModoReadonly();
            var tareaKeyMode = _multiActiveTareaKeys.length > 0;
            node.children.forEach(function (ch, idx) {
                var path = pathBase ? pathBase + '.' + idx : String(idx);
                var ak = actividadKeyDeNodo(ch);
                var esHoja = !Array.isArray(ch.children) || ch.children.length === 0;
                if (esHoja) {
                    var activo = estaRutaActiva(path) || estaTareaKeyActiva(ak);
                    var clsRef = ' ncr-nodo-hoja-ref' + (activo ? ' activo' : '') + ' es-hoja';
                    var dataTk = escaparHtml(ak);
                    if (permitirSeleccion && !esReadonly) {
                        html += '<li><button type="button" class="ncr-btn-nodo-tree' + clsRef + '" data-path="' + escaparHtml(path) + '" data-tarea-key="' + dataTk + '">'
                            + '<i class="fas fa-hand-pointer ncr-icon-hoja-select" aria-hidden="true"></i>'
                            + escaparHtml(ch.name || '') + '</button>';
                    } else {
                        html += '<li><span class="ncr-nodo-hoja-sololectura' + clsRef + '" data-path="' + escaparHtml(path) + '" data-tarea-key="' + dataTk + '">'
                            + escaparHtml(ch.name || '') + '</span>';
                    }
                } else {
                    var nlActivo = estaRutaActiva(path) || estaTareaKeyActiva(ak);
                    var nlCls = 'ncr-nodo-tree-label' + (nlActivo ? ' activo' : '');
                    var expandido = _expandedPaths.indexOf(path) !== -1;
                    var toggleIcon = tareaKeyMode ? (expandido ? 'fa-chevron-down' : 'fa-chevron-right') : '';
                    var toggleHtml = tareaKeyMode
                        ? '<i class="fas ' + toggleIcon + ' ncr-tree-toggle mr-1" aria-hidden="true" data-path="' + escaparHtml(path) + '"></i> '
                        : '';
                    html += '<li class="ncr-tree-nodo" data-path="' + escaparHtml(path) + '">'
                        + '<span class="' + nlCls + '">' + toggleHtml + escaparHtml(ch.name || '') + '</span>';
                    var childHtml = renderArbolConRamas(ch, path);
                    if (tareaKeyMode && childHtml) {
                        var childCls = 'ncr-tree-children' + (expandido ? '' : ' ncr-tree-children--collapsed');
                        html += '<div class="' + childCls + '">' + childHtml + '</div>';
                    } else {
                        html += childHtml;
                    }
                }
                html += '</li>';
            });
            html += '</ul>';
            return html;
        }

        function encontrarNodoRefPorPath(cont, path) {
            if (!cont || path == null || String(path).trim() === '') return null;
            var objetivo = String(path).trim();
            var nodes = cont.querySelectorAll('[data-path]');
            for (var i = 0; i < nodes.length; i++) {
                if (String(nodes[i].getAttribute('data-path') || '') === objetivo) {
                    return nodes[i];
                }
            }
            return null;
        }

        function sincronizarRutaDesdeFormulario() {
            var hidIdx = el('procIdx', 'necroProcIdx');
            var p = hidIdx ? String(hidIdx.value || '').trim() : '';
            if (p) {
                _rutaDescPath = p;
                return;
            }
            var hidTk = el('tareaKey', 'necroTareaKey');
            var disp = el('display', 'necroProcesoDisplay');
            var nombreDisp = '';
            if (disp) {
                nombreDisp = ('value' in disp && String(disp.tagName || '').toUpperCase() === 'INPUT')
                    ? String(disp.value || '')
                    : String(disp.textContent || '');
            }
            var hitForm = resolverHojaPorTareaKeyOTexto(
                hidTk ? hidTk.value : '',
                nombreDisp
            );
            if (hitForm && hitForm.path) {
                _rutaDescPath = hitForm.path;
                return;
            }
            var hitDef = resolverHojaDefecto();
            if (hitDef && hitDef.path) {
                _rutaDescPath = hitDef.path;
            }
        }

        /** Contenedor con overflow-y dentro del modal (Árbol de procesos). */
        function obtenerScrollWrapModalArbol() {
            var wrapId = id('mapaDescWrap', 'ncrMapaProcesoDescWrap');
            if (!wrapId) {
                return null;
            }
            return document.getElementById(wrapId);
        }

        function scrollElementoEnContenedor(scrollEl, targetEl) {
            if (!scrollEl || !targetEl) return;
            var cRect = scrollEl.getBoundingClientRect();
            var tRect = targetEl.getBoundingClientRect();
            var relTop = tRect.top - cRect.top + scrollEl.scrollTop;
            var next = relTop - scrollEl.clientHeight / 2 + tRect.height / 2;
            scrollEl.scrollTop = Math.max(0, Math.round(next));
        }

        function scrollANodoSeleccionado() {
            var modal = el('modal', 'modalMapaProcesoNecro');
            var cont = el('mapaDesc', 'mapaProcesoNecroDesc');
            if (!modal || !cont) return;
            var scrollParent = obtenerScrollWrapModalArbol();
            if (!scrollParent) return;

            var activo = encontrarNodoRefPorPath(cont, _rutaDescPath);
            if (!activo) {
                activo = cont.querySelector('.ncr-nodo-hoja-ref.activo');
            }
            if (!activo && _multiActivePaths.length > 0) {
                activo = encontrarNodoRefPorPath(cont, _multiActivePaths[0]);
            }
            if (!activo) {
                var hit = resolverHojaDefecto();
                if (hit && hit.path) {
                    _rutaDescPath = hit.path;
                    activo = encontrarNodoRefPorPath(cont, hit.path);
                }
            }
            if (!activo) return;
            if (!esModoReadonly()) {
                activo.classList.add('activo');
                cont.querySelectorAll('.ncr-nodo-hoja-ref.activo').forEach(function (n) {
                    if (n !== activo) n.classList.remove('activo');
                });
            }

            function aplicarScroll() {
                scrollElementoEnContenedor(scrollParent, activo);
            }

            aplicarScroll();
            requestAnimationFrame(function () {
                aplicarScroll();
                requestAnimationFrame(aplicarScroll);
            });
            setTimeout(aplicarScroll, 80);
            setTimeout(aplicarScroll, 200);
            setTimeout(aplicarScroll, 400);
        }

        function filtrarMapaProceso() {
            var busEl = el('mapaBuscar', '');
            var cont = el('mapaDesc', 'mapaProcesoNecroDesc');
            if (!cont) {
                return;
            }
            var q = busEl ? String(busEl.value || '').trim().toLowerCase() : '';
            var allLis = cont.querySelectorAll('li');
            if (!q) {
                allLis.forEach(function (li) { li.style.display = ''; });
                return;
            }
            allLis.forEach(function (li) { li.style.display = 'none'; });
            cont.querySelectorAll('.ncr-btn-nodo-tree, .ncr-nodo-hoja-sololectura, .ncr-nodo-tree-label').forEach(function (node) {
                if ((node.textContent || '').toLowerCase().indexOf(q) < 0) {
                    return;
                }
                var li = node.closest('li');
                while (li) {
                    li.style.display = '';
                    var collapsed = li.querySelector('.ncr-tree-children--collapsed');
                    if (collapsed) {
                        collapsed.classList.remove('ncr-tree-children--collapsed');
                        var toggle = li.querySelector('.ncr-tree-toggle');
                        if (toggle) {
                            toggle.classList.remove('fa-chevron-right');
                            toggle.classList.add('fa-chevron-down');
                        }
                    }
                    var parentLi = li.parentElement && li.parentElement.closest('li');
                    li = parentLi || null;
                }
            });
        }

        function renderMapa() {
            var cont = el('mapaDesc', 'mapaProcesoNecroDesc');
            if (!cont) return;
            var rootLabel = MAPA_PROCESO_DATA && MAPA_PROCESO_DATA.name ? String(MAPA_PROCESO_DATA.name) : 'Proceso';
            var esReadonly = esModoReadonly();
            var inner = esReadonly ? '' : '<div class="ncr-nodo-tree-label" style="margin-bottom:0.5rem">' + escaparHtml(rootLabel) + '</div>';
            var tree = renderArbolConRamas(MAPA_PROCESO_DATA, '');
            cont.innerHTML = inner + (tree || '<p class="text-xs text-gray-500">Sin datos.</p>');
            filtrarMapaProceso();
            if (permitirSeleccion && !esModoReadonly()) {
                cont.querySelectorAll('.ncr-btn-nodo-tree').forEach(function (btn) {
                    btn.addEventListener('click', function () {
                        var path = String(this.getAttribute('data-path') || '');
                        aplicarSeleccion(path, true);
                    });
                });
            }
            /* Toggle collapse/expand en nodos no-hoja cuando estamos en modo tareaKey */
            if (_multiActiveTareaKeys.length > 0) {
                cont.querySelectorAll('.ncr-tree-toggle').forEach(function (icon) {
                    icon.addEventListener('click', function (e) {
                        e.stopPropagation();
                        var path = String(this.getAttribute('data-path') || '');
                        if (!path) return;
                        var childDiv = this.closest('li') && this.closest('li').querySelector('.ncr-tree-children');
                        if (!childDiv) return;
                        var isCollapsed = childDiv.classList.contains('ncr-tree-children--collapsed');
                        if (isCollapsed) {
                            childDiv.classList.remove('ncr-tree-children--collapsed');
                            this.classList.remove('fa-chevron-right');
                            this.classList.add('fa-chevron-down');
                        } else {
                            childDiv.classList.add('ncr-tree-children--collapsed');
                            this.classList.remove('fa-chevron-down');
                            this.classList.add('fa-chevron-right');
                        }
                    });
                });
            }
        }

        function open() {
            var modal = el('modal', 'modalMapaProcesoNecro');
            if (!modal) return;
            modal.classList.remove('modal-mapa-necro-hidden');
            modal.classList.add('modal-mapa-necro-visible');
            modal.setAttribute('aria-hidden', 'false');
            var busEl = el('mapaBuscar', '');
            if (busEl) {
                busEl.value = '';
            }
            var cont = el('mapaDesc', 'mapaProcesoNecroDesc');
            if (cont) cont.innerHTML = '<p class="text-xs text-gray-500">Cargando…</p>';
            var scrollWrap = obtenerScrollWrapModalArbol();
            if (scrollWrap) scrollWrap.scrollTop = 0;
            cargarArbol().finally(function () {
                sincronizarRutaDesdeFormulario();
                renderMapa();
                scrollANodoSeleccionado();
            });
        }

        function close() {
            _multiActivePaths = [];
            _multiActiveTareaKeys = [];
            _expandedPaths = [];
            var modal = el('modal', 'modalMapaProcesoNecro');
            if (!modal) return;
            modal.classList.add('modal-mapa-necro-hidden');
            modal.classList.remove('modal-mapa-necro-visible');
            modal.setAttribute('aria-hidden', 'true');
        }

        function openReadonly(activePaths) {
            _multiActivePaths = Array.isArray(activePaths) ? activePaths.slice() : [];
            _multiActiveTareaKeys = [];
            _expandedPaths = [];
            var modal = el('modal', 'modalMapaProcesoNecro');
            if (!modal) return;
            if (_multiActivePaths.length === 0) return;
            modal.classList.remove('modal-mapa-necro-hidden');
            modal.classList.add('modal-mapa-necro-visible');
            modal.setAttribute('aria-hidden', 'false');
            var cont = el('mapaDesc', 'mapaProcesoNecroDesc');
            if (cont) cont.innerHTML = '<p class="text-xs text-gray-500">Cargando…</p>';
            var scrollWrap = obtenerScrollWrapModalArbol();
            if (scrollWrap) scrollWrap.scrollTop = 0;
            cargarArbol().finally(function () {
                renderMapa();
                scrollANodoSeleccionado();
            });
        }

        function openReadonlyByTareaKeys(tareaKeys) {
            _multiActiveTareaKeys = Array.isArray(tareaKeys) ? tareaKeys.slice() : [];
            _multiActivePaths = [];
            var modal = el('modal', 'modalMapaProcesoNecro');
            if (!modal) return;
            if (_multiActiveTareaKeys.length === 0) return;
            modal.classList.remove('modal-mapa-necro-hidden');
            modal.classList.add('modal-mapa-necro-visible');
            modal.setAttribute('aria-hidden', 'false');
            var cont = el('mapaDesc', 'mapaProcesoNecroDesc');
            if (cont) cont.innerHTML = '<p class="text-xs text-gray-500">Cargando…</p>';
            var scrollWrap = obtenerScrollWrapModalArbol();
            if (scrollWrap) scrollWrap.scrollTop = 0;
            cargarArbol().finally(function () {
                _expandedPaths = computeExpandedPaths();
                renderMapa();
                scrollANodoSeleccionado();
            });
        }

        function aplicarDesdeIx2() {
            if (typeof global.Ix2LeafContext === 'undefined' || !global.Ix2LeafContext.getIx2LeafFilterContext) {
                return false;
            }
            var ctx = global.Ix2LeafContext.getIx2LeafFilterContext();
            if (!ctx) return false;
            var leaf = String(ctx.leafName || '').trim();
            if (!leaf && ctx.pathNames && ctx.pathNames.length) {
                leaf = String(ctx.pathNames[ctx.pathNames.length - 1] || '').trim();
            }
            var idxP = String(ctx.idxPath || '').trim();
            if (!leaf && !idxP) return false;
            if (!idxP && _arbolCargado) {
                var hitIx = resolverHojaPorTareaKeyOTexto(
                    String(ctx.tareaKey || ctx.actividadKey || ''),
                    leaf
                );
                if (hitIx && hitIx.path) idxP = hitIx.path;
            }
            if (idxP && _arbolCargado) {
                return aplicarSeleccion(idxP, false);
            }
            var disp = el('display', 'necroProcesoDisplay');
            var hidIdx = el('procIdx', 'necroProcIdx');
            if (disp) {
                setDisplayText(disp, leaf);
            }
            if (hidIdx && idxP) {
                hidIdx.value = idxP;
                _rutaDescPath = idxP;
            }
            var hidPath = el('pathCodigo', 'necroPathCodigo');
            if (hidPath && idxP) hidPath.value = construirPathCodigoDesdePath(idxP);
            return true;
        }

        function displayTieneValor(disp) {
            if (!disp) {
                return false;
            }
            if ('value' in disp && String(disp.tagName || '').toUpperCase() === 'INPUT') {
                return !!String(disp.value || '').trim();
            }
            return !!String(disp.textContent || '').trim();
        }

        function aplicarDefaultNecropsiasGranja() {
            var disp = el('display', 'necroProcesoDisplay');
            if (displayTieneValor(disp)) {
                return true;
            }
            var hit = resolverHojaDefecto();
            if (!hit || !hit.path) return false;
            return aplicarSeleccion(hit.path, false);
        }

        function aplicarDefaultInicialSiCorresponde() {
            if (!aplicarDefaultInicial) {
                return false;
            }
            if (!defaultTareaKey && !defaultLeafName) {
                return false;
            }
            return aplicarDefaultNecropsiasGranja();
        }

        function engancharApertura(clickEl) {
            if (!clickEl) return;
            var abrir = function (ev) {
                if (ev) {
                    ev.preventDefault();
                    ev.stopPropagation();
                }
                open();
            };
            clickEl.addEventListener('click', abrir);
            clickEl.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    abrir(e);
                }
            });
        }

        var dispEl = el('display', 'necroProcesoDisplay');
        engancharApertura(dispEl);
        var openTriggerEl = el('openTrigger', '');
        if (openTriggerEl && openTriggerEl !== dispEl) {
            engancharApertura(openTriggerEl);
        }

        var btnCx = el('btnClose', 'btnCerrarModalMapaNecro');
        if (btnCx) btnCx.addEventListener('click', close);
        var btnPie = el('btnCloseFooter', 'btnModalMapaNecroCerrarPie');
        if (btnPie) btnPie.addEventListener('click', close);
        var busEl = el('mapaBuscar', '');
        if (busEl) {
            busEl.addEventListener('input', filtrarMapaProceso);
        }
        var modalEl = el('modal', 'modalMapaProcesoNecro');
        if (modalEl) {
            modalEl.addEventListener('click', function (e) {
                if (e.target === modalEl) close();
            });
        }

        cargarArbol().finally(function () {
            if (aplicarIx2Inicial && aplicarDesdeIx2()) {
                return;
            }
            aplicarDefaultInicialSiCorresponde();
        });

        return {
            open: open,
            close: close,
            openReadonly: openReadonly,
            openReadonlyByTareaKeys: openReadonlyByTareaKeys,
            aplicarSeleccion: aplicarSeleccion,
            recargarArbol: cargarArbol,
        };
    }

    global.SipMapaProcesoNecropsias = { init: init };
})(typeof window !== 'undefined' ? window : this);
