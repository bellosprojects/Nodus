import { stage, layer } from '../main.js';
import { calcularPuntos } from '../utils.js';
import { origenDatos } from '../main.js';
import { flechas } from './nodo.js';
import { socket } from '../socket.js';

let dibujandoConexion = false;
let flechaTemporal = null;

export { dibujandoConexion , flechaTemporal };

export function crearPuntosConexion(grupo){
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
            radius: 7,
            fill: 'white',
            stroke: '#4a90e2',
            strokeWidth: 2,
            visible: false,
            shadowColor: 'white',
            shadowBlur: 5,
        });

        const areaClick = new Konva.Circle({
            radius: 20,
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

                if(destinoId !== origenDatos.nodoId || destinoPuntoId !== origenDatos.puntoId){
                    finalizarConexion(destinoId, destinoPuntoId);
                }
            }

        });

        grupo.on('transform transformend', () => {
            grupoPunto.x(rect.width() * pos.x);
            grupoPunto.y(rect.height() * pos.y);

            flechas.forEach(flecha => {
                if(flecha.origenId === grupo.id() || flecha.destinoId === grupo.id()){
                    actualizarPosicionFlecha(flecha);
                }
            });
        });

        grupo.add(grupoPunto);
    });
}

let teclas = {};

document.addEventListener('keydown', (e) => {
    teclas[e.key] = true;
});

document.addEventListener('keyup', (e) => {
    teclas[e.key] = false;
});

function iniciarDibujoConexion(nodoGrupo, puntoId){

    dibujandoConexion = true;
    origenDatos.nodoId = nodoGrupo.id();
    origenDatos.puntoId = puntoId;
    
    if(teclas['Shift']){
        origenDatos.tipo = 'dinamica';
    }

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

export function finalizarConexion(destinoNodoId, destinoPuntoId){

    if(origenDatos.nodoId === destinoNodoId){
        origenDatos.tipo = 'estatica';
    }

    crearConexion(
        origenDatos.nodoId,
        origenDatos.puntoId,
        destinoNodoId,
        destinoPuntoId,
        origenDatos.tipo,
    );
}

export function crearConexion(origenId, origenPuntoId, destinoId, destinoPuntoId, tipo, id = null, debeEmitir = true){

    const nuevaConexion = {
        id: id || "flecha-" + Date.now(),
        origenId: origenId,
        origenPuntoId: origenPuntoId,
        destinoId: destinoId,
        destinoPuntoId: destinoPuntoId,
        tipo: tipo,
        linea: null,
    };

    if(debeEmitir){
        socket.send(JSON.stringify({
            tipo: "crear_conexion",
            conexion: {
                origenId: origenId,
                origenPuntoId: origenPuntoId,
                destinoId: destinoId,
                destinoPuntoId: destinoPuntoId,
                tipo: tipo,
                id: nuevaConexion.id,
            }
        }));
    }

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
        hitStrokeWidth: 15,
    });

    flechaReal.on('mouseenter', () => {
        stage.container().style.cursor = 'pointer';
        flechaReal.stroke('#ff4d4d');
        flechaReal.fill('#ff4d4d');
        layer.batchDraw();
    });

    flechaReal.on('mouseleave', () => {
        stage.container().style.cursor = 'default';
        flechaReal.stroke('#4a90e2');
        flechaReal.fill('#4a90e2');
        layer.batchDraw();
    });

    flechaReal.on('click', (e) => {
        e.cancelBubble = true;
        eliminarConexionPorId(nuevaConexion.id);
    });


    nuevaConexion.linea = flechaReal;
    layer.add(flechaReal);
    //flechaReal.moveToBottom();
    flechas.push(nuevaConexion);

    cancelarDibujoConexion();

    actualizarPosicionFlecha(nuevaConexion);
}

