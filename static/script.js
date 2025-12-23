const GRID_SIZE = 20; // Nuestra unidad de medida

// 1. Crear el escenario
const stage = new Konva.Stage({
    container: 'canvas-container',
    width: window.innerWidth,
    height: window.innerHeight,
});

const layer = new Konva.Layer();
stage.add(layer);

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
        cornerRadius: 8,       // Bordes redondeados
    });

    const label = new Konva.Text({
        text: texto,
        fontSize: 14,
        width: rect.width(),
        padding: 10,
        align: 'center',
        verticalAlign: 'middle'
    });

    grupo.add(rect);
    grupo.add(label);

    // --- LÓGICA DEL IMÁN (SNAPPING) ---
    grupo.on('dragend', () => {
        // Redondeamos la posición a la rejilla de 20px
        grupo.position({
            x: Math.round(grupo.x() / GRID_SIZE) * GRID_SIZE,
            y: Math.round(grupo.y() / GRID_SIZE) * GRID_SIZE,
        });
        layer.batchDraw(); // Refrescar lienzo
    });

    layer.add(grupo);
}

// 3. Probamos creando uno
crearCuadrado(40, 40, "Mi primer Cuadro");
layer.draw();