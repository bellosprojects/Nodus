import { stage, GRID_SIZE } from './main.js';

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