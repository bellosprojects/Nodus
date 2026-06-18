import time
from collections import deque
from typing import Dict, Optional, Set
from fastapi import WebSocket
from services import logger

class WebSocketRateLimiter:
    """Rate limiter inteligente para WebSocket"""
    
    def __init__(self):
        # Historial por conexión
        self._message_history: Dict[str, deque] = {}
        self._last_cleanup = time.time()
        
        # Conexiones bloqueadas
        self._blocked: Dict[str, float] = {}
        
        # Límites (más permisivos)
        self.MAX_MESSAGES_PER_SECOND = 30      # 30 mensajes/segundo
        self.MAX_MESSAGES_PER_MINUTE = 1000     # 1000 mensajes/minuto
        self.WINDOW_SECONDS = 1
        self.WINDOW_MINUTES = 60
        self.BLOCK_DURATION = 15               # 15 segundos de bloqueo
        
        # Mensajes que NO cuentan para el rate limit
        self.EXEMPT_TYPES: Set[str] = {
            "ping", "pong", "mover_cursor"
        }
        
        # Mensajes que cuentan como 1 aunque tengan muchos datos
        self.BULK_TYPES: Set[str] = {
            "mover_nodos"
        }
    
    def _get_or_create_history(self, socket_id: str) -> deque:
        if socket_id not in self._message_history:
            self._message_history[socket_id] = deque(maxlen=500)  # Limitar memoria
        return self._message_history[socket_id]
    
    def _cleanup_old_messages(self, history: deque, window_start: float):
        while history and history[0] < window_start:
            history.popleft()
    
    def _is_blocked(self, socket_id: str) -> bool:
        if socket_id in self._blocked:
            if time.time() < self._blocked[socket_id]:
                return True
            del self._blocked[socket_id]
        return False
    
    def _block_connection(self, socket_id: str):
        self._blocked[socket_id] = time.time() + self.BLOCK_DURATION
        logger.warning(f"Conexión {socket_id} bloqueada por {self.BLOCK_DURATION}s")
    
    def should_count_message(self, message_type: str) -> bool:
        """Determina si un mensaje debe contar para el rate limit"""
        return message_type not in self.EXEMPT_TYPES
    
    def get_message_weight(self, message_type: str, data: dict = None) -> int:
        """
        Calcula el "peso" de un mensaje.
        - La mayoría de mensajes pesan 1
        - Los mensajes bulk (mover_nodos) pesan 1 aunque tengan muchos nodos
        """
        if message_type in self.BULK_TYPES:
            return 1
        return 1
    
    async def check_rate_limit(self, websocket: WebSocket, message_type: str = None, data: dict = None) -> tuple[bool, Optional[str]]:
        """
        Verifica si la conexión excede los límites.
        
        Args:
            websocket: La conexión WebSocket
            message_type: Tipo de mensaje (para determinar si cuenta)
            data: Datos del mensaje (para cálculos de peso)
        
        Returns:
            (is_allowed, message)
        """
        socket_id = id(websocket)
        now = time.time()
        
        # Si está bloqueada, rechazar inmediatamente
        if self._is_blocked(socket_id):
            remaining = int(self._blocked[socket_id] - now)
            return False, f"Rate limit exceeded. Try again in {remaining}s"
        
        # Si el mensaje está exento, permitir sin contar
        if message_type and not self.should_count_message(message_type):
            return True, None
        
        # Obtener historial
        history = self._get_or_create_history(socket_id)
        
        # Limpiar mensajes antiguos
        window_start_second = now - self.WINDOW_SECONDS
        window_start_minute = now - self.WINDOW_MINUTES
        self._cleanup_old_messages(history, window_start_minute)
        
        # Calcular peso del mensaje
        weight = self.get_message_weight(message_type, data)
        
        # Contar mensajes en las ventanas (usando los pesos)
        messages_in_second = sum(1 for ts in history if ts >= window_start_second)
        messages_in_minute = len(history)
        
        # Verificar límites (con margen para evitar falsos positivos)
        if messages_in_second + weight > self.MAX_MESSAGES_PER_SECOND:
            self._block_connection(socket_id)
            return False, f"Too many messages per second (max: {self.MAX_MESSAGES_PER_SECOND})"
        
        if messages_in_minute + weight > self.MAX_MESSAGES_PER_MINUTE:
            self._block_connection(socket_id)
            return False, f"Too many messages per minute (max: {self.MAX_MESSAGES_PER_MINUTE})"
        
        # Registrar el mensaje (con su peso)
        for _ in range(weight):
            history.append(now)
        
        return True, None
    
    def get_stats(self, socket_id: str) -> dict:
        if socket_id not in self._message_history:
            return {"messages_in_last_minute": 0, "blocked": False}
        
        now = time.time()
        history = self._message_history[socket_id]
        window_start = now - self.WINDOW_MINUTES
        self._cleanup_old_messages(history, window_start)
        
        return {
            "messages_in_last_minute": len(history),
            "blocked": self._is_blocked(socket_id),
            "blocked_until": self._blocked.get(socket_id)
        }
    
    def cleanup_connection(self, socket_id: str):
        if socket_id in self._message_history:
            del self._message_history[socket_id]
        if socket_id in self._blocked:
            del self._blocked[socket_id]

# Singleton
rate_limiter = WebSocketRateLimiter()