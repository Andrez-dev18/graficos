<?php

class HistorialRepository
{

    private $conn;

    public function __construct($db)
    {
        $this->conn = $db;
    }

    private function executeQuery($query)
    {
        $stmt = $this->conn->query($query);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function registrar($data)
    {
        $query = "
        INSERT INTO com_historial_acciones (
            id_programa,
            cod_usuario,
            nom_usuario,
            accion,
            tabla_afectada,
            registro_id,
            datos_previos,
            datos_nuevos,
            descripcion,
            fechaHora,
            ip,
            ubicacion_gps,
            dispositivo,
            sistema_operativo,
            navegador,
            user_agent
        ) VALUES (
            :id_programa,
            :cod_usuario,
            :nom_usuario,
            :accion,
            :tabla_afectada,
            :registro_id,
            :datos_previos,
            :datos_nuevos,
            :descripcion,
            :fechaHora,
            :ip,
            :ubicacion_gps,
            :dispositivo,
            :sistema_operativo,
            :navegador,
            :user_agent
        )
    ";

        return $this->executeNonQuery($query, [
            ':id_programa'      => $data['id_programa'],
            ':cod_usuario'      => $data['cod_usuario'],
            ':nom_usuario'      => $data['nom_usuario'],
            ':accion'           => $data['accion'],
            ':tabla_afectada'   => $data['tabla_afectada'],
            ':registro_id'      => $data['registro_id'],
            ':datos_previos'    => $data['datos_previos'],
            ':datos_nuevos'     => $data['datos_nuevos'],
            ':descripcion'      => $data['descripcion'],
            ':fechaHora'        => $data['fechaHora'],
            ':ip'               => $data['ip'],
            ':ubicacion_gps'    => $data['ubicacion_gps'],
            ':dispositivo'      => $data['dispositivo'],
            ':sistema_operativo' => $data['sistema_operativo'],
            ':navegador'        => $data['navegador'],
            ':user_agent'       => $data['user_agent'],
        ]);
    }


    private function executeNonQuery($query, $params = [])
    {
        $stmt = $this->conn->prepare($query);
        return $stmt->execute($params);
    }

    public function getHistorialDatatable($start, $length, $searchValue, $orderColumn, $orderDir, $filtros)
    {
        $params = [];
        // gregamos el prefijo h. para la tabla principal
        $whereQuery = " WHERE 1=1 ";

        // 1. FILTROS INDIVIDUALES (Usando el prefijo h.)
        if (!empty($filtros['id_programa'])) {
            $whereQuery .= " AND h.id_programa = :id_programa";
            $params[':id_programa'] = $filtros['id_programa'];
        }
        if (!empty($filtros['accion'])) {
            $whereQuery .= " AND h.accion = :accion";
            $params[':accion'] = $filtros['accion'];
        }
        if (!empty($filtros['tabla_afectada'])) {
            $whereQuery .= " AND h.tabla_afectada = :tabla_afectada";
            $params[':tabla_afectada'] = $filtros['tabla_afectada'];
        }
        if (!empty($filtros['dispositivo'])) {
            $whereQuery .= " AND h.dispositivo = :dispositivo";
            $params[':dispositivo'] = $filtros['dispositivo'];
        }
        if (!empty($filtros['sistema_operativo'])) {
            $whereQuery .= " AND h.sistema_operativo = :sistema_operativo";
            $params[':sistema_operativo'] = $filtros['sistema_operativo'];
        }
        if (!empty($filtros['navegador'])) {
            $whereQuery .= " AND h.navegador = :navegador";
            $params[':navegador'] = $filtros['navegador'];
        }

        // Rango de fechas
        if (!empty($filtros['fecha_inicio']) && !empty($filtros['fecha_fin'])) {
            $whereQuery .= " AND h.fechaHora BETWEEN :fecha_inicio AND :fecha_fin";
            $params[':fecha_inicio'] = $filtros['fecha_inicio'] . " 00:00:00";
            $params[':fecha_fin']    = $filtros['fecha_fin'] . " 23:59:59";
        }

        // 2. BÚSQUEDA GLOBAL (Ahora incluye el nombre del programa 'p.nombre')
        if (!empty($searchValue)) {
            $whereQuery .= " AND (
                h.cod_usuario LIKE :search OR 
                h.nom_usuario LIKE :search OR 
                h.descripcion LIKE :search OR 
                h.accion LIKE :search OR 
                h.tabla_afectada LIKE :search OR 
                p.nombre LIKE :search 
            )";
            $params[':search'] = "%{$searchValue}%";
        }

        // 3. CONTEO DE REGISTROS
        $stmtTotal = $this->conn->query("SELECT COUNT(id) FROM com_historial_acciones");
        $recordsTotal = $stmtTotal->fetchColumn();

        // Conteo filtrado con el JOIN
        $sqlFiltered = "SELECT COUNT(h.id) 
                        FROM com_historial_acciones h 
                        LEFT JOIN amd_programas p ON h.id_programa = p.id_programa" . $whereQuery;
        $stmtFiltered = $this->conn->prepare($sqlFiltered);
        $stmtFiltered->execute($params);
        $recordsFiltered = $stmtFiltered->fetchColumn();

        // 4. ORDENAMIENTO (Añadimos 'nombre_programa' a las columnas permitidas)
        $columnasPermitidas = [
            'id',
            'nombre_programa',
            'cod_usuario',
            'nom_usuario',
            'accion',
            'tabla_afectada',
            'fechaHora',
            'ip',
            'dispositivo',
            'sistema_operativo',
            'navegador'
        ];

        // Si la columna seleccionada no está permitida, ordenamos por fechaHora
        $orderColumnClean = in_array($orderColumn, $columnasPermitidas) ? $orderColumn : 'fechaHora';
        // Si la columna es del join, le ponemos su alias para ordenar, si no, le ponemos h.
        $orderPrefix = ($orderColumnClean === 'nombre_programa') ? '' : 'h.';

        $orderDir = strtoupper($orderDir) === 'ASC' ? 'ASC' : 'DESC';

        // 5. CONSULTA FINAL CON EL LEFT JOIN
        $sql = "SELECT h.*, p.nombre as nombre_programa 
                FROM com_historial_acciones h 
                LEFT JOIN amd_programas p ON h.id_programa = p.id_programa 
                {$whereQuery} 
                ORDER BY {$orderPrefix}{$orderColumnClean} {$orderDir} 
                LIMIT :start, :length";

        $stmt = $this->conn->prepare($sql);

        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->bindValue(':start', (int)$start, PDO::PARAM_INT);
        $stmt->bindValue(':length', (int)$length, PDO::PARAM_INT);

        $stmt->execute();
        $data = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return [
            'recordsTotal'    => $recordsTotal,
            'recordsFiltered' => $recordsFiltered,
            'data'            => $data
        ];
    }

    // Función extra para poblar los selects en el frontend
    public function getFiltrosDisponibles()
    {
        $filtros = [];
        $columnas = ['accion', 'tabla_afectada', 'dispositivo', 'sistema_operativo', 'navegador'];

        foreach ($columnas as $col) {
            $stmt = $this->conn->query("SELECT DISTINCT {$col} FROM com_historial_acciones WHERE {$col} IS NOT NULL AND {$col} != '' ORDER BY {$col}");
            $filtros[$col] = $stmt->fetchAll(PDO::FETCH_COLUMN);
        }
        return $filtros;
    }
}
