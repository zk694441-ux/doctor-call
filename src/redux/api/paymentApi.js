import { tagTypes } from "../tag-types";
import { baseApi } from "./baseApi";

const PAYMENT_URL = '/payment';

export const paymentApi = baseApi.injectEndpoints({
    endpoints: (build) => ({
        createPaymentOrder: build.mutation({
            query: (data) => ({
                url: `${PAYMENT_URL}/create-order`,
                method: 'POST',
                data: data
            }),
            invalidatesTags: [tagTypes.payment]
        }),
        verifyPayment: build.mutation({
            query: (data) => ({
                url: `${PAYMENT_URL}/verify`,
                method: 'POST',
                data: data
            }),
            invalidatesTags: [tagTypes.appointments, tagTypes.payment]
        }),
        requestRefund: build.mutation({
            query: (data) => ({
                url: `${PAYMENT_URL}/refund`,
                method: 'POST',
                data: data
            }),
            invalidatesTags: [tagTypes.appointments, tagTypes.payment]
        }),
        getPaymentHistory: build.query({
            query: () => ({
                url: `${PAYMENT_URL}/history`,
                method: 'GET'
            }),
            providesTags: [tagTypes.payment]
        }),
        getRefundStatus: build.query({
            query: (refundId) => ({
                url: `${PAYMENT_URL}/refund/${refundId}`,
                method: 'GET'
            }),
            providesTags: [tagTypes.payment]
        }),
    })
});

export const {
    useCreatePaymentOrderMutation,
    useVerifyPaymentMutation,
    useRequestRefundMutation,
    useGetPaymentHistoryQuery,
    useGetRefundStatusQuery,
} = paymentApi;
