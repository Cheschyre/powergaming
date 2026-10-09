FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt requirements-dev.txt ./
# Deployed images get runtime deps only. The local dev compose file
# builds with INSTALL_DEV=true so `pytest` works inside the container.
ARG INSTALL_DEV=false
RUN pip install --no-cache-dir -r requirements.txt \
 && if [ "$INSTALL_DEV" = "true" ]; then pip install --no-cache-dir -r requirements-dev.txt; fi

COPY app ./app
COPY alembic ./alembic
COPY alembic.ini .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
