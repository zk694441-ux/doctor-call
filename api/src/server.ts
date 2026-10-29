import { Server } from 'http';
import app from "./app";
import config from './config';
import { PaymentService } from './app/modules/payment/payment.service';

async function bootstrap() {
    const server: Server = app.listen(config.port, () => {
        console.log(`Server running on port ${config.port}`);

        // Schedule periodic background tasks:
        // 1. Expire abandoned booking holds every 5 minutes
        setInterval(() => {
            PaymentService.expireAbandonedBookings().catch((err) => {
                console.error('[cron] Error expiring abandoned bookings:', err);
            });
        }, 5 * 60 * 1000);

        // 2. Dispatch automated appointment reminders every 30 minutes
        setInterval(() => {
            PaymentService.sendReminders().catch((err) => {
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

    const unexpectedHandler = (error: unknown) => {
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
}

bootstrap();
