# Chrome VM Backend API

Production-ready backend API for Chrome VM management with multi-cloud support.

## 🚀 Live Deployment

**Production URL**: https://pacific-blessing-production.up.railway.app

## 🌐 Architecture

This backend serves as an API gateway that proxies requests to Cloudflare Workers for VM management:

- **Railway Backend**: API proxy and management layer
- **Cloudflare Workers**: VM hosting and execution (https://chrome-vm-workers.mgmt-5e1.workers.dev)
- **D1 Database**: Persistent VM storage and metrics
- **Google Cloud**: Real VM provisioning (when configured)

## 📡 API Endpoints

### VM Management
- `GET /api/vms` - List all VMs
- `POST /api/vms` - Create new VM
- `GET /api/vms/:id` - Get VM details
- `DELETE /api/vms/:id` - Delete VM
- `POST /api/vms/:id/start` - Start VM
- `POST /api/vms/:id/stop` - Stop VM
- `POST /api/vms/:id/restart` - Restart VM
- `GET /api/vms/:id/status` - Get VM status

### Script Execution
- `POST /api/vms/:id/scripts` - Execute script on VM
- `GET /api/vms/:id/scripts` - Get script history

### Monitoring
- `GET /api/vms/:id/metrics` - Get VM metrics
- `POST /api/vms/:id/metrics` - Record metrics
- `GET /api/vms/:id/events` - Get VM events
- `GET /api/vms/:id/logs` - Get VM logs

### Servers
- `GET /api/servers` - List available servers
- `POST /api/servers` - Create server
- `DELETE /api/servers/:id` - Delete server

### Health
- `GET /health` - Health check

## 🔧 Environment Variables

```bash
# Cloudflare Workers URL
CLOUDFLARE_WORKERS_URL=https://chrome-vm-workers.mgmt-5e1.workers.dev

# CORS settings
CORS_ORIGIN=*

# Logging
LOG_LEVEL=info
```

## 🚀 Quick Deploy

### Railway (Recommended)
1. Fork this repository
2. Connect to Railway
3. Set environment variables
4. Deploy automatically

### Manual Deployment
```bash
npm install
npm start
```

## 🌟 Features

- ✅ **Multi-Cloud Support**: Cloudflare Workers + Google Cloud
- ✅ **Real VM Management**: Start, stop, restart VMs
- ✅ **Script Execution**: Run custom scripts on VMs
- ✅ **Monitoring**: Metrics, events, and health checks
- ✅ **Persistent Storage**: D1 database integration
- ✅ **Production Ready**: Error handling, logging, CORS

## 📊 VM Providers

### Cloudflare Workers (Mock VMs)
- **Instance Types**: t3.medium, t3.large
- **Capabilities**: Fast deployment, serverless
- **Use Case**: Testing, development, quick demos

### Google Cloud Platform (Real VMs)
- **Instance Types**: e2-medium, e2-large
- **Capabilities**: Real Docker containers, persistent storage
- **Use Case**: Production workloads, real Chrome automation

## 🔗 Related Services

- **Frontend**: https://chrome-vm-frontend-mp5mog8xn-manzely360-apps.vercel.app
- **VM Hosting**: https://chrome-vm-workers.mgmt-5e1.workers.dev
- **Documentation**: See main repository README

## 📝 License

MIT License - see LICENSE file for details.
