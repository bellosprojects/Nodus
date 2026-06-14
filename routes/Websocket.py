from fastapi import WebSocket, APIRouter, WebSocketDisconnect, Query
from models import Nodo, Conexion, manager
from services import logger, supabase

router = APIRouter()

@router.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id:str, token : str = Query(...)):

    try:
        user = supabase.auth.get_user(token)
        user_id = user.user.id
        user_email = user.user.email
        display_name = user.user.user_metadata.get("display_name", user_email.split('@')[0])
    except Exception as e:
        await websocket.close(code = 1008, reason="Invalid token")
        return

    await manager.connect(websocket, display_name, room_id, user_id, token)
    room = await manager.get_or_create_diagram(room_id)

    try:
        while True:

            is_reshippable = True

            data = await websocket.receive_json()
            tipo = data.get("tipo")
            if tipo not in ["mover_cursor", "mover_nodos"]:
                logger.debug(str(data))

            if not tipo:
                continue

            if tipo == "nuevo_nodo":
                nodo = Nodo(**data["nodo"])
                room.add_nodo(nodo, nodo.id)
                await room.persist()

            elif tipo == "mover_nodos":
                nodos = data["nodos"]
                for nodo in nodos:
                    room.mover_nodo(nodo["id"], nodo["x"], nodo["y"])
                await room.persist()

            elif tipo == "eliminar_nodo":
                room.del_nodo(data["id"])
                await room.persist()

            elif tipo == "redimensionar_nodo":
                room.redimensionar_nodo(
                    data["id"],
                    data["x"],
                    data["y"],
                    data["w"],
                    data["h"],
                )
                await room.persist()

            elif tipo == "cambiar_texto_nodo":
                room.cambiar_texto_nodo(
                    data["id"],
                    data["texto"]
                )
                await room.persist()

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
                await room.persist()

            elif tipo == 'crear_conexion':
                conexion = Conexion(**data["conexion"])
                room.add_conexion(conexion, conexion.id)
                await room.persist()

            elif tipo == 'eliminar_conexion':
                room.del_conexion(data["id"])
                await room.persist()

            elif tipo == 'mover_cursor':
                room.mover_cursor(websocket, data["x"], data["y"])

            elif tipo == 'cambiar_opacidad_nodo':
                room.cambiar_opacidad_nodo(data['id'], data['opacidad'])
                await room.persist()

            elif tipo == 'cambiar_radius_nodo':
                room.cambiar_radius_nodo(data['id'], data['radius'])
                await room.persist()

            elif tipo == 'cambiar_nombre_proyecto':
                room.cambiar_nombre(data['nombre'])
                await room.persist()

            elif tipo == 'traer_al_frente':
                room.mover_nodo_al_frente(data['id'])
                await room.persist()

            elif tipo == 'enviar_al_fondo':
                room.mover_nodo_atras(data['id'])
                await room.persist()

            elif tipo == 'bloquear_nodo':
                room.bloquear_nodo(data['id'])
                await room.persist()

            elif tipo == 'desbloquear_nodo':
                room.desbloquear_nodo(data['id'])
                await room.persist()

            elif tipo == 'cambiar_estilo_conexion':
                room.cambiar_estilo_conexion(data['id'], data['estilo'])
                await room.persist()

            elif tipo == 'cambiar_estilo_nodo':
                room.cambiar_estilo_nodo(data['id'], data['estilo'])
                await room.persist()

            elif tipo == 'cambiar_nodo_property':
                room.cambiar_nodo_property(data['id'], data['propertyName'], data['propertyValue'])
                await room.persist()

            elif tipo == 'cambiar_conexion_property':
                room.cambiar_conexion_property(data['id'], data['propertyName'], data['propertyValue'])
                await room.persist()

            elif tipo == 'deletear_nodo_property':
                room.deletear_nodo_property(data['id'], data['propertyName'])
                await room.persist()

            elif tipo == 'deletear_conexion_property':
                room.deletear_conexion_property(data['id'], data['propertyName'])
                await room.persist()

            elif tipo == 'cambiar_proyecto_property':
                room.cambiar_proyecto_property(data['propertyName'], data['propertyValue'])
                await room.persist()

            elif tipo == 'deletear_proyecto_property':
                room.deletear_proyecto_property(data['propertyName'])
                await room.persist()

            if is_reshippable:
                await manager.broadcast_to_room(room_id, data, websocket)



    except WebSocketDisconnect:
        await manager.disconnect(websocket, room_id)