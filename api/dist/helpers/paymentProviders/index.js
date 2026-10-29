"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPaymentProvider = getPaymentProvider;
const razorpayProvider_1 = require("./razorpayProvider");
const stripeProvider_1 = require("./stripeProvider");
const config_1 = __importDefault(require("../../config"));
let _provider = null;
function getPaymentProvider() {
    var _a;
    if (_provider)
        return _provider;
    const providerName = (((_a = config_1.default.payment) === null || _a === void 0 ? void 0 : _a.provider) || 'razorpay').toLowerCase();
    if (providerName === 'razorpay') {
        _provider = new razorpayProvider_1.RazorpayProvider();
        return _provider;
    }
    if (providerName === 'stripe') {
        _provider = new stripeProvider_1.StripeProvider();
        return _provider;
    }
    _provider = new razorpayProvider_1.RazorpayProvider();
    return _provider;
}
