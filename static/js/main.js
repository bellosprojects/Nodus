
init_socket();

import { socket, init_socket, myColor, nombreUsuario } from './socket.js';
import { actualizarPuntosyFlechasDelNodo } from './componentes/nodo.js';

let myNode = null;

let origenDatos = {
    nodoId: null,
    puntoId: null
}

const GRID_SIZE = 20; // Unidad de medida

const colorPicker = document.getElementById('color-picker');

export {stage, layer, socket, myColor, myNode, origenDatos, GRID_SIZE, colorPicker, trasformar, trashZone};

export {estaOcupado, actualizarPresencia};

import { crearCuadrado, editandoTexto } from './componentes/nodo.js';
import { obtenerCentro, eliminarCursorAjeno } from './utils.js';
import { dibujandoConexion, flechaTemporal } from './componentes/flecha.js';
import { eliminarNodoLocalYRemoto } from './componentes/nodo.js';
import { mostrarPaleta } from './componentes/nodo.js';
import { cancelarDibujoConexion, buscarPuntoCercano, finalizarConexion } from './componentes/flecha.js';
import { obtenerColorTexto } from './utils.js';

socket.addEventListener('open', () => {
    socket.send(JSON.stringify({
        tipo: "asignar_color_user",
        color: myColor
    }));
});



// 1. Crear el escenario
const stage = new Konva.Stage({
    container: 'canvas-container',
    width: window.innerWidth,
    height: window.innerHeight,
    draggable: false,
});

const layer = new Konva.Layer();
export const layerPresencia = new Konva.Layer();

const trasformar = new Konva.Transformer({
    nodes: [],
    keepRatio: false,
    rotateEnabled: false,
    boundBoxFunc: (oldBox, newBox) => {
        if (newBox.width < GRID_SIZE * 2 || newBox.height < GRID_SIZE * 2) {
            return oldBox;
        }
        return newBox;
    },
    enabledAnchors: [
        'top-left',
        'top-right',
        'bottom-left',
        'bottom-right',
        'top-center',
        'bottom-center',
        'middle-left',
        'middle-right',
    ],
    padding: 15,
    anchorSize: 8,
});

export let jugadoresActuales = [];

function estaOcupado(nodo){
    return jugadoresActuales.some(user => user.objeto === nodo && nombreUsuario != user.nombre);
}

function actualizarPresencia(usuarios){

    jugadoresActuales.forEach(user => {
        if(!usuarios.some(old => old.nombre === user.nombre)){
            eliminarCursorAjeno(user.nombre)
        }
    });

    jugadoresActuales = usuarios;

    const container = document.getElementById('user-presence');
    container.innerHTML = '';

    stage.find('.fondo-rect').forEach(rect => {
        rect.stroke('#333');
        rect.strokeWidth(2);
        rect.getParent().draggable(true);
    });

    usuarios.forEach(user => {

        const iniciales = user.nombre.substring(0,2);
        const div = document.createElement('div');
        div.className = 'user-avatar';
        div.innerHTML = iniciales;
        div.title = user.nombre;
        div.style.background = user.color;

        if(user.objeto){
            const nodo = stage.findOne('#' + user.objeto);

            if(nodo){
                const rect = nodo.findOne('.fondo-rect');

                if(rect){
                    rect.stroke(user.color);
                    rect.strokeWidth(6);
                }
            }

            if(user.nombre == nombreUsuario){
                myNode = user.objeto;
                nodo.draggable(true);
            }
        }

        container.appendChild(div);
    });

    layer.batchDraw();
}

layer.add(trasformar);

stage.add(layer);
stage.add(layerPresencia);

const trashZone = document.getElementById('trash-container');

document.getElementById('add-rect-btn').addEventListener('click', () => {
    const centro = obtenerCentro();
    crearCuadrado(centro.x, centro.y, "Nuevo Cuadro", null, true);
    layer.draw();
});

