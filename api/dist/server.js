"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const config_1 = __importDefault(require("./config"));
const payment_service_1 = require("./app/modules/payment/payment.service");
function bootstrap() {
    return __awaiter(this, void 0, void 0, function* () {
        const server = app_1.default.listen(config_1.default.port, () => {
            console.log(`Server running on port ${config_1.default.port}`);
            // Schedule periodic background tasks:
            // 1. Expire abandoned booking holds every 5 minutes
            setInterval(() => {
                payment_service_1.PaymentService.expireAbandonedBookings().catch((err) => {
                    console.error('[cron] Error expiring abandoned bookings:', err);
                });
            }, 5 * 60 * 1000);
            // 2. Dispatch automated appointment reminders every 30 minutes
            setInterval(() => {
                payment_service_1.PaymentService.sendReminders().catch((err) => {
                    console.error('[cron] Error dispatching reminders:', err);
                });
            }, 30 * 60 * 1000);
        });
        const exitHandler = () => {
            if (server) {
                server.close(() => {
                    console.log('Server Close');
                });
            }
        };
        const unexpectedHandler = (error) => {
            console.error('[Unexpected Server Error]:', error);
        };
        process.on('uncaughtException', unexpectedHandler);
        process.on('unhandledRejection', unexpectedHandler);
        process.on('SIGTERM', () => {
            console.log('Sigterm Received');
            if (server) {
                server.close();
            }
        });
    });
}
bootstrap();
