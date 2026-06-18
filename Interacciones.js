// Seleccionamos todos los elementos del HTML para manipularlos con JS
const piezas = document.querySelectorAll(".pieza");                       // Selecciona todas las piezas con la clase "pieza"
const piezaInicio = document.getElementById("piezaInicio");
const piezaActivarCraneo = document.getElementById("piezaActivarCraneo");
const piezaMostrarSecreto = document.getElementById("piezaMostrarSecreto");
const piezaFin = document.getElementById("piezaFin");
const piezaRepetir = document.getElementById("piezaRepetir");
const piezaTiempo = document.getElementById("piezaTiempo");
const piezaAntorcha = document.getElementById("piezaAntorcha");
const piezaVentana = document.getElementById("piezaVentana");
const workspace = document.getElementById("workspace");                   // Referencia al workspace (necesaria para convertir coordenadas)

// Variables para el control del movimiento (Drag and Drop)
let piezaActual = null; // Guarda qué pieza estoy moviendo; null = ninguna seleccionada
let offsetX = 0;        // Distancia entre el cursor y el borde izquierdo de la pieza (en coords del workspace)
let offsetY = 0;        // Distancia entre el cursor y el borde superior de la pieza (en coords del workspace)
const UMBRAL = 45;      // Distancia máxima (px) para que las piezas se "imanten" y acoplen

// Función que se activa al presionar el mouse sobre una pieza
function iniciarArrastre(eDownCursor) {

    // Si el clic fue sobre un input o select (dentro de la pieza), no iniciamos el arrastre
    // para que el usuario pueda interactuar con ellos normalmente
    const tagClic = eDownCursor.target.tagName;
    if (tagClic === "INPUT" || tagClic === "SELECT" || tagClic === "OPTION") return;

    // currentTarget: siempre es la pieza (.pieza) aunque el clic haya sido en un hijo (ej. cuadrito)
    piezaActual = eDownCursor.currentTarget;

    const rectWorkspace = workspace.getBoundingClientRect(); // Posición del workspace en la pantalla

    // Si la pieza todavía está en la bandeja (no en el workspace), la trasladamos
    if (!workspace.contains(piezaActual)) {
        workspace.appendChild(piezaActual);       // Mueve el elemento al workspace en el DOM
        piezaActual.style.position = "absolute";  // La saca del flujo normal para posicionarla libremente

        // La colocamos centrada en el cursor (dentro del workspace)
        piezaActual.style.left = (eDownCursor.clientX - rectWorkspace.left - piezaActual.offsetWidth / 2) + "px";
        piezaActual.style.top = (eDownCursor.clientY - rectWorkspace.top - piezaActual.offsetHeight / 2) + "px";
    }

    /*
        CORRECCIÓN DE COORDENADAS:
        clientX/clientY → coordenadas del cursor respecto al BORDE DE LA PANTALLA (viewport)
        offsetLeft/offsetTop → coordenadas de la pieza respecto a su PADRE (el workspace)
        
        Para mezclarlos correctamente, restamos la posición del workspace en el viewport
        (rectWorkspace.left / rectWorkspace.top), así todo queda en el mismo sistema de referencia.
        
        offsetX/offsetY = distancia entre el cursor y el borde de la pieza, en coords del workspace.
        Esto evita que la pieza "salte" al ser clickeada.
    */
    offsetX = eDownCursor.clientX - rectWorkspace.left - piezaActual.offsetLeft;
    offsetY = eDownCursor.clientY - rectWorkspace.top - piezaActual.offsetTop;
}

// Función que mueve la pieza siguiendo al cursor
function moverPieza(eMoveCursor) {
    if (!piezaActual) return; // Si no hay pieza seleccionada, no hace nada

    const rectWorkspace = workspace.getBoundingClientRect(); // Posición actual del workspace en pantalla

    /*
        Convertimos la posición del cursor (viewport) a coordenadas del workspace:
        posición en workspace = posición en pantalla - posición del workspace en pantalla - offset inicial
        
        Al restar el offset, la pieza se mueve de forma suave sin "saltar",
        manteniendo la distancia original entre el cursor y el borde de la pieza.
    */
    piezaActual.style.left = (eMoveCursor.clientX - rectWorkspace.left - offsetX) + "px";
    piezaActual.style.top = (eMoveCursor.clientY - rectWorkspace.top - offsetY) + "px";

    verificarTodosLosAcoples(); // Revisa si la pieza está cerca de otra para pegarse
}

// Suelta la pieza: ya no hay pieza activa
function terminarArrastre() {
    piezaActual = null; // null indica que no se está moviendo ninguna pieza
}

