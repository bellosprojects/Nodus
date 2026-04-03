import { stage, layer } from '../main.js';
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
            stroke: '#23DAF6',
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
        fill: '#23DAF6',
        stroke: '#23DAF6',
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
        stroke: '#23DAF6',
        fill: '#23DAF6',
        strokeWidth: 3,
        pointerLength: 10,
        pointerWidth: 10,
        hitStrokeWidth: 15,
        bezier: true
    });

    flechaReal.on('mouseenter', () => {
        stage.container().style.cursor = 'pointer';
        flechaReal.stroke('#ff2b2b');
        flechaReal.fill('#ff2b2b');
        layer.batchDraw();
    });

    flechaReal.on('mouseleave', () => {
        stage.container().style.cursor = 'default';
        flechaReal.stroke('#23DAF6');
        flechaReal.fill('#23DAF6');
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
    
    let intermedio = [];

    if(['left','right'].includes(conexion.origenPuntoId) && ['bottom', 'top'].includes(conexion.destinoPuntoId)){
        intermedio = [
            (fin.x - inicio.x) / 2 + inicio.x,
            inicio.y,
            fin.x,
            (fin.y - inicio.y) / 2 + inicio.y 
        ];
    }

    conexion.linea.points(
        [
            inicio.x,
            inicio.y,
            ...intermedio,
            fin.x,
            fin.y
        ]
    );

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