from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi import WebSocket, WebSocketDisconnect

app = FastAPI()

class ConnectionManager:
    def __init__(self):
        self.active_connections = {}

    async def connect(self, websocket: WebSocket, nombre: str):
        await websocket.accept()
        self.active_connections[websocket] = nombre
        await self.broadcast_users()

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            del self.active_connections[websocket]

    async def broadcast_users(self):
        users = list(self.active_connections.values())
        mensaje = {"type": "users", "usuarios": users}
        import json
        for connection in self.active_connections.keys():
            await connection.send_text(json.dumps(mensaje))

manager = ConnectionManager()

@app.websocket("/ws/{nombre}")
async def websocket_endpoint(websocket: WebSocket, nombre: str):
    await manager.connect(websocket, nombre)
    try:
        while True:
            data = await websocket.receive_text()
            # Aquí puedes manejar los mensajes recibidos si es necesario
    except:
        manager.disconnect(websocket)
        await manager.broadcast_users()

app.mount("/", StaticFiles(directory="static", html=True), name="static")

