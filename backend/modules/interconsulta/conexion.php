<?php
require_once 'configuracion.php';
function conectar_aqp()
{
    $conectar_aqp = new mysqli(DB_HOST_AQP, DB_USER_AQP, DB_PASSWORD_AQP, DB_NAME_AQP);
    // Verificar si hay errores de conexión
    if ($conectar_aqp->connect_errno) {
        //die("Error de conexión: " . $conexion_aqp->connect_error);
        return false;
    }
    $conectar_aqp->set_charset("utf8");
    return $conectar_aqp;
}
function conectar_joya_mysqli()
{
    $conectar_joya = new mysqli(DB_HOST_JOYA, DB_USER_JOYA, DB_PASSWORD_JOYA, DB_NAME_JOYA);
    // Verificar si hay errores de conexión
    if ($conectar_joya->connect_errno) {
        //die("Error de conexión: " . $conexion_aqp->connect_error);
        return false;
    }
    $conectar_joya->set_charset("utf8");
    return $conectar_joya;
}
