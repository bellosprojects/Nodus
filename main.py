from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi import WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from typing import Dict
from logger_config import setup_logger

app = FastAPI()
log = setup_logger("SERVER")

class Nodo(BaseModel):
    id: str
    x: float
    y: float
    w: float
    h: float
    texto: str
    color: str
    opacidad: float
    radius: float
    pin: bool

class Conexion(BaseModel):
    id: str
    origenId: str
    destinoId: str
    style: int

class User(BaseModel):
    nombre: str
    color: str
    x: float
    y: float
    objeto: str = None

class Diagram:
    """
    Representa un diagrama colaborativo que contiene nodos, conexiones y usuarios.
    Atributos
    ---
        id (str): identificador único del diagrama.
        nombre (str): Nombre del Proyecto
        nodos (Dict[str, Nodo]): Diccionario de nodos en el diagrama, codificado por ID de nodo.
        conexiones (Dict[str, Conexion]): Diccionario de conexiones entre nodos, codificado por ID de conexión.
        usuarios (Dict[WebSocket, User]): Diccionario de usuarios conectados al diagrama, codificados por WebSocket.
    Métodos
    ---
        add_nodo(nodo: Nodo, id_: str):
            Agrega un nodo al diagrama.
        add_conexion(conexion: Conexion, id_: str):
            Agrega una conexión al diagrama.
        add_user(usuario: Usuario, id_: WebSocket):
            Agrega un usuario al diagrama.
        del_nodo(id_: cadena):
            Elimina un nodo y sus conexiones relacionadas del diagrama.
        del_conexion(id_: str):
            Elimina una conexión del diagrama.
        del_user(usuario: WebSocket):
            Elimina un usuario del diagrama.
        asignar_color_user(usuario: WebSocket, color: str):
            Asigna un color a un usuario.
        mover_nodo(id_: str, x: int, y: int):
            Mueve un nodo a una nueva posición.
        redimensionar_nodo(id_: str, x: int, y: int, w: int, h: int):
            Cambia el tamaño y mueve un nodo.
        cambiar_color_nodo(id_: str, color: str):
            Cambia el color de un nodo.
        cambiar_texto_nodo(id_: str, texto: str, h: int):
            Cambia el texto y la altura de un nodo.
        seleccionar_nodo(nodoId: str, usuario: WebSocket):
            Selecciona o anula la selección de un nodo para un usuario.
        esta_ocupado(nodoId: str, userOrder: WebSocket) -> bool:
            Comprueba si un nodo está ocupado por otro usuario.
        propietario(nodoId: str) -> Opcional[str]:
            Devuelve el nombre del usuario propietario del nodo, si corresponde.
        mover_cursor(usuario: WebSocket, x: flotante, y: flotante):
            Mueve la posición del cursor para un usuario.
        obtener_estado_inicial() -> dict:
            Devuelve el estado inicial del diagrama, incluidos los nodos y las conexiones.
    """
    def __init__(self, id_):
        self.id = id_
        self.nombre_proyecto: str = "New Project"
        self.nodos: Dict[str, Nodo] = {}
        self.conexiones: Dict[str, Conexion] = {}
        self.usuarios: Dict[WebSocket, User] = {}

    def cambiar_nombre(self, newNombre: str):
        self.nombre_proyecto = newNombre

    def add_nodo(self, nodo: Nodo, id_: str):
        self.nodos[id_] = nodo

    def add_conexion(self, conexion: Conexion, id_ : str):
        self.conexiones[id_] = conexion

    def add_user(self, user: User, id_: WebSocket):
        self.usuarios[id_] = user

    def del_nodo(self, id_: str):
        if id_ in self.nodos:
            del self.nodos[id_]

        conx_to_del = []

        for conx in self.conexiones.values():
            if conx.destinoId == id_ or conx.origenId == id_:
                conx_to_del.append(conx)

        for conx in conx_to_del:
            self.del_conexion(conx.id)

    def del_conexion(self, id_: str):
        if id_ in self.conexiones:
            del self.conexiones[id_]

    def del_user(self, user: WebSocket):
        if user in self.usuarios:
            del self.usuarios[user]

    def asignar_color_user(self, user : WebSocket, color : str):
        if user in self.usuarios:
            self.usuarios[user].color = color

    def mover_nodo(self, id_ : str, x : int, y : int):
        if id_ in self.nodos:
            self.nodos[id_].x = x
            self.nodos[id_].y = y

    def redimensionar_nodo(self, id_ : str, x: int, y : int, w: int, h : int):
        if id_ in self.nodos:
            self.nodos[id_].x = x
            self.nodos[id_].y = y
            self.nodos[id_].w = w
            self.nodos[id_].h = h
        
    def cambiar_color_nodo(self, id_ : str, color : str):
        if id_ in self.nodos:
            self.nodos[id_].color = color

    def cambiar_texto_nodo(self, id_ : str, texto: str):
        if id_ in self.nodos:
            self.nodos[id_].texto = texto

    def seleccionar_nodo(self, nodoId : str, user : WebSocket):

        if user in self.usuarios:
            
            if nodoId is None:
                self.usuarios[user].objeto = None
            elif nodoId in self.nodos:
                self.usuarios[user].objeto = nodoId

    def esta_ocupado(self, nodoId : str, userOrder: WebSocket):
        return any([self.usuarios[user].objeto == nodoId and user != userOrder for user in self.usuarios])

    def propietario(self, nodoId: str):
        if nodoId in self.nodos:
            for user in self.usuarios.values():
                if user.objeto == nodoId:
                    return user.nombre
                
        return None

    def mover_cursor(self, user: WebSocket, x : float, y : float):
        if user in self.usuarios:
            self.usuarios[user].x = x
            self.usuarios[user].y = y

    def cambiar_opacidad_nodo(self, nodoId: str, opacity: float):
        if nodoId in self.nodos:
            self.nodos[nodoId].opacidad = opacity

    def cambiar_radius_nodo(self, nodoId: str, radius: float):
        if nodoId in self.nodos:
            self.nodos[nodoId].radius = radius

    def bloquear_nodo(self, nodoId: str):
        if nodoId in self.nodos:
            self.nodos[nodoId].pin = True

    def desbloquear_nodo(self, nodoId: str):
        if nodoId in self.nodos:
            self.nodos[nodoId].pin = False

    def mover_nodo_al_frente(self, nodoId: str):
        if nodoId in self.nodos:
            nodo = self.nodos.pop(nodoId)
            self.nodos[nodoId] = nodo

    def mover_nodo_atras(self, nodoId: str):
        if nodoId in self.nodos:
            nodo = self.nodos.pop(nodoId)
            newNodos : Dict[str, Nodo] = {nodoId: nodo}
            for nodo_ in self.nodos:
                newNodos[nodo_] = self.nodos[nodo_]
            self.nodos = newNodos

    def obtener_estado_inicial(self):
        return {
            "tipo": "estado_inicial",
            "nodos": [nodo.model_dump() for nodo in self.nodos.values()],
            "conexiones": [conexion.model_dump() for conexion in self.conexiones.values()],
            "nombre": self.nombre_proyecto
        }

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
    
        log.info(response)
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
                log.info(f"sala {room_id} eliminada por estar vacia y sin contenido.")
            
            else:
                await self.send_user_list(room_id)

