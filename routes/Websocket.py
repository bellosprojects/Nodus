from fastapi import WebSocket, APIRouter, WebSocketDisconnect, Query, Depends
from models import Nodo, Conexion, manager
from services import logger, supabase, rate_limiter

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

            data = await websocket.receive_json()
            tipo = data.get("tipo")

            is_allowed, error_message = await rate_limiter.check_rate_limit(
                websocket=websocket,
                message_type=tipo,
                data=data
            )

            if not is_allowed:
                logger.warning(f"Rate limit excedido para usuario {display_name}: {error_message}")
                await websocket.close(code=1008, reason=error_message)
                return

            is_reshippable = True

            if tipo not in ["mover_cursor", "mover_nodos"]:
                logger.debug(str(data))

            if not tipo:
                continue

            if tipo == "nuevo_nodo" and not validate_node_data(data=data["nodo"]):
                await websocket.send_json({"tipo": "error", "mensaje": "Datos de nodo invalidos"})
                continue

            if tipo == "nuevo_nodo":
                nodo = Nodo(**data["nodo"])
                room.add_nodo(nodo, nodo.id)
                await room.save_nodes_self()

            elif tipo == "mover_nodos":
                nodos = data["nodos"]
                for nodo in nodos:
                    room.mover_nodo(nodo["id"], nodo["x"], nodo["y"])
                await room.save_nodes_self()

            elif tipo == "eliminar_nodo":
                room.del_nodo(data["id"])
                await room.save_nodes_self()

            elif tipo == "redimensionar_nodo":
                room.redimensionar_nodo(
                    data["id"],
                    data["x"],
                    data["y"],
                    data["w"],
                    data["h"],
                )
                await room.save_nodes_self()

            elif tipo == "cambiar_texto_nodo":
                room.cambiar_texto_nodo(
                    data["id"],
                    data["texto"]
                )
                await room.save_nodes_self()

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
                await room.save_nodes_self()

            elif tipo == 'crear_conexion':
                conexion = Conexion(**data["conexion"])
                room.add_conexion(conexion, conexion.id)
                await room.save_connections_self()

            elif tipo == 'eliminar_conexion':
                room.del_conexion(data["id"])
                await room.save_connections_self()

            elif tipo == 'mover_cursor':
                room.mover_cursor(websocket, data["x"], data["y"])

            elif tipo == 'cambiar_opacidad_nodo':
                room.cambiar_opacidad_nodo(data['id'], data['opacidad'])
                await room.save_nodes_self()

            elif tipo == 'cambiar_radius_nodo':
                room.cambiar_radius_nodo(data['id'], data['radius'])
                await room.save_nodes_self()

            elif tipo == 'cambiar_nombre_proyecto':
                room.cambiar_nombre(data['nombre'])
                await room.persist(False)

            elif tipo == 'traer_al_frente':
                room.mover_nodo_al_frente(data['id'])
                await room.save_nodes_self()

            elif tipo == 'enviar_al_fondo':
                room.mover_nodo_atras(data['id'])
                await room.save_nodes_self()

            elif tipo == 'bloquear_nodo':
                room.bloquear_nodo(data['id'])
                await room.save_nodes_self()

            elif tipo == 'desbloquear_nodo':
                room.desbloquear_nodo(data['id'])
                await room.save_nodes_self()

            elif tipo == 'cambiar_estilo_conexion':
                room.cambiar_estilo_conexion(data['id'], data['estilo'])
                await room.save_connections_self()

            elif tipo == 'cambiar_estilo_nodo':
                room.cambiar_estilo_nodo(data['id'], data['estilo'])
                await room.save_nodes_self()

            elif tipo == 'cambiar_nodo_property':
                room.cambiar_nodo_property(data['id'], data['propertyName'], data['propertyValue'])
                await room.save_nodes_self()

            elif tipo == 'cambiar_conexion_property':
                room.cambiar_conexion_property(data['id'], data['propertyName'], data['propertyValue'])
                await room.save_connections_self()

            elif tipo == 'deletear_nodo_property':
                room.deletear_nodo_property(data['id'], data['propertyName'])
                await room.save_nodes_self()

            elif tipo == 'deletear_conexion_property':
                room.deletear_conexion_property(data['id'], data['propertyName'])
                await room.save_connections_self()

            elif tipo == 'cambiar_proyecto_property':
                room.cambiar_proyecto_property(data['propertyName'], data['propertyValue'])
                await room.persist(False)

            elif tipo == 'deletear_proyecto_property':
                room.deletear_proyecto_property(data['propertyName'])
                await room.persist(False)

            if is_reshippable:
                await manager.broadcast_to_room(room_id, data, websocket)

    except WebSocketDisconnect:
        rate_limiter.cleanup_connection(id(websocket))
        await manager.disconnect(websocket, room_id)

    except Exception as e:
        logger.error(f"Error en WebSocket: {e}")
        rate_limiter.cleanup_connection(id(websocket))
        await manager.disconnect(websocket, room_id)

import os
from middleware import verify_admin_token

@router.get("/ws-stats")
async def get_ws_stats(admin_token: str = Depends(verify_admin_token)):
    """Endpoint para monitorear el rate limiting (solo admin)"""
    
    # Retornar estadísticas de todas las conexiones activas
    stats = {}
    for room_id, room in manager.rooms.items():
        for ws, user in room.usuarios.items():
            socket_id = id(ws)
            user_stats = rate_limiter.get_stats(socket_id)
            stats[user.nombre] = {
                "room": room_id,
                "messages_in_last_minute": user_stats.get("messages_in_last_minute", 0),
                "blocked": user_stats.get("blocked", False),
                "blocked_until": user_stats.get("blocked_until")
            }
    
    return {
        "total_connections": len(stats),
        "connections": stats
    }

import math

def validate_node_data(data: dict) -> bool:
    """Valida que los datos del nodo sean razonables"""
    try:
        # Validar coordenadas
        x = float(data.get("x", 0))
        y = float(data.get("y", 0))
        if not (-100000 <= x <= 100000) or not (-100000 <= y <= 100000):
            return False
        
        # Validar tamaño
        w = float(data.get("w", 60))
        h = float(data.get("h", 20))
        if not (60 <= w <= 5000) or not (20 <= h <= 5000):
            return False
        
        if any(math.isnan(v) or math.isinf(v) for v in [x, y, w, h]):
            return False
        
        return True
    except:
        return False