import { stage, layer, socket, trasformar, GRID_SIZE, trashZone, colorPicker, myNode } from '../main.js';
import { obtenerColorTexto } from '../utils.js';
import { crearPuntosConexion } from './flecha.js';
import { estaOcupado } from '../main.js';
import { actualizarPosicionFlecha } from './flecha.js';
import { nombreUsuario } from '../socket.js';

let flechas = [];

export { flechas };

export let editandoTexto = false;

export function crearCuadrado(x, y, texto, id = null, debeEmitir = true, w = null, h = null, color = null) {

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
        fontFamily: 'Calibri'
    });
    
    label.y((rect.height() - label.height()) / 2);
    
    grupo.add(rect);
    grupo.add(label);

    crearPuntosConexion(grupo);
    
    grupo.on('dragstart', () => {
        colorPicker.style.display = 'none';

        trasformar.nodes([grupo]);
        layer.batchDraw();
    });

    grupo.on('click mousedown', (e) => {

        if(!estaOcupado(grupo.id())){
            trasformar.nodes([grupo]);

            mostrarPaleta(grupo);

            socket.send(JSON.stringify({
                tipo: "seleccionar_nodo",
                id: grupo.id()
            }));
        }

        layer.draw();
        e.cancelBubble = true;
    });

    grupo.on('transform', () => {

        flechas.forEach(flecha => {
            if(flecha.origenId === grupo.id() || flecha.destinoId === grupo.id()){
                actualizarPosicionFlecha(flecha);
            }
        });
    });

    grupo.on('transformend', () => {
        // Ajustar el tamaño del rectángulo al tamaño del grupo
        const scaleX = grupo.scaleX();
        const scaleY = grupo.scaleY();

        grupo.scaleX(1);
        grupo.scaleY(1);

        const nuevoAlto = Math.round((rect.height() * scaleY) / GRID_SIZE) * GRID_SIZE;
        const nuevoAncho = Math.round((rect.width() * scaleX) / GRID_SIZE) * GRID_SIZE;

        rect.height(Math.max(nuevoAlto, GRID_SIZE * 3));
        rect.width(Math.max(nuevoAncho, GRID_SIZE * 3));
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
            tipo: "redimensionar_nodo",
            id: grupo.id(),
            x: grupo.x(),
            y: grupo.y(),
            w: rect.width(),
            h: rect.height()
        };

        mostrarPaleta(grupo);

        if(socket.readyState === WebSocket.OPEN){
            socket.send(JSON.stringify(mensaje));
        }

        const puntos = grupo.find('.grupo-punto-conexion');
        puntos.forEach(pContenedor => {
            const area = pContenedor.findOne('.punto-conexion');
            const puntoId = area.id(); // 'top', 'right', etc.
            
            // Recalculamos posición relativa según el nuevo ancho/alto
            if(puntoId === 'top') pContenedor.position({ x: rect.width() * 0.5, y: 0 });
            if(puntoId === 'right') pContenedor.position({ x: rect.width(), y: rect.height() * 0.5 });
            if(puntoId === 'bottom') pContenedor.position({ x: rect.width() * 0.5, y: rect.height() });
            if(puntoId === 'left') pContenedor.position({ x: 0, y: rect.height() * 0.5 });
        });

        flechas.forEach(flecha => {
        if(flecha.origenId === grupo.id() || flecha.destinoId === grupo.id()){
            actualizarPosicionFlecha(flecha);
            }
        });

        trasformar.forceUpdate();
        layer.batchDraw();
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
            textarea.style.fontSize = '18px';
            textarea.style.padding = '10px';
            textarea.style.border = 'none';
            textarea.style.borderRadius = '8px';
            textarea.style.resize = 'none';
            textarea.style.overflow = 'hidden';
            textarea.style.outline = 'none';
            textarea.style.fontFamily = 'Calibri';
            textarea.style.margin = '0px';
            textarea.style.background = 'rgb(255, 255, 255)';
            textarea.style.textAlign = 'center';
            textarea.addEventListener('focus', () => {
                editandoTexto = true;
            });
            textarea.focus();


            let isSaving = false;

            function guardarCambios(){

                editandoTexto = false;

                if(isSaving) return;
                isSaving = true;

                label.text(textarea.value);

                const nuevoAlto = Math.max(label.height() + 20, GRID_SIZE * 2);

                rect.height(nuevoAlto);
                label.y((rect.height() - label.height()) / 2);

                label.show();

                textarea.remove();

                const mensaje = {
                    tipo: "cambiar_texto_nodo",
                    id: grupo.id(),
                    texto: label.text(),
                    h: rect.height()
                };

                if (socket.readyState === WebSocket.OPEN) {
                    socket.send(JSON.stringify(mensaje));
                }

                trasformar.nodes([grupo]);

                const puntos = grupo.find('.grupo-punto-conexion');
                puntos.forEach(pContenedor => {
                    const area = pContenedor.findOne('.punto-conexion');
                    const puntoId = area.id(); // 'top', 'right', etc.
                    
                    // Recalculamos posición relativa según el nuevo ancho/alto
                    if(puntoId === 'top') pContenedor.position({ x: rect.width() * 0.5, y: 0 });
                    if(puntoId === 'right') pContenedor.position({ x: rect.width(), y: rect.height() * 0.5 });
                    if(puntoId === 'bottom') pContenedor.position({ x: rect.width() * 0.5, y: rect.height() });
                    if(puntoId === 'left') pContenedor.position({ x: 0, y: rect.height() * 0.5 });
                });
                flechas.forEach(f => {
                    if(f.origenId === grupo.id() || f.destinoId === grupo.id()) {
                        actualizarPosicionFlecha(f);
                    }
                });
                trasformar.forceUpdate();
                layer.batchDraw();
            }

            textarea.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    e.stopPropagation();
                    guardarCambios();
                }
            });

            textarea.addEventListener('blur', guardarCambios);
        }
    });

    grupo.on('mouseover', () => {
        if(estaOcupado(grupo.id())){
            document.body.style.cursor = 'not-allowed';
        }
    });

    grupo.on('mouseout', () => {
        document.body.style.cursor = 'default';
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
        }
        else{
            grupo.draggable(true);
        }
    });

    grupo.on('dragmove', () => {

        const pos = stage.getPointerPosition();

        if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                tipo: "mover_cursor",
                x: pos.x,
                y: pos.y,
                nombre: nombreUsuario,
            }));
        }

        if(
            pos && pos.x < 10 && pos.y > window.innerHeight - 160
        ){
            trashZone.classList.add('drag-over');
        }else{
            trashZone.classList.remove('drag-over');
        }

        const mensaje = {
            tipo: "mover_nodo",
            id: grupo.id(),
            x: grupo.x(),
            y: grupo.y()
        };

        if (socket.readyState === WebSocket.OPEN){
            socket.send(JSON.stringify(mensaje));
        }

        flechas.forEach(flecha => {
            if(flecha.origenId === grupo.id() || flecha.destinoId === grupo.id()){
                actualizarPosicionFlecha(flecha);
            }
        });
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

            flechas.forEach(flecha => {
                if(flecha.origenId === grupo.id() || flecha.destinoId === grupo.id()){
                    actualizarPosicionFlecha(flecha);
                }
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
            tipo: "nuevo_nodo",
            nodo: {
                id: newId,
                x: x,
                y: y,
                w: GRID_SIZE * 5,
                h: GRID_SIZE * 3,
                texto: texto,
                color: rect.fill()
            }
         };
         socket.send(JSON.stringify(mensaje));
    }
}