manager = ConnectionManager()

@app.get("/status/{room_id}")
async def state_of_room(room_id: str):
    room = manager.get_or_create_diagram(room_id)
    response = {
        "usuarios": [user.model_dump() for user in room.usuarios.values()],
        "conexiones": [conx.model_dump() for conx in room.conexiones.values()],
        "nodos": [nodo.model_dump() for nodo in room.nodos.values()],
        "nombre": room.nombre_proyecto
    }

    return response

@app.get("/delete/{room_id}")
def del_room(room_id: str):

    return manager.del_room(room_id)

@app.websocket("/ws/{room_id}/{nombre}")
async def websocket_endpoint(websocket: WebSocket, room_id:str, nombre: str):

    await manager.connect(websocket, nombre, room_id)
    room = manager.get_or_create_diagram(room_id)

    try:
        while True:

            is_reshippable = True

            data = await websocket.receive_json()
            tipo = data.get("tipo")
            if tipo not in ["mover_cursor", "mover_nodo"]:
                log.debug(str(data))

            if not tipo:
                continue

            if tipo == "nuevo_nodo":
                nodo = Nodo(**data["nodo"])
                room.add_nodo(nodo, nodo.id)

            elif tipo == "mover_nodo":
                room.mover_nodo(data["id"], data["x"], data["y"])

            elif tipo == "eliminar_nodo":
                room.del_nodo(data["id"])

            elif tipo == "redimensionar_nodo":
                room.redimensionar_nodo(
                    data["id"],
                    data["x"],
                    data["y"],
                    data["w"],
                    data["h"],
                )

            elif tipo == "cambiar_texto_nodo":
                room.cambiar_texto_nodo(
                    data["id"],
                    data["texto"]
                )

            elif tipo == "asignar_color_user":
                room.asignar_color_user(websocket, data["color"])
                await manager.send_user_list(room_id)
                is_reshippable = False

            elif tipo == "seleccionar_nodo":

                is_reshippable = False

                if data["id"] is not None and room.esta_ocupado(data["id"], websocket):
                    await websocket.send_json({
                        "tipo": "nodo_bloqueado",
                        "por": room.propietario(data["id"])
                    })

                else:
                    room.seleccionar_nodo(data["id"], websocket)
                    await manager.send_user_list(room_id)

            elif tipo == "cambiar_color_nodo":
                room.cambiar_color_nodo(data["id"], data["color"])

            elif tipo == 'crear_conexion':
                conexion = Conexion(**data["conexion"])
                room.add_conexion(conexion, conexion.id)

            elif tipo == 'eliminar_conexion':
                room.del_conexion(data["id"])

            elif tipo == 'mover_cursor':
                room.mover_cursor(websocket, data["x"], data["y"])

            elif tipo == 'cambiar_opacidad_nodo':
                room.cambiar_opacidad_nodo(data['id'], data['opacidad'])

            elif tipo == 'cambiar_radius_nodo':
                room.cambiar_radius_nodo(data['id'], data['radius'])

            elif tipo == 'cambiar_nombre_proyecto':
                room.cambiar_nombre(data['nombre'])

            elif tipo == 'traer_al_frente':
                room.mover_nodo_al_frente(data['id'])

            elif tipo == 'enviar_al_fondo':
                room.mover_nodo_atras(data['id'])

            elif tipo == 'bloquear_nodo':
                room.bloquear_nodo(data['id'])

            elif tipo == 'desbloquear_nodo':
                room.desbloquear_nodo(data['id'])

            if is_reshippable:
                await manager.broadcast_to_room(room_id, data, websocket)



    except WebSocketDisconnect:
        await manager.disconnect(websocket, room_id)

app.mount("/", StaticFiles(directory="static", html=True), name="static")