from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi import WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from typing import Dict, Optional

app = FastAPI()

class NodusObject(BaseModel):
    id: str
    type: str
    x: float
    y: float
    w: float
    h: float
    text: str
    color: str

digram_state: Dict[str, dict] = {}
flechas = {}

class ConnectionManager:
    def __init__(self):
        self.active_connections = {}

    async def connect(self, websocket: WebSocket, nombre: str, color: str):
        await websocket.accept()
        self.active_connections[websocket] = {
            "nombre": nombre,
            "color": color,
            "objetc": None
        }

        estado_inicial = {
            "tipo": "estado_inicial",
            "objetos": list(digram_state.values()),
            "flechas": list(flechas.values())
        }

        await websocket.send_json(estado_inicial)

        await self.broadcast_users({
            "tipo": "users",
            "usuarios": list(self.active_connections.values())
        })

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            del self.active_connections[websocket]

    async def broadcast_users(self, message: dict = None, sender: Optional[WebSocket] = None):
        import json

        if not message:
            message = {
            "tipo": "users",
            "usuarios": list(self.active_connections.values())
        }

        for connection in self.active_connections.keys():
            if connection != sender:
                await connection.send_text(json.dumps(message))

manager = ConnectionManager()

@app.websocket("/ws/{nombre}")
async def websocket_endpoint(websocket: WebSocket, nombre: str):


    await manager.connect(websocket, nombre, 'black')
    try:
        while True:
            data = await websocket.receive_json()

            if data['tipo'] == "crear_cuadrado":
                digram_state[data["id"]] = data
                await manager.broadcast_users(data, websocket)

            elif data['tipo'] == "mover_nodo":
                if data['id'] in digram_state:
                    digram_state[data["id"]]["x"] = data["x"]
                    digram_state[data["id"]]["y"] = data["y"]
                await manager.broadcast_users(data, websocket)

            elif data['tipo'] == "eliminar_nodo":
                nodo_id = data["id"]

                if nodo_id in digram_state:
                    del digram_state[nodo_id]

                await manager.broadcast_users(data,  websocket)

            elif data['tipo'] == "resize_nodo":
                nodo_id = data['id']
                if nodo_id in digram_state:
                    digram_state[nodo_id]["w"] = data["w"]
                    digram_state[nodo_id]["h"] = data["h"]
                    digram_state[nodo_id]["x"] = data["x"]
                    digram_state[nodo_id]["y"] = data["y"]

                await manager.broadcast_users(data, websocket)

            elif data['tipo'] == "cambiar_texto":
                nodo_id = data["id"]
                if nodo_id in digram_state:
                    digram_state[nodo_id]["text"] = data["text"]
                    digram_state[nodo_id]["h"] = data["h"]

                await manager.broadcast_users(data, websocket)

            elif data['tipo'] == "color":
                if websocket in manager.active_connections:
                    manager.active_connections[websocket]["color"] = data['color']
                await manager.broadcast_users()

            elif data['tipo'] == "seleccionar":

                nodo = data["objetc"]

                if not nodo:
                    manager.active_connections[websocket]["objetc"] = None
                    await manager.broadcast_users()
                else:

                    ocupado_por = None

                    for ws in manager.active_connections.keys():
                        if manager.active_connections[ws]['objetc'] == nodo and ws != websocket:
                            ocupado_por = manager.active_connections[ws]["nombre"]
                            break

                    if ocupado_por and object is not None:
                        await websocket.send_json({
                            "tipo": "nodo_bloqueado",
                            "id": nodo,
                            "por": ocupado_por
                        })

                    else:
                        manager.active_connections[websocket]["objetc"] = nodo
                        await manager.broadcast_users()

            elif data['tipo'] == "cambiar_color":
                nodo_id = data["id"]
                if nodo_id in digram_state:
                    digram_state[nodo_id]["color"] = data["color"]
                await manager.broadcast_users(data, websocket)

            elif data['tipo'] == "traer_al_frente":
                await manager.broadcast_users(data, websocket)

            elif data['tipo'] == 'crear_conexion':
                flechas[data['id']] = data
                await manager.broadcast_users(data, websocket)

            elif data['tipo'] == 'eliminar_conexion':
                fleja_id = data['id']
                if fleja_id in flechas:
                    del flechas[fleja_id]
                await manager.broadcast_users(data, websocket)

            elif data['tipo'] == 'mover_cursor':
                manager.active_connections[websocket]['x'] = data['x']
                manager.active_connections[websocket]['y'] = data['y']
                await manager.broadcast_users(data, websocket)

    except WebSocketDisconnect:
        manager.disconnect(websocket)
        await manager.broadcast_users()

app.mount("/", StaticFiles(directory="static", html=True), name="static")

