const GRID_SIZE = 20; // Nuestra unidad de medida

let nodoOrigen = null;
const flechas = [];

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
});

layer.add(trasformar);

stage.add(layer);

const trashZone = document.getElementById('trash-container');

// 2. Función para crear un cuadrado con bordes redondeados
function crearCuadrado(x, y, texto) {
    const grupo = new Konva.Group({
        x: x,
        y: y,
        draggable: true,
    });

    const rect = new Konva.Rect({
        width: GRID_SIZE * 5,  // 100px
        height: GRID_SIZE * 3, // 60px
        fill: 'white',
        stroke: '#333',
        strokeWidth: 2,
        cornerRadius: 8,
        name: 'fondo-rect'
    });

    const label = new Konva.Text({
        text: texto,
        fontSize: 14,
        width: rect.width(),
        padding: 10,
        align: 'center',
        verticalAlign: 'middle',
        name: 'texto-nodo'
    });

    label.y((rect.height() - label.height()) / 2);

    grupo.add(rect);
    grupo.add(label);

    grupo.on('click', (e) => {

        if(e.evt.altKey){
            if(!nodoOrigen){
                nodoOrigen = grupo;
                rect.stroke('blue');
            }else {
                if (nodoOrigen !== grupo) {
                    crearConexion(nodoOrigen, grupo);
                }
                nodoOrigen.findOne('Rect').stroke('#333');
                nodoOrigen = null;
            }
        }else{
            trasformar.nodes([grupo]);
        }

        layer.draw();
        e.cancelBubble = true;
    });

    grupo.on('transform', () => {
        actualizarConexiones();
    });

    grupo.on('transformend', () => {
        // Ajustar el tamaño del rectángulo al tamaño del grupo
        const scaleX = grupo.scaleX();
        const scaleY = grupo.scaleY();

        grupo.scaleX(1);
        grupo.scaleY(1);

        const nuevoAlto = Math.round((rect.height() * scaleY) / GRID_SIZE) * GRID_SIZE;
        const nuevoAncho = Math.round((rect.width() * scaleX) / GRID_SIZE) * GRID_SIZE;

        rect.height(nuevoAlto);
        rect.width(nuevoAncho);
        label.width(rect.width());

        label.y((rect.height() - label.height()) / 2);

        grupo.position({
            x: Math.round(grupo.x() / GRID_SIZE) * GRID_SIZE,
            y: Math.round(grupo.y() / GRID_SIZE) * GRID_SIZE,
        });

        trasformar.nodes([grupo]);
        layer.draw();
    });

    grupo.on('dblclick', () => {
        label.hide();
        layer.draw();

        const stageBox = stage.container().getBoundingClientRect();
        const areaPos = {
            x: stageBox.left + grupo.x(), 
            y: stageBox.top + grupo.y()
        }

        const textarea = document.createElement('textarea');
        document.body.appendChild(textarea);

        textarea.value = label.text();
        textarea.style.position = 'absolute';
        textarea.style.top = areaPos.y + 'px';
        textarea.style.left = areaPos.x + 'px';
        textarea.style.width = rect.width() -20 + 'px';
        textarea.style.height = rect.height() - 20 + 'px';
        textarea.style.fontSize = rect.fontSize + 'px';
        textarea.style.padding = '10px';
        textarea.style.border = 'none';
        textarea.style.borderRadius = '8px';
        textarea.style.resize = 'none';
        textarea.style.overflow = 'hidden';
        textarea.style.outline = 'none';
        textarea.style.fontFamily = 'sans-serif';
        textarea.style.margin = '0px';
        textarea.style.background = 'rgb(255, 255, 255)';
        textarea.style.textAlign = 'center';
        textarea.focus();

        function guardarCambios(){
            label.text(textarea.value);

            const nuevoAlto = Math.max(label.height() + 20, GRID_SIZE * 2);

            rect.height(nuevoAlto);
            label.y((rect.height() - label.height()) / 2);

            label.show();
            document.body.removeChild(textarea);
            trasformar.nodes([grupo]);
            layer.draw();
        }

        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                guardarCambios();
            }
        });

        textarea.addEventListener('blur', guardarCambios);
    });

    grupo.on('dragmove', () => {
        const pos = stage.getPointerPosition();

        if(
            pos && pos.x < 80 && pos.y > window.innerHeight - 160
        ){
            trashZone.classList.add('drag-over');
        }else{
            trashZone.classList.remove('drag-over');
        }
        actualizarConexiones();
    });


    // --- LÓGICA DEL IMÁN (SNAPPING) ---
    grupo.on('dragend', () => {

        const pos = stage.getPointerPosition();

        if(
            pos && pos.x < 80 && pos.y > window.innerHeight - 160
        ){

            for(let i = flechas.length -1; i >=0; i--){
                if(flechas[i].nodoInicio === grupo || flechas[i].nodoFin === grupo){
                    flechas[i].destroy();
                    flechas.splice(i, 1);
                }
            }

            grupo.destroy();
            layer.draw();
            console.log("Eliminado");
        }else{
        // Redondeamos la posición a la rejilla de 20px
        grupo.position({
            x: Math.round(grupo.x() / GRID_SIZE) * GRID_SIZE,
            y: Math.round(grupo.y() / GRID_SIZE) * GRID_SIZE,
        });
    }
    trashZone.classList.remove('drag-over');
    layer.batchDraw(); // Refrescar lienzo
    });

    layer.add(grupo);
}

