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