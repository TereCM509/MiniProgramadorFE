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
let repetirEstirado = null; // Repetir que actualmente está estirado durante un arrastre (se revierte al alejarse)
let ultimaPosicionCursor = { clientX: 0, clientY: 0 }; // Última posición conocida del cursor (para soltar la pieza si la ventana pierde el foco)

// Medidas fijas de la pieza Repetir (forma C)
const ALTO_BARRA_SUPERIOR = 70;  // Altura de la barra superior de la C
const ALTO_BARRA_INFERIOR = 40;  // Altura de la barra inferior de la C
const ANCHO_MURO = 40;           // Ancho del muro izquierdo de la C
const RADIO_ESTIRAMIENTO = 220;  // Distancia (px) desde la que la C empieza a estirarse al acercar una pieza

// ===================================================================
// PIEZA REPETIR: Generación dinámica del SVG (forma C)
// ===================================================================

/**
 * La forma C se dibuja con 3 capas de background (ver Estilos.css .piezaRepetir):
 *   1. Tapa superior (SVG fijo de 78px): barra superior + esquina interna cóncava
 *   2. Tapa inferior (SVG fijo de 48px): esquina interna cóncava + barra inferior
 *   3. Muro izquierdo: franja estirable en medio (linear-gradient de color liso)
 *
 * Así la transición CSS de altura estira únicamente el muro (un rectángulo
 * liso que no se deforma) y las tapas conservan siempre su grosor exacto.
 * Las tapas solo dependen del ANCHO, nunca de la altura.
 *
 * ┌──────────────────────────────────┐  ← Tapa superior (70px + 8px de esquina)
 * │  Repetir 🔁  [input]            │
 * │  ┌───────────────────────────────┘
 * │  │
 * │  │  (muro estirable: zona para piezas hijas)
 * │  │
 * │  └───────────────────────────────┐
 * │                                  │  ← Tapa inferior (8px de esquina + 40px)
 * └──────────────────────────────────┘
 */
function generarTapaSuperiorRepetir(anchoTotal) {
    const W = anchoTotal;
    const R = 8; // Radio de esquinas
    const H = ALTO_BARRA_SUPERIOR + R; // 78px: barra + esquina interna cóncava
    const path = `M ${R},0 L ${W - R},0 Q ${W},0 ${W},${R} ` +
        `L ${W},${ALTO_BARRA_SUPERIOR - R} Q ${W},${ALTO_BARRA_SUPERIOR} ${W - R},${ALTO_BARRA_SUPERIOR} ` +
        `L ${ANCHO_MURO + R},${ALTO_BARRA_SUPERIOR} Q ${ANCHO_MURO},${ALTO_BARRA_SUPERIOR} ${ANCHO_MURO},${ALTO_BARRA_SUPERIOR + R} ` +
        `L ${ANCHO_MURO},${H} L 0,${H} L 0,${R} Q 0,0 ${R},0 Z`;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">` +
        `<defs><clipPath id="c"><path d="${path}"/></clipPath></defs>` +
        `<path d="${path}" fill="#9C27B0"/>` +
        `<g clip-path="url(#c)"><rect x="0" y="0" width="${W}" height="2" fill="white" opacity="0.3"/></g></svg>`;

    return `url("data:image/svg+xml;base64,${btoa(svg)}")`;
}

function generarTapaInferiorRepetir(anchoTotal) {
    const W = anchoTotal;
    const R = 8; // Radio de esquinas
    const H = ALTO_BARRA_INFERIOR + R; // 48px: esquina interna cóncava + barra
    const path = `M 0,0 L ${ANCHO_MURO},0 Q ${ANCHO_MURO},${R} ${ANCHO_MURO + R},${R} ` +
        `L ${W - R},${R} Q ${W},${R} ${W},${2 * R} ` +
        `L ${W},${H - R} Q ${W},${H} ${W - R},${H} ` +
        `L ${R},${H} Q 0,${H} 0,${H - R} Z`;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">` +
        `<defs><clipPath id="c"><path d="${path}"/></clipPath></defs>` +
        `<path d="${path}" fill="#9C27B0"/>` +
        `<g clip-path="url(#c)"><rect x="0" y="${H - 4}" width="${W}" height="4" fill="black" opacity="0.2"/></g></svg>`;

    return `url("data:image/svg+xml;base64,${btoa(svg)}")`;
}

// Posición vertical OBJETIVO de una pieza (el valor final aunque haya una transición CSS en curso)
function topObjetivo(pieza) {
    return pieza.style.top ? parseFloat(pieza.style.top) : pieza.offsetTop;
}