// Revisa la cercanía entre la pieza que se mueve y todas las demás en el workspace
function verificarTodosLosAcoples() {
    // Solo comparamos piezas que ya están en el workspace (no las de la bandeja)
    const piezasEnWorkspace = workspace.querySelectorAll(".pieza");

    piezasEnWorkspace.forEach(pieza => {
        if (pieza === piezaActual) return; // No se compara consigo misma

        const piezaMoviendose = piezaActual.getBoundingClientRect(); // Coordenadas en viewport de la pieza que se mueve
        const piezaEstatica = pieza.getBoundingClientRect();       // Coordenadas en viewport de la pieza estática

        /*
            Usamos getBoundingClientRect() en ambas piezas: como las dos están en el mismo sistema
            (viewport), la comparación es válida aunque las piezas estén posicionadas con offsetLeft/Top.

            Condición de acople: la distancia vertical (bordes que se tocan) Y la horizontal (alineación)
            deben ser menores al UMBRAL.
        */

        // Caso 1: la pieza que se mueve llega POR ARRIBA de la estática
        // → borde inferior de la que se mueve ≈ borde superior de la estática
        if (Math.abs(piezaMoviendose.bottom - piezaEstatica.top) < UMBRAL &&
            Math.abs(piezaMoviendose.left - piezaEstatica.left) < UMBRAL)
            acoplar(piezaActual, pieza);

        // Caso 2: la pieza que se mueve llega POR ABAJO de la estática
        // → borde superior de la que se mueve ≈ borde inferior de la estática
        if (Math.abs(piezaEstatica.bottom - piezaMoviendose.top) < UMBRAL &&
            Math.abs(piezaEstatica.left - piezaMoviendose.left) < UMBRAL)
            acoplar(pieza, piezaActual);
    });
}

// "Pega" piezaDeabajo exactamente debajo de piezaDearriba
function acoplar(piezaDearriba, piezaDeabajo) {
    // Ambas usan offsetLeft/offsetTop porque las dos están en el mismo padre (workspace)
    piezaDeabajo.style.left = piezaDearriba.offsetLeft + "px";
    piezaDeabajo.style.top = (piezaDearriba.offsetTop + piezaDearriba.offsetHeight) + "px";
}

function verificarEstado() {
    const piezasEnWorkspace = workspace.querySelectorAll(".pieza");

    // Caso 1: workspace vacío
    if (piezasEnWorkspace.length === 0) {
        mostrarModal(false, "Workspace vacío", "Arrastra bloques al workspace para construir tu algoritmo. 🧱");
        return;
    }

    // Caso 2: falta bloque Inicio o Fin
    const ids = [...piezasEnWorkspace].map(p => p.id);
    if (!ids.includes("piezaInicio")) {
        mostrarModal(false, "Falta el Inicio", "Tu algoritmo debe comenzar con el bloque Inicio. 🟢");
        return;
    }
    if (!ids.includes("piezaFin")) {
        mostrarModal(false, "Falta el Fin", "Tu algoritmo debe terminar con el bloque Fin. 🟢");
        return;
    }

    // Caso 3: algoritmo completo (validación básica por ahora)
    mostrarModal(true, "¡Algoritmo enviado!", "Tu algoritmo ha sido enviado al sistema. ¡Bien hecho! 🚀");
}

// Muestra el modal con el resultado
function mostrarModal(exito, titulo, mensaje) {
    document.getElementById("modalIcono").textContent = exito ? "✅" : "❌";
    document.getElementById("modalTitulo").textContent = titulo;
    document.getElementById("modalMensaje").textContent = mensaje;

    // Cambia el color del encabezado según el resultado
    const encabezado = document.getElementById("modalEncabezado");
    encabezado.className = "modal-encabezado " + (exito ? "modal-exito" : "modal-error");

    // Activa la animación: quita oculto y pone visible
    const overlay = document.getElementById("modalOverlay");
    overlay.classList.remove("modal-oculto");
    overlay.classList.add("modal-visible");
}

// Oculta el modal
function cerrarModal() {
    const overlay = document.getElementById("modalOverlay");
    overlay.classList.remove("modal-visible");
    overlay.classList.add("modal-oculto");
}


// "Escuchadores" de eventos para que el mouse funcione sobre las piezas
piezas.forEach(p => p.addEventListener("mousedown", iniciarArrastre)); // mousedown en cada pieza → inicia arrastre
document.addEventListener("mousemove", moverPieza);                    // mousemove en el documento → mueve la pieza
document.addEventListener("mouseup", terminarArrastre);              // mouseup en el documento  → suelta la pieza