export function eliminarNodoLocalYRemoto(nodo){
    const idDelete = nodo.id();

    eliminarConexionesdelNodo(idDelete);

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

export function eliminarConexionesdelNodo(nodoID){
    const conexionesAEliminar = flechas.filter(flecha => flecha.origenId === nodoID || flecha.destinoId === nodoID);

    conexionesAEliminar.forEach(flecha => {
        if(flecha.linea){
            flecha.linea.destroy();
        }
    });

    flechas = flechas.filter(flecha => flecha.origenId !== nodoID && flecha.destinoId !== nodoID);

    layer.batchDraw();
}

export function mostrarPaleta(nodo) {

    if (estaOcupado(nodo.id())) return;

    const stageBox = stage.container().getBoundingClientRect();
    colorPicker.style.display = 'flex';
    colorPicker.style.top = (stageBox.top + nodo.y() - 100) + 'px';
    colorPicker.style.left = (stageBox.left + nodo.x() + 30) + 'px';
    
    // Guardar referencia al nodo actual en la paleta
    colorPicker.dataset.nodoTarget = nodo.id();
}

export function actualizarPuntosyFlechasDelNodo(nodoID){

    const nodo = stage.findOne('#' + nodoID);
    if(!nodo) return;

    const puntos = nodo.find('.grupo-punto-conexion');
    puntos.forEach(pContenedor => {
        const area = pContenedor.findOne('.punto-conexion');
        const puntoId = area.id(); // 'top', 'right', etc.

        const rect = nodo.findOne('.fondo-rect');
        // Recalculamos posición relativa según el nuevo ancho/alto
        if(puntoId === 'top') pContenedor.position({ x: rect.width() * 0.5, y: 0 });
        if(puntoId === 'right') pContenedor.position({ x: rect.width(), y: rect.height() * 0.5 });
        if(puntoId === 'bottom') pContenedor.position({ x: rect.width() * 0.5, y: rect.height() });
        if(puntoId === 'left') pContenedor.position({ x: 0, y: rect.height() * 0.5 });
    }
    );
    flechas.forEach(flecha => {
        if(flecha.origenId === nodo.id() || flecha.destinoId === nodo.id()){
            actualizarPosicionFlecha(flecha);
        }
    }
    );
    trasformar.forceUpdate();
    layer.batchDraw();
}