// 3. Probamos creando uno
crearCuadrado(40, 40, "Mi primer Cuadro");
layer.draw();

function obtenerCentro(){
    const stageWidth = stage.width() + Math.random() * 400 -200;
    const stageHeight = stage.height() + Math.random() * 400 -200;

    const x = Math.round((stageWidth / 2) / GRID_SIZE) * GRID_SIZE;
    const y = Math.round((stageHeight / 2) / GRID_SIZE) * GRID_SIZE;

    return {x, y};
}

function calcularPuntosOrtogonales(p1, p2){
    return [
        p1.x, p1.y,
        p2.x, p1.y,
        p2.x, p2.y
    ];
}

function crearConexion(origen, destino){
    const p1 = {
        x: origen.x() + origen.findOne('Rect').width() / 2,
        y: origen.y() + origen.findOne('Rect').height() / 2,
    };
    const p2 = {
        x: destino.x() + destino.findOne('Rect').width() / 2,
        y: destino.y() + destino.findOne('Rect').height() / 2, 
    }

    const flecha = new Konva.Arrow({
        points: calcularPuntosOrtogonales(p1, p2),
        pointerLength: 10,
        pointerWidth: 10,
        fill: '#666',
        stroke: '#666',
        strokeWidth: 3,
    });

    const textoFlecha = new Konva.Text({
        text: 'Texto',
        fontSize: 14,
        fill: '#999',
        fontStyle: 'italic',
        align: 'center',
    });

    flecha.nodoInicio = origen;
    flecha.nodoFin = destino;
    flecha.etiqueta = textoFlecha;

    textoFlecha.on('dblclick', () => {
        textoFlecha.hide();
        layer.draw();
        const stageBox = stage.container().getBoundingClientRect();
        const areaPos = {
            x: stageBox.left + (flecha.points()[0] + flecha.points()[2]) / 2,
            y: stageBox.top + (flecha.points()[1] + flecha.points()[3]) / 2
        }
        const textarea = document.createElement('textarea');
        document.body.appendChild(textarea);
        textarea.value = textoFlecha.text();
        textarea.style.position = 'absolute';
        textarea.style.top = areaPos.y + 'px';
        textarea.style.left = areaPos.x + 'px';
        textarea.style.fontSize = '14px';
        textarea.style.padding = '5px';
        textarea.style.border = 'none';
        textarea.style.resize = 'none';
        textarea.style.overflow = 'hidden';
        textarea.style.outline = 'none';
        textarea.style.fontFamily = 'sans-serif';
        textarea.style.margin = '0px';
        textarea.style.background = 'transparent';
        textarea.focus();
        function guardarCambios(){
            textoFlecha.text(textarea.value);
            textoFlecha.show();
            document.body.removeChild(textarea);
            layer.draw();
        }
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                guardarCambios();
            }
        });
        textarea.addEventListener('blur', guardarCambios);
    });

    layer.add(flecha, textoFlecha);
    flechas.push(flecha);
    flecha.moveToBottom();
    actualizarConexiones();
}

function actualizarConexiones(){
    flechas.forEach(flecha => {
        if(!flecha.nodoInicio || !flecha.nodoFin) return;

        const rectInicio = flecha.nodoInicio.findOne('Rect');
        const rectFin = flecha.nodoFin.findOne('Rect');

        if (!rectInicio || !rectFin) return;

        const p1 = {
            x: flecha.nodoInicio.x() + rectInicio.width() / 2,
            y: flecha.nodoInicio.y() + rectInicio.height() / 2,
        };

        const p2 = {
            x: flecha.nodoFin.x() + rectFin.width() / 2,
            y: flecha.nodoFin.y() + rectFin.height() / 2,
        };

        const puntos = calcularPuntosOrtogonales(p1, p2);
        flecha.points(puntos);

        if(flecha.etiqueta){
            flecha.etiqueta.position({
                x: puntos[2] + 10,
                y: puntos[3] - 20,
            });
        }
    });
    layer.batchDraw();
}

document.getElementById('add-rect-btn').addEventListener('click', () => {
    const centro = obtenerCentro();
    crearCuadrado(centro.x, centro.y, "Nuevo Cuadro");
    layer.draw();
});

window.addEventListener('resize', () => {
    stage.width(window.innerWidth - 160);
    stage.height(window.innerHeight);
});

stage.on('click', (e) => {
    if(e.target === stage){
        trasformar.nodes([]);
        layer.draw();
    }
});