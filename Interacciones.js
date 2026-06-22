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
let contadorClones = 0; // Contador para generar IDs únicos para los clones

// Función que se activa al presionar el mouse sobre una pieza
function iniciarArrastre(eDownCursor) {

    // Si el clic fue sobre un input o select (dentro de la pieza), no iniciamos el arrastre
    // para que el usuario pueda interactuar con ellos normalmente
    const tagClic = eDownCursor.target.tagName;
    if (tagClic === "INPUT" || tagClic === "SELECT" || tagClic === "OPTION") return;

    // currentTarget: siempre es la pieza (.pieza) aunque el clic haya sido en un hijo (ej. cuadrito)
    piezaActual = eDownCursor.currentTarget;

    const rectWorkspace = workspace.getBoundingClientRect(); // Posición del workspace en la pantalla

    // Si la pieza todavía está en la bandeja (no en el workspace), creamos un CLON
    if (!workspace.contains(piezaActual)) {
        const clon = piezaActual.cloneNode(true); // true = clona también los hijos (inputs, cuadritos, textos)
        contadorClones++;

        // Evitamos IDs duplicados asignando un nuevo ID único al clon
        clon.id = piezaActual.id + "_clon" + contadorClones;

        // También cambiamos los IDs de cualquier input o select que esté dentro del clon
        const elementosInteractivos = clon.querySelectorAll("input, select");
        elementosInteractivos.forEach(elem => {
            if (elem.id) elem.id = elem.id + "_clon" + contadorClones;
            elem.value = ""; // Reseteamos su valor para que el nuevo bloque empiece en blanco
        });

        // El clon necesita tener también el evento para poder seguir arrastrándose en el futuro
        clon.addEventListener("mousedown", iniciarArrastre);

        workspace.appendChild(clon);       // Metemos el CLON al workspace en el DOM
        clon.style.position = "absolute";  // Lo sacamos del flujo normal para posicionarlo libremente

        // Lo colocamos centrado en el cursor (dentro del workspace)
        clon.style.left = (eDownCursor.clientX - rectWorkspace.left - piezaActual.offsetWidth / 2) + "px";
        clon.style.top = (eDownCursor.clientY - rectWorkspace.top - piezaActual.offsetHeight / 2) + "px";

        // A partir de ahora, la pieza que controlamos es el clon, no la original de la bandeja
        piezaActual = clon;
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
    const rectLayout = document.querySelector(".layout-principal").getBoundingClientRect(); // Posición de toda el área permitida

    /*
        Convertimos la posición del cursor (viewport) a coordenadas del workspace:
        posición en workspace = posición en pantalla - posición del workspace en pantalla - offset inicial
    */
    let newLeft = eMoveCursor.clientX - rectWorkspace.left - offsetX;
    let newTop = eMoveCursor.clientY - rectWorkspace.top - offsetY;

    // Calculamos los límites máximos y mínimos permitidos relativos al workspace
    // Por defecto, minLeft permite llegar hasta la bandeja (valor negativo)
    let minLeft = rectLayout.left - rectWorkspace.left;
    const maxLeft = rectLayout.right - rectWorkspace.left - piezaActual.offsetWidth;
    const minTop = rectLayout.top - rectWorkspace.top;
    const maxTop = rectLayout.bottom - rectWorkspace.top - piezaActual.offsetHeight;

    // MAGIA: Si la pieza ya está dentro del workspace (su borde izquierdo es >= 0),
    // bloqueamos el regreso hacia la izquierda limitando minLeft a 0
    if (piezaActual.offsetLeft >= 0) {
        minLeft = 0;
    }

    // Aplicamos los límites para que la pieza no salga de la zona permitida
    if (newLeft < minLeft) newLeft = minLeft;
    if (newLeft > maxLeft) newLeft = maxLeft;
    if (newTop < minTop) newTop = minTop;
    if (newTop > maxTop) newTop = maxTop;

    piezaActual.style.left = newLeft + "px";
    piezaActual.style.top = newTop + "px";

    verificarBoteBasura(eMoveCursor, false); // Efecto visual si se acerca al bote
    verificarTodosLosAcoples(); // Revisa si la pieza está cerca de otra para pegarse
}

// Suelta la pieza: ya no hay pieza activa
function terminarArrastre(eUpCursor) {
    if (!piezaActual) return; // Si no hay pieza seleccionada, no hace nada

    // Validar si soltamos la pieza cerca del bote de basura para eliminarla
    const fueEliminada = verificarBoteBasura(eUpCursor, true);

    if (!fueEliminada && piezaActual) {
        // Restauramos el tamaño y opacidad por si se quedó "casi" en la basura
        piezaActual.style.transform = "scale(1)";
        piezaActual.style.opacity = "1";
    }

    piezaActual = null; // null indica que ya no se está moviendo ninguna pieza
}

// Revisa la distancia entre el cursor y el bote de basura
function verificarBoteBasura(eCursor, eliminar) {
    const boteBasura = document.getElementById("boteBasura");
    if (!boteBasura || !piezaActual) return false;

    const rectBasura = boteBasura.getBoundingClientRect();
    // Calculamos el centro del bote de basura
    const centroX = rectBasura.left + rectBasura.width / 2;
    const centroY = rectBasura.top + rectBasura.height / 2;

    // Distancia pitagórica entre el cursor y el centro del bote
    const distX = eCursor.clientX - centroX;
    const distY = eCursor.clientY - centroY;
    const distancia = Math.sqrt(distX * distX + distY * distY);

    const RADIO_ATRACCION = 200; // Distancia para empezar a encoger la pieza

    if (eliminar) {
        // Solo eliminar si el cursor está estrictamente dentro del área del bote (140x140px)
        if (eCursor.clientX >= rectBasura.left && eCursor.clientX <= rectBasura.right &&
            eCursor.clientY >= rectBasura.top && eCursor.clientY <= rectBasura.bottom) {
            piezaActual.remove(); // Se soltó dentro del bote exacto
            return true;
        }
        return false; // Se soltó cerca pero no dentro del bote
    } else {
        // Efecto visual mientras se mueve la pieza
        if (distancia < RADIO_ATRACCION) {
            // Mientras se arrastra: reducir tamaño y opacidad según qué tan cerca esté
            let escala = distancia / RADIO_ATRACCION;
            if (escala < 0.25) escala = 0.25; // Límite para que no desaparezca de golpe
            
            piezaActual.style.transform = `scale(${escala})`;
            piezaActual.style.opacity = escala + 0.1;
        } else {
            // Fuera de rango: regresar a la normalidad
            piezaActual.style.transform = "scale(1)";
            piezaActual.style.opacity = "1";
        }
        return false;
    }
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
            Math.abs(piezaMoviendose.left - piezaEstatica.left) < UMBRAL) {
            // piezaActual queda arriba, pieza estática queda abajo
            if (!tienePiezaAbajo(piezaActual, piezasEnWorkspace)) {
                acoplar(piezaActual, pieza);
            }
        }

        // Caso 2: la pieza que se mueve llega POR ABAJO de la estática
        // → borde superior de la que se mueve ≈ borde inferior de la estática
        if (Math.abs(piezaEstatica.bottom - piezaMoviendose.top) < UMBRAL &&
            Math.abs(piezaEstatica.left - piezaMoviendose.left) < UMBRAL) {
            // pieza estática queda arriba, piezaActual queda abajo
            if (!tienePiezaAbajo(pieza, piezasEnWorkspace)) {
                acoplar(pieza, piezaActual);
            }
        }
    });
}

