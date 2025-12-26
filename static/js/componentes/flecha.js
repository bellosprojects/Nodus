import { stage, layer } from '../main.js';
import { calcularPuntos } from '../utils.js';
import { origenDatos } from '../main.js';
import { flechas } from './nodo.js';

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
        tension: 0.1,
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

        flechaReal.destroy();
        for(let i = flechas.length -1; i>=0 ; i--){
            if(flechas[i].id === nuevaConexion.id){
                flechas.splice(i, 1);
                break;
            }
        }
        layer.batchDraw();
        
    });


    nuevaConexion.linea = flechaReal;
    layer.add(flechaReal);
    flechas.push(nuevaConexion);

    cancelarDibujoConexion();

    actualizarPosicionFlecha(nuevaConexion);
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

    // Ajustar puntos para evitar cruces innecesarios
    if(inicio.y < fin.y - 30 && puntoInicioId === 'top'){
        puntoInicioId = 'bottom';
        puntoFinId = 'top';
    }
    if(inicio.y > fin.y + 30 && puntoInicioId === 'bottom'){
        puntoInicioId = 'top';
        puntoFinId = 'bottom';
    }
    if(inicio.x < fin.x - 30 && puntoInicioId === 'left'){
        puntoInicioId = 'right';
        puntoFinId = 'left';
    }
    if(inicio.x > fin.x + 30 && puntoInicioId === 'right'){
        puntoInicioId = 'left';
        puntoFinId = 'right';
    }        

    inicio = obtenerPosPunto(nodoOrigen, puntoInicioId);
    fin = obtenerPosPunto(nodoDestino, puntoFinId);

    if(!inicio || !fin) return;

    let primeraParte = null;
    if(puntoInicioId === 'top'){
        primeraParte = [inicio.x, inicio.y - 10, inicio.x, inicio.y - 40];
    } else if(puntoInicioId === 'bottom'){
        primeraParte = [inicio.x, inicio.y + 10, inicio.x, inicio.y + 40];
    } else if(puntoInicioId === 'left'){
        primeraParte = [inicio.x - 10, inicio.y, inicio.x - 40, inicio.y];
    } else if(puntoInicioId === 'right'){
        primeraParte = [inicio.x + 10, inicio.y, inicio.x + 40, inicio.y];
    }
    
    let ultimaParte = null;
    if(puntoFinId === 'top'){
        ultimaParte = [fin.x, fin.y - 40, fin.x, fin.y - 10];
    } else if(puntoFinId === 'bottom'){
        ultimaParte = [fin.x, fin.y + 40, fin.x, fin.y + 10];
    } else if(puntoFinId === 'left'){
        ultimaParte = [fin.x - 40, fin.y, fin.x - 10, fin.y];
    } else if(puntoFinId === 'right'){
        ultimaParte = [fin.x + 40, fin.y, fin.x + 10, fin.y];
    }

    const orientacion = (puntoInicioId === 'top' || puntoInicioId === 'bottom') ? 'vertical' : 'horizontal';

    const puntosIntermedios = calcularPuntos(
        {x: primeraParte[2], y: primeraParte[3]},
        {x: ultimaParte[0], y: ultimaParte[1]},
        orientacion
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