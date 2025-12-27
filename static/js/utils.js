import { stage, GRID_SIZE, layerPresencia, jugadoresActuales } from './main.js';


export function obtenerColorTexto(colorHex){


    if(colorHex === 'white') return 'black';
    if(colorHex === 'black') return 'white';

    // Convertir el color hexadecimal a RGB
    const hex = colorHex.replace('#', '');

    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // Calcular el brillo percibido
    const brightness = (r * .299 + g * .587 + b * .114) / 255;

    return brightness > 0.5 ? 'black' : 'white';
}

export function calcularPuntos(inicio, fin, orientacion = 'auto'){

    const dx = fin.x - inicio.x;
    const dy = fin.y - inicio.y;

    const offsetX = dx / 2;
    const offsetY = dy / 2;

    if(orientacion === 'auto'){
        if(Math.abs(dx) < Math.abs(dy)){
            orientacion = 'vertical';
        } else {
            orientacion = 'horizontal';
        }
    }

    if(orientacion === 'vertical'){

        return [
            inicio.x, inicio.y,
            inicio.x, inicio.y + offsetY,
            fin.x, fin.y - offsetY,
            fin.x, fin.y
        ]
    }

    return [
        inicio.x, inicio.y,
        inicio.x + offsetX, inicio.y,
        fin.x - offsetX, fin.y,
        fin.x, fin.y
    ]
}

export function obtenerCentro(){
    const stageWidth = stage.width() + Math.random() * 400 -200;
    const stageHeight = stage.height() + Math.random() * 400 -200;

    const x = Math.round((stageWidth / 2) / GRID_SIZE) * GRID_SIZE;
    const y = Math.round((stageHeight / 2) / GRID_SIZE) * GRID_SIZE;

    return {x, y};
}

export const cursoresAjenos = {};
const tweensCursores = {};

export function actualizarCursorAjeno(data){

    const x = data.x;
    const y = data.y;
    const nombre = data.nombre || 'Usuario';
    const color = jugadoresActuales.find(user => user.nombre === nombre)?.color || '#000000';

    if(!cursoresAjenos[nombre]){

        const grupoCursor = new Konva.Group({
            id: 'cursor-' + nombre
        });

        const puntero = new Konva.Path({
            data: 'M0, 0 L0, 15 L4, 11 L8, 18 L10, 17 L6, 10 L12, 10 Z',
            fill: color,
            stroke: 'white',
            strokeWidth: 1,
            scale: {x: 1.2, y: 1.2},
        });

        const etiqueta = new Konva.Label({
            x: 15,
            y: 15,
            opacity: 0.75,
        });

        etiqueta.add(new Konva.Tag({
            fill: color,
            cornerRadius: 3,
        }));

        etiqueta.add(new Konva.Text({
            text: nombre,
            fontFamily: 'Calibri',
            fontSize: 12,
            padding: 4,
            fill: obtenerColorTexto(color),
        }));

        grupoCursor.add(puntero, etiqueta);
        layerPresencia.add(grupoCursor);
        cursoresAjenos[nombre] = grupoCursor;

    }

    const cursor = cursoresAjenos[nombre];

    if(tweensCursores[nombre]){
        tweensCursores[nombre].destroy();
    }

    tweensCursores[nombre] = new Konva.Tween({
        node: cursor,
        duration: 0.05,
        x: x,
        y: y,
        easing: Konva.Easings.Linear,
    });

    tweensCursores[nombre].play();
}

export function eliminarCursorAjeno(nombre){
    if(cursoresAjenos[nombre]){
        cursoresAjenos[nombre].destroy();
        delete cursoresAjenos[nombre];
        layerPresencia.draw();
    }
}