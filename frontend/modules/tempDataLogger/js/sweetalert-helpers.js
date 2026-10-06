/**
 * Helpers para SweetAlert2: evita desbordes con contenido largo (scroll).
 * Incluir después de: <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
 */
(function() {
    if (typeof Swal === 'undefined') return;
    window.SwalAlert = function(mensaje, tipo) {
        var icono = (tipo === 'error') ? 'error' : (tipo === 'success') ? 'success' : (tipo === 'warning') ? 'warning' : 'info';
        var titulo = (tipo === 'error') ? 'Error' : (tipo === 'success') ? 'Éxito' : (tipo === 'warning') ? 'Advertencia' : 'Información';
        var txt = typeof mensaje === 'string' ? mensaje : String(mensaje);
        return Swal.fire({
            icon: icono,
            title: titulo,
            html: '<div class="text-left max-h-[60vh] overflow-y-auto px-1" style="white-space: pre-wrap;">' + txt.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') + '</div>',
            confirmButtonText: 'Aceptar',
            customClass: { htmlContainer: 'text-left' }
        });
    };
    window.SwalConfirm = function(mensaje, titulo) {
        var txt = typeof mensaje === 'string' ? mensaje : String(mensaje);
        return Swal.fire({
            title: titulo || 'Confirmar',
            html: '<div class="text-left max-h-[50vh] overflow-y-auto" style="white-space: pre-wrap;">' + txt.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') + '</div>',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí',
            cancelButtonText: 'Cancelar',
            customClass: { htmlContainer: 'text-left' }
        }).then(function(r) { return r.isConfirmed; });
    };
})();