// Altura OBJETIVO de una pieza (para el Repetir puede haber una transición de altura en curso)
function altoObjetivo(pieza) {
    return pieza._alturaAplicada || pieza.offsetHeight;
}

/**
 * Recalcula el tamaño NATURAL de una pieza Repetir según las piezas dentro
 * de su .repetir-body y lo aplica (con transición CSS suave).
 */
function actualizarFormaRepetir(repetirElem) {
    const body = repetirElem.querySelector('.repetir-body');
    if (!body) return;

    const piezasInternas = body.querySelectorAll(':scope > .pieza');

    // Altura del gap: mínimo 70px, o la suma de las alturas reales de las piezas internas
    let sumaAlturas = 0;
    let maxAncho = 0;
    piezasInternas.forEach(p => {
        sumaAlturas += p.offsetHeight;
        maxAncho = Math.max(maxAncho, p.offsetWidth);
    });
    const gapHeight = Math.max(70, sumaAlturas);
    const totalHeight = ALTO_BARRA_SUPERIOR + gapHeight + ALTO_BARRA_INFERIOR;

    // Ancho dinámico: mínimo 240px, o el hijo más ancho + muro izquierdo
    const totalWidth = Math.max(240, maxAncho + ANCHO_MURO);

    // Guardar el tamaño natural (sin estiramiento) para los cálculos de zona y estiramiento
    repetirElem._alturaNatural = totalHeight;
    repetirElem._anchoNatural = totalWidth;

    aplicarTamanoRepetir(repetirElem, totalHeight, totalWidth, true);
}

/**
 * Aplica un tamaño concreto al Repetir (natural o estirado).
 * animar=true usa la transición CSS; animar=false sigue a la mano en vivo.
 * Las piezas acopladas debajo se desplazan la misma distancia que cambia la altura.
 */
function aplicarTamanoRepetir(repetirElem, altura, ancho, animar) {
    const body = repetirElem.querySelector('.repetir-body');
    const alturaAnterior = repetirElem._alturaAplicada || repetirElem.offsetHeight;

    repetirElem.classList.toggle('repetir-sin-transicion', !animar);
    repetirElem.style.height = altura + 'px';
    repetirElem.style.width = ancho + 'px';
    if (body) body.style.width = (ancho - ANCHO_MURO) + 'px';
    repetirElem._alturaAplicada = altura;

    // Regenerar las tapas solo si cambió el ancho (la altura la absorbe el muro estirable)
    if (repetirElem._anchoSVG !== ancho) {
        repetirElem._anchoSVG = ancho;
        repetirElem.style.backgroundImage =
            generarTapaSuperiorRepetir(ancho) + ', ' +
            generarTapaInferiorRepetir(ancho) + ', ' +
            'linear-gradient(#9C27B0, #9C27B0)'; // Muro izquierdo (color liso estirable)
    }

    // Las piezas acopladas debajo siguen al borde inferior del Repetir
    const delta = altura - alturaAnterior;
    if (delta !== 0 && workspace.contains(repetirElem)) {
        moverCadenaDebajo(repetirElem, alturaAnterior, delta, animar);
    }
}

// Desplaza verticalmente una pieza, con o sin transición suave
function desplazarPieza(pieza, delta, animar) {
    const topActual = topObjetivo(pieza);
    if (animar) {
        pieza.style.transition = 'top 0.3s ease';
        setTimeout(() => { pieza.style.transition = ''; }, 320);
    }
    pieza.style.top = (topActual + delta) + 'px';
}

/**
 * Busca la pieza acoplada exactamente debajo del borde inferior anterior del
 * Repetir y desplaza toda su cadena (pieza + las acopladas debajo de ella).
 */
function moverCadenaDebajo(repetirElem, alturaAnterior, delta, animar) {
    const piezasWorkspace = workspace.querySelectorAll(':scope > .pieza');
    let topEsperado = repetirElem.offsetTop + alturaAnterior;
    let leftEsperado = repetirElem.offsetLeft;
    let anterior = repetirElem;

    // Recorre la cadena de acoples hacia abajo, desplazando cada eslabón
    let cabeza = buscarPiezaEnPosicion(leftEsperado, topEsperado, piezasWorkspace, anterior);
    while (cabeza) {
        const siguienteTop = topObjetivo(cabeza) + altoObjetivo(cabeza);
        const siguienteLeft = cabeza.offsetLeft;
        desplazarPieza(cabeza, delta, animar);
        anterior = cabeza;
        cabeza = buscarPiezaEnPosicion(siguienteLeft, siguienteTop, piezasWorkspace, anterior);
    }
}

