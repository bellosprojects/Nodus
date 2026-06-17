# models/ConeccionManager

from models import Diagram, User
from typing import Dict
from services import logger, load_room, load_nodes, load_connections
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        self.rooms: Dict[str, Diagram] = {}

    async def get_or_create_diagram(self, room_id : str) -> Diagram:

        if room_id in self.rooms: 
            return self.rooms[room_id]
        
        room_data = await load_room(room_id)
        if room_data:
            diagram = Diagram(room_id)
            diagram.nombre_proyecto = room_data["name"]
            diagram.propiedades = room_data["properties"] or {}
            diagram.nodos = await load_nodes(room_id)
            diagram.conexiones = await load_connections(room_id)
            self.rooms[room_id] = diagram
            logger.info(f"Sla {room_id} cargada desde DB ({len(diagram.nodos)} nodos, {len(diagram.conexiones)} conexiones)")
            return diagram
        
        diagram = Diagram(room_id)
        self.rooms[room_id] = diagram

        await diagram.persist()
        logger.info(f"Nueva sala {room_id} creada y persistida")
        return diagram
    
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

    async def connect(self, user: WebSocket, nombre: str, room_id: str, user_id: str, token: str):

        await user.accept()

        room = await self.get_or_create_diagram(room_id)

        new_user = User(
            nombre=nombre,
            color='black',
            x=0,
            y=0,
            user_id=user_id,
            token=token
        )

        room.add_user(new_user, user)

        await user.send_json(room.obtener_estado_inicial(user_id))
        await self.send_user_list(room_id)


    async def disconnect(self, user: WebSocket, room_id : str):
        if room_id in self.rooms:

            room = self.rooms[room_id]
            room.del_user(user)

            if not room.usuarios:
                await room.persist()
                del self.rooms[room_id]
                logger.info(f"Sala {room_id} descargada de RAM (guardada en DB)")
            else:
                await self.send_user_list(room_id)

manager = ConnectionManager()