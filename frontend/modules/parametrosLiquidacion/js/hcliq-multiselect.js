/**
 * Multiselect de parámetros del módulo Gráficas liquidación.
 */
class HcliqMultiSelect {
    constructor(opts) {
        this.btn = document.getElementById(opts.btnId);
        this.label = document.getElementById(opts.labelId);
        this.dropdown = document.getElementById(opts.dropdownId);
        this.search = document.getElementById(opts.searchId);
        this.container = document.getElementById(opts.optionsContainerId);
        this.onChange = typeof opts.onChange === 'function' ? opts.onChange : function () {};
        this.maxSelected = opts.maxSelected === 0 ? Infinity : (opts.maxSelected || 4); /* 0 = sin tope */
        this.emptyLabel = typeof opts.emptyLabel === 'string' && opts.emptyLabel !== '' ? opts.emptyLabel : 'Ninguno';
        this.maxMessage = typeof opts.maxMessage === 'string' && opts.maxMessage !== ''
            ? opts.maxMessage
            : 'Máximo {n} parámetros para combinar.';
        this.options = [];
        this.searchQuery = '';
        this.initialized = false;

        if (this.btn && this.dropdown && this.container) {
            this.init();
        }
    }

    init() {
        this.btn.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.hcliq-ms-dropdown').forEach((d) => {
                if (d !== this.dropdown) {
                    d.classList.add('hc-hidden');
                }
            });
            const oculto = this.dropdown.classList.contains('hc-hidden');
            this.dropdown.classList.toggle('hc-hidden', !oculto);
            if (oculto && this.search) {
                this.search.focus();
            }
        });

        this.dropdown.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        if (this.search) {
            this.search.addEventListener('input', (e) => {
                this.searchQuery = e.target.value;
                this.render();
            });
        }

        this.initialized = true;
        this.render();
    }

    setOptions(list, selectedIds) {
        const sel = new Set((selectedIds || []).map(String));
        this.options = (list || []).map((o) => ({
            id: String(o.id),
            label: String(o.label || o.id),
            color: String(o.color || ''),
            selected: sel.has(String(o.id)),
        }));
        this.updateLabel(false);
        this.render();
    }

    getSelected() {
        return this.options.filter((o) => o.selected).map((o) => o.id);
    }

    setSelected(ids) {
        const sel = new Set((ids || []).map(String));
        this.options.forEach((o) => {
            o.selected = sel.has(o.id);
        });
        this.updateLabel(false);
        this.render();
    }

    updateLabel(trigger) {
        const seleccionados = this.options.filter((o) => o.selected);
        const total = this.options.length;
        if (this.label) {
            let texto;
            if (seleccionados.length === 0) {
                texto = this.emptyLabel;
            } else if (seleccionados.length === total && total > 1) {
                texto = 'Todos (' + total + ')';
            } else if (seleccionados.length === 1) {
                texto = seleccionados[0].label;
            } else {
                texto = seleccionados.length + ' seleccionados';
            }
            const dots = seleccionados.slice(0, this.maxSelected).map((o) => (
                o.color ? '<span class="hcliq-ms-dot" style="background:' + this.escapeHtml(o.color) + '"></span>' : ''
            )).join('');
            this.label.innerHTML = dots + '<span>' + this.escapeHtml(texto) + '</span>';
        }
        if (trigger && this.initialized) {
            this.onChange(this.getSelected());
        }
    }

    escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    render() {
        if (!this.container) {
            return;
        }
        const q = this.searchQuery.toLowerCase().trim();
        const filtrados = this.options.filter((o) => o.label.toLowerCase().includes(q));
        const todosSel = this.options.length > 0 && this.options.every((o) => o.selected);

        let html = '';
        if (!q) {
            html += '<label class="hcliq-ms-item hcliq-ms-item--todos">'
                + '<input type="checkbox" class="hcliq-ms-chk-todos" ' + (todosSel ? 'checked' : '') + '>'
                + '<span>Todos</span>'
                + '</label>'
                + '<div class="hcliq-ms-sep"></div>';
        }

        if (filtrados.length === 0) {
            html += '<div class="hcliq-ms-empty">Sin opciones</div>';
        } else {
            html += filtrados.map((o) => (
                '<label class="hcliq-ms-item">'
                + '<input type="checkbox" class="hcliq-ms-chk-item" data-id="' + this.escapeHtml(o.id) + '" ' + (o.selected ? 'checked' : '') + '>'
                + (o.color ? '<span class="hcliq-ms-dot" style="background:' + this.escapeHtml(o.color) + '"></span>' : '')
                + '<span>' + this.escapeHtml(o.label) + '</span>'
                + '</label>'
            )).join('');
        }

        this.container.innerHTML = html;

        const chkTodos = this.container.querySelector('.hcliq-ms-chk-todos');
        if (chkTodos) {
            chkTodos.addEventListener('change', (e) => {
                const marcar = e.target.checked;
                this.options.forEach((o) => {
                    o.selected = marcar;
                });
                if (marcar && this.options.length > this.maxSelected) {
                    this.options.forEach((o, i) => {
                        o.selected = i < this.maxSelected;
                    });
                }
                this.render();
                this.updateLabel(true);
            });
        }

        this.container.querySelectorAll('.hcliq-ms-chk-item').forEach((chk) => {
            chk.addEventListener('change', (e) => {
                const id = e.target.getAttribute('data-id');
                const op = this.options.find((o) => o.id === id);
                if (!op) {
                    return;
                }
                op.selected = e.target.checked;
                const ids = this.getSelected();
                if (ids.length > this.maxSelected) {
                    op.selected = false;
                    if (typeof Swal !== 'undefined') {
                        Swal.fire({ icon: 'warning', title: 'Selección', text: this.maxMessage.replace('{n}', String(this.maxSelected)) });
                    }
                }
                this.render();
                this.updateLabel(true);
            });
        });
    }
}

document.addEventListener('click', () => {
    document.querySelectorAll('.hcliq-ms-dropdown').forEach((d) => {
        d.classList.add('hc-hidden');
    });
});
