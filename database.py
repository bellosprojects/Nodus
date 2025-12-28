import sqlite3
from logger_config import setup_logger

db_log = setup_logger("DATABASE")

def get_conection():
    try:
        conn = sqlite3.connect("diagramas.db")
        conn.execute("PRAGMA foreign_keys = ON")
        db_log.debug("Conexion a DB establecida")
        return conn
    except Exception as e:
        db_log.error(f"Fallo al conectar a la base de datos: {e}")
        raise

def init_db():
    conn = get_conection()
    cursor = conn.cursor()

    cursor.execute("CREATE TABLE IF NOT EXISTS salas (id TEXT PRIMARY KEY)")

    cursor.execute('''CREATE TABLE IF NOT EXISTS nodos (
                   id TEXT PRIMARY KEY, room_id TEXT, data TEXT,
                   FOREIGN KEY(room_id) REFERENCES salas(id) ON DELETE CASCADE)''')
    
    cursor.execute('''CREATE TABLE IF NOT EXISTS conexiones (
                   id TEXT PRIMARY KEY, room_id TEXT, data TEXT,
                   FOREIGN KEY(room_id) REFERENCES salas(id) ON DELETE CASCADE)''')
    
    conn.commit()
    conn.close()