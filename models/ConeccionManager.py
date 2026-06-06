from models import Diagram, User
from typing import Dict
from services import logger
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        self.rooms: Dict[str, Diagram] = {}

    def get_or_create_diagram(self, room_id : str):
        if room_id in self.rooms: 
            return self.rooms[room_id]
        
        new_room = Diagram(room_id)
        self.rooms[room_id] = new_room
        return new_room
    
    def del_room(self, room_id: str) -> str:

        response = f"Sala {room_id} no encontrada"

        if room_id in self.rooms:
            del self.rooms[room_id]
            response = f"Sala {room_id} eliminada"
    
        logger.info(response)
        return response
    
    async def broadcast_to_room(self, room_id : str, message: dict, exclude : WebSocket = None):
        if room_id in self.rooms:

            room = self.rooms[room_id]

            for ws in list(room.usuarios.keys()):
                if ws != exclude:
                    try:
                        await ws.send_json(message)
                    except Exception:
                        pass

    async def send_user_list(self, room_id : str, exclude : WebSocket = None):
        if room_id in self.rooms:
        
            message = {
                "tipo": "users",
                "usuarios": [user.model_dump() for user in self.rooms[room_id].usuarios.values()]
            }

            await self.broadcast_to_room(room_id, message, exclude)

    async def connect(self, user: WebSocket, nombre: str, room_id: str):

        await user.accept()

        room = self.get_or_create_diagram(room_id)

        room.add_user(User(
            nombre=nombre,
            color='black',
            x=0,
            y=0
        ), user)

        await user.send_json(room.obtener_estado_inicial())
        await self.send_user_list(room_id)


    async def disconnect(self, user: WebSocket, room_id : str):
        if room_id in self.rooms:

            room = self.rooms[room_id]
            room.del_user(user)

            if not room.usuarios and not room.conexiones and not room.nodos:
                del self.rooms[room_id]
                logger.info(f"sala {room_id} eliminada por estar vacia y sin contenido.")
            
            else:
                await self.send_user_list(room_id)