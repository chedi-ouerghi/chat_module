import { z } from 'zod';
import { fetcher } from './utils.server.ts';

const getUsersSchema = z.array(
	z.object({
		id: z.string(),
		email: z.string(),
		firstName: z.string(),
	})
);

export const getUsers = async ({ request }: { request: Request }) => {
	try {
		const response = await fetcher({
			request,
			url: 'users',
			method: 'GET',
		});

		console.log('Users response:', response); // Debug log
		return getUsersSchema.parse(response);
	} catch (error) {
		console.error('Error fetching users:', error);
		return [];
	}
};
