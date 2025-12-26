const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

let nombreUsuario = prompt("Ingresa tu nombre de usuario:") || "Anonimo";
const myColor = `rgb(${Math.random()*50 + 70},${Math.random()*80 + 30},${Math.random()*120})`;
let myNode = null;

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

socket.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if(data.tipo === "users"){
        actualizarPresencia(data.usuarios);    
    }

    if(data.tipo === "estado_inicial"){
        data.objetos.forEach(obj => {
            if(obj.type === "square"){
                crearCuadrado(obj.x, obj.y, obj.text, obj.id, false, obj.w, obj.h, obj.color);
            }
        });
    }

    if(data.tipo === "crear_cuadrado"){
        crearCuadrado(data.x,data.y,data.text,data.id,false,data.w,data.h,data.color);
    }

    if(data.tipo === "mover_nodo"){
        const nodoAjeno = stage.findOne('#' + data.id);

        if(nodoAjeno){
            nodoAjeno.position({
                x: data.x,
                y: data.y
            });
            
            actualizarConexiones();
            layer.batchDraw();
        }
    }

    if(data.tipo === "eliminar_nodo"){
        const nodoDelete = stage.findOne('#' + data.id);
        if(nodoDelete){
            for(let i = flechas.length -1; i>=0 ; i--){
                if(flechas[i].nodoInicio === nodoDelete || flechas[i].nodoFin === nodoDelete){
                    flechas[i].destroy();
                    flechas.splice(i, 1);
                }
            }

            nodoDelete.destroy();

            if(trasformar.nodes().includes(nodoDelete)){
                trasformar.nodes([]);
            }

            actualizarConexiones();
            layer.batchDraw();
        }
    }

    if(data.tipo === "resize_nodo"){
        const nodo = stage.findOne('#' + data.id);
        if(nodo){
            const rect = nodo.findOne('.fondo-rect');
            const label = nodo.findOne('.texto-nodo');

            nodo.position({
                x: data.x,
                y: data.y
            });

            if(rect){
                rect.width(data.w);
                rect.height(data.h);
            }

            if(label){
                label.width(data.w);
                label.y((data.h - label.height()) / 2);
            }

            actualizarConexiones();
            layer.batchDraw();
        }
    }

    if(data.tipo === "cambiar_texto"){
        const nodo = stage.findOne('#' + data.id);
        if(nodo){
            const rect = nodo.findOne('.fondo-rect');
            const label = nodo.findOne('.texto-nodo');

            if(label){
                label.text(data.text);

                if(rect){
                    rect.height(data.h);
                    label.y((rect.height() - label.height()) / 2);
                }
            }

            actualizarConexiones();
            layer.batchDraw();
        }
    }

    if(data.tipo === "nodo_bloqueado"){
        trasformar.nodes([]);
        layer.draw();
        console.warn(`Este nodo ya esta siendo ocupado por ${data.por}`)
    }

    if(data.tipo === "cambiar_color"){
        const nodo = stage.findOne('#' + data.id);
        if(nodo){
            const rect = nodo.findOne('.fondo-rect');
            if(rect) rect.fill(data.color);
            
            const label = nodo.findOne('.texto-nodo');
            if(label){
                label.fill(obtenerColorTexto(data.color));
            }
            layer.batchDraw();
        }
    }

    if(data.tipo === "traer_al_frente"){
        const nodo = stage.findOne('#' + data.id);
        if(nodo){
            nodo.moveToTop();
            layer.batchDraw();
        }
    }
};

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
function crearCuadrado(x, y, texto, id = null, debeEmitir = true, w = null, h = null, color = null) {

    const newId = id || "nodo-" + Date.now();
    
    const grupo = new Konva.Group({
        x: x,
        y: y,
        draggable: true,
        id: newId
    });
    
    const rect = new Konva.Rect({
        width: w || (GRID_SIZE * 5),  // 100px
        height: h || (GRID_SIZE * 3), // 60px
        fill: color || 'white',
        stroke:  '#333',
        strokeWidth: 2,
        cornerRadius: 8,
        name: 'fondo-rect'
    });
    
    const label = new Konva.Text({
        text: texto,
        fontSize: 18,
        width: rect.width(),
        padding: 10,
        align: 'center',
        verticalAlign: 'middle',
        name: 'texto-nodo',
        fill: obtenerColorTexto(rect.fill()),
        wrap: 'word',
        listening: false,
    });
    
    label.y((rect.height() - label.height()) / 2);
    
    grupo.add(rect);
    grupo.add(label);
    
    grupo.on('dragstart', () => {

        colorPicker.style.display = 'none';

        trasformar.nodes([grupo]);
        layer.batchDraw();
    });

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

            if(!estaOcupado(grupo.id())){
                trasformar.nodes([grupo]);

                mostrarPaleta(grupo);

                socket.send(JSON.stringify({
                    tipo: "seleccionar",
                    objetc: grupo.id()
                }));
            }
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

        rect.height(Math.max(nuevoAlto, GRID_SIZE * 2));
        rect.width(Math.max(nuevoAncho, GRID_SIZE * 2));
        label.width(rect.width());

        label.y((rect.height() - label.height()) / 2);

        const newX = Math.round(grupo.x() / GRID_SIZE) * GRID_SIZE;
        const newY = Math.round(grupo.y() / GRID_SIZE) * GRID_SIZE

        grupo.position({
            x: newX,
            y: newY,
        });

        trasformar.nodes([grupo]);

        const mensaje = {
            tipo: "resize_nodo",
            id: grupo.id(),
            x: grupo.x(),
            y: grupo.y(),
            w: rect.width(),
            h: rect.height()
        };

        if(socket.readyState === WebSocket.OPEN){
            socket.send(JSON.stringify(mensaje));
        }

        layer.draw();
    });

    grupo.on('dblclick', () => {

        if(myNode == grupo.id()){

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

                const mensaje = {
                    tipo: "cambiar_texto",
                    id: grupo.id(),
                    text: label.text(),
                    h: rect.height()
                };

                if (socket.readyState === WebSocket.OPEN) {
                    socket.send(JSON.stringify(mensaje));
                }

                trasformar.nodes([grupo]);
                layer.draw();
            }

            textarea.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    guardarCambios();
                }
            });

            textarea.addEventListener('blur', guardarCambios);
        }
    });


    grupo.on('mousedown', () => {

        grupo.moveToTop();
        trasformar.moveToTop();
        layer.batchDraw();

        socket.send(JSON.stringify({
            tipo: "traer_al_frente",
            id: grupo.id()
        }));

        if(estaOcupado(grupo.id())){
            grupo.draggable(false);
        }else{
            grupo.draggable(true);

            socket.send(JSON.stringify({
            tipo: "seleccionar",
            objetc: grupo.id()
        }));
        }
    });

    grupo.on('dragmove', () => {
        const pos = stage.getPointerPosition();

        if(
            pos && pos.x < 10 && pos.y > window.innerHeight - 160
        ){
            trashZone.classList.add('drag-over');
        }else{
            trashZone.classList.remove('drag-over');
        }
        actualizarConexiones();

        const mensaje = {
            tipo: "mover_nodo",
            id: grupo.id(),
            x: grupo.x(),
            y: grupo.y()
        };

        if (socket.readyState === WebSocket.OPEN){
            socket.send(JSON.stringify(mensaje));
        }
    });


    // --- LÓGICA DEL IMÁN (SNAPPING) ---
    grupo.on('dragend', () => { 

        const pos = stage.getPointerPosition();

        if(pos && pos.x < 10 && pos.y > window.innerHeight - 160){
            colorPicker.style.display = 'none';
            eliminarNodoLocalYRemoto(grupo);
        } 
        
        else {

            const newX = Math.round(grupo.x() / GRID_SIZE) * GRID_SIZE, newY = Math.round(grupo.y() / GRID_SIZE) * GRID_SIZE;
            // Redondeamos la posición a la rejilla de 20px
            grupo.position({
                x: newX,
                y: newY,
            });

            if(!estaOcupado(grupo.id()))
                mostrarPaleta(grupo);

            const mensaje = {
                tipo: "mover_nodo",
                id: grupo.id(),
                x: newX,
                y: newY
            };

            if (socket.readyState === WebSocket.OPEN){
                socket.send(JSON.stringify(mensaje));
            }
        }
        trashZone.classList.remove('drag-over');
        layer.batchDraw(); // Refrescar lienzo
    });

    layer.add(grupo);

    if(debeEmitir){
         const mensaje = {
            tipo: "crear_cuadrado",
            id: newId,
            type: "square",
            x: x,
            y: y,
            w: GRID_SIZE * 5,
            h: GRID_SIZE * 3,
            text: texto
         };
         socket.send(JSON.stringify(mensaje));
    }
}

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

function eliminarNodoLocalYRemoto(nodo){
    const idDelete = nodo.id();

    for(let i = flechas.length -1; i >=0; i--){
        if(flechas[i].nodoInicio === nodo || flechas[i].nodoFin === nodo){
            flechas[i].destroy();
            flechas.splice(i, 1);
        }
    }

    nodo.destroy();
    trasformar.nodes([]);
    layer.draw();

    if(socket.readyState === WebSocket.OPEN){
        socket.send(JSON.stringify({
            tipo: "eliminar_nodo",
            id: idDelete
        }));
    }
}

function mostrarPaleta(nodo) {

    if (estaOcupado(nodo.id())) return;

    const stageBox = stage.container().getBoundingClientRect();
    colorPicker.style.display = 'flex';
    colorPicker.style.top = (stageBox.top + nodo.y() - 70) + 'px';
    colorPicker.style.left = (stageBox.left + nodo.x() + 20) + 'px';
    
    // Guardar referencia al nodo actual en la paleta
    colorPicker.dataset.nodoTarget = nodo.id();
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
                actualizarConexiones();
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