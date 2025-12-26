const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

let nombreUsuario = prompt("Ingresa tu nombre de usuario:") || "Anonimo";
const myColor = `rgb(${Math.random()*50 + 70},${Math.random()*80 + 30},${Math.random()*120})`;
let myNode = null;

let dibujandoConexion = false;
let flechaTemporal = null;
let origenDatos = {
    nodoId: null,
    puntoId: null
}

const socket = new WebSocket(`${protocol}//${window.location.host}/ws/${nombreUsuario}`);

const colorPicker = document.getElementById('color-picker');

socket.addEventListener('open', () => {
    socket.send(JSON.stringify({
        tipo: "color",
        color: myColor
    }));
});

const GRID_SIZE = 20; // Unidad de medida

let nodoOrigen = null;
let flechas = [];

// 1. Crear el escenario
const stage = new Konva.Stage({
    container: 'canvas-container',
    width: window.innerWidth,
    height: window.innerHeight,
});

const layer = new Konva.Layer();

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

let jugadoresActuales = [];

function estaOcupado(nodo){
    return jugadoresActuales.some(user => user.objetc === nodo && nombreUsuario != user.nombre);
}

function actualizarPresencia(usuarios){

    jugadoresActuales = usuarios;

    const container = document.getElementById('user-presence');
    container.innerHTML = '';

    stage.find('.fondo-rect').forEach(rect => {
        rect.stroke('#333');
        rect.strokeWidth(2);
    });

    usuarios.forEach(user => {
        const iniciales = user.nombre.substring(0,2);
        const div = document.createElement('div');
        div.className = 'user-avatar';
        div.innerHTML = iniciales;
        div.title = user.nombre;
        div.style.background = user.color;

        if(user.objetc){
            const nodo = stage.findOne('#' + user.objetc);

            if(nodo){
                const rect = nodo.findOne('.fondo-rect');

                if(rect){
                    rect.stroke(user.color);
                    rect.strokeWidth(6);
                }
            }

            if(user.nombre == nombreUsuario){
                myNode = user.objetc;
            }
        }

        container.appendChild(div);
    });

    layer.batchDraw();
}

layer.add(trasformar);

stage.add(layer);

const trashZone = document.getElementById('trash-container');

// 2. Función para crear un cuadrado con bordes redondeados


function obtenerCentro(){
    const stageWidth = stage.width() + Math.random() * 400 -200;
    const stageHeight = stage.height() + Math.random() * 400 -200;

    const x = Math.round((stageWidth / 2) / GRID_SIZE) * GRID_SIZE;
    const y = Math.round((stageHeight / 2) / GRID_SIZE) * GRID_SIZE;

    return {x, y};
}

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

                flechas.forEach(flecha => {
                    if(flecha.origenId === nodo.id() || flecha.destinoId === nodo.id()){
                        actualizarPosicionFlecha(flecha);
                    }
                });

                layer.batchDraw();
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
                tipo: "cambiar_color",
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
            tipo: "seleccionar",
            objetc: null
        }));

        layer.draw();

        myNode = null;
    }
});

stage.on('mousemove', () => {

    if(!dibujandoConexion || !flechaTemporal) return;

    const posMouse = stage.getPointerPosition();

    const puntos = flechaTemporal.points();

    flechaTemporal.points([
        puntos[0], puntos[1],
        posMouse.x, posMouse.y
    ]);

    layer.batchDraw();

});

stage.on('mouseup', (e) => {
    if(dibujandoConexion && e.target === stage){
        cancelarDibujoConexion();
    }
});

function cancelarDibujoConexion(){
    dibujandoConexion = false;
    origenDatos.nodoId = null;
    origenDatos.puntoId = null;
    if(flechaTemporal){
        flechaTemporal.destroy();
        flechaTemporal = null;
        layer.batchDraw();
    }
}