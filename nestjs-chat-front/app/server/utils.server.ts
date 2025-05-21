import { getUserToken } from '~/session.server.ts';

const BACKEND_URL = ' https://3705-196-203-166-66.ngrok-free.app/ ';

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
		const fullUrl = `${BACKEND_URL}${url}`;
		
		const response = await fetch(fullUrl, {
			method,
			body: method === 'GET' ? null : JSON.stringify(data),
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${userToken}`,
			},
		});

		const responseData = await response.json();

		if (!response.ok) {
			throw new Error(responseData.message || 'Une erreur est survenue');
		}

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
