import logging
import re
import sys
from logging.handlers import RotatingFileHandler

FORMATO = "%(asctime)s | %(levelname)s | %(name)s | %(message)s"
FECHA_FORMATO = "%H:%M:%S"
MAX_BYTES = 5242880  # 5 Megabytes
BACKUP_COUNT = 5
REDACT_PATTERNS = [
    re.compile(r"(SUPABASE_KEY=)(\S+)"),
    re.compile(r"(ADMIN_TOKEN=)(\S+)"),
]


def _redact(msg: str) -> str:
    if not isinstance(msg, str):
        try:
            msg = str(msg)
        except Exception:
            return msg
    for pattern in REDACT_PATTERNS:
        msg = pattern.sub(r"\1***REDACTED***", msg)
    return msg


class RedactingFormatter(logging.Formatter):
    def format(self, record):
        try:
            record.msg = _redact(record.getMessage())
        except Exception:
            pass
        return super().format(record)


def setup_logger(name):
    logger = logging.getLogger(name)
    logger.setLevel(logging.DEBUG)
    logger.propagate = False

    if not logger.handlers:
        console_header = logging.StreamHandler(sys.stdout)
        console_header.setFormatter(logging.Formatter(FORMATO, FECHA_FORMATO))

        file_handler = RotatingFileHandler(
            "server.log",
            maxBytes=MAX_BYTES,
            backupCount=BACKUP_COUNT,
        )
        file_handler.setFormatter(logging.Formatter(FORMATO, FECHA_FORMATO))

        logger.addHandler(console_header)
        logger.addHandler(file_handler)

    return logger


logger = setup_logger("SERVER")