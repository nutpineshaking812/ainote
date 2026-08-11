# ═══════════════════════════════════════════
# Stage 1: Build
# ═══════════════════════════════════════════
FROM python:3.10-slim AS builder

WORKDIR /app

# Use Aliyun mirrors for faster install in China
RUN sed -i 's|deb.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources \
    && apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt -i https://mirrors.aliyun.com/pypi/simple/

# ═══════════════════════════════════════════
# Stage 2: Production
# ═══════════════════════════════════════════
FROM python:3.10-slim

WORKDIR /app

# Runtime system dependencies only (no build-essential)
RUN sed -i 's|deb.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
        pandoc \
        libgl1 \
        libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy Python packages from builder
COPY --from=builder /usr/local/lib/python3.10/site-packages /usr/local/lib/python3.10/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy application code
COPY app.py config.py utils.py requirements.txt ./
COPY services/ ./services/

EXPOSE 5002

ENV PYTHONUNBUFFERED=1

CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5002", "app:app", "--timeout", "120"]
