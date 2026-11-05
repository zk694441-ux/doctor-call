const isProduction = process.env.NODE_ENV === 'production';
const useLocalApi = !isProduction && String(process.env.REACT_APP_USE_LOCAL_API).toLowerCase() === 'true';

let rawBaseUrl =
	(useLocalApi
		? process.env.REACT_APP_API_BASE_URL_LOCAL
		: process.env.REACT_APP_API_BASE_URL_LIVE) ||
	process.env.REACT_APP_API_BASE_URL ||
	'';

// In production, never allow a localhost URL to leak into the client bundle
if (isProduction && /localhost|127\.0\.0\.1/i.test(rawBaseUrl)) {
	rawBaseUrl = '';
}

export const getBaseUrl = () => {
	const trimmed = String(rawBaseUrl).trim().replace(/\/+$/, '');
	if (!trimmed) return '/api/v1';
	if (/\/api\/v1$/i.test(trimmed)) return trimmed;
	return `${trimmed}/api/v1`;
};
