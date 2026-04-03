import { stage } from "../main.js";
import { obtenerColorTexto, ajustar } from "../utils.js";
import { actualizarPosicionFlecha } from "./flecha.js";
import { flechas } from "./nodo.js";

export function cambiar_color(nodo_id, new_color){
    const nodo = stage.findOne('#' + nodo_id);
    if(nodo){
        const rect = nodo.findOne('.fondo-rect');
        if(rect){
            rect.fill(new_color);
        }

        const label = nodo.findOne('.texto-nodo');
        if(label){
            label.fill(obtenerColorTexto(new_color));
        }
    }
}

export function mover_nodo(nodo_id, x, y){
    const nodo = stage.findOne('#' + nodo_id);
    if(nodo){
        if(x !== null){
            nodo.x(ajustar(x));
        }
        if(y !== null){
            nodo.y(ajustar(y));
        }

        flechas.forEach(flecha => {
            if(flecha.origenId === nodo_id || flecha.destinoId === nodo_id){
                actualizarPosicionFlecha(flecha);
            }
        });
    }
};

export function redimensionar_nodo(nodo_id){
    const nodo = stage.findOne('#' + nodo_id);
    if(nodo){
        const rect = nodo.findOne('.fondo-rect');
        if(rect){

            const scaleX = nodo.scaleX();
            const scaleY = nodo.scaleY();

            nodo.scaleX(1);
            nodo.scaleY(1);

            const nuevo_alto = ajustar(rect.height() * scaleY);
            const nuevo_ancho = ajustar(rect.width() * scaleX);

            rect.width(nuevo_ancho);
            rect.height(nuevo_alto);

            const label = nodo.findOne('.texto-nodo');

            if(label){
                label.width(nuevo_ancho);

                label.y((nuevo_alto - label.height()) / 2);
            }
        }
    }
}