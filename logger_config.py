import logging
from logging.handlers import RotatingFileHandler
import sys

FORMATO = "%(asctime)s | %(levelname)s | %(name)s | %(message)s"
FECHA_FORMATO = "%H:%M:%S"
MAX_BYTES = 5242880 # 5 Megabytes
BACKUP_COUNT = 5

def setup_logger(name):
    logger = logging.getLogger(name)
    logger.setLevel(logging.DEBUG)

    console_header = logging.StreamHandler(sys.stdout)
    console_header.setFormatter(logging.Formatter(FORMATO, FECHA_FORMATO))

    file_handler = RotatingFileHandler(
        "server.log",
        maxBytes=MAX_BYTES,
        backupCount=BACKUP_COUNT
    )
    file_handler.setFormatter(logging.Formatter(FORMATO, FECHA_FORMATO))

    if not logger.handlers:
        logger.addHandler(console_header)
        logger.addHandler(file_handler)

    return logger