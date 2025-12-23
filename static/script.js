const GRID_SIZE = 20; // Nuestra unidad de medida

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
        trasformar.nodes([grupo]);
        layer.draw();
        e.cancelBubble = true;
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
        trasformar.nodes([grupo]);
        layer.draw();
    });

    grupo.on('dblclick', () => {
        label.hide();
        layer.draw();

        const stageBox = stage.container().getBoundingClientRect();
        const areaPos = {
            x: stageBox.left + grupo.x(), // Ajuste por el margen lateral
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
    });


    // --- LÓGICA DEL IMÁN (SNAPPING) ---
    grupo.on('dragend', () => {

        const pos = stage.getPointerPosition();

        if(
            pos && pos.x < 80 && pos.y > window.innerHeight - 160
        ){
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
    const stageWidth = stage.width();
    const stageHeight = stage.height();

    const x = Math.round((stageWidth / 2) / GRID_SIZE) * GRID_SIZE;
    const y = Math.round((stageHeight / 2) / GRID_SIZE) * GRID_SIZE;

    return {x, y};
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