window.addEventListener('keydown', (e) => {
    if(e.key === 'Delete' || e.key === 'Backspace'){

        if(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA'){
            return;
        }

        colorPicker.style.display = 'none';
        const nodosSelected = trasformar.nodes();

        nodosSelected.forEach(nodo => {
            const nodoID = nodo.id();

            if(!estaOcupado(nodoID)){
                eliminarNodoLocalYRemoto(nodo);
            }
        }); 

    }

    //Mover cuadro con las flechas del teclado
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){

        if(editandoTexto) return;

        const nodosSelected = trasformar.nodes();
        nodosSelected.forEach(nodo => {
            if(!estaOcupado(nodo.id())){
                let deltaX = 0;
                let deltaY = 0;
                if(e.key === 'ArrowUp') deltaY = -GRID_SIZE;
                if(e.key === 'ArrowDown') deltaY = GRID_SIZE;
                if(e.key === 'ArrowLeft') deltaX = -GRID_SIZE;
                if(e.key === 'ArrowRight') deltaX = GRID_SIZE;

                
                nodo.position({
                    x: nodo.x() + deltaX,
                    y: nodo.y() + deltaY
                });
                mostrarPaleta(nodo);

                actualizarPuntosyFlechasDelNodo(nodo.id());

                socket.send(JSON.stringify({
                    tipo: "mover_nodo",
                    id: nodo.id(),
                    x: nodo.x(),
                    y: nodo.y()
                }));
            }
        });
    }

});

document.querySelectorAll('.color-dot').forEach(dot => {
    dot.addEventListener('click', () => {
        const nodoID = colorPicker.dataset.nodoTarget;
        const nodo = stage.findOne('#' + nodoID);
        if(nodo){
            const rect = nodo.findOne('.fondo-rect');
            rect.fill(dot.dataset.color);

            const label = nodo.findOne('.texto-nodo');
            if(label){
                label.fill(obtenerColorTexto(dot.dataset.color));
            }

            layer.batchDraw();
            socket.send(JSON.stringify({
                tipo: "cambiar_color_nodo",
                id: nodoID,
                color: dot.dataset.color
            }));
        }
    });
});

window.addEventListener('resize', () => {
    stage.width(window.innerWidth - 160);
    stage.height(window.innerHeight);
});

stage.on('click', (e) => {
    if(e.target === stage){

        colorPicker.style.display = 'none';

        trasformar.nodes([]);

        socket.send(JSON.stringify({
            tipo: "seleccionar_nodo",
            id: null
        }));

        layer.draw();
        layerPresencia.draw();

        myNode = null;
    }
});

let ultimoEnvio = 0;
const FRECUENCIA_MS = 30;

stage.on('mousemove', () => {

    const ahora = Date.now();

    if(socket.readyState === WebSocket.OPEN){

        if(ahora - ultimoEnvio > FRECUENCIA_MS){
            const pos = stage.getPointerPosition();

            socket.send(JSON.stringify({
                tipo: "mover_cursor",
                x: pos.x,
                y: pos.y,
                nombre: nombreUsuario,
            }));
            ultimoEnvio = ahora;
        }
    }

    if(!dibujandoConexion || !flechaTemporal) return;

    const posMouse = stage.getPointerPosition();

    const puntoMagnetico = buscarPuntoCercano(posMouse);

    let destinoX, destinoY;

    if(puntoMagnetico){
        const posPunto = puntoMagnetico.getAbsolutePosition();
        destinoX = posPunto.x;
        destinoY = posPunto.y;
        document.body.style.cursor = 'copy';

    }else{
        destinoX = posMouse.x;
        destinoY = posMouse.y;
        document.body.style.cursor = 'crosshair';
    }

    const puntos = flechaTemporal.points();

    flechaTemporal.points([
        puntos[0], puntos[1],
        destinoX, destinoY
    ]);

    layer.batchDraw();

});

stage.on('mousedown', (e) => {
    if(e.target === stage){
        stage.container().style.cursor = 'grabbing';
    }
});

stage.on('mouseup', (e) => {

    stage.container().style.cursor = 'default';

    if(!dibujandoConexion) return;

    const posMouse = stage.getPointerPosition();
    const puntoMagnetico = buscarPuntoCercano(posMouse);

    if(puntoMagnetico){
        const nodoDestino = puntoMagnetico.getParent();
        const destinoPuntoId = puntoMagnetico.id();

        if(nodoDestino.id() !== origenDatos.nodoId){
            finalizarConexion(nodoDestino.id(), destinoPuntoId);
            return;
        }
    }

    if(e.target === stage){
        cancelarDibujoConexion();
    }
});