// Busca una pieza del workspace cuyo objetivo esté en la posición dada (tolerancia 2px)
// Ignora piezas "moribundas" (.pieza-eliminandose): siguen ~200ms en el DOM
// mientras el bote se las traga y nadie debe acoplarse a ellas
function buscarPiezaEnPosicion(left, top, piezasWorkspace, excluir) {
    for (let p of piezasWorkspace) {
        if (p === excluir || p === piezaActual) continue;
        if (p.classList.contains('pieza-eliminandose')) continue;
        if (Math.abs(topObjetivo(p) - top) <= 2 && Math.abs(p.offsetLeft - left) <= 2) {
            return p;
        }
    }
    return null;
}

/**
 * Intenta soltar una pieza dentro del gap de alguna pieza Repetir en el workspace.
 *
 * Criterio único: el centro de la pieza debe estar sobre la zona del gap
 * (el mismo criterio que enciende el glow durante el arrastre). La posición
 * dentro del cuerpo se decide comparando el centro con cada pieza interna,
 * así la pieza puede insertarse arriba, entre o debajo de las existentes.
 *
 * Retorna true si la pieza fue acoplada dentro de un Repetir, false si no.
 */
function intentarSoltarEnRepetir(pieza) {
    // No permitir meter un Repetir dentro de otro Repetir
    if (pieza.classList.contains('piezaRepetir')) return false;

    // ÚNICO CRITERIO: el centro de la pieza debe estar sobre el gap del Repetir.
    // Es el mismo criterio que enciende el glow durante el arrastre, así el
    // resaltado siempre promete exactamente lo que el drop hará. Una pieza
    // acoplada DEBAJO del Repetir tiene su centro fuera del gap y nunca se
    // absorbe (ese era el bug del acople debajo con piezas dentro).
    const repetirPiezas = workspace.querySelectorAll('.piezaRepetir');

    for (let repetir of repetirPiezas) {
        if (repetir.classList.contains('pieza-eliminandose')) continue; // Un Repetir moribundo no acepta piezas
        const body = repetir.querySelector('.repetir-body');
        if (!body) continue;

        // Usamos el rect del REPETIR completo para calcular la zona del gap
        const rectRepetir = repetir.getBoundingClientRect();
        const rectPieza = pieza.getBoundingClientRect();

        // Centro de la pieza que se está soltando
        const piezaCenterX = rectPieza.left + rectPieza.width / 2;
        const piezaCenterY = rectPieza.top + rectPieza.height / 2;

        // Zona del gap: desde después del muro izquierdo hasta el borde derecho,
        // desde debajo del top bar hasta encima del bottom bar.
        // Margen interno de 5px para usabilidad sin absorber piezas del exterior
        const gapTop = rectRepetir.top + ALTO_BARRA_SUPERIOR;
        const gapBottom = rectRepetir.bottom - ALTO_BARRA_INFERIOR;
        const gapLeft = rectRepetir.left + ANCHO_MURO; // Después del muro izquierdo
        const gapRight = rectRepetir.right;

        if (piezaCenterX >= gapLeft && piezaCenterX <= gapRight &&
            piezaCenterY >= gapTop + 5 && piezaCenterY <= gapBottom - 5) {

            // Mover la pieza del workspace al body del Repetir
            // La pieza conserva su ancho natural (no se encoge)
            pieza.style.position = 'relative';
            pieza.style.left = 'auto';
            pieza.style.top = 'auto';
            pieza.style.transform = 'none';

            // Insertar ENTRE las piezas existentes según la altura donde se soltó:
            // va antes del primer hijo cuyo centro quede por debajo del suyo
            let insertado = false;
            for (let hijo of body.querySelectorAll(':scope > .pieza')) {
                const rectHijo = hijo.getBoundingClientRect();
                if (piezaCenterY <= rectHijo.top + rectHijo.height / 2) {
                    body.insertBefore(pieza, hijo);
                    insertado = true;
                    break;
                }
            }
            if (!insertado) body.appendChild(pieza);

            // Recalcular la forma del Repetir
            actualizarFormaRepetir(repetir);

            // Microanimación: destello morado de 250ms — la C confirma que
            // "se comió" la pieza (el squash no se ve dentro del body)
            repetir.classList.add('repetir-pulso');
            setTimeout(() => repetir.classList.remove('repetir-pulso'), 250);
            return true;
        }
    }

    return false;
}