const space = 5;
const sep = space + 20;
const top = 'top';
const bottom = 'bottom';
const left = 'left';
const right = 'right';
const vertical = 'vertical';
const horizontal = 'horizontal';
const subir = 'subir';
const bajar = 'bajar';

const T = 1, B = 2, L = 4, R = 8;

function actualizarPosicionFlechaDinamica(conexion){
    const oN = stage.findOne('#' + conexion.origenId);
    const dN = stage.findOne('#' + conexion.destinoId);

    const o = { x: oN.x(), y: oN.y(), w: oN.width(), h: oN.height() };
    const d = { x: dN.x(), y: dN.y(), w: dN.width(), h: dN.height() };

    const oCx = o.x + o.w /2;
    const oCy = o.y + o.h /2;
    const dCx = d.x + d.w / 2;
    const dCy = d.y + d.h / 2;

    const dx = dCx - oCx;
    const dy = dCy - oCy;

    let pI, pF;

    if(Math.abs(dx) > Math.abs(dy)){
        if (dx > 0) { pI = R; pF = L; }
        else { pI = L; pF = R; }
    } else {
        if (dy > 0) { pI = B; pF = T; }
        else { pI = T; pF = B; }
    }

    const inicio = getCoord(o, pI);
    const fin = getCoord(d, pF);

    const p1 = getOffset(inicio, pI, 5);
    const p2 = getOffset(inicio, pI, sep);
    const p4 = getOffset(fin, pF, sep);
    const p5 = getOffset(fin, pF, 5);

    let codo;
    if (pI & (L | R)){
        codo = [p2.x, p2.y, p2.x, p4.y];
    } else {
        codo = [p2.x, p2.y, dCy, p2.y];
    }

    const puntosFinales = [
        inicio.x, inicio.y,
        ...codo,
        fin.x, fin.y
    ];

    conexion.linea.points(puntosFinales);
    layer.batchDraw();
}

function getCoord(n, dir){
    if (dir === T) return { x: n.x + n.w/2, y: n.y};
    if (dir === B) return { x: n.x + n.w/2, y: n.y + n.h};
    if (dir === L) return { x: n.x, y: n.y + n.h/2};
    return { x: n.x + n.w, y: n.y + n.h/2};
}

function getOffset(p, dir, dist){
    if (dir === T) return { x: p.x, y: p.y - dist };
    if (dir === B) return { x: p.x, y: p.y + dist };
    if (dir === L) return { x: p.x - dist, y: p.y };
    return { x: p.x + dist, y: p.y };
}

