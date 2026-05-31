from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi import WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict
from datetime import datetime, timedelta, timezone
from supabase import create_client, Client
import os
from dotenv import load_dotenv
from logger_config import setup_logger

if os.path.exists(".env"):
    load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN")

if not SUPABASE_URL:
    raise Exception("SUPABASE_URL no está definido en las variables de entorno.")
if not SUPABASE_KEY:
    raise Exception("SUPABASE_KEY no está definido en las variables de entorno.")
if not ADMIN_TOKEN:
    raise Exception("ADMIN_TOKEN no está definido en las variables de entorno.")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

app = FastAPI(
    title="Servidor de Diagramas Colaborativos",
    description="Servidor backend para una aplicación de diagramas colaborativos en tiempo real.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["tauri://localhost",
        "http://localhost:1420",
        "http://localhost:1421",
        "https://tauri.localhost"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

class DeviceAuth(BaseModel):
    device_id: str
    app_version: str = "preview"

class ExtendRequest(BaseModel):
    device_id: str
    admin_token: str
    extra_days: int

@app.get("/")
async def root():
    return {
        "message": "Servidor de Diagramas Colaborativos está en funcionamiento.",
        "status": "runnig",
        "version": "1.0.0"
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat()
        }

@app.post("/validate")
async def validate_device(auth: DeviceAuth):

    """
    Verifica si un dispositivo tiene acceso valido.
    Los dispositivos nuevos reciben 14 dias de prueba automaticos.
    """

    try:

        result = supabase.table("licenses")\
            .select("expires_at")\
            .eq("device_id", auth.device_id)\
            .execute()
        
        now = datetime.now(timezone.utc)

        if not result.data:
            expires_at = now + timedelta(days=14)
            supabase.table("licenses").insert({
                "device_id": auth.device_id,
                "expires_at": expires_at.isoformat(),
                "extension_count": 0,
                "notes": f"primer uso - version {auth.app_version}",
                "last_validated_at": now.isoformat()
            }).execute()

            return {
                "valid": True,
                "message": f"Acceso concedido por 14 dias. Expira : {expires_at.strftime('%d/%m/%Y')}.",
                "expires_at": expires_at.isoformat(),
                "days_left": 14,
                "is_new": True
            }
        
        license_data = result.data[0]
        expires_at = datetime.fromisoformat(license_data["expires_at"].replace('Z', '+00:00'))

        supabase.table("licenses")\
            .update({"last_validated_at": now.isoformat()})\
            .eq("device_id", auth.device_id)\
            .execute()
        
        if now > expires_at:
            return {
                "valid": False,
                "message": "La licencia ha expirado. Por favor, contacte al soporte para extender su acceso.",
                "expires_at": expires_at.isoformat(),
                "days_left": 0
            }
        
        days_left = (expires_at - now).days

        return {
            "valid": True,
            "message": f"Acceso válido. Expira el {expires_at.strftime('%d/%m/%Y')}.",
            "expires_at": expires_at.isoformat(),
            "days_left": days_left,
            "is_new": False
        }

    except Exception as e:
        log.error(f"Error al validar el dispositivo: {e}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")


@app.post("/extend")
async def extend_access(request: ExtendRequest):
    """
    Extiende la licencia de un dispositivo.
    Solo accesible con el token de administrador.
    """
    # Validar token
    if request.admin_token != ADMIN_TOKEN:
        raise HTTPException(status_code=403, detail="Token de administrador inválido")
    
    # Validar días (1-30)
    if request.extra_days < 1 or request.extra_days > 30:
        raise HTTPException(status_code=400, detail="Solo se permiten entre 1 y 30 días")
    
    try:
        # Obtener licencia actual
        result = supabase.table("licenses")\
            .select("expires_at, extension_count")\
            .eq("device_id", request.device_id)\
            .execute()
        
        now = datetime.now(timezone.utc)
        
        if not result.data:
            # Si no existe, crear nueva con los días solicitados
            new_expiry = now + timedelta(days=request.extra_days)
            extension_count = 0
        else:
            current_expiry = datetime.fromisoformat(result.data[0]["expires_at"].replace('Z', '+00:00'))
            extension_count = result.data[0]["extension_count"] + 1
            
            # Si ya expiró, desde hoy; si no, sumar
            if current_expiry < now:
                new_expiry = now + timedelta(days=request.extra_days)
            else:
                new_expiry = current_expiry + timedelta(days=request.extra_days)
        
        # Actualizar/insertar
        supabase.table("licenses").upsert({
            "device_id": request.device_id,
            "expires_at": new_expiry.isoformat(),
            "extension_count": extension_count,
            "notes": f"Extendido {request.extra_days} días - {now.strftime('%Y-%m-%d %H:%M')}"
        }).execute()
        
        return {
            "success": True,
            "message": f"Licencia extendida {request.extra_days} días",
            "new_expiry": new_expiry.isoformat(),
            "extension_count": extension_count
        }
        
    except Exception as e:
        print(f"Error en extend: {e}")
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")

@app.get("/admin/devices")
async def list_devices(admin_token: str):
    """
    Lista todos los dispositivos con su estado.
    """
    if admin_token != ADMIN_TOKEN:
        raise HTTPException(status_code=403, detail="Token de administrador inválido")
    
    try:
        result = supabase.table("licenses")\
            .select("device_id, expires_at, created_at, extension_count, notes, last_validated_at")\
            .order("expires_at")\
            .execute()
        
        now = datetime.now(timezone.utc)
        devices = []
        
        for d in result.data:
            expires_at = datetime.fromisoformat(d["expires_at"].replace('Z', '+00:00'))
            
            # Truncar device_id para vista resumida
            device_id_short = d["device_id"][:30] + "..." if len(d["device_id"]) > 30 else d["device_id"]
            
            devices.append({
                "device_id_short": device_id_short,
                "device_id_full": d["device_id"],
                "expires_at": expires_at.isoformat(),
                "is_active": expires_at > now,
                "days_left": (expires_at - now).days if expires_at > now else 0,
                "created_at": d["created_at"],
                "extension_count": d["extension_count"],
                "last_validated_at": d.get("last_validated_at")
            })
        
        return {
            "total": len(devices),
            "active": sum(1 for d in devices if d["is_active"]),
            "expired": sum(1 for d in devices if not d["is_active"]),
            "devices": devices
        }
        
    except Exception as e:
        print(f"Error en list_devices: {e}")
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")

@app.get("/admin/device/{device_id}")
async def get_device(device_id: str, admin_token: str):
    """
    Obtiene detalles completos de un dispositivo específico.
    """
    if admin_token != ADMIN_TOKEN:
        raise HTTPException(status_code=403, detail="Token de administrador inválido")
    
    try:
        result = supabase.table("licenses")\
            .select("*")\
            .eq("device_id", device_id)\
            .execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Dispositivo no encontrado")
        
        device = result.data[0]
        expires_at = datetime.fromisoformat(device["expires_at"].replace('Z', '+00:00'))
        now = datetime.now(timezone.utc)
        
        return {
            "device_id": device["device_id"],
            "expires_at": device["expires_at"],
            "is_active": expires_at > now,
            "days_left": (expires_at - now).days if expires_at > now else 0,
            "created_at": device["created_at"],
            "extension_count": device["extension_count"],
            "notes": device.get("notes"),
            "last_validated_at": device.get("last_validated_at")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error en get_device: {e}")
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")

@app.delete("/admin/device/{device_id}")
async def delete_device(device_id: str, admin_token: str):
    """
    Elimina un dispositivo (útil para pruebas o revocar acceso permanentemente).
    """
    if admin_token != ADMIN_TOKEN:
        raise HTTPException(status_code=403, detail="Token de administrador inválido")
    
    try:
        result = supabase.table("licenses")\
            .delete()\
            .eq("device_id", device_id)\
            .execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Dispositivo no encontrado")
        
        return {
            "success": True,
            "message": f"Dispositivo {device_id} eliminado correctamente"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error en delete_device: {e}")
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")

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
    style: int
    properties: dict

class Conexion(BaseModel):
    id: str
    origenId: str
    destinoId: str
    style: int
    properties: dict

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
            if tipo not in ["mover_cursor", "mover_nodos"]:
                log.debug(str(data))

            if not tipo:
                continue

            if tipo == "nuevo_nodo":
                nodo = Nodo(**data["nodo"])
                room.add_nodo(nodo, nodo.id)

            elif tipo == "mover_nodos":
                nodos = data["nodos"]
                for nodo in nodos:
                    room.mover_nodo(nodo["id"], nodo["x"], nodo["y"])

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

            elif tipo == 'cambiar_estilo_conexion':
                room.cambiar_estilo_conexion(data['id'], data['estilo'])

            elif tipo == 'cambiar_estilo_nodo':
                room.cambiar_estilo_nodo(data['id'], data['estilo'])

            elif tipo == 'cambiar_nodo_property':
                room.cambiar_nodo_property(data['id'], data['propertyName'], data['propertyValue'])

            elif tipo == 'cambiar_conexion_property':
                room.cambiar_conexion_property(data['id'], data['propertyName'], data['propertyValue'])

            elif tipo == 'deletear_nodo_property':
                room.deletear_nodo_property(data['id'], data['propertyName'])

            elif tipo == 'deletear_conexion_property':
                room.deletear_conexion_property(data['id'], data['propertyName'])

            if is_reshippable:
                await manager.broadcast_to_room(room_id, data, websocket)



    except WebSocketDisconnect:
        await manager.disconnect(websocket, room_id)