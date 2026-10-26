class SearchableSelect {
    constructor({ containerId, title = 'Selecciona', placeholder = '(Todo)', options = [], onChange = null } = {}) {
        this.container = document.getElementById(containerId);
        this.title = title;
        this.placeholder = placeholder;
        this.onChange = onChange;
        this.options = [];
        this.value = '';
        this.instanceId = `ss-${Math.random().toString(36).slice(2, 9)}`;

        if (!this.container) return;

        this.renderBase();
        this.cacheElements();
        this.bindEvents();
        this.setOptions(options, false);
    }

    renderBase() {
        this.container.innerHTML = `
            <div class="relative">
                <button type="button" data-ss-btn
                    class="flex items-center justify-between gap-2 bg-white border border-slate-300 hover:border-slate-400 text-slate-800 text-sm font-semibold rounded-lg px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer min-w-[190px] max-w-[280px] w-full">
                    <span data-ss-label class="truncate text-left select-none text-slate-400 font-normal">${this.escapeHtml(this.placeholder)}</span>
                    <svg class="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                    </svg>
                </button>
                <div data-ss-dropdown
                    class="hidden absolute top-full left-0 mt-1 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-50 p-2 flex flex-col gap-2">
                    <input type="text" data-ss-search placeholder="Buscar ${this.escapeHtml(this.title.toLowerCase())}..."
                        class="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 font-normal">
                    <div data-ss-options class="max-h-64 overflow-y-auto custom-scrollbar flex flex-col gap-1 text-xs"></div>
                </div>
            </div>
        `;
    }

    cacheElements() {
        this.button = this.container.querySelector('[data-ss-btn]');
        this.label = this.container.querySelector('[data-ss-label]');
        this.dropdown = this.container.querySelector('[data-ss-dropdown]');
        this.search = this.container.querySelector('[data-ss-search]');
        this.optionsContainer = this.container.querySelector('[data-ss-options]');
    }

    bindEvents() {
        this.button?.addEventListener('click', (event) => {
            event.stopPropagation();
            if (this.dropdown.classList.contains('hidden')) {
                this.open();
            } else {
                this.close();
            }
        });

        this.dropdown?.addEventListener('click', (event) => event.stopPropagation());

        this.search?.addEventListener('input', () => {
            this.renderOptions();
        });

        this.optionsContainer?.addEventListener('click', (event) => {
            const option = event.target.closest('[data-ss-value]');
            if (!option) return;
            this.setValue(option.getAttribute('data-ss-value') || '', true);
            this.close();
        });

        document.addEventListener('click', () => this.close());
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') this.close();
        });
    }

    normalize(texto) {
        return String(texto || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    }

    escapeHtml(texto) {
        if (texto === null || texto === undefined) return '';
        return String(texto)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    setOptions(options = [], preserveValue = true) {
        this.options = (Array.isArray(options) ? options : []).map(item => {
            if (typeof item === 'object' && item !== null) {
                const value = String(item.value ?? item.id ?? item.label ?? '');
                return { value, label: String(item.label ?? item.value ?? value) };
            }
            return { value: String(item), label: String(item) };
        }).filter(item => item.value !== '');

        if (preserveValue && this.value !== '' && !this.options.some(item => item.value === this.value)) {
            this.value = '';
        }

        this.updateLabel();
        this.renderOptions();
    }

    getValue() {
        return this.value;
    }

    setValue(value, triggerChange = false) {
        const nextValue = value === null || value === undefined ? '' : String(value);
        this.value = nextValue;
        this.updateLabel();
        if (triggerChange && typeof this.onChange === 'function') {
            this.onChange(this.value);
        }
    }

    reset() {
        this.setValue('', false);
        if (this.search) this.search.value = '';
        this.renderOptions();
    }

    updateLabel() {
        if (!this.label) return;
        const selected = this.options.find(item => item.value === this.value);
        if (selected) {
            this.label.textContent = selected.label;
            this.label.className = 'truncate text-left select-none text-slate-800 font-semibold';
        } else {
            this.label.textContent = this.placeholder;
            this.label.className = 'truncate text-left select-none text-slate-400 font-normal';
        }
    }

    renderOptions() {
        if (!this.optionsContainer) return;
        const query = this.normalize(this.search ? this.search.value : '').trim();
        const filtered = query === ''
            ? this.options
            : this.options.filter(item => this.normalize(item.label).includes(query));

        const todoClass = this.value === '' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-700 hover:bg-slate-50 font-medium';
        let html = `
            <button type="button" data-ss-value=""
                class="w-full text-left px-2.5 py-2 rounded-lg transition-colors ${todoClass}">
                ${this.escapeHtml(this.placeholder)}
            </button>
        `;

        if (filtered.length === 0) {
            html += '<div class="px-3 py-3 text-xs text-slate-400 text-center">Sin resultados</div>';
        } else {
            html += filtered.map(item => {
                const active = item.value === this.value;
                const className = active ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-700 hover:bg-slate-50 font-medium';
                return `
                    <button type="button" data-ss-value="${this.escapeHtml(item.value)}"
                        class="w-full text-left px-2.5 py-2 rounded-lg transition-colors ${className}">
                        <span class="block truncate" title="${this.escapeHtml(item.label)}">${this.escapeHtml(item.label)}</span>
                    </button>
                `;
            }).join('');
        }

        this.optionsContainer.innerHTML = html;
    }

    open() {
        document.querySelectorAll('[data-ss-dropdown]').forEach(dropdown => {
            if (dropdown !== this.dropdown) dropdown.classList.add('hidden');
        });
        this.dropdown?.classList.remove('hidden');
        if (this.search) {
            this.search.value = '';
            this.search.focus();
        }
        this.renderOptions();
    }

    close() {
        this.dropdown?.classList.add('hidden');
        if (this.search) this.search.value = '';
    }
}

window.SearchableSelect = SearchableSelect;
