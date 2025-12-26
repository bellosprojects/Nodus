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

    crearPuntosConexion(grupo);
    
    grupo.on('dragstart', () => {

        colorPicker.style.display = 'none';

        trasformar.nodes([grupo]);
        layer.batchDraw();
    });

    grupo.on('click', (e) => {

        if(!estaOcupado(grupo.id())){
            trasformar.nodes([grupo]);

            mostrarPaleta(grupo);

            socket.send(JSON.stringify({
                tipo: "seleccionar",
                objetc: grupo.id()
            }));
        }

        layer.draw();
        e.cancelBubble = true;
    });

    grupo.on('transform', () => {

        flechas.forEach(flecha => {
            if(flecha.nodoInicio === grupo || flecha.nodoFin === grupo){
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

function eliminarNodoLocalYRemoto(nodo){
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

function eliminarConexionesdelNodo(nodoID){
    const conexionesAEliminar = flechas.filter(flecha => flecha.origenId === nodoID || flecha.destinoId === nodoID);

    conexionesAEliminar.forEach(flecha => {
        if(flecha.linea){
            flecha.linea.destroy();
        }
    });

    flechas = flechas.filter(flecha => flecha.origenId !== nodoID && flecha.destinoId !== nodoID);

    layer.batchDraw();
}

function mostrarPaleta(nodo) {

    if (estaOcupado(nodo.id())) return;

    const stageBox = stage.container().getBoundingClientRect();
    colorPicker.style.display = 'flex';
    colorPicker.style.top = (stageBox.top + nodo.y() - 100) + 'px';
    colorPicker.style.left = (stageBox.left + nodo.x() + 30) + 'px';
    
    // Guardar referencia al nodo actual en la paleta
    colorPicker.dataset.nodoTarget = nodo.id();
}