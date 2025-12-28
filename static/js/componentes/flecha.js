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

export function finalizarConexion(destinoNodoId, destinoPuntoId){
    crearConexion(
        origenDatos.nodoId,
        origenDatos.puntoId,
        destinoNodoId,
        destinoPuntoId
    );
}

export function crearConexion(origenId, origenPuntoId, destinoId, destinoPuntoId, id = null, debeEmitir = true){

    const nuevaConexion = {
        id: id || "flecha-" + Date.now(),
        origenId: origenId,
        origenPuntoId: origenPuntoId,
        destinoId: destinoId,
        destinoPuntoId: destinoPuntoId,
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
        document.body.style.cursor = 'pointer';
        flechaReal.stroke('#ff4d4d');
        flechaReal.fill('#ff4d4d');
        layer.batchDraw();
    });

    flechaReal.on('mouseleave', () => {
        document.body.style.cursor = 'default';
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
    flechas.push(nuevaConexion);

    cancelarDibujoConexion();

    actualizarPosicionFlecha(nuevaConexion);
}

const space = 5;
const sep = space + 20;

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

    if(puntoInicioId){
        let state = false;

        //Correccion horizontal (del destino)
        if(obtenerPosPunto(nodoOrigen, 'right').x < obtenerPosPunto(nodoDestino, 'left').x - sep){
            puntoFinId = 'left';
            orientacion = 'horizontal';
            action = 'bajar';
        }
        else if(obtenerPosPunto(nodoOrigen, 'left').x > obtenerPosPunto(nodoDestino, 'right').x + sep){
            puntoFinId = 'right';
            orientacion = 'horizontal';
            action = 'bajar';
        }else{
            orientacion = 'horizontal';
            action = 'none';
            if(obtenerPosPunto(nodoOrigen, 'bottom').y < obtenerPosPunto(nodoDestino, 'top').y - 2*sep){
                puntoFinId = 'top';
            }else if(obtenerPosPunto(nodoOrigen, 'top').y > obtenerPosPunto(nodoDestino, 'bottom').y + 2*sep){
                puntoFinId = 'bottom';
            }else{
                state = true;

                if(obtenerPosPunto(nodoDestino, 'right').x < obtenerPosPunto(nodoOrigen, 'bottom').x || obtenerPosPunto(nodoDestino, 'left').x > obtenerPosPunto(nodoOrigen, 'bottom').x){
                    puntoFinId = puntoInicioId = 'bottom';
                    if(obtenerPosPunto(nodoOrigen, 'bottom').y < obtenerPosPunto(nodoDestino, 'bottom').y){
                        action = 'bajar';
                    }else{
                        action = 'subir';
                    }
                }
                else{
                    puntoInicioId = puntoFinId = 'left';
                    if(obtenerPosPunto(nodoOrigen, 'left').x < obtenerPosPunto(nodoDestino, 'left').x){
                        action = 'bajar';
                    }else{
                        action = 'subir';
                    }
                }
            }
        }

        //Correcion vertical (del origen)
        if(!state){
            if(obtenerPosPunto(nodoOrigen, 'bottom').y + sep < obtenerPosPunto(nodoDestino, 'top').y){
                puntoInicioId = 'bottom';
            }else if(obtenerPosPunto(nodoOrigen, 'top').y - sep > obtenerPosPunto(nodoDestino, 'bottom').y){
                puntoInicioId = 'top';
            }else{
                if(obtenerPosPunto(nodoOrigen, 'right').x < obtenerPosPunto(nodoDestino, 'left').x - 2*sep){
                    puntoInicioId = 'right';
                    action = 'none';
                    orientacion = 'vertical';
                }else if(obtenerPosPunto(nodoOrigen, 'left').x > obtenerPosPunto(nodoDestino, 'right').x + 2*sep){
                    puntoInicioId = 'left';
                    action = 'none';
                    orientacion = 'vertical';
                }else{
                    puntoFinId = puntoInicioId = 'bottom';

                    if(obtenerPosPunto(nodoOrigen, 'bottom').y > obtenerPosPunto(nodoDestino, 'bottom').y){
                        action = 'subir';
                    }else{
                        action = 'bajar';
                    }
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

    const puntosIntermedios = calcularPuntos(
        {x: primeraParte[2], y: primeraParte[3]},
        {x: ultimaParte[0], y: ultimaParte[1]},
        orientacion,
        action
    );

    const puntosFinales = primeraParte.concat(puntosIntermedios).concat(ultimaParte);

    conexion.linea.points(puntosFinales);
    layer.batchDraw();

}

export function cancelarDibujoConexion(){
    dibujandoConexion = false;
    origenDatos.nodoId = null;
    origenDatos.puntoId = null;
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