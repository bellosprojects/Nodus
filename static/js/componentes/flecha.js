function crearPuntosConexion(grupo){
    const rect = grupo.findOne('.fondo-rect');

    const posiciones = [
        {x: 0.5, y:0, id: 'top'},
        {x: 1, y:0.5, id: 'right'},
        {x: 0.5, y:1, id: 'bottom'},
        {x: 0, y:0.5, id: 'left'},
    ]

    posiciones.forEach(pos => {

        const grupoPunto = new Konva.Group({
            x: rect.width() * pos.x,
            y: rect.height() * pos.y,
            name: 'grupo-punto-conexion',
        });

        const puntoVisual = new Konva.Circle({
            name: 'punto-visual',
            radius: 5,
            fill: 'white',
            stroke: '#4a90e2',
            strokeWidth: 2,
            visible: false,
            shadowColor: 'white',
            shadowBlur: 5,
        });

        const areaClick = new Konva.Circle({
            radius: 15,
            fill: 'transparent',
            id: pos.id,
            name: 'punto-conexion',
            draggable: false,
        });

        grupoPunto.add(puntoVisual);
        grupoPunto.add(areaClick);

        areaClick.on('mouseenter', () => {
            puntoVisual.visible(true);
            document.body.style.cursor = 'crosshair';
            layer.batchDraw();
        });

        areaClick.on('mouseleave', () => {
            puntoVisual.visible(false);
            document.body.style.cursor = 'default';
            layer.batchDraw();
        });

        areaClick.on('mousedown', (e) => {
            e.cancelBubble = true;
            iniciarDibujoConexion(grupo, pos.id);
        }); 

        areaClick.on('mouseup', (e) => {

            if(dibujandoConexion){
                e.cancelBubble = true;

                const destinoId = grupo.id();
                const destinoPuntoId = pos.id;

                if(destinoId === origenDatos.nodoId && destinoPuntoId === origenDatos.puntoId){
                    // No permitir conectar un punto consigo mismo
                    cancelarDibujoConexion();
                    return;
                }

                finalizarConexion(destinoId, destinoPuntoId);
            }

        });

        grupo.on('transform', () => {
            grupoPunto.x(rect.width() * pos.x);
            grupoPunto.y(rect.height() * pos.y);
        });

        grupo.add(grupoPunto);
    });
}

function iniciarDibujoConexion(nodoGrupo, puntoId){

    dibujandoConexion = true;
    origenDatos.nodoId = nodoGrupo.id();
    origenDatos.puntoId = puntoId;

    const posMouse = stage.getPointerPosition();

    flechaTemporal = new Konva.Arrow({
        points: [
            posMouse.x, posMouse.y,
            posMouse.x,
            posMouse.y
        ],
        pointerLength: 8,
        pointerWidth: 8,
        fill: '#4a90e2',
        stroke: '#4a90e2',
        strokeWidth: 2,
        dash: [10, 5],
        opacity: 0.7,
        listening: false,
    });

    layer.add(flechaTemporal);
    layer.batchDraw();
}

function finalizarConexion(destinoNodoId, destinoPuntoId){

    const nuevaConexion = {
        id: "flecha-" + Date.now(),
        origenId: origenDatos.nodoId,
        origenPuntoId: origenDatos.puntoId,
        destinoId: destinoNodoId,
        destinoPuntoId: destinoPuntoId,
        linea: null,
    };

    const flechaReal = new Konva.Arrow({
        id: nuevaConexion.id,
        stroke: '#4a90e2',
        fill: '#4a90e2',
        strokeWidth: 3,
        pointerLength: 10,
        pointerWidth: 10,
        lineCap: 'round',
        lineJoin: 'round',
        tension: 0.05,
    });

    nuevaConexion.linea = flechaReal;
    layer.add(flechaReal);
    flechas.push(nuevaConexion);

    cancelarDibujoConexion();

    actualizarPosicionFlecha(nuevaConexion);
}

function actualizarPosicionFlecha(conexion){

    const nodoOrigen = stage.findOne('#' + conexion.origenId);
    const nodoDestino = stage.findOne('#' + conexion.destinoId);

    if(!nodoOrigen || !nodoDestino) return;

    const obtenerPosPunto = (nodo, puntoId) => {
        const areaPunto = nodo.find('.punto-conexion').find(p => p.id() === puntoId);
        return areaPunto.getAbsolutePosition();
    };

    const inicio = obtenerPosPunto(nodoOrigen, conexion.origenPuntoId);
    const fin = obtenerPosPunto(nodoDestino, conexion.destinoPuntoId);

    if(!inicio || !fin) return;

    let primeraParte = null;

    const puntoInicioId = conexion.origenPuntoId;
    if(puntoInicioId === 'top'){
        primeraParte = [inicio.x, inicio.y, inicio.x, inicio.y - 20];
    } else if(puntoInicioId === 'bottom'){
        primeraParte = [inicio.x, inicio.y, inicio.x, inicio.y + 20];
    } else if(puntoInicioId === 'left'){
        primeraParte = [inicio.x, inicio.y, inicio.x - 20, inicio.y];
    } else if(puntoInicioId === 'right'){
        primeraParte = [inicio.x, inicio.y, inicio.x + 20, inicio.y];
    }
    const puntoFinId = conexion.destinoPuntoId;
    let ultimaParte = null;
    if(puntoFinId === 'top'){
        ultimaParte = [fin.x, fin.y - 30, fin.x, fin.y - 10];
    } else if(puntoFinId === 'bottom'){
        ultimaParte = [fin.x, fin.y + 30, fin.x, fin.y + 10];
    } else if(puntoFinId === 'left'){
        ultimaParte = [fin.x - 30, fin.y, fin.x - 10, fin.y];
    } else if(puntoFinId === 'right'){
        ultimaParte = [fin.x + 30, fin.y, fin.x + 10, fin.y];
    }

    const puntosIntermedios = calcularPuntos(
        {x: primeraParte[2], y: primeraParte[3]},
        {x: ultimaParte[0], y: ultimaParte[1]}
    );

    const puntosFinales = primeraParte.concat(puntosIntermedios).concat(ultimaParte);

    conexion.linea.points(puntosFinales);
    layer.batchDraw();

}