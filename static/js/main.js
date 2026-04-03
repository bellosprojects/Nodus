init_socket();

import { socket, init_socket, myColor, nombreUsuario } from './socket.js';
import { actualizarPuntosyFlechasDelNodo } from './componentes/nodo.js';
import { cambiar_color, mover_nodo } from './componentes/nodo-edit.js';

let myNode = null;

let origenDatos = {
    nodoId: null,
    puntoId: null,
    tipo: "estatica"
}

const GRID_SIZE = 20; // Unidad de medida

export {stage, layer, socket, myNode, origenDatos, GRID_SIZE, trasformar, trashZone};

export {estaOcupado, actualizarPresencia};

import { crearCuadrado, editandoTexto } from './componentes/nodo.js';
import { obtenerCentro, eliminarCursorAjeno } from './utils.js';
import { dibujandoConexion, flechaTemporal } from './componentes/flecha.js';
import { eliminarNodoLocalYRemoto } from './componentes/nodo.js';
import { cancelarDibujoConexion, buscarPuntoCercano, finalizarConexion } from './componentes/flecha.js';


socket.addEventListener('open', () => {
    socket.send(JSON.stringify({
        tipo: "asignar_color_user",
        color: myColor
    }));
});



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
        rect.stroke('#23DAF6');
        rect.strokeWidth(3);
        rect.shadowBlur(30);
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

                if(user.nombre == nombreUsuario){
                    myNode = user.objeto;
                    updateHUD()
                    nodo.draggable(true);
                } else if (rect){
                    rect.stroke(user.color);
                    rect.shadowBlur(0);
                    rect.strokeWidth(3);
                }
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

        const nodosSelected = trasformar.nodes();

        nodosSelected.forEach(nodo => {
            const nodoID = nodo.id();

            if(!estaOcupado(nodoID)){
                eliminarNodoLocalYRemoto(nodo);
            }
        }); 

        myNode = null;
        updateHUD();

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

                actualizarPuntosyFlechasDelNodo(nodo.id());

                socket.send(JSON.stringify({
                    tipo: "mover_nodo",
                    id: nodo.id(),
                    x: nodo.x(),
                    y: nodo.y()
                }));

                updateHUD();
            }
        });
    }

});

window.addEventListener('resize', () => {
    stage.width(window.innerWidth - 160);
    stage.height(window.innerHeight);
});

stage.on('click', (e) => {
    if(e.target === stage){

        if(myNode != null){

            trasformar.nodes([]);

            socket.send(JSON.stringify({
                tipo: "seleccionar_nodo",
                id: null
            }));

            layer.draw();
            layerPresencia.draw();

            myNode = null;
            updateHUD();
        }
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
        stage.container().style.cursor = 'copy';

    }else{
        destinoX = posMouse.x;
        destinoY = posMouse.y;
        stage.container().style.cursor = 'crosshair';
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

const nodo_id = document.getElementById("node-id")
const nodo_width = document.getElementById("node-width");
const nodo_height = document.getElementById("node-height");
const nodo_x = document.getElementById("node-x");
const nodo_y = document.getElementById("node-y");
const nodo_fill = document.getElementById("node-fill");

export function updateHUD(){
    const nodo = stage.findOne('#' + myNode);
    if(nodo){
        
        const rect = nodo.findOne('.fondo-rect');
        if(rect){

            nodo_width.disabled = false;
            nodo_height.disabled = false;
            nodo_x.disabled = false;
            nodo_y.disabled = false;
            nodo_fill.disabled = false;

            nodo_id.textContent = myNode;
            nodo_width.value = +rect.width() / 20;
            nodo_height.value = +rect.height() / 20;
            nodo_x.value = +nodo.x() / 20;
            nodo_y.value = +nodo.y() / 20;
            nodo_fill.value = rect.fill();
        }
    } else {
        nodo_width.value = null;
        nodo_height.value = null;
        nodo_x.value = null;
        nodo_y.value = null;
        nodo_id.textContent = 'NONE';
        nodo_fill.value = '#000000'

        nodo_width.disabled = true;
        nodo_height.disabled = true;
        nodo_x.disabled = true;
        nodo_y.disabled = true;
        nodo_fill.disabled = true;
    }
}

nodo_width.addEventListener('keyup', (e) => {
    if (myNode !== null){
        const nodo = stage.findOne('#' + myNode);
        if(nodo){

            const rect = nodo.findOne('.fondo-rect');
            if(rect){
                rect.width(e.target.value * 20);

                trasformar.nodes([nodo]);
            }
        }
    }
});

nodo_height.addEventListener('keyup', (e) => {
    if (myNode !== null){
        const nodo = stage.findOne('#' + myNode);
        if(nodo){

            const rect = nodo.findOne('.fondo-rect');
            if(rect){
                rect.height(e.target.value * 20);
            }
        }
    }
});

nodo_x.addEventListener('keyup', (e) => {
    if (myNode !== null){
        mover_nodo(myNode, e.target.value * 20, null);
    }
});

nodo_y.addEventListener('keyup', (e) => {
    if (myNode !== null){
        if (myNode !== null){
        mover_nodo(myNode, null, e.target.value * 20);
    }
    }
});

nodo_fill.addEventListener('input', (e) => {
    if (myNode != null){
        cambiar_color(myNode, e.target.value);
    }
});

nodo_fill.addEventListener('change', (e) => {
    console.log(e.target.value);
});