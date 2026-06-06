from fastapi import APIRouter, Request
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse

router = APIRouter()

templates = Jinja2Templates(directory="templates")

@router.get("/share_diagram", response_class=HTMLResponse)
async def share_view(request: Request, name: str = "Guest"):
    return templates.TemplateResponse(
        request=request,
        name="share.html",
        context={"user_name": name, "status": "Active"}
    )