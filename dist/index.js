"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const path_1 = __importDefault(require("path"));
const express_1 = __importDefault(require("express"));
const ws_1 = require("ws");
const config_1 = __importDefault(require("./config"));
const db = __importStar(require("./db"));
const routes_1 = __importDefault(require("./routes"));
const admin_1 = __importDefault(require("./admin"));
const ws_handler_1 = require("./ws-handler");
const gm = __importStar(require("./game-manager"));
db.init();
const app = (0, express_1.default)();
app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? true : false);
app.use(express_1.default.json({ limit: '1kb' }));
app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});
app.use(express_1.default.static(path_1.default.join(__dirname, '..', 'public'), {
    maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0,
}));
app.use(routes_1.default);
app.use(admin_1.default);
app.get('/game/:id', (_req, res) => {
    res.sendFile(path_1.default.join(__dirname, '..', 'public', 'game.html'));
});
app.get('/admin', (_req, res) => {
    res.sendFile(path_1.default.join(__dirname, '..', 'public', 'admin.html'));
});
const server = http_1.default.createServer(app);
const wss = new ws_1.WebSocketServer({
    server,
    path: '/ws',
    maxPayload: 1024,
});
(0, ws_handler_1.setupWebSocket)(wss);
gm.startCleanupInterval();
server.listen(config_1.default.port, () => {
    console.log(`Ultimate Tic-Tac-Toe server running on port ${config_1.default.port}`);
});
function shutdown() {
    console.log('Shutting down...');
    server.close();
    db.close();
    process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
    shutdown();
});