// "Pega" piezaDeabajo exactamente debajo de piezaDearriba
function acoplar(piezaDearriba, piezaDeabajo) {
    // Ambas usan offsetLeft/offsetTop porque las dos están en el mismo padre (workspace)
    piezaDeabajo.style.left = piezaDearriba.offsetLeft + "px";
    piezaDeabajo.style.top = (piezaDearriba.offsetTop + piezaDearriba.offsetHeight) + "px";
}

// Verifica si ya hay alguna pieza conectada justo debajo de la pieza indicada
function tienePiezaAbajo(piezaArriba, piezasEnWorkspace) {
    const topEsperado = piezaArriba.offsetTop + piezaArriba.offsetHeight;
    const leftEsperado = piezaArriba.offsetLeft;

    for (let p of piezasEnWorkspace) {
        if (p === piezaArriba || p === piezaActual) continue;

        // Si hay una pieza en esa posición exacta (con margen de 2px por redondeo de navegador)
        if (Math.abs(p.offsetTop - topEsperado) <= 2 && Math.abs(p.offsetLeft - leftEsperado) <= 2) {
            return true;
        }
    }
    return false;
}

function verificarEstado() {
    const piezasEnWorkspace = workspace.querySelectorAll(".pieza");

    // Caso 1: workspace vacío
    if (piezasEnWorkspace.length === 0) {
        mostrarModal(false, "Workspace vacío", "Arrastra bloques al workspace para construir tu algoritmo. 🧱");
        return;
    }

    // Caso 2: falta bloque Inicio o Fin
    // Como los clones tienen IDs como "piezaInicio_clon1", verificamos si algún ID empieza con el nombre base
    const ids = [...piezasEnWorkspace].map(p => p.id);
    const tieneInicio = ids.some(id => id.startsWith("piezaInicio"));
    const tieneFin = ids.some(id => id.startsWith("piezaFin"));

    if (!tieneInicio) {
        mostrarModal(false, "Falta el Inicio", "Tu algoritmo debe comenzar con el bloque Inicio. 🟢");
        return;
    }
    if (!tieneFin) {
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