import { z } from 'zod';

export const messagesSchema = z.array(
	z.object({
		id: z.string(),
		content: z.string(),
		sender: z.object({
			id: z.string(),
			firstName: z.string(),
		}),
	})
);

export const getConversationsSchema = z.array(
	z.object({
		id: z.string(),
		updatedAt: z.string(),
		users: z.array(
			z.object({
				id: z.string(),
				firstName: z.string(),
			})
		),
		messages: z.array(
			z.object({
				id: z.string(),
				content: z.string(),
				sender: z.object({
					id: z.string(),
					firstName: z.string(),
				}),
			})
		),
	})
);

const donationSchema = z.object({
	amount: z.number().nullable(),
	createdAt: z.string(),
	id: z.string(),
});

const callSchema = z.object({
	id: z.string(),
	type: z.enum(['AUDIO', 'VIDEO']),
	status: z.enum(['PENDING', 'ONGOING', 'ENDED', 'REJECTED', 'MISSED']),
	createdAt: z.string(),
	endedAt: z.string().nullable(),
	callerId: z.string(),
	receiverId: z.string(),
});

export const getConversationSchema = z.object({
	id: z.string(),
	updatedAt: z.string(),
	messages: messagesSchema,
	users: z.array(
		z.object({
			id: z.string(),
			firstName: z.string(),

			givenDonations: z.array(donationSchema),
			receivedDonations: z.array(donationSchema),
		})
	),
	calls: z.array(
		z.object({
			id: z.string(),
			type: z.enum(['AUDIO', 'VIDEO']),
			status: z.enum(['PENDING', 'ONGOING', 'ENDED', 'REJECTED', 'MISSED']),
			createdAt: z.string(),
			endedAt: z.string().nullable(),
			callerId: z.string(),
			receiverId: z.string(),
		})
	),
});
