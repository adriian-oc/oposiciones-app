from slowapi import Limiter
from slowapi.util import get_remote_address

# Limitador en memoria por IP -- suficiente para un endpoint público de bajo volumen como
# access-requests; si se despliega detrás de varias instancias habría que pasar a un backend
# compartido (Redis), pero no hace falta a esta escala.
limiter = Limiter(key_func=get_remote_address)