// ===================================================================
// DRAG AND DROP: Funciones principales
// ===================================================================

// Intenta que la pieza capture el puntero. Si el navegador lo rechaza
// (p. ej. eventos sintéticos de prueba, cuyo pointerId no corresponde a un
// puntero activo), el arrastre sigue funcionando igual: solo se pierde la
// garantía de recibir el pointerup fuera de la ventana
function capturarPuntero(pieza, eCursor) {
    if (typeof pieza.setPointerCapture !== "function") return;
    try {
        pieza.setPointerCapture(eCursor.pointerId);
    } catch (errorCaptura) {
        // Sin captura no hay nada más que hacer: los listeners del documento siguen activos
    }
}

// Función que se activa al presionar el mouse sobre una pieza
function iniciarArrastre(eDownCursor) {

    // Si el clic fue sobre un input o select (dentro de la pieza), no iniciamos el arrastre
    // para que el usuario pueda interactuar con ellos normalmente
    const tagClic = eDownCursor.target.tagName;
    if (tagClic === "INPUT" || tagClic === "SELECT" || tagClic === "OPTION") return;

    // Evitar que el evento suba al padre (importante para piezas dentro de un Repetir,
    // para que al arrastrar una pieza hija no se arrastre también el Repetir padre)
    eDownCursor.stopPropagation();

    // currentTarget: siempre es la pieza (.pieza) aunque el clic haya sido en un hijo (ej. cuadrito)
    piezaActual = eDownCursor.currentTarget;

    // POINTER CAPTURE: la pieza captura el puntero para que el pointerup llegue
    // aunque el botón se suelte FUERA de la ventana del navegador (sin esto el
    // evento se perdía y la pieza quedaba pegada al cursor al regresar)
    capturarPuntero(piezaActual, eDownCursor);
    ultimaPosicionCursor = { clientX: eDownCursor.clientX, clientY: eDownCursor.clientY };

    // CASO ESPECIAL: pieza dentro de un .repetir-body → la extracción se POSPONE
    // hasta que haya un arrastre real (>4px). Así un simple click no saca la
    // pieza del Repetir ni la reordena.
    if (piezaActual.closest('.repetir-body')) {
        piezaActual._extraccionPendiente = { clientX: eDownCursor.clientX, clientY: eDownCursor.clientY };
        return;
    }

    // CASO ESPECIAL: pieza en la bandeja → la clonación también se pospone
    // hasta que haya un arrastre real. Un click solo ya no deja clones fantasma.
    if (!workspace.contains(piezaActual)) {
        piezaActual._clonPendiente = { clientX: eDownCursor.clientX, clientY: eDownCursor.clientY };
        return;
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
    const rectWorkspace = workspace.getBoundingClientRect(); // Posición del workspace en la pantalla
    offsetX = eDownCursor.clientX - rectWorkspace.left - piezaActual.offsetLeft;
    offsetY = eDownCursor.clientY - rectWorkspace.top - piezaActual.offsetTop;

    // Microanimación: la pieza "despega" de la mesa (ver paquete en Estilos.css)
    piezaActual.classList.add('pieza-en-vuelo');
}

// Extrae una pieza del body de un Repetir al workspace (se llama al confirmar el arrastre)
function extraerDeRepetir(pieza, eCursor) {
    const body = pieza.closest('.repetir-body');
    delete pieza._extraccionPendiente;
    if (!body) return;

    const repetirElem = body.closest('.piezaRepetir');
    const rectWorkspace = workspace.getBoundingClientRect();

    // Calcular la posición absoluta de la pieza relativa al workspace
    const rectPieza = pieza.getBoundingClientRect();
    const absLeft = rectPieza.left - rectWorkspace.left;
    const absTop = rectPieza.top - rectWorkspace.top;

    // Mover la pieza del body del Repetir al workspace.
    // Al cambiarla de contenedor el navegador libera su pointer capture:
    // lo retomamos para no perder el pointerup si se suelta fuera de la ventana
    workspace.appendChild(pieza);
    capturarPuntero(pieza, eCursor);
    pieza.style.position = 'absolute';
    pieza.style.left = absLeft + 'px';
    pieza.style.top = absTop + 'px';

    // Recalcular el offset cursor-pieza en coordenadas del workspace
    offsetX = eCursor.clientX - rectWorkspace.left - absLeft;
    offsetY = eCursor.clientY - rectWorkspace.top - absTop;

    // Microanimación: la pieza extraída "despega" (ver paquete en Estilos.css)
    pieza.classList.add('pieza-en-vuelo');

    // Recalcular la forma del Repetir (ahora tiene una pieza menos)
    actualizarFormaRepetir(repetirElem);
}

// Crea el clon de una pieza de la bandeja (se llama al confirmar el arrastre)
function crearClonDesdeBandeja(pieza, eCursor) {
    delete pieza._clonPendiente;

    const clon = pieza.cloneNode(true); // true = clona también los hijos (inputs, cuadritos, textos)
    contadorClones++;

    // Evitamos IDs duplicados asignando un nuevo ID único al clon
    clon.id = pieza.id + "_clon" + contadorClones;

    // También cambiamos los IDs de cualquier input o select que esté dentro del clon
    const elementosInteractivos = clon.querySelectorAll("input, select");
    elementosInteractivos.forEach(elem => {
        if (elem.id) elem.id = elem.id + "_clon" + contadorClones;
        elem.value = ""; // Reseteamos su valor para que el nuevo bloque empiece en blanco
    });

    // El clon necesita tener también el evento para poder seguir arrastrándose en el futuro
    clon.addEventListener("pointerdown", iniciarArrastre);

    workspace.appendChild(clon);       // Metemos el CLON al workspace en el DOM
    clon.style.position = "absolute";  // Lo sacamos del flujo normal para posicionarlo libremente

    // Si es un Repetir, inicializar su forma (tapas SVG y tamaño natural)
    if (clon.classList.contains('piezaRepetir')) {
        actualizarFormaRepetir(clon);
    }

    // Lo colocamos centrado en el cursor (dentro del workspace)
    const rectWorkspace = workspace.getBoundingClientRect();
    clon.style.left = (eCursor.clientX - rectWorkspace.left - pieza.offsetWidth / 2) + "px";
    clon.style.top = (eCursor.clientY - rectWorkspace.top - pieza.offsetHeight / 2) + "px";

    // El offset cursor-pieza queda en el centro del clon
    offsetX = pieza.offsetWidth / 2;
    offsetY = pieza.offsetHeight / 2;

    // Microanimación de brote: el clon nace un poco más pequeño y crece hasta
    // su tamaño de vuelo. Patrón estado-inicial + reflow forzado: el navegador
    // pinta el estado .pieza-brotando ANTES de transicionar al quitarlo
    clon.classList.add('pieza-brotando');
    void clon.offsetWidth; // Reflow: fija el estado inicial sin animar
    clon.classList.remove('pieza-brotando');
    clon.classList.add('pieza-en-vuelo');

    // A partir de ahora, la pieza que controlamos es el clon, no la original de la bandeja.
    // El clon toma también el pointer capture (lo tenía la pieza original de la bandeja)
    piezaActual = clon;
    capturarPuntero(clon, eCursor);
}

// Función que mueve la pieza siguiendo al cursor
function moverPieza(eMoveCursor) {
    if (!piezaActual) return; // Si no hay pieza seleccionada, no hace nada

    // Recordar la posición del cursor por si la ventana pierde el foco a mitad
    // del arrastre (el listener de blur suelta la pieza en esta posición)
    ultimaPosicionCursor = { clientX: eMoveCursor.clientX, clientY: eMoveCursor.clientY };

    // Si hay una extracción o clonación pendiente, esperar a que el movimiento
    // supere 4px (umbral que distingue un click de un arrastre real)
    const pendiente = piezaActual._extraccionPendiente || piezaActual._clonPendiente;
    if (pendiente) {
        const movimiento = Math.abs(eMoveCursor.clientX - pendiente.clientX) +
                           Math.abs(eMoveCursor.clientY - pendiente.clientY);
        if (movimiento <= 4) return; // Todavía cuenta como click, no como arrastre

        if (piezaActual._extraccionPendiente) {
            extraerDeRepetir(piezaActual, eMoveCursor);
        } else {
            crearClonDesdeBandeja(piezaActual, eMoveCursor);
        }
    }

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
    estirarRepetirCercano(); // Estira la C proporcionalmente cuando la pieza se acerca a su hueco
}

// Suelta la pieza: ya no hay pieza activa
function terminarArrastre(eUpCursor) {
    if (!piezaActual) return; // Si no hay pieza seleccionada, no hace nada

    // Si la extracción/clonación seguía pendiente, fue solo un click: no pasa nada
    if (piezaActual._extraccionPendiente || piezaActual._clonPendiente) {
        delete piezaActual._extraccionPendiente;
        delete piezaActual._clonPendiente;
        piezaActual = null;
        return;
    }

    // Validar si soltamos la pieza cerca del bote de basura para eliminarla
    const fueEliminada = verificarBoteBasura(eUpCursor, true);

    if (!fueEliminada && piezaActual) {
        // Aterrizaje: limpiar el canal inline por si se quedó "casi" en la
        // basura, y quitar el estado de vuelo (la transición de scale con
        // rebote hace el asentamiento visual de la pieza al soltarla)
        piezaActual.style.transform = "";
        piezaActual.style.opacity = "";
        const piezaSoltada = piezaActual; // Referencia para los pulsos (piezaActual se anula abajo)
        piezaSoltada.classList.remove('pieza-en-vuelo');

        // Intentar soltar la pieza dentro de un Repetir (si no es un Repetir)
        const entroEnRepetir = intentarSoltarEnRepetir(piezaSoltada);

        // Microanimación: pulso de confirmación SOLO si quedó realmente
        // acoplada (dentro del Repetir o pegada a otra pieza de una pila)
        if (entroEnRepetir) {
            pulsoAcople(piezaSoltada);
        } else {
            const piezasWs = workspace.querySelectorAll(':scope > .pieza');
            if (tienePiezaAbajo(piezaSoltada, piezasWs) || tienePiezaArriba(piezaSoltada, piezasWs)) {
                pulsoAcople(piezaSoltada);
            }
        }
    }

    // El bote deja de reaccionar (cubre pointerup, pointercancel y blur)
    const boteBasura = document.getElementById('boteBasura');
    if (boteBasura) boteBasura.classList.remove('bote-atento', 'bote-devorador');

    piezaActual = null; // null indica que ya no se está moviendo ninguna pieza

    // Quitar el glow y revertir el estiramiento si quedó algún Repetir estirado.
    // Se hace DESPUÉS de soltar la referencia de piezaActual: así, si la pieza
    // quedó acoplada al borde estirado, también sigue al borde cuando se encoge
    // (moverCadenaDebajo excluye a piezaActual y la habría dejado flotando).
    revertirEstiramiento();
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

    // Zona de borrado por CENTRO ± mitad del bote (medidas de layout, inmunes
    // al scale de las clases bote-atento/devorador: el hitbox no crece aunque
    // el bote se vea más grande). Equivale al rect de 140x140 sin escalar
    const dentroDelBote =
        Math.abs(eCursor.clientX - centroX) <= boteBasura.offsetWidth / 2 &&
        Math.abs(eCursor.clientY - centroY) <= boteBasura.offsetHeight / 2;

    if (eliminar) {
        // El bote deja de reaccionar en cualquier final de arrastre
        boteBasura.classList.remove('bote-atento', 'bote-devorador');

        if (dentroDelBote) {
            // Microanimación: el bote se traga la pieza. El remove() se difiere
            // 200ms para que se vea la implosión; la clase pieza-eliminandose
            // tiene guardas en los imanes (nadie se acopla a una pieza moribunda)
            const piezaTragada = piezaActual; // piezaActual se anula justo después
            piezaTragada.classList.remove('pieza-en-vuelo');
            piezaTragada.classList.add('pieza-eliminandose');
            piezaTragada.style.transform = 'scale(0.05) rotate(25deg)';
            piezaTragada.style.opacity = '0';

            // "Glup" del bote
            boteBasura.classList.add('bote-tragando');
            setTimeout(() => boteBasura.classList.remove('bote-tragando'), 150);

            // setTimeout determinista (transitionend dispara una vez POR propiedad
            // y puede no disparar con la pestaña oculta)
            setTimeout(() => piezaTragada.remove(), 200);
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
            // Fuera de rango: limpiar el canal inline (la escala de vuelo la
            // pone la clase pieza-en-vuelo vía la propiedad independiente scale)
            piezaActual.style.transform = "";
            piezaActual.style.opacity = "";
        }

        // El bote avisa con el MISMO criterio que el borrado real:
        // atento = pieza cerca · devorador = soltar aquí SÍ borra
        boteBasura.classList.toggle('bote-atento', distancia < RADIO_ATRACCION && !dentroDelBote);
        boteBasura.classList.toggle('bote-devorador', dentroDelBote);
        return false;
    }
}

// ESTIRAMIENTO PROPORCIONAL: mientras la pieza arrastrada se acerca al hueco
// de un Repetir, la C se va alargando poco a poco. El movimiento de la mano
// controla la apertura (no hay animación por tiempo: la pieza ES la animación).
function estirarRepetirCercano() {
    // Sin pieza seleccionada, o arrastrando un Repetir: revertir y salir
    if (!piezaActual || piezaActual.classList.contains('piezaRepetir')) {
        revertirEstiramiento();
        return;
    }

    const rectPieza = piezaActual.getBoundingClientRect();
    const centroX = rectPieza.left + rectPieza.width / 2;
    const centroY = rectPieza.top + rectPieza.height / 2;

    // Buscar el Repetir con mayor factor de cercanía (0 = lejos, 1 = sobre el gap)
    let mejorRepetir = null;
    let mejorFactor = 0;

    workspace.querySelectorAll('.piezaRepetir').forEach(repetir => {
        if (repetir.classList.contains('pieza-eliminandose')) return; // Un Repetir moribundo no se estira
        // Zona del gap calculada con el tamaño NATURAL (sin estiramiento),
        // para que la zona no crezca sola mientras la C se estira
        const rect = repetir.getBoundingClientRect();
        const alturaNatural = repetir._alturaNatural || rect.height;
        const anchoNatural = repetir._anchoNatural || rect.width;
        const gapIzquierda = rect.left + ANCHO_MURO;
        const gapDerecha = rect.left + anchoNatural;
        const gapArriba = rect.top + ALTO_BARRA_SUPERIOR;
        const gapAbajo = rect.top + alturaNatural - ALTO_BARRA_INFERIOR;

        // Distancia del centro de la pieza al punto más cercano del gap
        const distX = Math.max(gapIzquierda - centroX, 0, centroX - gapDerecha);
        const distY = Math.max(gapArriba - centroY, 0, centroY - gapAbajo);
        const distancia = Math.sqrt(distX * distX + distY * distY);
        const factor = 1 - Math.min(distancia / RADIO_ESTIRAMIENTO, 1);

        if (factor > mejorFactor) {
            mejorFactor = factor;
            mejorRepetir = repetir;
        }
    });

    // Revertir el Repetir que estaba estirado si ya no es el elegido
    if (repetirEstirado && repetirEstirado !== mejorRepetir) {
        revertirEstiramiento();
    }

    if (!mejorRepetir || mejorFactor === 0) {
        revertirEstiramiento();
        return;
    }

    // Tamaño estirado = tamaño natural + proporción del hueco que necesita la pieza
    const alturaNatural = mejorRepetir._alturaNatural || 190;
    const anchoNatural = mejorRepetir._anchoNatural || 240;
    const alturaExtra = Math.round(mejorFactor * piezaActual.offsetHeight);
    const anchoObjetivo = Math.max(anchoNatural, piezaActual.offsetWidth + ANCHO_MURO);
    const anchoExtra = Math.round(mejorFactor * (anchoObjetivo - anchoNatural));

    aplicarTamanoRepetir(mejorRepetir, alturaNatural + alturaExtra, anchoNatural + anchoExtra, false);

    // Glow morado EXACTAMENTE cuando soltar insertaría: centro de la pieza sobre
    // la zona del gap ya estirada (mismo criterio y márgenes que intentarSoltarEnRepetir)
    const rectMejor = mejorRepetir.getBoundingClientRect();
    const sobreGap =
        centroX >= rectMejor.left + ANCHO_MURO && centroX <= rectMejor.right &&
        centroY >= rectMejor.top + ALTO_BARRA_SUPERIOR + 5 &&
        centroY <= rectMejor.bottom - ALTO_BARRA_INFERIOR - 5;
    mejorRepetir.classList.toggle('repetir-highlight', sobreGap);
    repetirEstirado = mejorRepetir;
}

// Regresa el Repetir estirado a su tamaño natural (con transición suave) y quita el glow
function revertirEstiramiento() {
    if (!repetirEstirado) return;
    repetirEstirado.classList.remove('repetir-highlight');
    aplicarTamanoRepetir(
        repetirEstirado,
        repetirEstirado._alturaNatural || 190,
        repetirEstirado._anchoNatural || 240,
        true
    );
    repetirEstirado = null;
}

// Revisa la cercanía entre la pieza que se mueve y todas las demás en el workspace
function verificarTodosLosAcoples() {
    // Solo comparamos piezas que ya están en el workspace (no las de la bandeja)
    const piezasEnWorkspace = workspace.querySelectorAll(":scope > .pieza");

    piezasEnWorkspace.forEach(pieza => {
        if (pieza === piezaActual) return; // No se compara consigo misma
        if (pieza.classList.contains('pieza-eliminandose')) return; // Nadie se imanta a una pieza moribunda

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
        // La pieza EN EL AIRE se imanta encima de la estática (la estática nunca
        // se mueve: antes se teletransportaba y rompía las pilas ya armadas)
        if (Math.abs(piezaMoviendose.bottom - piezaEstatica.top) < UMBRAL &&
            Math.abs(piezaMoviendose.left - piezaEstatica.left) < UMBRAL) {
            const topArriba = topObjetivo(pieza) - altoObjetivo(piezaActual);
            if (!buscarPiezaEnPosicion(pieza.offsetLeft, topArriba, piezasEnWorkspace, pieza)) {
                piezaActual.style.left = pieza.offsetLeft + "px";
                piezaActual.style.top = topArriba + "px";
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

    // Nota: la inserción DENTRO de un Repetir no usa imán de cercanía con las
    // piezas internas. La decide únicamente intentarSoltarEnRepetir() con el
    // criterio "centro de la pieza sobre el gap" (el mismo que enciende el glow).
    // Un imán por cercanía aquí capturaba piezas acopladas debajo del Repetir
    // (quedan a solo 40px del último hijo) y piezas que pasaban de largo.
}

// "Pega" piezaDeabajo exactamente debajo de piezaDearriba
// Usa la posición/altura OBJETIVO por si piezaDearriba está en plena transición CSS
function acoplar(piezaDearriba, piezaDeabajo) {
    // Ambas usan coordenadas del mismo padre (workspace)
    piezaDeabajo.style.left = piezaDearriba.offsetLeft + "px";
    piezaDeabajo.style.top = (topObjetivo(piezaDearriba) + altoObjetivo(piezaDearriba)) + "px";
}

// Verifica si ya hay alguna pieza conectada justo debajo de la pieza indicada
function tienePiezaAbajo(piezaArriba, piezasEnWorkspace) {
    const topEsperado = topObjetivo(piezaArriba) + altoObjetivo(piezaArriba);
    const leftEsperado = piezaArriba.offsetLeft;
    return buscarPiezaEnPosicion(leftEsperado, topEsperado, piezasEnWorkspace, piezaArriba) !== null;
}

// Verifica si hay una pieza acoplada exactamente ENCIMA (espejo de tienePiezaAbajo)
function tienePiezaArriba(pieza, piezasEnWorkspace) {
    for (let p of piezasEnWorkspace) {
        if (p === pieza || p.classList.contains('pieza-eliminandose')) continue;
        if (Math.abs(topObjetivo(p) + altoObjetivo(p) - topObjetivo(pieza)) <= 2 &&
            Math.abs(p.offsetLeft - pieza.offsetLeft) <= 2) {
            return true;
        }
    }
    return false;
}

// Microanimación: pulso breve de confirmación de acople (la clase sube la
// escala a 1.07 y al quitarla la transición con rebote la regresa a 1).
// scale es propiedad independiente: funciona incluso dentro del repetir-body
function pulsoAcople(pieza) {
    pieza.classList.add('pieza-pulso');
    setTimeout(() => pieza.classList.remove('pieza-pulso'), 160);
}

function verificarEstado() {
    // Ignorar piezas que el bote está tragándose (siguen ~200ms en el DOM):
    // un clon de Inicio "moribundo" no debe hacer pasar la validación
    const piezasEnWorkspace = [...workspace.querySelectorAll(".pieza")]
        .filter(p => !p.classList.contains('pieza-eliminandose'));

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

// ===================================================================
// INICIALIZACIÓN
// ===================================================================

// Inicializar todas las piezas Repetir (generar su SVG por primera vez)
document.querySelectorAll('.piezaRepetir').forEach(actualizarFormaRepetir);

// "Escuchadores" de eventos para que el mouse funcione sobre las piezas.
// Se usan eventos POINTER (no mouse) porque permiten setPointerCapture:
// así el pointerup llega aunque el botón se suelte fuera de la ventana
piezas.forEach(p => p.addEventListener("pointerdown", iniciarArrastre)); // pointerdown en cada pieza → inicia arrastre
document.addEventListener("pointermove", moverPieza);                    // pointermove en el documento → mueve la pieza
document.addEventListener("pointerup", terminarArrastre);                // pointerup en el documento  → suelta la pieza

// REDES DE SEGURIDAD: si el navegador cancela el arrastre (pointercancel) o la
// ventana pierde el foco (Alt+Tab, click en otra aplicación), soltamos la pieza
// en su última posición conocida para que no quede pegada al cursor
document.addEventListener("pointercancel", () => terminarArrastre(ultimaPosicionCursor));
window.addEventListener("blur", () => terminarArrastre(ultimaPosicionCursor));