import { actualizarPresencia } from './main.js';
import { crearCuadrado } from './componentes/nodo.js';
import { stage, layer } from './main.js';
import { obtenerColorTexto, actualizarCursorAjeno } from './utils.js';
import { trasformar } from './main.js';
import { eliminarConexionesdelNodo, actualizarPuntosyFlechasDelNodo } from './componentes/nodo.js';
import { crearConexion, eliminarConexionPorId } from './componentes/flecha.js';

function gestionarIDDiagrama(){
    const urlParams = new URLSearchParams(window.location.search);
    let diagramaId = urlParams.get('d');
    
    if(!diagramaId || diagramaId.length !== 10){
        diagramaId = Math.random().toString(36).substring(2,12);
        
        const newUrl = `${window.location.origin}${window.location.pathname}?d=${diagramaId}`;
        window.history.replaceState({path: newUrl}, '', newUrl);
    }
    
    return diagramaId;
}

const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
export const nombreUsuario = prompt("Ingresa tu nombre de usuario:") || "Anonimo";
export const socket = new WebSocket(`${protocol}//${window.location.host}/ws/${gestionarIDDiagrama()}/${nombreUsuario}`);

function generarColor(){
    const rojo = Math.random()*50 + 70;
    const verde = rojo * Math.random() + 40 + Math.random()*120;
    const azul = Math.max(20, verde * Math.random() - 30);

    return `rgb(${rojo},${verde},${azul}})`;
}

export const myColor = generarColor();


export function init_socket(){

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if(data.tipo === "users"){
            actualizarPresencia(data.usuarios);    
        }

        if(data.tipo === "estado_inicial"){
            data.nodos.forEach(obj => {
                    crearCuadrado(obj.x, obj.y, obj.texto, obj.id, false, obj.w, obj.h, obj.color);
            });

            data.conexiones.forEach(flecha => {
                crearConexion(
                    flecha.origenId,
                    flecha.origenPuntoId,
                    flecha.destinoId,
                    flecha.destinoPuntoId,
                    flecha.id,
                    false
                );
            });
        }

        if(data.tipo === "nuevo_nodo"){
            const nodo = data.nodo;
            crearCuadrado(nodo.x,
                nodo.y,
                nodo.texto,
                nodo.id,
                false,
                nodo.w,
                nodo.h,
                nodo.color
            );
        }

        if(data.tipo === "mover_nodo"){
            const nodoAjeno = stage.findOne('#' + data.id);

            if(nodoAjeno){

                nodoAjeno.position({
                    x: data.x,
                    y: data.y
                });
                
                actualizarPuntosyFlechasDelNodo(data.id);
                layer.batchDraw();
            }
        }

        if(data.tipo === "eliminar_nodo"){
            const nodoDelete = stage.findOne('#' + data.id);
            if(nodoDelete){
                eliminarConexionesdelNodo(data.id);

                nodoDelete.destroy();

                if(trasformar.nodes().includes(nodoDelete)){
                    trasformar.nodes([]);
                }

                layer.batchDraw();
            }
        }

        if(data.tipo === "redimensionar_nodo"){
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

                actualizarPuntosyFlechasDelNodo(data.id);

                layer.batchDraw();
            }
        }

        if(data.tipo === "cambiar_texto_nodo"){
            const nodo = stage.findOne('#' + data.id);
            if(nodo){
                const rect = nodo.findOne('.fondo-rect');
                const label = nodo.findOne('.texto-nodo');

                if(label){
                    label.text(data.texto);

                    if(rect){
                        rect.height(data.h);
                        label.y((rect.height() - label.height()) / 2);
                    }
                }

                actualizarPuntosyFlechasDelNodo(data.id);

                layer.batchDraw();
            }
        }

        if(data.tipo === "nodo_bloqueado"){
            trasformar.nodes([]);
            layer.draw();
            console.warn(`Este nodo ya esta siendo ocupado por ${data.por}`)
        }

        if(data.tipo === "cambiar_color_nodo"){
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

        if(data.tipo === "crear_conexion"){
            const conexion = data.conexion;
            crearConexion(
                conexion.origenId,
                conexion.origenPuntoId,
                conexion.destinoId,
                conexion.destinoPuntoId,
                conexion.id,
                false
            );
        }

        if(data.tipo === "eliminar_conexion"){
            eliminarConexionPorId(data.id);
        }

        if(data.tipo === "mover_cursor"){
            actualizarCursorAjeno(data);
        }

    };

}