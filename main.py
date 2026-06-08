from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from routes import WebsocketRouter, BasicRouter, LicenseRouter, StaticRouter

app = FastAPI(
    title="Servidor de Nodus Flow",
    description="Servidor backend para una Nodus Flow.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["tauri://localhost",
        "http://localhost:1420",
        "http://localhost:1421",
        "https://tauri.localhost",
        "http://tauri.localhost"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

app.include_router(WebsocketRouter)
app.include_router(BasicRouter)
app.include_router(LicenseRouter)
app.include_router(StaticRouter)

app.mount("/", StaticFiles(directory="static"), name="static")