from .Connection import Conexion
from .Node import Nodo
from typing import Dict
from .User import User
from fastapi.websockets import WebSocket
from services import save_room, save_connections, save_nodes, logger

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
        self.propiedades: dict = {}

    async def persist(self, all : bool = True):
        """Guarda el estado actual en Supabase."""
        try:
            await save_room(self.id, self.nombre_proyecto, self.propiedades)
            if all:
                await self.save_nodes_self()
                await self.save_connections_self()
            logger.debug(f"Sala {self.id} persistida correctamente")
        except Exception as e:
            logger.error(f"Error al persistir sala {self.id}: {e}")

    async def save_nodes_self(self):

        try:
            await save_nodes(self.id, self.nodos)
        except Exception as e:
            logger.error(f"Error al guardar los nodos de la sala {self.id}: {e}")

    async def save_connections_self(self):

        try:
            await save_connections(self.id, self.conexiones)
        except Exception as e:
            logger.error(f"Error al guardar las conexiones de la sala {self.id}: {e}")


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
            
            user_obj = self.usuarios[user]
            del self.usuarios[user]

            for u in self.usuarios.values():
                if u.objeto == user_obj.objeto:
                    u.objeto = None

    def del_user_by_id(self, user_id: str):

        to_delete = None

        for ws, user in self.usuarios.items():
            if user.user_id == user_id:
                to_delete = ws
                break

        if to_delete:
            self.del_user(to_delete)
            return True
        
        return False

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

    def cambiar_estilo_conexion(self, conexionId: str, style: int):
        if conexionId in self.conexiones:
            self.conexiones[conexionId].style = style

    def cambiar_estilo_nodo(self, nodoId: str, style: int):
        if nodoId in self.nodos:
            self.nodos[nodoId].style = style

    def cambiar_nodo_property(self, nodoId: str, propertyName: str, propertyValue):
        if nodoId in self.nodos:
            self.nodos[nodoId].properties[propertyName] = propertyValue

    def cambiar_conexion_property(self, conexionId: str, propertyName: str, propertyValue):
        if conexionId in self.conexiones:
            self.conexiones[conexionId].properties[propertyName] = propertyValue

    def deletear_nodo_property(self, nodoId: str, propertyName: str):
        if nodoId in self.nodos and propertyName in self.nodos[nodoId].properties:
            del self.nodos[nodoId].properties[propertyName]

    def deletear_conexion_property(self, conexionId: str, propertyName: str):
        if conexionId in self.conexiones and propertyName in self.conexiones[conexionId].properties:
            del self.conexiones[conexionId].properties[propertyName]

    def cambiar_proyecto_property(self, propertyName: str, propertyValue):
        self.propiedades[propertyName] = propertyValue

    def deletear_proyecto_property(self, propertyName: str):
        if propertyName in self.propiedades:
            del self.propiedades[propertyName]

    def obtener_estado_inicial(self, user_id: str = None):
        return {
            "tipo": "estado_inicial",
            "nodos": [nodo.model_dump() for nodo in self.nodos.values()],
            "conexiones": [conexion.model_dump() for conexion in self.conexiones.values()],
            "nombre": self.nombre_proyecto,
            "propiedades": self.propiedades,
            "user_id": user_id
        }