export function actualizarPosicionFlecha(conexion){

    const nodoOrigen = stage.findOne('#' + conexion.origenId);
    const nodoDestino = stage.findOne('#' + conexion.destinoId);

    if(!nodoOrigen || !nodoDestino) return;

    const obtenerPosPunto = (nodo, puntoId) => {
        const areaPunto = nodo.find('.punto-conexion').find(p => p.id() === puntoId);
        return areaPunto.getAbsolutePosition();
    };

    let inicio = obtenerPosPunto(nodoOrigen, conexion.origenPuntoId);
    let fin = obtenerPosPunto(nodoDestino, conexion.destinoPuntoId);

    let puntoInicioId = conexion.origenPuntoId;
    let puntoFinId = conexion.destinoPuntoId;
    
    let orientacion = 'auto';
    let action = 'none';
    
    let puntoExtra = [];
    const OrigenRight = obtenerPosPunto(nodoOrigen, right);
    const OrigenLeft = obtenerPosPunto(nodoOrigen, left);
    const OrigenTop = obtenerPosPunto(nodoOrigen, top);
    const OrigenBottom = obtenerPosPunto(nodoOrigen, bottom);
    const DestinoRight = obtenerPosPunto(nodoDestino, right);
    const DestinoLeft = obtenerPosPunto(nodoDestino, left);
    const DestinoTop = obtenerPosPunto(nodoDestino, top);
    const DestinoBottom = obtenerPosPunto(nodoDestino, bottom);

    //Auto-flechas (dinamicas)
    //Aqui se seleccionan automaticamente los puntoId
    if(conexion.tipo == 'dinamica'){
        let state = false;

        //Correccion horizontal (del destino)
        if(OrigenRight.x < DestinoLeft.x - sep){
            puntoFinId = 'left';
            orientacion = 'horizontal';
            action = 'bajar';
        }
        else if(OrigenLeft.x > DestinoRight.x + sep){
            puntoFinId = 'right';
            orientacion = 'horizontal';
            action = 'bajar';
        }else{
            orientacion = 'horizontal';
            action = 'none';
            if(OrigenBottom.y < DestinoTop.y - 2*sep){
                puntoFinId = 'top';
            }else if(OrigenTop.y > DestinoBottom.y + 2*sep){
                puntoFinId = 'bottom';
            }else{
                state = true;

                if(DestinoRight.x < OrigenBottom.x || DestinoLeft.x > OrigenBottom.x){
                    puntoFinId = puntoInicioId = 'bottom';
                    if(OrigenBottom.y < DestinoBottom.y){
                        action = 'bajar';
                    }else{
                        action = 'subir';
                    }
                }
                else{
                    puntoInicioId = puntoFinId = 'left';
                    if(OrigenLeft.x < DestinoLeft.x){
                        action = 'bajar';
                    }else{
                        action = 'subir';
                    }
                }
            }
        }

        //Correcion vertical (del origen)
        if(!state){
            if(OrigenBottom.y + sep < DestinoTop.y){
                puntoInicioId = 'bottom';
            }else if(OrigenTop.y - sep > DestinoBottom.y){
                puntoInicioId = 'top';
            }else{
                if(OrigenRight.x < DestinoLeft.x - 2*sep){
                    puntoInicioId = 'right';
                    action = 'none';
                    orientacion = 'vertical';
                }else if(OrigenLeft.x > DestinoRight.x + 2*sep){
                    puntoInicioId = 'left';
                    action = 'none';
                    orientacion = 'vertical';
                }else{
                    puntoFinId = puntoInicioId = 'bottom';

                    if(OrigenBottom.y > DestinoBottom.y){
                        action = 'subir';
                    }else{
                        action = 'bajar';
                    }
                }
            }
        }
    } 

    // flecha-estatica 
    //Seleccin de orientacion y accion
    //Evitamos los choces con base en las dimensiones de los cuadros
    //Agregamos puntos extras de ser necesario para evitar choques
    else {

        //Primero verificamos conexiones reflexivas
        if(nodoOrigen == nodoDestino){

            orientacion = 'vertical';
            action = ((puntoInicioId == bottom && puntoFinId == top) ||
            (puntoInicioId == top && puntoFinId == bottom) ||
            (puntoInicioId == left && puntoFinId != right) ||
            (puntoInicioId == right && puntoFinId != left))? subir : bajar;

            if(puntoInicioId == 'bottom'){
                if(puntoFinId == 'top'){
                    puntoExtra = [
                        obtenerPosPunto(nodoOrigen, 'left').x - sep,
                        inicio.y + sep
                    ];
                }
            }else if(puntoInicioId == 'top'){
                if(puntoFinId == 'bottom'){
                    puntoExtra = [
                        obtenerPosPunto(nodoOrigen, 'right').x + sep,
                        inicio.y - sep
                    ];
                }
            }else if(puntoInicioId == 'left'){
                if(puntoFinId == 'right'){
                    puntoExtra = [
                        inicio.x - sep,
                        obtenerPosPunto(nodoOrigen, 'top').y - sep,
                    ];
                }
            }else{
                if(puntoFinId == 'left'){
                    puntoExtra = [
                        inicio.x + sep,
                        obtenerPosPunto(nodoOrigen, 'bottom').y + sep,
                    ];
                }
            }
        }

        //No es reflexivo
        else{
            if(puntoInicioId == 'bottom'){
                if(puntoFinId == 'bottom'){
                    if((inicio.x < obtenerPosPunto(nodoDestino, 'left').x && inicio.y < obtenerPosPunto(nodoDestino, 'top').y - sep) || (obtenerPosPunto(nodoOrigen, 'right').x < fin.x && fin.y < obtenerPosPunto(nodoOrigen, 'top').y - sep)){
                        orientacion = 'vertical';
                        action = 'subir';
                        if(inicio.y > fin.y){
                            action = 'bajar';
                        }
                    }
                    else if((obtenerPosPunto(nodoOrigen, 'left').x > fin.x && fin.y < obtenerPosPunto(nodoOrigen, 'top').y - sep) || (obtenerPosPunto(nodoDestino, 'right').x < inicio.x && inicio.y < obtenerPosPunto(nodoDestino, 'top').y - sep)){
                        orientacion = 'vertical';
                        action = 'subir';
                        if(inicio.y > fin.y){
                            action = 'bajar';
                        }
                    }else if(inicio.y >= (obtenerPosPunto(nodoDestino, 'top').y - sep) && obtenerPosPunto(nodoOrigen, 'top').y <= fin.y + sep){
                        orientacion = 'horizontal';
                        action = 'subir';
                        if(inicio.y < fin.y){
                            action = 'bajar';
                        }
                    }else{
                        if(inicio.y < (obtenerPosPunto(nodoDestino, 'top').y - sep)){
                            if(inicio.x > fin.x){
                                puntoExtra = [
                                    obtenerPosPunto(nodoDestino, 'right').x + sep,
                                    inicio.y + sep
                                ];
                                orientacion = 'vertical';
                                action = 'subir';
                            }else{
                                puntoExtra = [
                                    obtenerPosPunto(nodoDestino, 'left').x - sep,
                                    inicio.y + sep
                                ];
                                orientacion = 'vertical';
                                action = 'subir';
                            }
                        }else{
                            if(inicio.x > fin.x){
                                puntoExtra = [
                                    obtenerPosPunto(nodoOrigen, 'left').x - sep,
                                    inicio.y + sep
                                ];
                                orientacion = 'vertical';
                                action = 'subir';
                            }else{
                                puntoExtra = [
                                    obtenerPosPunto(nodoOrigen, 'right').x + sep,
                                    inicio.y + sep
                                ];
                                orientacion = 'vertical';
                                action = 'subir';
                            }
                        }
                    }
                    
                }else if (puntoFinId == 'left'){
                    //Caso ideal
                    if(inicio.x < fin.x - sep && inicio.y < fin.y - sep){
                        orientacion = 'vertical';
                        action = 'subir';
                    }else if(inicio.x >= obtenerPosPunto(nodoDestino, 'right').x){
                        orientacion = 'vertical';
                        action = 'bajar';
                        if(inicio.y + sep > obtenerPosPunto(nodoDestino, 'top').y - sep && inicio.y + sep < obtenerPosPunto(nodoDestino, 'bottom').y + sep){
                            puntoExtra = [
                                inicio.x,
                                obtenerPosPunto(nodoDestino, 'bottom').y + sep
                            ];
                        }
                    }else{
                        orientacion = 'horizontal';
                        action = 'subir';
                        if(obtenerPosPunto(nodoOrigen, 'right').x > fin.x - 2*sep && obtenerPosPunto(nodoOrigen, 'left').x < fin.x && inicio.y > fin.y){
                            puntoExtra = [
                                obtenerPosPunto(nodoOrigen, 'left').x - sep,
                                inicio.y + sep
                            ];
                            action = 'bajar';
                        }
                    }
                }else if(puntoFinId == 'right'){

                }else{

                }
            }else if (puntoInicioId == 'left'){
                if(puntoFinId == 'bottom'){
                
                }else if (puntoFinId == 'left'){

                }else if(puntoFinId == 'right'){

                }else{

                }
            }else if(puntoInicioId == 'right'){
                if(puntoFinId == 'bottom'){
                
                }else if (puntoFinId == 'left'){

                }else if(puntoFinId == 'right'){

                }else{

                }
            }else{
                if(puntoFinId == 'bottom'){
                
                }else if (puntoFinId == 'left'){

                }else if(puntoFinId == 'right'){

                }else{

                }
            }
        }
    }  

    inicio = obtenerPosPunto(nodoOrigen, puntoInicioId);
    fin = obtenerPosPunto(nodoDestino, puntoFinId);

    if(!inicio || !fin) return;

    let primeraParte = null;
    if(puntoInicioId === 'top'){
        primeraParte = [inicio.x, inicio.y - space, inicio.x, inicio.y - sep];
    } else if(puntoInicioId === 'bottom'){
        primeraParte = [inicio.x, inicio.y + space, inicio.x, inicio.y + sep];
    } else if(puntoInicioId === 'left'){
        primeraParte = [inicio.x - space, inicio.y, inicio.x - sep, inicio.y];
    } else if(puntoInicioId === 'right'){
        primeraParte = [inicio.x + space, inicio.y, inicio.x + sep, inicio.y];
    }
    
    let ultimaParte = null;
    if(puntoFinId === 'top'){
        ultimaParte = [fin.x, fin.y - sep, fin.x, fin.y - space];
    } else if(puntoFinId === 'bottom'){
        ultimaParte = [fin.x, fin.y + sep, fin.x, fin.y + space];
    } else if(puntoFinId === 'left'){
        ultimaParte = [fin.x - sep, fin.y, fin.x - space, fin.y];
    } else if(puntoFinId === 'right'){
        ultimaParte = [fin.x + sep, fin.y, fin.x + space, fin.y];
    }

    let aux = {
        x: primeraParte[2], y: primeraParte[3]
    }

    if(puntoExtra.length != 0){
        aux = {
            x: puntoExtra[0], y : puntoExtra[1]
        }
    }

    const puntosIntermedios = calcularPuntos(
        aux,
        {x: ultimaParte[0], y: ultimaParte[1]},
        orientacion,
        action
    );

    const puntosFinales = primeraParte.concat(puntoExtra).concat(puntosIntermedios).concat(ultimaParte);

    conexion.linea.points(puntosFinales);
    layer.batchDraw();

}

