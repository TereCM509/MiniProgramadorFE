<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8">
    <title>🧙 Haunted Mansion</title>
    <link rel="stylesheet" href="Estilos.css">
</head>

<body>

    <!-- ===================== HEADER ===================== -->
    <header class="topbar">
        <!-- Botón Inicio: href a la URL de pagina principal -->
        <a href="#" class="btn-inicio" title="Volver a la página principal">Inicio 🏠</a>

        <nav class="menu-principal">
            <div class="menu-item">
                <button class="menu-trigger" aria-haspopup="true" aria-expanded="false">
                    Casa Embrujada 👻 <span class="flechita">▾</span>
                </button>
                <div class="dropdown-content">
                    <a href="Index.php?mision=1" class="dropdown-link">Misión 1: Antorchas 🔥</a>
                    <a href="Index.php?mision=2" class="dropdown-link">Misión 2: Ventanas 田</a>
                    <a href="#" class="dropdown-link dropdown-link-bloqueado" onclick="return false;">Misión 3:
                        Próximamente 🔒</a>
                </div>
            </div>
        </nav>
    </header>

    <!-- ===================== LAYOUT PRINCIPAL: bandeja izquierda + workspace derecha ===================== -->
    <div class="layout-principal">

        <!-- IZQUIERDA: Bandeja de bloques -->
        <aside id="bandejaBloques">
            <div class="bandeja-scroll">
                <p class="tituloBandeja">Bloques 🧩</p>

                <div class="contenedorBloques">
                    <?php
                        $mision = $_GET['mision'] ?? '1'; // Misión 1 por defecto

                        if ($mision == '1') {
                            include('misiones/casa_embrujada/Mision1_Antorchas_Bloques.html');
                        } elseif ($mision == '2') {
                            include('misiones/casa_embrujada/Mision2_Ventanas_Bloques.html');
                        } else {
                            echo "<p style='color:white; text-align:center;'>Misión no encontrada</p>";
                        }
                    ?>
                </div>
            </div><!-- fin .bandeja-scroll -->
        </aside>

        <!-- DERECHA: Workspace kanban -->
        <main>
            <div id="workspace">
                <button id="btnPlay" onclick="verificarEstado()">Construir ⚙️</button>
            </div>
            <div id="boteBasura"> </div>
        </main>

    </div><!-- fin .layout-principal -->

    <!-- ===================== MODAL: resultado del algoritmo ===================== -->
    <div id="modalOverlay" class="modal-overlay modal-oculto">
        <div class="modal-caja">
            <div id="modalEncabezado" class="modal-encabezado">
                <span id="modalIcono" class="modal-icono"></span>
                <h2 id="modalTitulo" class="modal-titulo"></h2>
            </div>
            <div class="modal-cuerpo">
                <p id="modalMensaje" class="modal-mensaje"></p>
            </div>
            <div class="modal-pie">
                <button id="modalBtnCerrar" onclick="cerrarModal()">Cerrar</button>
            </div>
        </div>
    </div>

    <script src="Interacciones.js"></script>
</body>

</html>