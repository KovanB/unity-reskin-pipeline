FROM python:3.12-slim

WORKDIR /app

COPY pyproject.toml .
COPY unity_reskin/ unity_reskin/
COPY web/ web/

RUN pip install --no-cache-dir ".[web]"

# Build frontend
RUN apt-get update && apt-get install -y nodejs npm && \
    cd web/frontend && npm install && npm run build && \
    apt-get remove -y nodejs npm && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

ENV DATA_DIR=/tmp/unity-reskin-data
EXPOSE 8000

CMD ["uvicorn", "web.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
