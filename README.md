# 🎨 Software de Diagramación Prototipo
Un editor de diagramas ligero inspirado en Figma y Lucidchart, construido con **FastAPI** y **Konva.js**.

---

## 🚀 Características
- **Lienzo Infinito con Dot Grid:** Fondo de puntos estilo Figma para una guía visual limpia.
- **Sistema de Imán (Snapping):** Movimiento basado en unidades de cuadrícula para alineación perfecta.
- **Elementos Personalizables:** - Cuadrados con bordes redondeados y texto dinámico.
  - Flechas ortogonales (horizontales/verticales) con etiquetas de mensaje.
- **Backend Robusto:** Servidor FastAPI preparado para comunicación en tiempo real vía WebSockets.

## 🛠️ Stack Tecnológico
- **Frontend:** HTML5 Canvas (Konva.js), JavaScript (ES6+), CSS3.
- **Backend:** [Python 3.10+](https://www.python.org/) con [FastAPI](https://fastapi.tiangolo.com/).
- **Despliegue:** [Render](https://render.com/) (Web Service).
- **Monitoreo:** [UptimeRobot](https://uptimerobot.com/) para mantenimiento de instancia activa.

## 📁 Estructura del Proyecto
```text
.
├── main.py              # Servidor y API (FastAPI)
├── requirements.txt     # Dependencias del proyecto
├── .gitignore           # Archivos ignorados por Git
└── static/              # Archivos del Frontend
    ├── index.html       # Estructura del lienzo
    ├── script.js        # Lógica de dibujo y snapping
    └── style.css        # Diseño y estilos visuales
