import nodemailer from 'nodemailer';
import config from '../config';

export const Transporter = nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: config.gmail_app_Email,
        pass: config.emailPass
    }
});
