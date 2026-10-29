import httpStatus from "http-status";
import ApiError from "../../../errors/apiError";
import prisma from "../../../shared/prisma";
import { UserRole } from "@prisma/client";
import bcrypt from 'bcrypt';

export const create = async (payload: any): Promise<any> => {
    try {
        const { password, ...othersData } = payload;

        if (!othersData.email) {
            throw new ApiError(httpStatus.BAD_REQUEST, "Email is required !!");
        }
        if (!password) {
            throw new ApiError(httpStatus.BAD_REQUEST, "Password is required !!");
        }

        const data = await prisma.$transaction(async (tx) => {
            const existEmail = await tx.auth.findUnique({ where: { email: othersData.email } });
            if (existEmail) {
                throw new ApiError(httpStatus.BAD_REQUEST, "Email Already Exist !!");
            }

            const existPatient = await tx.patient.findUnique({ where: { email: othersData.email } });
            if (existPatient) {
                throw new ApiError(httpStatus.BAD_REQUEST, "Email Already Exist !!");
            }

            const patient = await tx.patient.create({
                data: othersData,
            });

            const hashedPassword = await bcrypt.hash(password, 12);
            const auth = await tx.auth.create({
                data: {
                    email: patient.email,
                    password: hashedPassword,
                    role: UserRole.patient,
                    userId: patient.id
                },
            });

            return {
                patient,
                auth,
            };
        });

        return data;
    } catch (error: any) {
        if (error instanceof ApiError) {
            throw error;
        }
        throw new ApiError(httpStatus.BAD_REQUEST, error.message || "Failed to create patient account !!");
    }
};
