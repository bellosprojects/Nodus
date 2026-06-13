from .database_service import supabase, save_with_retry
from models import Nodo, Conexion
from typing import Dict

async def save_room(room_id: str, name: str, properties: dict):
    """Guarda o actualiza la informacion de la sala"""

    def _save():
        supabase.table("rooms").upsert({
            "id": room_id,
            "name": name,
            "properties": properties,
            "updated_at": "now()"
        }).execute()

    await save_with_retry(_save)

async def save_nodes(room_id: str, nodes: Dict[str, Nodo]):
    """Reemplaza todos los nodos de la sala por los actuales"""

    def _save():
        supabase.table("nodes").delete().eq("room_id", room_id).execute()

        if nodes:
            data = []
            for node_id, node in nodes.items():
                data.append({
                    "id": node_id,
                    "room_id": room_id,
                    "x": node.x,
                    "y": node.y,
                    "w": node.w,
                    "h": node.h,
                    "texto": node.texto,
                    "color": node.color,
                    "opacidad": node.opacidad,
                    "radius": node.radius,
                    "pin": node.pin,
                    "style": node.style,
                    "properties": node.properties
                })
            supabase.table("nodes").insert(data).execute()

    await save_with_retry(_save)

async def save_connections(room_id: str, connections: Dict[str, Conexion]):
    """Reemplaza todas las conexiones de la sala."""

    def _save():
        supabase.table("connections").delete().eq("room_id", room_id).execute()
        if connections:
            data = []
            for conn_id, conn in connections.items():
                data.append({
                    "id": conn_id,
                    "room_id": room_id,
                    "origenId": conn.origenId,
                    "destinoId": conn.destinoId,
                    "style": conn.style,
                    "properties": conn.properties
                })
            supabase.table("connections").insert(data).execute()

    await save_with_retry(_save)

# ---------- CARGA ----------
async def load_room(room_id: str):
    result = supabase.table("rooms").select("*").eq("id", room_id).execute()
    return result.data[0] if result.data else None

async def load_nodes(room_id: str) -> Dict[str, Nodo]:
    result = supabase.table("nodes").select("*").eq("room_id", room_id).execute()
    nodes = {}
    for row in result.data:
        node = Nodo(
            id=row["id"],
            x=row["x"],
            y=row["y"],
            w=row["w"],
            h=row["h"],
            texto=row["texto"],
            color=row["color"],
            opacidad=row["opacidad"],
            radius=row["radius"],
            pin=row["pin"],
            style=row["style"],
            properties=row["properties"] or {}
        )
        nodes[row["id"]] = node
    return nodes

async def load_connections(room_id: str) -> Dict[str, Conexion]:
    result = supabase.table("connections").select("*").eq("room_id", room_id).execute()
    conns = {}
    for row in result.data:
        conn = Conexion(
            id=row["id"],
            origenId=row["origenId"],
            destinoId=row["destinoId"],
            style=row["style"],
            properties=row["properties"] or {}
        )
        conns[row["id"]] = conn
    return conns

async def delete_room(room_id: str):
    """Elimina la sala y todo su contenido (cascada)."""
    supabase.table("rooms").delete().eq("id", room_id).execute()