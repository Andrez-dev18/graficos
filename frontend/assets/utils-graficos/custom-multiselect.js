/**
 * Componente Reutilizable CustomMultiSelect
 * Soporta selección múltiple, búsqueda interna y selección por defecto
 */
class CustomMultiSelect {
    constructor({ btnId, labelId, dropdownId, searchId, optionsContainerId, options = [], title, onChange }) {
        this.btn = document.getElementById(btnId);
        this.label = document.getElementById(labelId);
        this.dropdown = document.getElementById(dropdownId);
        this.search = document.getElementById(searchId);
        this.container = document.getElementById(optionsContainerId);
        this.title = title;
        this.searchQuery = '';
        this.onChange = onChange;
        this.initialized = false;

        this.options = options.map((item, idx) => {
            const id = typeof item === 'object' ? String(item.id) : String(item);
            const label = typeof item === 'object' ? String(item.label || item.id) : String(item);
            const isSelected = (typeof item === 'object' && item.selected !== undefined) ? Boolean(item.selected) : true;
            return { id, label, selected: isSelected };
        });

        if (this.btn && this.dropdown && this.container) {
            this.init();
        }
    }

    init() {
        if (!this.btn._hasMsClick) {
            this.btn._hasMsClick = true;
            this.btn.addEventListener('click', (e) => {
                e.stopPropagation();
                document.querySelectorAll('.custom-multiselect-dropdown').forEach(d => {
                    if (d !== this.dropdown) d.classList.add('hidden');
                });

                const isHidden = this.dropdown.classList.contains('hidden');
                if (isHidden) {
                    this.dropdown.classList.remove('hidden');
                    if (this.search) this.search.focus();
                } else {
                    this.dropdown.classList.add('hidden');
                }
            });
        }

        if (!this.dropdown._hasMsClick) {
            this.dropdown._hasMsClick = true;
            this.dropdown.addEventListener('click', (e) => e.stopPropagation());
        }

        if (this.search && !this.search._hasMsInput) {
            this.search._hasMsInput = true;
            this.search.addEventListener('input', (e) => {
                this.searchQuery = e.target.value;
                this.render();
            });
        }

        this.updateLabel();
        this.render();
        this.initialized = true;
    }

    updateLabel() {
        if (!this.label) return;
        const seleccionados = this.options.filter(o => o.selected);
        const total = this.options.length;

        if (seleccionados.length === 0) {
            this.label.textContent = 'Ninguno seleccionado';
            this.label.className = 'truncate text-slate-400 font-normal';
        } else if (seleccionados.length === total && total > 1) {
            this.label.textContent = '(Todo)';
            this.label.className = 'truncate text-slate-800 font-semibold';
        } else if (seleccionados.length === 1) {
            this.label.textContent = seleccionados[0].label;
            this.label.className = 'truncate text-slate-800 font-semibold';
        } else {
            this.label.textContent = `${seleccionados.length} seleccionados`;
            this.label.className = 'truncate text-slate-800 font-semibold';
        }

        if (this.initialized && typeof this.onChange === 'function') {
            this.onChange();
        }
    }

    render() {
        if (!this.container) return;
        const query = this.searchQuery.toLowerCase().trim();
        const filtrados = this.options.filter(op => op.label.toLowerCase().includes(query));
        const todosSeleccionados = this.options.length > 0 && this.options.every(o => o.selected);

        let html = '';
        if (!query || 'todos'.includes(query)) {
            html += `
                <label class="flex items-center gap-3 px-3 py-2 hover:bg-blue-50 rounded-lg cursor-pointer group transition-colors">
                    <input type="checkbox" class="chk-todos w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer" ${todosSeleccionados ? 'checked' : ''}>
                    <span class="text-xs font-bold text-blue-700 group-hover:text-blue-800 uppercase tracking-wider">(TODO)</span>
                </label>
                <div class="my-1 border-t border-slate-100"></div>
            `;
        }

        if (filtrados.length === 0) {
            html += `<div class="px-3 py-3 text-xs text-slate-400 text-center">No se encontraron opciones</div>`;
        } else {
            filtrados.forEach(op => {
                html += `
                    <label class="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 rounded-lg cursor-pointer group transition-colors">
                        <input type="checkbox" data-id="${op.id}" ${op.selected ? 'checked' : ''} class="chk-item w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer">
                        <span class="text-xs text-slate-700 group-hover:text-slate-900 font-medium">${op.label}</span>
                    </label>
                `;
            });
        }

        this.container.innerHTML = html;

        const chkTodos = this.container.querySelector('.chk-todos');
        if (chkTodos) {
            chkTodos.addEventListener('change', (e) => {
                const isChecked = e.target.checked;
                this.options.forEach(o => o.selected = isChecked);
                this.updateLabel();
                this.render();
            });
        }

        const chksItem = this.container.querySelectorAll('.chk-item');
        chksItem.forEach(chk => {
            chk.addEventListener('change', (e) => {
                const id = e.target.getAttribute('data-id');
                const opcion = this.options.find(o => o.id === id);
                if (opcion) opcion.selected = e.target.checked;
                this.updateLabel();
                this.render();
            });
        });
    }

    getSelectedValues() {
        return this.options.filter(o => o.selected).map(o => o.id);
    }

    getSelected() {
        return this.getSelectedValues();
    }

    selectAll(triggerChange = true) {
        this.options.forEach(o => o.selected = true);
        this.updateLabel();
        this.render();
        if (triggerChange && typeof this.onChange === 'function') this.onChange();
    }

    setOptions(newOptions, defaultSelectFirst = false) {
        const wasAllSelected = this.options.length === 0 || this.options.every(o => o.selected);
        const newOptsExplicitAll = newOptions.length > 0 && newOptions.every(o => typeof o === 'object' && o.selected === true);
        const previousSelected = this.getSelectedValues();

        this.options = newOptions.map((item, idx) => {
            const id = typeof item === 'object' ? String(item.id) : String(item);
            const label = typeof item === 'object' ? String(item.label || item.id) : String(item);

            let isSelected = true;
            if (wasAllSelected || newOptsExplicitAll) {
                isSelected = true;
            } else if (previousSelected.length > 0) {
                isSelected = previousSelected.includes(id);
            } else if (typeof item === 'object' && item.selected !== undefined) {
                isSelected = Boolean(item.selected);
            } else if (defaultSelectFirst && idx === 0) {
                isSelected = true;
            }

            return { id, label, selected: isSelected };
        });

        this.updateLabel();
        this.render();
    }

    clearSelection() {
        this.options.forEach(o => o.selected = false);
        this.updateLabel();
        this.render();
    }
}

// Cerrar cualquier dropdown al hacer clic fuera
document.addEventListener('click', () => {
    document.querySelectorAll('.custom-multiselect-dropdown').forEach(d => d.classList.add('hidden'));
});

window.CustomMultiSelect = CustomMultiSelect;