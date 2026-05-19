FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY exporter.py .
# Port 9809 — standard CSI sidecar metrics (csi_sidecar_operations_seconds)
# Port 2112 — driver-specific metrics (enabled when DRIVER=vsphere)
# Port 2113 — syncer metrics           (enabled when DRIVER=vsphere)
EXPOSE 9809 2112 2113
CMD ["python", "exporter.py"]
