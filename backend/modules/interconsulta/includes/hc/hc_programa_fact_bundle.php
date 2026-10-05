<?php
declare(strict_types=1);

/**
 * Cabecera + líneas de detalle + sigla de tipo para san_fact_programa_*.
 * Misma lógica que modules/planificacion/programas/get_programa_cab_detalle.php
 * pero recibe mysqli ya abierto (p. ej. conexión de Historia clínica).
 *
 * @return array{cab: array<string, mixed>, detalles: list<array<string, mixed>>, sigla: string}|null null si no existe cabecera
 */
function hc_programa_fact_fetch_cab_det_sigla(mysqli $conn, string $codigo): ?array
{
    $codigo = trim($codigo);
    if ($codigo === '') {
        return null;
    }

    $sqlCab = "SELECT c.codigo, c.nombre, c.codTipo, c.nomTipo, c.descripcion, c.fechaHoraRegistro,
        c.categoria, c.tipoCDP, c.despliegue, c.fechaInicio, c.fechaFin, c.esEspecial, c.modoEspecial, c.rutaArbol
        FROM san_fact_programa_cab c WHERE TRIM(c.codigo) = ? LIMIT 1";
    $stmtCab = $conn->prepare($sqlCab);
    if (!$stmtCab) {
        return null;
    }
    $stmtCab->bind_param('s', $codigo);
    $stmtCab->execute();
    $resCab = $stmtCab->get_result();
    $cab = $resCab ? $resCab->fetch_assoc() : null;
    $stmtCab->close();

    if (!$cab) {
        return null;
    }

    $cab['despliegue'] = (string) ($cab['despliegue'] ?? '');
    $cab['fechaInicio'] = (string) ($cab['fechaInicio'] ?? '');
    $cab['fechaFin'] = (string) ($cab['fechaFin'] ?? '');
    $cab['tipo'] = trim((string) ($cab['tipoCDP'] ?? ''));
    $cab['categoria'] = (string) ($cab['categoria'] ?? '');
    $cab['esEspecial'] = (int) ($cab['esEspecial'] ?? 0);
    $cab['modoEspecial'] = trim((string) ($cab['modoEspecial'] ?? ''));
    $cab['rutaArbol'] = (string) ($cab['rutaArbol'] ?? '');

    $camposDet = 'ubicacion, codProducto, nomProducto, codProveedor, nomProveedor, unidades, dosis, unidadDosis, numeroFrascos, edad, descripcionVacuna, areaGalpon, cantidadPorGalpon, posDetalle, tolerancia, fechas, intervaloMeses, diaDelMes';
    $sqlDet = 'SELECT ' . $camposDet . ' FROM san_fact_programa_det WHERE TRIM(codPrograma) = ? ORDER BY posDetalle, id';
    $stmtDet = $conn->prepare($sqlDet);
    $detalles = [];
    if ($stmtDet) {
        $stmtDet->bind_param('s', $codigo);
        $stmtDet->execute();
        $resDet = $stmtDet->get_result();
        while ($resDet && ($d = $resDet->fetch_assoc())) {
            $detalles[] = $d;
        }
        $stmtDet->close();
    }

    $cab['intervaloMeses'] = null;
    $cab['diaDelMes'] = null;
    $cab['fechasManuales'] = [];
    $cab['toleranciaEspecial'] = null;
    if (!empty($detalles)) {
        if (isset($detalles[0]['fechas']) && $detalles[0]['fechas'] !== null && $detalles[0]['fechas'] !== '') {
            $dec = json_decode((string) $detalles[0]['fechas'], true);
            $cab['fechasManuales'] = is_array($dec) ? $dec : [];
        }
        if (isset($detalles[0]['intervaloMeses']) && $detalles[0]['intervaloMeses'] !== null && $detalles[0]['intervaloMeses'] !== '') {
            $cab['intervaloMeses'] = (int) $detalles[0]['intervaloMeses'];
        }
        if (isset($detalles[0]['diaDelMes']) && $detalles[0]['diaDelMes'] !== null && $detalles[0]['diaDelMes'] !== '') {
            $cab['diaDelMes'] = (int) $detalles[0]['diaDelMes'];
        }
        if (isset($detalles[0]['tolerancia']) && $detalles[0]['tolerancia'] !== null && $detalles[0]['tolerancia'] !== '') {
            $cab['toleranciaEspecial'] = (int) $detalles[0]['tolerancia'];
        }
    }

    $sigla = 'PL';
    $codTipo = (int) ($cab['codTipo'] ?? 0);
    if ($codTipo > 0) {
        $stSigla = $conn->prepare('SELECT sigla FROM san_dim_tipo_programa WHERE codigo = ? LIMIT 1');
        if ($stSigla) {
            $stSigla->bind_param('i', $codTipo);
            $stSigla->execute();
            $rSigla = $stSigla->get_result();
            if ($rSigla) {
                $row = $rSigla->fetch_assoc();
                if ($row && !empty(trim((string) ($row['sigla'] ?? '')))) {
                    $sigla = strtoupper(trim((string) $row['sigla']));
                    if ($sigla === 'NEC') {
                        $sigla = 'NC';
                    }
                }
            }
            $stSigla->close();
        }
    }

    return ['cab' => $cab, 'detalles' => $detalles, 'sigla' => $sigla];
}
