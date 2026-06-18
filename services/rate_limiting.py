import time
from collections import deque
from typing import Dict, Optional
from fastapi import WebSocket
from .logger_service import logger
import os

class WebSocketRateLimiter:
    """Rate limiter para conexiones WebSocket"""
    
    def __init__(self):
        # Diccionario de límites por conexión (WebSocket ID -> deque de timestamps)
        self._message_history: Dict[str, deque] = {}
        self._last_cleanup = time.time()
        
        # Configuración de límites
        # Cargar desde variables de entorno o usar defaults
        self.MAX_MESSAGES_PER_SECOND = int(os.getenv("WS_MAX_MSGS_PER_SECOND", "30"))
        self.MAX_MESSAGES_PER_MINUTE = int(os.getenv("WS_MAX_MSGS_PER_MINUTE", "1800"))
        self.WINDOW_SECONDS = 1
        self.WINDOW_MINUTES = 60
        
        # Tiempo de bloqueo si se excede (30 segundos)
        self.BLOCK_DURATION = 30
        
        # Diccionario de conexiones bloqueadas (socket_id -> timestamp de desbloqueo)
        self._blocked: Dict[str, float] = {}
        
    def _get_or_create_history(self, socket_id: str) -> deque:
        """Obtiene o crea el historial de mensajes para una conexión"""
        if socket_id not in self._message_history:
            self._message_history[socket_id] = deque()
        return self._message_history[socket_id]
    
    def _cleanup_old_messages(self, history: deque, window_start: float):
        """Elimina mensajes anteriores a la ventana de tiempo"""
        while history and history[0] < window_start:
            history.popleft()
    
    def _is_blocked(self, socket_id: str) -> bool:
        """Verifica si una conexión está bloqueada"""
        if socket_id in self._blocked:
            if time.time() < self._blocked[socket_id]:
                return True
            else:
                # Desbloquear si pasó el tiempo
                del self._blocked[socket_id]
        return False
    
    def _block_connection(self, socket_id: str):
        """Bloquea una conexión por BLOCK_DURATION segundos"""
        self._blocked[socket_id] = time.time() + self.BLOCK_DURATION
        logger.warning(f"Conexión {socket_id} bloqueada por {self.BLOCK_DURATION}s por exceder límites")
    
    async def check_rate_limit(self, websocket: WebSocket) -> tuple[bool, Optional[str]]:
        """
        Verifica si la conexión excede los límites.
        
        Returns:
            (is_allowed, message)
        """
        socket_id = id(websocket)
        now = time.time()
        
        # Verificar si está bloqueada
        if self._is_blocked(socket_id):
            remaining = int(self._blocked[socket_id] - now)
            return False, f"Rate limit exceeded. Try again in {remaining}s"
        
        # Obtener historial
        history = self._get_or_create_history(socket_id)
        
        # Limpiar mensajes antiguos
        window_start_second = now - self.WINDOW_SECONDS
        window_start_minute = now - self.WINDOW_MINUTES
        
        self._cleanup_old_messages(history, window_start_minute)
        
        # Contar mensajes en las ventanas
        messages_in_second = sum(1 for ts in history if ts >= window_start_second)
        messages_in_minute = len(history)
        
        # Verificar límites
        if messages_in_second >= self.MAX_MESSAGES_PER_SECOND:
            self._block_connection(socket_id)
            return False, f"Too many messages per second (max: {self.MAX_MESSAGES_PER_SECOND})"
        
        if messages_in_minute >= self.MAX_MESSAGES_PER_MINUTE:
            self._block_connection(socket_id)
            return False, f"Too many messages per minute (max: {self.MAX_MESSAGES_PER_MINUTE})"
        
        # Registrar el mensaje
        history.append(now)
        return True, None
    
    def get_stats(self, socket_id: str) -> dict:
        """Obtiene estadísticas de una conexión (para debugging)"""
        if socket_id not in self._message_history:
            return {"messages": 0, "blocked": False}
        
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
        """Limpia los datos de una conexión al desconectarse"""
        if socket_id in self._message_history:
            del self._message_history[socket_id]
        if socket_id in self._blocked:
            del self._blocked[socket_id]

# Singleton
rate_limiter = WebSocketRateLimiter()