export function cancelarDibujoConexion(){
    dibujandoConexion = false;
    origenDatos.nodoId = null;
    origenDatos.puntoId = null;
    origenDatos.tipo = 'estatica';
    if(flechaTemporal){
        flechaTemporal.destroy();
        flechaTemporal = null;
        layer.batchDraw();
    }
}

export function buscarPuntoCercano(posMouse){
    const RADIO_MAGNETICO = 20;
    let puntoMasCercano = null;
    let distanciaMinima = RADIO_MAGNETICO;

    stage.find('.punto-conexion').forEach(punto => {
        const posPunto = punto.getAbsolutePosition();
        const distancia = Math.sqrt(
            Math.pow(posMouse.x - posPunto.x, 2) +
            Math.pow(posMouse.y - posPunto.y, 2)
        );

        if(distancia < distanciaMinima){
            distanciaMinima = distancia;
            puntoMasCercano = punto;
        }
    });

    return puntoMasCercano;
}

export function eliminarConexionPorId(flechaId){
    const flechaAEliminar = stage.findOne('#' + flechaId);
    if(flechaAEliminar){
        flechaAEliminar.destroy();
        for(let i = flechas.length -1; i>=0 ; i--){
            if(flechas[i].id === flechaId){
                flechas.splice(i, 1);
                break;
            }
        }

        layer.batchDraw();
    }

    socket.send(JSON.stringify({
        tipo: "eliminar_conexion",
        id: flechaId,
    }));
}