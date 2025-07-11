import { getUserToken } from '~/session.server.ts';

const BACKEND_URL = process.env.BACKEND_URL;

export const fetcher = async ({
	url,
	method = 'GET',
	request,
	data = null,
}: {
	url: string;
	data?: object | null;
	method?: 'POST' | 'GET' | 'PUT';
	request: Request;
}) => {
	try {
		const userToken = await getUserToken({ request });
		const baseUrl = process.env.BACKEND_URL || 'https://chat-module-2.onrender.com';
		// S'assurer que l'URL est bien formatée et enlever les double slashes
		const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
		const cleanPath = url.replace(/^\/+/, '');
		const fullUrl = `${cleanBaseUrl}/${cleanPath}`;
		
		const response = await fetch(fullUrl, {
			method,
			body: method === 'GET' ? null : JSON.stringify(data),
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${userToken}`,
			},
		});

		if (!response.ok) {
			console.error('API Error:', response.status, response.statusText);
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const responseData = await response.json();
		return responseData;
	} catch (error) {
		console.error('Fetch error:', error);
		throw error;
	}
};

export const fileFetcher = async ({
	url,
	method = 'GET',
	request,
	data,
}: {
	url: string;
	data: FormData;
	method?: 'POST' | 'GET' | 'PUT';
	request: Request;
}) => {
	const userToken = await getUserToken({ request });
	// 2. On appelle notre API Nest avec les données du formulaire
	const response = await fetch(`${process.env.BACKEND_URL}${url}`, {
		method,
		body: method === 'GET' ? null : data,
		headers: {
			Authorization: `Bearer ${userToken}`,
		},
	});

	if (response.status !== 200 && response.status !== 201) {
		throw new Error(response.statusText);
	}
	return await response.json();
};
